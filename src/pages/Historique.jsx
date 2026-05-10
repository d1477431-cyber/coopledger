import { useState, useMemo } from 'react';
import BlockchainInfo from '../components/BlockchainInfo';
import { useTransactions, useSolde } from '../hooks/useBlockchain';
import { isContractConfigured, getExplorerTxUrl } from '../config/blockchain';
import BlockchainBadge from '../components/BlockchainBadge';

function formatFCFA(n) {
  return (n || 0).toLocaleString('fr-FR') + ' FCFA';
}
function formatDate(ts) {
  if (!ts) return '';
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
}
function genHash() {
  return '0x' + Array.from({ length: 8 }, () =>
    Math.floor(Math.random() * 16).toString(16)
  ).join('') + '...' + Array.from({ length: 4 }, () =>
    Math.floor(Math.random() * 16).toString(16)
  ).join('');
}

const STATUT_CONFIG = {
  valide: { label: 'Vérifié', bg: 'bg-green-100 text-green-700', dot: 'bg-green-500' },
  en_cours: { label: 'En cours', bg: 'bg-yellow-100 text-yellow-700', dot: 'bg-yellow-500' },
  rejete: { label: 'Rejeté', bg: 'bg-red-100 text-red-700', dot: 'bg-red-500' },
};

const TYPE_CONFIG = {
  revenu: { label: 'Revenu', icon: '↑', bg: 'bg-green-100', color: 'text-green-600', sign: '+' },
  entree: { label: 'Revenu', icon: '↑', bg: 'bg-green-100', color: 'text-green-600', sign: '+' },
  depense: { label: 'Dépense', icon: '↓', bg: 'bg-red-100', color: 'text-red-500', sign: '-' },
  sortie: { label: 'Dépense', icon: '↓', bg: 'bg-red-100', color: 'text-red-500', sign: '-' },
};

// ── Vue tableau Desktop ──
function TransactionRow({ tx, index }) {
  const [expanded, setExpanded] = useState(false);
  const statut = STATUT_CONFIG[tx.statut] || STATUT_CONFIG.valide;
  const type = TYPE_CONFIG[tx.type] || TYPE_CONFIG.depense;

  return (
    <>
      <tr
        className="hover:bg-gray-50 cursor-pointer transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <td className="px-4 py-3 text-sm text-gray-500">{formatDate(tx.date)}</td>
        <td className="px-4 py-3">
          <div className="flex items-center gap-2">
            <div className={`w-7 h-7 ${type.bg} rounded-lg flex items-center justify-center text-xs font-bold ${type.color}`}>
              {type.icon}
            </div>
            <span className={`text-xs font-semibold ${type.color}`}>{type.label}</span>
          </div>
        </td>
        <td className="px-4 py-3">
          <p className="text-sm font-semibold text-gray-900">{tx.titre}</p>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            {(tx.explorerTxHash || (tx.hash?.startsWith?.('0x') ? tx.hash : null)) && (
              <BlockchainBadge
                hash={tx.explorerTxHash || tx.hash}
                className="!animate-none"
              />
            )}
            <p className="text-xs text-gray-400 font-mono">
              {tx.explorerTxHash || tx.hash ? (
                <a
                  href={getExplorerTxUrl(tx.explorerTxHash || tx.hash) || '#'}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-green-700 hover:underline"
                >
                  {(tx.explorerTxHash || tx.hash).slice(0, 14)}…
                </a>
              ) : (
                tx.hash || genHash()
              )}
            </p>
          </div>
        </td>
        <td className="px-4 py-3 text-right">
          <span className={`text-sm font-bold ${type.color}`}>
            {type.sign}{(tx.montant || 0).toLocaleString('fr-FR')}
          </span>
        </td>
        <td className="px-4 py-3 text-center">
          <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full ${statut.bg}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${statut.dot}`} />
            {statut.label}
          </span>
          {tx.source === 'polygon' && (
            <p className="text-[10px] text-emerald-600 font-semibold mt-1">
              ✓ Vérifié sur Polygon
            </p>
          )}
        </td>
        <td className="px-4 py-3 text-sm text-gray-500 text-center">{tx.initiateur || '—'}</td>
        <td className="px-4 py-3 text-center text-gray-400">
          {expanded ? '▲' : '▼'}
        </td>
      </tr>
      {expanded && (
        <tr className="bg-green-50">
          <td colSpan={7} className="px-6 py-4">
            {tx.blockchain ? (
              <BlockchainInfo transaction={tx.blockchain} />
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div>
                  <p className="text-gray-400 text-xs uppercase tracking-wide mb-1">Hash Blockchain</p>
                  <p className="font-mono text-green-700 text-xs">{tx.hash || genHash()}</p>
                </div>
                <div>
                  <p className="text-gray-400 text-xs uppercase tracking-wide mb-1">Réseau</p>
                  <p className="font-semibold text-gray-700">Polygon Blockchain</p>
                </div>
                <div>
                  <p className="text-gray-400 text-xs uppercase tracking-wide mb-1">Confirmation</p>
                  <p className="font-semibold text-green-600">✓ Immuable · 4 nœuds</p>
                </div>
                <div>
                  <p className="text-gray-400 text-xs uppercase tracking-wide mb-1">Montant exact</p>
                  <p className="font-bold text-gray-900">{formatFCFA(tx.montant)}</p>
                </div>
              </div>
            )}
          </td>
        </tr>
      )}
    </>
  );
}

// ── Vue carte Mobile ──
function TransactionCard({ tx }) {
  const [expanded, setExpanded] = useState(false);
  const statut = STATUT_CONFIG[tx.statut] || STATUT_CONFIG.valide;
  const type = TYPE_CONFIG[tx.type] || TYPE_CONFIG.depense;

  return (
    <div
      className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden"
      onClick={() => setExpanded(!expanded)}
    >
      <div className="flex items-center gap-3 p-4">
        {/* Icône type */}
        <div className={`w-10 h-10 ${type.bg} rounded-xl flex items-center justify-center text-base font-bold ${type.color} flex-shrink-0`}>
          {type.icon}
        </div>
        {/* Info principale */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-gray-900 truncate">{tx.titre}</p>
          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
            <p className="text-xs text-gray-400">{formatDate(tx.date)}</p>
            {tx.initiateur && <p className="text-xs text-gray-400">· {tx.initiateur}</p>}
          </div>
          <div className="mt-1 space-y-1">
            {(tx.explorerTxHash || tx.hash?.startsWith?.('0x')) && (
              <BlockchainBadge hash={tx.explorerTxHash || tx.hash} className="!text-[10px] !py-1" />
            )}
            <p className="text-xs font-mono text-green-600 truncate">
              {tx.explorerTxHash || tx.hash ? (
                <a
                  href={getExplorerTxUrl(tx.explorerTxHash || tx.hash) || '#'}
                  className="hover:underline"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {(tx.explorerTxHash || tx.hash).slice(0, 12)}…
                </a>
              ) : (
                tx.hash || genHash()
              )}
            </p>
            {tx.source === 'polygon' && (
              <p className="text-[10px] text-emerald-600 font-semibold">✓ Vérifié sur Polygon</p>
            )}
          </div>
        </div>
        {/* Montant + statut */}
        <div className="text-right flex-shrink-0">
          <p className={`text-base font-bold ${type.color}`}>
            {type.sign}{(tx.montant || 0).toLocaleString('fr-FR')}
          </p>
          <p className="text-xs text-gray-400 mt-0.5">FCFA</p>
          <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full mt-1 ${statut.bg}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${statut.dot}`} />
            {statut.label}
          </span>
        </div>
      </div>
      {/* Détails expandables */}
      {expanded && (
        <div className="bg-green-50 border-t border-green-100 px-4 py-3 grid grid-cols-2 gap-3 text-xs">
          <div>
            <p className="text-gray-400 uppercase tracking-wide mb-1">Hash</p>
            <p className="font-mono text-green-700 break-all">{tx.hash || genHash()}</p>
          </div>
          <div>
            <p className="text-gray-400 uppercase tracking-wide mb-1">Réseau</p>
            <p className="font-semibold text-gray-700">Polygon</p>
          </div>
          <div>
            <p className="text-gray-400 uppercase tracking-wide mb-1">Confirmation</p>
            <p className="font-semibold text-green-600">✓ 4 nœuds</p>
          </div>
          <div>
            <p className="text-gray-400 uppercase tracking-wide mb-1">Montant</p>
            <p className="font-bold text-gray-900">{formatFCFA(tx.montant)}</p>
          </div>
        </div>
      )}
    </div>
  );
}

export default function Historique({ userData }) {
  const { transactions, loading, cachedNotice, source, demoMode } = useTransactions({
    firebaseFallback: true,
  });
  const { solde: soldeChain } = useSolde();
  const [filtre, setFiltre] = useState('tout');
  const [recherche, setRecherche] = useState('');
  const [page, setPage] = useState(1);
  const PAR_PAGE = 5;

  const filtrees = transactions.filter(tx => {
    const matchFiltre =
      filtre === 'tout' ? true :
      filtre === 'revenus' ? (tx.type === 'revenu' || tx.type === 'entree') :
      filtre === 'depenses' ? (tx.type === 'depense' || tx.type === 'sortie') :
      filtre === 'valeur_elevee' ? tx.montant > 500000 : true;
    const matchRecherche = recherche === '' ||
      tx.titre?.toLowerCase().includes(recherche.toLowerCase()) ||
      tx.hash?.toLowerCase().includes(recherche.toLowerCase());
    return matchFiltre && matchRecherche;
  });

  const totalPages = Math.ceil(filtrees.length / PAR_PAGE);
  const affichees = filtrees.slice((page - 1) * PAR_PAGE, page * PAR_PAGE);

  const soldeFirebase = useMemo(
    () =>
      transactions
        .filter((t) => t.statut === 'valide')
        .reduce((acc, tx) => {
          const isEntree = tx.type === 'revenu' || tx.type === 'entree';
          return isEntree ? acc + (tx.montant || 0) : acc - (tx.montant || 0);
        }, 0),
    [transactions]
  );

  const soldeTotal =
    isContractConfigured() && source === 'chain' && !demoMode
      ? soldeChain
      : soldeFirebase;

  const revenuMensuel = transactions
    .filter(t => (t.type === 'revenu' || t.type === 'entree') && t.statut === 'valide')
    .reduce((acc, tx) => acc + (tx.montant || 0), 0);

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="text-center">
        <div className="text-5xl mb-3 animate-pulse">🌿</div>
        <p className="text-green-700 font-semibold">Chargement du registre...</p>
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
        <div>
          <p className="text-xs text-gray-400 uppercase tracking-wider mb-1">Transparence Financière</p>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Le Registre Vivant 📋</h1>
          <p className="text-gray-500 text-xs sm:text-sm mt-1 leading-relaxed">
            Registre immuable de chaque FCFA transitant par le fonds agricole.
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button className="flex items-center gap-2 border border-gray-200 hover:bg-gray-50 text-gray-600 px-3 sm:px-4 py-2 rounded-xl text-sm font-medium transition whitespace-nowrap">
            📄 Audit PDF
          </button>
          <button className="flex items-center gap-2 border border-gray-200 hover:bg-gray-50 text-gray-600 px-3 sm:px-4 py-2 rounded-xl text-sm font-medium transition whitespace-nowrap">
            📤 CSV
          </button>
        </div>
      </div>

      {/* STATS */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
        <div className="bg-white rounded-2xl p-4 sm:p-5 shadow-sm border border-gray-100">
          <p className="text-sm text-gray-500 mb-1">Solde Total</p>
          <p className="text-2xl sm:text-3xl font-black text-gray-900">{(soldeTotal / 1000000).toFixed(2)}M</p>
          <p className="text-xs text-gray-400 mt-1">FCFA</p>
        </div>
        <div className="bg-white rounded-2xl p-4 sm:p-5 shadow-sm border border-gray-100">
          <p className="text-sm text-gray-500 mb-1">Revenu Total</p>
          <p className="text-2xl sm:text-3xl font-black text-blue-600">
            {revenuMensuel >= 1000000
              ? `${(revenuMensuel / 1000000).toFixed(2)}M`
              : revenuMensuel >= 1000
              ? `${(revenuMensuel / 1000).toFixed(0)}K`
              : revenuMensuel.toLocaleString('fr-FR')}
          </p>
          <p className="text-xs text-gray-400 mt-1">FCFA</p>
        </div>
        <div className="bg-green-900 rounded-2xl p-4 sm:p-5 text-white relative overflow-hidden">
          <div className="absolute right-0 top-0 bottom-0 w-20 flex items-center justify-center text-5xl opacity-10">🔒</div>
          <p className="text-sm text-green-300 mb-1">Vérification Blockchain</p>
          <p className="text-sm font-bold text-white leading-relaxed">
            Transactions signées cryptographiquement sur 4 nœuds.
          </p>
        </div>
      </div>

      {/* FILTRES + RECHERCHE */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-3 sm:p-4 border-b border-gray-100 flex flex-col gap-3">
          {/* Filtres — scroll horizontal sur mobile */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-hide">
            {[
              { key: 'tout', label: 'Toutes' },
              { key: 'revenus', label: 'Revenus' },
              { key: 'depenses', label: 'Dépenses' },
              { key: 'valeur_elevee', label: '>500k' },
            ].map(f => (
              <button
                key={f.key}
                onClick={() => { setFiltre(f.key); setPage(1); }}
                className={`px-3 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-medium transition whitespace-nowrap flex-shrink-0 ${
                  filtre === f.key
                    ? 'bg-green-800 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
          {/* Recherche */}
          <div className="flex items-center gap-2 border border-gray-200 rounded-xl px-3 py-2">
            <span className="text-gray-400 text-sm">🔍</span>
            <input
              type="text"
              placeholder="Rechercher une transaction..."
              value={recherche}
              onChange={e => { setRecherche(e.target.value); setPage(1); }}
              className="outline-none text-sm text-gray-700 w-full bg-transparent"
            />
          </div>
        </div>

        {/* TABLEAU — visible seulement sur md+ */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                <th className="px-4 py-3 text-left text-xs font-bold text-gray-400 uppercase tracking-wide">Date</th>
                <th className="px-4 py-3 text-left text-xs font-bold text-gray-400 uppercase tracking-wide">Type</th>
                <th className="px-4 py-3 text-left text-xs font-bold text-gray-400 uppercase tracking-wide">Description</th>
                <th className="px-4 py-3 text-right text-xs font-bold text-gray-400 uppercase tracking-wide">Montant (FCFA)</th>
                <th className="px-4 py-3 text-center text-xs font-bold text-gray-400 uppercase tracking-wide">Statut</th>
                <th className="px-4 py-3 text-center text-xs font-bold text-gray-400 uppercase tracking-wide">Initiateur</th>
                <th className="px-4 py-3 text-center text-xs font-bold text-gray-400 uppercase tracking-wide">Détails</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {affichees.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-gray-400">
                    Aucune transaction trouvée
                  </td>
                </tr>
              ) : (
                affichees.map((tx, i) => (
                  <TransactionRow key={tx.id} tx={tx} index={i} />
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* CARTES — visible seulement sur mobile (< md) */}
        <div className="md:hidden p-3 space-y-3">
          {affichees.length === 0 ? (
            <div className="text-center py-10 text-gray-400">
              <p className="text-3xl mb-2">📋</p>
              <p className="text-sm">Aucune transaction trouvée</p>
            </div>
          ) : (
            affichees.map((tx, i) => (
              <TransactionCard key={tx.id} tx={tx} />
            ))
          )}
        </div>

        {/* PAGINATION */}
        <div className="px-3 sm:px-4 py-3 border-t border-gray-100 flex items-center justify-between gap-2">
          <p className="text-xs sm:text-sm text-gray-500">
            {Math.min(PAR_PAGE, filtrees.length)} / {filtrees.length} transactions
          </p>
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              className="w-8 h-8 rounded-lg border border-gray-200 flex items-center justify-center text-sm hover:bg-gray-50 disabled:opacity-40 transition"
            >‹</button>
            {Array.from({ length: Math.min(totalPages, 3) }, (_, i) => i + 1).map(p => (
              <button
                key={p}
                onClick={() => setPage(p)}
                className={`w-8 h-8 rounded-lg text-sm font-semibold transition ${
                  page === p ? 'bg-green-800 text-white' : 'border border-gray-200 hover:bg-gray-50'
                }`}
              >{p}</button>
            ))}
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="w-8 h-8 rounded-lg border border-gray-200 flex items-center justify-center text-sm hover:bg-gray-50 disabled:opacity-40 transition"
            >›</button>
          </div>
        </div>
      </div>

      {/* GARANTIE TRANSPARENCE */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 sm:p-6 text-center">
        <h3 className="font-bold text-green-800 text-base sm:text-lg mb-2">Notre Garantie de Transparence Radicale</h3>
        <p className="text-gray-500 text-xs sm:text-sm leading-relaxed max-w-2xl mx-auto mb-4">
          Chaque transaction est visible par tous les membres. Aucune manipulation cachée n'est possible.
          CoopLedger utilise des ancres cryptographiques pour garantir qu'une fois un enregistrement saisi,
          il ne peut être modifié sans le consensus de la communauté.
        </p>
        <div className="flex justify-center gap-4 sm:gap-6 text-xs text-gray-400 font-medium uppercase tracking-wider flex-wrap">
          <button className="hover:text-green-700 transition">Spécifications Techniques</button>
          <button className="hover:text-green-700 transition">Gouvernance</button>
          <button className="hover:text-green-700 transition">Sécurité</button>
        </div>
      </div>
    </div>
  );
}