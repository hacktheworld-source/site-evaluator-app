import { initializeApp } from 'firebase/app';
import { getAuth, User, deleteUser, EmailAuthProvider, reauthenticateWithCredential } from 'firebase/auth';
import { getFirestore, doc, deleteDoc } from 'firebase/firestore';
import { reportStorage } from './reportStorage';

// Validate environment variables
const requiredEnvVars = [
  'REACT_APP_FIREBASE_API_KEY',
  'REACT_APP_FIREBASE_AUTH_DOMAIN',
  'REACT_APP_FIREBASE_PROJECT_ID',
  'REACT_APP_FIREBASE_STORAGE_BUCKET',
  'REACT_APP_FIREBASE_MESSAGING_SENDER_ID',
  'REACT_APP_FIREBASE_APP_ID'
];

const missingEnvVars = requiredEnvVars.filter(varName => !process.env[varName]);

if (missingEnvVars.length > 0) {
  console.error('Missing required Firebase environment variables:', missingEnvVars);
  throw new Error(`Missing required Firebase environment variables: ${missingEnvVars.join(', ')}`);
}

const firebaseConfig = {
  apiKey: process.env.REACT_APP_FIREBASE_API_KEY,
  authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID,
  storageBucket: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.REACT_APP_FIREBASE_APP_ID,
  measurementId: process.env.REACT_APP_FIREBASE_MEASUREMENT_ID,
};

console.log('Initializing Firebase with config:', {
  ...firebaseConfig,
  apiKey: firebaseConfig.apiKey ? '**********' : undefined // Don't log the actual API key
});

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

// Log auth state changes
auth.onAuthStateChanged((user) => {
  console.log('Auth state changed:', user ? `User ${user.email} signed in` : 'User signed out');
});

export const deleteUserAccount = async (user: User, currentPassword?: string) => {
  try {
    if (currentPassword) {
      // Re-authenticate the user if password is provided
      const credential = EmailAuthProvider.credential(user.email!, currentPassword);
      await reauthenticateWithCredential(user, credential);
    }

    // Delete user document and all subcollections
    const userDocRef = doc(db, 'users', user.uid);
    await deleteDoc(userDocRef);
    
    // Delete the Firebase Auth account
    await deleteUser(user);
    
    return true;
  } catch (error) {
    console.error('Error deleting account:', error);
    throw error;
  }
};