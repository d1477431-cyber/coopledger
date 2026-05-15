import { Link, useLocation } from 'react-router-dom';

export default function MobileNav({ userData }) {
  const location = useLocation();

  const showCentralButton =
    userData?.role !== 'membre' && userData?.role !== 'institution';

  const accueil = {
    to: '/',
    label: 'Accueil',
    icon: (active) => (
      <svg viewBox="0 0 24 24" fill={active ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={active ? 0 : 2} className="w-6 h-6">
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
      </svg>
    ),
  };

  const vote = {
    to: '/vote',
    label: 'Votes',
    icon: (active) => (
      <svg viewBox="0 0 24 24" fill={active ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={active ? 0 : 2} className="w-6 h-6">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  };

  const centralPlus = {
    to: '/nouvelle-transaction',
    label: '',
    special: true,
    icon: () => (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} className="w-7 h-7">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
      </svg>
    ),
  };

  const registre = {
    to: '/historique',
    label: 'Registre',
    icon: (active) => (
      <svg viewBox="0 0 24 24" fill={active ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={active ? 0 : 2} className="w-6 h-6">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
      </svg>
    ),
  };

  const profil = {
    to: '/profil',
    label: 'Profil',
    icon: (active) => (
      <svg viewBox="0 0 24 24" fill={active ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={active ? 0 : 2} className="w-6 h-6">
        <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
      </svg>
    ),
  };

  const links = showCentralButton
    ? [accueil, vote, centralPlus, registre, profil]
    : [accueil, vote, registre, profil];

  return (
    <nav
      className="md:hidden fixed bottom-0 left-0 right-0 z-50"
      style={{
        background: 'rgba(255,255,255,0.92)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        boxShadow: '0 -1px 0 rgba(0,0,0,0.08), 0 -8px 32px rgba(0,0,0,0.06)',
        paddingBottom: 'env(safe-area-inset-bottom)',
      }}
    >
      <div className="flex items-center justify-around px-2 pt-2 pb-2">
        {links.map((link) => {
          const active = location.pathname === link.to;

          if (link.special) {
            return (
              <Link
                key={link.to}
                to={link.to}
                className="flex flex-col items-center gap-0.5 no-underline min-w-0 flex-1"
                aria-label="Nouvelle transaction"
              >
                <div
                  className="w-12 h-12 rounded-2xl flex items-center justify-center shadow-lg"
                  style={{
                    background: 'linear-gradient(135deg, #15803d, #16a34a)',
                    boxShadow: '0 4px 16px rgba(21,128,61,0.4)',
                  }}
                >
                  <span className="text-white">{link.icon(true)}</span>
                </div>
              </Link>
            );
          }

          return (
            <Link
              key={link.to}
              to={link.to}
              className="flex flex-col items-center gap-0.5 no-underline min-w-0 flex-1"
            >
              <div className="relative flex flex-col items-center">
                {active && (
                  <div
                    className="absolute -top-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-green-600"
                    style={{ marginTop: '-6px' }}
                  />
                )}
                <div
                  className="w-10 h-10 rounded-2xl flex items-center justify-center transition-all duration-200"
                  style={{
                    background: active ? 'rgba(21,128,61,0.1)' : 'transparent',
                    color: active ? '#15803d' : '#9ca3af',
                    transform: active ? 'scale(1.05)' : 'scale(1)',
                  }}
                >
                  {link.icon(active)}
                </div>
              </div>
              <span
                className="transition-all duration-200 font-medium"
                style={{
                  color: active ? '#15803d' : '#9ca3af',
                  fontSize: '10px',
                  fontWeight: active ? '700' : '500',
                }}
              >
                {link.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
