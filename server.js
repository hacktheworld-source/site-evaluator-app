require('dotenv').config();

const express = require('express');
const puppeteer = require('puppeteer');
const cors = require('cors');
const axios = require('axios');
const { OpenAI } = require('openai');

const app = express();
const port = 3001;

app.use(cors());
app.use(express.json());

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
    console.log('OpenAI warmed up successfully');
  } catch (error) {
    console.error('Error warming up OpenAI:', error);
  }
}

app.get('/api/evaluate', async (req, res) => {
  const { url } = req.query;
  
  try {
    // Set up Server-Sent Events
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive'
    });

    // Function to send status updates
    const sendStatus = (message) => {
      res.write(`data: ${JSON.stringify({ status: message })}\n\n`);
    };

    sendStatus('Initializing evaluation process...');
    
    // Perform website evaluation here
    const evaluationResult = await evaluateWebsite(url, sendStatus);
    
    // Send the final result
    res.write(`data: ${JSON.stringify({ result: evaluationResult })}\n\n`);
    res.end();
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: 'An error occurred during evaluation' });
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

    sendStatus('Performing AI analysis...');
    await sleep(2000);
    const aiAnalysis = await performAIAnalysis(combinedMetrics, htmlContent, url);

    sendStatus('Finalizing results...');
    await sleep(1000);
    return {
      ...combinedMetrics,
      htmlContent,
      screenshot,
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

async function performAIAnalysis(metrics, htmlContent, url) {
  const maxRetries = 3;
  const retryDelay = 1000; // 1 second

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const prompt = `Analyze the following website metrics for ${url}:

${JSON.stringify(metrics, null, 2)}

Please provide:
1. An overall score (0-100)
2. UI analysis
3. Functionality analysis
4. 3-5 recommendations for improvement

Format your response as follows:
Overall Score: [score]
UI Analysis: [your analysis]
Functionality Analysis: [your analysis]
Recommendations:
- [recommendation 1]
- [recommendation 2]
- [recommendation 3]
`;

      const response = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: "You are a web development expert analyzing website performance and user experience." },
          { role: "user", content: prompt }
        ],
        max_tokens: 500,
        temperature: 0.7,
      });

      const analysis = response.choices[0].message.content;
      return parseAIResponse(analysis);
    } catch (error) {
      console.error(`AI analysis attempt ${attempt} failed:`, error);
      if (attempt === maxRetries) {
        console.error('All retry attempts failed');
        return {
          overallScore: 0,
          uiAnalysis: "AI analysis failed after multiple attempts",
          functionalityAnalysis: "AI analysis failed after multiple attempts",
          recommendations: ["Unable to generate recommendations due to persistent AI error"]
        };
      }
      await new Promise(resolve => setTimeout(resolve, retryDelay));
    }
  }
}

function parseAIResponse(analysis) {
  const lines = analysis.split('\n');
  let overallScore = 0;
  let uiAnalysis = '';
  let functionalityAnalysis = '';
  let recommendations = [];
  let currentSection = '';

  for (const line of lines) {
    if (line.startsWith('Overall Score:')) {
      overallScore = parseInt(line.split(':')[1].trim());
    } else if (line.startsWith('UI Analysis:')) {
      currentSection = 'ui';
    } else if (line.startsWith('Functionality Analysis:')) {
      currentSection = 'functionality';
    } else if (line.startsWith('Recommendations:')) {
      currentSection = 'recommendations';
    } else if (line.trim().startsWith('-') && currentSection === 'recommendations') {
      recommendations.push(line.trim().substring(1).trim());
    } else if (currentSection === 'ui') {
      uiAnalysis += line + ' ';
    } else if (currentSection === 'functionality') {
      functionalityAnalysis += line + ' ';
    }
  }

  return {
    overallScore,
    uiAnalysis: uiAnalysis.trim(),
    functionalityAnalysis: functionalityAnalysis.trim(),
    recommendations
  };
}

app.listen(port, () => {
  console.log(`Server listening at http://localhost:${port}`);
  warmUpOpenAI(); // Call the warm-up function when the server starts
});