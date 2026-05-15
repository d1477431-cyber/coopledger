import { Link, useLocation } from 'react-router-dom';
import { signOut } from 'firebase/auth';
import { auth } from '../firebase';

export default function Navbar({ userData }) {
  const location = useLocation();

  const roleColors = {
    president: 'bg-purple-100 text-purple-700',
    tresorier: 'bg-blue-100 text-blue-700',
    membre: 'bg-green-100 text-green-700',
    institution: 'bg-amber-100 text-amber-700',
  };

  const roleLabels = {
    president: 'Président',
    tresorier: 'Trésorier',
    membre: 'Membre',
    institution: 'Institution',
  };

  const links = [

    { to: '/', label: 'Tableau de bord' },
    { to: '/vote', label: 'Votes' },
    { to: '/historique', label: 'Historique' },
    { to: '/appels-fonds', label: '💰 Appels de fonds' },
    { to: '/rapport', label: '📊 Rapport' },
    { to: '/membres', label: '👥 Membres' },
    { to: '/profil', label: '👤 Profil' },
    ...(userData?.role === 'tresorier' || userData?.role === 'president'
      ? [{ to: '/nouvelle-transaction', label: '➕ Nouvelle Transaction' }]
      : []),
  ];

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-white/95 backdrop-blur shadow-sm border-b border-gray-100">
      <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">

        {/* Logo */}
        <Link to="/" className="flex items-center gap-2.5 no-underline">
      
          <div className="w-8 h-8 md:w-9 md:h-9 bg-green-700 rounded-full flex items-center justify-center text-base md:text-lg flex-shrink-0">🌱</div>
          <div>
            <span className="font-bold text-gray-900 text-base md:text-lg">Coop<span className="text-green-700">Ledger</span></span>
            <p className="text-xs text-gray-400 leading-none hidden sm:block">CTA de Broukou</p>
          </div>
        </Link>

        {/* Liens desktop uniquement */}
        <div className="hidden md:flex items-center gap-1">
          {links.map(link => (
            <Link
              key={link.to}
              to={link.to}
              className={`px-4 py-2 rounded-xl text-sm font-medium transition no-underline ${
                location.pathname === link.to
                  ? 'bg-green-700 text-white'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              {link.label}
            </Link>
          ))}
        </div>

        {/* Droite : badge rôle + déconnexion */}
        <div className="flex items-center gap-2">
          {userData && (
            <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${roleColors[userData.role] || 'bg-gray-100 text-gray-600'}`}>
              {roleLabels[userData.role] || userData.role}
            </span>
          )}
          <button
            onClick={() => signOut(auth)}
            className="text-sm text-gray-500 hover:text-red-600 transition px-2 md:px-3 py-2 rounded-xl hover:bg-red-50"
            title="Déconnexion"
          >
            <span className="hidden md:inline">Déconnexion</span>
            <svg className="md:hidden w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
          </button>
        </div>
      </div>
    </nav>
  );
}