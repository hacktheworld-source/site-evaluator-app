import { initializeApp } from 'firebase/app';
import { getAuth, User, deleteUser } from 'firebase/auth';
import { getFirestore, doc, deleteDoc } from 'firebase/firestore';
import { reportStorage } from './reportStorage';

const firebaseConfig = {
  apiKey: process.env.REACT_APP_FIREBASE_API_KEY,
  authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID,
  storageBucket: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.REACT_APP_FIREBASE_APP_ID,
  measurementId: process.env.REACT_APP_FIREBASE_MEASUREMENT_ID,
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

export const deleteUserAccount = async (user: User) => {
  try {
    // Delete all reports
    await reportStorage.deleteAllUserReports(user.uid);
    
    // Delete user points document
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