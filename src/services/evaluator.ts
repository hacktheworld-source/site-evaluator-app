import axios from 'axios';
import { getRateLimiter } from './rateLimiter';

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
  };
  htmlContent: string;
  screenshot: string;
  aiAnalysis: {
    overallScore: number;
    uiAnalysis: string;
    functionalityAnalysis: string;
    recommendations: string[];
  };
}

const rateLimiter = getRateLimiter(5, 60000); // 5 requests per minute

export async function evaluateWebsite(url: string): Promise<EvaluationResult> {
  if (!rateLimiter.tryRemoveTokens(1)) {
    throw new Error('Rate limit exceeded. Please try again later.');
  }

  try {
    const response = await axios.get(`${process.env.REACT_APP_API_URL}/api/evaluate?url=${encodeURIComponent(url)}`, {
      timeout: 120000, // 2 minutes timeout
    });
    
    return response.data;
  } catch (error) {
    console.error('Error during evaluation:', error);
    throw new Error('An error occurred while evaluating the website. Please try again.');
  }
}

// Remove the performAIAnalysis function from this file
// as it should now be handled on the server side