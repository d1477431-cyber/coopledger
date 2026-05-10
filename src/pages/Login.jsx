import { useState } from 'react';
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword
} from 'firebase/auth';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { auth, db } from '../firebase';

export default function Login() {
  const [mode, setMode] = useState('connexion'); // 'connexion' ou 'inscription'
  const [form, setForm] = useState({
    nom: '',
    email: '',
    password: '',
    confirmPassword: '',
  });
  const [erreur, setErreur] = useState('');
  const [loading, setLoading] = useState(false);

  function update(key, val) {
    setForm(prev => ({ ...prev, [key]: val }));
    setErreur('');
  }

  // ── CONNEXION ──
  async function handleConnexion() {
    if (!form.email || !form.password) {
      return setErreur('Remplis tous les champs.');
    }
    setLoading(true);
    try {
      await signInWithEmailAndPassword(auth, form.email, form.password);
      // L'app redirige automatiquement via useAuth
    } catch (err) {
      setErreur('Email ou mot de passe incorrect.');
    }
    setLoading(false);
  }

  // ── INSCRIPTION (membre uniquement) ──
  async function handleInscription() {
    if (!form.nom.trim()) return setErreur('Entre ton nom complet.');
    if (!form.email) return setErreur('Entre ton email.');
    if (form.password.length < 6) return setErreur('Le mot de passe doit avoir au moins 6 caractères.');
    if (form.password !== form.confirmPassword) return setErreur('Les mots de passe ne correspondent pas.');

    setLoading(true);
    try {
      // 1. Créer le compte Firebase Auth
      const result = await createUserWithEmailAndPassword(
        auth, form.email, form.password
      );

      // 2. Créer le profil dans Firestore — TOUJOURS en tant que membre
      await setDoc(doc(db, 'users', result.user.uid), {
        nom: form.nom.trim(),
        email: form.email.toLowerCase(),
        role: 'membre', // ← TOUJOURS membre à l'inscription
        cooperativeId: 'broukou',
        dateInscription: new Date(),
        statut: 'actif',
        uid: result.user.uid,
      });

      // L'app redirige automatiquement via useAuth
    } catch (err) {
      if (err.code === 'auth/email-already-in-use') {
        setErreur('Cet email est déjà utilisé. Connecte-toi plutôt.');
      } else if (err.code === 'auth/invalid-email') {
        setErreur('Cet email n\'est pas valide.');
      } else {
        setErreur('Erreur lors de la création du compte. Réessaie.');
      }
    }
    setLoading(false);
  }

  return (
    <div
      className="min-h-screen flex"
      style={{
        backgroundImage: "url('https://images.unsplash.com/photo-1625246333195-78d9c38ad449?w=1600')",
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }}
    >
      <div className=" relative inset-0 bg-green-950/75" />

      {/* Texte gauche */}
      <div className="relative z-10 hidden lg:flex flex-col justify-center px-16 max-w-xl">
        <div className="flex items-center gap-3 mb-10">
          <div className="w-12 h-12 bg-green-500 rounded-full flex items-center justify-center text-2xl">
            🌱
          </div>
          <div>
            <p className="text-white font-bold text-2xl">CoopLedger</p>
            <p className="text-green-400 text-xs tracking-widest uppercase">
              Confiance Agricole
            </p>
          </div>
        </div>
        <h1 className="text-white text-5xl font-bold leading-tight mb-6">
          Sécurisez votre<br />
          <span className="text-green-400">avenir agricole.</span>
        </h1>
        <p className="text-white/70 text-lg leading-relaxed mb-8">
          La première plateforme de confiance dématérialisée
          pour les coopératives du Togo. Transparence, intégrité
          et croissance.
        </p>
        <div className="flex gap-8">
          <div className="flex items-center gap-2 text-white/60 text-sm">
            <span>🔗</span> Blockchain Ledger
          </div>
          <div className="flex items-center gap-2 text-white/60 text-sm">
            <span>🛡️</span> Sécurité
          </div>
        </div>
      </div>

      {/* Formulaire droite */}
      <div className="relative z-10 w-full max-w-md mx-auto lg:ml-auto lg:mr-8 self-center p-6">
        <div className="bg-white/95 backdrop-blur-sm rounded-3xl p-8 shadow-2xl">

          {/* Tabs connexion / inscription */}
          <div className="flex bg-gray-100 rounded-2xl p-1 mb-6">
            {<button
              onClick={() => { setMode('connexion'); setErreur(''); }}
              className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition ${
                mode === 'connexion'
                  ? ' bg-green-700 text-white shadow-sm '
                  : 'text-gray-500'
              }`}
            >
              Se connecter
            </button>}
            <button
              onClick={() => { setMode('inscription'); setErreur(''); }}
              className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition ${
                mode === 'inscription'
                  ? 'bg-green-700 text-white shadow-sm'
                  : 'text-gray-500'
              }`}
            >
              Rejoindre la coopérative
            </button>
          </div>

          {/* Titre */}
          <h2 className="text-xl font-bold text-gray-900 mb-1">
            {mode === 'connexion' ? 'Espace Membre' : 'Créer mon compte'}
          </h2>
          <p className="text-gray-500 text-sm mb-5">
            {mode === 'connexion'
              ? 'Connectez-vous pour gérer votre activité.'
              : 'Rejoignez la coopérative CTA de Broukou.'
            }
          </p>

          {/* ── FORMULAIRE CONNEXION ── */}
          {mode === 'connexion' && (
            <div className="space-y-4">
              <div>
                <label className="text-xs font-bold text-gray-500 uppercase tracking-widest block mb-2">
                  Email
                </label>
                <div className="flex items-center border border-gray-200 rounded-xl px-4 py-3 gap-3 focus-within:border-green-500 transition">
                  <span className="text-gray-400"></span>
                  <input
                    type="email"
                    placeholder="votre@email.com"
                    value={form.email}
                    onChange={e => update('email', e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleConnexion()}
                    className="flex-1 outline-none text-sm text-gray-700 bg-transparent"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-gray-500 uppercase tracking-widest block mb-2">
                  Mot de passe
                </label>
                <div className="flex items-center border border-gray-200 rounded-xl px-4 py-3 gap-3 focus-within:border-green-500 transition">
                  <span className="text-gray-400"></span>
                  <input
                    type="password"
                    placeholder="••••••••"
                    value={form.password}
                    onChange={e => update('password', e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleConnexion()}
                    className="flex-1 outline-none text-sm text-gray-700 bg-transparent"
                  />
                </div>
              </div>

              {erreur && (
                <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3">
                  <p className="text-red-600 text-sm text-center">{erreur}</p>
                </div>
              )}

              <button
                onClick={handleConnexion}
                disabled={loading}
                className="w-full bg-green-700 hover:bg-green-800 text-white font-bold py-4 rounded-2xl text-base transition disabled:opacity-50"
              >
                {loading ? '⏳ Connexion...' : 'Se Connecter →'}
              </button>
            </div>
          )}

          {/* ── FORMULAIRE INSCRIPTION ── */}
          {mode === 'inscription' && (
            <div className="space-y-4">

              {/* Badge membre */}
              <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-3 flex items-center gap-3">
                <span className="text-2xl"></span>
                <div>
                  <p className="text-sm font-bold text-green-800">
                    Inscription en tant que Membre
                  </p>
                  <p className="text-xs text-green-600 mt-0.5">
                    Tu pourras consulter les comptes et voter sur les décisions.
                  </p>
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-gray-500 uppercase tracking-widest block mb-2">
                  Nom complet *
                </label>
                <div className="flex items-center border border-gray-200 rounded-xl px-4 py-3 gap-3 focus-within:border-green-500 transition">
                  <span className="text-gray-400"></span>
                  <input
                    type="text"
                    placeholder="Kofi Agbenyega"
                    value={form.nom}
                    onChange={e => update('nom', e.target.value)}
                    className="flex-1 outline-none text-sm text-gray-700 bg-transparent"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-gray-500 uppercase tracking-widest block mb-2">
                  Email *
                </label>
                <div className="flex items-center border border-gray-200 rounded-xl px-4 py-3 gap-3 focus-within:border-green-500 transition">
                  <span className="text-gray-400"></span>
                  <input
                    type="email"
                    placeholder="votre@email.com"
                    value={form.email}
                    onChange={e => update('email', e.target.value)}
                    className="flex-1 outline-none text-sm text-gray-700 bg-transparent"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-gray-500 uppercase tracking-widest block mb-2">
                  Mot de passe *
                </label>
                <div className="flex items-center border border-gray-200 rounded-xl px-4 py-3 gap-3 focus-within:border-green-500 transition">
                  <span className="text-gray-400"></span>
                  <input
                    type="password"
                    placeholder="Minimum 6 caractères"
                    value={form.password}
                    onChange={e => update('password', e.target.value)}
                    className="flex-1 outline-none text-sm text-gray-700 bg-transparent"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-gray-500 uppercase tracking-widest block mb-2">
                  Confirmer le mot de passe *
                </label>
                <div className="flex items-center border border-gray-200 rounded-xl px-4 py-3 gap-3 focus-within:border-green-500 transition">
                  <span className="text-gray-400"></span>
                  <input
                    type="password"
                    placeholder="Répète le mot de passe"
                    value={form.confirmPassword}
                    onChange={e => update('confirmPassword', e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleInscription()}
                    className="flex-1 outline-none text-sm text-gray-700 bg-transparent"
                  />
                </div>
              </div>

              {erreur && (
                <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3">
                  <p className="text-red-600 text-sm text-center">{erreur}</p>
                </div>
              )}

              <button
                onClick={handleInscription}
                disabled={loading}
                className="w-full bg-green-700 hover:bg-green-800 text-white font-bold py-4 rounded-2xl text-base transition disabled:opacity-50"
              >
                {loading ? '⏳ Création du compte...' : 'Rejoindre la coopérative →'}
              </button>

              <p className="text-xs text-gray-400 text-center leading-relaxed">
                En créant un compte, tu rejoins la coopérative CTA de Broukou
                et acceptes que tes votes soient enregistrés sur la blockchain.
              </p>
            </div>
          )}

          <div className="flex justify-center mt-5">
            <span className="text-xs bg-green-50 text-green-700 px-4 py-1.5 rounded-full border border-green-200 flex items-center gap-2">
              <span></span> Certifié CoopLedger · Polygon Blockchain
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}