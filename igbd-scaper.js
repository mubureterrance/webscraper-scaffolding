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
async function extractGameList(page) {
  return page.evaluate(() => {
    const gameCards = Array.from(document.querySelectorAll(".media"));
    return gameCards.map((card) => {
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
}
async function extractGameDetails(page) {
  return page.evaluate(() => {
    const anchors = Array.from(document.querySelectorAll("a"));
    const genres = [];
    const platforms = [];
    const publishers = [];

    anchors.forEach((anchor) => {
      const link = anchor.getAttribute("href");
      if (link?.includes("/genres/")) {
        const genre = link.replace("/genres/", "");
        if (!genres.includes(genre)) genres.push(genre);
      }
      if (link?.includes("/platforms/")) {
        const platform = link.replace("/platforms/", "");
        if (!platforms.includes(platform)) platforms.push(platform);
      }
      if (link?.includes("/companies/")) {
        const publisher = link.replace("/companies/", "");
        if (!publishers.includes(publisher)) publishers.push(publisher);
      }
    });
      return { genres, platforms, publishers };
  });
}
async function runBrowser() {
  let browser;
  try {
    const { browser: br, page } = await connect({
      headless: false,
      fingerprint: true,
      turnstile: true,
      plugins: [StealthPlugin()],
    });
    browser = br;
    await page.goto(WEBSITE_URL.toString(), {
      waitUntil: "networkidle2",
      timeout: 60000,
    });
    console.log("✅ Page loaded");
    await waitForRecaptcha(page);
    await autoScroll(page);

    const games = await extractGameList(page);
    for (const game of games) {
      if (!game.link) continue;
      try {
        await page.goto(game.link, { waitUntil: "networkidle2", timeout: 60000 });
      } catch (err) {
        console.warn(`⏰ Timeout loading ${game.link} — skipping.`);
        continue;
      }
      const details = await extractGameDetails(page);
      game.details = details;
    }
    saveGamesToFile({
      data: games,
      url: WEBSITE_URL.toString(),
      folder: "games",
    });

  } catch (err) {
    console.error("⚠ Error:", err.message);
  } finally {
    if (browser) await browser.close();
    console.log("🔒 Browser closed.");
  }
}

runBrowser();