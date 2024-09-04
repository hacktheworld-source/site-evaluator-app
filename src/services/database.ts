import { db } from './firebase';
import { 
  collection, 
  addDoc, 
  query, 
  where, 
  getDocs, 
  getDoc, 
  setDoc, 
  doc, 
  runTransaction, 
  deleteDoc, 
  writeBatch 
} from 'firebase/firestore';
import { getAuth } from 'firebase/auth';

export interface Evaluation {
  id?: string;  // Make id optional
  userId: string;
  websiteUrl: string;
  overall: number;
  categories: {
    [key: string]: number;
  };
  aiAnalysis: string;
  timestamp: Date;
}

export async function saveEvaluation(evaluation: Omit<Evaluation, 'id'>): Promise<void> {
  try {
    const docRef = await addDoc(collection(db, 'evaluations'), evaluation);
    // If you need the ID, you can get it from docRef.id
  } catch (error) {
    console.error('Error saving evaluation:', error);
    // Store locally if offline
    const offlineEvaluations = JSON.parse(localStorage.getItem('offlineEvaluations') || '[]');
    offlineEvaluations.push(evaluation);
    localStorage.setItem('offlineEvaluations', JSON.stringify(offlineEvaluations));
  }
}

export async function getUserEvaluations(userId: string): Promise<Evaluation[]> {
  const q = query(collection(db, 'evaluations'), where('userId', '==', userId));
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data(),
    timestamp: doc.data().timestamp.toDate()
  } as Evaluation));
}

export async function getUserPoints(userId: string): Promise<number> {
  const userDoc = await getDoc(doc(db, 'users', userId));
  if (!userDoc.exists()) {
    // If the user document doesn't exist, create it with 100 points
    await setDoc(doc(db, 'users', userId), { points: 100 });
    return 100;
  }
  return userDoc.data().points;
}

export async function updateUserPoints(userId: string, points: number): Promise<void> {
  await setDoc(doc(db, 'users', userId), { points }, { merge: true });
}

export async function decrementUserPoints(userId: string): Promise<void> {
  const userRef = doc(db, 'users', userId);
  await runTransaction(db, async (transaction) => {
    const userDoc = await transaction.get(userRef);
    if (!userDoc.exists()) {
      throw "User document does not exist!";
    }
    const newPoints = (userDoc.data().points || 5) - 1;
    if (newPoints < 0) {
      throw "Not enough points!";
    }
    transaction.update(userRef, { points: newPoints });
  });
}

export async function syncOfflineData() {
  const offlineEvaluations = JSON.parse(localStorage.getItem('offlineEvaluations') || '[]');
  if (offlineEvaluations.length > 0) {
    for (const evaluation of offlineEvaluations) {
      try {
        await addDoc(collection(db, 'evaluations'), evaluation);
      } catch (error) {
        console.error('Error syncing offline evaluation:', error);
      }
    }
    localStorage.removeItem('offlineEvaluations');
  }
}

// Call this function when the app comes online
window.addEventListener('online', syncOfflineData);

export async function deleteEvaluation(userId: string, evaluationId: string): Promise<void> {
  const evaluationRef = doc(db, 'evaluations', evaluationId);
  await deleteDoc(evaluationRef);
}

export async function clearAllEvaluations(userId: string): Promise<void> {
  const q = query(collection(db, 'evaluations'), where('userId', '==', userId));
  const querySnapshot = await getDocs(q);
  const batch = writeBatch(db);
  
  querySnapshot.forEach((doc) => {
    batch.delete(doc.ref);
  });

  await batch.commit();
}