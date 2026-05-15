import { useState } from 'react';
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
} from 'firebase/auth';
import { collection, addDoc } from 'firebase/firestore';
import { auth, db } from '../firebase';

export default function Login() {
  const [mode, setMode] = useState('connexion');
  const [demandeEnvoyee, setDemandeEnvoyee] = useState(false);
  const [form, setForm] = useState({
    nom: '',
    email: '',
    password: '',
    confirmPassword: '',
    description: '',
  });
  const [erreur, setErreur] = useState('');
  const [loading, setLoading] = useState(false);

  function update(key, val) {
    setForm((prev) => ({ ...prev, [key]: val }));
    setErreur('');
  }

  async function handleConnexion() {
    if (!form.email || !form.password) {
      return setErreur('Remplis tous les champs.');
    }
    setLoading(true);
    try {
      await signInWithEmailAndPassword(auth, form.email, form.password);
    } catch {
      setErreur('Email ou mot de passe incorrect.');
    }
    setLoading(false);
  }

  async function handleDemandeAdhesion() {
    if (!form.nom.trim()) return setErreur('Entre ton nom complet.');
    if (!form.email) return setErreur('Entre ton email.');
    if (form.password.length < 6) return setErreur('Mot de passe minimum 6 caractères.');
    if (form.password !== form.confirmPassword) {
      return setErreur('Les mots de passe ne correspondent pas.');
    }
    setLoading(true);
    try {
      const result = await createUserWithEmailAndPassword(
        auth,
        form.email,
        form.password
      );
      await addDoc(collection(db, 'demandes_compte'), {
        uid: result.user.uid,
        nom: form.nom.trim(),
        email: form.email.toLowerCase(),
        cooperativeId: 'broukou',
        dateDemande: new Date(),
        statut: 'en_attente',
        message: form.description || '',
      });
      setDemandeEnvoyee(true);
    } catch (err) {
      if (err.code === 'auth/email-already-in-use') {
        setErreur('Email déjà utilisé. Connecte-toi.');
      } else {
        setErreur("Impossible d'envoyer la demande.");
      }
    }
    setLoading(false);
  }

  if (demandeEnvoyee) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-green-950 px-6">
        <div className="max-w-md w-full bg-white rounded-3xl p-8 shadow-2xl text-center">
          <div className="text-5xl mb-4">✅</div>
          <h1 className="text-xl font-bold text-gray-900 mb-2">Demande envoyée !</h1>
          <p className="text-gray-600 text-sm mb-6 leading-relaxed">
            Ta demande d&apos;adhésion a bien été transmise. Tu recevras l&apos;accès
            dès qu&apos;un administrateur l&apos;aura validée.
          </p>
          <p className="text-xs text-gray-400">
            Tu peux fermer cette page. Reconnecte-toi pour suivre l&apos;état de ta demande.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      className="min-h-screen flex"
      style={{
        backgroundImage:
          "url('https://images.unsplash.com/photo-1625246333195-78d9c38ad449?w=1600')",
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }}
    >
      <div className="relative inset-0 bg-green-950/75" />

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
          La première plateforme de confiance dématérialisée pour les coopératives
          du Togo. Transparence, intégrité et croissance.
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

      <div className="relative z-10 w-full max-w-md mx-auto lg:ml-auto lg:mr-8 self-center p-6">
        <div className="bg-white/95 backdrop-blur-sm rounded-3xl p-8 shadow-2xl">
          <div className="flex bg-gray-100 rounded-2xl p-1 mb-6">
            <button
              type="button"
              onClick={() => {
                setMode('connexion');
                setErreur('');
              }}
              className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition ${
                mode === 'connexion'
                  ? 'bg-green-700 text-white shadow-sm'
                  : 'text-gray-500'
              }`}
            >
              Se connecter
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('demande');
                setErreur('');
              }}
              className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition ${
                mode === 'demande'
                  ? 'bg-green-700 text-white shadow-sm'
                  : 'text-gray-500'
              }`}
            >
              S&apos;inscrire maintenant
            </button>
          </div>

          <h2 className="text-xl font-bold text-gray-900 mb-1">
            {mode === 'connexion' ? 'Espace Membre' : "Demande d'adhésion"}
          </h2>
          <p className="text-gray-500 text-sm mb-5">
            {mode === 'connexion'
              ? 'Connectez-vous pour gérer votre activité.'
              : 'Rejoignez la coopérative CTA de Broukou. Votre accès sera activé après validation.'}
          </p>

          {mode === 'connexion' && (
            <div className="space-y-4">
              <div>
                <label className="text-xs font-bold text-gray-500 uppercase tracking-widest block mb-2">
                  Email
                </label>
                <div className="flex items-center border border-gray-200 rounded-xl px-4 py-3 gap-3 focus-within:border-green-500 transition">
                  <input
                    type="email"
                    placeholder="votre@email.com"
                    value={form.email}
                    onChange={(e) => update('email', e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleConnexion()}
                    className="flex-1 outline-none text-sm text-gray-700 bg-transparent"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-gray-500 uppercase tracking-widest block mb-2">
                  Mot de passe
                </label>
                <div className="flex items-center border border-gray-200 rounded-xl px-4 py-3 gap-3 focus-within:border-green-500 transition">
                  <input
                    type="password"
                    placeholder="••••••••"
                    value={form.password}
                    onChange={(e) => update('password', e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleConnexion()}
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
                type="button"
                onClick={handleConnexion}
                disabled={loading}
                className="w-full bg-green-700 hover:bg-green-800 text-white font-bold py-4 rounded-2xl text-base transition disabled:opacity-50"
              >
                {loading ? '⏳ Connexion...' : 'Se Connecter →'}
              </button>
            </div>
          )}

          {mode === 'demande' && (
            <div className="space-y-4">
              <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
                <p className="text-sm font-bold text-amber-800">Adhésion sur validation</p>
                <p className="text-xs text-amber-700 mt-0.5">
                  Un administrateur examinera ta demande avant d&apos;activer ton compte.
                </p>
              </div>

              <div>
                <label className="text-xs font-bold text-gray-500 uppercase tracking-widest block mb-2">
                  Nom complet *
                </label>
                <input
                  type="text"
                  placeholder="Kofi Agbenyega"
                  value={form.nom}
                  onChange={(e) => update('nom', e.target.value)}
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-green-500"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-gray-500 uppercase tracking-widest block mb-2">
                  Email *
                </label>
                <input
                  type="email"
                  placeholder="votre@email.com"
                  value={form.email}
                  onChange={(e) => update('email', e.target.value)}
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-green-500"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-gray-500 uppercase tracking-widest block mb-2">
                  Mot de passe *
                </label>
                <input
                  type="password"
                  placeholder="Minimum 6 caractères"
                  value={form.password}
                  onChange={(e) => update('password', e.target.value)}
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-green-500"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-gray-500 uppercase tracking-widest block mb-2">
                  Confirmer le mot de passe *
                </label>
                <input
                  type="password"
                  placeholder="Répète le mot de passe"
                  value={form.confirmPassword}
                  onChange={(e) => update('confirmPassword', e.target.value)}
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-green-500"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-gray-500 uppercase tracking-widest block mb-2">
                  Message (optionnel)
                </label>
                <textarea
                  placeholder="Présente-toi brièvement..."
                  value={form.description}
                  onChange={(e) => update('description', e.target.value)}
                  rows={3}
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-green-500 resize-none"
                />
              </div>

              {erreur && (
                <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3">
                  <p className="text-red-600 text-sm text-center">{erreur}</p>
                </div>
              )}

              <button
                type="button"
                onClick={handleDemandeAdhesion}
                disabled={loading}
                className="w-full bg-green-700 hover:bg-green-800 text-white font-bold py-4 rounded-2xl text-base transition disabled:opacity-50"
              >
                {loading ? '⏳ Envoi en cours...' : 'Envoyer ma demande →'}
              </button>
            </div>
          )}

          <div className="flex justify-center mt-5">
            <span className="text-xs bg-green-50 text-green-700 px-4 py-1.5 rounded-full border border-green-200">
              Certifié CoopLedger · Polygon Amoy Testnet
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
