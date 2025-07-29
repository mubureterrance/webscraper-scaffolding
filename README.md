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
   npm install puppeteer-real-browser
   npm install puppeteer-extra puppeteer-extra-plugin-stealth
   ```

## Usage

### 1

To scrape any website for links and images
Run the scraper with:

```bash
node webscraper.js <url>
```

Example:

```bash
node webscraper.js https://books.toscrape.com
```

results are stored in the folder: results

### 2

To scrape the brokers website for a list of all the brokers and their details
Run the scraper with:

```bash
node emailscraper.js
```

results are stored in the folder: brokers

### 3

To scrape the games website for a list of all the games and their details
Run the scraper with:

```bash
node igbd-scraper.js
```

results are stored in the folder: games

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
