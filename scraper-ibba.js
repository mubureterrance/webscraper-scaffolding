import puppeteer from 'puppeteer-extra';
import fs from 'fs';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';

puppeteer.use(StealthPlugin());

class IBBAScraper {
  constructor() {
    this.browser = null;
    this.page = null;
    this.collectedData = [];
  }

  async init() {
    this.browser = await puppeteer.launch({ headless: false });
    this.page = await this.browser.newPage();
    await this.page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
    );
  }

  async waitForManualCaptcha() {
    console.log('🔐 reCAPTCHA detected. Waiting for manual completion...');
    await this.page.waitForFunction(
      () => !document.querySelector('.g-recaptcha') && !document.querySelector('iframe[src*="recaptcha"]'),
      { timeout: 180000 } // Wait up to 3 minutes
    );
  }

  async navigateToSearchPage() {
    await this.page.goto('https://www.ibba.org/find-a-business-broker/', {
      waitUntil: 'domcontentloaded',
      timeout: 60000,
    });

    const recaptcha = await this.page.$('.g-recaptcha, iframe[src*="recaptcha"]');
    if (recaptcha) {
      await this.waitForManualCaptcha();
    }

    // Additional wait to ensure the page is interactive
    await new Promise(resolve => setTimeout(resolve, 2000));
  }

  async performSearch() {
    const input = await this.page.waitForSelector('input[type="text"], input:not([type])', { timeout: 20000 });
    await input.type('New York', { delay: 50 });

    const checkboxes = await this.page.$$('input[type="checkbox"]');
    for (let i = 0; i < Math.min(3, checkboxes.length); i++) {
      await checkboxes[i].click();
      await new Promise(resolve => setTimeout(resolve, 300)); // Small delay between clicks
    }

    const searchBtn = await this.page.$('button[type="submit"], input[type="submit"]');
    if (searchBtn) {
      await Promise.all([
        this.page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 }),
        searchBtn.click(),
      ]);
    } else {
      await this.page.keyboard.press('Enter');
      await this.page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 });
    }
  }

  async scrapeResults() {
    await this.page.waitForSelector('.broker-result, .broker-card, .result-item', { timeout: 10000 });

    const brokerCards = await this.page.$$('.broker-result, .broker-card, .result-item');
    for (const card of brokerCards) {
      const firm = await this.extractText(card, ['.firm-name', '.company-name']);
      const contact = await this.extractText(card, ['.contact-name', '.broker-name']);
      const email = await this.extractEmail(card);

      if (firm) {
        this.collectedData.push({
          firmName: firm,
          contactName: contact || 'N/A',
          email: email || 'N/A',
        });
      }
    }
  }

  async extractText(context, selectors) {
    for (const selector of selectors) {
      const el = await context.$(selector);
      if (el) {
        const text = await context.evaluate(el => el.textContent.trim(), el);
        if (text) return text;
      }
    }
    return '';
  }

  async extractEmail(context) {
    const el = await context.$('a[href^="mailto:"]');
    if (el) {
      const href = await context.evaluate(el => el.href, el);
      return href.replace('mailto:', '');
    }
    return '';
  }

  async saveResults() {
    if (!this.collectedData.length) {
      console.log('⚠ No data to save.');
      return;
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const jsonPath = `ibba_data_${timestamp}.json`;
    const csvPath = `ibba_data_${timestamp}.csv`;

    fs.writeFileSync(jsonPath, JSON.stringify(this.collectedData, null, 2));
    const csvContent = ['Firm Name,Contact Name,Email']
      .concat(this.collectedData.map(d => `"${d.firmName}","${d.contactName}","${d.email}"`))
      .join('\n');
    fs.writeFileSync(csvPath, csvContent);

    console.log(`✅ Saved JSON: ${jsonPath}`);
    console.log(`✅ Saved CSV: ${csvPath}`);
  }

  async close() {
    await this.browser?.close();
  }

  async run() {
    try {
      await this.init();
      await this.navigateToSearchPage();
      await this.performSearch();
      await this.scrapeResults();
      await this.saveResults();
    } catch (err) {
      console.error('❌ Error:', err.message);
    } finally {
      await this.close();
    }
  }
}

(async () => {
  const scraper = new IBBAScraper();
  await scraper.run();
})();

export default IBBAScraper;
