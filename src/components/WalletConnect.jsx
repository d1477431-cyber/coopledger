import { useState, useEffect } from 'react';
import { useWallet } from '../hooks/useWallet';
import { getJsonRpcProvider } from '../config/blockchain';
import { ethers } from 'ethers';
import { getExplorerAddressUrl } from '../config/blockchain';

export default function WalletConnect() {
  const { address, ready, ensureWallet } = useWallet();
  const [balance, setBalance] = useState(null);
  const [showBalance, setShowBalance] = useState(false);

  useEffect(() => {
    if (!address) setBalance(null);
  }, [address]);

  const handleShowBalance = async () => {
    if (address) {
      try {
        const provider = getJsonRpcProvider();
        const bal = await provider.getBalance(address);
        setBalance(ethers.formatEther(bal));
      } catch {
        setBalance(null);
      }
      setShowBalance(true);
    }
  };

  const formatAddr = (addr) =>
    `${addr.substring(0, 6)}...${addr.substring(addr.length - 4)}`;

  if (ready && address) {
    const explorer = getExplorerAddressUrl(address);
    return (
      <div className="bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-xl p-4">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 bg-green-500 rounded-full flex items-center justify-center flex-shrink-0">
              <span className="text-white text-lg">🔗</span>
            </div>
            <div className="min-w-0">
              <p className="font-semibold text-green-800 text-sm">
                Wallet CoopLedger (navigateur)
              </p>
              <p className="text-xs text-green-600 font-mono truncate">
                {formatAddr(address)}
              </p>
              {explorer && (
                <a
                  href={explorer}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-green-700 hover:underline mt-0.5 inline-block"
                >
                  Voir sur Amoy PolygonScan →
                </a>
              )}
            </div>
          </div>

          <div className="flex gap-2 flex-shrink-0">
            <button
              type="button"
              onClick={handleShowBalance}
              className="text-xs bg-green-600 hover:bg-green-700 text-white px-3 py-1.5 rounded-lg transition"
            >
              Solde POL
            </button>
          </div>
        </div>

        {showBalance && (
          <div className="mt-3 p-3 bg-white rounded-lg border border-green-200">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Solde (gas) :</span>
              <span className="font-semibold text-green-700">
                {balance != null
                  ? `${parseFloat(balance).toFixed(4)} POL`
                  : '—'}
              </span>
            </div>
            <p className="text-xs text-gray-500 mt-2">
              Clé stockée localement sur cet appareil — nécessaire pour signer
              les transactions sur Polygon Amoy.
            </p>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="bg-gradient-to-r from-blue-50 to-purple-50 border border-blue-200 rounded-xl p-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center">
            <span className="text-white text-lg">👛</span>
          </div>
          <div>
            <h3 className="font-semibold text-blue-800 text-sm">
              Activer le wallet CoopLedger
            </h3>
            <p className="text-xs text-blue-600">
              Une adresse sera créée pour signer sur Amoy
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => ensureWallet()}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition"
        >
          Générer / charger
        </button>
      </div>
    </div>
  );
}
