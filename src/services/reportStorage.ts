import { collection, addDoc, query, where, getDocs, doc, Timestamp } from 'firebase/firestore';
import { db } from './firebase';
import { ReportData, reportGenerator } from './reportGenerator';
import { saveAs } from 'file-saver';

export interface StoredReport {
  id: string;
  websiteUrl: string;
  timestamp: Date;
  overallScore: number;
  phaseScores: { [phase: string]: number };
  essentialMetrics: {
    performance: {
      loadTime?: number;
      firstContentfulPaint?: number;
      timeToInteractive?: number;
    };
    seo: {
      score?: number;
    };
    accessibility: {
      score?: number;
    };
    bestPractices?: {
      score?: number;
    };
  };
}

class ReportStorageService {
  async saveReport(userId: string, reportData: ReportData): Promise<string> {
    try {
      const storedData = {
        websiteUrl: reportData.websiteUrl,
        timestamp: Timestamp.fromDate(reportData.timestamp),
        overallScore: reportData.overallScore,
        phaseScores: reportData.phaseScores,
        essentialMetrics: {
          performance: {
            loadTime: reportData.metrics?.performance?.loadTime,
            firstContentfulPaint: reportData.metrics?.performance?.firstContentfulPaint,
            timeToInteractive: reportData.metrics?.performance?.timeToInteractive,
          },
          seo: {
            score: reportData.metrics?.seo?.score,
          },
          accessibility: {
            score: reportData.metrics?.accessibility?.score,
          },
          bestPractices: {
            score: reportData.metrics?.lighthouse?.bestPractices,
          },
        },
        createdAt: Timestamp.fromDate(new Date())
      };

      // Create a reference to the user's reports subcollection
      const userReportsRef = collection(db, 'users', userId, 'reports');
      const reportRef = await addDoc(userReportsRef, storedData);
      return reportRef.id;
    } catch (error) {
      console.error('Error saving report:', error);
      throw new Error('Failed to save report');
    }
  }

  async getUserReports(userId: string): Promise<StoredReport[]> {
    try {
      // Get reports from the user's subcollection
      const userReportsRef = collection(db, 'users', userId, 'reports');
      const querySnapshot = await getDocs(userReportsRef);
      
      return querySnapshot.docs.map(doc => {
        const data = doc.data();
        // Ensure all required fields are present and properly typed
        const report: StoredReport = {
          id: doc.id,
          websiteUrl: data.websiteUrl,
          timestamp: data.timestamp?.toDate() || new Date(),
          overallScore: data.overallScore,
          phaseScores: data.phaseScores || {},
          essentialMetrics: {
            performance: {
              loadTime: data.essentialMetrics?.performance?.loadTime,
              firstContentfulPaint: data.essentialMetrics?.performance?.firstContentfulPaint,
              timeToInteractive: data.essentialMetrics?.performance?.timeToInteractive,
            },
            seo: {
              score: data.essentialMetrics?.seo?.score,
            },
            accessibility: {
              score: data.essentialMetrics?.accessibility?.score,
            },
            bestPractices: {
              score: data.essentialMetrics?.bestPractices?.score,
            },
          },
        };
        return report;
      });
    } catch (error) {
      console.error('Error fetching user reports:', error);
      throw new Error('Failed to fetch reports');
    }
  }

  async regenerateAndDownloadReport(report: StoredReport): Promise<void> {
    try {
      const reportData: ReportData = {
        websiteUrl: report.websiteUrl,
        timestamp: report.timestamp,
        overallScore: report.overallScore,
        phaseScores: report.phaseScores,
        metrics: {
          ...report.essentialMetrics,
          lighthouse: {
            bestPractices: report.essentialMetrics.bestPractices?.score
          }
        }
      };

      const pdfBuffer = await reportGenerator.generatePDF(reportData);
      const blob = new Blob([pdfBuffer], { type: 'application/pdf' });
      saveAs(blob, `${report.websiteUrl.replace(/[^a-z0-9]/gi, '_')}_report.pdf`);
    } catch (error) {
      console.error('Error regenerating report:', error);
      throw new Error('Failed to regenerate report');
    }
  }
}

export const reportStorage = new ReportStorageService();