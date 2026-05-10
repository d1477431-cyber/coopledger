import { useState, useEffect, useCallback } from 'react';
import { collection, onSnapshot, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';

/**
 * @param {string} titleOrOpts - Titre ou options complètes (voir sendNotification)
 * @param {string} [body]
 * @param {string} [url]
 */
function normalizeNotificationArgs(titleOrOpts, body, url) {
  if (titleOrOpts && typeof titleOrOpts === 'object') {
    const o = titleOrOpts;
    return {
      title: o.title || 'CoopLedger',
      body: o.body || '',
      url: o.data?.url || o.url || '/vote',
      icon: o.icon || '/logo192.png',
      badge: o.badge || '/logo192.png',
      tag: o.tag,
      data: o.data || { url: o.data?.url || '/vote' },
    };
  }
  return {
    title: titleOrOpts || 'CoopLedger',
    body: body || '',
    url: url || '/vote',
    icon: '/logo192.png',
    badge: '/logo192.png',
    tag: undefined,
    data: { url: url || '/vote' },
  };
}

export function useNotifications(userData) {
  const [permission, setPermission] = useState('default');
  const [subscription, setSubscription] = useState(null);

  useEffect(() => {
    if ('Notification' in window) {
      setPermission(Notification.permission);
    }
  }, []);

  const requestPermission = async () => {
    if (!('Notification' in window)) {
      console.warn('Ce navigateur ne supporte pas les notifications');
      return false;
    }

    try {
      const result = await Notification.requestPermission();
      setPermission(result);
      return result === 'granted';
    } catch (error) {
      console.error('Erreur permission notifications:', error);
      return false;
    }
  };

  const subscribeToNotifications = async () => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      console.warn('Push messaging non supporté');
      return false;
    }

    try {
      const registration = await navigator.serviceWorker.ready;
      const existingSubscription = await registration.pushManager.getSubscription();

      if (existingSubscription) {
        setSubscription(existingSubscription);
        return true;
      }

      const vapidPublicKey = process.env.REACT_APP_VAPID_PUBLIC_KEY || '';

      if (!vapidPublicKey) {
        console.warn('REACT_APP_VAPID_PUBLIC_KEY manquant — abonnement push ignoré');
        return false;
      }

      const newSubscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
      });

      setSubscription(newSubscription);

      if (userData?.uid) {
        await addDoc(collection(db, 'push_subscriptions'), {
          userId: userData.uid,
          subscription: JSON.stringify(newSubscription),
          createdAt: serverTimestamp(),
        });
      }

      return true;
    } catch (error) {
      console.error('Erreur abonnement push:', error);
      return false;
    }
  };

  const sendNotification = useCallback(
    async (titleOrOpts, body, url = '/vote') => {
      if (!('Notification' in window)) return;
      const perm = Notification.permission;
      if (perm !== 'granted') {
        console.warn('Permission notifications non accordée');
        return;
      }

      const n = normalizeNotificationArgs(titleOrOpts, body, url);

      try {
        const registration = await navigator.serviceWorker.ready;

        await registration.showNotification(n.title, {
          body: n.body,
          icon: n.icon,
          badge: n.badge,
          vibrate: [200, 100, 200],
          data: n.data,
          tag: n.tag,
          actions: [
            {
              action: 'view',
              title: 'Voir',
              icon: n.icon,
            },
          ],
          requireInteraction: true,
          silent: false,
        });
      } catch (error) {
        console.error('Erreur envoi notification:', error);
      }
    },
    []
  );

  useEffect(() => {
    if (!userData?.uid || permission !== 'granted') return;

    let skipInitialSync = true;
    const unsub = onSnapshot(collection(db, 'votes'), (snapshot) => {
      if (skipInitialSync) {
        skipInitialSync = false;
        return;
      }
      snapshot.docChanges().forEach((change) => {
        if (change.type === 'added') {
          const voteData = change.doc.data();
          const createur =
            voteData.createurUid ?? voteData.createurId ?? voteData.creeParUid;
          if (createur && createur === userData.uid) return;

          sendNotification(
            '🗳️ Nouveau vote requis',
            `${voteData.titre} - ${voteData.montant?.toLocaleString('fr-FR')} FCFA`,
            '/vote'
          );
        }
      });
    });

    return () => unsub();
  }, [userData?.uid, permission, sendNotification]);

  return {
    permission,
    subscription,
    requestPermission,
    subscribeToNotifications,
    sendNotification,
  };
}

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}
