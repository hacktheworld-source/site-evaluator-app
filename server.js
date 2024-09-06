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

app.get('/api/evaluate', async (req, res) => {
  const { url } = req.query;
  
  try {
    // Perform website evaluation here
    const evaluationResult = await evaluateWebsite(url);
    
    res.json(evaluationResult);
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: 'An error occurred during evaluation' });
  }
});

async function evaluateWebsite(url) {
  let browser;
  try {
    browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu', '--disable-dev-shm-usage'],
      defaultViewport: null
    });

    const page = await browser.newPage();
    await page.goto(url, { 
      waitUntil: 'networkidle0',
      timeout: 60000
    });

    const metrics = await page.evaluate(() => {
      const performance = window.performance;
      const timing = performance.timing;

      return {
        loadTime: timing.loadEventEnd - timing.navigationStart,
        domContentLoaded: timing.domContentLoadedEventEnd - timing.navigationStart,
        firstPaint: performance.getEntriesByType('paint')[0]?.startTime || 0,
        firstContentfulPaint: performance.getEntriesByType('paint')[1]?.startTime || 0,
        domElements: document.getElementsByTagName('*').length,
        pageSize: document.documentElement.innerHTML.length,
        requests: performance.getEntriesByType('resource').length,
        timeToInteractive: performance.getEntriesByName('TTI')[0]?.startTime || 0,
        largestContentfulPaint: performance.getEntriesByType('largest-contentful-paint')[0]?.startTime || 0,
        cumulativeLayoutShift: performance.getEntriesByType('layout-shift').reduce((sum, entry) => sum + entry.value, 0),
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

    const htmlContent = await page.content();
    const screenshot = await page.screenshot({ encoding: 'base64' });

    // Perform AI analysis
    const aiAnalysis = await performAIAnalysis(metrics, htmlContent, url);

    return {
      ...metrics,
      htmlContent,
      screenshot,
      aiAnalysis,
    };
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

async function performAIAnalysis(metrics, htmlContent, url) {
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

  try {
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
    console.error('Error in AI analysis:', error);
    return {
      overallScore: 0,
      uiAnalysis: "AI analysis failed",
      functionalityAnalysis: "AI analysis failed",
      recommendations: ["Unable to generate recommendations due to AI error"]
    };
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
});