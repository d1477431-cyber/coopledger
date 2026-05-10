import { useState, useEffect } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { auth, db } from '../firebase';

export function useAuth() {
  const [user, setUser] = useState(null);
  const [userData, setUserData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        setUser(firebaseUser);

        try {
          // Chercher le profil dans Firestore
          const userRef = doc(db, 'users', firebaseUser.uid);
          const userSnap = await getDoc(userRef);

          if (userSnap.exists()) {
            // Profil trouvé → on l'utilise
            setUserData({ uid: firebaseUser.uid, ...userSnap.data() });
          } else {
            // Profil pas trouvé → on crée un profil membre par défaut
            const defaultProfile = {
              uid: firebaseUser.uid,
              email: firebaseUser.email,
              nom: firebaseUser.email.split('@')[0],
              role: 'membre',
              cooperativeId: 'broukou',
              dateInscription: new Date(),
              statut: 'actif',
            };
            await setDoc(userRef, defaultProfile);
            setUserData(defaultProfile);
          }
        } catch (err) {
          console.error('Erreur chargement profil:', err);
          // En cas d'erreur, profil minimal
          setUserData({
            uid: firebaseUser.uid,
            email: firebaseUser.email,
            nom: firebaseUser.email.split('@')[0],
            role: 'membre',
          });
        }
      } else {
        setUser(null);
        setUserData(null);
      }
      setLoading(false);
    });
    return () => unsub();
  }, []);

  return { user, userData, loading };
}