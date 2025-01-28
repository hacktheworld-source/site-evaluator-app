import { TDocumentDefinitions, Content, ContentText } from 'pdfmake/interfaces';
import axios from 'axios';
import { metricValidator } from './metricValidator';
import { reportValidator } from './reportValidator';
import { toast } from 'react-toastify';

export interface ReportData {
  websiteUrl: string;
  timestamp: Date;
  overallScore: number;
  phaseScores: { [phase: string]: number };
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
  };
}

class ReportGenerator {
  private async loadPdfMake() {
    const pdfMake = await import('pdfmake/build/pdfmake');
    const pdfFonts = await import('pdfmake/build/vfs_fonts');
    const pdfMakeLib = pdfMake.default || pdfMake;
    
    if (!pdfMakeLib.vfs) {
      pdfMakeLib.vfs = pdfFonts.pdfMake ? pdfFonts.pdfMake.vfs : pdfFonts.default;
    }
    
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

  private async createDocumentDefinition(data: ReportData, analysis: any): Promise<TDocumentDefinitions> {
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
        text: analysis.executiveSummary.overallAssessment,
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
      {
        text: 'Technical Details',
        style: 'sectionHeader',
        pageBreak: 'before'
      } as ContentText,
      {
        text: 'Performance Metrics',
        style: 'subheader',
        margin: [0, 0, 0, 10]
      } as ContentText,
      {
        text: 'Thresholds: FCP < 1800ms, LCP < 2500ms, TTFB < 600ms, TBT < 300ms',
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

      {
        text: 'SEO Analysis',
        style: 'subheader',
        margin: [0, 0, 0, 10]
      } as ContentText,
      {
        text: 'Best Practices: Include title (50-60 chars), meta description (150-160 chars), canonical URL, and structured data',
        style: 'thresholdInfo',
        margin: [0, 0, 0, 10]
      } as ContentText,

      // Report Validation
      {
        text: 'Report Validation',
        style: 'sectionHeader',
        pageBreak: 'before'
      } as ContentText,
      {
        text: `Confidence Score: ${(analysis.validationMetadata.confidence * 100).toFixed(1)}%`,
        style: 'subheader',
        margin: [0, 0, 0, 10]
      } as ContentText
    ];

    return {
      content,
      styles: {
        coverHeader: {
          fontSize: 28,
          bold: true,
          color: '#2c3e50'
        },
        coverUrl: {
          fontSize: 20,
          color: '#34495e'
        },
        coverDate: {
          fontSize: 14,
          color: '#7f8c8d'
        },
        coverScore: {
          fontSize: 24,
          bold: true,
          color: '#27ae60'
        },
        disclaimer: {
          fontSize: 12,
          italics: true,
          color: '#7f8c8d'
        },
        sectionHeader: {
          fontSize: 20,
          bold: true,
          color: '#2c3e50',
          margin: [0, 20, 0, 10]
        },
        subheader: {
          fontSize: 16,
          bold: true,
          color: '#34495e',
          margin: [0, 15, 0, 5]
        },
        tableHeader: {
          fontSize: 14,
          bold: true,
          color: '#ffffff',
          fillColor: '#34495e',
          margin: [0, 5]
        },
        metric: {
          fontSize: 12,
          color: '#2c3e50',
          margin: [0, 2]
        },
        good: {
          color: '#27ae60'
        },
        warning: {
          color: '#f39c12'
        },
        critical: {
          color: '#c0392b'
        },
        thresholdInfo: {
          fontSize: 11,
          color: '#666666',
          italics: true
        }
      },
      defaultStyle: {
        fontSize: 12,
        lineHeight: 1.4,
        color: '#2c3e50'
      },
      footer: (currentPage, pageCount) => ({
        text: `Page ${currentPage} of ${pageCount}`,
        alignment: 'center',
        margin: [0, 20],
        color: '#95a5a6'
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

  private createTechnicalDetailsSection(metrics: any): Content {
    return {
      stack: [
        {
          text: 'Performance Metrics',
          style: 'subheader',
          margin: [0, 0, 0, 10]
        },
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
              ...this.createPerformanceMetricsRows(metrics.performance)
            ]
          },
          margin: [0, 0, 0, 20]
        },

        {
          text: 'SEO Analysis',
          style: 'subheader',
          margin: [0, 20, 0, 10]
        },
        {
          table: {
            headerRows: 1,
            widths: ['*', '*'],
            body: [
              [
                { text: 'Feature', style: 'tableHeader' },
                { text: 'Status', style: 'tableHeader' }
              ],
              ['Title', metrics.seo.title || 'Missing'],
              ['Meta Description', metrics.seo.metaDescription || 'Missing'],
              ['SEO Score', `${(metrics.lighthouse?.seo || 0).toFixed(0)}%`],
              ['Structured Data', metrics.seo.structuredData?.present ? 'Present' : 'Missing'],
              ['Canonical URL', metrics.seo.canonical?.present ? 'Present' : 'Missing'],
              ['Hreflang Tags', metrics.seo.hreflang?.present ? 'Present' : 'Missing'],
              ['Open Graph Tags', metrics.seo.metaTags?.ogTags?.length > 0 ? 'Present' : 'Missing'],
              ['Twitter Cards', metrics.seo.metaTags?.twitterTags?.length > 0 ? 'Present' : 'Missing']
            ]
          },
          margin: [0, 0, 0, 20]
        }
      ]
    } as Content;
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
    const pdfMake = await this.loadPdfMake();
    
    // Generate professional analysis
    const analysis = await this.generateProfessionalAnalysis(data);
    
    // Create PDF with professional content
    const docDefinition = await this.createDocumentDefinition(data, analysis);

    return new Promise((resolve, reject) => {
      try {
        const pdfDoc = pdfMake.createPdf(docDefinition);
        pdfDoc.getBuffer((buffer: Uint8Array) => {
          resolve(buffer);
        });
      } catch (error) {
        reject(error);
      }
    });
  }

  private async generateProfessionalAnalysis(data: ReportData) {
    try {

      const response = await axios.post(
        `${process.env.REACT_APP_API_URL}/api/generate-professional-report`,
        {
          websiteUrl: data.websiteUrl,
          scores: {
            overall: data.overallScore,
            phases: data.phaseScores,
            lighthouse: data.metrics.lighthouse
          },
          metrics: {
            performance: data.metrics.performance,
            seo: data.metrics.seo,
            accessibility: data.metrics.accessibility
          }
        }
      );

      // Validate the generated report
      const reportValidation = reportValidator.validateReport({
        ...data,
        analysis: response.data
      });

      // Log validation results
      console.log('Report Validation:', reportValidation);

      if (!reportValidation.overall.isValid) {
        console.warn('Report validation issues:', reportValidation.overall.issues);
        toast.warn('Some report data may be incomplete or inaccurate');
      }

      if (reportValidation.overall.warnings.length > 0) {
        console.warn('Report validation warnings:', reportValidation.overall.warnings);
      }

      // Add validation metadata to the report
      return {
        ...response.data,
        validationMetadata: {
          confidence: reportValidation.overall.confidence,
          warnings: reportValidation.overall.warnings,
          testingMetadata: metricValidator.generateTestingMetadata()
        }
      };
    } catch (error) {
      console.error('Error generating professional analysis:', error);
      throw new Error('Failed to generate professional analysis');
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
}

export const reportGenerator = new ReportGenerator();