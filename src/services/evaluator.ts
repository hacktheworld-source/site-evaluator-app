import axios from 'axios';
import { analyzeContent } from './aiService';
import { getRateLimiter } from './rateLimiter';
import DOMPurify from 'dompurify';

export interface EvaluationResult {
  overall: number;
  categories: {
    [key: string]: number;
  };
  aiAnalysis: string;
  isLimited: boolean;
}

const rateLimiter = getRateLimiter(5, 60000); // 5 requests per minute

export async function evaluateWebsite(url: string): Promise<EvaluationResult> {
  if (!rateLimiter.tryRemoveTokens(1)) {
    throw new Error('Rate limit exceeded. Please try again later.');
  }

  let htmlContent: string;
  let isLimited = false;

  try {
    // Try direct request first
    const directResponse = await axios.get(url, { timeout: 5000 });
    htmlContent = directResponse.data;
  } catch (directError) {
    try {
      // If direct request fails, try CORS proxy
      const corsProxyUrl = 'https://api.allorigins.win/raw?url=';
      const proxyResponse = await axios.get(corsProxyUrl + encodeURIComponent(url), { timeout: 5000 });
      htmlContent = proxyResponse.data;
    } catch (proxyError) {
      // If both fail, do a simple availability check
      try {
        await axios.head(url, { timeout: 5000 });
        isLimited = true;
        htmlContent = '<html><body>Limited content available for evaluation.</body></html>';
      } catch (headError) {
        throw new Error('Unable to access the website through any method.');
      }
    }
  }

  // Evaluation logic
  const seoScore = evaluateSEO(htmlContent);
  const accessibilityScore = evaluateAccessibility(htmlContent);
  const performanceScore = isLimited ? 5 : evaluatePerformance(htmlContent); // Adjust if limited
  const contentScore = evaluateContent(htmlContent);

  const overall = ((seoScore + accessibilityScore + performanceScore + contentScore) / 4);

  const aiAnalysis = isLimited 
    ? "Limited evaluation due to access restrictions."
    : await analyzeContent(extractTextContent(htmlContent));

  return {
    overall: parseFloat(overall.toFixed(1)),
    categories: {
      seo: seoScore,
      accessibility: accessibilityScore,
      performance: performanceScore,
      content: contentScore,
    },
    aiAnalysis,
    isLimited
  };
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

function evaluatePerformance(htmlContent: string): number {
  // Simple performance evaluation based on content size
  let score = 5;
  if (htmlContent.length < 100000) score += 2; // Arbitrary threshold
  if (htmlContent.includes('<link rel="preload"')) score += 1;
  if (htmlContent.includes('<meta name="viewport"')) score += 1;
  if (!htmlContent.includes('<table')) score += 1; // Assuming tables might slow rendering
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