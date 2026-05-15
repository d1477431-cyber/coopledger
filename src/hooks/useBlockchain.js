import { useEffect, useMemo, useState } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { getExplorerTxUrl, isContractConfigured } from '../config/blockchain';
import { toDate, calculerFinances } from '../utils/calculsFinanciers';

function mapTransactionDoc(docSnap) {
  const raw = docSnap.data();
  const date = toDate(raw.date) || toDate(raw.createdAt) || new Date(0);
  const hash = raw.hash || null;
  const onChainHash = hash?.startsWith?.('0x') ? hash : null;
  return {
    id: docSnap.id,
    ...raw,
    date,
    source: raw.source || (onChainHash ? 'polygon' : 'firebase'),
    explorerTxHash: onChainHash,
  };
}

function sortByDateDesc(items) {
  return [...items].sort((a, b) => {
    const da = toDate(a.date) || new Date(0);
    const db = toDate(b.date) || new Date(0);
    return db - da;
  });
}

export function rememberVoteCast(transactionId, address, choix) {
  if (!transactionId || !address || !choix) return;
  localStorage.setItem(`coopledger_vote_${transactionId}_${address}`, choix);
}

export function getStoredVoteChoice(transactionId, address) {
  if (!transactionId || !address) return null;
  const value = localStorage.getItem(`coopledger_vote_${transactionId}_${address}`);
  return value === 'oui' || value === 'non' ? value : null;
}

export function useTransactions({ firebaseFallback = true } = {}) {
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onSnapshot(
      collection(db, 'transactions'),
      (snap) => {
        setTransactions(sortByDateDesc(snap.docs.map(mapTransactionDoc)));
        setLoading(false);
      },
      () => {
        setTransactions([]);
        setLoading(false);
      }
    );
    return () => unsub();
  }, []);

  return {
    transactions,
    loading,
    source: 'firebase',
    demoMode: !isContractConfigured(),
    cachedNotice: firebaseFallback
      ? 'Mode Firebase actif (fallback) : données en temps réel disponibles.'
      : null,
  };
}

export function useSolde() {
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onSnapshot(
      collection(db, 'transactions'),
      (snap) => {
        setTransactions(sortByDateDesc(snap.docs.map(mapTransactionDoc)));
        setLoading(false);
      },
      () => {
        setTransactions([]);
        setLoading(false);
      }
    );
    return () => unsub();
  }, []);

  const solde = useMemo(
    () => calculerFinances(transactions).solde,
    [transactions]
  );

  return { solde, loading };
}

/** Référence stable — évite les boucles infinies dans les useEffect ([votesChain]). */
const EMPTY_OPEN_VOTES = [];

export function useOpenVotes() {
  return { votes: EMPTY_OPEN_VOTES };
}

export function useBlockchainWrite() {
  const [pending, setPending] = useState(false);

  const createTransaction = async (titre, montant, type, categorie) => {
    setPending(true);
    try {
      if (!isContractConfigured()) {
        throw new Error(
          'Blockchain en cours de déploiement - Mode démonstration actif'
        );
      }
      const fakeHash = `0x${Date.now().toString(16)}${Math.random()
        .toString(16)
        .slice(2, 18)}`;
      return {
        hash: fakeHash,
        explorerUrl: getExplorerTxUrl(fakeHash),
        transactionId: null,
        titre,
        montant,
        type,
        categorie,
      };
    } finally {
      setPending(false);
    }
  };

  const vote = async (transactionId, choix) => {
    setPending(true);
    try {
      if (!isContractConfigured()) {
        throw new Error(
          'Blockchain en cours de déploiement - Mode démonstration actif'
        );
      }
      const fakeHash = `0x${Date.now().toString(16)}${Math.random()
        .toString(16)
        .slice(2, 18)}`;
      return { hash: fakeHash, transactionId, choix };
    } finally {
      setPending(false);
    }
  };

  return { createTransaction, vote, pending };
}
