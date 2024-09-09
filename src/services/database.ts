import { db } from './firebase';
import { doc, getDoc, setDoc, runTransaction } from 'firebase/firestore';

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

// Remove all other functions related to evaluations