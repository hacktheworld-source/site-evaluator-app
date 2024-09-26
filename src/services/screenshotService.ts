import axios from 'axios';

const DEBUG_MODE = process.env.NODE_ENV === 'development';

const log = (...args: any[]) => {
  if (DEBUG_MODE) {
    console.log(...args);
  }
};

export async function captureScreenshot(url: string): Promise<string | null> {
  log(`initiating screenshot capture for ${url}`);
  try {
    const response = await axios.post(`${process.env.REACT_APP_API_URL}/api/capture-screenshot`, { url });
    log(`screenshot capture successful for ${url}`);
    return response.data.screenshot;
  } catch (error) {
    console.error(`error capturing screenshot for ${url}:`, error);
    return null;
  }
}