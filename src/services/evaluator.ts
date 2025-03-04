import axios from 'axios';
import { getRateLimiter } from '../../backend/src/services/rateLimiter';
import { compressImage } from '../utils/imageCompression';

// Remove the OpenAI import and initialization

const rateLimiter = getRateLimiter(5, 60000); // 5 requests per minute

// Set the maximum screenshot size to be 80% of the maximum document size (1 MB)
const MAX_SCREENSHOT_SIZE = 800000; // 800 KB

export interface EvaluationResult {
  loadTime: number;
  domContentLoaded: number;
  firstPaint: number;
  firstContentfulPaint: number;
  domElements: number;
  pageSize: number;
  requests: number;
  timeToInteractive: number;
  largestContentfulPaint: number;
  cumulativeLayoutShift: number;
  colorContrast: {
    lowContrastElements: number;
  };
  fontSizes: {
    [size: string]: number;
  };
  responsiveness: {
    isResponsive: boolean;
    viewportWidth: number;
    pageWidth: number;
  };
  brokenLinks: {
    totalLinks: number;
    brokenLinks: number;
  };
  formFunctionality: {
    totalForms: number;
    formsWithSubmitButton: number;
    interactiveElementsCount: number;
    inputFieldsCount: number;
    javascriptEnabled: boolean;
  };
  htmlContent: string;
  screenshot: string;
  aiAnalysis: {
    overallScore: number;
    uiAnalysis: string;
    functionalityAnalysis: string;
    recommendations: string[];
  };
  accessibility: {
    ariaAttributesCount: number;
    imagesWithAltText: number;
    totalImages: number;
    headingStructure: Array<{ level: number; text: string }>;
    keyboardNavigable: boolean;
  };
  seo: {
    title: string;
    metaDescription: string;
    canonicalUrl: string;
    h1: string;
    metaViewport: string;
    structuredData: string[];
    robotsMeta: string | null;
  };
  bestPractices: {
    semanticUsage: { [key: string]: number };
    optimizedImages: number;
    totalImages: number;
  };
  security: {
    isHttps: boolean;
    hasContentSecurityPolicy: boolean;
    hasStrictTransportSecurity: boolean;
    hasXFrameOptions: boolean;
  };
  ttfb: number;
  tbt: number;
  estimatedFid: number; // Changed from fid to estimatedFid
  lighthouse: {
    performance: number;
    accessibility: number;
    bestPractices: number;
    seo: number;
  };
}

export async function evaluateWebsite(url: string, userId: string): Promise<EvaluationResult> {
  if (!rateLimiter.tryRemoveTokens(1)) {
    throw new Error('Rate limit exceeded. Please try again later.');
  }

  try {
    const response = await axios.get(`${process.env.REACT_APP_API_URL}/api/evaluate?url=${encodeURIComponent(url)}`, {
      timeout: 120000, // 2 minutes timeout
      headers: {
        'user-id': userId
      }
    });
    
    // Compress the screenshot if it exists
    if (response.data.screenshot) {
      // console.log('Compressing screenshot in evaluateWebsite...'); // Remove this line
      const { compressedImage, quality } = await compressImage(response.data.screenshot, MAX_SCREENSHOT_SIZE);
      response.data.screenshot = compressedImage;
      // console.log(`Screenshot compressed to quality: ${quality.toFixed(2)} in evaluateWebsite`); // Remove this line
    }

    return response.data;
  } catch (error) {
    // console.error('Error during evaluation:', error); // Remove this line
    throw new Error('An error occurred while evaluating the website. Please try again.');
  }
}