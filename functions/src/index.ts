/**
 * Import function triggers from their respective submodules:
 *
 * import {onCall} from "firebase-functions/v2/https";
 * import {onDocumentWritten} from "firebase-functions/v2/firestore";
 *
 * See a full list of supported triggers at https://firebase.google.com/docs/functions
 */
import * as functions from 'firebase-functions/v1';
import { UserRecord } from 'firebase-admin/auth';
import * as admin from 'firebase-admin';

// Start writing functions
// https://firebase.google.com/docs/functions/typescript

// export const helloWorld = onRequest((request, response) => {
//   logger.info("Hello logs!", {structuredData: true});
//   response.send("Hello from Firebase!");
// });

admin.initializeApp();

interface UserData {
  email: string;
  displayName?: string;
  photoURL?: string;
  createdAt: admin.firestore.Timestamp;
  updatedAt: admin.firestore.Timestamp;
  balance: number;
  isPayAsYouGo: boolean;
  hasAddedPayment: boolean;
  totalSpent: number;
}

export const createUserDocument = functions.auth.user().onCreate((user: UserRecord) => {
  if (!user) {
    console.log('No user data available');
    return null;
  }

  const INITIAL_CREDIT = 5.00;  // Initial credits for new users

  const userData: UserData = {
    email: user.email || '',
    displayName: user.displayName || '',
    photoURL: user.photoURL || '',
    createdAt: admin.firestore.Timestamp.now(),
    updatedAt: admin.firestore.Timestamp.now(),
    balance: INITIAL_CREDIT,
    isPayAsYouGo: false,
    hasAddedPayment: false,
    totalSpent: 0
  };

  try {
    return admin.firestore().collection('users').doc(user.uid).set(userData);
  } catch (error) {
    console.error('Error creating user document:', error);
    throw error;
  }
});
