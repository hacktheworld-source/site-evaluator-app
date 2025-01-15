interface MetricValidation {
  value: number;
  threshold: number;
  rating: 'good' | 'needs-improvement' | 'poor';
  confidence: number;
  benchmark: number;
  debug?: {
    totalScore?: number;
    maxScore?: number;
    headerPresence?: Record<string, boolean>;
    rawHeaders?: Record<string, string>;
  };
}

interface MetricReference {
  name: string;
  description: string;
  goodThreshold: number;
  industryAverage: number;
  documentation: string;
  importance: 'critical' | 'important' | 'optional';
}

interface TestingMetadata {
  timestamp: Date;
  duration: number;
  environment: {
    connection: string;
    device: string;
    location: string;
  };
  methodology: string;
}

class MetricValidator {
  private static readonly THRESHOLDS = {
    PERFORMANCE: {
      FCP: { good: 1800, poor: 3000 },
      LCP: { good: 2500, poor: 4000 },
      CLS: { good: 0.1, poor: 0.25 },
      FID: { good: 100, poor: 300 },
      TTI: { good: 3800, poor: 7300 },
      TTFB: { good: 600, poor: 1800 },
      TBT: { good: 200, poor: 600 },
      PAGE_SIZE: {
        total: { good: 2000000, poor: 5000000 }, // 2MB and 5MB thresholds
        document: { good: 100000, poor: 250000 }  // 100KB and 250KB thresholds
      }
    },
    SEO: {
      titleLength: { min: 30, max: 60 },
      descriptionLength: { min: 120, max: 160 },
      h1Count: { min: 1, max: 1 }
    },
    ACCESSIBILITY: {
      altTextRatio: { good: 1, poor: 0.8 },
      ariaAttributesMinimum: 5,
      keyboardNav: { good: 0.9, poor: 0.6 }
    },
    BEST_PRACTICES: {
      imageOptimization: { good: 0.85, poor: 0.6 },
      securityHeaders: { good: 0.8, poor: 0.5 },
      jsErrors: { max: 0 },
      deprecatedAPIs: { max: 0 }
    }
  };

  validatePerformanceMetrics(metrics: any): MetricValidation[] {
    const validations: MetricValidation[] = [];

    if (metrics.firstContentfulPaint) {
      validations.push({
        value: metrics.firstContentfulPaint,
        threshold: MetricValidator.THRESHOLDS.PERFORMANCE.FCP.good,
        rating: this.getRating(
          metrics.firstContentfulPaint, 
          MetricValidator.THRESHOLDS.PERFORMANCE.FCP
        ),
        confidence: 0.9,
        benchmark: 1500
      });
    }

    // Validate page size if available
    if (metrics.pageSize) {
      if (metrics.pageSize.total) {
        validations.push({
          value: metrics.pageSize.total,
          threshold: MetricValidator.THRESHOLDS.PERFORMANCE.PAGE_SIZE.total.good,
          rating: this.getRating(
            metrics.pageSize.total,
            MetricValidator.THRESHOLDS.PERFORMANCE.PAGE_SIZE.total
          ),
          confidence: 0.9,
          benchmark: 1500000 // 1.5MB benchmark
        });
      }

      if (metrics.pageSize.document) {
        validations.push({
          value: metrics.pageSize.document,
          threshold: MetricValidator.THRESHOLDS.PERFORMANCE.PAGE_SIZE.document.good,
          rating: this.getRating(
            metrics.pageSize.document,
            MetricValidator.THRESHOLDS.PERFORMANCE.PAGE_SIZE.document
          ),
          confidence: 0.9,
          benchmark: 75000 // 75KB benchmark
        });
      }
    }

    return validations;
  }

  validateSEOMetrics(metrics: any): MetricValidation[] {
    const validations: MetricValidation[] = [];

    if (metrics.title) {
      const titleLength = metrics.title.length;
      validations.push({
        value: titleLength,
        threshold: MetricValidator.THRESHOLDS.SEO.titleLength.max,
        rating: this.getRatingSEO(
          titleLength, 
          MetricValidator.THRESHOLDS.SEO.titleLength
        ),
        confidence: 1.0,
        benchmark: 55
      });
    }

    return validations;
  }

  validateAccessibilityMetrics(metrics: any): MetricValidation[] {
    const validations: MetricValidation[] = [];

    if (metrics.imagesWithAltText && metrics.totalImages) {
      const ratio = metrics.imagesWithAltText / metrics.totalImages;
      validations.push({
        value: ratio,
        threshold: MetricValidator.THRESHOLDS.ACCESSIBILITY.altTextRatio.good,
        rating: ratio >= MetricValidator.THRESHOLDS.ACCESSIBILITY.altTextRatio.good ? 'good' : 'poor',
        confidence: 1.0,
        benchmark: 1.0
      });
    }

    return validations;
  }

  validateSecurityMetrics(metrics: any): MetricValidation[] {
    const validations: MetricValidation[] = [];

    if (metrics.security) {
      // Validate HTTPS
      if (metrics.security.isHttps !== null) {
        validations.push({
          value: metrics.security.isHttps ? 1 : 0,
          threshold: 1,
          rating: metrics.security.isHttps ? 'good' : 'poor',
          confidence: 1.0,
          benchmark: 1.0
        });
      }

      // Validate security headers with proper weighting
      const securityHeaders = metrics.security.securityHeaders || {};
      
      // Headers are now categorized by importance and have alternatives
      const headerGroups = {
        critical: {
          'strict-transport-security': {
            alternatives: ['content-security-policy-report-only'],
            weight: 2.0
          },
          'content-security-policy': {
            alternatives: ['content-security-policy-report-only'],
            weight: 2.0
          }
        },
        important: {
          'x-frame-options': {
            alternatives: ['content-security-policy'],  // CSP can replace X-Frame-Options
            weight: 1.5
          },
          'x-content-type-options': {
            alternatives: [],  // No real alternatives
            weight: 1.5
          }
        },
        optional: {
          'referrer-policy': {
            alternatives: [],
            weight: 1.0
          },
          'permissions-policy': {
            alternatives: ['feature-policy'],  // Legacy header
            weight: 1.0
          }
        }
      };

      let totalScore = 0;
      let maxScore = 0;

      // Calculate scores considering alternatives
      Object.entries(headerGroups).forEach(([importance, headers]) => {
        Object.entries(headers).forEach(([header, config]) => {
          const hasHeader = securityHeaders[header] || 
            config.alternatives.some(alt => securityHeaders[alt]);
          
          if (hasHeader) {
            totalScore += config.weight;
          }
          maxScore += config.weight;
        });
      });

      const weightedScore = maxScore > 0 ? totalScore / maxScore : 0;
      
      // More lenient thresholds for header score
      validations.push({
        value: weightedScore,
        threshold: 0.6,  // Reduced from 0.7
        rating: weightedScore >= 0.6 ? 'good' : 
                weightedScore >= 0.4 ? 'needs-improvement' : 'poor',
        confidence: 0.95,
        benchmark: 0.7  // Reduced from 0.8
      });

      // Add debug information
      validations[validations.length - 1].debug = {
        totalScore,
        maxScore,
        headerPresence: securityHeaders,
        rawHeaders: metrics.security._debug?.rawHeaders
      };
    }

    return validations;
  }

  private getRating(value: number, threshold: { good: number; poor: number }): 'good' | 'needs-improvement' | 'poor' {
    if (value <= threshold.good) return 'good';
    if (value <= threshold.poor) return 'needs-improvement';
    return 'poor';
  }

  private getRatingSEO(value: number, threshold: { min: number; max: number }): 'good' | 'needs-improvement' | 'poor' {
    if (value >= threshold.min && value <= threshold.max) return 'good';
    if (value >= threshold.min * 0.8 && value <= threshold.max * 1.2) return 'needs-improvement';
    return 'poor';
  }

  getMetricReference(metricName: string): MetricReference {
    const references: { [key: string]: MetricReference } = {
      FCP: {
        name: 'First Contentful Paint',
        description: 'Measures time until first content is rendered',
        goodThreshold: MetricValidator.THRESHOLDS.PERFORMANCE.FCP.good,
        industryAverage: 1500,
        documentation: 'https://web.dev/fcp/',
        importance: 'critical'
      }
    };

    return references[metricName] || {
      name: metricName,
      description: 'No reference data available',
      goodThreshold: 0,
      industryAverage: 0,
      documentation: '',
      importance: 'optional'
    };
  }

  generateTestingMetadata(): TestingMetadata {
    return {
      timestamp: new Date(),
      duration: 5000,
      environment: {
        connection: '4G',
        device: 'Desktop',
        location: 'US'
      },
      methodology: 'Automated testing using Lighthouse and custom metrics'
    };
  }
}

export const metricValidator = new MetricValidator(); 