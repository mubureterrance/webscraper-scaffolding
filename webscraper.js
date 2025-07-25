import puppeteer from "puppeteer";
import fs from "fs";
import path from "path";

async function manageBrowser(callPage) {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  try {
    return await callPage(page);
  } finally {
    await browser.close();
  }
}

async function scrape(url) {
  return await manageBrowser(async (page) => {
    await page.goto(url, { waitUntil: "networkidle2", timeout: 60000 });

    return await page.evaluate(() => {
      function getAttributes(selector, attribute) {
        return [
          ...new Set(
            Array.from(document.querySelectorAll(selector))
              .map((e) => e[attribute])
              .filter(Boolean),
          ),
        ];
      }
      return {
        links: getAttributes("a", "href"),
        images: getAttributes("img", "src"),
      };
    });
  });
}

function validateUrl(url) {
  if (!url) {
    console.error("❗ Usage: node webscraper.js <url>");
    process.exit(1);
  }
  return url;
}

function sanitizeUrl(url) {
  return url
    .replace(/^https?:\/\//, "") // remove protocol
    .replace(/[^\w\-]/g, "_") // replace unsafe characters
    .substring(0, 50); // limit filename length
}

function ensureResultsDir(dir = "results") {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function generateTimestamp() {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

function buildFilePath(url, timestamp, folder = "results") {
  const cleanUrl = sanitizeUrl(url);
  return path.join(folder, `results_${cleanUrl}_${timestamp}.json`);
}

function writeJsonFile(filepath, data) {
  fs.writeFileSync(filepath, JSON.stringify(data, null, 2));
  console.log(`Results saved to ${filepath}`);
}

function saveResultsToFile(links, images, url) {
  const timestamp = generateTimestamp();
  ensureResultsDir();
  const filePath = buildFilePath(url, timestamp);

  const data = {
    timestamp,
    url,
    totalLinks: links.length,
    totalImages: images.length,
    links,
    images,
  };

  writeJsonFile(filePath, data);
}

async function main() {
  const url = validateUrl(process.argv[2]);
  try {
    const { links, images } = await scrape(url);
    saveResultsToFile(links, images, url);
  } catch (err) {
    console.error("Error:", err.message);
    process.exit(1);
  }
}

main();
