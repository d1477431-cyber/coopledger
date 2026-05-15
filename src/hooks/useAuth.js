import { useState, useEffect } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc, collection, query, where, onSnapshot } from 'firebase/firestore';
import { auth, db } from '../firebase';

export function useAuth() {
  const [user, setUser] = useState(null);
  const [userData, setUserData] = useState(null);
  const [demandeEnAttente, setDemandeEnAttente] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let unsubDemande = null;

    const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
      if (unsubDemande) {
        unsubDemande();
        unsubDemande = null;
      }

      if (firebaseUser) {
        setUser(firebaseUser);
        try {
          const userRef = doc(db, 'users', firebaseUser.uid);
          const userSnap = await getDoc(userRef);
          if (userSnap.exists()) {
            setUserData({ uid: firebaseUser.uid, ...userSnap.data() });
            setDemandeEnAttente(null);
          } else {
            setUserData(null);
            unsubDemande = onSnapshot(
              query(
                collection(db, 'demandes_compte'),
                where('uid', '==', firebaseUser.uid)
              ),
              (snap) => {
                const demandes = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
                const enAttente = demandes.find((d) => d.statut === 'en_attente');
                const validee = demandes.find((d) => d.statut === 'validee');
                const refusee = demandes.find((d) => d.statut === 'refusee');
                if (validee) {
                  getDoc(doc(db, 'users', firebaseUser.uid)).then((s) => {
                    if (s.exists()) {
                      setUserData({ uid: firebaseUser.uid, ...s.data() });
                      setDemandeEnAttente(null);
                    }
                  });
                } else if (refusee) {
                  setDemandeEnAttente((prev) =>
                    prev?.id === refusee.id && prev?.statut === 'refusee'
                      ? prev
                      : { ...refusee, statut: 'refusee' }
                  );
                } else if (enAttente) {
                  setDemandeEnAttente((prev) =>
                    prev?.id === enAttente.id ? prev : enAttente
                  );
                } else {
                  setDemandeEnAttente((prev) => (prev === null ? prev : null));
                }
              }
            );
          }
        } catch (err) {
          console.error('Erreur chargement profil:', err);
          setUserData({
            uid: firebaseUser.uid,
            email: firebaseUser.email,
            nom: firebaseUser.email?.split('@')[0],
            role: 'membre',
          });
        }
      } else {
        setUser(null);
        setUserData(null);
        setDemandeEnAttente(null);
      }
      setLoading(false);
    });

    return () => {
      unsub();
      if (unsubDemande) unsubDemande();
    };
  }, []);

  return { user, userData, demandeEnAttente, loading };
}
