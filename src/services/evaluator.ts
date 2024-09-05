import axios from 'axios';
import { analyzeContent } from './aiService';
import { getRateLimiter } from './rateLimiter';
import DOMPurify from 'dompurify';

export interface EvaluationResult {
  overall: number;
  categories: {
    seo: number;
    accessibility: number;
    performance: number;
    bestPractices: number;
    security: number;
    content: number;
  };
  metrics: {
    loadTime: number;
    domContentLoaded: number;
    firstPaint: number;
    firstContentfulPaint: number;
    domElements: number;
    pageSize: number;
    requests: number;
    // ... other metrics
  };
  aiAnalysis: string;
  isLimited: boolean;
}

const rateLimiter = getRateLimiter(5, 60000); // 5 requests per minute

export async function evaluateWebsite(url: string): Promise<EvaluationResult> {
  if (!rateLimiter.tryRemoveTokens(1)) {
    throw new Error('Rate limit exceeded. Please try again later.');
  }

  try {
    const response = await axios.get(`/api/evaluate?url=${encodeURIComponent(url)}`);
    const serverMetrics = response.data;

    const contentScore = evaluateContent(serverMetrics.htmlContent);
    const performanceScore = evaluatePerformance(serverMetrics);

    const overall = (
      serverMetrics.seoScore +
      serverMetrics.accessibilityScore +
      performanceScore +
      serverMetrics.bestPracticesScore +
      serverMetrics.securityScore +
      contentScore
    ) / 6;

    const aiAnalysis = await analyzeContent(extractTextContent(serverMetrics.htmlContent));

    return {
      overall: parseFloat(overall.toFixed(1)),
      categories: {
        seo: serverMetrics.seoScore,
        accessibility: serverMetrics.accessibilityScore,
        performance: performanceScore,
        bestPractices: serverMetrics.bestPracticesScore,
        security: serverMetrics.securityScore,
        content: contentScore,
      },
      metrics: {
        loadTime: serverMetrics.loadTime,
        domContentLoaded: serverMetrics.domContentLoaded,
        firstPaint: serverMetrics.firstPaint,
        firstContentfulPaint: serverMetrics.firstContentfulPaint,
        domElements: serverMetrics.domElements,
        pageSize: serverMetrics.pageSize,
        requests: serverMetrics.requests,
        // ... other metrics
      },
      aiAnalysis,
      isLimited: false,
    };
  } catch (error) {
    console.error('Error during evaluation:', error);
    throw new Error('An error occurred while evaluating the website. Please try again.');
  }
}

function evaluateContent(htmlContent: string): number {
  const dom = new DOMParser().parseFromString(htmlContent, 'text/html');
  let score = 5;
  const textContent = dom.body.textContent || '';
  if (textContent.length > 300) score += 1;
  if (textContent.length > 1000) score += 1;
  if (dom.querySelectorAll('h2, h3, h4, h5, h6').length > 0) score += 1;
  if (dom.querySelector('ul, ol')) score += 1;
  if (dom.querySelectorAll('img').length > 0) score += 1;
  return score;
}

function evaluatePerformance(metrics: any): number {
  let score = 5;
  if (metrics.loadTime < 2000) score += 2;
  else if (metrics.loadTime < 5000) score += 1;
  if (metrics.firstContentfulPaint < 1000) score += 2;
  else if (metrics.firstContentfulPaint < 3000) score += 1;
  if (metrics.requests < 50) score += 1;
  return score;
}

function extractTextContent(htmlContent: string): string {
  const cleanHtml = DOMPurify.sanitize(htmlContent);
  return cleanHtml.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}