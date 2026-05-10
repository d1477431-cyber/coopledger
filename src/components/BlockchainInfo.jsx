import { useState, useEffect, useCallback } from 'react';
import { usePolygon } from '../hooks/usePolygon';
import { getExplorerTxUrl } from '../config/blockchain';

export default function BlockchainInfo({ transaction }) {
  const { generateQRCode } = usePolygon();
  const [qrCode, setQrCode] = useState(null);
  const [loading, setLoading] = useState(false);

  const generateQR = useCallback(async () => {
    if (!transaction?.hash) return;
    setLoading(true);
    try {
      const qr = await generateQRCode(transaction.hash);
      setQrCode(qr);
    } catch (error) {
      console.error('Erreur génération QR:', error);
    } finally {
      setLoading(false);
    }
  }, [generateQRCode, transaction]);

  useEffect(() => {
    if (transaction?.hash && transaction.hash.startsWith('0x')) {
      generateQR();
    }
  }, [transaction, generateQR]);

  if (!transaction?.hash || !transaction.hash.startsWith('0x')) {
    return null;
  }

  const polygonscanUrl =
    getExplorerTxUrl(transaction.hash) ||
    `https://polygonscan.com/tx/${transaction.hash}`;

  return (
    <div className="bg-gradient-to-r from-purple-50 to-blue-50 border border-purple-200 rounded-xl p-4 mt-4">
      <div className="flex items-center gap-3 mb-3">
        <div className="w-8 h-8 bg-purple-500 rounded-lg flex items-center justify-center">
          <span className="text-white text-sm font-bold">⛓️</span>
        </div>
        <div>
          <h3 className="font-semibold text-purple-800 text-sm">
            Transaction Blockchain
          </h3>
          <p className="text-xs text-purple-600">
            Enregistrée sur Polygon Network
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Informations de la transaction */}
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <span className="text-xs text-gray-600">Hash:</span>
            <code className="text-xs bg-white px-2 py-1 rounded font-mono text-purple-700">
              {transaction.hash.substring(0, 10)}...{transaction.hash.substring(transaction.hash.length - 8)}
            </code>
          </div>

          {transaction.blockNumber && (
            <div className="flex justify-between items-center">
              <span className="text-xs text-gray-600">Bloc:</span>
              <span className="text-xs font-medium text-purple-700">
                #{transaction.blockNumber.toLocaleString('fr-FR')}
              </span>
            </div>
          )}

          {transaction.gasUsed && (
            <div className="flex justify-between items-center">
              <span className="text-xs text-gray-600">Gas utilisé:</span>
              <span className="text-xs font-medium text-purple-700">
                {parseInt(transaction.gasUsed).toLocaleString('fr-FR')}
              </span>
            </div>
          )}

          <div className="pt-2">
            <a
              href={polygonscanUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-xs bg-purple-600 hover:bg-purple-700 text-white px-3 py-2 rounded-lg transition font-medium"
            >
              🔍 Voir sur PolygonScan
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
            </a>
          </div>
        </div>

        {/* QR Code */}
        <div className="flex flex-col items-center">
          <p className="text-xs text-gray-600 mb-2">Scanner pour voir la transaction</p>
          {loading ? (
            <div className="w-24 h-24 bg-gray-100 rounded-lg flex items-center justify-center">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-purple-600"></div>
            </div>
          ) : qrCode ? (
            <img
              src={qrCode}
              alt="QR Code transaction Polygon"
              className="w-24 h-24 rounded-lg border border-purple-200"
            />
          ) : (
            <div className="w-24 h-24 bg-gray-100 rounded-lg flex items-center justify-center">
              <span className="text-xs text-gray-400">QR indisponible</span>
            </div>
          )}
        </div>
      </div>

      {/* Badge de vérification */}
      <div className="mt-3 flex items-center gap-2">
        <div className="flex items-center gap-1 bg-green-100 text-green-700 px-2 py-1 rounded-full text-xs font-medium">
          <span className="w-2 h-2 bg-green-500 rounded-full"></span>
          Vérifié sur Blockchain
        </div>
        <div className="flex items-center gap-1 bg-blue-100 text-blue-700 px-2 py-1 rounded-full text-xs font-medium">
          <span>🔒</span>
          Immuable
        </div>
      </div>
    </div>
  );
}