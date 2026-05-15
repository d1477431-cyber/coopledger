import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { getFunctions } from 'firebase/functions';

const firebaseConfig = {
  apiKey: "AIzaSyATAnTfmMu0CI1E9rggP07MxUmEg4VYKKs",
  authDomain: "coopledger-3cf7c.firebaseapp.com",
  projectId: "coopledger-3cf7c",
  storageBucket: "coopledger-3cf7c.firebasestorage.app",
  messagingSenderId: "333403837411",
  appId: "1:333403837411:web:61d8c89f0f00f93ab4c6d6"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);
export const functions = getFunctions(app, 'europe-west1');
