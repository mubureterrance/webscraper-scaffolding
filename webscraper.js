import puppeteer from "puppeteer";
import fs from "fs";
import path from "path";
import { validateUrl, saveResultsToFile } from "./utils/fileUtils.js";

async function manageBrowser(callPage) {
  const browser = await puppeteer.launch({ headless: true });
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
              .filter(Boolean)
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

async function main() {
  const url = validateUrl(process.argv[2]);
  console.log("Webscraper now scrapping url: " + url);
  try {
    const { links, images } = await scrape(url);

    // Sort alphabetically
    const sortedLinks = links.sort((a, b) => a.localeCompare(b));
    const sortedImages = images.sort((a, b) => a.localeCompare(b));

    console.log(` ${sortedLinks.length} links found`);
    console.log(` ${sortedImages.length} images found`);

    saveResultsToFile({ links: sortedLinks, images: sortedImages, url });
  } catch (err) {
    console.error("Error:", err.message);
    process.exit(1);
  }
}

main();
