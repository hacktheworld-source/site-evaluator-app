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

    // Validate performance metrics
    const validations = metricValidator.validatePerformanceMetrics(metrics);
    validations.forEach(validation => {
      if (validation.rating === 'poor') {
        result.issues.push(`Performance metric ${validation.value} is outside acceptable range`);
        result.confidence *= 0.8; // Reduce confidence for poor ratings
      }
    });

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
      result.isValid = false;
      result.issues.push('Missing best practices metrics');
      result.confidence *= 0.9; // Reduce confidence if metrics are missing
      return result;
    }

    // Validate best practices metrics
    const validations = metricValidator.validateBestPracticesMetrics(metrics);
    validations.forEach(validation => {
      if (validation.rating === 'poor') {
        result.issues.push(`Best practice metric ${validation.value} is outside acceptable range`);
        result.confidence *= 0.8;
      }
    });

    return result;
  }
}

export const reportValidator = new ReportValidator(); 