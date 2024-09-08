require('dotenv').config();

const express = require('express');
const puppeteer = require('puppeteer');
const cors = require('cors');
const axios = require('axios');
const { OpenAI } = require('openai');
const sharp = require('sharp');
const zlib = require('zlib');

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

const phases = ['UI', 'Functionality', 'Performance', 'Overall'];

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
      };

      function analyzeColorContrast() {
        // Simplified color contrast check
        const elements = document.querySelectorAll('*');
        let lowContrastCount = 0;
        elements.forEach(el => {
          const style = window.getComputedStyle(el);
          const backgroundColor = style.backgroundColor;
          const color = style.color;
          if (backgroundColor && color) {
            // Simple contrast ratio calculation (not accurate, just for demonstration)
            const contrast = Math.abs(getLuminance(backgroundColor) - getLuminance(color));
            if (contrast < 0.5) lowContrastCount++;
          }
        });
        return { lowContrastElements: lowContrastCount };
      }

      function getLuminance(color) {
        // Simplified luminance calculation
        const rgb = color.match(/\d+/g);
        if (rgb) {
          return (0.299 * rgb[0] + 0.587 * rgb[1] + 0.114 * rgb[2]) / 255;
        }
        return 0;
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
    });

    const combinedMetrics = { ...metrics, ...contentMetrics };

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
  return "Your name is Olive. You are a sarcastic and judgemental female AI assistant, and web development expert. Your responses are in all lowercase, and you are blunt and sometimes rude. You sometimes use one-word responses like \"fine\" or \"okay\". You do not use emojis.";
}

async function performPhaseAnalysis(url, phase, metrics, history) {
  console.log('performing phase analysis:', { url, phase, metrics });

  let prompt = `analyze the ${phase.toLowerCase()} of the website ${url} concisely in 6-9 sentences. focus on the most critical points`;
  
  if (phase === 'Overall' || !metrics) {
    prompt += " provide an overall analysis based on the previous phases.";
  } else {
    const roundedMetrics = roundMetrics(metrics);
    prompt += ` based on the provided metrics: ${JSON.stringify(roundedMetrics)}`;
  }

  prompt += " limit your analysis to 6-9 sentences, focusing on the most critical points.";

  // decompress the chat history if it exists
  const decompressedHistory = decompressHistory(history);

  // construct messages array with history
  const messages = [
    { role: "system", content: getSystemMessage() },
    ...decompressedHistory,
    { role: "user", content: prompt }
  ];

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: messages,
      max_tokens: 1000, // Increase this value
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
  const { url, phase, metrics } = req.body;
  
  console.log('score request body:', req.body);

  try {
    const scorePrompt = `Based on the following metrics for the ${phase} phase of the website ${url}, provide a single score out of 100. Only return the numeric score, no explanation. Metrics: ${JSON.stringify(metrics)}`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: "you are an ai assistant that provides numerical scores based on website metrics." },
        { role: "user", content: scorePrompt }
      ],
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
  const { url, phase, metrics, history } = req.body;
  
  console.log('Request body:', req.body);

  try {
    const analysis = await performPhaseAnalysis(url, phase, metrics, history);
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
      { role: "user", content: `The current phase is ${phase}. User question: ${message}` }
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