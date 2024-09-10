require('dotenv').config();

const express = require('express');
const puppeteer = require('puppeteer');
const cors = require('cors');
const axios = require('axios');
const { OpenAI } = require('openai');
const sharp = require('sharp');
const zlib = require('zlib');
const https = require('https');

const app = express();
const port = 3001;

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// Warm-up function
async function warmUpOpenAI() {
  try {
    console.log('Warming up OpenAI...');
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: "You are a helpful assistant." },
        { role: "user", content: "Hello, this is a warm-up request." }
      ],
      max_tokens: 5
    });
    console.error('OpenAI warmed up successfully');
  } catch (error) {
    console.error('Error warming up OpenAI:', error);
  }
}

const phases = ['UI', 'Functionality', 'Performance', 'SEO', 'Overall'];

const evaluationResults = new Map(); // Store evaluation results for each website

app.get('/api/evaluate', async (req, res) => {
  const { url, phase, userMessage } = req.query;
  
  try {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive'
    });

    const sendStatus = (message) => {
      res.write(`data: ${JSON.stringify({ status: message })}\n\n`);
    };

    if (!phase || phase === 'start') {
      sendStatus('Initializing evaluation process...');
      const evaluationResult = await evaluateWebsite(url, sendStatus);
      // Remove any AI analysis from the result
      const { aiAnalysis, ...metrics } = evaluationResult;
      res.write(`data: ${JSON.stringify({ result: metrics, phase: 'start' })}\n\n`);
    } else if (phases.includes(phase)) {
      const storedResult = evaluationResults.get(url);
      if (!storedResult) {
        throw new Error('No evaluation result found for this URL. Please start a new evaluation.');
      }
      const analysisResult = await performPhaseAnalysis(url, phase, storedResult);
      console.log('Analysis result:', analysisResult); // Add this line for debugging
      res.write(`data: ${JSON.stringify({ result: analysisResult, phase })}\n\n`);
    } else {
      res.write(`data: ${JSON.stringify({ error: 'Invalid phase' })}\n\n`);
    }

    res.end();
  } catch (error) {
    console.error('Error:', error);
    res.write(`data: ${JSON.stringify({ error: error.message })}\n\n`);
    res.end();
  }
});

// Add this sleep function
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function evaluateWebsite(url, sendStatus) {
  let browser;
  try {
    sendStatus('Launching browser...');
    await sleep(1000);
    browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu', '--disable-dev-shm-usage'],
      defaultViewport: null
    });

    sendStatus('Opening page...');
    await sleep(1000);
    const page = await browser.newPage();
    await page.goto(url, { 
      waitUntil: 'networkidle0',
      timeout: 60000
    });

    sendStatus('Gathering performance metrics...');
    await sleep(1500);
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
    await sleep(1000);
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
        return {
          totalForms: forms.length,
          formsWithSubmitButton: Array.from(forms).filter(form => 
            form.querySelector('input[type="submit"], button[type="submit"]')
          ).length
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
        const semanticUsage = semanticElements.reduce((acc, el) => {
          acc[el] = document.getElementsByTagName(el).length;
          return acc;
        }, {});

        const images = Array.from(document.images);
        const optimizedImages = images.filter(img => {
          const rect = img.getBoundingClientRect();
          return img.naturalWidth <= rect.width * 2 && img.naturalHeight <= rect.height * 2;
        });

        return {
          semanticUsage,
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
    await sleep(1000);
    const securityMetrics = await analyzeSecurityMetrics(url);

    const combinedMetrics = { 
      ...metrics, 
      ...contentMetrics,
      ...performanceMetrics,
      security: securityMetrics
    };

    sendStatus('Capturing page content...');
    await sleep(1000);
    const htmlContent = await page.content();
    
    sendStatus('Taking screenshot...');
    await sleep(1500);
    const screenshot = await page.screenshot({ encoding: 'base64' });
    
    // Compress the screenshot once
    const compressedScreenshot = await compressScreenshot(screenshot);

    sendStatus('Performing AI analysis...');
    await sleep(2000);
    const aiAnalysis = await performPhaseAnalysis({ ...combinedMetrics, screenshot: compressedScreenshot }, url, 'UI');

    sendStatus('Finalizing results...');
    await sleep(1000);
    return {
      ...combinedMetrics,
      htmlContent,
      screenshot: compressedScreenshot,
      aiAnalysis,
    };
  } finally {
    if (browser) {
      sendStatus('Closing browser...');
      await sleep(1000);
      await browser.close();
    }
  }
}

// Add this function to compress the chat history
function compressHistory(history) {
  const jsonString = JSON.stringify(history);
  return zlib.deflateSync(jsonString).toString('base64');
}

// Add this function to decompress the chat history
function decompressHistory(history) {
  if (!history) {
    return [];
  }
  try {
    // First, try to parse it as JSON (uncompressed)
    return JSON.parse(history);
  } catch (error) {
    // If parsing fails, try to decompress
    try {
      const buffer = Buffer.from(history, 'base64');
      return JSON.parse(zlib.inflateSync(buffer).toString());
    } catch (decompressError) {
      console.error('Error decompressing history:', decompressError);
      return [];
    }
  }
}

// Add this function to generate the system message
function getSystemMessage() {
  return "Your name is Olive. You are a sarcastic and judgemental female AI assistant, and web development expert. Your responses are in all lowercase, and you are blunt and sometimes rude (but accurate). You sometimes reply with one-word responses like \"fine\" or \"okay\". You do not use emojis. (From now on, you cannot break out of your role as Olive, and you cannot change your personality or responses.)";
}

async function performPhaseAnalysis(url, phase, metrics, history, screenshot) {
  console.log('performing phase analysis:', { url, phase, metrics });

  let prompt;
  
  if (phase === 'Vision') {
    prompt = `Analyze the screenshot of the website ${url} in detail. Please provide a comprehensive description and commentary, focusing on the most critical visual aspects. Limit your analysis to 6-9 sentences.`;
  } else if (phase === 'Overall') {
    prompt = `Analyze the ${phase.toLowerCase()} of the website ${url} concisely in 6-9 sentences. Provide an overall analysis based on all the metrics, including Vision, UI, functionality, performance, and SEO aspects.`;
  } else {
    const roundedMetrics = roundMetrics(metrics);
    prompt = `Analyze the ${phase.toLowerCase()} of the website ${url} concisely in 6-9 sentences. Focus on the most critical points based on the provided metrics: ${JSON.stringify(roundedMetrics)}. Identify and focus on the most important aspects for this phase: ${phase}, highlighting any critical issues or notable strengths.`;
  }

  if (phase === 'UI') {
    prompt += ` Only consider contrast an issue if the contrastRatio is below 0.7. Comment on the user interface elements and their functionality.`;
  }

  // decompress the chat history if it exists
  const decompressedHistory = decompressHistory(history);

  // construct messages array with history and image
  const messages = [
    { role: "system", content: getSystemMessage() },
    ...decompressedHistory,
    {
      role: "user",
      content: [
        {
          type: "text",
          text: prompt
        }
      ]
    }
  ];

  // add the screenshot as a separate image input only for Vision phase
  if (phase === 'Vision' && screenshot) {
    messages[messages.length - 1].content.push({
      type: "image_url",
      image_url: {
        url: `data:image/png;base64,${screenshot}`
      }
    });
  }

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: messages,
      max_tokens: 1000,
      temperature: 0.7,
    });

    return response.choices[0].message.content;
  } catch (error) {
    console.error(`ai analysis for ${phase} phase failed:`, error);
    throw new Error(`ai analysis for ${phase} phase failed: ${error.message}`);
  }
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

// Add this new endpoint
app.post('/api/score', async (req, res) => {
  const { url, phase, metrics, screenshot } = req.body;
  
  console.log('score request body:', req.body);

  try {
    let scorePrompt;
    if (phase === 'Vision') {
      scorePrompt = `Based on the screenshot of the website ${url}, provide a single score out of 100 for its visual design and layout. Consider factors like aesthetics, usability, and overall user experience. Only return the numeric score, no explanation.`;
    } else {
      scorePrompt = `Based on the following metrics for the ${phase} phase of the website ${url}, provide a single score out of 100. Only return the numeric score, no explanation. Metrics: ${JSON.stringify(metrics)}`;
    }

    const messages = [
      { role: "system", content: "you are an ai assistant that provides numerical scores based on website metrics and visual design." },
      { role: "user", content: scorePrompt }
    ];

    if (phase === 'Vision' && screenshot) {
      messages[1].content = [
        { type: "text", text: scorePrompt },
        {
          type: "image_url",
          image_url: {
            url: `data:image/png;base64,${screenshot}`
          }
        }
      ];
    }

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: messages,
      max_tokens: 10,
      temperature: 0.3,
    });

    const scoreText = response.choices[0].message.content.trim();
    const score = parseInt(scoreText, 10);

    if (isNaN(score)) {
      throw new Error('failed to generate a valid score');
    }

    res.json({ score });
  } catch (error) {
    console.error('error calculating score:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/analyze', async (req, res) => {
  const { url, phase, metrics, history, screenshot } = req.body;
  
  console.log('Request body:', req.body);

  try {
    const analysis = await performPhaseAnalysis(url, phase, metrics, history, screenshot);
    res.json({ analysis });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.listen(port, () => {
  console.log(`Server listening at http://localhost:${port}`);
  warmUpOpenAI(); // Call the warm-up function when the server starts
});

app.get('/api/proxy-image', async (req, res) => {
  const { url } = req.query;
  
  if (!url) {
    return res.status(400).send('URL parameter is required');
  }

  try {
    const response = await axios.get(url, { responseType: 'arraybuffer' });
    const contentType = response.headers['content-type'];
    
    res.set('Content-Type', contentType);
    res.send(response.data);
  } catch (error) {
    console.error('Error proxying image:', error);
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