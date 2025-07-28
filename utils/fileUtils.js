import fs from "fs";
import path from "path";

/**
 * Validate the input URL.
 */
export function validateUrl(url) {
  if (!url) {
    console.error("Usage: node webscraper.js <url>");
    process.exit(1);
  }
  return url;
}

/**
 * Sanitize URL for use in a filename.
 */
export function sanitizeUrl(url) {
  if (typeof url !== "string") {
    throw new TypeError("sanitizeUrl expected a string, but got " + typeof url);
  }

  return url
    .replace(/^https?:\/\//, "")
    .replace(/[^\w\-]/g, "_")
    .substring(0, 50);
}


/**
 * Ensure the results directory exists.
 */
export function ensureDir(dir = "results") {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

/**
 * Generate an ISO-like timestamp string for filenames.
 */
export function generateTimestamp() {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

/**
 * Build a filepath using sanitized URL and timestamp.
 */
export function buildFilePath(url, timestamp, folder = "results") {
  console.log("on buildFilePath: " + url);
  const cleanUrl = sanitizeUrl(url);
  return path.join(folder, `results_${cleanUrl}_${timestamp}.json`);
}

/**
 * Write a JS object as pretty JSON to file.
 */
export function writeJsonFile(filepath, data) {
  fs.writeFileSync(filepath, JSON.stringify(data, null, 2));
  console.log(`Results saved to ${filepath}`);
}

/**
 * Save scraped results (links & images) to a timestamped file.
 */
export function saveResultsToFile({ links, images, url, folder = "results" }) {
  const timestamp = generateTimestamp();
  ensureDir(folder);
  const filePath = buildFilePath(url, timestamp, folder);

  const data = {
    timestamp,
    url,
    totalLinks: links.length || 0,
    totalImages: images.length || 0,
    links,
    images,
  };

  writeJsonFile(filePath, data);
}

export function saveGamesToFile({ data, url, folder = "results" }) {
  const timestamp = generateTimestamp();
  ensureDir(folder);
  const filePath = buildFilePath(url, timestamp, folder);

  const resultSummary = {
    timestamp,
    url,
    totalItems: Array.isArray(data) ? data.length : 0,
    data,
  };

  writeJsonFile(filePath, resultSummary);
}
