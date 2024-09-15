import axios from 'axios';
import { getRateLimiter } from './rateLimiter';
import { compressImage } from '../utils/imageCompression';

// Remove the OpenAI import and initialization

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
}

const rateLimiter = getRateLimiter(5, 60000); // 5 requests per minute

// Set the maximum screenshot size to be 80% of the maximum document size (1 MB)
const MAX_SCREENSHOT_SIZE = 800000; // 800 KB

export async function evaluateWebsite(url: string): Promise<EvaluationResult> {
  if (!rateLimiter.tryRemoveTokens(1)) {
    throw new Error('Rate limit exceeded. Please try again later.');
  }

  try {
    const response = await axios.get(`${process.env.REACT_APP_API_URL}/api/evaluate?url=${encodeURIComponent(url)}`, {
      timeout: 120000, // 2 minutes timeout
    });
    
    // Compress the screenshot if it exists
    if (response.data.screenshot) {
      console.log('Compressing screenshot in evaluateWebsite...');
      const { compressedImage, quality } = await compressImage(response.data.screenshot, MAX_SCREENSHOT_SIZE);
      response.data.screenshot = compressedImage;
      console.log(`Screenshot compressed to quality: ${quality.toFixed(2)} in evaluateWebsite`);
    }

    return response.data;
  } catch (error) {
    console.error('Error during evaluation:', error);
    throw new Error('An error occurred while evaluating the website. Please try again.');
  }
}