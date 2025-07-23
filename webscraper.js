import puppeteer from "puppeteer";

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

    // Extract all links and image sources
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
  // return result;
}

function validateUrl(url) {
  if (!url) {
    console.error("Usage: node webscraper.js <url>");
    process.exit(1);
  }
  return url;
}

function displayResults(links, images) {
  console.log("Links found:");
  links.forEach((link) => console.log(link));

  console.log("\nImages found:");
  images.forEach((img) => console.log(img));
}
async function main() {
  const url = validateUrl(process.argv[2]);
  try {
    const { links, images } = await scrape(url);
    displayResults(links, images);
  } catch (err) {
    console.error("Error:", err.message);
    process.exit(1);
  }
}

main();
