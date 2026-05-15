import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './hooks/useAuth';
import { useNotifications } from './hooks/useNotifications';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Vote from './pages/Vote';
import Historique from './pages/Historique';
import NouvelleTransaction from './pages/NouvelleTransaction';
import Navbar from './components/Navbar';
import MobileNav from './components/MobileNav';
import Membres from './pages/Membres';
import RapportMensuel from './pages/RapportMensuel';
import AppelDeFonds from './pages/AppelDeFonds';
import Profil from './pages/Profil';
import InstitutionDashboard from './pages/InstitutionDashboard';
import DemandeEnAttente from './pages/DemandeEnAttente';

export default function App() {
  const { user, userData, demandeEnAttente, loading } = useAuth();
  const { permission, requestPermission, subscribeToNotifications, sendNotification } = useNotifications(userData);

  if (loading) return (
    <div className="h-screen flex items-center justify-center bg-green-950">
      <div className="text-center">
        <div className="text-6xl mb-4 animate-pulse">🌱</div>
        <p className="text-green-400 text-2xl font-bold">CoopLedger</p>
        <p className="text-green-600 text-sm mt-2">Chargement...</p>
      </div>
    </div>
  );

  if (!user) return <Login />;

  // Demande d'adhésion en cours (pas encore de profil users/)
  if (user && !userData && demandeEnAttente) {
    return <DemandeEnAttente demande={demandeEnAttente} />;
  }

  // Vue institution (lecture seule)
  if (userData?.role === 'institution') {
    return <InstitutionDashboard userData={userData} />;
  }

  return (
    <BrowserRouter>
      <div className="min-h-screen bg-gray-50">
        <Navbar userData={userData} />
        <div className="pt-16 pb-20 md:pb-0">
          <Routes>
            <Route path="/" element={<Dashboard userData={userData} notifications={{ permission, requestPermission, subscribeToNotifications }} />} />
            <Route path="/vote" element={<Vote userData={userData} />} />
            <Route path="/historique" element={<Historique userData={userData} />} />
            <Route path="/membres" element={<Membres userData={userData} notifications={{ permission, sendNotification }} />} />
            <Route path="/rapport" element={<RapportMensuel userData={userData} />} />
            <Route path="/appels-fonds" element={<AppelDeFonds userData={userData} />} />
            <Route path="/profil" element={<Profil userData={userData} />} />
            <Route
              path="/nouvelle-transaction"
              element={
                userData?.role === 'tresorier' || userData?.role === 'president'
                  ? <NouvelleTransaction userData={userData} />
                  : <Navigate to="/" replace />
              }
            />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </div>
        <MobileNav userData={userData} />
      </div>
    </BrowserRouter>
  );
}
