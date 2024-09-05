const express = require('express');
const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');

const app = express();
const port = 3001; // Make sure this doesn't conflict with your React app's port

app.use(express.json());

app.get('/api/screenshot', async (req, res) => {
  const url = req.query.url;
  if (!url) {
    return res.status(400).send('URL is required');
  }

  try {
    const browser = await puppeteer.launch();
    const page = await browser.newPage();
    await page.goto(url);
    await page.setViewport({width: 1024, height: 768});
    
    // Capture only the top part of the page
    const screenshot = await page.screenshot({ 
      clip: {x: 0, y: 0, width: 1024, height: 300}
    });

    await browser.close();

    // Save the screenshot
    const fileName = `screenshot-${Date.now()}.png`;
    const filePath = path.join(__dirname, 'public', fileName);
    fs.writeFileSync(filePath, screenshot);

    res.json({ screenshotUrl: `/screenshots/${fileName}` });
  } catch (error) {
    console.error(error);
    res.status(500).send('Error capturing screenshot');
  }
});

app.get('/api/evaluate', async (req, res) => {
  const url = req.query.url;
  if (!url) {
    return res.status(400).send('URL is required');
  }

  try {
    // Launch Puppeteer in headless mode
    const browser = await puppeteer.launch({ headless: 'new' });
    const page = await browser.newPage();
    await page.goto(url, { waitUntil: 'networkidle0' });

    const metrics = await page.evaluate(() => {
      const performance = window.performance;
      const timing = performance.timing;

      return {
        loadTime: timing.loadEventEnd - timing.navigationStart,
        domContentLoaded: timing.domContentLoadedEventEnd - timing.navigationStart,
        firstPaint: performance.getEntriesByType('paint').find(entry => entry.name === 'first-paint').startTime,
        firstContentfulPaint: performance.getEntriesByType('paint').find(entry => entry.name === 'first-contentful-paint').startTime,
        domElements: document.getElementsByTagName('*').length,
        pageSize: document.documentElement.innerHTML.length,
        requests: performance.getEntriesByType('resource').length,
        htmlContent: document.documentElement.outerHTML,
      };
    });

    // Additional evaluations
    metrics.seoScore = await evaluateSEO(page);
    metrics.accessibilityScore = await evaluateAccessibility(page);
    metrics.bestPracticesScore = await evaluateBestPractices(page);
    metrics.securityScore = await evaluateSecurity(page);

    await browser.close();

    res.json(metrics);
  } catch (error) {
    console.error(error);
    res.status(500).send('Error evaluating website');
  }
});

async function evaluateSEO(page) {
  return await page.evaluate(() => {
    let score = 5;
    if (document.querySelector('title')) score += 1;
    if (document.querySelector('meta[name="description"]')) score += 1;
    if (document.querySelector('h1')) score += 1;
    if (document.querySelector('img[alt]')) score += 1;
    if (document.querySelector('link[rel="canonical"]')) score += 1;
    return score;
  });
}

async function evaluateAccessibility(page) {
  return await page.evaluate(() => {
    let score = 5;
    if (document.querySelector('[aria-label]')) score += 1;
    if (document.querySelector('[role]')) score += 1;
    if (document.querySelector('label')) score += 1;
    if (document.querySelector('img[alt]')) score += 1;
    if (document.documentElement.lang) score += 1;
    return score;
  });
}

async function evaluateBestPractices(page) {
  return await page.evaluate(() => {
    let score = 5;
    if (document.doctype) score += 1;
    if (document.querySelector('meta[name="viewport"]')) score += 1;
    if (!document.querySelector('font')) score += 1;
    if (document.querySelector('html[lang]')) score += 1;
    if (document.querySelector('meta[charset]')) score += 1;
    return score;
  });
}

async function evaluateSecurity(page) {
  return await page.evaluate(() => {
    let score = 5;
    if (document.querySelector('meta[http-equiv="Content-Security-Policy"]')) score += 2;
    if (document.querySelector('link[rel="noopener"]')) score += 1;
    if (document.querySelector('form[action^="https"]')) score += 1;
    if (!document.querySelector('a[target="_blank"]:not([rel="noopener"])')) score += 1;
    return score;
  });
}

app.use('/screenshots', express.static(path.join(__dirname, 'public')));

app.listen(port, () => {
  console.log(`Server listening at http://localhost:${port}`);
});