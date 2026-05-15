import { useState, useEffect } from 'react';
import {
  collection,
  addDoc,
  onSnapshot,
  query,
  where,
  doc,
  updateDoc,
  arrayUnion,
  increment,
  serverTimestamp,
  Timestamp,
  getDocs,
} from 'firebase/firestore';
import { db } from '../firebase';

function formatDate(ts) {
  if (!ts) return '—';
  const d = ts?.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });
}

export default function AppelDeFonds({ userData }) {
  const [appels, setAppels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modeCreation, setModeCreation] = useState(false);
  const [form, setForm] = useState({ titre: '', raisonAppel: '', montant: '', dateEcheance: '' });
  const [erreur, setErreur] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const coopId = userData?.cooperativeId || 'broukou';
  const peutCreer = userData?.role === 'president' || userData?.role === 'tresorier';

  useEffect(() => {
    const q = query(
      collection(db, 'appels_fonds'),
      where('cooperativeId', '==', coopId),
      where('statut', '==', 'actif')
    );
    const unsub = onSnapshot(
      q,
      (snap) => {
        setAppels(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
        setLoading(false);
      },
      () => setLoading(false)
    );
    return () => unsub();
  }, [coopId]);

  async function creerAppel() {
    if (!form.titre.trim()) return setErreur('Titre obligatoire.');
    if (!form.montant || Number(form.montant) <= 0) return setErreur('Montant invalide.');
    if (!form.dateEcheance) return setErreur("Date d'échéance obligatoire.");
    setSubmitting(true);
    try {
      const membresSnap = await getDocs(
        query(
          collection(db, 'users'),
          where('cooperativeId', '==', coopId),
          where('statut', '==', 'actif')
        )
      );
      const nbMembres = membresSnap.size || 1;
      const montantNum = Number(form.montant);
      await addDoc(collection(db, 'appels_fonds'), {
        titre: form.titre.trim(),
        raisonAppel: form.raisonAppel.trim(),
        montantParMembre: montantNum,
        totalAttendu: montantNum * nbMembres,
        totalCollecte: 0,
        membresAyantPaye: [],
        cooperativeId: coopId,
        creeParUid: userData?.uid,
        creeParNom: userData?.nom || userData?.email,
        dateEcheance: Timestamp.fromDate(new Date(form.dateEcheance)),
        dateCreation: serverTimestamp(),
        statut: 'actif',
        justificatifUrl: null,
      });
      setForm({ titre: '', raisonAppel: '', montant: '', dateEcheance: '' });
      setModeCreation(false);
      setErreur('');
    } catch {
      setErreur('Erreur lors de la création.');
    }
    setSubmitting(false);
  }

  async function marquerPaye(appelId, montantParMembre) {
    if (!userData?.uid) return;
    try {
      await updateDoc(doc(db, 'appels_fonds', appelId), {
        membresAyantPaye: arrayUnion(userData.uid),
        totalCollecte: increment(montantParMembre),
      });
      await addDoc(collection(db, 'transactions'), {
        titre: 'Cotisation appel de fonds',
        montant: montantParMembre,
        type: 'cotisation',
        typeTransaction: 'appel_fonds',
        statut: 'valide',
        cooperativeId: coopId,
        creePar: userData.uid,
        createurNom: userData.nom || userData.email,
        date: new Date(),
        appelFondsId: appelId,
        hash: null,
        source: 'web',
      });
    } catch {
      alert('Erreur lors du paiement.');
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-5xl animate-pulse">💰</div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">💰 Appels de Fonds</h1>
          <p className="text-gray-500 text-sm mt-1">Collectes en cours de la coopérative</p>
        </div>
        {peutCreer && (
          <button
            type="button"
            onClick={() => setModeCreation(!modeCreation)}
            className="bg-green-700 hover:bg-green-800 text-white px-4 py-2 rounded-xl font-semibold text-sm transition"
          >
            {modeCreation ? '✕ Annuler' : '+ Nouvel appel'}
          </button>
        )}
      </div>

      {modeCreation && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-6 space-y-4">
          <h2 className="font-bold text-gray-900">Créer un appel de fonds</h2>
          <input
            type="text"
            placeholder="Titre de l'appel *"
            value={form.titre}
            onChange={(e) => setForm((p) => ({ ...p, titre: e.target.value }))}
            className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-green-500"
          />
          <textarea
            placeholder="Raison de l'appel"
            value={form.raisonAppel}
            onChange={(e) => setForm((p) => ({ ...p, raisonAppel: e.target.value }))}
            rows={2}
            className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-green-500 resize-none"
          />
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-bold text-gray-500 block mb-1">Montant / membre (FCFA) *</label>
              <input
                type="number"
                placeholder="5000"
                value={form.montant}
                onChange={(e) => setForm((p) => ({ ...p, montant: e.target.value }))}
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-green-500"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-gray-500 block mb-1">Date d'échéance *</label>
              <input
                type="date"
                value={form.dateEcheance}
                onChange={(e) => setForm((p) => ({ ...p, dateEcheance: e.target.value }))}
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-green-500"
              />
            </div>
          </div>
          {erreur && <p className="text-red-600 text-sm">{erreur}</p>}
          <button
            type="button"
            onClick={creerAppel}
            disabled={submitting}
            className="w-full bg-green-700 hover:bg-green-800 text-white py-3 rounded-2xl font-bold transition disabled:opacity-50"
          >
            {submitting ? 'Création...' : "💰 Créer l'appel de fonds"}
          </button>
        </div>
      )}

      {appels.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <div className="text-6xl mb-4">💰</div>
          <p className="font-semibold">Aucun appel de fonds actif</p>
        </div>
      ) : (
        <div className="space-y-4">
          {appels.map((appel) => {
            const total = Number(appel.totalAttendu || 0);
            const collecte = Number(appel.totalCollecte || 0);
            const pct = total > 0 ? Math.min(100, Math.round((collecte / total) * 100)) : 0;
            const nbPaye = Array.isArray(appel.membresAyantPaye) ? appel.membresAyantPaye.length : 0;
            const aPaye =
              Array.isArray(appel.membresAyantPaye) && appel.membresAyantPaye.includes(userData?.uid);
            const nbCibles = Math.max(
              1,
              total > 0 ? Math.round(total / Math.max(appel.montantParMembre, 1)) : 0
            );
            return (
              <div key={appel.id} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="font-bold text-gray-900">{appel.titre}</h3>
                    <p className="text-xs text-gray-500 mt-0.5">Demandé par : {appel.creeParNom}</p>
                    <p className="text-xs text-gray-500">Échéance : {formatDate(appel.dateEcheance)}</p>
                  </div>
                  {aPaye && (
                    <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full font-semibold">
                      ✅ Vous avez payé
                    </span>
                  )}
                </div>
                <div className="mb-3">
                  <div className="flex justify-between text-xs text-gray-500 mb-1">
                    <span>
                      Montant : {Number(appel.montantParMembre || 0).toLocaleString('fr-FR')} FCFA / membre
                    </span>
                    <span>
                      {nbPaye}/{nbCibles} membres
                    </span>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-2.5">
                    <div
                      className="h-2.5 rounded-full bg-green-500 transition-all"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <p className="text-xs text-gray-400 mt-1">
                    {collecte.toLocaleString('fr-FR')} / {total.toLocaleString('fr-FR')} FCFA collectés
                  </p>
                </div>
                {!aPaye && (
                  <button
                    type="button"
                    onClick={() => marquerPaye(appel.id, Number(appel.montantParMembre || 0))}
                    className="w-full bg-green-700 hover:bg-green-800 text-white py-2.5 rounded-xl font-semibold text-sm transition"
                  >
                    💳 Marquer comme payé
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
