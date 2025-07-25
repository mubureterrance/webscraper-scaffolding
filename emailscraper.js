import { connect } from "puppeteer-real-browser";
import StealthPlugin from "puppeteer-extra-plugin-stealth";
import puppeteerExtra from "puppeteer-extra";

puppeteerExtra.use(StealthPlugin());

const WEBSITE_URL = "https://www.ibba.org/wp-json/brokers/all";

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
    console.log(results);

    return results;

  } catch (err) {
    console.error("⚠️ Error:", err.message);
  } finally {
    if (browser) await browser.close();
    console.log("🔒 Browser closed.");
  }
}

runBrowser();
