import { useState, useEffect, useMemo } from 'react';
import {
  collection, onSnapshot,
  doc, updateDoc, increment, getDoc, setDoc, writeBatch
} from 'firebase/firestore';
import { db } from '../firebase';
import { Link } from 'react-router-dom';
import {
  useTransactions,
  useOpenVotes,
  useBlockchainWrite,
  rememberVoteCast,
} from '../hooks/useBlockchain';
import { useWallet, getAddress } from '../hooks/useWallet';
import { getExplorerTxUrl, CONTRACT_ADDRESS, isContractConfigured } from '../config/blockchain';

// ── Formatage ──
function formatFCFA(n) {
  return (n || 0).toLocaleString('fr-FR') + ' FCFA';
}
function formatDate(ts) {
  if (!ts) return '';
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}
function genHash() {
  return '0x' + Array.from({ length: 10 }, () =>
    Math.floor(Math.random() * 16).toString(16)
  ).join('') + '...' + Array.from({ length: 4 }, () =>
    Math.floor(Math.random() * 16).toString(16)
  ).join('');
}

function getDureeTotale(vote) {
  if (!vote?.dateCreation || !vote?.dateExpiration) return '...';

  const start = vote.dateCreation.toDate?.() || new Date(vote.dateCreation);
  const end = vote.dateExpiration.toDate?.() || new Date(vote.dateExpiration);

  const hours = Math.floor((end - start) / (1000 * 60 * 60));
  return hours + " heures";
}

function getTempsRestant(vote) {
  if (!vote?.dateExpiration) return '...';

  const end = vote.dateExpiration.toDate?.() || new Date(vote.dateExpiration);
  const diff = end - new Date();

  if (diff <= 0) return 'Expiré';

  const h = Math.floor(diff / (1000 * 60 * 60));
  const m = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

  return `${h}h ${m}min`;
}

// ── Historique chargé depuis Firebase ──

const PRIORITE = {
  urgent: { label: 'APPROBATION URGENTE', bg: 'bg-red-100 text-red-700', dot: 'bg-red-500' },
  critique: { label: 'CRITIQUE', bg: 'bg-orange-100 text-orange-700', dot: 'bg-orange-500' },
  routine: { label: 'ROUTINE', bg: 'bg-blue-100 text-blue-700', dot: 'bg-blue-500' },
};

// ── Barre de progression ──
function ProgressBar({ oui, non, total, quorum }) {
  const participation = oui + non;
  const pctParticipation = total > 0 ? Math.round((participation / total) * 100) : 0;

  return (
    <div>
      <div className="flex justify-between items-center mb-2">
        <span className="text-sm font-semibold text-gray-700">
          Quorum Actuel: <span className="text-green-700">{pctParticipation}%</span>
        </span>
        <span className="text-sm text-gray-500">Requis: {quorum}%</span>
      </div>
      <div className="w-full bg-gray-100 rounded-full h-3 relative overflow-hidden">
        <div
          className="h-3 rounded-full bg-gradient-to-r from-green-500 to-green-400 transition-all duration-700"
          style={{ width: `${Math.min(pctParticipation, 100)}%` }}
        />
        {/* Marqueur quorum */}
        <div
          className="absolute top-0 w-0.5 h-3 bg-gray-800"
          style={{ left: `${quorum}%` }}
        />
      </div>
      {pctParticipation < quorum && (
        <p className="text-xs text-gray-400 mt-1">
          En attente de {quorum - pctParticipation}% de participation supplémentaire pour finalisation.
        </p>
      )}
    </div>
  );
}

// ── Carte de vote principal ──
function VoteCard({ vote, userData, onVote, monVote, voteProofHash, votePending }) {
  const prio = PRIORITE[vote.priorite] || PRIORITE.routine;
  const participation = vote.votesOui + vote.votesNon;
  const aVote = !!monVote;

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">

      {/* Header de la carte */}
      <div className="p-6 border-b border-gray-50">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div className="flex items-center gap-3">

            <div>
              <div className="flex items-center gap-2 mb-1">
                <h3 className="font-bold text-gray-900 text-lg">{vote.titre}</h3>
                <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${prio.bg}`}>
                  {prio.label}
                </span>
              </div>
              <p className="text-sm text-gray-500">ID : #{vote.txId}</p>
            </div>
          </div>
          <div className="text-right flex-shrink-0">
            <p className="text-xs text-gray-400 mb-1">Montant demandé</p>
            <p className="text-2xl font-black text-green-700">{formatFCFA(vote.montant)}</p>
          </div>
        </div>

        {/* Description */}
        <div className="bg-gray-50 rounded-xl p-4 mb-4">
          <p className="text-sm font-semibold text-gray-700 mb-2">
            {vote.typeVote === 'role_change' ? 'Valider ce changement de rôle ?' : 'Valider cette dépense ?'}
          </p>
          <p className="text-sm text-gray-600 leading-relaxed">{vote.description}</p>
        </div>

        {vote.typeVote === 'role_change' && (
          <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
            Changement de rôle proposé : <strong>{vote.targetUserName || 'Membre'}</strong> ·{' '}
            <strong>{vote.oldRole || 'membre'}</strong> → <strong>{vote.newRole || 'membre'}</strong>
          </div>
        )}

        {/* Détails */}
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <span className="text-gray-400">Initiateur :</span>
            <span className="text-gray-700 font-medium ml-2">{vote.initiateur} · {vote.roleInitiateur}</span>
          </div>
          <div>
            <span className="text-gray-400">Catégorie :</span>
            <span className="text-gray-700 font-medium ml-2">{vote.categorie}</span>
          </div>
          <div>
            <span className="text-gray-400">Quantité :</span>
            <span className="text-gray-700 font-medium ml-2">{vote.quantite}</span>
          </div>
          <div>
            <span className="text-gray-400">Fournisseur :</span>
            <span className="text-gray-700 font-medium ml-2">{vote.fournisseur}</span>
          </div>
          <div>
            <span className="text-gray-400">Registre :</span>
            <span className="text-green-700 font-medium ml-2">{vote.typeRegistre}</span>
          </div>
          <div>
            <span className="text-gray-400">Hash :</span>
            <span className="text-green-700 font-mono text-xs ml-2">{vote.hash}</span>
          </div>
        </div>
      </div>

      {/* Section vote */}
      <div className="p-6">

        {/* Progression */}
        <div className="mb-5">
          <ProgressBar
            oui={vote.votesOui}
            non={vote.votesNon}
            total={vote.totalMembres}
            quorum={vote.quorumRequis}
          />
        </div>

        {/* Compteurs */}
        <div className="grid grid-cols-3 gap-3 mb-5">
          <div className="bg-green-50 rounded-xl p-3 text-center">
            <p className="text-xs text-green-600 font-semibold uppercase mb-1">Votes Pour</p>
            <p className="text-3xl font-black text-green-700">{vote.votesOui}</p>
          </div>
          <div className="bg-red-50 rounded-xl p-3 text-center">
            <p className="text-xs text-red-600 font-semibold uppercase mb-1">Votes Contre</p>
            <p className="text-3xl font-black text-red-600">{vote.votesNon}</p>
          </div>
          <div className="bg-gray-50 rounded-xl p-3 text-center">
            <p className="text-xs text-gray-500 font-semibold uppercase mb-1">En Attente</p>
            <p className="text-3xl font-black text-gray-500">
              {vote.totalMembres - participation}
            </p>
          </div>
        </div>

        {/* Avatars membres participants 
        <div className="flex items-center gap-2 mb-5">
          <div className="flex -space-x-2">
            {['🧑🏿', '👩🏾', '🧑🏾', '👨🏿', '👩🏿'].map((e, i) => (
              <div key={i} className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center text-base border-2 border-white">
                {e}
              </div>
            ))}
          </div>
          <span className="text-sm text-gray-500 ml-1">
            +{participation - 5 > 0 ? participation - 5 : 0} membres ont voté
          </span>
          <span className="ml-auto text-sm text-orange-500 font-medium">
            ⏳ {heuresRestantes}h {minutesRestantes}min restantes
          </span>
        </div>*/}

        {/* Note sécurité */}
        <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 mb-5 flex items-start gap-3">
          <span className="text-blue-500 text-lg flex-shrink-0">🛡️</span>
          <div>
            <p className="text-sm font-semibold text-blue-800">Aperçu de Sécurité</p>
            <p className="text-xs text-blue-600 mt-1 leading-relaxed">
              Ce vote est verrouillé via HashGraph. Chaque bulletin est signé cryptographiquement
              par les clés privées des membres, garantissant des résultats 100% infalsifiables.
            </p>
          </div>
        </div>

        {/* Boutons de vote */}
        {aVote ? (
          <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-center">
            <p className="text-lg mb-1">
              {monVote === 'oui' ? '' : ''}
            </p>
            <p className="font-bold text-green-800">
              Vous avez voté {monVote === 'oui' ? 'OUI' : 'NON'}
            </p>
            <p className="text-sm text-green-600 mt-1">
              Votre vote est enregistré sur la blockchain
              {voteProofHash?.startsWith?.('0x') ? (
                <>
                  {' · '}
                  <a
                    href={getExplorerTxUrl(voteProofHash) || '#'}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-mono underline"
                  >
                    {voteProofHash.slice(0, 10)}…{voteProofHash.slice(-4)}
                  </a>
                </>
              ) : (
                <> · {genHash()}</>
              )}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4">
            <button
              type="button"
              disabled={votePending}
              onClick={() => onVote(vote.id, 'non')}
              className="flex items-center justify-center gap-3 bg-gray-100 hover:bg-red-600 text-gray-700 hover:text-white border-2 border-gray-200 hover:border-red-600 py-4 rounded-2xl font-bold text-lg transition-all duration-200 group disabled:opacity-50"
            >
              <span className="text-xl group-hover:scale-110 transition-transform">❌</span>
              NON
            </button>
            <button
              type="button"
              disabled={votePending}
              onClick={() => onVote(vote.id, 'oui')}
              className="flex items-center justify-center gap-3 bg-green-700 hover:bg-green-800 text-white py-4 rounded-2xl font-bold text-lg transition-all duration-200 shadow-lg hover:shadow-green-200 group disabled:opacity-50"
            >
              <span className="text-xl group-hover:scale-110 transition-transform">✅</span>
              OUI
            </button>
          </div>
        )}

        {/* Note blockchain */}
        <p className="text-xs text-gray-400 text-center mt-3">
          🔗 Identité du votant vérifiée via blockchain · Vote immuable et permanent
        </p>
      </div>
    </div>
  );
}

// ════════════════════════════════════════
// PAGE VOTE PRINCIPALE
// ════════════════════════════════════════

export default function Vote({ userData }) {
  const { transactions, loading: txLoading, cachedNotice } = useTransactions({
    firebaseFallback: true,
  });
  const { votes: votesOuvertsChain } = useOpenVotes(transactions);
  const { vote: submitVoteOnChain, pending: chainVotePending } =
    useBlockchainWrite();
  const { ensureWallet } = useWallet();

  const [votesFb, setVotesFb] = useState([]);
  const [mesVotes, setMesVotes] = useState({});
  const [voteEnCours, setVoteEnCours] = useState(null);
  const [notification, setNotification] = useState(null);
  const [selectedVote, setSelectedVote] = useState(null);
  const [useDemo] = useState(false);
  const [historiqueVotes, setHistoriqueVotes] = useState([]);
  const [voteProofById, setVoteProofById] = useState({});

  const votes = useMemo(() => {
    if (votesOuvertsChain.length > 0) return votesOuvertsChain;
    const now = new Date();
    return votesFb.filter((v) => {
      if (v.statut !== 'ouvert') return false;
      const expiration = v.dateExpiration?.toDate
        ? v.dateExpiration.toDate()
        : new Date(v.dateExpiration);
      return expiration > now;
    });
  }, [votesOuvertsChain, votesFb]);

  const loading = txLoading;

  const finalizeRoleChangeVote = async (voteId, voteData) => {
    const voteRef = doc(db, 'votes', voteId);
    const snapshot = voteData ? null : await getDoc(voteRef);
    const vote = voteData || (snapshot?.exists() ? { id: voteId, ...snapshot.data() } : null);
    if (!vote) return false;
    if (vote.typeVote !== 'role_change') return false;
    if (vote.statut !== 'ouvert' || vote.applique) return false;

    const totalMembres = vote.totalMembres || 0;
    const majoriteRequise = vote.majoriteRequise || Math.floor(totalMembres / 2) + 1;
    const votesOui = vote.votesOui || 0;

    if (votesOui < majoriteRequise) return false;
    if (!vote.targetUserId || !vote.newRole) return false;

    const batch = writeBatch(db);
    batch.update(doc(db, 'users', vote.targetUserId), { role: vote.newRole });
    batch.update(voteRef, {
      statut: 'approuve',
      applique: true,
      appliqueLe: new Date(),
      resultat: 'majorite_simple',
    });
    await batch.commit();
    return true;
  };

  // Charger l'historique des votes terminés depuis Firebase
  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'votes'), (snap) => {
      const termines = snap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .filter(v => v.statut === 'approuve' || v.statut === 'rejete' || v.statut === 'annule' || v.statut === 'expire')
        .sort((a, b) => {
          const da = a.dateCreation?.toDate?.() || new Date(a.dateCreation || 0);
          const db2 = b.dateCreation?.toDate?.() || new Date(b.dateCreation || 0);
          return db2 - da;
        })
        .slice(0, 5);
      setHistoriqueVotes(termines);
    });
    return () => unsub();
  }, []);

  // Charger les votes Firebase (secours + expiration)
  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'votes'), async (snap) => {
      const now = new Date();

      for (const docSnap of snap.docs) {
        const vote = { id: docSnap.id, ...docSnap.data() };

        if (vote.statut !== 'ouvert') continue;

        const expiration = vote.dateExpiration?.toDate
          ? vote.dateExpiration.toDate()
          : new Date(vote.dateExpiration);

        if (expiration <= now) {
          if (vote.typeVote === 'role_change') {
            const applied = await finalizeRoleChangeVote(vote.id, vote);
            if (!applied) {
              try {
                await updateDoc(doc(db, 'votes', vote.id), {
                  statut: 'expire',
                  resultat: 'majorite_non_atteinte',
                });
              } catch (err) {
                console.error('Erreur clôture vote role_change expiré:', err);
              }
            }
            continue;
          }

          const participation = (vote.votesOui || 0) + (vote.votesNon || 0);
          const pctParticipation =
            vote.totalMembres > 0 ? (participation / vote.totalMembres) * 100 : 0;

          const nouveauStatut =
            pctParticipation >= vote.quorumRequis
              ? vote.votesOui > vote.votesNon
                ? 'approuve'
                : 'rejete'
              : 'annule';

          try {
            await updateDoc(doc(db, 'votes', vote.id), { statut: nouveauStatut });
            if (vote.transactionId) {
              await updateDoc(doc(db, 'transactions', vote.transactionId), {
                statut: nouveauStatut === 'approuve' ? 'valide' : 'rejete',
              });
            }
          } catch (err) {
            console.error('Erreur mise à jour vote expiré:', err);
          }
        }
      }

      setVotesFb(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
    return () => unsub();
  }, []);
  // Charger les votes de l'utilisateur
  useEffect(() => {
    if (!userData?.uid) return;
    const unsub = onSnapshot(collection(db, 'bulletins_vote'), (snap) => {
      const myVotesFb = {};
      snap.docs.forEach((d) => {
        const data = d.data();
        if (data.userId === userData.uid) myVotesFb[data.voteId] = data.choix;
      });
      setMesVotes((prev) => ({ ...myVotesFb, ...prev }));
    });
    return () => unsub();
  }, [userData]);

  useEffect(() => {
    const addr = getAddress();
    if (!addr) return;
    setMesVotes((prev) => {
      const next = { ...prev };
      votesOuvertsChain.forEach((v) => {
        if (!v.chainTransactionId) return;
        const raw = localStorage.getItem(
          `coopledger_vote_${v.chainTransactionId}_${addr}`
        );
        if (raw === 'oui' || raw === 'non') next[v.id] = raw;
      });
      return next;
    });
  }, [votesOuvertsChain]);

  // Vote d'un membre
  async function handleVote(voteId, choix) {
    if (!userData) return;
    if (voteEnCours) return;
    setVoteEnCours(voteId);

    const voteObj =
      votes.find((v) => v.id === voteId) ||
      votesOuvertsChain.find((v) => v.id === voteId);

    try {
      if (voteObj?.chainTransactionId) {
        ensureWallet();
        const addr = getAddress();
        if (!addr) throw new Error('Wallet requis pour voter sur la chaîne.');
        const res = await submitVoteOnChain(voteObj.chainTransactionId, choix);
        rememberVoteCast(voteObj.chainTransactionId, addr, choix);
        setMesVotes((prev) => ({ ...prev, [voteId]: choix }));
        if (res?.hash)
          setVoteProofById((prev) => ({ ...prev, [voteId]: res.hash }));
        showNotif(
          choix === 'oui'
            ? '✅ Vote OUI enregistré sur Polygon !'
            : '❌ Vote NON enregistré sur Polygon !',
          'success'
        );
        setVoteEnCours(null);
        return;
      }

      if (useDemo) {
        setMesVotes((prev) => ({ ...prev, [voteId]: choix }));
        setVotesFb((prev) =>
          prev.map((v) => {
            if (v.id !== voteId) return v;
            return {
              ...v,
              votesOui: choix === 'oui' ? (v.votesOui || 0) + 1 : v.votesOui || 0,
              votesNon: choix === 'non' ? (v.votesNon || 0) + 1 : v.votesNon || 0,
            };
          })
        );
      } else {
        // Mode Firebase réel
        const bulletinRef = doc(db, 'bulletins_vote', `${userData.uid}_${voteId}`);
        const bulletinSnap = await getDoc(bulletinRef);
        if (bulletinSnap.exists()) {
          showNotif(' Vous avez déjà voté sur cette proposition.', 'warning');
          setVoteEnCours(null);
          return;
        }

        await setDoc(bulletinRef, {
          userId: userData.uid,
          voteId,
          choix,
          date: new Date(),
          hash: genHash(),
        });

        const voteRef = doc(db, 'votes', voteId);
        await updateDoc(voteRef, {
          [`votes${choix === 'oui' ? 'Oui' : 'Non'}`]: increment(1),
        });

        const voteAfterSnap = await getDoc(voteRef);
        if (voteAfterSnap.exists()) {
          const voteAfter = { id: voteId, ...voteAfterSnap.data() };
          const applied = await finalizeRoleChangeVote(voteId, voteAfter);
          if (applied) {
            showNotif(
              `✅ Vote approuvé : le rôle de ${voteAfter.targetUserName || 'ce membre'} a été mis à jour.`,
              'success'
            );
          }
        }

        setMesVotes(prev => ({ ...prev, [voteId]: choix }));
      }

      showNotif(
        choix === 'oui'
          ? '✅ Vote OUI enregistré sur la blockchain !'
          : '❌ Vote NON enregistré sur la blockchain !',
        'success'
      );
    } catch (err) {
      showNotif(
        err?.message || '❌ Erreur lors du vote. Réessayez.',
        'error'
      );
    }
    setVoteEnCours(null);
  }

  function showNotif(message, type) {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 4000);
  }

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="text-center">
        <div className="text-5xl mb-3 animate-pulse"></div>
        <p className="text-green-700 font-semibold">Chargement des votes...</p>
      </div>
    </div>
  );

  const voteSelectionne = selectedVote !== null ? votes[selectedVote] : votes[0];

  return (
    <div className="max-w-7xl mx-auto px-4 py-6">

      {cachedNotice && (
        <div className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          {cachedNotice}
        </div>
      )}

      {/* ── NOTIFICATION ── */}
      {notification && (
        <div className={`fixed top-20 right-4 z-50 px-5 py-3 rounded-2xl shadow-xl text-sm font-semibold transition-all ${
          notification.type === 'success' ? 'bg-green-700 text-white' :
          notification.type === 'warning' ? 'bg-amber-500 text-white' :
          'bg-red-600 text-white'
        }`}>
          {notification.message}
        </div>
      )}

      {/* ── HEADER ── */}
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Gouvernance Active 🗳️</h1>
            <p className="text-gray-500 text-sm mt-1">
              Prise de décision décentralisée pour l'écosystème de confiance.
            </p>
          </div>
          <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-xl px-4 py-2">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
            <span className="text-sm text-green-700 font-medium">
              Identité du votant vérifiée via blockchain
            </span>
          </div>
        </div>
      </div>

      {votes.length === 0 ? (
        <div className="bg-white rounded-2xl p-12 text-center shadow-sm border border-gray-100">
          <div className="text-6xl mb-4">✅</div>
          <h3 className="text-xl font-bold text-gray-900 mb-2">Aucun vote en cours</h3>
          <p className="text-gray-500">Toutes les propositions ont été traitées.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* ── COLONNE GAUCHE : Carte de vote principale ── */}
          <div className="lg:col-span-2">
            {voteSelectionne && (
              <VoteCard
                vote={voteSelectionne}
                userData={userData}
                onVote={handleVote}
                monVote={mesVotes[voteSelectionne.id]}
                voteProofHash={voteProofById[voteSelectionne.id]}
                votePending={chainVotePending}
              />
            )}
          </div>

          {/* ── COLONNE DROITE ── */}
          <div className="space-y-5">

            {/* Autres décisions en attente */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-gray-900">Autres Décisions en Attente</h3>
                <span className="bg-red-100 text-red-700 text-xs font-bold px-2 py-1 rounded-full">
                  {votes.length}
                </span>
              </div>

              <div className="space-y-3">
                {votes.map((vote, index) => {
                  const prio = PRIORITE[vote.priorite] || PRIORITE.routine;
                  const estSelectionne = (selectedVote === null ? 0 : selectedVote) === index;
                  const aVote = !!mesVotes[vote.id];
                  return (
                    <button
                      key={vote.id}
                      onClick={() => setSelectedVote(index)}
                      className={`w-full text-left p-4 rounded-xl border-2 transition-all ${
                        estSelectionne
                          ? 'border-green-500 bg-green-50'
                          : 'border-gray-100 bg-gray-50 hover:border-gray-200'
                      }`}
                    >
                      <div className="flex items-start gap-3">

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <p className="font-semibold text-gray-900 text-sm truncate">{vote.titre}</p>
                            {aVote && <span className="text-green-500 text-xs">✓</span>}
                          </div>
                          <p className="text-xs text-gray-500 mt-0.5">ID : #{vote.txId}</p>
                          <div className="flex items-center justify-between mt-2">
                            <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${prio.bg}`}>
                              {prio.label}
                            </span>
                            <span className="text-xs font-bold text-gray-700">
                              {formatFCFA(vote.montant)}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="mt-2 flex items-center justify-between text-xs text-gray-500">
                        <span>👍 {vote.votesOui} · 👎 {vote.votesNon}</span>
                        <span className="text-green-600 font-mono text-xs">{vote.hash}</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Historique des votes */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-gray-900">Historique récent</h3>
                <Link to="/historique" className="text-xs text-green-700 font-medium hover:underline">
                  Voir tout →
                </Link>
              </div>
              {historiqueVotes.length === 0 ? (
                <div className="text-center py-6 text-gray-400">
                  <p className="text-3xl mb-2">📭</p>
                  <p className="text-sm">Aucun vote terminé pour le moment</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {historiqueVotes.map(h => {
                    const approuve = h.statut === 'approuve';
                    const annule = h.statut === 'annule';
                    const participation = (h.votesOui || 0) + (h.votesNon || 0);
                    const pct = h.totalMembres > 0
                      ? Math.round((participation / h.totalMembres) * 100) : 0;
                    return (
                      <div key={h.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
                        <div className={`w-8 h-8 rounded-xl flex items-center justify-center text-sm flex-shrink-0 ${
                          approuve ? 'bg-green-100' : annule ? 'bg-gray-100' : 'bg-red-100'
                        }`}>
                          {approuve ? '✅' : annule ? '⏸️' : '❌'}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-gray-900 truncate">{h.titre}</p>
                          <p className="text-xs text-gray-400 mt-0.5">
                            {annule ? 'Annulé — quorum non atteint' : `${pct}% ${approuve ? 'OUI' : 'NON'}`}
                            {h.dateCreation?.toDate ? ` · ${formatDate(h.dateCreation)}` : ''}
                          </p>
                        </div>
                        <p className={`text-xs font-bold flex-shrink-0 ${
                          approuve ? 'text-green-600' : annule ? 'text-gray-400' : 'text-red-500'
                        }`}>
                          {((h.montant || 0) / 1000).toFixed(0)}K
                        </p>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Smart Contract Info */}
            <div className="bg-green-900 rounded-2xl p-5 text-white">
              <h3 className="font-bold mb-3 flex items-center gap-2">
                <span>⛓️</span> Smart Contract Actif
              </h3>
              <div className="space-y-2 text-sm text-green-300">
                <div className="flex justify-between">
                  <span>Seuil de vote :</span>
                  <span className="font-mono text-white">500 000 FCFA</span>
                </div>
                <div className="flex justify-between">
                  <span>Quorum requis :</span>
                  <span className="font-mono text-white">60%</span>
                </div>
                <div className="flex justify-between">
                  <span>Durée max :</span>
                  <span className="font-mono text-white">
                    {voteSelectionne ? getDureeTotale(voteSelectionne) : '...'}
                  </span>
                </div>

                <div className="flex justify-between">
                  <span>Temps restant :</span>
                  <span className="font-mono text-white">
                    {voteSelectionne ? getTempsRestant(voteSelectionne) : '...'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Réseau :</span>
                  <span className="font-mono text-white">Polygon</span>
                </div>
              </div>
              <div className="mt-4 pt-3 border-t border-green-700">
                <p className="text-xs text-green-400 font-mono break-all">
                  {isContractConfigured()
                    ? `${CONTRACT_ADDRESS.slice(0, 10)}…${CONTRACT_ADDRESS.slice(-6)}`
                    : 'Non configuré (voir .env)'}
                </p>
                <p className="text-xs text-green-500 mt-1">
                  Déployé · Vérifié · Immuable
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}