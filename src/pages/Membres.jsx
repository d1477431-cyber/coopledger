import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  collection,
  onSnapshot,
  query,
  where,
  orderBy,
  doc,
  updateDoc,
  writeBatch,
} from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from '../firebase';

/** Coopérative par défaut (alignée useAuth / données existantes) */
const COOP_FALLBACK = 'broukou';

/** ═══ CONFIGURATION BADGES RÔLES (spec couleurs Tailwind) ═══ */
const ROLE_CONFIG = {
  president: {
    label: 'Président',
    bg: 'bg-purple-100 text-purple-700',
    icon: '🛡️',
  },
  tresorier: {
    label: 'Trésorier',
    bg: 'bg-blue-100 text-blue-700',
    icon: '🏦',
  },
  membre: {
    label: 'Membre',
    bg: 'bg-green-100 text-green-700',
    icon: '👤',
  },
};

/** Initiales pour avatars */
function getInitiales(nom = '') {
  return (
    nom
      .split(/\s+/)
      .filter(Boolean)
      .map((w) => w[0])
      .join('')
      .toUpperCase()
      .slice(0, 2) || '?'
  );
}

const AVATAR_COLORS = [
  'bg-green-700',
  'bg-blue-700',
  'bg-purple-700',
  'bg-amber-700',
  'bg-rose-700',
  'bg-teal-700',
];

function avatarColor(uid = '') {
  const idx = uid.charCodeAt(0) % AVATAR_COLORS.length;
  return AVATAR_COLORS[idx];
}

function formatDate(ts) {
  if (!ts) return '—';
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

function RoleBadge({ role }) {
  const cfg = ROLE_CONFIG[role] || ROLE_CONFIG.membre;
  return (
    <span
      className={`inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full ${cfg.bg}`}
    >
      {cfg.icon} {cfg.label}
    </span>
  );
}

/** ═══ ENVELOPPE MODALE (overlay + animation) ═══ */
function ModalShell({ children, onClose, title }) {
  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 transition-opacity duration-200"
      style={{ backgroundColor: 'rgba(0,0,0,0.45)' }}
      role="presentation"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        className="relative bg-white rounded-2xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto transform transition-all duration-200 scale-100 border border-gray-100"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute top-3 right-3 w-9 h-9 rounded-xl text-gray-400 hover:text-gray-700 hover:bg-gray-100 flex items-center justify-center text-lg font-medium"
          aria-label="Fermer"
        >
          ×
        </button>
        {title && (
          <div className="px-6 pt-6 pb-2 pr-14">
            <h2 className="text-lg font-bold text-gray-900">{title}</h2>
          </div>
        )}
        <div className="px-6 pb-6">{children}</div>
      </div>
    </div>
  );
}

/** ═══ CARTE KPI STATISTIQUES ═══ */
function StatCard({ icon, label, value, sub }) {
  return (
    <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
      <div className="w-10 h-10 bg-gray-50 rounded-xl flex items-center justify-center text-xl mb-2">
        {icon}
      </div>
      <p className="text-xs text-gray-500 mb-1">{label}</p>
      <p className="text-xl font-black text-gray-900 leading-tight">{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
    </div>
  );
}

const createMemberFn = httpsCallable(functions, 'createMember');

/** ═══ PAGE PRINCIPALE — gestion membres & rôles ═══ */
export default function Membres({ userData, notifications }) {
  const cooperativeId = userData?.cooperativeId || COOP_FALLBACK;
  const isPresident = userData?.role === 'president';
  const sendNotification = notifications?.sendNotification;
  const notifyPerm = notifications?.permission;

  const [membres, setMembres] = useState([]);
  const [bulletinRows, setBulletinRows] = useState([]);
  const [votesOuverts, setVotesOuverts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);

  /** Modales & formulaires */
  const [showAdd, setShowAdd] = useState(false);
  const [addForm, setAddForm] = useState({
    nom: '',
    email: '',
    role: 'membre',
    tempPassword: '',
  });
  const [addSubmitting, setAddSubmitting] = useState(false);

  const [roleModal, setRoleModal] = useState(null);
  /** Cible + rôle sélectionné avant validation */
  const [roleDraft, setRoleDraft] = useState('membre');
  const [presidencyConfirm, setPresidencyConfirm] = useState(false);

  const [removeModal, setRemoveModal] = useState(null);

  /** Transfert présidence (carte bas de page) : conf. simple puis saisie TRANSFÉRER */
  const [transferUid, setTransferUid] = useState('');
  const [transferStep, setTransferStep] = useState(0); // 0 | 1 (confirm) | 2 (phrase)
  const [transferPhraseInput, setTransferPhraseInput] = useState('');

  const showToast = useCallback((message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  }, []);

  /** ═══ Lecture membres (filtrés coop + ordre date) ═══ */
  useEffect(() => {
    const q = query(
      collection(db, 'users'),
      where('cooperativeId', '==', cooperativeId),
      orderBy('dateInscription', 'asc')
    );
    const unsub = onSnapshot(
      q,
      (snap) => {
        setMembres(snap.docs.map((d) => ({ uid: d.id, ...d.data() })));
        setLoading(false);
      },
      () => {
        showToast('Erreur lors du chargement des membres', 'error');
        setLoading(false);
      }
    );
    return () => unsub();
  }, [cooperativeId, showToast]);

  /** ═══ Bulletins de vote (compte par membre + KPI participation) ═══ */
  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'bulletins_vote'), (snap) => {
      const rows = snap.docs.map((d) => {
        const data = d.data();
        return { userId: data.userId, voteId: data.voteId };
      });
      setBulletinRows(rows);
    });
    return () => unsub();
  }, []);

  /** ═══ Votes en cours (blocage retrait / même logique Dashboard) ═══ */
  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'votes'), (snap) => {
      const now = new Date();
      const open = snap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .filter((v) => {
          if (v.statut !== 'ouvert') return false;
          const expiration = v.dateExpiration?.toDate
            ? v.dateExpiration.toDate()
            : new Date(v.dateExpiration);
          return expiration > now;
        });
      setVotesOuverts(open);
    });
    return () => unsub();
  }, []);

  /** Index bulletins par utilisateur coop */
  const coopUidSet = useMemo(() => new Set(membres.map((m) => m.uid)), [membres]);

  const votesParMembre = useMemo(() => {
    const counts = {};
    bulletinRows.forEach(({ userId }) => {
      if (!userId || !coopUidSet.has(userId)) return;
      counts[userId] = (counts[userId] || 0) + 1;
    });
    return counts;
  }, [bulletinRows, coopUidSet]);

  /** KPI participation : bulletins actifs coop / (scrutins distincts × membres actifs), max 100 % */
  const nbMembresActifs = useMemo(
    () => membres.filter((m) => m.statut === 'actif').length,
    [membres]
  );

  const activeUidSet = useMemo(() => {
    const s = new Set();
    membres.forEach((m) => {
      if (m.statut === 'actif') s.add(m.uid);
    });
    return s;
  }, [membres]);

  const tauxParticipation = useMemo(() => {
    const scrutinIds = new Set();
    let bulletinsCoopActifs = 0;
    bulletinRows.forEach(({ userId, voteId }) => {
      if (!userId || !activeUidSet.has(userId)) return;
      bulletinsCoopActifs += 1;
      if (voteId) scrutinIds.add(voteId);
    });
    const ns = scrutinIds.size;
    const denom = ns * nbMembresActifs;
    if (!denom) return 0;
    return Math.min(100, Math.round((bulletinsCoopActifs / denom) * 100));
  }, [bulletinRows, activeUidSet, nbMembresActifs]);

  const nomPresidentAffiche = useMemo(() => {
    const actif = membres.find((m) => m.role === 'president' && m.statut === 'actif');
    if (actif?.nom) return actif.nom;
    const any = membres.find((m) => m.role === 'president');
    return any?.nom || '—';
  }, [membres]);

  const nomTresorierAffiche = useMemo(() => {
    const actif = membres.find((m) => m.role === 'tresorier' && m.statut === 'actif');
    if (actif?.nom) return actif.nom;
    const any = membres.find((m) => m.role === 'tresorier');
    return any?.nom || '—';
  }, [membres]);

  const voteEnCours = votesOuverts.length > 0;

  /** ═══ Lot Firestore : transfert présidence (démotions + promotion) ═══ */
  const commitPresidencyToTarget = async (targetUid) => {
    const batch = writeBatch(db);
    membres.forEach((m) => {
      if (m.role === 'president' && m.uid !== targetUid) {
        batch.update(doc(db, 'users', m.uid), { role: 'membre' });
      }
    });
    batch.update(doc(db, 'users', targetUid), { role: 'president' });
    await batch.commit();
  };

  const handleToggleStatut = async (membre) => {
    if (!isPresident) return;
    if (membre.role === 'president') {
      showToast(
        'Impossible de désactiver ou réactiver le président depuis cette action',
        'error'
      );
      return;
    }
    if (membre.uid === userData?.uid) {
      showToast('Cette action ne s’applique pas à votre compte ici', 'error');
      return;
    }
    try {
      const next = membre.statut === 'actif' ? 'inactif' : 'actif';
      await updateDoc(doc(db, 'users', membre.uid), { statut: next });
      showToast(
        next === 'actif' ? 'Membre réactivé avec succès' : 'Membre désactivé avec succès',
        'success'
      );
    } catch {
      showToast('Erreur lors de la mise à jour du statut', 'error');
    }
  };

  /** Retrait = passage en inactif (pas suppression Auth / Firestore) */
  const confirmRemove = async () => {
    if (!removeModal) return;
    const { uid, nom, role } = removeModal;
    if (role === 'president') {
      showToast('Impossible de retirer le président', 'error');
      setRemoveModal(null);
      return;
    }
    if (uid === userData?.uid) {
      showToast('Vous ne pouvez pas vous retirer vous‑même', 'error');
      setRemoveModal(null);
      return;
    }
    if (voteEnCours) {
      showToast(
        'Impossible de retirer ce membre pendant un vote en cours',
        'error'
      );
      setRemoveModal(null);
      return;
    }
    try {
      await updateDoc(doc(db, 'users', uid), { statut: 'inactif' });
      showToast(`${nom || 'Membre'} retiré de la coopérative (compte désactivé)`, 'success');
    } catch {
      showToast('Erreur lors du retrait', 'error');
    }
    setRemoveModal(null);
  };

  /** Soumission modal « Changer rôle » (ne pas fermer avant validation réseau sauf transfert prez) */
  const submitRoleChange = async () => {
    if (!roleModal) return;
    const target = roleModal;
    const nextRole = roleDraft;

    if (target.role === 'president' && nextRole !== 'president') {
      showToast(
        'Impossible de retirer le titre de président depuis ce formulaire — utilisez le transfert de présidence.',
        'error'
      );
      return;
    }

    if (target.role === nextRole) {
      setRoleModal(null);
      setPresidencyConfirm(false);
      return;
    }

    if (nextRole === 'president') {
      if (!presidencyConfirm) return;
      try {
        await commitPresidencyToTarget(target.uid);
        showToast('Présidence mise à jour', 'success');
        setRoleModal(null);
        setPresidencyConfirm(false);
      } catch {
        showToast('Erreur lors du transfert de présidence', 'error');
      }
      return;
    }

    try {
      await updateDoc(doc(db, 'users', target.uid), { role: nextRole });
      showToast('Rôle mis à jour avec succès', 'success');
      setRoleModal(null);
      setPresidencyConfirm(false);
    } catch {
      showToast('Erreur lors de la mise à jour du rôle', 'error');
    }
  };

  const openRoleModal = (membre) => {
    if (!isPresident) return;
    if (membre.uid === userData?.uid && membre.role === 'president') {
      showToast(
        'Utilisez la section transfert en bas de page pour céder la présidence',
        'error'
      );
      return;
    }
    setRoleDraft(membre.role || 'membre');
    setPresidencyConfirm(false);
    setRoleModal(membre);
  };

  /** ═══ Ajouter membre (callable Cloud Function) ═══ */
  const submitAddMember = async (e) => {
    e.preventDefault();
    const { nom, email, role, tempPassword } = addForm;
    if (!nom.trim() || !email.trim() || tempPassword.length < 6) {
      showToast('Complétez tous les champs obligatoires (mot de passe ≥ 6 car.)', 'error');
      return;
    }
    setAddSubmitting(true);
    try {
      await createMemberFn({
        nom: nom.trim(),
        email: email.trim(),
        role,
        cooperativeId,
        tempPassword,
      });
      showToast('Membre créé avec succès', 'success');
      setShowAdd(false);
      setAddForm({ nom: '', email: '', role: 'membre', tempPassword: '' });
      if (notifyPerm === 'granted' && typeof sendNotification === 'function') {
        sendNotification({
          title: 'CoopLedger',
          body: `Invitation envoyée : ${nom.trim()} peut se connecter avec son e-mail.`,
          tag: 'member-created',
          data: { url: '/' },
        });
      }
    } catch (err) {
      const code = err.code || '';
      const msg = err.message || '';
      if (code === 'functions/already-exists' || msg.includes('déjà utilisé')) {
        showToast('Cet email est déjà utilisé', 'error');
      } else if (code === 'functions/permission-denied') {
        showToast(msg || 'Action non autorisée', 'error');
      } else if (code === 'functions/invalid-argument') {
        showToast(msg || 'Données invalides', 'error');
      } else {
        showToast(
          msg || err?.details || 'Erreur Firebase lors de la création du membre',
          'error'
        );
      }
    } finally {
      setAddSubmitting(false);
    }
  };

  /** Transfert depuis carte rouge (double confirmation obligatoire) */
  const beginTransfer = () => {
    if (!transferUid) {
      showToast('Choisissez un membre actif', 'error');
      return;
    }
    setTransferStep(1);
    setTransferPhraseInput('');
  };

  /** Après première boîte de dialogue : passe à la saisie du mot CONFIRME */
  const proceedToTransferPhraseStep = () => {
    setTransferStep(2);
    setTransferPhraseInput('');
  };

  const confirmTransferPhrase = async () => {
    if (transferPhraseInput.trim().toUpperCase() !== 'TRANSFÉRER') {
      showToast('Tapez exactement TRANSFÉRER pour confirmer', 'error');
      return;
    }
    try {
      await commitPresidencyToTarget(transferUid);
      showToast('La présidence a été transférée avec succès', 'success');
      setTransferStep(0);
      setTransferUid('');
      setTransferPhraseInput('');
    } catch {
      showToast('Erreur lors du transfert de présidence', 'error');
    }
  };

  const membresActifsPourTransfert = membres.filter(
    (m) =>
      m.statut === 'actif' &&
      m.uid !== userData?.uid &&
      m.role !== 'president'
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="text-5xl mb-3 animate-pulse">👥</div>
          <p className="text-green-700 font-semibold">Chargement des membres…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-3 sm:px-4 py-4 sm:py-6 space-y-6 pb-28 md:pb-10">

      {/* ═══ TOAST ERREURS / SUCCÈS ═══ */}
      {toast && (
        <div
          className={`fixed top-20 right-4 z-[110] px-5 py-3 rounded-2xl shadow-xl text-sm font-semibold max-w-sm ${
            toast.type === 'success'
              ? 'bg-green-700 text-white'
              : 'bg-red-600 text-white'
          }`}
        >
          {toast.message}
        </div>
      )}

      {/* ═══ HEADER ═══ */}
      <header className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-gray-900 tracking-tight">
            Gestion des Membres
          </h1>
          <p className="text-gray-500 mt-1 text-sm sm:text-base">
            CTA de Broukou · Région de la Kara
          </p>
          <span className="inline-flex mt-3 items-center gap-2 text-xs font-bold px-3 py-1 rounded-full bg-green-100 text-green-800 border border-green-200">
            Blockchain Polygon
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {isPresident && (
            <button
              type="button"
              onClick={() => setShowAdd(true)}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-green-700 hover:bg-green-800 text-white font-semibold text-sm shadow-md transition"
            >
              ➕ Ajouter un membre
            </button>
          )}
        </div>
      </header>

      {/* ═══ STATISTIQUES — 4 cartes ═══ */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard
          icon="👥"
          label="Total membres actifs"
          value={String(nbMembresActifs)}
          sub={`sur ${membres.length} profils`}
        />
        <StatCard
          icon="🗳️"
          label="Taux participation votes"
          value={`${tauxParticipation} %`}
          sub="Depuis les bulletins enregistrés"
        />
        <StatCard
          icon="🛡️"
          label="Président actuel"
          value={nomPresidentAffiche}
        />
        <StatCard
          icon="🏦"
          label="Trésorier actuel"
          value={nomTresorierAffiche}
        />
      </section>

      {/* ═══ TABLEAU DES MEMBRES ═══ */}
      <section className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[960px] text-left">
            <thead>
              <tr className="bg-green-900 text-white">
                <th className="px-4 py-3 text-xs font-bold uppercase tracking-wide">
                  Membre
                </th>
                <th className="px-4 py-3 text-xs font-bold uppercase tracking-wide">
                  E-mail
                </th>
                <th className="px-4 py-3 text-xs font-bold uppercase tracking-wide">
                  Rôle
                </th>
                <th className="px-4 py-3 text-xs font-bold uppercase tracking-wide">
                  Inscription
                </th>
                <th className="px-4 py-3 text-xs font-bold uppercase tracking-wide text-center">
                  Statut
                </th>
                <th className="px-4 py-3 text-xs font-bold uppercase tracking-wide text-center">
                  Votes
                </th>
                {isPresident && (
                  <th className="px-4 py-3 text-xs font-bold uppercase tracking-wide text-right">
                    Actions
                  </th>
                )}
              </tr>
            </thead>
            <tbody>
              {membres.length === 0 ? (
                <tr>
                  <td
                    colSpan={isPresident ? 7 : 6}
                    className="px-4 py-16 text-center text-gray-400"
                  >
                    Aucun membre pour cette coopérative.
                  </td>
                </tr>
              ) : (
                membres.map((m, i) => {
                  const estMoi = m.uid === userData?.uid;
                  const rowBg = i % 2 === 0 ? 'bg-white' : 'bg-gray-50';
                  const nbVotes = votesParMembre[m.uid] || 0;
                  const canActAsPresidentOnRow =
                    isPresident &&
                    !(estMoi && m.role === 'president') &&
                    !estMoi;

                  return (
                    <tr
                      key={m.uid}
                      className={`${rowBg} border-b border-gray-100 hover:bg-green-50/40 transition-colors`}
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div
                            className={`w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-bold flex-shrink-0 ${avatarColor(
                              m.uid
                            )}`}
                          >
                            {getInitiales(m.nom)}
                          </div>
                          <div>
                            <p className="font-semibold text-gray-900 text-sm">
                              {m.nom}
                              {estMoi && (
                                <span className="ml-2 text-xs font-normal text-green-700">
                                  (vous)
                                </span>
                              )}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600 max-w-[200px] truncate">
                        {m.email}
                      </td>
                      <td className="px-4 py-3">
                        <RoleBadge role={m.role} />
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-500 whitespace-nowrap">
                        {formatDate(m.dateInscription)}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className="inline-flex items-center gap-1.5 text-xs font-semibold">
                          <span
                            className={`w-2 h-2 rounded-full ${
                              m.statut === 'actif' ? 'bg-green-500' : 'bg-gray-400'
                            }`}
                          />
                          <span
                            className={
                              m.statut === 'actif'
                                ? 'text-green-800'
                                : 'text-gray-500'
                            }
                          >
                            {m.statut === 'actif' ? 'Actif' : 'Inactif'}
                          </span>
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center text-sm font-bold text-gray-800">
                        {nbVotes}
                      </td>
                      {isPresident && (
                        <td className="px-4 py-3 text-right">
                          {canActAsPresidentOnRow ? (
                            <div className="flex flex-wrap justify-end gap-1.5">
                              <button
                                type="button"
                                onClick={() => openRoleModal(m)}
                                className="text-xs font-semibold px-2 py-1 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-800"
                                title="Changer rôle"
                              >
                                ✏️
                              </button>
                              {m.role !== 'president' && (
                                <button
                                  type="button"
                                  onClick={() => handleToggleStatut(m)}
                                  className="text-xs font-semibold px-2 py-1 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-800"
                                  title={
                                    m.statut === 'actif'
                                      ? 'Désactiver'
                                      : 'Activer'
                                  }
                                >
                                  🔄
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => {
                                  if (m.role === 'president') {
                                    showToast(
                                      'Impossible de retirer le président',
                                      'error'
                                    );
                                    return;
                                  }
                                  if (estMoi) {
                                    showToast(
                                      'Vous ne pouvez pas vous retirer vous‑même',
                                      'error'
                                    );
                                    return;
                                  }
                                  if (voteEnCours) {
                                    showToast(
                                      'Impossible de retirer ce membre pendant un vote en cours',
                                      'error'
                                    );
                                    return;
                                  }
                                  setRemoveModal({
                                    uid: m.uid,
                                    nom: m.nom,
                                    role: m.role,
                                  });
                                }}
                                className="text-xs font-semibold px-2 py-1 rounded-lg bg-red-50 hover:bg-red-100 text-red-700"
                                title="Retirer"
                              >
                                🚫
                              </button>
                            </div>
                          ) : (
                            <span className="text-xs text-gray-400">—</span>
                          )}
                        </td>
                      )}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* ═══ SECTION TRANSFERT PRÉSIDENCE (président uniquement) ═══ */}
      {isPresident && (
        <section className="rounded-2xl border-2 border-red-200 bg-red-50 p-5 sm:p-6 shadow-sm">
          <h2 className="text-lg font-bold text-red-900 flex items-center gap-2">
            🔄 Transférer la présidence
          </h2>
          <p className="text-sm text-red-800/90 mt-2 leading-relaxed">
            Choisissez un membre actif de la coopérative pour lui confier la
            présidence. Vous redeviendrez automatiquement simple membre. Cette
            action est irréversible sans l’accord du nouveau président.
          </p>
          <div className="mt-4 flex flex-col sm:flex-row gap-3 sm:items-end">
            <div className="flex-1">
              <label className="block text-xs font-bold text-red-900 mb-1">
                Membre destinataire
              </label>
              <select
                value={transferUid}
                onChange={(e) => setTransferUid(e.target.value)}
                className="w-full border border-red-200 rounded-xl px-3 py-2.5 text-sm bg-white text-gray-900"
              >
                <option value="">— Sélectionner —</option>
                {membresActifsPourTransfert.map((m) => (
                  <option key={m.uid} value={m.uid}>
                    {m.nom} ({ROLE_CONFIG[m.role]?.label || m.role})
                  </option>
                ))}
              </select>
            </div>
            <button
              type="button"
              onClick={beginTransfer}
              className="px-5 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-sm shadow-md transition"
            >
              Transférer
            </button>
          </div>
        </section>
      )}

      {/* ═══ MODAL AJOUTER MEMBRE ═══ */}
      {showAdd && (
        <ModalShell title="Ajouter un membre" onClose={() => !addSubmitting && setShowAdd(false)}>
          <form onSubmit={submitAddMember} className="space-y-4 pt-2">
            <div>
              <label className="block text-xs font-bold text-gray-500 mb-1">
                Nom complet *
              </label>
              <input
                required
                value={addForm.nom}
                onChange={(e) =>
                  setAddForm((f) => ({ ...f, nom: e.target.value }))
                }
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-500 mb-1">
                E-mail *
              </label>
              <input
                required
                type="email"
                value={addForm.email}
                onChange={(e) =>
                  setAddForm((f) => ({ ...f, email: e.target.value }))
                }
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-500 mb-1">
                Rôle initial
              </label>
              <select
                value={addForm.role}
                onChange={(e) =>
                  setAddForm((f) => ({ ...f, role: e.target.value }))
                }
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm"
              >
                <option value="membre">👤 Membre</option>
                <option value="tresorier">🏦 Trésorier</option>
                <option value="president">🛡️ Président</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-500 mb-1">
                Mot de passe temporaire *
              </label>
              <input
                required
                type="password"
                minLength={6}
                value={addForm.tempPassword}
                onChange={(e) =>
                  setAddForm((f) => ({ ...f, tempPassword: e.target.value }))
                }
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowAdd(false)}
                disabled={addSubmitting}
                className="px-4 py-2 rounded-xl text-sm font-semibold text-gray-600 hover:bg-gray-100"
              >
                Annuler
              </button>
              <button
                type="submit"
                disabled={addSubmitting}
                className="px-4 py-2 rounded-xl text-sm font-semibold bg-green-700 text-white hover:bg-green-800 disabled:opacity-50"
              >
                {addSubmitting ? 'Création…' : 'Créer le compte'}
              </button>
            </div>
          </form>
        </ModalShell>
      )}

      {/* ═══ MODAL CHANGER LE RÔLE ═══ */}
      {roleModal && !presidencyConfirm && (
        <ModalShell
          title="Changer le rôle"
          onClose={() => {
            setRoleModal(null);
            setPresidencyConfirm(false);
          }}
        >
          <div className="space-y-4 pt-2">
            <p className="text-sm text-gray-600">
              Membre :{' '}
              <span className="font-bold text-gray-900">{roleModal.nom}</span>
            </p>
            <p className="text-xs text-gray-500">Rôle actuel</p>
            <RoleBadge role={roleModal.role} />
            <p className="text-sm font-semibold text-gray-800 pt-2">
              Nouveau rôle
            </p>
            <div className="space-y-2">
              {[
                { value: 'membre', label: '👤 Membre' },
                { value: 'tresorier', label: '🏦 Trésorier' },
                { value: 'president', label: '🛡️ Président' },
              ].map((opt) => (
                <label
                  key={opt.value}
                  className="flex items-center gap-3 p-3 rounded-xl border border-gray-100 hover:bg-gray-50 cursor-pointer"
                >
                  <input
                    type="radio"
                    name="roleDraft"
                    value={opt.value}
                    checked={roleDraft === opt.value}
                    onChange={() => setRoleDraft(opt.value)}
                  />
                  <span className="text-sm font-medium">{opt.label}</span>
                </label>
              ))}
            </div>
            <div className="flex justify-end gap-2 pt-4">
              <button
                type="button"
                onClick={() => setRoleModal(null)}
                className="px-4 py-2 rounded-xl text-sm font-semibold text-gray-600 hover:bg-gray-100"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={() => {
                  if (roleDraft === 'president') {
                    setPresidencyConfirm(true);
                  } else {
                    submitRoleChange();
                  }
                }}
                className="px-4 py-2 rounded-xl text-sm font-semibold bg-green-700 text-white hover:bg-green-800"
              >
                {roleDraft === 'president' ? 'Continuer…' : 'Enregistrer'}
              </button>
            </div>
          </div>
        </ModalShell>
      )}

      {/* Alerte confirmation transfert présidence (depuis modal rôle) */}
      {roleModal && presidencyConfirm && (
        <ModalShell
          title="Confirmer le transfert de présidence"
          onClose={() => setPresidencyConfirm(false)}
        >
          <div className="space-y-4 pt-2">
            <p className="text-sm text-red-900 leading-relaxed font-medium">
              ⚠️ Attention : vous allez transférer la présidence à{' '}
              <strong>{roleModal.nom}</strong>. Vous deviendrez automatiquement
              membre. Cette action est irréversible sans intervention du nouveau
              président. Confirmer ?
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setPresidencyConfirm(false)}
                className="px-4 py-2 rounded-xl text-sm font-semibold text-gray-600 hover:bg-gray-100"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={submitRoleChange}
                className="px-4 py-2 rounded-xl text-sm font-semibold bg-red-600 text-white hover:bg-red-700"
              >
                Confirmer le transfert
              </button>
            </div>
          </div>
        </ModalShell>
      )}

      {/* ═══ MODAL CONFIRMATION RETRAIT ═══ */}
      {removeModal && (
        <ModalShell
          title="Retirer un membre"
          onClose={() => setRemoveModal(null)}
        >
          <p className="text-sm text-gray-700 pt-2 leading-relaxed">
            Êtes-vous sûr de vouloir retirer{' '}
            <strong>{removeModal.nom}</strong> de la coopérative ? Cette
            action désactivera son compte. Il ne pourra plus se connecter.
          </p>
          <div className="flex justify-end gap-2 mt-6">
            <button
              type="button"
              onClick={() => setRemoveModal(null)}
              className="px-4 py-2 rounded-xl text-sm font-semibold text-gray-600 hover:bg-gray-100"
            >
              Annuler
            </button>
            <button
              type="button"
              onClick={confirmRemove}
              className="px-4 py-2 rounded-xl text-sm font-semibold bg-red-600 text-white hover:bg-red-700"
            >
              Confirmer
            </button>
          </div>
        </ModalShell>
      )}

      {/* ═══ DOUBLE CONFIRMATION TRANSFERT (carte bas de page) — étape 1 ═══ */}
      {isPresident && transferStep === 1 && (
        <ModalShell
          title="Confirmer le transfert"
          onClose={() => {
            setTransferStep(0);
            setTransferPhraseInput('');
          }}
        >
          <p className="text-sm text-gray-700 pt-2 leading-relaxed">
            Vous êtes sur le point de transférer la présidence. Vous redeviendrez
            membre. Une seconde confirmation vous sera demandée. Continuer&nbsp;?
          </p>
          <div className="flex justify-end gap-2 mt-6">
            <button
              type="button"
              onClick={() => {
                setTransferStep(0);
                setTransferPhraseInput('');
              }}
              className="px-4 py-2 rounded-xl text-sm font-semibold text-gray-600 hover:bg-gray-100"
            >
              Annuler
            </button>
            <button
              type="button"
              onClick={proceedToTransferPhraseStep}
              className="px-4 py-2 rounded-xl text-sm font-semibold bg-red-600 text-white hover:bg-red-700"
            >
              Continuer
            </button>
          </div>
        </ModalShell>
      )}

      {/* ═══ DOUBLE CONFIRMATION TRANSFERT — étape 2 : saisie TRANSFÉRER ═══ */}
      {isPresident && transferStep === 2 && (
        <ModalShell
          title="Confirmation définitive"
          onClose={() => {
            setTransferStep(0);
            setTransferPhraseInput('');
          }}
        >
          <p className="text-sm text-gray-700 pt-2 leading-relaxed">
            Pour confirmer le transfert définitivement, tapez exactement&nbsp;
            <strong>TRANSFÉRER</strong> dans le champ ci‑dessous.
          </p>
          <input
            value={transferPhraseInput}
            onChange={(e) => setTransferPhraseInput(e.target.value)}
            placeholder="TRANSFÉRER"
            className="mt-4 w-full border border-gray-200 rounded-xl px-3 py-2 text-sm"
            autoComplete="off"
          />
          <div className="flex justify-end gap-2 mt-6">
            <button
              type="button"
              onClick={() => {
                setTransferStep(0);
                setTransferPhraseInput('');
              }}
              className="px-4 py-2 rounded-xl text-sm font-semibold text-gray-600 hover:bg-gray-100"
            >
              Annuler
            </button>
            <button
              type="button"
              onClick={confirmTransferPhrase}
              className="px-4 py-2 rounded-xl text-sm font-semibold bg-red-700 text-white hover:bg-red-800"
            >
              Valider définitivement
            </button>
          </div>
        </ModalShell>
      )}
    </div>
  );
}
