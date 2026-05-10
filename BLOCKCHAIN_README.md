# CoopLedger - Intégration Polygon Blockchain

## 🚀 Vue d'ensemble

CoopLedger intègre maintenant la blockchain Polygon pour garantir l'immuabilité et la transparence des transactions financières de la coopérative. Les transactions dépassant certains seuils sont automatiquement enregistrées sur la blockchain.

## 🔧 Configuration requise

### 1. Dépendances installées
```bash
npm install ethers qrcode
```

### 2. Variables d'environnement
Créer un fichier `.env.local` à la racine du projet :
```env
# Firebase (inchangé)
REACT_APP_FIREBASE_API_KEY=your_api_key
REACT_APP_FIREBASE_AUTH_DOMAIN=your_auth_domain
REACT_APP_FIREBASE_PROJECT_ID=your_project_id
REACT_APP_FIREBASE_STORAGE_BUCKET=your_storage_bucket
REACT_APP_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
REACT_APP_FIREBASE_APP_ID=your_app_id

# Notifications Push (optionnel)
REACT_APP_VAPID_PUBLIC_KEY=your_vapid_public_key
REACT_APP_VAPID_PRIVATE_KEY=your_vapid_private_key
```

### 3. MetaMask
Les utilisateurs doivent installer l'extension MetaMask et se connecter au réseau Polygon.

## 🏗️ Architecture blockchain

### Contrat intelligent
- **Adresse**: `0x742d35Cc6634C0532925a3b844Bc454e4438f44e` (testnet - à remplacer en production)
- **Réseau**: Polygon Mainnet
- **ABI**: Défini dans `src/config/polygon.js`

### Fonctionnalités blockchain
- ✅ Création de transactions sur la blockchain
- ✅ Génération de QR codes pour Polygonscan
- ✅ Vérification d'immuabilité
- ✅ Historique transparent et vérifiable

## 🔐 Seuils de vote blockchain

| Montant (FCFA) | Action |
|---|---|
| < 500,000 | Transaction Firebase uniquement |
| ≥ 500,000 | Transaction Firebase + Vote requis |
| ≥ 500,000 + Wallet connecté | Transaction Firebase + Vote + Blockchain |

## 📱 Interface utilisateur

### Composants ajoutés
- `WalletConnect`: Connexion MetaMask et gestion wallet
- `BlockchainInfo`: Affichage des détails blockchain avec QR code

### Pages modifiées
- `Dashboard`: Ajout du connecteur wallet
- `NouvelleTransaction`: Intégration blockchain automatique
- `Historique`: Affichage des informations blockchain

## 🚀 Déploiement

### 1. Build de production
```bash
npm run build
```

### 2. Déploiement Firebase
```bash
firebase deploy
```

### 3. Configuration du contrat (Production)
1. Déployer le contrat intelligent sur Polygon Mainnet
2. Mettre à jour `POLYGON_CONFIG.CONTRACTS.COOPERATIVE` dans `src/config/polygon.js`
3. Rebuild et redéployer

## 🧪 Test de l'intégration

### Test local
1. Démarrer l'application : `npm start`
2. Se connecter avec un compte Firebase
3. Cliquer sur "Activer Notifications" (optionnel)
4. Cliquer sur "Connecter" dans la section Wallet
5. Accepter la connexion MetaMask
6. Basculer sur le réseau Polygon si demandé
7. Créer une transaction > 500,000 FCFA
8. Vérifier que la transaction apparaît dans l'historique avec les détails blockchain

### Test blockchain
- Vérifier le hash de transaction sur Polygonscan
- Scanner le QR code pour accéder directement à la transaction
- Confirmer l'immuabilité des données

## 🔧 Dépannage

### Erreur "MetaMask non installé"
- Installer l'extension MetaMask
- Actualiser la page

### Erreur "Réseau Polygon non détecté"
- Dans MetaMask, ajouter le réseau Polygon :
  - Network Name: Polygon Mainnet
  - RPC URL: https://polygon-rpc.com/
  - Chain ID: 137
  - Symbol: MATIC

### Erreur "Contrat non trouvé"
- Vérifier que l'adresse du contrat est correcte
- S'assurer que le contrat est déployé sur Polygon Mainnet

### Transaction blockchain échoue
- Vérifier le solde MATIC suffisant
- Vérifier que le réseau Polygon est sélectionné
- Vérifier les frais de gas

## 📊 Métriques blockchain

L'application enregistre automatiquement :
- Hash de transaction
- Numéro de bloc
- Gas utilisé
- Timestamp
- URL Polygonscan

## 🔮 Évolutions futures

- Vote décentralisé directement sur blockchain
- Token de gouvernance pour les membres
- Intégration d'oracles pour les prix
- Multi-signature pour les grandes transactions
- Audit automatique des transactions

## 📞 Support

Pour toute question concernant l'intégration blockchain :
- Vérifier les logs de la console du navigateur
- Tester avec un petit montant d'abord
- Contacter l'équipe de développement

---

**⚠️ Important**: Cette intégration utilise actuellement une adresse de contrat de test. Pour la production, déployez votre propre contrat intelligent et mettez à jour la configuration.