import { useMemo } from 'react';
import { ethers } from 'ethers';

const STORAGE_KEY = 'coopledger_wallet_private_key';

export function generateWallet() {
  const wallet = ethers.Wallet.createRandom();
  localStorage.setItem(STORAGE_KEY, wallet.privateKey);
  return wallet;
}

export function getWallet() {
  const privateKey = localStorage.getItem(STORAGE_KEY);
  if (!privateKey) return null;
  try {
    return new ethers.Wallet(privateKey);
  } catch {
    return null;
  }
}

export function getAddress() {
  return getWallet()?.address || null;
}

export async function signTransaction(data) {
  const wallet = getWallet();
  if (!wallet) throw new Error('Aucun wallet local trouvé.');
  const payload = typeof data === 'string' ? data : JSON.stringify(data);
  return wallet.signMessage(payload);
}

export function useWallet() {
  const wallet = useMemo(() => getWallet(), []);
  const address = wallet?.address || null;

  const ensureWallet = () => {
    const existing = getWallet();
    if (existing) return existing;
    return generateWallet();
  };

  return {
    ready: !!address,
    address,
    ensureWallet,
    generateWallet,
    getWallet,
    getAddress,
    signTransaction,
  };
}
