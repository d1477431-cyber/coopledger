import { useState, useEffect } from 'react';
import { collection, onSnapshot, query, where, limit } from 'firebase/firestore';
import { signOut } from 'firebase/auth';
import { auth, db } from '../firebase';
import { calculerFinances, estEntree } from '../utils/calculsFinanciers';
import { getExplorerTxUrl, CONTRACT_ADDRESS } from '../config/blockchain';

export default function InstitutionDashboard({ userData }) {
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const coopId = userData?.cooperativeId || 'broukou';

  useEffect(() => {
    const q = query(
      collection(db, 'transactions'),
      where('cooperativeId', '==', coopId),
      limit(50)
    );
    const unsub = onSnapshot(
      q,
      (snap) => {
        const data = snap.docs
          .map((d) => ({ id: d.id, ...d.data() }))
          .sort((a, b) => {
            const da = a.date?.toDate ? a.date.toDate() : new Date(a.date || 0);
            const db2 = b.date?.toDate ? b.date.toDate() : new Date(b.date || 0);
            return db2 - da;
          });
        setTransactions(data);
        setLoading(false);
      },
      () => setLoading(false)
    );
    return () => unsub();
  }, [coopId]);

  const { revenus, depenses, solde } = calculerFinances(transactions);
  const txValidees = transactions.filter((t) => t.statut === 'valide');
  const txAvecHash = transactions.filter(
    (t) => t.hash?.startsWith?.('0x') || t.polygonTxHash
  ).length;
  const scoreTransparence =
    transactions.length > 0 ? Math.round((txAvecHash / transactions.length) * 100) : 0;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-green-900 text-white p-6">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <div>
            <p className="text-green-300 text-xs uppercase tracking-widest">Vue Institution</p>
            <h1 className="text-2xl font-bold mt-1">{userData?.nom}</h1>
            <p className="text-green-400 text-sm">Coopérative : {coopId}</p>
          </div>
          <button
            type="button"
            onClick={() => signOut(auth)}
            className="text-green-300 hover:text-white text-sm"
          >
            Déconnexion
          </button>
        </div>
      </div>
      <div className="max-w-2xl mx-auto px-4 py-6 space-y-4">
        <div className="bg-white rounded-2xl p-5 shadow-sm">
          <p className="text-xs text-gray-500 mb-1">Solde Total</p>
          <p className={`text-3xl font-black ${solde >= 0 ? 'text-green-700' : 'text-red-600'}`}>
            {solde.toLocaleString('fr-FR')} FCFA
          </p>
          <div className="grid grid-cols-2 gap-4 mt-4">
            <div>
              <p className="text-xs text-gray-400">Revenus</p>
              <p className="text-green-600 font-bold">+{revenus.toLocaleString('fr-FR')} FCFA</p>
            </div>
            <div>
              <p className="text-xs text-gray-400">Dépenses</p>
              <p className="text-red-500 font-bold">-{depenses.toLocaleString('fr-FR')} FCFA</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-2xl p-5 shadow-sm">
          <p className="text-sm font-bold text-gray-700 mb-2">Score de transparence blockchain</p>
          <div className="flex items-center gap-3">
            <div className="flex-1 bg-gray-100 rounded-full h-3">
              <div
                className="h-3 rounded-full bg-green-500 transition-all"
                style={{ width: `${scoreTransparence}%` }}
              />
            </div>
            <span className="font-bold text-green-700">{scoreTransparence}%</span>
          </div>
          <p className="text-xs text-gray-400 mt-2">
            {txAvecHash}/{transactions.length} transactions vérifiables on-chain
          </p>
          <a
            href={`https://amoy.polygonscan.com/address/${CONTRACT_ADDRESS}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-green-600 hover:underline mt-2 block"
          >
            Voir le contrat sur Polygonscan →
          </a>
        </div>
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
          <div className="p-4 border-b border-gray-50">
            <h2 className="font-bold text-gray-900">Transactions récentes</h2>
          </div>
          {loading ? (
            <div className="p-8 text-center text-gray-400">Chargement...</div>
          ) : (
            txValidees.slice(0, 20).map((tx) => {
              const isEntreeTx = estEntree(tx);
              const date = tx.date?.toDate ? tx.date.toDate() : new Date(tx.date || 0);
              const hash = tx.polygonTxHash || tx.hash;
              return (
                <div key={tx.id} className="flex items-center gap-3 px-4 py-3 border-b border-gray-50">
                  <div
                    className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm ${isEntreeTx ? 'bg-green-100' : 'bg-red-100'}`}
                  >
                    {isEntreeTx ? '↑' : '↓'}
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-gray-900">{tx.titre}</p>
                    <p className="text-xs text-gray-400">{date.toLocaleDateString('fr-FR')}</p>
                  </div>
                  <div className="text-right">
                    <p className={`text-sm font-bold ${isEntreeTx ? 'text-green-600' : 'text-red-500'}`}>
                      {isEntreeTx ? '+' : '-'}
                      {Number(tx.montant || 0).toLocaleString('fr-FR')}
                    </p>
                    {hash?.startsWith?.('0x') && (
                      <a
                        href={getExplorerTxUrl(hash)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-green-600 hover:underline"
                      >
                        Chain
                      </a>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
