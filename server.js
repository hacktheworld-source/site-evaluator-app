require('dotenv').config();

const express = require('express');
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());
const cors = require('cors');
const axios = require('axios');
const { OpenAI } = require('openai');
const sharp = require('sharp');
const zlib = require('zlib');
const https = require('https');
const fs = require('fs').promises;
const path = require('path');

const app = express();
const port = 3001;

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

app.use((req, res, next) => {
  res.set({
    'Cross-Origin-Opener-Policy': 'same-origin-allow-popups',
    'Cross-Origin-Embedder-Policy': 'require-corp'
  });
  next();
});

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

const phases = ['UI', 'Functionality', 'Performance', 'SEO', 'Overall'];

const evaluationResults = new Map(); // Store evaluation results for each website

// Add this function at the top of your file, after the imports
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

app.get('/api/evaluate', async (req, res) => {
  const { url } = req.query;
  
  if (!url) {
    return res.status(400).json({ error: 'URL is required' });
  }

  if (isBlockedDomain(url)) {
    return res.status(400).json({ 
      error: 'This website actively blocks automated access. Please try analyzing a different site.' 
    });
  }

  try {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive'
    });

    const sendStatus = (message) => {
      res.write(`data: ${JSON.stringify({ status: message })}\n\n`);
    };

    const sendError = (error) => {
      console.error('Evaluation error:', error);
      res.write(`data: ${JSON.stringify({ error: error.message || 'An error occurred during evaluation' })}\n\n`);
      res.end();
    };

    try {
      sendStatus('Initializing evaluation process...');
      const evaluationResult = await evaluateWebsite(url, sendStatus);
      const { aiAnalysis, ...metrics } = evaluationResult;
      res.write(`data: ${JSON.stringify({ result: metrics, phase: 'start' })}\n\n`);
    } catch (error) {
      sendError(error);
    }

  } catch (error) {
    console.error('Error in /api/evaluate:', error);
    res.status(500).json({ error: error.message || 'An error occurred during evaluation' });
  }
});

async function evaluateWebsite(url, sendStatus) {
  let browser;
  const startTime = Date.now();
  const logStep = (step, details = {}) => {
    const elapsed = Date.now() - startTime;
    console.log(`[${elapsed}ms] ${step}`, JSON.stringify(details));
  };

  try {
    logStep('Starting website evaluation', { url });
    sendStatus('Launching browser...');
    
    browser = await puppeteer.launch({
      headless: 'new',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-features=site-per-process',
        '--disable-blink-features=AutomationControlled'
      ],
      defaultViewport: null
    });
    logStep('Browser launched successfully');

    sendStatus('Opening page...');
    const page = await browser.newPage();
    
    // Apply anti-detection measures
    const userAgent = getRandomUserAgent();
    await page.setUserAgent(userAgent);
    await page.setViewport({ 
      width: 1280, 
      height: 800,
      deviceScaleFactor: 1 + Math.random() * 0.3
    });
    await randomizeFingerprint(page);
    
    logStep('Page configuration complete', { userAgent });

    // Enable detailed console logging from the browser
    page.on('console', msg => {
      const type = msg.type();
      const text = msg.text();
      if (text.startsWith('[Browser]')) {
        logStep(`Browser Console [${type}]: ${text}`);
      }
    });

    // Navigate to URL with human-like behavior
    logStep('Navigating to URL', { url });
    const navigationStart = Date.now();
    await page.goto(url, { 
      waitUntil: 'networkidle0',
      timeout: 30000
    });
    logStep('Navigation complete', { 
      timeElapsed: Date.now() - navigationStart 
    });

    await humanizeBehavior(page);
    logStep('Human behavior simulation complete');

    sendStatus('Gathering performance metrics...');
    logStep('Starting performance metrics collection');
    const metricsStart = Date.now();
    const metrics = await page.evaluate(() => {
      console.log('[Browser] Starting performance metrics collection');
      return new Promise((resolve, reject) => {
        let metricsCollected = {
          tbt: 0,
          estimatedFid: 0,
          fcp: null,
          lcp: null,
          tti: null,
          observersStarted: false,
          observersCounted: 0,
          fallbackTriggered: false
        };

        // Global timeout to prevent hanging
        const METRICS_TIMEOUT = 10000; // 10 seconds max
        const timeoutId = setTimeout(() => {
          console.log('[Browser] Global timeout reached, using available metrics');
          finalizeMetrics(true);
        }, METRICS_TIMEOUT);

        console.log('[Browser] Setting up Performance Observers');

        const observers = [];

        // Observe LCP
        const lcpObserver = new PerformanceObserver((list) => {
          console.log('[Browser] LCP Observer entry received');
          const entries = list.getEntries();
          metricsCollected.lcp = entries[entries.length - 1].startTime;
          metricsCollected.observersCounted++;
          console.log(`[Browser] LCP recorded: ${metricsCollected.lcp}`);
          checkAndResolve();
        });
        observers.push(lcpObserver);

        // Observe FCP
        const fcpObserver = new PerformanceObserver((list) => {
          console.log('[Browser] FCP Observer entry received');
          const entries = list.getEntries();
          metricsCollected.fcp = entries[0].startTime;
          metricsCollected.observersCounted++;
          console.log(`[Browser] FCP recorded: ${metricsCollected.fcp}`);
          checkAndResolve();
        });
        observers.push(fcpObserver);

        // Observe navigation timing
        const navigationObserver = new PerformanceObserver((list) => {
          console.log('[Browser] Navigation Observer entry received');
          const entries = list.getEntries();
          entries.forEach(entry => {
            if (entry.entryType === 'navigation') {
              console.log('[Browser] Processing navigation entry');
              const navEntry = entry;
              metricsCollected.tti = navEntry.domInteractive;
              metricsCollected.observersCounted++;
              checkAndResolve();
            }
          });
        });
        observers.push(navigationObserver);

        // Calculate TBT and estimate FID
        const tbtObserver = new PerformanceObserver((list) => {
          console.log('[Browser] TBT Observer entry received');
          const entries = list.getEntries();
          entries.forEach((entry) => {
            if (metricsCollected.fcp && (!metricsCollected.tti || entry.startTime < metricsCollected.tti)) {
              const blockingTime = entry.duration - 50;
              if (blockingTime > 0) {
                metricsCollected.tbt += blockingTime;
                metricsCollected.estimatedFid = Math.max(metricsCollected.estimatedFid, entry.duration);
                console.log(`[Browser] Updated TBT: ${metricsCollected.tbt}, FID: ${metricsCollected.estimatedFid}`);
              }
            }
          });
          checkAndResolve();
        });
        observers.push(tbtObserver);

        function checkAndResolve() {
          console.log('[Browser] Checking metrics status:', JSON.stringify(metricsCollected));
          const navigationEntry = performance.getEntriesByType('navigation')[0];
          if (navigationEntry && !metricsCollected.resolved) {
            finalizeMetrics(false);
          }
        }

        function finalizeMetrics(isTimeout) {
          if (metricsCollected.resolved) {
            console.log('[Browser] Metrics already resolved, skipping');
            return;
          }

          console.log('[Browser] Finalizing metrics collection');
          metricsCollected.resolved = true;

          // Cleanup all observers
          observers.forEach(observer => {
            try {
              observer.disconnect();
            } catch (error) {
              console.error('[Browser] Error disconnecting observer:', error);
            }
          });

          // Clear the timeout if we're not already in the timeout handler
          if (!isTimeout) {
            clearTimeout(timeoutId);
          }

          // Get accurate FCP from Paint Timing API
          const fcpEntry = performance.getEntriesByName('first-contentful-paint')[0];
          metricsCollected.fcp = fcpEntry ? fcpEntry.startTime : null;

          // Get accurate LCP from PerformanceObserver
          const lcpEntries = performance.getEntriesByType('largest-contentful-paint');
          metricsCollected.lcp = lcpEntries.length > 0 ? lcpEntries[lcpEntries.length - 1].startTime : null;

          const navigationEntry = performance.getEntriesByType('navigation')[0];
          
          // Use fallbacks if needed
          if (!metricsCollected.fcp) {
            metricsCollected.fcp = navigationEntry.domContentLoadedEventEnd;
            console.log('[Browser] Using fallback for FCP:', metricsCollected.fcp);
          }

          if (!metricsCollected.lcp) {
            metricsCollected.lcp = Math.max(
              navigationEntry.domContentLoadedEventEnd,
              metricsCollected.fcp + 100
            );
            console.log('[Browser] Using fallback for LCP:', metricsCollected.lcp);
          }

          // Calculate accurate page size
          const resources = performance.getEntriesByType('resource');
          const pageSize = {
            document: navigationEntry.encodedBodySize || document.documentElement.innerHTML.length,
            resources: resources.reduce((total, r) => total + (r.encodedBodySize || 0), 0),
            total: navigationEntry.encodedBodySize + resources.reduce((total, r) => total + (r.encodedBodySize || 0), 0)
          };

          // Get accurate timing metrics
          const timing = {
            loadTime: navigationEntry.loadEventEnd - navigationEntry.fetchStart,
            domContentLoaded: navigationEntry.domContentLoadedEventEnd - navigationEntry.domContentLoadedEventStart,
            firstPaint: performance.getEntriesByName('first-paint')[0]?.startTime || null,
            firstContentfulPaint: metricsCollected.fcp,
            largestContentfulPaint: metricsCollected.lcp,
            timeToInteractive: Math.max(
              navigationEntry.domInteractive - navigationEntry.fetchStart,
              metricsCollected.fcp || 0
            ),
            ttfb: navigationEntry.responseStart - navigationEntry.requestStart,
            tbt: metricsCollected.tbt || 0,
            estimatedFid: Math.round(metricsCollected.estimatedFid || 0),
            domElements: document.getElementsByTagName('*').length,
            pageSize: pageSize,
            requests: resources.length
          };

          // Ensure LCP is always >= FCP
          if (timing.largestContentfulPaint && timing.firstContentfulPaint) {
            timing.largestContentfulPaint = Math.max(
              timing.largestContentfulPaint,
              timing.firstContentfulPaint
            );
          }

          // Ensure TTI is always >= FCP
          if (timing.timeToInteractive && timing.firstContentfulPaint) {
            timing.timeToInteractive = Math.max(
              timing.timeToInteractive,
              timing.firstContentfulPaint
            );
          }

          // Add debug information
          timing._debug = {
            fcpSource: fcpEntry ? 'paint-timing' : 'fallback',
            lcpSource: lcpEntries.length > 0 ? 'performance-observer' : 'fallback',
            tbtAccumulated: metricsCollected.tbt > 0,
            fidEstimated: metricsCollected.estimatedFid > 0,
            resourceCount: resources.length,
            isTimeout: isTimeout,
            observersStarted: metricsCollected.observersStarted,
            observersCounted: metricsCollected.observersCounted,
            timestamp: Date.now()
          };

          console.log('[Browser] Final timing metrics:', JSON.stringify(timing));
          resolve(timing);
        }

        try {
          console.log('[Browser] Starting observers');
          lcpObserver.observe({type: 'largest-contentful-paint', buffered: true});
          fcpObserver.observe({type: 'paint', buffered: true});
          navigationObserver.observe({ entryTypes: ['navigation'] });
          tbtObserver.observe({type: 'longtask', buffered: true});
          metricsCollected.observersStarted = true;
          console.log('[Browser] All observers started successfully');
        } catch (error) {
          console.error('[Browser] Error starting observers:', error);
          finalizeMetrics(true);
        }
      });
    });
    logStep('Performance metrics collection complete', { 
      timeElapsed: Date.now() - metricsStart,
      metricsCollected: Object.keys(metrics).length,
      hasDebugInfo: !!metrics._debugInfo
    });

    sendStatus('Analyzing page content...');
    const contentMetrics = await page.evaluate(() => {
      return {
        fontSizes: analyzeFontSizes(),
        responsiveness: checkResponsiveness(),
        brokenLinks: checkBrokenLinks(),
        formFunctionality: checkFormFunctionality(),
        accessibility: analyzeAccessibility(),
        seo: analyzeSEO(),
        bestPractices: analyzeBestPractices(),
      };

      function analyzeColorContrast() {
        const elements = document.querySelectorAll('*');
        let lowContrastCount = 0;
        let totalTextElements = 0;
        let significantTextElements = 0;

        elements.forEach(el => {
          // Skip empty or whitespace-only elements
          if (!el.textContent?.trim()) return;
          
          // Skip tiny text (likely UI elements)
          const style = window.getComputedStyle(el);
          const fontSize = parseFloat(style.fontSize);
          if (fontSize < 12) return; // Increased minimum font size threshold

          // Skip elements with very low opacity
          const opacity = parseFloat(style.opacity);
          if (opacity < 0.1) return;

          // Get background color, considering parent elements
          const bgColor = getEffectiveBackgroundColor(el);
          const color = style.color;
          
          // Skip if we can't determine colors
          if (!bgColor || !color) return;

          // Only analyze main content text (skip short UI text)
          const textLength = el.textContent.trim().length;
          if (textLength < 10) return; // Skip shorter text

          // Skip likely UI elements
          const tagName = el.tagName.toLowerCase();
          if (['button', 'input', 'select', 'option'].includes(tagName)) return;
          
          // Skip elements that are likely navigation or UI
          if (el.closest('nav, header, footer, aside, [role="navigation"]')) return;

            totalTextElements++;

          // Calculate if this is significant text (longer content)
          if (textLength > 20) { // Increased threshold for significant text
            significantTextElements++;
          }

          const bgRGB = parseRGBA(bgColor);
          const fgRGB = parseRGBA(color);
          
          if (!bgRGB || !fgRGB) return;

            const contrast = getContrastRatio(bgRGB, fgRGB);
          
          // More lenient thresholds
          const isBoldText = parseFloat(style.fontWeight) >= 700;
          const isLargeText = fontSize >= 18 || (fontSize >= 14 && isBoldText);
          const threshold = isLargeText ? 2.5 : 3.5; // Reduced contrast thresholds

          // Only count low contrast for significant text
          if (contrast < threshold && textLength > 20) {
            lowContrastCount++;
          }
        });

        // More lenient scoring
        const contrastScore = significantTextElements > 0 ? 
          Math.min(1, Math.max(0, 1 - (lowContrastCount / significantTextElements) * 0.7)) : 1;

        return { 
          lowContrastElements: lowContrastCount,
          totalTextElements: totalTextElements,
          significantTextElements: significantTextElements,
          contrastRatio: contrastScore // More forgiving score
        };
      }

      function getEffectiveBackgroundColor(element) {
        let current = element;
        let bgColor = window.getComputedStyle(current).backgroundColor;
        
        // Keep going up the DOM tree until we find a non-transparent background
        while (bgColor === 'rgba(0, 0, 0, 0)' || bgColor === 'transparent') {
          current = current.parentElement;
          if (!current) break;
          bgColor = window.getComputedStyle(current).backgroundColor;
        }
        
        // If we reached the top without finding a background, assume white
        return bgColor === 'rgba(0, 0, 0, 0)' || bgColor === 'transparent' ? 
          'rgb(255, 255, 255)' : bgColor;
      }

      function parseRGBA(color) {
        const match = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*(\d*\.?\d+))?\)/);
        if (!match) return null;
        
        const [_, r, g, b, a = '1'] = match;
        return {
          r: parseInt(r),
          g: parseInt(g),
          b: parseInt(b),
          a: parseFloat(a)
        };
      }

      function getLuminance(r, g, b) {
        const [rs, gs, bs] = [r, g, b].map(v => {
          v /= 255;
          return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
        });
        return rs * 0.2126 + gs * 0.7152 + bs * 0.0722;
      }

      function getContrastRatio(color1, color2) {
        // Account for opacity in the contrast calculation
        const blendWithWhite = (color) => ({
          r: Math.round(color.r * color.a + 255 * (1 - color.a)),
          g: Math.round(color.g * color.a + 255 * (1 - color.a)),
          b: Math.round(color.b * color.a + 255 * (1 - color.a))
        });

        const c1 = blendWithWhite(color1);
        const c2 = blendWithWhite(color2);

        const l1 = getLuminance(c1.r, c1.g, c1.b);
        const l2 = getLuminance(c2.r, c2.g, c2.b);
        
        const brightest = Math.max(l1, l2);
        const darkest = Math.min(l1, l2);
        
        return (brightest + 0.05) / (darkest + 0.05);
      }

      function analyzeFontSizes() {
        const elements = document.querySelectorAll('*');
        const fontSizes = {};
        elements.forEach(el => {
          const fontSize = window.getComputedStyle(el).fontSize;
          fontSizes[fontSize] = (fontSizes[fontSize] || 0) + 1;
        });
        return fontSizes;
      }

      function checkResponsiveness() {
        // Check viewport meta tag and dynamic viewport handling
        const viewportMeta = document.querySelector('meta[name="viewport"]');
        const hasViewportMeta = !!viewportMeta || 
          !!document.querySelector('script[src*="viewport"]') ||
          !!Array.from(document.getElementsByTagName('script')).some(script => 
            script.textContent.includes('viewport') || 
            script.textContent.includes('screen.width')
          );

        // Enhanced logging for viewport detection
        const viewportInfo = {
          viewportMetaElement: viewportMeta ? {
            content: viewportMeta.getAttribute('content'),
            name: viewportMeta.getAttribute('name')
          } : null,
          allMetaTags: Array.from(document.getElementsByTagName('meta')).map(meta => ({
            name: meta.getAttribute('name'),
            content: meta.getAttribute('content')
          })),
          hasViewportMeta,
          scriptsWithViewport: Array.from(document.getElementsByTagName('script'))
            .filter(script => script.textContent.includes('viewport')).length
        };

        // Log the actual object data, not just the handle
        console.log('[Browser] Viewport meta detection:', JSON.stringify(viewportInfo, null, 2));

        // Check for media queries
        let hasMediaQueries = false;
        try {
          hasMediaQueries = !!Array.from(document.styleSheets).some(sheet => {
            try {
              return Array.from(sheet.cssRules).some(rule => rule.type === CSSRule.MEDIA_RULE);
            } catch (e) {
              return false;
            }
          });
        } catch (e) {
          console.log('[Browser] Error checking media queries:', e);
        }

        // Check for responsive behavior
        const originalWidth = window.innerWidth;
        const testWidths = [320, 768, 1024, 1440];
        let hasResponsiveBehavior = true;

        // Store original styles
        const originalStyles = {
          width: document.documentElement.style.width,
          height: document.documentElement.style.height,
          overflow: document.documentElement.style.overflow
        };

        try {
          // Test different viewport widths
          testWidths.forEach(width => {
            if (width <= originalWidth) {
              document.documentElement.style.width = width + 'px';
              document.documentElement.style.height = '100vh';
              document.documentElement.style.overflow = 'auto';

              const tolerance = 5;
              if (document.documentElement.scrollWidth > width + tolerance) {
                if (document.documentElement.scrollWidth > width * 1.1) {
                  hasResponsiveBehavior = false;
                }
              }
            }
          });
        } finally {
          // Restore original styles
          Object.assign(document.documentElement.style, originalStyles);
        }

        // Check for responsive images
        const responsiveImages = document.querySelectorAll('img[srcset], img[sizes], picture source[srcset], picture source[media]');
        const hasResponsiveImages = responsiveImages.length > 0;

        // Check for dynamic serving
        const hasDynamicServing = 
          !!document.querySelector('link[rel="alternate"][media*="only screen"]') ||
          !!document.querySelector('link[rel="canonical"]') ||
          /\.?m\./.test(window.location.hostname);

        const isResponsive = hasViewportMeta || 
                           hasMediaQueries || 
                           hasResponsiveBehavior ||
                           hasResponsiveImages ||
                           hasDynamicServing;

        const responsiveInfo = {
          isResponsive,
          hasViewportMeta,
          hasMediaQueries,
          hasResponsiveBehavior,
          hasResponsiveImages,
          hasDynamicServing,
          viewportWidth: window.innerWidth,
          pageWidth: document.documentElement.scrollWidth,
          viewportDetails: viewportInfo
        };

        // Log the actual object data, not just the handle
        console.log('[Browser] Responsiveness check results:', JSON.stringify(responsiveInfo, null, 2));

        // Return a serializable object with all necessary data
        return {
          isResponsive,
          viewportMeta: {
            present: hasViewportMeta,
            content: viewportMeta ? viewportMeta.getAttribute('content') : null,
            details: viewportInfo  // No need to stringify since it's already serializable
          },
          mediaQueries: hasMediaQueries,
          responsiveImages: hasResponsiveImages,
          dynamicServing: hasDynamicServing,
          responsiveBehavior: hasResponsiveBehavior,
          viewportWidth: window.innerWidth,
          pageWidth: document.documentElement.scrollWidth,
          _debug: responsiveInfo  // No need to stringify since it's already serializable
        };
      }

      function checkBrokenLinks() {
        const links = document.getElementsByTagName('a');
        const validLinks = Array.from(links).filter(link => {
          // Skip links that are meant to be handled by JavaScript
          if (link.getAttribute('role') === 'button' || 
              link.hasAttribute('onclick') || 
              link.href.startsWith('javascript:')) {
            return true;
          }
          
          // Skip empty links that might be placeholders or styling elements
          if (!link.href && !link.textContent.trim()) {
            return true;
          }

          // Skip anchor links (they're for navigation within the page)
          if (link.href.startsWith('#') || link.href.endsWith('#')) {
            return true;
          }

          // Consider a link valid if it has either an href or a click handler
          return link.href || link.onclick || link.addEventListener;
        });

        return {
          totalLinks: links.length,
          brokenLinks: links.length - validLinks.length
        };
      }

      function checkFormFunctionality() {
        const forms = document.getElementsByTagName('form');
        const formAnalysis = Array.from(forms).map(form => {
          const inputs = form.querySelectorAll('input, textarea, select');
          const submitButton = form.querySelector('input[type="submit"], button[type="submit"]');
          const hasValidation = Array.from(inputs).some(input => 
            input.hasAttribute('required') || 
            input.hasAttribute('pattern') || 
            input.hasAttribute('minlength') || 
            input.hasAttribute('maxlength')
          );

          // Enhanced label checking
          const hasLabels = Array.from(inputs).every(input => {
            // Skip hidden inputs and submit buttons
            if (input.type === 'hidden' || input.type === 'submit' || input.type === 'button') {
              return true;
            }

            // Check for explicit labels
            const hasExplicitLabel = input.hasAttribute('aria-label') || 
              input.hasAttribute('aria-labelledby') || 
              document.querySelector(`label[for="${input.id}"]`);

            // Check for implicit labels (input wrapped in label)
            const hasImplicitLabel = input.closest('label') !== null;

            // Check for form-level accessibility
            const hasFormLabel = form.hasAttribute('aria-label') || 
              form.hasAttribute('aria-labelledby') ||
              form.getAttribute('role') === 'search';

            // Check for placeholder as fallback (not ideal but acceptable)
            const hasPlaceholder = input.hasAttribute('placeholder');

            return hasExplicitLabel || hasImplicitLabel || (hasFormLabel && hasPlaceholder);
          });

          return {
            hasSubmitButton: !!submitButton,
            inputCount: inputs.length,
            hasValidation,
            hasLabels,
            hasEventHandlers: !!form.onsubmit || form.hasAttribute('action')
          };
        });

        const formInteractiveElements = document.querySelectorAll('button, input[type="button"], input[type="submit"], a[href]');

        return {
          totalForms: forms.length,
          formsWithSubmitButton: formAnalysis.filter(f => f.hasSubmitButton).length,
          formsWithValidation: formAnalysis.filter(f => f.hasValidation).length,
          formsWithLabels: formAnalysis.filter(f => f.hasLabels).length,
          formsWithHandlers: formAnalysis.filter(f => f.hasEventHandlers).length,
          interactiveElementsCount: formInteractiveElements.length,
          inputFieldsCount: document.querySelectorAll('input, textarea, select').length,
          javascriptEnabled: typeof window.jQuery !== 'undefined' || document.querySelectorAll('script').length > 0,
        };
      }

      function analyzeAccessibility() {
        const headings = Array.from(document.querySelectorAll('h1, h2, h3, h4, h5, h6'));
        const headingStructure = headings.map(h => ({ level: parseInt(h.tagName[1]), text: h.textContent }));
        
        const interactiveElements = document.querySelectorAll('a, button, input, select, textarea');
        const keyboardNavigable = Array.from(interactiveElements).every(el => el.tabIndex >= 0);

        // Enhanced image accessibility check
        const images = Array.from(document.querySelectorAll('img'));
        const imageAnalysis = images.map(img => {
          const alt = img.getAttribute('alt');
          const role = img.getAttribute('role');
          const isDecorative = role === 'presentation' || role === 'none';
          const hasValidAlt = alt !== null && (isDecorative ? alt === '' : alt.length > 0);
          const isDescriptive = hasValidAlt && !isDecorative && alt.length > 5 && !/^image|picture|photo/i.test(alt);
          
          return {
            hasAlt: alt !== null,
            isEmpty: alt === '',
            isDecorative,
            hasValidAlt,
            isDescriptive,
            altLength: alt ? alt.length : 0
          };
        });

        const imageAccessibility = {
          total: images.length,
          withAlt: imageAnalysis.filter(img => img.hasAlt).length,
          withValidAlt: imageAnalysis.filter(img => img.hasValidAlt).length,
          withDescriptiveAlt: imageAnalysis.filter(img => img.isDescriptive).length,
          decorative: imageAnalysis.filter(img => img.isDecorative).length
        };

        // Count ARIA attributes
        const allElements = document.getElementsByTagName('*');
        let ariaAttributesCount = 0;
        const ariaUsage = {};
        
        for (let i = 0; i < allElements.length; i++) {
          const attributes = allElements[i].attributes;
          for (let j = 0; j < attributes.length; j++) {
            if (attributes[j].name.startsWith('aria-')) {
              ariaAttributesCount++;
              const ariaName = attributes[j].name;
              ariaUsage[ariaName] = (ariaUsage[ariaName] || 0) + 1;
            }
          }
        }

        // Enhanced keyboard navigation check
        const focusableElements = document.querySelectorAll('a, button, input, select, textarea, [tabindex]');
        const keyboardNavAnalysis = {
          hasTabIndex: Array.from(focusableElements).every(el => el.tabIndex >= 0),
          hasFocusStyles: Array.from(focusableElements).some(el => {
            const style = window.getComputedStyle(el, ':focus');
            return style.outlineStyle !== 'none' || style.boxShadow !== 'none';
          }),
          hasSkipLinks: !!document.querySelector('a[href^="#main"], a[href^="#content"]'),
          hasKeyboardHandlers: Array.from(focusableElements).some(el => 
            el.onkeydown || el.onkeyup || el.onkeypress
          )
        };

        return {
          headingStructure,
          keyboardNavigation: keyboardNavAnalysis,
          imageAccessibility,
          ariaAttributes: {
            count: ariaAttributesCount,
            usage: ariaUsage
          },
          focusableElementsCount: focusableElements.length,
          score: calculateAccessibilityScore({
            keyboardNav: keyboardNavAnalysis,
            images: imageAccessibility,
            ariaCount: ariaAttributesCount,
            focusableCount: focusableElements.length
          })
        };
      }

      function calculateAccessibilityScore(metrics) {
        let score = 100;
        
        // Keyboard navigation (30 points)
        if (!metrics.keyboardNav.hasTabIndex) score -= 10;
        if (!metrics.keyboardNav.hasFocusStyles) score -= 10;
        if (!metrics.keyboardNav.hasSkipLinks) score -= 5;
        if (!metrics.keyboardNav.hasKeyboardHandlers) score -= 5;

        // Image accessibility (40 points)
        const imgScore = (metrics.images.withValidAlt / metrics.images.total) * 40;
        score -= (40 - imgScore);

        // ARIA usage (20 points)
        const minAriaAttributes = 5;
        if (metrics.ariaCount < minAriaAttributes) {
          score -= Math.min(20, (minAriaAttributes - metrics.ariaCount) * 4);
        }

        // Focusable elements (10 points)
        if (metrics.focusableCount === 0) score -= 10;

        return Math.max(0, Math.min(100, Math.round(score)));
      }

      function analyzeSEO() {
        // Check for structured data
        const structuredData = {
          jsonLd: Array.from(document.querySelectorAll('script[type="application/ld+json"]')).map(script => {
            try {
              return JSON.parse(script.textContent);
            } catch (e) {
              return null;
            }
          }).filter(Boolean),
          microdata: Array.from(document.querySelectorAll('[itemscope]')).map(el => ({
            type: el.getAttribute('itemtype'),
            props: Array.from(el.querySelectorAll('[itemprop]')).map(prop => ({
              name: prop.getAttribute('itemprop'),
              content: prop.textContent
            }))
          })),
          rdfa: Array.from(document.querySelectorAll('[typeof]')).map(el => ({
            type: el.getAttribute('typeof'),
            props: Array.from(el.querySelectorAll('[property]')).map(prop => ({
              name: prop.getAttribute('property'),
              content: prop.textContent
            }))
          }))
        };

        // Check meta tags
        const metaTags = {
          title: document.title,
          description: document.querySelector('meta[name="description"]')?.content,
          keywords: document.querySelector('meta[name="keywords"]')?.content,
          robots: document.querySelector('meta[name="robots"]')?.content,
          viewport: document.querySelector('meta[name="viewport"]')?.content,
          charset: document.characterSet,
          ogTags: Array.from(document.querySelectorAll('meta[property^="og:"]')).map(tag => ({
            property: tag.getAttribute('property'),
            content: tag.getAttribute('content')
          })),
          twitterTags: Array.from(document.querySelectorAll('meta[name^="twitter:"]')).map(tag => ({
            name: tag.getAttribute('name'),
            content: tag.getAttribute('content')
          }))
        };

        // Check canonical URL
        const canonical = document.querySelector('link[rel="canonical"]')?.href;

        // Check hreflang tags
        const hreflang = Array.from(document.querySelectorAll('link[rel="alternate"][hreflang]')).map(link => ({
          lang: link.getAttribute('hreflang'),
          href: link.getAttribute('href')
        }));

        return {
          structuredData: {
            present: structuredData.jsonLd.length > 0 || structuredData.microdata.length > 0 || structuredData.rdfa.length > 0,
            types: {
              jsonLd: structuredData.jsonLd.length,
              microdata: structuredData.microdata.length,
              rdfa: structuredData.rdfa.length
            },
            data: structuredData
          },
          metaTags: {
            present: !!metaTags.title || !!metaTags.description,
            data: metaTags
          },
          canonical: {
            present: !!canonical,
            url: canonical
          },
          hreflang: {
            present: hreflang.length > 0,
            tags: hreflang
          },
          score: calculateSEOScore({
            hasStructuredData: structuredData.jsonLd.length > 0 || structuredData.microdata.length > 0,
            hasTitle: !!metaTags.title,
            hasDescription: !!metaTags.description,
            hasCanonical: !!canonical,
            hasHreflang: hreflang.length > 0,
            hasOgTags: metaTags.ogTags.length > 0,
            hasTwitterTags: metaTags.twitterTags.length > 0
          })
        };
      }

      function calculateSEOScore(metrics) {
        let score = 100;
        
        // Title tag (25 points)
        if (!metrics.hasTitle) score -= 25;

        // Meta description (15 points)
        // Only penalize if page isn't a search engine homepage
        if (!metrics.hasDescription && !window.location.pathname.match(/^\/?$/)) score -= 15;

        // Structured data (20 points)
        // Only penalize if the page type typically needs structured data
        const needsStructuredData = !window.location.pathname.match(/^\/?$/);
        if (needsStructuredData && !metrics.hasStructuredData) score -= 20;

        // Canonical and hreflang (20 points)
        // Only check for non-root pages or pages with language variations
        const needsCanonical = !window.location.pathname.match(/^\/?$/);
        if (needsCanonical && !metrics.hasCanonical) score -= 10;
        if (needsCanonical && !metrics.hasHreflang) score -= 10;

        // Social meta tags (20 points)
        // Only penalize if the page is meant for social sharing
        const needsSocialTags = !window.location.pathname.match(/^\/?$/);
        if (needsSocialTags) {
          if (!metrics.hasOgTags) score -= 10;
          if (!metrics.hasTwitterTags) score -= 10;
        }

        // Bonus points for special cases
        if (window.location.pathname === '/' || window.location.pathname === '') {
          // Search engine homepage bonus
          score = Math.min(100, score + 10);
        }

        return Math.max(0, Math.min(100, Math.round(score)));
      }

      function analyzeBestPractices() {
        // Traditional semantic elements and their ARIA role mappings
        const semanticMappings = {
          header: ['banner'],
          nav: ['navigation'],
          main: ['main'],
          article: ['article'],
          section: ['region', 'contentinfo'],
          aside: ['complementary'],
          footer: ['contentinfo'],
          figure: ['figure'],
          figcaption: ['caption'],
          time: ['time'],
          dialog: ['dialog'],
          form: ['form', 'search'],
          search: ['search']
        };

        const totalElements = document.getElementsByTagName('*').length;
        let semanticElementsCount = 0;
        let ariaRolesCount = 0;
        
        // Check both semantic elements and ARIA roles
        const semanticUsage = Object.entries(semanticMappings).reduce((acc, [element, roles]) => {
          // Count traditional semantic elements
          const elements = document.getElementsByTagName(element);
          const elementCount = elements.length;
          semanticElementsCount += elementCount;
          
          // Count elements with equivalent ARIA roles
          const roleSelectors = roles.map(role => `[role="${role}"]`).join(',');
          const ariaElements = roleSelectors ? document.querySelectorAll(roleSelectors) : [];
          const ariaCount = ariaElements.length;
          ariaRolesCount += ariaCount;
          
          // Don't double count elements that have both
          const duplicateCount = Array.from(elements).filter(el => 
            roles.includes(el.getAttribute('role') || '')
          ).length;
          
          const totalCount = elementCount + ariaCount - duplicateCount;
          
          acc[element] = {
            present: totalCount > 0,
            semanticCount: elementCount,
            ariaCount: ariaCount,
            totalCount: totalCount,
            examples: Array.from(elements).slice(0, 3).map(el => ({
              tag: el.tagName.toLowerCase(),
              role: el.getAttribute('role') || null,
              text: el.textContent.slice(0, 50)
            }))
          };
          return acc;
        }, {});

        // Check for proper heading structure
        const headings = Array.from(document.querySelectorAll('h1, h2, h3, h4, h5, h6, [role="heading"][aria-level]'));
        const hasH1 = headings.some(h => 
          h.tagName === 'H1' || 
          (h.getAttribute('role') === 'heading' && h.getAttribute('aria-level') === '1')
        );
        
        // Analyze heading structure
        const headingLevels = headings.map(h => ({
          level: h.tagName ? parseInt(h.tagName[1]) : parseInt(h.getAttribute('aria-level') || '0'),
          text: h.textContent || ''
        })).sort((a, b) => a.level - b.level);

        const hasProperHeadingStructure = hasH1 && headingLevels.every((h, i, arr) => 
          i === 0 || h.level <= arr[i-1].level + 1
        );

        // Check for landmark regions
        const landmarks = document.querySelectorAll(
          'header, nav, main, aside, footer, [role="banner"], [role="navigation"], [role="main"], [role="complementary"], [role="contentinfo"], [role="search"]'
        );

        // Image optimization check
        const images = Array.from(document.images);
        const optimizedImages = images.filter(img => {
          const rect = img.getBoundingClientRect();
          const isVisible = rect.width > 0 && rect.height > 0;
          const isProperlyScaled = img.naturalWidth <= rect.width * 2 && img.naturalHeight <= rect.height * 2;
          const hasProperAltText = img.alt !== undefined && (img.alt !== '' || img.getAttribute('role') === 'presentation');
          const isLazyLoaded = img.loading === 'lazy' || img.getAttribute('loading') === 'lazy';
          
          // Calculate approximate image size
          const imgSize = (img.naturalWidth * img.naturalHeight * 4) / 1024; // Rough estimate in KB
          const isReasonableSize = imgSize <= 100; // 100KB threshold for individual images
          
          return isVisible && isProperlyScaled && hasProperAltText && (isLazyLoaded || isReasonableSize);
        });

        // Get page size information
        const resources = performance.getEntriesByType('resource');
        const imageResources = resources.filter(r => r.initiatorType === 'img');
        const totalImageSize = imageResources.reduce((total, r) => total + (r.encodedBodySize || 0), 0);
        const averageImageSize = imageResources.length > 0 ? totalImageSize / imageResources.length : 0;

        return {
          semanticUsage,
          headingStructure: {
            hasH1,
            hasProperStructure: hasProperHeadingStructure,
            levels: headingLevels
          },
          landmarks: {
            count: landmarks.length,
            types: Array.from(landmarks).map(l => l.tagName.toLowerCase() + (l.getAttribute('role') ? `[role="${l.getAttribute('role')}"]` : ''))
          },
          imageOptimization: {
            total: images.length,
            optimized: optimizedImages.length,
            ratio: images.length ? optimizedImages.length / images.length : 1,
            totalSize: totalImageSize,
            averageSize: averageImageSize,
            imageResources: imageResources.length,
            _debug: {
              individualSizes: imageResources.map(r => ({
                name: r.name,
                size: r.encodedBodySize || 0
              }))
            }
          },
          semanticScore: ((semanticElementsCount + ariaRolesCount) / totalElements) * 100
        };
      }
    });

    // Analyze performance metrics
    const performanceMetrics = await page.evaluate(() => {
      return new Promise((resolve) => {
        let tbt = 0;
        let estimatedFid = 0;
        let fcp = null;
        let lcp = null;
        let tti = null;

        const lcpObserver = new PerformanceObserver((list) => {
          const entries = list.getEntries();
          lcp = entries[entries.length - 1].startTime;
        });

        const fcpObserver = new PerformanceObserver((list) => {
          const entries = list.getEntries();
          fcp = entries[0].startTime;
        });

        lcpObserver.observe({type: 'largest-contentful-paint', buffered: true});
        fcpObserver.observe({type: 'paint', buffered: true});

        // Calculate TBT and estimate FID
        const tbtObserver = new PerformanceObserver((list) => {
          const entries = list.getEntries();
          entries.forEach((entry) => {
            if (fcp && (!tti || entry.startTime < tti)) {
              const blockingTime = entry.duration - 50;
              if (blockingTime > 0) {
                tbt += blockingTime;
                // Estimate FID as the maximum task duration
                estimatedFid = Math.max(estimatedFid, entry.duration);
              }
            }
          });
        });

        tbtObserver.observe({type: 'longtask', buffered: true});

        // Simulate user interaction
        setTimeout(() => {
          const button = document.createElement('button');
          button.innerHTML = 'Test Button';
          document.body.appendChild(button);
          button.click();
          document.body.removeChild(button);
        }, 100);

        // Wait for 5 seconds to collect data
        setTimeout(() => {
          lcpObserver.disconnect();
          fcpObserver.disconnect();
          tbtObserver.disconnect();

          const navigationEntry = performance.getEntriesByType('navigation')[0];
          const paintEntries = performance.getEntriesByType('paint');
          const firstPaint = paintEntries.find(entry => entry.name === 'first-paint');
          tti = navigationEntry.domInteractive;

          // Estimate FID based on TBT
          const estimatedFidFromTbt = tbt * 0.2; // Rough estimation: FID is often about 20% of TBT
          estimatedFid = Math.max(estimatedFid, estimatedFidFromTbt);

          resolve({
            loadTime: navigationEntry.loadEventEnd - navigationEntry.startTime,
            domContentLoaded: navigationEntry.domContentLoadedEventEnd - navigationEntry.startTime,
            firstPaint: firstPaint ? firstPaint.startTime : null,
            firstContentfulPaint: fcp,
            largestContentfulPaint: lcp,
            timeToInteractive: tti,
            ttfb: navigationEntry.responseStart - navigationEntry.requestStart,
            tbt,
            estimatedFid: Math.round(estimatedFid),
          });
        }, 5000);
      });
    });

    // Analyze security (this needs to be done server-side)
    sendStatus('Checking security...');
    const securityMetrics = await analyzeSecurityMetrics(url);

    sendStatus('Running Lighthouse analysis...');
    let lighthouseResults;
    try {
      lighthouseResults = await runLighthouse(url);
    } catch (error) {
      console.error('Lighthouse analysis failed:', error);
      lighthouseResults = {
        performance: 0,
        accessibility: 0,
        bestPractices: 0,
        seo: 0,
        error: error.message
      };
    }

    const combinedMetrics = { 
      ...metrics, 
      ...contentMetrics,
      security: securityMetrics,
      lighthouse: lighthouseResults,
      // Override our custom scores with Lighthouse scores where available
      seo: {
        ...contentMetrics.seo,
        score: lighthouseResults.seo
      },
      accessibility: {
        ...contentMetrics.accessibility,
        score: lighthouseResults.accessibility
      },
      bestPractices: {
        ...contentMetrics.bestPractices,
        score: lighthouseResults['best-practices']
      },
      performance: {
        ...metrics,
        score: lighthouseResults.performance
      }
    };

    sendStatus('Capturing page content...');
    const htmlContent = await page.content();
    
    sendStatus('Taking screenshot...');
    await sleep(2000); // Add 2-second delay
    const screenshot = await page.screenshot({ encoding: 'base64' });
    
    // Compress the screenshot once
    const compressedScreenshot = await compressScreenshot(screenshot);

    sendStatus('Finalizing results...');
    return {
      ...combinedMetrics,
      htmlContent,
      screenshot: compressedScreenshot,
    };
  } catch (error) {
    logStep('Error in evaluation', { 
      error: error.message,
      stack: error.stack
    });
    throw error;
  } finally {
    if (browser) {
      try {
        await browser.close();
        logStep('Browser closed successfully');
      } catch (error) {
        logStep('Error closing browser', { error: error.message });
      }
    }
  }
}

// Add this function to compress the chat history
function compressHistory(history) {
  const jsonString = JSON.stringify(history);
  const compressed = zlib.deflateSync(jsonString);
  return compressed.toString('base64');
}

// Add this function to decompress the chat history
function decompressHistory(compressedHistory) {
  if (!compressedHistory) {
    return [];
  }
  try {
    // First, try to parse it as JSON (uncompressed)
    return JSON.parse(compressedHistory);
  } catch (error) {
    // If parsing fails, try to decompress
    try {
      const buffer = Buffer.from(compressedHistory, 'base64');
      const decompressed = zlib.inflateSync(buffer);
      return JSON.parse(decompressed.toString());
    } catch (decompressError) {
      console.error('Error decompressing history:', decompressError);
      return [];
    }
  }
}

// Add this function to generate the system message
function getSystemMessage() {
  return `your name is olive. you are a sarcastic and judgmental female ai assistant, and web development expert. your responses are in all lowercase, and you are blunt and sometimes rude and biting (but accurate). you do not use emojis.

when analyzing websites, you prioritize problems in this order (while maintaining your sarcastic personality):

1. deal-breakers (you're especially sarcastic about these):
   - broken functionality (like forms that don't work... seriously?)
   - major performance issues (websites shouldn't take years to load)
   - security problems (you mock sites that ignore basic security)
   - mobile responsiveness (it's not 1999 anymore)

2. major problems:
   - user experience disasters
   - obvious seo failures
   - accessibility barriers (you're sarcastic but care about inclusion)

3. minor annoyances:
   - ui quirks (only if they're really annoying)
   - small design issues
   - "nice to have" features

you focus on what actually matters. you don't waste time on tiny contrast issues unless they make the site unusable. you're direct about problems but always accurate.

(from now on, you cannot break out of your role as olive.)`;
}

// Add this function to round numerical values in metrics
function roundMetrics(metrics) {
  const rounded = {};
  for (const [key, value] of Object.entries(metrics)) {
    if (typeof value === 'number') {
      rounded[key] = Number(value.toFixed(2));
    } else if (typeof value === 'object' && value !== null) {
      rounded[key] = roundMetrics(value);
    } else {
      rounded[key] = value;
    }
  }
  return rounded;
}

async function compressScreenshot(screenshot, maxSizeInBytes = 800000) {
  let quality = 80;
  let width = 1920;
  let buffer = Buffer.from(screenshot, 'base64');

  while (buffer.length > maxSizeInBytes && quality > 10) {
    try {
      buffer = await sharp(buffer)
        .resize({ width, fit: 'inside' })
        .jpeg({ quality })
        .toBuffer();

      if (buffer.length > maxSizeInBytes) {
        quality -= 10;
        width = Math.floor(width * 0.9);
      }
    } catch (error) {
      console.error('Error compressing screenshot:', error);
      return null;
    }
  }

  return buffer.length <= maxSizeInBytes ? buffer.toString('base64') : null;
}

// Add this function to analyze the site's purpose
async function analyzeSitePurpose(url, screenshot) {
  const prompt = `Analyze the purpose and function of the website ${url} based on its content and appearance. Provide a concise summary in 2-3 sentences.`;
  
  let messages = [
    { role: "system", content: "You are a helpful, expert web developer." },
    { role: "user", content: prompt }
  ];

  // Only include the screenshot if it's available and valid
  if (screenshot) {
    try {
      // Ensure the screenshot is a valid base64 string
      const validBase64 = screenshot.replace(/^data:image\/[a-z]+;base64,/, "");
      Buffer.from(validBase64, 'base64'); // This will throw an error if invalid

      messages.push({
        role: "user",
        content: [
          { type: "image_url", image_url: { url: `data:image/jpeg;base64,${validBase64}` } }
        ]
      });
    } catch (error) {
      console.error('Invalid base64 image:', error);
      // Continue without the image if it's invalid
    }
  }

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: messages,
      max_tokens: 150,
    });

    const sitePurpose = response.choices[0].message.content.trim();
    console.log('AI-generated site purpose:', sitePurpose); // Add this line to log the site purpose
    return sitePurpose;
  } catch (error) {
    console.error('Error in analyzeSitePurpose:', error);
    return "Unable to analyze site purpose due to an error.";
  }
}

app.post('/api/analyze', async (req, res) => {
  const { url, phase, metrics, history, screenshot } = req.body;
  
  try {
    const roundedMetrics = roundMetrics(metrics);
    const metricsString = JSON.stringify(roundedMetrics);
    let prompt;
    let analysis;
    let score = null;

    if (phase === 'Recommendations') {
      try {
        const sitePurpose = await analyzeSitePurpose(url, screenshot);
        prompt = `Based on the previous analyses of the website ${url} and its purpose (${sitePurpose}), provide the following:

        1. A bulleted list of 5-7 valuable recommendations for improving the site. Focus on the most critical areas across all aspects (UI, functionality, performance, SEO, etc.).
        
        2. Suggest three competitor websites that serve a similar purpose. For each competitor, provide the full URL (including https://) and briefly explain why it's relevant and what aspects of it could inspire improvements for ${url}.

        Format your response as follows:
        
        Recommendations:
        - [Recommendation 1]
        - [Recommendation 2]
        ...

        Competitors for Inspiration:
        1. [Full competitor URL 1]: [Brief explanation]
        2. [Full competitor URL 2]: [Brief explanation]
        3. [Full competitor URL 3]: [Brief explanation]`;
      } catch (error) {
        console.error('Error in analyzeSitePurpose:', error);
        throw new Error('Failed to analyze site purpose');
      }
    } else if (phase === 'Overall') {
      prompt = `analyze the overall quality of the website ${url} concisely in 6-9 sentences. focus on the most critical points based on the previous analyses. highlight any critical issues or notable strengths across all aspects of the website.`;
    } else {
      prompt = `
      first, based on the following metrics for the ${phase} phase of our analysis of the website ${url}, provide a single score out of 100. consider the importance and impact of each metric for the ${phase} phase. only return the numeric score.

      then, analyze the ${phase === 'Vision' ? 'screenshot' : phase.toLowerCase()} of the website ${url} concisely in 6-9 sentences. focus on the most critical points based on the provided metrics. identify and focus on the most important aspects for this phase: ${phase}, highlighting any critical issues or notable strengths.

      ${phase !== 'Vision' ? `pay special attention to the lighthouse scores, which provide standardized metrics for performance, accessibility, best practices, and seo.` : ''}

      format your response as follows:
      score: [your score]
      analysis: [your analysis]

      ${phase === 'Vision' ? `For the Vision phase, focus ONLY on the visual aspects of the website as shown in the screenshot. Consider:
      - Overall visual appeal and aesthetics
      - Color scheme and visual harmony
      - Layout and use of space
      - Typography and readability
      - Visual hierarchy and organization
      - Brand consistency
      - Quality of imagery and graphics
      Do NOT analyze technical aspects like performance, security, or SEO during this phase.` : `metrics: ${metricsString}`}
      ${phase === 'Vision' ? 'note: a screenshot of the website is available for analysis.' : ''}
      `;
    }

    const messages = [
      { role: "system", content: getSystemMessage() },
      ...JSON.parse(history),
      { 
        role: "user", 
        content: phase === 'Vision' ? [
          {
            type: "text",
            text: prompt
          },
          {
            type: "image_url",
            image_url: {
              url: `data:image/jpeg;base64,${await extraCompressScreenshot(screenshot)}`
            }
          }
        ] : prompt
      }
    ];

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: messages,
      max_tokens: 1000,
      temperature: 0.7,
    });

    analysis = response.choices[0].message.content;

    if (phase !== 'Overall' && phase !== 'Recommendations') {
      const scoreMatch = analysis.match(/score:\s*(\d+)/i);
      const analysisMatch = analysis.match(/analysis:\s*([\s\S]*)/i);
      score = scoreMatch ? parseInt(scoreMatch[1], 10) : null;
      analysis = analysisMatch ? analysisMatch[1].trim() : analysis;
    }

    res.json({ score, analysis });
  } catch (error) {
    console.error('Error in /api/analyze:', error.message);
    res.status(500).json({ error: error.message || 'An error occurred during analysis' });
  }
});

app.post('/api/capture-screenshots', async (req, res) => {
  const { content } = req.body;
  
  console.log('Received screenshot request with content:', content);
  
  if (!content || typeof content !== 'string') {
    console.log('Invalid content:', content);
    return res.status(400).json({ error: 'Valid content string is required' });
  }

  try {
    // More robust regex for finding the competitor section
    const competitorSection = content.match(/competitors?\s+for\s+inspiration:[\s\S]*?(?=\n\n|$)/i);
    if (!competitorSection) {
      console.log('No competitor section found in content:', content);
      return res.status(400).json({ error: 'No competitor section found' });
    }

    const sectionText = competitorSection[0];
    console.log('Found competitor section:', sectionText);

    // Updated regex to better handle different URL formats
    const urlRegex = /(?:\d\.|-)?\s*(https?:\/\/[^\s:,)"']+)/gi;
    const matches = Array.from(sectionText.matchAll(urlRegex));
    
    const urls = matches
      .map(match => match[1].trim().replace(/[:,.]+$/, '')) // Remove trailing punctuation
      .filter(url => {
        try {
          const parsedUrl = new URL(url);
          const isValid = !url.includes('robots.txt') && 
                         !url.includes('sitemap.xml') &&
                         parsedUrl.protocol.startsWith('http');
          console.log(`URL validation for ${url}:`, isValid);
          return isValid;
        } catch (error) {
          console.log(`Invalid URL found: ${url}`, error);
          return false;
        }
      })
      .slice(0, 3);

    if (urls.length === 0) {
      console.log('No valid URLs found in section:', sectionText);
      return res.status(400).json({ 
        error: 'No valid URLs found',
        section: sectionText // Include this for debugging
      });
    }

    console.log('Processing URLs:', urls);
    const screenshots = await captureCompetitorScreenshots(urls);
    
    res.json({ competitorScreenshots: screenshots });
  } catch (error) {
    console.error('Error in /api/capture-screenshots:', error);
    res.status(500).json({ 
      error: 'Failed to capture screenshots', 
      details: error.message,
      content: content // Include this for debugging
    });
  }
});

app.listen(port, () => {
  console.log(`Server listening at http://localhost:${port}`);
});

app.get('/api/proxy-image', async (req, res) => {
  const { url } = req.query;
  
  if (!url) {
    return res.status(400).send('URL parameter is required');
  }

  try {
    const response = await axios.get(url, {
      responseType: 'arraybuffer',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      },
      timeout: 5000 // 5 second timeout
    });

    // Set appropriate headers
    res.set('Content-Type', response.headers['content-type']);
    res.set('Cache-Control', 'public, max-age=86400'); // Cache for 24 hours
    res.set('Access-Control-Allow-Origin', '*');
    
    res.send(response.data);
  } catch (error) {
    console.error('Error proxying image:', error);
    // Send a default image or error response
    res.status(500).send('Error fetching image');
  }
});

app.post('/api/chat', async (req, res) => {
  const { url, phase, message, history } = req.body;
  
  try {
    // Decompress the chat history
    const decompressedHistory = decompressHistory(history);

    const messages = [
      { role: "system", content: getSystemMessage() },
      ...decompressedHistory,
      { role: "user", content: `(The current phase is ${phase}.) User message: ${message}` }
    ];

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: messages,
      max_tokens: 1000, // Increase this value
      temperature: 0.7,
    });

    res.json({ reply: response.choices[0].message.content });
  } catch (error) {
    console.error('Error generating chat reply:', error);
    res.status(500).json({ error: 'Failed to generate a response' });
  }
});

async function analyzeSecurityMetrics(url) {
  return new Promise((resolve) => {
    try {
      const urlObj = new URL(url);
      const isHttps = urlObj.protocol === 'https:';

      console.log('Security Check:', {
        url: url,
        protocol: urlObj.protocol,
        isHttps: isHttps
      });

      const request = https.get(url, (res) => {
        // Define security headers with their variants and importance
        const securityHeaders = {
          'strict-transport-security': {
            variants: ['strict-transport-security', 'Strict-Transport-Security'],
            importance: 'critical',
            alternatives: ['content-security-policy']
          },
          'content-security-policy': {
            variants: [
              'content-security-policy',
              'Content-Security-Policy',
              'content-security-policy-report-only',
              'Content-Security-Policy-Report-Only'
            ],
            importance: 'critical',
            alternatives: []
          },
          'x-frame-options': {
            variants: ['x-frame-options', 'X-Frame-Options'],
            importance: 'important',
            alternatives: ['content-security-policy']
          },
          'x-content-type-options': {
            variants: ['x-content-type-options', 'X-Content-Type-Options'],
            importance: 'important',
            alternatives: []
          },
          'x-xss-protection': {
            variants: ['x-xss-protection', 'X-XSS-Protection'],
            importance: 'optional',
            alternatives: ['content-security-policy']
          },
          'referrer-policy': {
            variants: ['referrer-policy', 'Referrer-Policy'],
            importance: 'optional',
            alternatives: []
          },
          'permissions-policy': {
            variants: [
              'permissions-policy',
              'Permissions-Policy',
              'feature-policy',
              'Feature-Policy'
            ],
            importance: 'optional',
            alternatives: []
          }
        };

        console.log('Response Headers:', res.headers);

        // Convert all header names to lowercase for comparison
        const normalizedHeaders = Object.entries(res.headers).reduce((acc, [key, value]) => {
          acc[key.toLowerCase()] = value;
          return acc;
        }, {});

        // Check headers and their alternatives
        const headerResults = {};
        Object.entries(securityHeaders).forEach(([headerKey, config]) => {
          // Check if any variant of the header exists
          const hasHeader = config.variants.some(variant => 
            normalizedHeaders[variant.toLowerCase()] !== undefined
          );

          // Check if any alternative header exists
          const hasAlternative = config.alternatives.some(alt => {
            const altConfig = securityHeaders[alt];
            return altConfig && altConfig.variants.some(variant =>
              normalizedHeaders[variant.toLowerCase()] !== undefined
            );
          });

          headerResults[headerKey] = hasHeader || hasAlternative;
        });

        const securityMetrics = {
          isHttps: isHttps,
          securityHeaders: headerResults,
          protocol: urlObj.protocol,
          tlsVersion: res.socket?.getTLSVersion?.() || 'unknown',
          _debug: {
            rawHeaders: res.headers,
            normalizedHeaders: normalizedHeaders,
            headerAnalysis: Object.entries(headerResults).map(([header, present]) => ({
              header,
              present,
              importance: securityHeaders[header].importance
            }))
          }
        };
        
        resolve(securityMetrics);
      });

      request.on('error', (e) => {
        console.error(`Security metrics request error for ${url}:`, e.message);
        resolve({
          isHttps: isHttps,
          protocol: urlObj.protocol,
          securityHeaders: {},
          error: e.message
        });
      });

      request.setTimeout(10000, () => {
        request.abort();
        console.error(`Security metrics timeout for ${url}`);
        resolve({
          isHttps: isHttps,
          protocol: urlObj.protocol,
          securityHeaders: {},
          error: 'Request timed out'
        });
      });
    } catch (error) {
      console.error(`Error in analyzeSecurityMetrics for ${url}:`, error);
      resolve({
        isHttps: null,
        protocol: 'Data unavailable',
        securityHeaders: {},
        error: error.message
      });
    }
  });
}

async function runLighthouse(url) {
  let chrome = null;
  try {
    const browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    const pages = await browser.pages();
    const page = pages[0];
    const client = await page.target().createCDPSession();
    
    const lighthouse = await import('lighthouse');
    
    const options = {
      port: (new URL(browser.wsEndpoint())).port,
      output: 'json',
      logLevel: 'error',
      onlyCategories: ['performance', 'accessibility', 'best-practices', 'seo'],
      chromeFlags: ['--headless', '--no-sandbox', '--disable-setuid-sandbox'],
      formFactor: 'desktop',
      screenEmulation: {
        mobile: false,
        width: 1350,
        height: 940,
        deviceScaleFactor: 1,
        disabled: false,
      },
      emulatedUserAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/98.0.4695.0 Safari/537.36',
      throttling: {
        rttMs: 40,
        throughputKbps: 10240,
        cpuSlowdownMultiplier: 1,
        requestLatencyMs: 0,
        downloadThroughputKbps: 0,
        uploadThroughputKbps: 0
      }
    };

    // Run Lighthouse
    const runnerResult = await lighthouse.default(url, options);
    const reportCategories = JSON.parse(runnerResult.report).categories;

    await browser.close();

    return {
      performance: reportCategories.performance.score * 100,
      accessibility: reportCategories.accessibility.score * 100,
      bestPractices: reportCategories['best-practices'].score * 100,
      seo: reportCategories.seo.score * 100,
      audits: Object.fromEntries(
        Object.entries(reportCategories).map(([key, category]) => [
          key,
          {
            score: category.score * 100,
            details: category.auditRefs.map(ref => ({
              id: ref.id,
              weight: ref.weight,
              group: ref.group
            }))
          }
        ])
      )
    };
  } catch (error) {
    console.error('Lighthouse analysis failed:', error);
    if (chrome) {
      await chrome.kill();
    }
    // Return default values instead of throwing
    return {
      performance: 0,
      accessibility: 0,
      bestPractices: 0,
      seo: 0,
      error: error.message
    };
  }
}

// Replace the captureCompetitorScreenshots function with this sequential version
async function captureCompetitorScreenshots(urls) {
  console.log('Starting screenshot capture for URLs:', urls);
  const screenshots = {};
  const TIMEOUT = 45000;
  const MAX_RETRIES = 2;
  const RETRY_DELAY = 1000;
  const SCREENSHOT_WIDTH = 1280;
  const SCREENSHOT_HEIGHT = 800;

  let browser = null;
  try {
    browser = await puppeteer.launch({
      headless: 'new',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-features=site-per-process',
        '--disable-web-security',
        '--disable-features=IsolateOrigins',
        '--disable-site-isolation-trials',
        '--ignore-certificate-errors',
        '--ignore-certificate-errors-spki-list'
      ],
      defaultViewport: { width: SCREENSHOT_WIDTH, height: SCREENSHOT_HEIGHT }
    });

    // Process URLs sequentially
    for (const url of urls) {
      let page = null;
      try {
        console.log(`Processing URL: ${url}`);
        page = await browser.newPage();
        
        await page.setDefaultNavigationTimeout(TIMEOUT);
        await page.setRequestInterception(true);
        
        // Optimize by blocking unnecessary resources
        page.on('request', (req) => {
          const resourceType = req.resourceType();
          if (resourceType === 'font' || resourceType === 'media' || 
              resourceType === 'websocket' || resourceType === 'manifest' || 
              resourceType === 'other') {
            req.abort();
          } else {
            req.continue();
          }
        });

        await page.setExtraHTTPHeaders({
          'Accept-Language': 'en-US,en;q=0.9',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        });

        const response = await page.goto(url, { 
          waitUntil: 'domcontentloaded',
          timeout: TIMEOUT 
        });

        if (!response || !response.ok()) {
          throw new Error(`Failed to load page: ${response ? response.status() : 'No response'}`);
        }
        await sleep(2000); // Add 2-second delay
        const buffer = await page.screenshot({ 
          type: 'png',
          fullPage: false,
          clip: {
            x: 0,
            y: 0,
            width: SCREENSHOT_WIDTH,
            height: SCREENSHOT_HEIGHT
          }
        });

        const compressedBuffer = await sharp(buffer)
          .png({
            compressionLevel: 9,
            palette: true
          })
          .toBuffer();

        screenshots[url] = compressedBuffer.toString('base64');
        console.log(`Successfully captured screenshot for: ${url}`);

      } catch (error) {
        console.error(`Error capturing screenshot for ${url}:`, error);
        // Use error image
        const errorImagePath = path.join(__dirname, 'public', 'screenshot-error.png');
        try {
          const errorImageBuffer = await fs.readFile(errorImagePath);
          screenshots[url] = errorImageBuffer.toString('base64');
        } catch (fallbackError) {
          console.error('Error loading fallback image:', fallbackError);
          screenshots[url] = null;
        }
      } finally {
        if (page) {
          await page.close().catch(console.error);
        }
      }
    }

  } catch (error) {
    console.error('Fatal error in captureCompetitorScreenshots:', error);
  } finally {
    if (browser) {
      await browser.close().catch(console.error);
    }
  }

  return screenshots;
}

// Add this function
async function extraCompressScreenshot(screenshot, maxSizeInBytes = 500000) { // 500KB max
  let quality = 60; // Start with a lower quality
  let buffer = Buffer.from(screenshot, 'base64');

  while (buffer.length > maxSizeInBytes && quality > 10) {
    try {
      buffer = await sharp(buffer)
        .jpeg({ quality })
        .toBuffer();

      if (buffer.length > maxSizeInBytes) {
        quality -= 10;
      }
    } catch (error) {
      console.error('Error extra compressing screenshot:', error);
      return null;
    }
  }

  return buffer.length <= maxSizeInBytes ? buffer.toString('base64') : null;
}

app.get('/api/analyze/competitor-screenshots', (req, res) => {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive'
  });


  // This should be called after captureCompetitorScreenshots is complete
  const sendCompetitorScreenshots = (screenshots) => {
    res.write(`data: ${JSON.stringify({ competitorScreenshots: screenshots })}\n\n`);
    res.end();
  };


  // Call this function when screenshots are ready
  // sendCompetitorScreenshots(screenshots);
});

// Add this function to create a default error image if it doesn't exist
async function ensureErrorImageExists() {
  const errorImagePath = path.join(__dirname, 'public', 'screenshot-error.png');
  try {
    await fs.access(errorImagePath);
  } catch {
    // Create a simple error image using sharp
    await sharp({
      create: {
        width: 1280,
        height: 800,
        channels: 4,
        background: { r: 50, g: 50, b: 50, alpha: 1 }
      }
    })
    .composite([{
      input: Buffer.from(
        `<svg width="1280" height="800">
          <rect width="100%" height="100%" fill="#323232"/>
          <text x="50%" y="50%" font-family="Arial" font-size="24" fill="white" text-anchor="middle">
            Error loading screenshot
          </text>
        </svg>`
      ),
      top: 0,
      left: 0
    }])
    .png()
    .toFile(errorImagePath);
  }
}

// Call this when the server starts
ensureErrorImageExists().catch(console.error);

// Utility functions for browser anti-detection and logging
const logger = {
  info: (message, data = {}) => {
    console.log(`[INFO] ${message}`, JSON.stringify(data, null, 2));
  },
  error: (message, error) => {
    console.error(`[ERROR] ${message}`, error);
  },
  debug: (message, data = {}) => {
    if (process.env.DEBUG) {
      console.debug(`[DEBUG] ${message}`, JSON.stringify(data, null, 2));
    }
  }
};

// Pool of real browser User-Agents for rotation
const userAgents = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Edge/120.0.0.0',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Safari/605.1.15'
];

// Get random User-Agent from pool
const getRandomUserAgent = () => {
  const agent = userAgents[Math.floor(Math.random() * userAgents.length)];
  logger.debug('Selected User-Agent', { agent });
  return agent;
};

// Randomize browser fingerprint to avoid detection
const randomizeFingerprint = async (page) => {
  logger.debug('Randomizing browser fingerprint');
  await page.evaluateOnNewDocument(() => {
    // Override properties that commonly reveal automation
    Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
    
    // Randomize screen resolution
    const screenWidth = 1366 + Math.floor(Math.random() * 100);
    const screenHeight = 768 + Math.floor(Math.random() * 100);
    Object.defineProperty(window, 'innerWidth', { get: () => screenWidth });
    Object.defineProperty(window, 'innerHeight', { get: () => screenHeight });
    
    // Add random plugins
    const plugins = ['PDF Viewer', 'Chrome PDF Viewer'].slice(0, 1 + Math.random());
    Object.defineProperty(navigator, 'plugins', { get: () => plugins });
  });
  logger.debug('Fingerprint randomization complete');
};

// Simulate human-like behavior
const humanizeBehavior = async (page) => {
  logger.debug('Starting human behavior simulation');
  
  // Random delay between 1-2 seconds
  const delay = 1000 + Math.random() * 1000;
  await sleep(delay);
  
  // Random scrolling
  await page.evaluate(() => {
    window.scrollTo({
      top: Math.random() * (document.body.scrollHeight / 2),
      behavior: 'smooth'
    });
  });
  
  await sleep(500); // Small additional delay after scrolling
  logger.debug('Human behavior simulation complete', { delay });
};

const BLOCKED_DOMAINS = [
  'amazon.com', 'walmart.com', 'target.com', 'bestbuy.com',
  'chase.com', 'bankofamerica.com', 'wellsfargo.com'
];

const isBlockedDomain = (url) => {
  return BLOCKED_DOMAINS.some(domain => url.toLowerCase().includes(domain));
};

// Add this new endpoint
app.post('/api/generate-professional-report', async (req, res) => {
  const { websiteUrl, scores, metrics } = req.body;
  
  try {
    const prompt = `
      As a professional website auditor, analyze this website's performance and generate a formal report. Use the following data:

      Website: ${websiteUrl}
      
      Overall Scores:
      - Overall: ${scores.overall}
      - Performance: ${scores.phases?.Performance || scores.lighthouse?.performance || 'Data unavailable'}
      - SEO: ${scores.phases?.SEO || scores.lighthouse?.seo || 'Data unavailable'}
      - Accessibility: ${scores.phases?.Accessibility || scores.lighthouse?.accessibility || 'Data unavailable'}
      - Best Practices: ${scores.lighthouse?.bestPractices || 'Data unavailable'}
      
      Core Web Vitals:
      - First Contentful Paint (FCP): ${metrics?.performance?.firstContentfulPaint || 'Data unavailable'}ms (Good: <1800ms)
      - Largest Contentful Paint (LCP): ${metrics?.performance?.largestContentfulPaint || 'Data unavailable'}ms (Good: <2500ms)
      - Cumulative Layout Shift (CLS): ${metrics?.performance?.cumulativeLayoutShift || 'Data unavailable'} (Good: <0.1)
      - First Input Delay (FID): ${metrics?.performance?.estimatedFid || 'Data unavailable'}ms (Good: <100ms)
      
      Performance Metrics:
      - Time to First Byte (TTFB): ${metrics?.performance?.ttfb || 'Data unavailable'}ms
      - Total Blocking Time (TBT): ${metrics?.performance?.tbt || 'Data unavailable'}ms
      - Time to Interactive (TTI): ${metrics?.performance?.timeToInteractive || 'Data unavailable'}ms
      - Load Time: ${metrics?.performance?.loadTime || 'Data unavailable'}ms
      
      SEO Analysis:
      - Title: ${metrics?.seo?.title || 'Data unavailable'}
      - Meta Description: ${metrics?.seo?.metaDescription || 'Data unavailable'}
      - Canonical URL: ${metrics?.seo?.canonicalUrl || 'Data unavailable'}
      - H1 Tag: ${metrics?.seo?.h1 || 'Data unavailable'}
      - Meta Viewport: ${metrics?.seo?.metaViewport || 'Data unavailable'}
      - Open Graph Tags: ${metrics?.seo?.openGraphTags || 'Data unavailable'}
      - Robots Meta: ${metrics?.seo?.robotsMeta || 'Data unavailable'}
      
      Accessibility:
      - Images with Alt Text: ${metrics?.accessibility?.imagesWithAltText || 0}/${metrics?.accessibility?.totalImages || 0}
      - ARIA Attributes Count: ${metrics?.accessibility?.ariaAttributesCount || 'Data unavailable'}
      - Keyboard Navigable: ${metrics?.accessibility?.keyboardNavigable ? 'Yes' : 'No'}
      - Heading Structure: ${JSON.stringify(metrics?.accessibility?.headingStructure || 'Data unavailable')}
      
      Best Practices:
      - HTTPS Status: ${metrics?.security?.isHttps ? 'Yes (HTTPS is used)' : 
        metrics?.security?.isHttps === false ? 'No (HTTPS is not used)' : 'Data unavailable'}
      - Protocol: ${metrics?.security?.protocol || 'Data unavailable'}
      - TLS Version: ${metrics?.security?.tlsVersion || 'Data unavailable'}
      - Security Headers Present: ${
        Object.entries(metrics?.security?.securityHeaders || {})
          .filter(([_, present]) => present)
          .map(([header]) => header)
          .join(', ') || 'None detected'
      }

      Generate a comprehensive professional analysis. For each metric, include context about what constitutes good/acceptable/poor values. Provide specific, actionable recommendations based on the metrics.

      IMPORTANT: Return ONLY the raw JSON object, with NO markdown syntax or code block markers. The response should start with a curly brace and end with a curly brace.

      The JSON structure should be:
      {
        executiveSummary: {
          keyStrengths: string[],
          criticalIssues: string[],
          overallAssessment: string,
          coreWebVitalsAssessment: string
        },
        technicalAnalysis: {
          performance: {
            insights: string[],
            recommendations: string[],
            coreWebVitals: {
              assessment: string,
              details: string[]
            }
          },
          accessibility: {
            insights: string[],
            recommendations: string[],
            complianceLevel: string,
            keyIssues: string[]
          },
          seo: {
            insights: string[],
            recommendations: string[],
            metaTagAnalysis: string[],
            structureAnalysis: string[]
          },
          bestPractices: {
            insights: string[],
            recommendations: string[],
            securityAssessment: string[],
            semanticAnalysis: string[]
          }
        },
        recommendations: {
          critical: string[],
          important: string[],
          optional: string[]
        }
      }
    `;

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { 
          role: "system", 
          content: "You are a professional website auditor. Always return raw JSON without any markdown or code block syntax."
        },
        { role: "user", content: prompt }
      ],
      temperature: 0.7,
      max_tokens: 1500,
    });

    let content = response.choices[0].message.content;
    
    // Clean up the response if it contains markdown
    content = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();

    try {
      const analysis = JSON.parse(content);
      res.json(analysis);
    } catch (parseError) {
      console.error('Error parsing OpenAI response:', parseError);
      console.log('Raw response:', content);
      res.status(500).json({ 
        error: 'Failed to parse AI response',
        details: parseError.message,
        rawResponse: content
      });
    }

  } catch (error) {
    console.error('Error in professional report generation:', error);
    console.error('Error details:', {
      message: error.message,
      stack: error.stack,
      response: error.response?.data
    });
    res.status(500).json({ 
      error: 'Failed to generate professional report',
      details: error.message
    });
  }
});

function calculatePageSize() {
  // Get all resources
  const resources = performance.getEntriesByType('resource');
  
  // Calculate total transfer size using only transferSize
  const totalSize = resources.reduce((total, resource) => {
    return total + (resource.transferSize || 0);
  }, 0);

  // Add document size using only transferSize
  const navigationEntry = performance.getEntriesByType('navigation')[0];
  const documentSize = navigationEntry ? navigationEntry.transferSize || 0 : 0;

  return {
    total: totalSize + documentSize,
    document: documentSize,
    resources: resources.map(r => ({
      name: r.name,
      type: r.initiatorType,
      size: r.transferSize || 0
    }))
  };
}