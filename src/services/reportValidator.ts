import { metricValidator } from './metricValidator';

interface ValidationResult {
  isValid: boolean;
  confidence: number;
  issues: string[];
  warnings: string[];
}

interface ReportValidation {
  overall: ValidationResult;
  sections: {
    performance: ValidationResult;
    seo: ValidationResult;
    accessibility: ValidationResult;
    bestPractices: ValidationResult;
  };
}

// Add interface for heading structure
interface HeadingStructure {
  level: number;
  text: string;
}

class ReportValidator {
  validateReport(reportData: any): ReportValidation {
    const validation: ReportValidation = {
      overall: {
        isValid: true,
        confidence: 1.0,
        issues: [],
        warnings: []
      },
      sections: {
        performance: this.validatePerformanceSection(reportData),
        seo: this.validateSEOSection(reportData),
        accessibility: this.validateAccessibilitySection(reportData),
        bestPractices: this.validateBestPracticesSection(reportData)
      }
    };

    // Validate overall report structure
    if (!reportData.websiteUrl) {
      validation.overall.issues.push('Missing website URL');
      validation.overall.isValid = false;
    }

    if (!reportData.timestamp) {
      validation.overall.issues.push('Missing timestamp');
      validation.overall.isValid = false;
    }

    // Check section validations
    const sectionResults = Object.values(validation.sections);
    validation.overall.isValid = validation.overall.isValid && 
      sectionResults.every(section => section.isValid);
    
    // Calculate overall confidence
    validation.overall.confidence = sectionResults.reduce(
      (acc, section) => acc * section.confidence, 
      1.0
    );

    // Aggregate warnings
    sectionResults.forEach(section => {
      validation.overall.warnings.push(...section.warnings);
    });

    return validation;
  }

  private validatePerformanceSection(reportData: any): ValidationResult {
    const result: ValidationResult = {
      isValid: true,
      confidence: 1.0,
      issues: [],
      warnings: []
    };

    const metrics = reportData.metrics?.performance;
    if (!metrics) {
      result.isValid = false;
      result.issues.push('Missing performance metrics');
      return result;
    }

    // Validate Core Web Vitals
    const validations = metricValidator.validatePerformanceMetrics(metrics);
    validations.forEach(validation => {
      if (validation.rating === 'poor') {
        result.issues.push(`${validation.value} exceeds threshold of ${validation.threshold}`);
        result.confidence *= 0.8;
      } else if (validation.rating === 'needs-improvement') {
        result.warnings.push(`${validation.value} is close to threshold of ${validation.threshold}`);
        result.confidence *= 0.9;
      }
    });

    // Check for unrealistic values
    if (metrics.loadTime && metrics.loadTime < 100) {
      result.warnings.push('Suspiciously fast load time');
      result.confidence *= 0.7;
    }

    if (metrics.loadTime && metrics.loadTime > 30000) {
      result.warnings.push('Unusually slow load time');
      result.confidence *= 0.7;
    }

    return result;
  }

  private validateSEOSection(reportData: any): ValidationResult {
    const result: ValidationResult = {
      isValid: true,
      confidence: 1.0,
      issues: [],
      warnings: []
    };

    const metrics = reportData.metrics?.seo;
    if (!metrics) {
      result.isValid = false;
      result.issues.push('Missing SEO metrics');
      return result;
    }

    // Validate SEO metrics
    const validations = metricValidator.validateSEOMetrics(metrics);
    validations.forEach(validation => {
      if (validation.rating === 'poor') {
        result.issues.push(`SEO metric ${validation.value} is outside acceptable range`);
        result.confidence *= 0.8;
      }
    });

    // Check meta tags
    if (!metrics.title) {
      result.issues.push('Missing page title');
      result.isValid = false;
    }

    if (!metrics.metaDescription) {
      result.warnings.push('Missing meta description');
      result.confidence *= 0.9;
    }

    return result;
  }

  private validateAccessibilitySection(reportData: any): ValidationResult {
    const result: ValidationResult = {
      isValid: true,
      confidence: 1.0,
      issues: [],
      warnings: []
    };

    const metrics = reportData.metrics?.accessibility;
    if (!metrics) {
      result.isValid = false;
      result.issues.push('Missing accessibility metrics');
      return result;
    }

    // Validate accessibility metrics
    const validations = metricValidator.validateAccessibilityMetrics(metrics);
    validations.forEach(validation => {
      if (validation.rating === 'poor') {
        result.issues.push('Accessibility standards not met');
        result.confidence *= 0.8;
      }
    });

    // Check heading structure with proper typing
    if (metrics.headingStructure) {
      const headings = metrics.headingStructure as HeadingStructure[];
      const hasH1 = headings.some((h: HeadingStructure) => h.level === 1);
      if (!hasH1) {
        result.warnings.push('Missing H1 heading');
        result.confidence *= 0.9;
      }
    }

    return result;
  }

  private validateBestPracticesSection(reportData: any): ValidationResult {
    const result: ValidationResult = {
      isValid: true,
      confidence: 1.0,
      issues: [],
      warnings: []
    };

    const metrics = reportData.metrics?.bestPractices;
    if (!metrics) {
      result.warnings.push('Missing best practices metrics');
      result.confidence *= 0.9;
      return result;
    }

    // Check semantic HTML usage
    if (metrics.semanticUsage) {
      const hasMainElement = metrics.semanticUsage.main?.present;
      if (!hasMainElement) {
        result.warnings.push('No <main> element found');
        result.confidence *= 0.9;
      }
    }

    // Check image optimization
    if (metrics.optimizedImages && metrics.totalImages) {
      const optimizationRatio = metrics.optimizedImages / metrics.totalImages;
      if (optimizationRatio < 0.8) {
        result.warnings.push('Less than 80% of images are optimized');
        result.confidence *= 0.9;
      }
    }

    return result;
  }
}

export const reportValidator = new ReportValidator(); 