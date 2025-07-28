import { connect } from "puppeteer-real-browser";
import StealthPlugin from "puppeteer-extra-plugin-stealth";
import puppeteerExtra from "puppeteer-extra";
import { saveGamesToFile } from "./utils/fileUtils.js";


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


const WEBSITE_URL = validateUrl("https://www.igdb.com/games/coming_soon");


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
        timeout: 60000,
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
      await new Promise((resolve) => setTimeout(resolve, 60000));
    }

    // 
    const games = await page.evaluate(() => {
  const gameCards = Array.from(document.querySelectorAll(".media"));
  
    return gameCards.map(card => {
            const titleAnchor = card.querySelector(".media-body a");
            const title = titleAnchor?.textContent.trim();
            const link = titleAnchor?.getAttribute("href");
            const fullLink = link ? `https://www.igdb.com${link}` : null;

            const releaseTime = card.querySelector("time");
            const releaseDate = releaseTime?.getAttribute("datetime");

            const img = card.querySelector("img");
            const imageUrl = img?.getAttribute("src");
            const fullImageUrl = imageUrl?.startsWith("//") ? `https:${imageUrl}` : imageUrl;

            return {
            title,
            link: fullLink,
            releaseDate,
            image: fullImageUrl,
            };
        });
    });

    //console.log("🎮 Extracted games:", games);
    saveGamesToFile({data: games, url: WEBSITE_URL.toString(),folder: "games"});
    //saveResultsToFile({ links: games.links, images: games.images, url: WEBSITE_URL.toString(), folder: "games" });

  } catch (err) {
    console.error("⚠️ Error:", err.message);
  } finally {
    if (browser) await browser.close();
    console.log("🔒 Browser closed.");
  }
}

runBrowser();
