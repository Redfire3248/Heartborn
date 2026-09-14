// Firebase web config (public client keys — safe to ship in the browser;
// access is protected by firestore.rules and database.rules.json).
export const firebaseConfig = {
  apiKey: 'AIzaSyDkKIDPu3jgrClP2OhWdmjJ_gn8NZ_jGo0',
  authDomain: 'hearthborn-47548.firebaseapp.com',
  databaseURL: 'https://hearthborn-47548-default-rtdb.asia-southeast1.firebasedatabase.app',
  projectId: 'hearthborn-47548',
  storageBucket: 'hearthborn-47548.firebasestorage.app',
  messagingSenderId: '613166713233',
  appId: '1:613166713233:web:f7cbe2cc4f37e429c27230',
};

// Admins are not listed in code. Add an account's UID in the Firebase console:
//   Firestore: collection "admins", document id = UID (any field)
//   Realtime Database: admins/<UID> = true
