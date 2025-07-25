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

    try {
      await page.waitForSelector('iframe[src*="recaptcha"]', {
        timeout: 30000,
      });
      console.log("🛡️ reCAPTCHA iframe detected");
    } catch {
      console.log("No reCAPTCHA iframe detected — continuing");
    }
    
    // Scroll to load all brokers
    let prevHeight = 0;
    while (true) {
      const height = await page.evaluate(() => document.body.scrollHeight);
      if (height === prevHeight) break;
      prevHeight = height;
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      await new Promise((resolve) => setTimeout(resolve, 30000));
    }

    // Fetch and parse broker JSON directly from the API
    const brokers = await page.evaluate(async () => {
      const res = await fetch("https://www.ibba.org/wp-json/brokers/all");
      return await res.json();
    });

    const results = brokers.map((info) => {
      const firm = info.company || "N/A";
      const first_name = info.first_name || "N/A";
      const last_name = info.last_name || "N/A";
      const contact_person = `${first_name} ${last_name}`.trim();
      const email = info.email || "N/A";
      return { firm, contact_person, email };
    });

    console.log(`📋 Total brokers scraped: ${results.length}`);
    // console.log(results);
    saveResultsToFile(results, WEBSITE_URL);

    return results;

  } catch (err) {
    console.error("⚠️ Error:", err.message);
  } finally {
    if (browser) await browser.close();
    console.log("🔒 Browser closed.");
  }
}

runBrowser();
