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

    // Extract all links, image sources, and email addresses
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

      function extractEmails() {
        // Email regex pattern
        const emailRegex = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g;
        const emails = new Set();

        // Get all text content from the page
        const pageText = document.body.innerText || document.body.textContent || '';
        
        // Find emails in page text
        const textEmails = pageText.match(emailRegex);
        if (textEmails) {
          textEmails.forEach(email => emails.add(email));
        }

        // Check mailto links
        const mailtoLinks = Array.from(document.querySelectorAll('a[href^="mailto:"]'));
        mailtoLinks.forEach(link => {
          const href = link.getAttribute('href');
          const email = href.replace('mailto:', '').split('?')[0]; // Remove query params
          if (email.match(emailRegex)) {
            emails.add(email);
          }
        });

        // Check data attributes that might contain emails
        const elementsWithData = Array.from(document.querySelectorAll('[data-email], [data-mail]'));
        elementsWithData.forEach(el => {
          const dataEmail = el.getAttribute('data-email') || el.getAttribute('data-mail');
          if (dataEmail && dataEmail.match(emailRegex)) {
            emails.add(dataEmail);
          }
        });

        // Check common email-containing elements
        const potentialEmailElements = Array.from(document.querySelectorAll(
          '.email, .contact-email, .e-mail, [class*="email"], [id*="email"]'
        ));
        potentialEmailElements.forEach(el => {
          const text = el.innerText || el.textContent || '';
          const foundEmails = text.match(emailRegex);
          if (foundEmails) {
            foundEmails.forEach(email => emails.add(email));
          }
        });

        return Array.from(emails);
      }

      return {
        links: getAttributes("a", "href"),
        images: getAttributes("img", "src"),
        emails: extractEmails(),
      };
    });
  });
}

function validateUrl(url) {
  if (!url) {
    console.error("Usage: node webscraper.js <url>");
    process.exit(1);
  }
  return url;
}

function logItems(title, items) {
  console.log(`\n${title}:`);
  if (!items || items.length === 0) {
    console.log(`No ${title.toLowerCase()} found.`);
  } else {
    items.forEach(item => console.log(item));
  }
}

function displayResults(links, images, emails) {
  logItems("Links", links);
  logItems("Images", images);
  logItems("Email addresses", emails);
}

async function main() {
  const url = validateUrl(process.argv[2]);
  try {
    const { links, images, emails } = await scrape(url);
    displayResults(links, images, emails);
  } catch (err) {
    console.error("Error:", err.message);
    process.exit(1);
  }
}

main();