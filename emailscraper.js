import { connect } from "puppeteer-real-browser";
import StealthPlugin from "puppeteer-extra-plugin-stealth";
import puppeteerExtra from "puppeteer-extra";
import fs from "fs";
import path from "path";

puppeteerExtra.use(StealthPlugin());

function validateUrl(url) {
  if (!url) {
    console.error("❗ Usage: node webscraper.js <url>");
    process.exit(1);
  }

  try {
    return new URL(url); // Throws if invalid
  } catch (err) {
    console.error("❗ Invalid URL format:", url);
    process.exit(1);
  }
}

const WEBSITE_URL = validateUrl("https://www.ibba.org/wp-json/brokers/all");

function sanitizeUrl(url) {
  return url
    .replace(/^https?:\/\//, "") // remove protocol
    .replace(/[^\w\-]/g, "_") // replace unsafe characters
    .substring(0, 50); // limit filename length
}

function ensureResultsDir(dir = "brokers") {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function generateTimestamp() {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

function buildFilePath(url, timestamp, folder = "brokers") {
  const cleanUrl = "ibba-brokers";   //sanitizeUrl(url);
  return path.join(folder, `brokers${cleanUrl}_${timestamp}.json`);
}

function writeJsonFile(filepath, data) {
  fs.writeFileSync(filepath, JSON.stringify(data, null, 2));
  console.log(`brokers saved to ${filepath}`);
}

function saveResultsToFile(brokers, url) {
  const timestamp = generateTimestamp();
  ensureResultsDir();
  const filePath = buildFilePath(url, timestamp);

  const data = {
    timestamp,
    url,
    totalBrokers: brokers.length,
    brokers,
  };

  writeJsonFile(filePath, data);
}
async function waitForRecaptcha(page) {
  try {
        await page.waitForSelector('iframe[src*="recaptcha"]', { timeout: 60000 });
        console.log("🛡 reCAPTCHA iframe detected");
      } catch {
          console.log("No reCAPTCHA iframe detected — continuing");
        }
}
// Scroll to load all brokers
async function ScrollToBottom(page) {
  let prevHeight = 0;
  while (true) {
    const height = await page.evaluate(() => document.body.scrollHeight);
    if (height === prevHeight) break;
    prevHeight = height;
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await new Promise((resolve) => setTimeout(resolve, 3000));
  }
}
async function fetchBrokerData(page) {
    return page.evaluate(async () => {
      const response = await fetch("https://www.ibba.org/wp-json/brokers/all");
      return await response.json();
    });
}
function transformBrokerData(results) {
  return results.map(info => {
    const firm = info.company || "N/A";
    const firstName = info.first_name || "N/A";
    const lastName = info.last_name || "N/A";
    const contactPerson = `${firstName} ${lastName}`.trim();
    const email = info.email || "N/A";
    
    return { firm, contact_person: contactPerson, email };
  });    
}
async function runBrowser() {
  let browser;
  try {
    const res = await connect({
      headless: false,
      fingerprint: true,
      turnstile: true,
      plugins: [StealthPlugin()],
    });
    browser = res.browser;
    const page = res.page;

    await page.goto(WEBSITE_URL, { waitUntil: "networkidle2" });
    console.log("✅ Page loaded");
    await waitForRecaptcha(page);
    await ScrollToBottom(page);

    const rawBrokers = await fetchBrokerData(page);
    const processedBrokers = transformBrokerData(rawBrokers);

    console.log(`📋 Total brokers scraped: ${processedBrokers.length}`);
    saveResultsToFile(processedBrokers, WEBSITE_URL);
  } catch (err) {
    console.error("⚠️ Error:", err.message);
  } finally {
    if (browser) await browser.close();
    console.log("🔒 Browser closed.");
  }
}

runBrowser();
