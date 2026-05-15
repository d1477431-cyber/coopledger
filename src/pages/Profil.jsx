import { signOut } from 'firebase/auth';
import { auth } from '../firebase';
import { useNavigate } from 'react-router-dom';

export default function Profil({ userData }) {
  const navigate = useNavigate();

  async function deconnecter() {
    await signOut(auth);
    navigate('/');
  }

  const roleLabel = {
    president: '🛡️ Président',
    tresorier: '🏦 Trésorier',
    membre: '👤 Membre',
    institution: '🏛️ Institution',
  }[userData?.role] || '👤 Membre';

  const initiales = (userData?.nom || userData?.email || '?').slice(0, 2).toUpperCase();

  return (
    <div className="max-w-sm mx-auto px-4 py-8">
      <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="bg-green-900 p-8 text-center text-white">
          <div className="w-20 h-20 bg-green-700 rounded-full flex items-center justify-center text-3xl font-bold mx-auto mb-4">
            {initiales}
          </div>
          <h1 className="text-xl font-bold">{userData?.nom || 'Utilisateur'}</h1>
          <p className="text-green-300 text-sm mt-1">{userData?.email}</p>
          <span className="inline-block mt-2 bg-green-800 text-green-200 text-xs px-3 py-1 rounded-full">{roleLabel}</span>
        </div>
        <div className="p-6 space-y-4">
          <div className="flex justify-between py-2 border-b border-gray-50">
            <span className="text-sm text-gray-500">Coopérative</span>
            <span className="text-sm font-semibold text-gray-900">{userData?.cooperativeId || 'broukou'}</span>
          </div>
          <div className="flex justify-between py-2 border-b border-gray-50">
            <span className="text-sm text-gray-500">Statut</span>
            <span className="text-sm font-semibold text-green-600">{userData?.statut || 'actif'}</span>
          </div>
          {(userData?.role === 'president' || userData?.role === 'tresorier') && (
            <>
              <button
                type="button"
                onClick={() => navigate('/rapport')}
                className="w-full text-left flex items-center gap-3 py-3 border-b border-gray-50 hover:bg-gray-50 rounded-xl px-2 transition"
              >
                <span className="text-xl">📊</span>
                <span className="text-sm font-semibold text-gray-800">Rapport mensuel</span>
              </button>
              <button
                type="button"
                onClick={() => navigate('/membres')}
                className="w-full text-left flex items-center gap-3 py-3 border-b border-gray-50 hover:bg-gray-50 rounded-xl px-2 transition"
              >
                <span className="text-xl">👥</span>
                <span className="text-sm font-semibold text-gray-800">Gestion des membres</span>
              </button>
            </>
          )}
          <button
            type="button"
            onClick={deconnecter}
            className="w-full bg-red-50 hover:bg-red-100 text-red-600 py-3 rounded-2xl font-semibold text-sm transition mt-4"
          >
            🚪 Se déconnecter
          </button>
        </div>
      </div>
    </div>
  );
}
