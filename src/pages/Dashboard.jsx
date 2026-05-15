import { useState, useEffect, useMemo } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { Link } from 'react-router-dom';
import WalletConnect from '../components/WalletConnect';
import {
  useTransactions,
  useSolde,
  useOpenVotes,
  getStoredVoteChoice,
} from '../hooks/useBlockchain';
import { getExplorerTxUrl, isContractConfigured, CONTRACT_ADDRESS } from '../config/blockchain';
import { getAddress } from '../hooks/useWallet';
import { calculerFinances, estEntree, estDepense } from '../utils/calculsFinanciers';

function genHash() {
  return '0x' + Array.from({ length: 8 }, () =>
    Math.floor(Math.random() * 16).toString(16)
  ).join('') + '...' + Array.from({ length: 4 }, () =>
    Math.floor(Math.random() * 16).toString(16)
  ).join('');
}

function formatDate(ts) {
  if (!ts) return '';
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
}

function StatCard({ icon, label, value, sub, color, bgColor }) {
  return (
    <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
      <div className={`w-9 h-9 ${bgColor} rounded-xl flex items-center justify-center text-lg mb-2.5`}>
        {icon}
      </div>
      <p className="text-xs text-gray-500 mb-1">{label}</p>
      <p className={`text-xl font-bold ${color} leading-tight`}>{value}</p>
      {sub && <p className="text-xs text-green-600 mt-1 font-medium">{sub}</p>}
    </div>
  );
}

function TransactionRow({ tx }) {
  const onChainHash = tx.explorerTxHash || (tx.hash?.startsWith?.('0x') ? tx.hash : null);
  const isEntree = estEntree(tx);
  const statutColors = {
    valide: 'bg-green-100 text-green-700',
    en_cours: 'bg-yellow-100 text-yellow-700',
    rejete: 'bg-red-100 text-red-700',
  };
  const statutLabels = {
    valide: 'Validé',
    en_cours: 'Vote en Cours',
    rejete: 'Rejeté',
  };
  return (
    <div className="flex items-center gap-3 py-3 border-b border-gray-50 last:border-0 hover:bg-gray-50 px-2 rounded-xl transition-colors">
      <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-sm flex-shrink-0 ${isEntree ? 'bg-green-100' : 'bg-red-100'}`}>
        {isEntree ? '↑' : '↓'}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-gray-900 truncate">{tx.titre}</p>
        <p className="text-xs text-gray-400 mt-0.5 truncate">
          {formatDate(tx.date)} ·{' '}
          {onChainHash ? (
            <a
              href={getExplorerTxUrl(onChainHash) || '#'}
              target="_blank"
              rel="noopener noreferrer"
              className="font-mono text-green-600 hover:underline"
              onClick={(e) => e.stopPropagation()}
            >
              {onChainHash.slice(0, 10)}…
            </a>
          ) : (
            <span className="font-mono text-green-600">{tx.hash || genHash()}</span>
          )}
        </p>
      </div>
      <div className="text-right flex-shrink-0">
        <p className={`text-sm font-bold ${isEntree ? 'text-green-600' : 'text-red-500'}`}>
          {isEntree ? '+' : '-'}{(tx.montant || 0).toLocaleString('fr-FR')}
        </p>
        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statutColors[tx.statut] || 'bg-gray-100 text-gray-600'}`}>
          {statutLabels[tx.statut] || tx.statut}
        </span>
      </div>
    </div>
  );
}

// ── Calcul graphique depuis les vraies transactions ──
function calculerGraphique(transactions) {
  const moisLabels = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Jui', 'Jui', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc'];
  const maintenant = new Date();
  const data = [];

  for (let i = 5; i >= 0; i--) {
    const date = new Date(maintenant.getFullYear(), maintenant.getMonth() - i, 1);
    const mois = date.getMonth();
    const annee = date.getFullYear();
    const start = new Date(annee, mois, 1);
    const end = new Date(annee, mois + 1, 1);
    const { revenus, depenses } = calculerFinances(transactions, { start, end });
    data.push({ mois: moisLabels[mois], revenus, depenses });
  }
  return data;
}

export default function Dashboard({ userData, notifications }) {
  const {
    transactions: toutesTransactions,
    loading: txLoading,
    cachedNotice,
    source,
    demoMode,
  } = useTransactions({ firebaseFallback: true });
  const { solde: soldeContrat, loading: soldeLoading } = useSolde();
  const transactions = useMemo(
    () => toutesTransactions.slice(0, 5),
    [toutesTransactions]
  );
  const { votes: votesChain } = useOpenVotes(toutesTransactions);

  const [votesFb, setVotesFb] = useState([]);
  const [mesVotes, setMesVotes] = useState({});
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const votes = useMemo(() => {
    if (votesChain.length > 0) return votesChain;
    const now = new Date();
    return votesFb.filter((v) => {
      if (v.statut !== 'ouvert') return false;
      const expiration = v.dateExpiration?.toDate
        ? v.dateExpiration.toDate()
        : new Date(v.dateExpiration);
      return expiration > now;
    });
  }, [votesChain, votesFb]);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'votes'), (snap) => {
      const data = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setVotesFb(data);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!userData?.uid) return;
    const unsub = onSnapshot(collection(db, 'bulletins_vote'), (snap) => {
      const myVotesFb = {};
      snap.docs.forEach((d) => {
        const dat = d.data();
        if (dat.userId === userData.uid) myVotesFb[dat.voteId] = dat.choix;
      });
      setMesVotes((prev) => ({ ...myVotesFb, ...prev }));
    });
    return () => unsub();
  }, [userData?.uid]);

  useEffect(() => {
    const addr = getAddress();
    if (!addr || votesChain.length === 0) return;
    setMesVotes((prev) => {
      const next = { ...prev };
      let changed = false;
      votesChain.forEach((v) => {
        if (!v.chainTransactionId) return;
        const ch = getStoredVoteChoice(v.chainTransactionId, addr);
        if (ch && next[v.id] !== ch) {
          next[v.id] = ch;
          changed = true;
        }
      });
      return changed ? next : prev;
    });
  }, [votesChain]);

  const soldeFirebase = useMemo(
    () => calculerFinances(toutesTransactions).solde,
    [toutesTransactions]
  );

  const solde =
    isContractConfigured() && source === 'chain' && !demoMode
      ? soldeContrat
      : soldeFirebase;

  const { revenus: revenusMois, depenses: depensesMois } = calculerFinances(toutesTransactions);

  // Graphique depuis vraies données
  const dataGraphique = calculerGraphique(toutesTransactions);

  // Votes où je n'ai pas encore voté
  const votesNonTraites = votes.filter(v => !mesVotes[v.id]);

  const peutCreerTransaction =
    userData?.role === 'tresorier' || userData?.role === 'president';

  if (txLoading && toutesTransactions.length === 0) return (
    <div className="flex items-center justify-center h-64">
      <div className="text-center">
        <div className="text-5xl mb-3 animate-pulse">🌱</div>
        <p className="text-green-700 font-semibold">Chargement du registre...</p>
        {soldeLoading && (
          <p className="text-xs text-gray-500 mt-2">Synchronisation du solde…</p>
        )}
      </div>
    </div>
  );

  return (
    <div className="max-w-7xl mx-auto px-3 sm:px-4 py-4 sm:py-6 space-y-4 sm:space-y-6">

      {cachedNotice && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          {cachedNotice}
        </div>
      )}

      {/* HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs text-gray-500">
            {now.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
            {' · '}
            {now.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
          </p>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 mt-0.5 truncate">
            Bonjour, {userData?.nom} 
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            CTA de Broukou · Région de la Kara ·{' '}
            <span className="text-green-600 font-medium capitalize">{userData?.role}</span>
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          {peutCreerTransaction && (
            <Link to="/nouvelle-transaction"
              className="flex items-center gap-2 bg-green-700 hover:bg-green-800 text-white px-3 sm:px-4 py-2 sm:py-2.5 rounded-xl text-sm font-semibold transition no-underline whitespace-nowrap">
              ➕ <span className="hidden sm:inline">Nouvelle</span> Transaction
            </Link>
          )}
          <Link
            to="/rapport"
            className="flex items-center gap-2 border border-gray-200 hover:bg-gray-50 text-gray-600 px-3 sm:px-4 py-2 sm:py-2.5 rounded-xl text-sm font-medium transition whitespace-nowrap no-underline"
          >
            📊 <span className="hidden sm:inline">Rapport</span> PDF
          </Link>
          {notifications?.permission !== 'granted' && (
            <button
              onClick={async () => {
                const granted = await notifications.requestPermission();
                if (granted) {
                  await notifications.subscribeToNotifications();
                }
              }}
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-3 sm:px-4 py-2 sm:py-2.5 rounded-xl text-sm font-medium transition whitespace-nowrap"
            >
              🔔 <span className="hidden sm:inline">Activer</span> Notifications
            </button>
          )}
        </div>
      </div>

      {/* ALERTE VOTE — disparaît si déjà voté */}
      {votesNonTraites.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-3 sm:p-4 flex items-center gap-3 sm:gap-4">
          <div className="w-9 h-9 sm:w-10 sm:h-10 bg-amber-500 rounded-xl flex items-center justify-center text-lg sm:text-xl flex-shrink-0">⚡</div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-amber-800 text-sm sm:text-base">
              {votesNonTraites.length} vote{votesNonTraites.length > 1 ? 's' : ''} en attente
            </p>
            <p className="text-xs sm:text-sm text-amber-600 mt-0.5 truncate">
              {votesNonTraites[0]?.titre} · {(() => {
                const exp = votesNonTraites[0]?.dateExpiration?.toDate?.() || new Date(votesNonTraites[0]?.dateExpiration);
                const ms = exp - new Date();
                const min = Math.floor(ms / 60000);
                const sec = Math.floor((ms % 60000) / 1000);
                return min > 0 ? `Expire dans ${min}min ${sec}s` : 'Expire bientôt';
              })()}
            </p>
          </div>
          <Link to="/vote"
            className="bg-amber-500 hover:bg-amber-600 text-white px-3 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition no-underline flex-shrink-0">
            Voter →
          </Link>
        </div>
      )}

      {/* Message si tous les votes sont traités */}
      {votes.length > 0 && votesNonTraites.length === 0 && (
        <div className="bg-green-50 border border-green-200 rounded-2xl p-3 sm:p-4 flex items-center gap-3 sm:gap-4">
          <p className="font-semibold text-green-800 text-sm sm:text-base">
            ✅ Vous avez voté sur toutes les propositions en cours. Merci !
          </p>
        </div>
      )}

      {/* SOLDE PRINCIPAL */}
      <div className="bg-gradient-to-br from-green-800 via-green-700 to-green-600 rounded-2xl sm:rounded-3xl p-5 sm:p-6 text-white shadow-lg relative overflow-hidden">
        <div className="absolute top-0 right-0 w-48 sm:w-64 h-48 sm:h-64 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2" />
        <div className="relative z-10">
          <p className="text-green-300 text-xs font-medium uppercase tracking-wider mb-1">
            🛡️ TRÉSORERIE DE LA COOPÉRATIVE
          </p>
          <p className="text-white/70 text-xs sm:text-sm mb-1">Solde Total de la Coopérative</p>
          <p className="text-4xl sm:text-5xl md:text-6xl font-black tracking-tight leading-tight">
            {solde >= 1000000
              ? `${(solde / 1000000).toFixed(3)}`
              : solde.toLocaleString('fr-FR')}
            <span className="text-2xl sm:text-3xl font-semibold text-green-300 ml-2">
              {solde >= 1000000 ? 'M FCFA' : 'FCFA'}
            </span>
          </p>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mt-3">
            <p className="text-green-300 text-xs sm:text-sm">
              {toutesTransactions.length} transactions enregistrées
            </p>
            <div className="bg-white/15 backdrop-blur border border-white/20 rounded-xl px-4 py-2 self-start sm:self-auto">
              <p className="text-green-300 text-xs font-medium">🔒 Sécurisé par Blockchain</p>
              <p className="text-green-400 font-mono text-xs mt-0.5 truncate max-w-[200px]">
                {isContractConfigured()
                  ? `${CONTRACT_ADDRESS.slice(0, 8)}…${CONTRACT_ADDRESS.slice(-4)}`
                  : genHash()}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* 4 STATS CARDS */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
        <StatCard
          icon="🏦"
          label="Fonds Totaux"
          value={solde >= 1000000 ? `${(solde / 1000000).toFixed(2)}M` : `${solde.toLocaleString('fr-FR')}`}
          sub={`${toutesTransactions.filter(t => t.statut === 'valide').length} tx validées`}
          color="text-green-700"
          bgColor="bg-green-50"
        />
        <StatCard
          icon="📉"
          label="Total Dépenses"
          value={depensesMois >= 1000000
            ? `${(depensesMois / 1000000).toFixed(2)}M`
            : `${(depensesMois / 1000).toFixed(0)}K`}
          sub={`${toutesTransactions.filter(estDepense).length} opérations`}
          color="text-red-600"
          bgColor="bg-red-50"
        />
        <StatCard
          icon="📈"
          label="Total Revenus"
          value={revenusMois >= 1000000
            ? `${(revenusMois / 1000000).toFixed(2)}M`
            : `${(revenusMois / 1000).toFixed(0)}K`}
          sub={`${toutesTransactions.filter(estEntree).length} opérations`}
          color="text-blue-600"
          bgColor="bg-blue-50"
        />
        <div className={`rounded-2xl p-4 shadow-sm border transition-all ${
          votesNonTraites.length > 0
            ? 'bg-red-700 border-red-600 text-white'
            : 'bg-white border-gray-100 text-gray-900'
        }`}>
          <div className={`w-9 h-9 ${votesNonTraites.length > 0 ? 'bg-white/20' : 'bg-amber-50'} rounded-xl flex items-center justify-center text-lg mb-2.5`}>
            🗳️
          </div>
          <p className={`text-xs mb-1 ${votesNonTraites.length > 0 ? 'text-red-200' : 'text-gray-500'}`}>
            Votes actifs
          </p>
          <p className="text-xl font-bold">{votes.length} en cours</p>
          {votesNonTraites.length > 0 && (
            <p className="text-xs mt-1 font-medium text-red-200">⚡ {votesNonTraites.length} à voter</p>
          )}
          {votesNonTraites.length === 0 && votes.length > 0 && (
            <p className="text-xs mt-1 font-medium text-green-600">✅ Tout voté</p>
          )}
        </div>
      </div>

      {/* WALLET CONNECT */}
      <WalletConnect />

      {/* GRAPHIQUE RÉEL + ACTIVITÉ */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
        <div className="lg:col-span-2 bg-white rounded-2xl p-4 sm:p-5 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-bold text-gray-900 text-sm sm:text-base">Dépenses vs Revenus</h3>
              <p className="text-xs text-gray-400 mt-0.5">
                {toutesTransactions.length === 0
                  ? 'Aucune transaction pour le moment'
                  : 'Données réelles des 6 derniers mois'
                }
              </p>
            </div>
            <div className="flex items-center gap-3 text-xs text-gray-500">
              <span className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-full bg-green-600 inline-block" /> Rev.
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-full bg-blue-400 inline-block" /> Dép.
              </span>
            </div>
          </div>

          {toutesTransactions.length === 0 ? (
            <div className="h-40 sm:h-48 flex items-center justify-center text-gray-400">
              <div className="text-center">
                <p className="text-4xl mb-2">📊</p>
                <p className="text-sm">Le graphique apparaîtra après les premières transactions</p>
              </div>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={dataGraphique} barGap={4}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                <XAxis dataKey="mois" tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false}
                  tickFormatter={(v) => v >= 1000000 ? `${(v/1000000).toFixed(1)}M` : `${(v/1000).toFixed(0)}K`} />
                <Tooltip
                  formatter={(value) => [value.toLocaleString('fr-FR') + ' FCFA']}
                  contentStyle={{ borderRadius: '12px', border: '1px solid #e5e7eb', fontSize: 12 }}
                />
                <Bar dataKey="revenus" fill="#16a34a" radius={[6, 6, 0, 0]} />
                <Bar dataKey="depenses" fill="#60a5fa" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Activité dynamique */}
        <div className="bg-white rounded-2xl p-4 sm:p-5 shadow-sm border border-gray-100">
          <h3 className="font-bold text-gray-900 mb-4 text-sm sm:text-base">🔔 Activité Récente</h3>
          {transactions.length === 0 ? (
            <div className="text-center py-8 text-gray-400">
              <p className="text-3xl mb-2">📭</p>
              <p className="text-sm">Aucune activité pour le moment</p>
            </div>
          ) : (
            <div>
              {transactions.slice(0, 4).map(tx => (
                <div key={tx.id} className="flex gap-3 py-3 border-b border-gray-50 last:border-0">
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-base flex-shrink-0 ${
                    estEntree(tx) ? 'bg-green-100' :
                    tx.statut === 'en_cours' ? 'bg-amber-100' : 'bg-red-100'
                  }`}>
                    {tx.statut === 'en_cours' ? '🗳️' :
                     estEntree(tx) ? '📈' : '📉'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-900 truncate">{tx.titre}</p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {(tx.montant || 0).toLocaleString('fr-FR')} FCFA · {formatDate(tx.date)}
                    </p>
                    <p className="text-xs font-mono text-green-600 mt-0.5 truncate">
                      {tx.explorerTxHash || tx.hash ? (
                        <a
                          href={getExplorerTxUrl(tx.explorerTxHash || tx.hash) || '#'}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="hover:underline"
                        >
                          {(tx.explorerTxHash || tx.hash).slice(0, 12)}…
                        </a>
                      ) : (
                        tx.hash || genHash()
                      )}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* TRANSACTIONS RÉCENTES */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
        <div className="lg:col-span-2 bg-white rounded-2xl p-4 sm:p-5 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-gray-900 text-sm sm:text-base">Transactions Récentes</h3>
            <Link to="/historique" className="text-sm text-green-700 font-medium no-underline">
              Voir Tout →
            </Link>
          </div>
          {transactions.length === 0 ? (
            <div className="text-center py-8 text-gray-400">
              <p className="text-4xl mb-3">📋</p>
              <p className="font-medium text-sm sm:text-base">Aucune transaction pour le moment</p>
              <p className="text-sm mt-1">Les transactions apparaîtront ici en temps réel</p>
              {peutCreerTransaction && (
                <Link to="/nouvelle-transaction"
                  className="inline-block mt-4 bg-green-700 text-white px-4 py-2 rounded-xl text-sm font-semibold no-underline hover:bg-green-800 transition">
                  ➕ Créer la première transaction
                </Link>
              )}
            </div>
          ) : (
            transactions.map(tx => <TransactionRow key={tx.id} tx={tx} />)
          )}
        </div>

        {/* Sécurité */}
        <div className="bg-green-900 rounded-2xl p-4 sm:p-5 text-white relative overflow-hidden">
          <div className="absolute bottom-0 right-0 w-32 h-32 bg-white/5 rounded-full translate-x-1/2 translate-y-1/2" />
          <div className="relative z-10">
            <div className="text-3xl mb-3">🔒</div>
            <h3 className="font-bold text-white text-base sm:text-lg mb-2">Sécurité Immuable</h3>
            <p className="text-green-300 text-xs sm:text-sm leading-relaxed mb-4">
              Toutes les transactions sont signées cryptographiquement. La transparence est notre fondation.
            </p>
            <div className="flex items-center gap-2 mb-4">
              {['V1', 'V2', 'V3'].map(v => (
                <span key={v} className="bg-green-700 text-green-300 text-xs font-bold px-2.5 py-1 rounded-lg">{v}</span>
              ))}
              <span className="text-green-400 text-xs font-medium ml-1">Nœuds Actifs</span>
            </div>
            <div className="space-y-2">
              {['Immuabilité cryptographique', 'Polygon Blockchain', 'Smart contracts autonomes', 'Audit public permanent'].map(item => (
                <div key={item} className="flex items-center gap-2 text-xs sm:text-sm text-green-300">
                  <span className="text-green-400">✓</span><span>{item}</span>
                </div>
              ))}
            </div>
            <div className="mt-4 pt-4 border-t border-green-700">
              <p className="text-green-400 text-xs">
                {toutesTransactions.length} transactions enregistrées
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Bouton flottant mobile — caché sur md+ */}
      {peutCreerTransaction && (
        <Link to="/nouvelle-transaction"
          className="fixed bottom-24 right-4 bg-green-700 hover:bg-green-800 text-white w-13 h-13 rounded-full flex items-center justify-center text-2xl shadow-lg transition-transform hover:scale-110 no-underline md:hidden"
          style={{ width: '52px', height: '52px' }}>
          ➕
        </Link>
      )}
    </div>
  );
}

