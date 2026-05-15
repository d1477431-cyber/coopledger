const { onDocumentCreated } = require('firebase-functions/v2/firestore');
const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { defineSecret, defineString } = require('firebase-functions/params');
const logger = require('firebase-functions/logger');
const admin = require('firebase-admin');

const resendApiKey = defineSecret('RESEND_API_KEY');
const resendFrom = defineString('RESEND_FROM', {
  default: 'CoopLedger <onboarding@resend.dev>',
});
const appPublicUrl = defineString('APP_PUBLIC_URL', {
  default: 'https://coopledger-3cf7c.web.app',
});

if (!admin.apps.length) {
  admin.initializeApp();
}

/**
 * À la création d'un vote Firestore, envoie un e-mail aux membres actifs (Resend).
 * Secrets : firebase functions:secrets:set RESEND_API_KEY
 * Optionnel : APP_PUBLIC_URL, RESEND_FROM (paramètres déployables)
 */
exports.notifyMembersNewVote = onDocumentCreated(
  {
    document: 'votes/{voteId}',
    secrets: [resendApiKey],
    region: 'europe-west1',
  },
  async (event) => {
    const snap = event.data;
    if (!snap) return;

    const vote = snap.data();
    const voteId = event.params.voteId;
    const createurUid = vote.createurUid || vote.createurId || null;
    const cooperativeId = vote.cooperativeId || 'broukou';

    const db = admin.firestore();
    let usersSnap;
    try {
      usersSnap = await db.collection('users').where('statut', '==', 'actif').get();
    } catch (e) {
      logger.error('notifyMembersNewVote: lecture users', e);
      return;
    }

    const recipients = [];
    usersSnap.forEach((doc) => {
      if (doc.id === createurUid) return;
      const u = doc.data();
      if (u.cooperativeId && u.cooperativeId !== cooperativeId) return;
      const email = u.email;
      if (email && typeof email === 'string') recipients.push(email.trim());
    });

    const unique = [...new Set(recipients)];
    if (!unique.length) {
      logger.info('notifyMembersNewVote: aucun destinataire');
      return;
    }

    const { Resend } = require('resend');
    const resend = new Resend(resendApiKey.value());

    const from = resendFrom.value();
    const baseUrl = appPublicUrl.value().replace(/\/$/, '');
    const voteUrl = `${baseUrl}/vote`;

    const titre = vote.titre || 'Nouvelle proposition';
    const montant =
      vote.montant != null ? Number(vote.montant).toLocaleString('fr-FR') : '—';
    const subject = `CoopLedger — Vote requis : ${titre}`;

    const html = `<!DOCTYPE html>
<html>
<body style="font-family:system-ui,sans-serif;color:#14532d;">
  <h1 style="color:#15803d;">Nouveau vote</h1>
  <p>Une décision nécessite votre vote : <strong>${escapeHtml(titre)}</strong>.</p>
  <p>Montant : <strong>${escapeHtml(montant)} FCFA</strong></p>
  <p><a href="${voteUrl}" style="color:#15803d;">Ouvrir la page des votes</a></p>
  <p style="font-size:12px;color:#666;">ID scrutin : ${escapeHtml(voteId)}</p>
</body>
</html>`;

    const BATCH = 6;
    for (let i = 0; i < unique.length; i += BATCH) {
      const batch = unique.slice(i, i + BATCH);
      await Promise.all(
        batch.map((to) =>
          resend.emails
            .send({
              from,
              to: [to],
              subject,
              html,
            })
            .catch((err) => {
              logger.warn('notifyMembersNewVote: échec Resend', { to, err: err.message });
            })
        )
      );
    }

    logger.info('notifyMembersNewVote: e-mails envoyés', { count: unique.length });
  }
);

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

const VALID_ROLES = new Set(['president', 'tresorier', 'membre']);

/**
 * Callable : créer un utilisateur Firebase Auth + document users/{uid}.
 * Sécurité : JWT + profil président sur la même cooperativeId que la requête.
 */
exports.createMember = onCall(
  {
    region: 'europe-west1',
  },
  async (request) => {
    if (!request.auth?.uid) {
      throw new HttpsError('unauthenticated', 'Authentification requise');
    }

    const { nom, email, role, cooperativeId, tempPassword } = request.data || {};

    const nomClean = typeof nom === 'string' ? nom.trim() : '';
    const emailClean =
      typeof email === 'string' ? email.trim().toLowerCase() : '';
    const pwd =
      typeof tempPassword === 'string' ? tempPassword : '';

    if (!nomClean || !emailClean || pwd.length < 6) {
      throw new HttpsError(
        'invalid-argument',
        'Nom, email valides et mot de passe temporaire (minimum 6 caractères) requis'
      );
    }

    const roleFinal =
      typeof role === 'string' && VALID_ROLES.has(role) ? role : 'membre';
    const coop = typeof cooperativeId === 'string' && cooperativeId.trim()
      ? cooperativeId.trim()
      : 'broukou';

    const db = admin.firestore();
    const callerRef = db.collection('users').doc(request.auth.uid);
    const callerSnap = await callerRef.get();

    if (!callerSnap.exists) {
      throw new HttpsError('permission-denied', 'Profil introuvable');
    }

    const caller = callerSnap.data();
    if (caller.role !== 'president') {
      throw new HttpsError('permission-denied', 'Action réservée au président');
    }
    if (caller.cooperativeId !== coop) {
      throw new HttpsError('permission-denied', 'Coopérative non autorisée');
    }

    try {
      const userRecord = await admin.auth().createUser({
        email: emailClean,
        password: pwd,
        displayName: nomClean,
      });

      await db.collection('users').doc(userRecord.uid).set({
        uid: userRecord.uid,
        nom: nomClean,
        email: emailClean,
        role: roleFinal,
        cooperativeId: coop,
        statut: 'actif',
        dateInscription: admin.firestore.FieldValue.serverTimestamp(),
      });

      if (roleFinal === 'president') {
        const autres = await db
          .collection('users')
          .where('cooperativeId', '==', coop)
          .where('role', '==', 'president')
          .get();
        const demote = db.batch();
        autres.docs.forEach((d) => {
          if (d.id !== userRecord.uid) {
            demote.update(d.ref, { role: 'membre' });
          }
        });
        if (!autres.empty) await demote.commit();
      }

      return { uid: userRecord.uid, email: emailClean };
    } catch (e) {
      if (e.code === 'auth/email-already-exists') {
        throw new HttpsError('already-exists', 'Cet email est déjà utilisé');
      }
      logger.error('createMember: échec', e);
      throw new HttpsError(
        'internal',
        typeof e.message === 'string' ? e.message : 'Erreur serveur'
      );
    }
  }
);

/**
 * Callable : proposer un changement de rôle (création d'un vote role_change).
 * Écriture côté admin pour contourner les limites de règles Firestore côté client.
 */
exports.proposeRoleChangeVote = onCall(
  {
    region: 'europe-west1',
  },
  async (request) => {
    if (!request.auth?.uid) {
      throw new HttpsError('unauthenticated', 'Authentification requise');
    }

    const { targetUserId, newRole } = request.data || {};
    const targetUid =
      typeof targetUserId === 'string' ? targetUserId.trim() : '';
    const nextRole = typeof newRole === 'string' ? newRole.trim() : '';

    if (!targetUid || !VALID_ROLES.has(nextRole)) {
      throw new HttpsError(
        'invalid-argument',
        'Données invalides pour la proposition de changement de rôle'
      );
    }

    const db = admin.firestore();
    const callerRef = db.collection('users').doc(request.auth.uid);
    const callerSnap = await callerRef.get();
    if (!callerSnap.exists) {
      throw new HttpsError('permission-denied', 'Profil initiateur introuvable');
    }

    const caller = callerSnap.data();
    if (caller.role !== 'president') {
      throw new HttpsError('permission-denied', 'Action réservée au président');
    }
    const cooperativeId = caller.cooperativeId || 'broukou';

    const targetRef = db.collection('users').doc(targetUid);
    const targetSnap = await targetRef.get();
    if (!targetSnap.exists) {
      throw new HttpsError('not-found', 'Membre cible introuvable');
    }
    const target = targetSnap.data();

    if ((target.cooperativeId || 'broukou') !== cooperativeId) {
      throw new HttpsError(
        'permission-denied',
        'Membre hors coopérative autorisée'
      );
    }

    const oldRole = target.role || 'membre';
    if (oldRole === 'president' && nextRole !== 'president') {
      throw new HttpsError(
        'failed-precondition',
        'Le président ne peut pas être rétrogradé via ce formulaire'
      );
    }
    if (oldRole === nextRole) {
      throw new HttpsError(
        'failed-precondition',
        'Ce membre possède déjà ce rôle'
      );
    }

    const duplicateSnap = await db
      .collection('votes')
      .where('typeVote', '==', 'role_change')
      .where('statut', '==', 'ouvert')
      .where('targetUserId', '==', targetUid)
      .where('newRole', '==', nextRole)
      .limit(1)
      .get();
    if (!duplicateSnap.empty) {
      throw new HttpsError(
        'already-exists',
        'Un vote identique est déjà en cours'
      );
    }

    const membresActifsSnap = await db
      .collection('users')
      .where('cooperativeId', '==', cooperativeId)
      .where('statut', '==', 'actif')
      .get();
    const totalActifs = membresActifsSnap.size || 0;
    const majoriteRequise = Math.floor(totalActifs / 2) + 1;

    const now = new Date();
    const expiration = new Date(now.getTime() + 24 * 60 * 60 * 1000);

    const voteRef = await db.collection('votes').add({
      typeVote: 'role_change',
      titre: `Changement de rôle : ${target.nom || 'Membre'}`,
      description: `${caller.nom || 'Le président'} propose de passer ${target.nom || 'ce membre'} de ${oldRole} à ${nextRole}.`,
      targetUserId: targetUid,
      targetUserName: target.nom || 'Membre',
      oldRole,
      newRole: nextRole,
      cooperativeId,
      createurUid: request.auth.uid,
      createdBy: request.auth.uid,
      createdByName: caller.nom || 'Président',
      createdByRole: 'president',
      initiateur: caller.nom || 'Président',
      roleInitiateur: 'Président',
      statut: 'ouvert',
      votesOui: 0,
      votesNon: 0,
      totalMembres: totalActifs,
      quorumRequis: 0,
      majoriteRequise,
      dateCreation: now,
      dateExpiration: expiration,
      applique: false,
      montant: 0,
      categorie: 'gouvernance',
      fournisseur: 'CoopLedger',
      hash: `role-change-${targetUid}-${Date.now()}`,
      priorite: 'routine',
      txId: `RC-${Date.now()}`,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    return { voteId: voteRef.id };
  }
);
