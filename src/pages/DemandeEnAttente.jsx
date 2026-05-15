import { useState, useEffect } from 'react';
import { signOut } from 'firebase/auth';
import { doc, updateDoc } from 'firebase/firestore';
import { auth, db } from '../firebase';

export default function DemandeEnAttente({ demande }) {
  const [tempsEcoule, setTempsEcoule] = useState('');

  useEffect(() => {
    const calc = () => {
      if (!demande?.dateDemande) return;
      const date = demande.dateDemande?.toDate ? demande.dateDemande.toDate() : new Date(demande.dateDemande);
      const diff = Date.now() - date.getTime();
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      setTempsEcoule(h > 0 ? `Il y a ${h}h ${m}min` : `Il y a ${m} minute${m > 1 ? 's' : ''}`);
    };
    calc();
    const interval = setInterval(calc, 30000);
    return () => clearInterval(interval);
  }, [demande?.dateDemande]);

  async function annulerDemande() {
    if (!demande?.id) return;
    try {
      await updateDoc(doc(db, 'demandes_compte', demande.id), { statut: 'annulee' });
      await signOut(auth);
    } catch (e) {
      await signOut(auth);
    }
  }

  // Refusé
  if (demande?.statut === 'refusee') {
    return (
      <div className="min-h-screen bg-green-950 flex items-center justify-center px-4">
        <div className="bg-white rounded-3xl p-8 max-w-sm w-full text-center shadow-xl">
          <div className="text-6xl mb-4">❌</div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Demande refusée</h2>
          <p className="text-gray-500 text-sm mb-6">
            {demande.raisonRefus || 'Le président a refusé votre demande d\'adhésion.'}
          </p>
          <button
            onClick={() => signOut(auth)}
            className="w-full bg-gray-800 text-white py-3 rounded-2xl font-semibold"
          >
            Retour à la connexion
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-green-950 flex items-center justify-center px-4">
      <div className="bg-white rounded-3xl p-8 max-w-sm w-full text-center shadow-xl">
        <div className="text-6xl mb-4 animate-pulse">⏳</div>
        <h2 className="text-xl font-bold text-gray-900 mb-2">Demande en cours d'examen</h2>
        <p className="text-gray-500 text-sm mb-1">
          Bonjour <span className="font-semibold text-green-700">{demande?.nom}</span>,
        </p>
        <p className="text-gray-500 text-sm mb-6">
          Votre demande d'adhésion à la coopérative a été envoyée au président.
          Vous serez notifié dès qu'elle sera traitée.
        </p>
        <div className="bg-green-50 rounded-2xl p-4 mb-6">
          <p className="text-xs text-gray-400 mb-1">Demande envoyée</p>
          <p className="text-green-700 font-semibold text-sm">{tempsEcoule}</p>
          <p className="text-xs text-gray-400 mt-2">
            Le président examine les demandes sous 48 heures.
          </p>
        </div>
        <button
          onClick={annulerDemande}
          className="w-full border border-gray-200 text-gray-500 py-3 rounded-2xl text-sm font-medium hover:bg-gray-50 transition"
        >
          Annuler ma demande
        </button>
      </div>
    </div>
  );
}
