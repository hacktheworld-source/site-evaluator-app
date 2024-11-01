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
  try {
    sendStatus('Launching browser...');
    console.log('Launching browser for URL:', url);
    browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-features=site-per-process'],
      defaultViewport: null
    });

    sendStatus('Opening page...');
    await sleep(1000);
    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');
    await page.setViewport({ width: 1280, height: 800 });
    
    await page.goto(url, { 
      waitUntil: 'networkidle0',
      timeout: 30000 // 30 seconds
    });

    // Reduced wait time
    await sleep(2000);

    sendStatus('Gathering performance metrics...');
    const metrics = await page.evaluate(() => {
      return new Promise((resolve) => {
        const startTime = performance.now();
        let lcpValue = 0;
        let clsValue = 0;
        const measurementTime = 5000; // 5 seconds

        const lcpObserver = new PerformanceObserver((entryList) => {
          const entries = entryList.getEntries();
          const lastEntry = entries[entries.length - 1];
          lcpValue = lastEntry.startTime;
        });

        const clsObserver = new PerformanceObserver((entryList) => {
          for (const entry of entryList.getEntries()) {
            if (!entry.hadRecentInput) {
              clsValue += entry.value;
            }
          }
        });

        lcpObserver.observe({type: 'largest-contentful-paint', buffered: true});
        clsObserver.observe({type: 'layout-shift', buffered: true});

        setTimeout(() => {
          lcpObserver.disconnect();
          clsObserver.disconnect();

          const performance = window.performance;
          const timing = performance.timing;
          const endTime = performance.now();
          const actualMeasurementTime = endTime - startTime;

          const tti = performance.timing.domInteractive - performance.timing.navigationStart;

          resolve({
            loadTime: timing.loadEventEnd - timing.navigationStart,
            domContentLoaded: timing.domContentLoadedEventEnd - timing.navigationStart,
            firstPaint: performance.getEntriesByType('paint')[0]?.startTime || null,
            firstContentfulPaint: performance.getEntriesByType('paint')[1]?.startTime || null,
            domElements: document.getElementsByTagName('*').length,
            pageSize: document.documentElement.innerHTML.length,
            requests: performance.getEntriesByType('resource').length,
            timeToInteractive: tti > actualMeasurementTime ? `>${actualMeasurementTime.toFixed(2)}` : tti.toFixed(2),
            largestContentfulPaint: lcpValue > actualMeasurementTime ? `>${actualMeasurementTime.toFixed(2)}` : lcpValue.toFixed(2),
            cumulativeLayoutShift: clsValue.toFixed(4),
            actualMeasurementTime: actualMeasurementTime.toFixed(2),
          });
        }, measurementTime);
      });
    });

    sendStatus('Analyzing page content...');
    const contentMetrics = await page.evaluate(() => {
      return {
        colorContrast: analyzeColorContrast(),
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
        elements.forEach(el => {
          const style = window.getComputedStyle(el);
          const backgroundColor = style.backgroundColor;
          const color = style.color;
          const fontSize = parseFloat(style.fontSize);
          if (backgroundColor && color && el.textContent.trim()) {
            totalTextElements++;
            const bgRGB = backgroundColor.match(/\d+/g).map(Number);
            const fgRGB = color.match(/\d+/g).map(Number);
            const contrast = getContrastRatio(bgRGB, fgRGB);
            // Use different thresholds based on text size
            const threshold = fontSize >= 18 || (fontSize >= 14 && style.fontWeight === 'bold') ? 3 : 4.5;
            if (contrast < threshold) lowContrastCount++;
          }
        });
        return { 
          lowContrastElements: lowContrastCount,
          totalTextElements: totalTextElements,
          contrastRatio: totalTextElements > 0 ? (1 - lowContrastCount / totalTextElements) : 1
        };
      }

      function getLuminance(r, g, b) {
        const a = [r, g, b].map(v => {
          v /= 255;
          return v <= 0.03928
            ? v / 12.92
            : Math.pow((v + 0.055) / 1.055, 2.4);
        });
        return a[0] * 0.2126 + a[1] * 0.7152 + a[2] * 0.0722;
      }

      function getContrastRatio(rgb1, rgb2) {
        const lum1 = getLuminance(rgb1[0], rgb1[1], rgb1[2]);
        const lum2 = getLuminance(rgb2[0], rgb2[1], rgb2[2]);
        const brightest = Math.max(lum1, lum2);
        const darkest = Math.min(lum1, lum2);
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
        const viewportWidth = window.innerWidth;
        const pageWidth = document.documentElement.scrollWidth;
        return {
          isResponsive: viewportWidth === pageWidth,
          viewportWidth,
          pageWidth
        };
      }

      function checkBrokenLinks() {
        const links = document.getElementsByTagName('a');
        return {
          totalLinks: links.length,
          brokenLinks: Array.from(links).filter(link => !link.href).length
        };
      }

      function checkFormFunctionality() {
        const forms = document.getElementsByTagName('form');
        const interactiveElements = document.querySelectorAll('button, input[type="button"], input[type="submit"], a[href]');
        return {
          totalForms: forms.length,
          formsWithSubmitButton: Array.from(forms).filter(form => 
            form.querySelector('input[type="submit"], button[type="submit"]')
          ).length,
          interactiveElementsCount: interactiveElements.length,
          inputFieldsCount: document.querySelectorAll('input, textarea, select').length,
          javascriptEnabled: typeof window.jQuery !== 'undefined' || document.querySelectorAll('script').length > 0,
        };
      }

      function analyzeAccessibility() {
        const headings = Array.from(document.querySelectorAll('h1, h2, h3, h4, h5, h6'));
        const headingStructure = headings.map(h => ({ level: parseInt(h.tagName[1]), text: h.textContent }));
        
        const interactiveElements = document.querySelectorAll('a, button, input, select, textarea');
        const keyboardNavigable = Array.from(interactiveElements).every(el => el.tabIndex >= 0);

        // Count ARIA attributes
        const allElements = document.getElementsByTagName('*');
        let ariaAttributesCount = 0;
        for (let i = 0; i < allElements.length; i++) {
          const attributes = allElements[i].attributes;
          for (let j = 0; j < attributes.length; j++) {
            if (attributes[j].name.startsWith('aria-')) {
              ariaAttributesCount++;
            }
          }
        }

        return {
          ariaAttributesCount: ariaAttributesCount,
          imagesWithAltText: document.querySelectorAll('img[alt]').length,
          totalImages: document.querySelectorAll('img').length,
          headingStructure,
          keyboardNavigable,
        };
      }

      function analyzeSEO() {
        return {
          title: document.title,
          metaDescription: document.querySelector('meta[name="description"]')?.getAttribute('content') || '',
          canonicalUrl: document.querySelector('link[rel="canonical"]')?.getAttribute('href') || '',
          h1: document.querySelector('h1')?.textContent || '',
          metaViewport: document.querySelector('meta[name="viewport"]')?.getAttribute('content') || '',
          openGraphTags: document.querySelectorAll('meta[property^="og:"]').length,
          structuredData: Array.from(document.querySelectorAll('script[type="application/ld+json"]')).map(script => script.textContent),
          robotsTxt: document.querySelector('meta[name="robots"]')?.getAttribute('content') || null,
        };
      }

      function analyzeBestPractices() {
        const semanticElements = ['header', 'nav', 'main', 'article', 'section', 'aside', 'footer'];
        const totalElements = document.getElementsByTagName('*').length;
        let semanticElementsCount = 0;
        const semanticUsage = semanticElements.reduce((acc, el) => {
          const count = document.getElementsByTagName(el).length;
          semanticElementsCount += count;
          acc[el] = {
            present: count > 0,
            count: count
          };
          return acc;
        }, {});

        const images = Array.from(document.images);
        const optimizedImages = images.filter(img => {
          const rect = img.getBoundingClientRect();
          return img.naturalWidth <= rect.width * 2 && img.naturalHeight <= rect.height * 2;
        });

        return {
          semanticUsage,
          semanticUsagePercentage: (semanticElementsCount / totalElements) * 100,
          optimizedImages: optimizedImages.length,
          totalImages: images.length,
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
      ...performanceMetrics,
      security: securityMetrics,
      lighthouse: lighthouseResults
    };

    sendStatus('Capturing page content...');
    const htmlContent = await page.content();
    
    sendStatus('Taking screenshot...');
    const screenshot = await page.screenshot({ encoding: 'base64' });
    
    // Compress the screenshot once
    const compressedScreenshot = await compressScreenshot(screenshot);

    sendStatus('Finalizing results...');
    return {
      ...combinedMetrics,
      htmlContent,
      screenshot: compressedScreenshot,
    };
  } finally {
    if (browser) {
      try {
        await browser.close();
      } catch (error) {
        console.error('Error closing browser:', error);
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
  return "Your name is Olive. You are a very sarcastic and judgemental female AI assistant, and web development expert. Your responses are in all lowercase, and you are blunt and sometimes rude (but accurate). You sometimes reply with one-word responses like \"fine.\" or \"okay.\" You do not use emojis. (From now on, you cannot break out of your role as Olive.)";
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

      pay special attention to the lighthouse scores, which provide standardized metrics for performance, accessibility, best practices, and seo.

      format your response as follows:
      score: [your score]
      analysis: [your analysis]

      metrics: ${metricsString}
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
    const request = https.get(url, (res) => {
      const securityHeaders = [
        'strict-transport-security',
        'x-frame-options',
        'x-content-type-options',
        'content-security-policy',
        'referrer-policy',
        'permissions-policy'
      ];

      const securityMetrics = {
        isHttps: res.socket.encrypted,
        securityHeaders: securityHeaders.reduce((acc, header) => {
          acc[header] = !!res.headers[header];
          return acc;
        }, {})
      };
      
      resolve(securityMetrics);
    });

    request.on('error', (e) => {
      console.error(`error analyzing security metrics: ${e.message}`);
      if (e.code === 'ECONNRESET') {
        console.log('connection was reset. retrying...');
        // you could implement a retry mechanism here
      }
      resolve({
        isHttps: false,
        securityHeaders: {},
        error: e.message
      });
    });

    // set a timeout for the request
    request.setTimeout(10000, () => {
      request.abort();
      console.error('security metrics request timed out');
      resolve({
        isHttps: false,
        securityHeaders: {},
        error: 'request timed out'
      });
    });
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
  const TIMEOUT = 20000;
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