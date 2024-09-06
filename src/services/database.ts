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
import { EvaluationResult } from './evaluator';
import { getAuth } from 'firebase/auth';
import { compressImage } from '../utils/imageCompression';

export interface Evaluation {
  id?: string;
  userId: string;
  websiteUrl: string;
  loadTime: number;
  domContentLoaded: number;
  firstPaint: number;
  firstContentfulPaint: number;
  domElements: number;
  pageSize: number;
  requests: number;
  timeToInteractive: number;
  largestContentfulPaint: number;
  cumulativeLayoutShift: number;
  colorContrast: {
    lowContrastElements: number;
  };
  fontSizes: {
    [size: string]: number;
  };
  responsiveness: {
    isResponsive: boolean;
    viewportWidth: number;
    pageWidth: number;
  };
  brokenLinks: {
    totalLinks: number;
    brokenLinks: number;
  };
  formFunctionality: {
    totalForms: number;
    formsWithSubmitButton: number;
  };
  htmlContent: string;
  screenshot?: string;
  aiAnalysis: {
    overallScore: number;
    uiAnalysis: string;
    functionalityAnalysis: string;
    recommendations: string[];
  };
  timestamp: Date;
  metrics: {
    loadTime: number;
    domContentLoaded: number;
    firstPaint: number;
    firstContentfulPaint: number;
    timeToInteractive: number;
    largestContentfulPaint: number;
    cumulativeLayoutShift: number;
  };
}

const MAX_SCREENSHOT_SIZE = 900000; // Set to 900KB to allow some buffer

export async function saveEvaluation(evaluation: Omit<Evaluation, 'id'>): Promise<void> {
  try {
    // Create a new object with only defined properties
    const cleanedEvaluation = Object.fromEntries(
      Object.entries(evaluation).filter(([_, v]) => v !== undefined)
    ) as Record<string, any>;

    // Compress the screenshot if it exists and is too large
    if (cleanedEvaluation.screenshot && cleanedEvaluation.screenshot.length * 0.75 > MAX_SCREENSHOT_SIZE) {
      console.log('Screenshot needs further compression before saving.');
      const { compressedImage, quality } = await compressImage(cleanedEvaluation.screenshot, MAX_SCREENSHOT_SIZE);
      
      if (compressedImage.length * 0.75 <= MAX_SCREENSHOT_SIZE) {
        cleanedEvaluation.screenshot = compressedImage;
        console.log(`Screenshot compressed to quality: ${quality.toFixed(2)} before saving.`);
      } else {
        console.warn('Screenshot is still too large. Removing it from the evaluation before saving.');
        delete cleanedEvaluation.screenshot;
      }
    }

    // Final size check
    if (cleanedEvaluation.screenshot && cleanedEvaluation.screenshot.length * 0.75 > MAX_SCREENSHOT_SIZE) {
      console.warn('Screenshot is still too large after compression. Removing it from the evaluation.');
      delete cleanedEvaluation.screenshot;
    }

    const docRef = await addDoc(collection(db, 'evaluations'), cleanedEvaluation);
    console.log('Evaluation saved successfully with ID:', docRef.id);
  } catch (error) {
    console.error('Error saving evaluation:', error);
    // Store locally if offline or if there's an error
    const offlineEvaluations = JSON.parse(localStorage.getItem('offlineEvaluations') || '[]');
    offlineEvaluations.push(evaluation);
    localStorage.setItem('offlineEvaluations', JSON.stringify(offlineEvaluations));
    throw error; // Re-throw the error so it can be handled by the caller
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