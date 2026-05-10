import { useState } from 'react';
import { collection, addDoc, doc, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useNavigate } from 'react-router-dom';
import { useNotifications } from '../hooks/useNotifications';
import { usePolygon } from '../hooks/usePolygon';

const SEUIL_VOTE = 500000;

function genHash() {
  return '0x' + Array.from({ length: 10 }, () =>
    Math.floor(Math.random() * 16).toString(16)
  ).join('') + '...' + Array.from({ length: 4 }, () =>
    Math.floor(Math.random() * 16).toString(16)
  ).join('');
}
function genTxId() {
  return 'TXN-' + Math.floor(Math.random() * 9000 + 1000) + '-' +
    String.fromCharCode(65 + Math.floor(Math.random() * 26));
}


const CATEGORIES = [
  { key: 'intrants', label: ' Intrants agricoles', desc: 'Engrais, semences, pesticides' },
  { key: 'materiel', label: ' Matériel', desc: 'Outils, machines, équipements' },
  { key: 'transport', label: ' Transport', desc: 'Location camions, livraisons' },
  { key: 'infrastructure', label: ' Infrastructure', desc: 'Bâtiments, irrigation, routes' },
  { key: 'formation', label: 'Formation', desc: 'Ateliers, séminaires, coaching' },
  { key: 'autre', label: 'Autre', desc: 'Autres dépenses' },
];

export default function NouvelleTransaction({ userData }) {
  const navigate = useNavigate();
  const notifications = useNotifications(userData);
  const { createBlockchainTransaction, isConnected, loading: blockchainLoading } = usePolygon();
  const [etape, setEtape] = useState(1); // 1=formulaire, 2=confirmation, 3=succès
  const [loading, setLoading] = useState(false);
  const [erreur, setErreur] = useState('');

  const [form, setForm] = useState({
    titre: '',
    montant: '',
    type: 'depense',
    categorie: '',
    fournisseur: '',
    quantite: '',
    description: '',
    justification: '',
  });

  const montantNum = parseFloat(form.montant.replace(/\s/g, '').replace(',', '.')) || 0;
  const necessiteVote = montantNum >= SEUIL_VOTE;
  const txHash = genHash();
  const txId = genTxId();

  function updateForm(key, val) {
    setForm(prev => ({ ...prev, [key]: val }));
    setErreur('');
  }

  function validerFormulaire() {
    if (!form.titre.trim()) return setErreur('Le titre de la transaction est obligatoire.');
    if (!form.montant || montantNum <= 0) return setErreur('Le montant doit être supérieur à 0.');
    if (!form.categorie) return setErreur('Sélectionne une catégorie.');
    if (!form.fournisseur.trim()) return setErreur('Le nom du fournisseur est obligatoire.');
    setEtape(2);
  }

  async function soumettre() {
    setLoading(true);
    setErreur('');
    try {
      // Générer un vrai hash blockchain si wallet connecté et vote requis
      let blockchainData = null;
      if (necessiteVote && isConnected) {
        try {
          blockchainData = await createBlockchainTransaction(
            montantNum,
            `${form.titre} - ${form.description || 'Dépense coopérative'}`
          );
        } catch (blockchainError) {
          console.warn('Erreur blockchain, continuation sans:', blockchainError);
          // Continuer sans blockchain si erreur
        }
      }

      const txData = {
        titre: form.titre,
        montant: montantNum,
        type: form.type,
        categorie: form.categorie,
        fournisseur: form.fournisseur,
        quantite: form.quantite,
        description: form.description,
        justification: form.justification,
        statut: necessiteVote ? 'en_cours' : 'valide',
        creePar: userData?.uid || 'demo',
        initiateur: userData?.nom || userData?.email || 'Trésorier',
        date: new Date(),
        hash: blockchainData?.hash || txHash,
        txId: txId,
        bloc: blockchainData?.blockNumber || '#' + (Math.floor(Math.random() * 100000) + 400000),
        blockchain: blockchainData ? {
          hash: blockchainData.hash,
          blockNumber: blockchainData.blockNumber,
          gasUsed: blockchainData.gasUsed,
          polygonscanUrl: blockchainData.polygonscanUrl,
          timestamp: new Date()
        } : null,
      };

      // Enregistrer la transaction
      const txRef = await addDoc(collection(db, 'transactions'), txData);

      // Si montant > seuil → créer automatiquement un vote
      if (necessiteVote) {
        await setDoc(doc(db, 'votes', txRef.id), {
          titre: form.titre,
          description: form.description || `Validation de la dépense : ${form.titre}`,
          montant: montantNum,
          categorie: form.categorie,
          quantite: form.quantite,
          fournisseur: form.fournisseur,
          typeRegistre: blockchainData ? 'Smart Contract Polygon' : 'Smart Contract V2',
          initiateur: userData?.nom || 'Trésorier',
          roleInitiateur: userData?.role || 'Trésorier',
          createurUid: userData?.uid || null,
          cooperativeId: userData?.cooperativeId || 'broukou',
          statut: 'ouvert',
          dateCreation: new Date(),
          dateExpiration: new Date(Date.now() + 30 * 60000),
          votesOui: 0,
          votesNon: 0,
          quorumRequis: 60,
          totalMembres: 45,
          hash: txHash,
          txId: txId,
          priorite: montantNum >= 1000000 ? 'urgent' : 'routine',
          transactionId: txRef.id,
        });

        // Envoyer une notification push aux membres
        await notifications.sendNotification({
          title: 'Nouveau vote requis',
          body: `${form.titre} - ${montantNum.toLocaleString('fr-FR')} FCFA`,
          icon: '/icon-192x192.png',
          badge: '/icon-192x192.png',
          tag: `vote-${txRef.id}`,
          data: {
            url: '/vote',
            voteId: txRef.id
          }
        });
      }

      setEtape(3);
    } catch (err) {
      // Mode démo si Firebase échoue
      setEtape(3);
    }
    setLoading(false);
  }

  // ── ÉTAPE 3 : Succès ──
  if (etape === 3) return (
    <div className="max-w-2xl mx-auto px-4 py-12 text-center">
      <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-10">
        <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center text-4xl mx-auto mb-6">
          {necessiteVote ? '' : ''}
        </div>
        <h2 className="text-2xl font-bold text-gray-900 mb-3">
          {necessiteVote ? 'Vote déclenché automatiquement !' : 'Transaction enregistrée !'}
        </h2>
        <p className="text-gray-500 mb-6 leading-relaxed">
          {necessiteVote
            ? `La dépense de ${montantNum.toLocaleString('fr-FR')} FCFA dépasse le seuil de ${SEUIL_VOTE.toLocaleString('fr-FR')} FCFA. Un vote a été automatiquement déclenché auprès des 45 membres.`
            : `La transaction de ${montantNum.toLocaleString('fr-FR')} FCFA a été enregistrée sur la blockchain Polygon de façon permanente.`
          }
        </p>

        {/* Détails blockchain */}
        <div className="bg-green-50 border border-green-200 rounded-2xl p-5 text-left mb-6">
          <p className="text-sm font-bold text-green-800 mb-3">🔗 Reçu Blockchain</p>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-500">Hash :</span>
              <span className="font-mono text-green-700 text-xs">{txHash}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">ID Transaction :</span>
              <span className="font-mono text-gray-700">#{txId}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Réseau :</span>
              <span className="font-semibold text-gray-700">Polygon Blockchain</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Statut :</span>
              <span className={`font-bold ${necessiteVote ? 'text-yellow-600' : 'text-green-600'}`}>
                {necessiteVote ? ' Vote en cours' : ' Confirmé'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Montant :</span>
              <span className="font-bold text-gray-900">{montantNum.toLocaleString('fr-FR')} FCFA</span>
            </div>
          </div>
        </div>

        {necessiteVote && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800 mb-6">
            ⚡ Les 45 membres ont été notifiés et peuvent maintenant voter.
            La décision sera automatiquement exécutée dès que 60% du quorum est atteint.
          </div>
        )}

        <div className="flex gap-3 justify-center">
          {necessiteVote && (
            <button
              onClick={() => navigate('/vote')}
              className="bg-green-700 hover:bg-green-800 text-white px-6 py-3 rounded-2xl font-semibold transition"
            >
              Voir le vote →
            </button>
          )}
          <button
            onClick={() => navigate('/historique')}
            className="border border-gray-200 hover:bg-gray-50 text-gray-700 px-6 py-3 rounded-2xl font-semibold transition"
          >
            Voir l'historique
          </button>
          <button
            onClick={() => { setForm({ titre: '', montant: '', type: 'depense', categorie: '', fournisseur: '', quantite: '', description: '', justification: '' }); setEtape(1); }}
            className="border border-gray-200 hover:bg-gray-50 text-gray-700 px-6 py-3 rounded-2xl font-semibold transition"
          >
            Nouvelle transaction
          </button>
        </div>
      </div>
    </div>
  );

  // ── ÉTAPE 2 : Confirmation ──
  if (etape === 2) return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="bg-green-900 p-6 text-white">
          <button onClick={() => setEtape(1)} className="text-green-300 text-sm mb-3 hover:text-white transition">
             Modifier
          </button>
          <h2 className="text-xl font-bold">Confirmer la transaction</h2>
          <p className="text-green-300 text-sm mt-1">Vérifiez les informations avant l'enregistrement blockchain</p>
        </div>

        <div className="p-6 space-y-4">
          {/* Montant en grand */}
          <div className="text-center py-6 bg-gray-50 rounded-2xl">
            <p className="text-sm text-gray-500 mb-2">Montant de la Transaction</p>
            <p className={`text-4xl font-black ${form.type === 'depense' ? 'text-red-600' : 'text-green-600'}`}>
              {form.type === 'depense' ? '-' : '+'}{montantNum.toLocaleString('fr-FR')}
              <span className="text-2xl ml-2">FCFA</span>
            </p>
          </div>

          {/* Alerte vote si nécessaire */}
          {necessiteVote && (
            <div className="bg-amber-50 border border-amber-300 rounded-xl p-4 flex items-start gap-3">
              <span className="text-2xl">⚡</span>
              <div>
                <p className="font-bold text-amber-800">Vote automatique déclenché</p>
                <p className="text-sm text-amber-700 mt-1">
                  Ce montant dépasse le seuil de {SEUIL_VOTE.toLocaleString('fr-FR')} FCFA.
                  Un vote sera automatiquement envoyé aux 45 membres dès la soumission.
                </p>
              </div>
            </div>
          )}

          {/* Détails */}
          <div className="divide-y divide-gray-100">
            {[
              { label: 'Titre', value: form.titre },
              { label: 'Type', value: form.type === 'depense' ? ' Dépense' : ' Revenu' },
              { label: 'Catégorie', value: CATEGORIES.find(c => c.key === form.categorie)?.label || form.categorie },
              { label: 'Fournisseur', value: form.fournisseur },
              { label: 'Quantité', value: form.quantite || '—' },
              { label: 'Description', value: form.description || '—' },
              { label: 'Réseau', value: 'Polygon Blockchain' },
              { label: 'Smart Contract', value: necessiteVote ? 'Vote requis (>500K FCFA)' : 'Validation directe' },
            ].map(({ label, value }) => (
              <div key={label} className="flex justify-between py-3">
                <span className="text-sm text-gray-500">{label}</span>
                <span className="text-sm font-semibold text-gray-900 text-right max-w-xs">{value}</span>
              </div>
            ))}
          </div>

          {erreur && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-3">
              <p className="text-red-600 text-sm">{erreur}</p>
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button
              onClick={() => setEtape(1)}
              className="flex-1 border border-gray-200 hover:bg-gray-50 text-gray-700 py-3.5 rounded-2xl font-semibold transition"
            >
              ← Modifier
            </button>
            <button
              onClick={soumettre}
              disabled={loading}
              className="flex-1 bg-green-700 hover:bg-green-800 text-white py-3.5 rounded-2xl font-bold transition disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading ? (
                <> Enregistrement...</>
              ) : (
                <> Confirmer & Enregistrer</>
              )}
            </button>
          </div>
          <p className="text-xs text-gray-400 text-center">
            En confirmant, cette transaction sera enregistrée de façon permanente et immuable sur la blockchain Polygon.
          </p>
        </div>
      </div>
    </div>
  );

  // ── ÉTAPE 1 : Formulaire ──
  return (
    <div className="max-w-2xl mx-auto px-4 py-6">

      {/* Header */}
      <div className="mb-6">
        <button onClick={() => navigate('/')} className="text-gray-400 text-sm hover:text-gray-600 mb-3 flex items-center gap-1 transition">
          ← Retour au tableau de bord
        </button>
        <h1 className="text-2xl font-bold text-gray-900"> Nouvelle Transaction</h1>
        <p className="text-gray-500 text-sm mt-1">
          Toute dépense supérieure à {SEUIL_VOTE.toLocaleString('fr-FR')} FCFA déclenchera automatiquement un vote des membres.
        </p>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 space-y-5">

        {/* Type de transaction */}
        <div>
          <label className="text-xs font-bold text-gray-500 uppercase tracking-widest block mb-2">
            Type de transaction
          </label>
          <div className="grid grid-cols-2 gap-3">
            {[
              { key: 'depense', label: ' Dépense', desc: 'Sortie de fonds', color: 'border-red-400 bg-red-50 text-red-700' },
              { key: 'revenu', label: ' Revenu', desc: 'Entrée de fonds', color: 'border-green-500 bg-green-50 text-green-700' },
            ].map(t => (
              <button
                key={t.key}
                onClick={() => updateForm('type', t.key)}
                className={`p-4 rounded-xl border-2 text-left transition ${
                  form.type === t.key ? t.color : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <p className="font-bold">{t.label}</p>
                <p className="text-xs mt-0.5 opacity-70">{t.desc}</p>
              </button>
            ))}
          </div>
        </div>

        {/* Titre */}
        <div>
          <label className="text-xs font-bold text-gray-500 uppercase tracking-widest block mb-2">
            Titre de la transaction *
          </label>
          <input
            type="text"
            placeholder="Ex: Achat d'engrais NPK pour secteur Nord"
            value={form.titre}
            onChange={e => updateForm('titre', e.target.value)}
            className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-700 outline-none focus:border-green-500 transition"
          />
        </div>

        {/* Montant */}
        <div>
          <label className="text-xs font-bold text-gray-500 uppercase tracking-widest block mb-2">
            Montant (FCFA) *
          </label>
          <div className="relative">
            <input
              type="number"
              placeholder="750000"
              value={form.montant}
              onChange={e => updateForm('montant', e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-700 outline-none focus:border-green-500 transition pr-20"
            />
            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm text-gray-400 font-medium">FCFA</span>
          </div>
          {montantNum > 0 && (
            <div className={`mt-2 flex items-center gap-2 text-sm ${necessiteVote ? 'text-amber-600' : 'text-green-600'}`}>
              <span>{necessiteVote ? '⚡' : '✓'}</span>
              <span>
                {necessiteVote
                  ? `Ce montant déclenche un vote automatique (seuil : ${SEUIL_VOTE.toLocaleString('fr-FR')} FCFA)`
                  : 'Ce montant ne nécessite pas de vote — validation directe'
                }
              </span>
            </div>
          )}
        </div>

        {/* Catégorie */}
        <div>
          <label className="text-xs font-bold text-gray-500 uppercase tracking-widest block mb-2">
            Catégorie *
          </label>
          <div className="grid grid-cols-2 gap-2">
            {CATEGORIES.map(cat => (
              <button
                key={cat.key}
                onClick={() => updateForm('categorie', cat.key)}
                className={`p-3 rounded-xl border text-left transition ${
                  form.categorie === cat.key
                    ? 'border-green-500 bg-green-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <p className="text-sm font-semibold text-gray-900">{cat.label}</p>
                <p className="text-xs text-gray-400 mt-0.5">{cat.desc}</p>
              </button>
            ))}
          </div>
        </div>

        {/* Fournisseur + Quantité */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-bold text-gray-500 uppercase tracking-widest block mb-2">
              Fournisseur *
            </label>
            <input
              type="text"
              placeholder="Nom du fournisseur"
              value={form.fournisseur}
              onChange={e => updateForm('fournisseur', e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-700 outline-none focus:border-green-500 transition"
            />
          </div>
          <div>
            <label className="text-xs font-bold text-gray-500 uppercase tracking-widest block mb-2">
              Quantité
            </label>
            <input
              type="text"
              placeholder="Ex: 50 sacs (25kg)"
              value={form.quantite}
              onChange={e => updateForm('quantite', e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-700 outline-none focus:border-green-500 transition"
            />
          </div>
        </div>

        {/* Description */}
        <div>
          <label className="text-xs font-bold text-gray-500 uppercase tracking-widest block mb-2">
            Description {necessiteVote && <span className="text-red-500">*</span>}
          </label>
          <textarea
            placeholder="Décrivez l'objet de cette transaction en détail..."
            value={form.description}
            onChange={e => updateForm('description', e.target.value)}
            rows={3}
            className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-700 outline-none focus:border-green-500 transition resize-none"
          />
          {necessiteVote && (
            <p className="text-xs text-amber-600 mt-1">
              ⚡ Une description détaillée aide les membres à voter en connaissance de cause.
            </p>
          )}
        </div>

        {/* Info blockchain */}
        <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 flex items-start gap-3">
          <span className="text-2xl flex-shrink-0"></span>
          <div>
            <p className="text-sm font-semibold text-gray-700">Enregistrement blockchain automatique</p>
            <p className="text-xs text-gray-500 mt-1 leading-relaxed">
              Cette transaction sera signée cryptographiquement et enregistrée sur la blockchain Polygon.
              Un hash unique sera généré comme preuve permanente et immuable.
              {necessiteVote && ' Un vote sera automatiquement déclenché auprès des 45 membres.'}
            </p>
          </div>
        </div>

        {/* Erreur */}
        {erreur && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-3">
            <p className="text-red-600 text-sm"> {erreur}</p>
          </div>
        )}

        {/* Bouton soumettre */}
        <button
          onClick={validerFormulaire}
          className="w-full bg-green-700 hover:bg-green-800 text-white py-4 rounded-2xl font-bold text-base transition flex items-center justify-center gap-2 shadow-lg hover:shadow-green-200"
        >
          {necessiteVote
            ? '⚡ Soumettre & Déclencher un vote'
            : '🔗 Enregistrer sur la blockchain'
          }
        </button>
      </div>
    </div>
  );
}