import { useEffect, useMemo, useState } from 'react';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';
import { db } from '../firebase';
import { getExplorerTxUrl, isContractConfigured } from '../config/blockchain';

function toTransactionModel(docSnap) {
  const data = docSnap.data();
  const hash = data.hash || null;
  const onChainHash = hash?.startsWith?.('0x') ? hash : null;
  return {
    id: docSnap.id,
    ...data,
    source: data.source || (onChainHash ? 'polygon' : 'firebase'),
    explorerTxHash: onChainHash,
  };
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
    const q = query(collection(db, 'transactions'), orderBy('date', 'desc'));
    const unsub = onSnapshot(
      q,
      (snap) => {
        setTransactions(snap.docs.map(toTransactionModel));
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
    const q = query(collection(db, 'transactions'), orderBy('date', 'desc'));
    const unsub = onSnapshot(
      q,
      (snap) => {
        setTransactions(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
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
    () =>
      transactions
        .filter((t) => t.statut === 'valide')
        .reduce((acc, tx) => {
          const isEntree = tx.type === 'entree' || tx.type === 'revenu';
          return isEntree ? acc + (tx.montant || 0) : acc - (tx.montant || 0);
        }, 0),
    [transactions]
  );

  return { solde, loading };
}

export function useOpenVotes() {
  return { votes: [] };
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
