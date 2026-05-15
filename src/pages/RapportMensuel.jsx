import { useState, useEffect, useMemo } from 'react';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';
import { Link } from 'react-router-dom';
import { db } from '../firebase';
import { useRapportPDF, resumePourMois } from '../hooks/useRapportPDF';
import { estEntree } from '../utils/calculsFinanciers';

const MOIS_OPTIONS = [
  { value: 0, label: 'Janvier' },
  { value: 1, label: 'Février' },
  { value: 2, label: 'Mars' },
  { value: 3, label: 'Avril' },
  { value: 4, label: 'Mai' },
  { value: 5, label: 'Juin' },
  { value: 6, label: 'Juillet' },
  { value: 7, label: 'Août' },
  { value: 8, label: 'Septembre' },
  { value: 9, label: 'Octobre' },
  { value: 10, label: 'Novembre' },
  { value: 11, label: 'Décembre' },
];

function formatDate(ts) {
  if (!ts) return '';
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export default function RapportMensuel({ userData }) {
  const [annee, setAnnee] = useState(() => new Date().getFullYear());
  const [mois, setMois] = useState(() => new Date().getMonth());
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const { genererRapportMensuel } = useRapportPDF();

  useEffect(() => {
    const q = query(collection(db, 'transactions'), orderBy('date', 'desc'));
    const unsub = onSnapshot(
      q,
      (snap) => {
        setTransactions(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
        setLoading(false);
      },
      () => setLoading(false)
    );
    return () => unsub();
  }, []);

  const resume = useMemo(
    () => resumePourMois(transactions, annee, mois),
    [transactions, annee, mois]
  );

  const annees = useMemo(() => {
    const y = new Date().getFullYear();
    const set = new Set([y, y - 1, y - 2]);
    transactions.forEach((tx) => {
      const d = tx.date?.toDate ? tx.date.toDate() : tx.date ? new Date(tx.date) : null;
      if (d && !Number.isNaN(d.getTime())) set.add(d.getFullYear());
    });
    return [...set].sort((a, b) => b - a);
  }, [transactions]);

  const periodeLabel = new Date(annee, mois, 1).toLocaleDateString('fr-FR', {
    month: 'long',
    year: 'numeric',
  });

  function handleDownload() {
    genererRapportMensuel(transactions, userData, { year: annee, month: mois });
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="text-5xl mb-3 animate-pulse">📊</div>
          <p className="text-[#15803d] font-semibold">Chargement des transactions...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-3 sm:px-4 py-4 sm:py-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <p className="text-xs text-gray-400 uppercase tracking-wider mb-1">Transparence financière</p>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Rapport mensuel PDF</h1>
          <p className="text-gray-500 text-sm mt-1">
            Résumé des transactions Firestore pour la période choisie — mise à jour en temps réel.
          </p>
        </div>
        <Link
          to="/"
          className="text-sm font-medium text-[#15803d] hover:text-[#14532d] no-underline self-start"
        >
          ← Tableau de bord
        </Link>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 sm:p-6 space-y-4">
        <h2 className="text-sm font-bold text-gray-700">Période</h2>
        <div className="flex flex-col sm:flex-row gap-3 sm:items-end">
          <div className="flex-1">
            <label className="block text-xs font-medium text-gray-500 mb-1">Mois</label>
            <select
              value={mois}
              onChange={(e) => setMois(Number(e.target.value))}
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-800 bg-white focus:ring-2 focus:ring-[#15803d]/30 focus:border-[#15803d] outline-none"
            >
              {MOIS_OPTIONS.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>
          </div>
          <div className="flex-1">
            <label className="block text-xs font-medium text-gray-500 mb-1">Année</label>
            <select
              value={annee}
              onChange={(e) => setAnnee(Number(e.target.value))}
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-800 bg-white focus:ring-2 focus:ring-[#15803d]/30 focus:border-[#15803d] outline-none"
            >
              {annees.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </div>
          <button
            type="button"
            onClick={handleDownload}
            className="w-full sm:w-auto shrink-0 bg-[#15803d] hover:bg-[#14532d] text-white font-semibold px-5 py-2.5 rounded-xl transition shadow-sm"
          >
            Télécharger le PDF
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
          <p className="text-xs text-gray-500 mb-1">Transactions</p>
          <p className="text-2xl font-black text-gray-900">{resume.txMois.length}</p>
          <p className="text-xs text-[#15803d] mt-1 capitalize">{periodeLabel}</p>
        </div>
        <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
          <p className="text-xs text-gray-500 mb-1">Entrées</p>
          <p className="text-xl font-black text-[#15803d]">
            {(resume.totalEntrees || 0).toLocaleString('fr-FR')} <span className="text-sm font-semibold">FCFA</span>
          </p>
        </div>
        <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
          <p className="text-xs text-gray-500 mb-1">Sorties</p>
          <p className="text-xl font-black text-red-600">
            {(resume.totalSorties || 0).toLocaleString('fr-FR')} <span className="text-sm font-semibold">FCFA</span>
          </p>
        </div>
        <div className="rounded-2xl p-4 text-white shadow-sm bg-gradient-to-br from-[#14532d] to-[#15803d]">
          <p className="text-xs text-green-200 mb-1">Solde net (période)</p>
          <p className="text-xl font-black">
            {(resume.soldeNet || 0).toLocaleString('fr-FR')} <span className="text-sm font-semibold">FCFA</span>
          </p>
          <p className="text-xs text-green-200 mt-1">
            {resume.nbValidees} validées · {resume.nbEnCours} en cours · {resume.nbRejetees} rejetées
          </p>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100 bg-gray-50">
          <h3 className="text-sm font-bold text-gray-800">Détail du mois ({resume.txMois.length})</h3>
        </div>
        <div className="max-h-[420px] overflow-y-auto divide-y divide-gray-50">
          {resume.txMois.length === 0 ? (
            <p className="p-8 text-center text-gray-400 text-sm">Aucune transaction pour cette période.</p>
          ) : (
            resume.txMois.map((tx) => {
              const isEntreeTx = estEntree(tx);
              return (
                <div
                  key={tx.id}
                  className="px-4 py-3 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 hover:bg-gray-50/80"
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-900 text-sm truncate">{tx.titre || '—'}</p>
                    <p className="text-xs text-gray-400">{formatDate(tx.date)} · {tx.statut || '—'}</p>
                  </div>
                  <p
                    className={`text-sm font-bold whitespace-nowrap ${isEntreeTx ? 'text-[#15803d]' : 'text-red-600'}`}
                  >
                    {isEntreeTx ? '+' : '-'}
                    {(tx.montant || 0).toLocaleString('fr-FR')} FCFA
                  </p>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
