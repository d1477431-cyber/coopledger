import { useState } from 'react';
import { usePolygon } from '../hooks/usePolygon';

export default function WalletConnect() {
  const {
    account,
    isConnected,
    loading,
    error,
    connectWallet,
    disconnectWallet,
    switchToPolygon,
    getBalance
  } = usePolygon();

  const [balance, setBalance] = useState(null);
  const [showBalance, setShowBalance] = useState(false);

  const handleConnect = async () => {
    try {
      await connectWallet();
      // Essayer de switcher vers Polygon après connexion
      await switchToPolygon();
    } catch (err) {
      console.error('Erreur connexion:', err);
    }
  };

  const handleShowBalance = async () => {
    if (account) {
      const bal = await getBalance(account);
      setBalance(bal);
      setShowBalance(true);
    }
  };

  const formatAddress = (addr) => {
    return `${addr.substring(0, 6)}...${addr.substring(addr.length - 4)}`;
  };

  if (isConnected && account) {
    return (
      <div className="bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-xl p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-green-500 rounded-full flex items-center justify-center">
              <span className="text-white text-lg">🔗</span>
            </div>
            <div>
              <p className="font-semibold text-green-800 text-sm">
                Wallet Connecté
              </p>
              <p className="text-xs text-green-600 font-mono">
                {formatAddress(account)}
              </p>
            </div>
          </div>

          <div className="flex gap-2">
            <button
              onClick={handleShowBalance}
              className="text-xs bg-green-600 hover:bg-green-700 text-white px-3 py-1.5 rounded-lg transition"
            >
              💰 Solde
            </button>
            <button
              onClick={disconnectWallet}
              className="text-xs bg-red-500 hover:bg-red-600 text-white px-3 py-1.5 rounded-lg transition"
            >
              Déconnecter
            </button>
          </div>
        </div>

        {showBalance && (
          <div className="mt-3 p-3 bg-white rounded-lg border border-green-200">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Solde MATIC:</span>
              <span className="font-semibold text-green-700">
                {balance ? `${parseFloat(balance).toFixed(4)} MATIC` : 'Chargement...'}
              </span>
            </div>
          </div>
        )}

        <div className="mt-3 flex items-center gap-2">
          <div className="flex items-center gap-1 bg-green-100 text-green-700 px-2 py-1 rounded-full text-xs font-medium">
            <span className="w-2 h-2 bg-green-500 rounded-full"></span>
            Polygon Network
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gradient-to-r from-blue-50 to-purple-50 border border-blue-200 rounded-xl p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center">
            <span className="text-white text-lg">👛</span>
          </div>
          <div>
            <h3 className="font-semibold text-blue-800 text-sm">
              Connecter Wallet
            </h3>
            <p className="text-xs text-blue-600">
              MetaMask requis pour Polygon
            </p>
          </div>
        </div>

        <button
          onClick={handleConnect}
          disabled={loading}
          className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white px-4 py-2 rounded-lg text-sm font-medium transition flex items-center gap-2"
        >
          {loading ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
              Connexion...
            </>
          ) : (
            <>
              🔗 Connecter
            </>
          )}
        </button>
      </div>

      {error && (
        <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-xs text-red-700">{error}</p>
        </div>
      )}

      <div className="mt-3 text-xs text-blue-600">
        <p>🔹 Installez MetaMask si nécessaire</p>
        <p>🔹 Sélectionnez le réseau Polygon</p>
        <p>🔹 Acceptez la connexion</p>
      </div>
    </div>
  );
}