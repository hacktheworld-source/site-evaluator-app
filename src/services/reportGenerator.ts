import { TDocumentDefinitions, Content, ContentText } from 'pdfmake/interfaces';
import axios from 'axios';
import pdfMake from 'pdfmake/build/pdfmake';
import { saveAs } from 'file-saver';
import { auth } from './firebase';
import { reportStorage } from './reportStorage';

export interface ReportData {
  websiteUrl: string;
  timestamp: Date;
  overallScore: number;
  phaseScores: { [phase: string]: number };
  professionalAnalysis?: ReportResponse;
  metrics: {
    performance: {
      loadTime: number;
      firstContentfulPaint: number;
      timeToInteractive: number;
      largestContentfulPaint: number;
      cumulativeLayoutShift: number;
      ttfb: number;
      tbt: number;
      estimatedFid: number;
      speedIndex?: number;
      totalBlockingTime?: number;
    };
    seo: {
      score: number;
      title: string;
      metaDescription: string;
      headings?: {
        h1Count: number;
        h2Count: number;
        h3Count: number;
      };
      robotsTxt?: boolean;
      sitemapXml?: boolean;
      canonicalUrl?: string;
      mobileResponsive?: boolean;
    };
    accessibility: {
      score: number;
      imagesWithAltText: number;
      totalImages: number;
      ariaAttributesCount: number;
      keyboardNavigable: boolean;
      contrastRatio?: {
        pass: number;
        fail: number;
      };
      formLabels?: {
        labeled: number;
        total: number;
      };
    };
    lighthouse: {
      performance: number;
      accessibility: number;
      seo: number;
      bestPractices: number;
      pwa?: number;
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
      certificateExpiry?: Date;
      mixedContent?: boolean;
      vulnerabilities?: {
        severity: string;
        count: number;
      }[];
    };
    formFunctionality: {
      totalForms: number;
      formsWithSubmitButton: number;
      interactiveElementsCount: number;
      inputFieldsCount: number;
      javascriptEnabled: boolean;
    };
    brokenLinks: {
      totalLinks: number;
      brokenLinks: number;
    };
    responsiveness: {
      isResponsive: boolean;
      viewportWidth: number;
      pageWidth: number;
    };
    bestPractices: {
      semanticUsage: { [key: string]: number };
      optimizedImages: number;
      totalImages: number;
    };
  };
}

export interface ReportResponse {
  executiveSummary: {
    keyStrengths: string[];
    criticalIssues: string[];
    overallAssessment: string;
    coreWebVitalsAssessment: string;
  };
  technicalAnalysis: {
    performance: {
      insights: string[];
      recommendations: string[];
      coreWebVitals: {
        assessment: string;
        details: string[];
      };
    };
    accessibility: {
      insights: string[];
      recommendations: string[];
      complianceLevel: string;
      keyIssues: string[];
    };
    seo: {
      insights: string[];
      recommendations: string[];
      metaTagAnalysis: string[];
      structureAnalysis: string[];
    };
    bestPractices: {
      insights: string[];
      recommendations: string[];
      securityAssessment: string[];
      semanticAnalysis: string[];
    };
  };
  recommendations: {
    critical: string[];
    important: string[];
    optional: string[];
  };
}

interface Vulnerability {
  severity: string;
  count: number;
}

class ReportGenerator {
  private async loadPdfMake() {
    const pdfFonts = await import('pdfmake/build/vfs_fonts');
    const pdfMakeLib = pdfMake.default || pdfMake;
    pdfMakeLib.vfs = pdfFonts.pdfMake.vfs;
    return pdfMakeLib;
  }

  private createPerformanceChart(metrics: any) {
    // Create performance metrics visualization
    const webVitals = [
      { name: 'FCP', value: metrics.firstContentfulPaint, threshold: 1800, unit: 'ms' },
      { name: 'LCP', value: metrics.largestContentfulPaint, threshold: 2500, unit: 'ms' },
      { name: 'CLS', value: metrics.cumulativeLayoutShift, threshold: 0.1, unit: '' },
      { name: 'TTFB', value: metrics.ttfb, threshold: 600, unit: 'ms' },
      { name: 'TTI', value: metrics.timeToInteractive, threshold: 3800, unit: 'ms' }
    ];

    return webVitals.map(metric => ({
      ...metric,
      value: typeof metric.value === 'number' ? 
        metric.name === 'CLS' ? Number(metric.value.toFixed(3)) : Number(metric.value.toFixed(1)) : 'N/A',
      displayValue: typeof metric.value === 'number' ? 
        `${metric.name === 'CLS' ? Number(metric.value.toFixed(3)) : Number(metric.value.toFixed(1))}${metric.unit}` : 'N/A',
      status: !metric.value || metric.value === 'N/A' ? 'N/A' :
        metric.value <= metric.threshold ? 'Good' : 'Needs Improvement'
    }));
  }

  private createSecurityTable(security: any) {
    if (!security) {
      return {
        headers: ['Security Feature', 'Status'],
        rows: [['Security Data', 'Not Available']]
      };
    }

    const getStatus = (present: boolean) => present ? 'Present' : 'Missing';
    const headers = ['Security Feature', 'Status'];
    const rows = [
      ['HTTPS', security?.isHttps ? 'Present' : 'Missing'],
      ['Protocol', security?.protocol || 'Not Available'],
      ['TLS Version', security?.tlsVersion ? security.tlsVersion.toUpperCase() : 'Unknown'],
    ];

    if (security?.securityHeaders) {
      Object.entries(security.securityHeaders).forEach(([header, present]) => {
        rows.push([header, getStatus(present as boolean)]);
      });
    }

    return { headers, rows };
  }

  private createAccessibilityScorecard(metrics: any) {
    const altTextRatio = metrics.imagesWithAltText && metrics.totalImages ? 
      (metrics.imagesWithAltText / metrics.totalImages) : 0;
    const altTextScore = metrics.totalImages === 0 ? 'N/A' : 
      `${(altTextRatio * 100).toFixed(1)}%`;
    const lighthouseScore = metrics.score ? `${Math.round(metrics.score)}%` : 'N/A';
    
    return [
      ['Feature', 'Score', 'Status'],
      ['Alt Text Coverage', altTextScore, altTextRatio >= 0.9 ? 'Good' : altTextRatio > 0 ? 'Needs Improvement' : 'Poor'],
      ['Lighthouse Score', lighthouseScore, (metrics.score || 0) >= 90 ? 'Good' : (metrics.score || 0) >= 70 ? 'Needs Improvement' : 'Poor'],
      ['ARIA Usage', metrics.ariaAttributesCount ? `${metrics.ariaAttributesCount} attributes` : 'Not Found', metrics.ariaAttributesCount > 0 ? 'Present' : 'Missing'],
      ['Keyboard Navigation', metrics.keyboardNavigable ? 'Supported' : 'Not Supported', metrics.keyboardNavigable ? 'Good' : 'Poor']
    ];
  }

  private createTechnicalDetailsSection(metrics: any): Content {
    return {
      stack: [
        {
          text: 'Complete Metrics Reference',
          style: 'sectionHeader',
          margin: [0, 0, 0, 10]
        },
        {
          text: 'This section contains all raw metrics collected during the analysis.',
          style: 'thresholdInfo',
          margin: [0, 0, 0, 20]
        },

        // Performance Metrics (Extended)
        {
          text: 'Performance Metrics (Extended)',
          style: 'subheader',
          margin: [0, 0, 0, 10]
        },
        {
          table: {
            headerRows: 1,
            widths: ['*', '*'],
            body: [
              [{ text: 'Metric', style: 'tableHeader' }, { text: 'Value', style: 'tableHeader' }],
              ['Load Time', `${metrics.performance?.loadTime?.toFixed(2) || 'N/A'} ms`],
              ['DOM Content Loaded', `${metrics.performance?.domContentLoaded?.toFixed(2) || 'N/A'} ms`],
              ['First Paint', `${metrics.performance?.firstPaint?.toFixed(2) || 'N/A'} ms`],
              ['First Contentful Paint', `${metrics.performance?.firstContentfulPaint?.toFixed(2) || 'N/A'} ms`],
              ['Largest Contentful Paint', `${metrics.performance?.largestContentfulPaint?.toFixed(2) || 'N/A'} ms`],
              ['Time to Interactive', `${metrics.performance?.timeToInteractive?.toFixed(2) || 'N/A'} ms`],
              ['Total Blocking Time', `${metrics.performance?.totalBlockingTime?.toFixed(2) || 'N/A'} ms`],
              ['Speed Index', `${metrics.performance?.speedIndex?.toFixed(2) || 'N/A'}`],
              ['Cumulative Layout Shift', `${metrics.performance?.cumulativeLayoutShift?.toFixed(3) || 'N/A'}`],
              ['Time to First Byte', `${metrics.performance?.ttfb?.toFixed(2) || 'N/A'} ms`],
              ['Estimated FID', `${metrics.performance?.estimatedFid?.toFixed(2) || 'N/A'} ms`],
              ['DOM Elements', metrics.performance?.domElements || 'N/A'],
              ['Page Size', metrics.performance?.pageSize ? `${(metrics.performance.pageSize / 1024).toFixed(2)} KB` : 'N/A'],
              ['Total Requests', metrics.performance?.requests || 'N/A']
            ]
          },
          margin: [0, 0, 0, 20]
        },

        // Lighthouse Scores (Detailed)
        {
          text: 'Lighthouse Scores (Detailed)',
          style: 'subheader',
          margin: [0, 20, 0, 10]
        },
        {
          table: {
            headerRows: 1,
            widths: ['*', '*'],
            body: [
              [{ text: 'Category', style: 'tableHeader' }, { text: 'Score', style: 'tableHeader' }],
              ['Performance', `${(metrics.lighthouse?.performance * 100).toFixed(1) || 'N/A'}%`],
              ['Accessibility', `${(metrics.lighthouse?.accessibility * 100).toFixed(1) || 'N/A'}%`],
              ['Best Practices', `${(metrics.lighthouse?.bestPractices * 100).toFixed(1) || 'N/A'}%`],
              ['SEO', `${(metrics.lighthouse?.seo * 100).toFixed(1) || 'N/A'}%`],
              ['PWA', metrics.lighthouse?.pwa ? `${(metrics.lighthouse.pwa * 100).toFixed(1)}%` : 'N/A']
            ]
          },
          margin: [0, 0, 0, 20]
        },

        // Security Details (Extended)
        {
          text: 'Security Details (Extended)',
          style: 'subheader',
          margin: [0, 20, 0, 10]
        },
        {
          table: {
            headerRows: 1,
            widths: ['*', '*'],
            body: [
              [{ text: 'Feature', style: 'tableHeader' }, { text: 'Status', style: 'tableHeader' }],
              ['Protocol', metrics.security?.protocol || 'N/A'],
              ['TLS Version', metrics.security?.tlsVersion || 'N/A'],
              ['Certificate Expiry', metrics.security?.certificateExpiry ? new Date(metrics.security.certificateExpiry).toLocaleDateString() : 'N/A'],
              ['Mixed Content', metrics.security?.mixedContent ? 'Present' : 'Not Found'],
              ...Object.entries(metrics.security?.securityHeaders || {}).map(([header, value]) => 
                [header, value ? 'Present' : 'Missing']
              ),
              ...(metrics.security?.vulnerabilities || []).map((vuln: Vulnerability) => 
                [`Vulnerability (${vuln.severity})`, `Count: ${vuln.count}`]
              )
            ]
          },
          margin: [0, 0, 0, 20]
        },

        // Additional Metrics
        {
          text: 'Additional Metrics',
          style: 'subheader',
          margin: [0, 20, 0, 10]
        },
        {
          table: {
            headerRows: 1,
            widths: ['*', '*'],
            body: [
              [{ text: 'Metric', style: 'tableHeader' }, { text: 'Value', style: 'tableHeader' }],
              ['Form Fields', metrics.accessibility?.formLabels ? 
                `${metrics.accessibility.formLabels.labeled}/${metrics.accessibility.formLabels.total} labeled` : 'N/A'
              ],
              ['Interactive Elements', metrics.formFunctionality?.interactiveElementsCount || 'N/A'],
              ['Forms with Submit', metrics.formFunctionality?.formsWithSubmitButton || 'N/A'],
              ['JavaScript Enabled', metrics.formFunctionality?.javascriptEnabled ? 'Yes' : 'No'],
              ['Broken Links', metrics.brokenLinks ? 
                `${metrics.brokenLinks.brokenLinks}/${metrics.brokenLinks.totalLinks}` : 'N/A'
              ],
              ['Viewport Width', metrics.responsiveness?.viewportWidth || 'N/A'],
              ['Page Width', metrics.responsiveness?.pageWidth || 'N/A']
            ]
          },
          margin: [0, 0, 0, 20]
        }
      ]
    } as Content;
  }

  private async createDocumentDefinition(data: ReportData): Promise<TDocumentDefinitions> {
    // Add fallbacks for missing data
    const executiveSummary = data.professionalAnalysis?.executiveSummary || {
      keyStrengths: [],
      criticalIssues: [],
      overallAssessment: 'No summary available',
      coreWebVitalsAssessment: ''
    };

    // Store recommendations in a variable and use it
    const recommendationsList = data.professionalAnalysis?.recommendations || {
      critical: [],
      important: [],
      optional: []
    };

    const performanceChart = this.createPerformanceChart(data.metrics.performance);
    const securityTable = this.createSecurityTable(data.metrics.security);
    const accessibilityScorecard = this.createAccessibilityScorecard(data.metrics.accessibility);

    const content: Content[] = [
      // Cover Page
      {
        stack: [
          {
            text: 'Website Evaluation Report',
            style: 'coverHeader',
            alignment: 'center',
            margin: [0, 100, 0, 20]
          } as ContentText,
          {
            text: data.websiteUrl,
            style: 'coverUrl',
            alignment: 'center',
            margin: [0, 0, 0, 20]
          } as ContentText,
          {
            text: `Generated on ${data.timestamp.toLocaleDateString()} at ${data.timestamp.toLocaleTimeString()}`,
            style: 'coverDate',
            alignment: 'center',
            margin: [0, 0, 0, 40]
          } as ContentText,
          {
            text: `Overall Score: ${data.overallScore}%`,
            style: 'coverScore',
            alignment: 'center',
            margin: [0, 0, 0, 10]
          } as ContentText,
          {
            text: 'Note: Automated analysis may have limitations. Please verify critical findings.',
            style: 'disclaimer',
            alignment: 'center',
            margin: [0, 0, 0, 20]
          } as ContentText,
          {
            canvas: [
              {
                type: 'line',
                x1: 60,
                y1: 20,
                x2: 455.28,
                y2: 20,
                lineWidth: 1,
                lineColor: '#808080'
              }
            ],
            margin: [0, 20, 0, 0]
          }
        ],
        pageBreak: 'after'
      } as Content,

      // Executive Summary
      {
        text: 'Executive Summary',
        style: 'sectionHeader',
        margin: [0, 0, 0, 20]
      } as ContentText,
      {
        text: executiveSummary.overallAssessment || 'No overall assessment available.',
        margin: [0, 0, 0, 20]
      } as ContentText,

      // Key Strengths
      {
        text: 'Key Strengths',
        style: 'subheader',
        margin: [0, 10, 0, 5]
      } as ContentText,
      {
        ul: (executiveSummary.keyStrengths || []).map(strength => ({
          text: strength,
          style: 'listItem'
        })),
        margin: [0, 0, 0, 15]
      },

      // Critical Issues
      {
        text: 'Critical Issues',
        style: 'subheader',
        margin: [0, 10, 0, 5]
      } as ContentText,
      {
        ul: (executiveSummary.criticalIssues || []).map(issue => ({
          text: issue,
          style: 'listItem',
          color: '#d32f2f'
        })),
        margin: [0, 0, 0, 15]
      },

      // Core Web Vitals Assessment
      {
        text: 'Core Web Vitals Assessment',
        style: 'subheader',
        margin: [0, 10, 0, 5]
      } as ContentText,
      {
        text: executiveSummary.coreWebVitalsAssessment || 'No Core Web Vitals assessment available.',
        margin: [0, 0, 0, 20]
      } as ContentText,

      // Performance Overview
      {
        text: 'Performance Overview',
        style: 'sectionHeader',
        margin: [0, 20, 0, 10]
      } as ContentText,
      {
        table: {
          headerRows: 1,
          widths: ['*', '*'],
          body: [
            [
              { text: 'Category', style: 'tableHeader' },
              { text: 'Score', style: 'tableHeader' }
            ],
            ...Object.entries(data.phaseScores).map(([category, score]) => [
              { text: category, style: 'metric' },
              { 
                text: `${score}%`,
                style: score >= 90 ? 'good' : score >= 70 ? 'warning' : 'critical'
              }
            ])
          ]
        },
        margin: [0, 0, 0, 30]
      } as Content,

      // Core Web Vitals
      {
        text: 'Core Web Vitals',
        style: 'subheader',
        margin: [0, 0, 0, 10]
      } as ContentText,
      {
        text: 'Thresholds: FCP < 1800ms (Good), LCP < 2500ms (Good), CLS < 0.1 (Good), TTI < 3800ms (Good)',
        style: 'thresholdInfo',
        margin: [0, 0, 0, 10]
      } as ContentText,
      {
        table: {
          headerRows: 1,
          widths: ['*', '*', '*'],
          body: [
            [
              { text: 'Metric', style: 'tableHeader' },
              { text: 'Value', style: 'tableHeader' },
              { text: 'Status', style: 'tableHeader' }
            ],
            ...performanceChart.map(metric => [
              { text: metric.name, style: 'metric' },
              { text: metric.displayValue, style: 'metric' },
              { 
                text: metric.status,
                style: metric.status === 'Good' ? 'good' : 'warning'
              }
            ])
          ]
        },
        margin: [0, 0, 0, 30]
      } as Content,

      // Security Analysis
      {
        text: 'Security Analysis',
        style: 'sectionHeader',
        margin: [0, 20, 0, 10]
      } as ContentText,
      {
        text: 'Critical headers: Strict-Transport-Security, Content-Security-Policy\nImportant headers: X-Frame-Options, X-Content-Type-Options',
        style: 'thresholdInfo',
        margin: [0, 0, 0, 10]
      } as ContentText,
      {
        table: {
          headerRows: 1,
          widths: ['*', 100],
          body: [securityTable.headers, ...securityTable.rows]
        },
        margin: [0, 0, 0, 30]
      } as Content,

      // Accessibility Scorecard
      {
        text: 'Accessibility Scorecard',
        style: 'sectionHeader',
        margin: [0, 20, 0, 10]
      } as ContentText,
      {
        text: 'Thresholds: Alt Text Coverage > 90% (Good), Lighthouse Score > 90% (Good)',
        style: 'thresholdInfo',
        margin: [0, 0, 0, 10]
      } as ContentText,
      {
        table: {
          headerRows: 1,
          widths: ['*', 100, 50],
          body: accessibilityScorecard
        },
        margin: [0, 0, 0, 30]
      } as Content,

      // Recommendations
      {
        text: 'Recommendations',
        style: 'sectionHeader',
        pageBreak: 'before'
      } as ContentText,
      this.createRecommendationsSection(data.metrics),

      // Technical Details
      this.createTechnicalDetailsSection(data.metrics)
    ];

    return {
      content,
      defaultStyle: {
        font: 'Helvetica'  // Use Helvetica as default
      },
      styles: {
        coverHeader: {
          fontSize: 28,
          color: '#2c3e50',
          font: 'Helvetica'
        },
        coverUrl: {
          fontSize: 20,
          color: '#34495e',
          font: 'Helvetica'
        },
        coverDate: {
          fontSize: 14,
          color: '#7f8c8d',
          font: 'Helvetica'
        },
        coverScore: {
          fontSize: 24,
          color: '#27ae60',
          font: 'Helvetica'
        },
        disclaimer: {
          fontSize: 12,
          color: '#7f8c8d',
          font: 'Helvetica'
        },
        sectionHeader: {
          fontSize: 20,
          color: '#2c3e50',
          margin: [0, 20, 0, 10],
          font: 'Helvetica'
        },
        subheader: {
          fontSize: 16,
          color: '#34495e',
          margin: [0, 15, 0, 5],
          font: 'Helvetica'
        },
        tableHeader: {
          fontSize: 14,
          color: '#ffffff',
          fillColor: '#34495e',
          margin: [0, 5],
          font: 'Helvetica'
        },
        metric: {
          fontSize: 12,
          color: '#2c3e50',
          margin: [0, 2],
          font: 'Helvetica'
        },
        good: {
          color: '#27ae60',
          font: 'Helvetica'
        },
        warning: {
          color: '#f39c12',
          font: 'Helvetica'
        },
        critical: {
          color: '#c0392b',
          font: 'Helvetica'
        },
        thresholdInfo: {
          fontSize: 11,
          color: '#666666',
          font: 'Helvetica'
        },
        listItem: {
          fontSize: 11,
          lineHeight: 1.3,
          font: 'Helvetica'
        }
      },
      footer: (currentPage, pageCount) => ({
        text: `Page ${currentPage} of ${pageCount}`,
        alignment: 'center',
        margin: [0, 20],
        color: '#95a5a6',
        font: 'Helvetica'
      }),
      pageMargins: [40, 60, 40, 60],
      pageSize: 'A4'
    };
  }

  private createRecommendationsSection(metrics: any): Content[] {
    const recommendations: Content[] = [
      {
        text: 'Critical Improvements',
        style: 'subheader',
        margin: [0, 10, 0, 5]
      } as ContentText
    ];

    // Add critical recommendations
    if (!metrics.seo?.title) {
      recommendations.push({
        text: 'SEO - Title Tag:',
        style: 'recommendationHeader'
      } as ContentText,
      {
        text: 'Add a descriptive title that accurately represents the page content (recommended length: 50-60 characters)',
        margin: [0, 0, 0, 10]
      } as ContentText);
    }

    if (!metrics.seo?.metaDescription) {
      recommendations.push({
        text: 'SEO - Meta Description:',
        style: 'recommendationHeader'
      } as ContentText,
      {
        text: 'Include a summary that describes the page content (recommended length: 150-160 characters)',
        margin: [0, 0, 0, 10]
      } as ContentText);
    }

    // Add important recommendations section
    recommendations.push({
      text: 'Important Improvements',
      style: 'subheader',
      margin: [0, 20, 0, 5]
    } as ContentText);

    if (!metrics.seo?.structuredData) {
      recommendations.push({
        text: 'SEO - Structured Data:',
        style: 'recommendationHeader'
      } as ContentText,
      {
        text: 'Implement relevant schemas to enhance search result appearance and provide context to search engines',
        margin: [0, 0, 0, 10]
      } as ContentText);
    }

    if (!metrics.accessibility?.keyboardNavigable) {
      recommendations.push({
        text: 'Accessibility - Keyboard Navigation:',
        style: 'recommendationHeader'
      } as ContentText,
      {
        text: 'Ensure all interactive elements are keyboard accessible by adding proper focus management',
        margin: [0, 0, 0, 10]
      } as ContentText);
    }

    // Add optional recommendations section
    recommendations.push({
      text: 'Optional Improvements',
      style: 'subheader',
      margin: [0, 20, 0, 5]
    } as ContentText);

    if (!metrics.seo?.openGraphTags) {
      recommendations.push({
        text: 'SEO - Social Media Tags:',
        style: 'recommendationHeader'
      } as ContentText,
      {
        text: 'Add Open Graph tags to optimize social media sharing appearance',
        margin: [0, 0, 0, 10]
      } as ContentText);
    }

    return recommendations;
  }

  private createPerformanceMetricsRows(metrics: any) {
    const thresholds = {
      firstContentfulPaint: { good: 1800, poor: 3000 },
      largestContentfulPaint: { good: 2500, poor: 4000 },
      timeToInteractive: { good: 3800, poor: 7300 },
      ttfb: { good: 600, poor: 1800 },
      tbt: { good: 200, poor: 600 }
    };

    return Object.entries(metrics)
      .filter(([key]) => key in thresholds)
      .map(([key, value]) => {
        const threshold = thresholds[key as keyof typeof thresholds];
        const numericValue = typeof value === 'number' ? Number(value.toFixed(2)) : 0;
        const status = numericValue <= threshold.good ? 'Good' :
          numericValue <= threshold.poor ? 'Needs Improvement' : 'Poor';
        const style = numericValue <= threshold.good ? 'good' :
          numericValue <= threshold.poor ? 'warning' : 'critical';

        return [
          { text: key, style: 'metric' },
          { text: `${numericValue}ms`, style: 'metric' },
          { text: status, style }
        ];
      });
  }

  async generatePDF(data: ReportData): Promise<Uint8Array> {
    // TEST VARIABLE: Set to true to simulate having 100 reports
    const SIMULATE_REPORT_LIMIT = false;

    try {
      // Check report limit
      const userReports = await reportStorage.getUserReports(auth.currentUser?.uid || '');
      const reportCount = SIMULATE_REPORT_LIMIT ? 100 : userReports.length;
      
      if (reportCount >= 100) {
        throw new Error('Report limit reached (100 reports). Please delete some reports from your profile page to generate new ones.');
      }

      // Move professional analysis before PDF creation
      data.professionalAnalysis = await this.generateProfessionalAnalysis(data);
      
      const docDefinition = await this.createDocumentDefinition(data);
      
      return new Promise((resolve, reject) => {
        try {
          const pdfDoc = pdfMake.createPdf(docDefinition);
          pdfDoc.getBuffer((buffer: Uint8Array) => {
            if (buffer) {
              resolve(buffer);
            } else {
              reject(new Error('Failed to generate PDF buffer'));
            }
          });
        } catch (error) {
          reject(error);
        }
      });
    } catch (error) {
      console.error('PDF generation failed:', error);
      throw error;
    }
  }

  private async generateProfessionalAnalysis(data: ReportData) {
    let completedReport: ReportResponse | null = null;
    let eventSource: EventSource | null = null;
    try {
      console.log('[Report Generator] Initializing professional analysis generation');
      const response = await axios.post(
        `${process.env.REACT_APP_API_URL}/api/generate-professional-report`,
        data
      );
      console.log('[Report Generator] Initial response:', response.data);

      if (!response.data?.jobId) {
        throw new Error('No job ID received from server');
      }

      const apiUrl = process.env.REACT_APP_API_URL?.replace(/\/$/, '');
      if (!apiUrl) {
        throw new Error('API URL not configured');
      }

      const streamUrl = `${apiUrl}/api/generate-professional-report/stream/${response.data.jobId}`;
      console.log('[Report Generator] Connecting to stream:', streamUrl);

      eventSource = new EventSource(streamUrl);
      
      let completed = false;
      let isConnected = false;
      let retryCount = 0;
      const MAX_RETRIES = 3;
      const RETRY_DELAY = 1000;

      // Set up cleanup function
      const cleanup = () => {
        console.log('[Report Generator] Cleaning up EventSource connection');
        if (eventSource && eventSource.readyState !== EventSource.CLOSED) {
          eventSource.close();
        }
      };

      // Set up timeout
      const timeout = setTimeout(() => {
        console.warn('[Report Generator] EventSource timeout - closing connection');
        cleanup();
        if (!completed) {
          throw new Error('Analysis stream timeout');
        }
      }, 120000); // 2 minute timeout

      eventSource.onopen = () => {
        console.log('[Report Generator] EventSource connection opened');
        isConnected = true;
        retryCount = 0;
      };

      eventSource.onmessage = (event) => {
        console.log('[Report Generator] Received raw message:', event.data);
        try {
          const data = JSON.parse(event.data);
          console.log('[Report Generator] Parsed message data:', data);
          
          if (data.type === 'complete' && data.report) {
            console.log('[Report Generator] Received complete report:', data.report);
            if (!data.report?.executiveSummary || !data.report.technicalAnalysis || !data.report.recommendations) {
              throw new Error('Received incomplete report from server');
            }
            completed = true;
            clearTimeout(timeout);
            completedReport = data.report as ReportResponse;
            return;
          } else if (data.type === 'end') {
            console.log('[Report Generator] Received end event');
            cleanup();
          }
        } catch (error) {
          console.error('[Report Generator] Error parsing message:', error);
          if (!completed) {
            cleanup();
            clearTimeout(timeout);
            throw new Error('Failed to parse server message');
          }
        }
      };

      eventSource.onerror = async (error) => {
        console.error('[Report Generator] EventSource error:', error);
        console.log('[Report Generator] EventSource readyState:', eventSource?.readyState, {
          CONNECTING: EventSource.CONNECTING,
          OPEN: EventSource.OPEN,
          CLOSED: EventSource.CLOSED
        });
        
        // Ignore errors if we've already completed successfully
        if (completed) {
          cleanup();
          return;
        }

        if (!isConnected) {
          // Connection establishment error
          retryCount++;
          console.log(`[Report Generator] Connection attempt ${retryCount}/${MAX_RETRIES}`);
          if (retryCount >= MAX_RETRIES) {
            console.error('[Report Generator] Failed to establish connection after multiple attempts');
            cleanup();
            clearTimeout(timeout);
            throw new Error('Failed to establish analysis connection');
          } else {
            // Wait before retry
            await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
            return;
          }
        } else if (eventSource?.readyState === EventSource.CLOSED) {
          // Normal closure or server-initiated close
          console.log('[Report Generator] EventSource connection closed');
          cleanup();
          if (!completed) {
            clearTimeout(timeout);
            throw new Error('Connection closed before completion');
          }
        } else {
          // Other error during active connection
          console.error('[Report Generator] EventSource error during active connection');
          cleanup();
          clearTimeout(timeout);
          throw new Error('Analysis stream error');
        }
      };

      // Wait for completion
      await new Promise((resolve) => {
        const checkComplete = () => {
          if (completedReport) {
            resolve(true);
          } else {
            setTimeout(checkComplete, 100);
          }
        };
        checkComplete();
      });

      console.log('[Report Generator] Report validation passed, returning report');
      return completedReport!;
    } finally {
      if (eventSource) {
        eventSource.close();
      }
    }
  }

  private getDocumentStyles() {
    return {
      header: {
        fontSize: 24,
        bold: true,
        margin: [0, 0, 0, 20]
      },
      subheader: {
        fontSize: 16,
        bold: true,
        margin: [0, 10, 0, 5]
      },
      tableHeader: {
        fontSize: 12,
        bold: true,
        color: '#ffffff',
        fillColor: '#34495e'
      },
      metric: {
        fontSize: 11
      },
      good: {
        color: '#2e7d32',
        bold: true
      },
      warning: {
        color: '#ed6c02',
        bold: true
      },
      critical: {
        color: '#d32f2f',
        bold: true
      },
      recommendation: {
        fontSize: 11,
        margin: [0, 2, 0, 2]
      },
      recommendationHeader: {
        fontSize: 12,
        bold: true,
        margin: [0, 10, 0, 5]
      }
    };
  }

  async generatePDFFromStored(data: ReportData): Promise<Uint8Array> {
    const pdfMake = await this.loadPdfMake();
    
    try {
      // Skip analysis generation and use existing data
      const docDefinition = await this.createDocumentDefinition(data);
      
      return new Promise((resolve) => {
        const pdfDoc = pdfMake.createPdf(docDefinition);
        pdfDoc.getBuffer(resolve);
      });
    } catch (error) {
      console.error('PDF generation failed:', error);
      throw error;
    }
  }
}

export const reportGenerator = new ReportGenerator();