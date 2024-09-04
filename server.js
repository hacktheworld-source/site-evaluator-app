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

app.use('/screenshots', express.static(path.join(__dirname, 'public')));

app.listen(port, () => {
  console.log(`Server listening at http://localhost:${port}`);
});