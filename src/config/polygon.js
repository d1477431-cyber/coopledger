// Configuration CoopLedger - Polygon Blockchain Integration

import { ethers } from 'ethers';

export const POLYGON_CONFIG = {
  RPC_URL: 'https://rpc-amoy.polygon.technology',
  CHAIN_ID: 80002,
  CHAIN_NAME: 'Polygon Amoy Testnet',
  BLOCK_EXPLORER_URL: 'https://amoy.polygonscan.com/',
  NATIVE_CURRENCY: {
    name: 'MATIC',
    symbol: 'MATIC',
    decimals: 18,
  },

  CONTRACTS: {
    COOPERATIVE: '0x8B1625f1e4EE935951C6ff451c70E8DEd378877a',
    GOVERNANCE: '0x0000000000000000000000000000000000000000',
  },

  VOTING_THRESHOLDS: {
    MIN_AMOUNT: 500000,
    URGENT_AMOUNT: 1000000,
  },

  VOTING_CONFIG: {
    DURATION_MINUTES: 30,
    QUORUM_PERCENTAGE: 60,
    TOTAL_MEMBERS: 45,
  },

  NOTIFICATIONS: {
    VAPID_PUBLIC_KEY: process.env.REACT_APP_VAPID_PUBLIC_KEY || '',
  },
};

// ABI du contrat de coopérative (version simplifiée)
export const COOPERATIVE_ABI = [
  // Événements
  "event TransactionCreated(uint256 indexed transactionId, address indexed creator, uint256 amount, string description)",
  "event TransactionApproved(uint256 indexed transactionId, address indexed approver)",
  "event TransactionExecuted(uint256 indexed transactionId)",
  "event VoteCast(uint256 indexed transactionId, address indexed voter, bool approve)",

  // Fonctions de lecture
  "function getTransaction(uint256 transactionId) external view returns (uint256 amount, string memory description, address creator, bool executed, uint256 approvals, uint256 disapprovals)",
  "function getTransactionCount() external view returns (uint256)",
  "function quorumRequired() external view returns (uint256)",
  "function totalMembers() external view returns (uint256)",

  // Fonctions d'écriture
  "function createTransaction(uint256 amount, string calldata description) external returns (uint256)",
  "function approveTransaction(uint256 transactionId) external",
  "function disapproveTransaction(uint256 transactionId) external",
  "function executeTransaction(uint256 transactionId) external",

  // Fonctions d'administration
  "function addMember(address member) external",
  "function removeMember(address member) external",
  "function setQuorum(uint256 newQuorum) external",
];

// Fonctions utilitaires
export const formatAddress = (address) => {
  if (!address) return '';
  return `${address.substring(0, 6)}...${address.substring(address.length - 4)}`;
};

export const formatAmount = (amount, decimals = 18) => {
  if (!amount) return '0';
  return ethers.formatUnits(amount, decimals);
};

export const parseAmount = (amount, decimals = 18) => {
  if (!amount) return 0n;
  return ethers.parseUnits(amount.toString(), decimals);
};

// URLs des explorateurs
export const getPolygonscanUrl = (type, value) => {
  const baseUrl = POLYGON_CONFIG.BLOCK_EXPLORER_URL;
  switch (type) {
    case 'tx':
      return `${baseUrl}tx/${value}`;
    case 'address':
      return `${baseUrl}address/${value}`;
    case 'block':
      return `${baseUrl}block/${value}`;
    default:
      return baseUrl;
  }
};

// Vérification de la configuration
export const validateConfig = () => {
  const required = ['RPC_URL', 'CHAIN_ID', 'CONTRACTS.COOPERATIVE'];
  const missing = required.filter(key => {
    const keys = key.split('.');
    let value = POLYGON_CONFIG;
    for (const k of keys) {
      value = value?.[k];
    }
    return !value;
  });

  if (missing.length > 0) {
    console.warn('Configuration manquante:', missing);
    return false;
  }

  return true;
};