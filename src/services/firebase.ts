import { initializeApp } from 'firebase/app';
import { getAuth, setPersistence, browserLocalPersistence } from 'firebase/auth';
import { getFirestore, enableIndexedDbPersistence, FirestoreError } from 'firebase/firestore';
import { firebaseConfig } from '../config/firebase';

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// Set authentication persistence
setPersistence(auth, browserLocalPersistence)
  .then(() => console.log('Auth persistence set to local'))
  .catch((error) => console.error('Error setting auth persistence:', error));

// Wrap the enableIndexedDbPersistence in a try-catch block
enableIndexedDbPersistence(db).catch((err: FirestoreError) => {
  if (err.code === 'failed-precondition') {
    console.warn('Multiple tabs open, persistence can only be enabled in one tab at a time.');
  } else if (err.code === 'unimplemented') {
    console.warn('The current browser does not support all of the features required to enable persistence');
  }
});

export { app, auth, db };