import { collection, addDoc, query, where, getDocs, doc, Timestamp, deleteDoc } from 'firebase/firestore';
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
      loadTime: number;
      firstContentfulPaint: number;
      timeToInteractive: number;
      largestContentfulPaint: number;
      cumulativeLayoutShift: number;
      ttfb: number;
      tbt: number;
      estimatedFid: number;
    };
    seo: {
      score: number;
      title: string;
      metaDescription: string;
    };
    accessibility: {
      score: number;
      imagesWithAltText: number;
      totalImages: number;
      ariaAttributesCount: number;
      keyboardNavigable: boolean;
    };
    lighthouse: {
      performance: number;
      accessibility: number;
      seo: number;
      bestPractices: number;
    };
    security: {
      isHttps: boolean;
      protocol: string;
      securityHeaders: {
        'Strict-Transport-Security': boolean;
        'Content-Security-Policy': boolean;
        'X-Frame-Options': boolean;
        'X-Content-Type-Options': boolean;
        'X-XSS-Protection': boolean;
        'Referrer-Policy': boolean;
      };
      tlsVersion: string;
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
            loadTime: reportData.metrics.performance.loadTime,
            firstContentfulPaint: reportData.metrics.performance.firstContentfulPaint,
            timeToInteractive: reportData.metrics.performance.timeToInteractive,
            largestContentfulPaint: reportData.metrics.performance.largestContentfulPaint,
            cumulativeLayoutShift: reportData.metrics.performance.cumulativeLayoutShift,
            ttfb: reportData.metrics.performance.ttfb,
            tbt: reportData.metrics.performance.tbt,
            estimatedFid: reportData.metrics.performance.estimatedFid,
          },
          seo: {
            score: reportData.metrics.seo.score,
            title: reportData.metrics.seo.title,
            metaDescription: reportData.metrics.seo.metaDescription,
          },
          accessibility: {
            score: reportData.metrics.accessibility.score,
            imagesWithAltText: reportData.metrics.accessibility.imagesWithAltText,
            totalImages: reportData.metrics.accessibility.totalImages,
            ariaAttributesCount: reportData.metrics.accessibility.ariaAttributesCount,
            keyboardNavigable: reportData.metrics.accessibility.keyboardNavigable,
          },
          lighthouse: {
            performance: reportData.metrics.lighthouse.performance,
            accessibility: reportData.metrics.lighthouse.accessibility,
            seo: reportData.metrics.lighthouse.seo,
            bestPractices: reportData.metrics.lighthouse.bestPractices,
          },
          security: {
            isHttps: reportData.metrics.security.isHttps,
            protocol: reportData.metrics.security.protocol,
            securityHeaders: reportData.metrics.security.securityHeaders,
            tlsVersion: reportData.metrics.security.tlsVersion,
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
              largestContentfulPaint: data.essentialMetrics?.performance?.largestContentfulPaint,
              cumulativeLayoutShift: data.essentialMetrics?.performance?.cumulativeLayoutShift,
              ttfb: data.essentialMetrics?.performance?.ttfb,
              tbt: data.essentialMetrics?.performance?.tbt,
              estimatedFid: data.essentialMetrics?.performance?.estimatedFid,
            },
            seo: {
              score: data.essentialMetrics?.seo?.score,
              title: data.essentialMetrics?.seo?.title,
              metaDescription: data.essentialMetrics?.seo?.metaDescription,
            },
            accessibility: {
              score: data.essentialMetrics?.accessibility?.score,
              imagesWithAltText: data.essentialMetrics?.accessibility?.imagesWithAltText,
              totalImages: data.essentialMetrics?.accessibility?.totalImages,
              ariaAttributesCount: data.essentialMetrics?.accessibility?.ariaAttributesCount,
              keyboardNavigable: data.essentialMetrics?.accessibility?.keyboardNavigable,
            },
            lighthouse: {
              performance: data.essentialMetrics?.lighthouse?.performance,
              accessibility: data.essentialMetrics?.lighthouse?.accessibility,
              seo: data.essentialMetrics?.lighthouse?.seo,
              bestPractices: data.essentialMetrics?.lighthouse?.bestPractices,
            },
            security: {
              isHttps: data.essentialMetrics?.security?.isHttps,
              protocol: data.essentialMetrics?.security?.protocol,
              securityHeaders: data.essentialMetrics?.security?.securityHeaders,
              tlsVersion: data.essentialMetrics?.security?.tlsVersion,
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
          performance: {
            ...report.essentialMetrics.performance,
            speedIndex: undefined,
            totalBlockingTime: undefined,
          },
          seo: {
            ...report.essentialMetrics.seo,
            headings: undefined,
            robotsTxt: undefined,
            sitemapXml: undefined,
            canonicalUrl: undefined,
            mobileResponsive: undefined,
          },
          accessibility: {
            ...report.essentialMetrics.accessibility,
            contrastRatio: undefined,
            formLabels: undefined,
          },
          lighthouse: {
            ...report.essentialMetrics.lighthouse,
            pwa: undefined,
          },
          security: {
            ...report.essentialMetrics.security,
            certificateExpiry: undefined,
            mixedContent: undefined,
            vulnerabilities: undefined,
          },
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

  async deleteAllUserReports(userId: string): Promise<void> {
    try {
      // Get all reports for the user
      const userReportsRef = collection(db, 'users', userId, 'reports');
      const querySnapshot = await getDocs(userReportsRef);
      
      // Delete each report document
      const deletePromises = querySnapshot.docs.map(doc => 
        deleteDoc(doc.ref)
      );
      
      await Promise.all(deletePromises);
    } catch (error) {
      console.error('Error deleting user reports:', error);
      throw new Error('Failed to delete user reports');
    }
  }
}

export const reportStorage = new ReportStorageService();