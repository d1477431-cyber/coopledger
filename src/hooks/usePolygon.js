import { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import { POLYGON_CONFIG, COOPERATIVE_ABI, getPolygonscanUrl } from '../config/polygon';

const POLYGONSCAN_URL = "https://api.polygonscan.com";

export function usePolygon() {
  const [provider, setProvider] = useState(null);
  const [signer, setSigner] = useState(null);
  const [contract, setContract] = useState(null);
  const [account, setAccount] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Initialisation du provider Polygon
  useEffect(() => {
    const initPolygon = async () => {
      try {
        // Créer un provider pour Polygon
        const polygonProvider = new ethers.JsonRpcProvider(POLYGON_CONFIG.RPC_URL);
        setProvider(polygonProvider);

        // Vérifier la connexion au réseau
        const network = await polygonProvider.getNetwork();
        if (network.chainId !== POLYGON_CONFIG.CHAIN_ID) {
          throw new Error('Réseau Polygon non détecté');
        }

        // Initialiser le contrat
        const cooperativeContract = new ethers.Contract(
          POLYGON_CONFIG.CONTRACTS.COOPERATIVE,
          COOPERATIVE_ABI,
          polygonProvider
        );
        setContract(cooperativeContract);

      } catch (err) {
        console.error('Erreur d\'initialisation Polygon:', err);
        setError(err.message);
      }
    };

    initPolygon();
  }, []);

  // Connexion au wallet MetaMask
  const connectWallet = async () => {
    try {
      setLoading(true);
      setError(null);

      if (!window.ethereum) {
        throw new Error('MetaMask n\'est pas installé');
      }

      // Demander l'accès au compte
      const accounts = await window.ethereum.request({
        method: 'eth_requestAccounts'
      });

      const userAccount = accounts[0];
      setAccount(userAccount);

      // Créer un signer
      const web3Provider = new ethers.BrowserProvider(window.ethereum);
      const web3Signer = await web3Provider.getSigner();
      setSigner(web3Signer);

      // Mettre à jour le contrat avec le signer
      const contractWithSigner = new ethers.Contract(
        POLYGON_CONFIG.CONTRACTS.COOPERATIVE,
        COOPERATIVE_ABI,
        web3Signer
      );
      setContract(contractWithSigner);

      setIsConnected(true);

      // Écouter les changements de compte
      window.ethereum.on('accountsChanged', (newAccounts) => {
        if (newAccounts.length > 0) {
          setAccount(newAccounts[0]);
        } else {
          disconnectWallet();
        }
      });

      // Écouter les changements de réseau
      window.ethereum.on('chainChanged', (chainId) => {
        if (parseInt(chainId) !== POLYGON_CONFIG.CHAIN_ID) {
          setError('Veuillez vous connecter au réseau Polygon');
          disconnectWallet();
        }
      });

    } catch (err) {
      console.error('Erreur de connexion wallet:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Déconnexion du wallet
  const disconnectWallet = () => {
    setAccount(null);
    setSigner(null);
    setContract(null);
    setIsConnected(false);
    setError(null);
  };

  // Créer une transaction sur la blockchain
  const createBlockchainTransaction = async (amount, description) => {
    try {
      if (!contract || !isConnected) {
        throw new Error('Wallet non connecté');
      }

      setLoading(true);
      setError(null);

      // Convertir le montant en wei (Polygon utilise 18 décimales)
      const amountInWei = ethers.parseEther(amount.toString());

      // Créer la transaction
      const tx = await contract.createTransaction(amountInWei, description);
      console.log('Transaction créée:', tx.hash);

      // Attendre la confirmation
      const receipt = await tx.wait();
      console.log('Transaction confirmée:', receipt);

      return {
        hash: tx.hash,
        blockNumber: receipt.blockNumber,
        gasUsed: receipt.gasUsed.toString(),
        polygonscanUrl: getPolygonscanUrl('tx', tx.hash)
      };

    } catch (err) {
      console.error('Erreur création transaction:', err);
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  // Générer un QR code pour une transaction
  const generateQRCode = async (transactionHash) => {
    try {
      const QRCode = require('qrcode');
      const polygonscanUrl = `${POLYGONSCAN_URL}/tx/${transactionHash}`;

      // Générer le QR code en base64
      const qrCodeDataURL = await QRCode.toDataURL(polygonscanUrl, {
        width: 256,
        margin: 2,
        color: {
          dark: '#000000',
          light: '#FFFFFF'
        }
      });

      return qrCodeDataURL;
    } catch (err) {
      console.error('Erreur génération QR code:', err);
      return null;
    }
  };

  // Vérifier le solde MATIC
  const getBalance = async (address) => {
    try {
      if (!provider) return null;

      const balance = await provider.getBalance(address);
      return ethers.formatEther(balance);
    } catch (err) {
      console.error('Erreur récupération solde:', err);
      return null;
    }
  };

  // Switch vers le réseau Polygon si nécessaire
  const switchToPolygon = async () => {
    try {
      if (!window.ethereum) {
        throw new Error('MetaMask n\'est pas installé');
      }

      await window.ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: `0x${POLYGON_CONFIG.CHAIN_ID.toString(16)}` }],
      });
    } catch (switchError) {
      // Si le réseau n'existe pas, l'ajouter
      if (switchError.code === 4902) {
        try {
          await window.ethereum.request({
            method: 'wallet_addEthereumChain',
            params: [{
              chainId: `0x${POLYGON_CONFIG.CHAIN_ID.toString(16)}`,
              chainName: POLYGON_CONFIG.CHAIN_NAME,
              nativeCurrency: POLYGON_CONFIG.NATIVE_CURRENCY,
              rpcUrls: [POLYGON_CONFIG.RPC_URL],
              blockExplorerUrls: [POLYGON_CONFIG.BLOCK_EXPLORER_URL],
            }],
          });
        } catch (addError) {
          throw new Error('Impossible d\'ajouter le réseau Polygon');
        }
      } else {
        throw switchError;
      }
    }
  };

  return {
    // État
    provider,
    signer,
    contract,
    account,
    isConnected,
    loading,
    error,

    // Actions
    connectWallet,
    disconnectWallet,
    createBlockchainTransaction,
    generateQRCode,
    getBalance,
    switchToPolygon,

    // Constantes
    POLYGONSCAN_URL: POLYGON_CONFIG.BLOCK_EXPLORER_URL,
    COOPERATIVE_CONTRACT_ADDRESS: POLYGON_CONFIG.CONTRACTS.COOPERATIVE
  };
}