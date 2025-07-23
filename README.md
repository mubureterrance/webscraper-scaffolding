# Webscraper Scaffolding

This project is a simple webscraper built with [Puppeteer](https://pptr.dev/). It visits a given URL, extracts all unique links and image sources from the page, and prints them to the terminal.

## Prerequisites
- [Node.js](https://nodejs.org/) (v16 or higher recommended)

## Installation
1. Clone this repository or download the source code.
2. Install dependencies:
   ```bash
   npm install
   ```
3. Install the required version of Chrome for Puppeteer:
   ```bash
   npx puppeteer browsers install chrome
   ```

## Usage
Run the scraper with:

```bash
node webscraper.js <url>
```

Example:
```bash
node webscraper.js https://books.toscrape.com
```

The script will print all unique links and image sources found on the page.

## Troubleshooting
If you see an error like:

```
Error: Could not find Chrome (ver. ...)
```

Make sure you have run:
```bash
npx puppeteer browsers install chrome
```

If you encounter other issues, see the [Puppeteer troubleshooting guide](https://pptr.dev/guides/configuration).

## License
MIT
