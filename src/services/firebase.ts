import { initializeApp } from 'firebase/app';
import { getAuth, setPersistence, browserLocalPersistence } from 'firebase/auth';
import { initializeFirestore } from 'firebase/firestore';
import { firebaseConfig } from '../config/firebase';

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firestore with new settings
const db = initializeFirestore(app, {
  cacheSizeBytes: 50 * 1024 * 1024, // 50 MB cache size
  experimentalForceLongPolling: true,
});

// Initialize Auth
const auth = getAuth(app);

// Set authentication persistence
setPersistence(auth, browserLocalPersistence)
  .then(() => console.log('Auth persistence set to local'))
  .catch((error) => console.error('Error setting auth persistence:', error));

export { app, auth, db };