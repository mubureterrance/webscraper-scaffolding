import puppeteer from "puppeteer";

async function scrape(url) {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  await page.goto(url, { waitUntil: "networkidle2" });

  // Extract all links and image sources
  const result = await page.evaluate(() => {
    const anchors = Array.from(document.querySelectorAll("a"));
    const imgs = Array.from(document.querySelectorAll("img"));
    const links = anchors.map((a) => a.href).filter(Boolean);
    const images = imgs.map((img) => img.src).filter(Boolean);
    return {
      links: Array.from(new Set(links)),
      images: Array.from(new Set(images)),
    };
  });

  await browser.close();
  return result;
}

async function main() {
  const url = process.argv[2];
  if (!url) {
    console.error("Usage: node webscraper.js <url>");
    process.exit(1);
  }
  try {
    const { links, images } = await scrape(url);
    console.log("Links found:");
    links.forEach((link) => console.log(link));
    console.log("\nImages found:");
    images.forEach((img) => console.log(img));
  } catch (err) {
    console.error("Error:", err.message);
    process.exit(1);
  }
}

main();
