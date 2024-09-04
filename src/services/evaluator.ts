import axios from 'axios';
import { analyzeContent } from './aiService';
import { getRateLimiter } from './rateLimiter';
import DOMPurify from 'dompurify';

interface EvaluationResult {
  overall: number;
  categories: {
    [key: string]: number;
  };
  aiAnalysis: string;
}

const rateLimiter = getRateLimiter(5, 60000); // 5 requests per minute

export async function evaluateWebsite(url: string): Promise<EvaluationResult> {
  if (!rateLimiter.tryRemoveTokens(1)) {
    throw new Error('Rate limit exceeded. Please try again later.');
  }

  try {
    const response = await axios.get(url);
    const htmlContent = response.data;

    const seoScore = evaluateSEO(htmlContent);
    const accessibilityScore = evaluateAccessibility(htmlContent);
    const performanceScore = evaluatePerformance(response);
    const contentScore = evaluateContent(htmlContent);

    const overall = ((seoScore + accessibilityScore + performanceScore + contentScore) / 4);

    const aiAnalysis = await analyzeContent(extractTextContent(htmlContent));

    return {
      overall: parseFloat(overall.toFixed(1)),
      categories: {
        seo: seoScore,
        accessibility: accessibilityScore,
        performance: performanceScore,
        content: contentScore,
      },
      aiAnalysis
    };
  } catch (error) {
    console.error('Error evaluating website:', error);
    throw error;
  }
}

function evaluateSEO(htmlContent: string): number {
  // Simple SEO evaluation
  let score = 5;
  if (htmlContent.includes('<title>')) score += 1;
  if (htmlContent.includes('<meta name="description"')) score += 1;
  if (htmlContent.includes('<h1>')) score += 1;
  if (htmlContent.includes('<img') && htmlContent.includes('alt=')) score += 1;
  if (htmlContent.toLowerCase().includes('https://')) score += 1;
  return score;
}

function evaluateAccessibility(htmlContent: string): number {
  // Simple accessibility evaluation
  let score = 5;
  if (htmlContent.includes('aria-')) score += 1;
  if (htmlContent.includes('role=')) score += 1;
  if (htmlContent.includes('<label')) score += 1;
  if (htmlContent.includes('alt=')) score += 1;
  if (htmlContent.includes('<html lang=')) score += 1;
  return score;
}

function evaluatePerformance(response: any): number {
  // Simple performance evaluation
  let score = 5;
  const contentLength = response.headers['content-length'];
  if (contentLength && parseInt(contentLength) < 500000) score += 2;
  if (response.status === 200) score += 1;
  if (response.headers['cache-control']) score += 1;
  if (response.headers['content-encoding'] === 'gzip') score += 1;
  return score;
}

function evaluateContent(htmlContent: string): number {
  // Simple content evaluation
  let score = 5;
  const textContent = extractTextContent(htmlContent);
  if (textContent.length > 100) score += 1;
  if (textContent.length > 500) score += 1;
  if (htmlContent.includes('<h2>')) score += 1;
  if (htmlContent.includes('<ul>') || htmlContent.includes('<ol>')) score += 1;
  if (htmlContent.includes('<img')) score += 1;
  return score;
}

function extractTextContent(htmlContent: string): string {
  const cleanHtml = DOMPurify.sanitize(htmlContent);
  return cleanHtml.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}