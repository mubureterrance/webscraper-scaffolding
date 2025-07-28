import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// ES module equivalent of __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Add stealth plugin to avoid detection
puppeteer.use(StealthPlugin());

class IGDBScraper {
    constructor() {
        this.browser = null;
        this.page = null;
        this.games = [];
        this.baseUrl = 'https://www.igdb.com';
    }

    async init() {
        console.log('🚀 Launching browser...');
        this.browser = await puppeteer.launch({
            headless: false, // Set to true for production
            defaultViewport: null,
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-accelerated-2d-canvas',
                '--no-first-run',
                '--no-zygote',
                '--disable-gpu'
            ]
        });

        this.page = await this.browser.newPage();
        
        // Set user agent to avoid bot detection
        await this.page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');
        
        // Set viewport
        await this.page.setViewport({ width: 1366, height: 768 });
    }

    async scrapeUpcomingGames() {
        console.log('📱 Navigating to IGDB coming soon page...');
        
        try {
            await this.page.goto('https://www.igdb.com/games/coming_soon', {
                waitUntil: 'networkidle2',
                timeout: 30000
            });

            // Wait for the game grid to load
            await this.page.waitForSelector('.gameGridContainer', { timeout: 15000 });
            
            console.log('🎮 Scraping game data...');
            
            // Auto-scroll to load more games (lazy loading)
            await this.autoScroll();
            
            // Extract game data
            const games = await this.page.evaluate(() => {
                const gameElements = document.querySelectorAll('.gameGridContainer .gameGridItem');
                const gamesData = [];
                
                gameElements.forEach((element, index) => {
                    try {
                        // Game name
                        const nameElement = element.querySelector('.gameGridTitle a');
                        const name = nameElement ? nameElement.textContent.trim() : 'N/A';
                        const gameLink = nameElement ? nameElement.href : null;
                        
                        // Profile image
                        const imageElement = element.querySelector('.gameGridImage img');
                        let profileImage = null;
                        if (imageElement) {
                            profileImage = imageElement.src || imageElement.dataset.src || null;
                            // Convert to full URL if relative
                            if (profileImage && profileImage.startsWith('//')) {
                                profileImage = 'https:' + profileImage;
                            }
                        }
                        
                        // Release date (from the grid view)
                        const releaseDateElement = element.querySelector('.gameGridReleaseDate');
                        const releaseDate = releaseDateElement ? releaseDateElement.textContent.trim() : 'TBA';
                        
                        // Genre and other details might not be available in grid view
                        // We'll collect basic info here and enhance it later
                        
                        if (name !== 'N/A') {
                            gamesData.push({
                                name,
                                gameLink,
                                profileImage,
                                releaseDate,
                                genre: null, // To be filled later
                                platforms: null, // To be filled later
                                publishers: null, // To be filled later
                                trailerLink: null // To be filled later
                            });
                        }
                    } catch (error) {
                        console.log(`Error processing game ${index}:`, error.message);
                    }
                });
                
                return gamesData;
            });

            console.log(`📊 Found ${games.length} games in grid view`);
            
            // Enhance each game with detailed information
            for (let i = 0; i < Math.min(games.length, 20); i++) { // Limit to first 20 for demo
                if (games[i].gameLink) {
                    console.log(`🔍 Enhancing game ${i + 1}/${Math.min(games.length, 20)}: ${games[i].name}`);
                    const enhancedGame = await this.enhanceGameDetails(games[i]);
                    this.games.push(enhancedGame);
                    
                    // Add delay to be respectful
                    await this.delay(1000);
                }
            }

        } catch (error) {
            console.error('❌ Error scraping games:', error.message);
            throw error;
        }
    }

    async enhanceGameDetails(game) {
        try {
            // Navigate to individual game page
            await this.page.goto(game.gameLink, {
                waitUntil: 'networkidle2',
                timeout: 15000
            });

            // Wait for content to load
            await this.page.waitForSelector('.game-page', { timeout: 10000 });

            const enhancedData = await this.page.evaluate(() => {
                const data = {};
                
                // Genre
                const genreElements = document.querySelectorAll('.game-genres a');
                data.genres = Array.from(genreElements).map(el => el.textContent.trim());
                
                // Platforms
                const platformElements = document.querySelectorAll('.game-platforms a, .platforms a');
                data.platforms = Array.from(platformElements).map(el => el.textContent.trim());
                
                // Publishers
                const publisherElements = document.querySelectorAll('.game-companies a[href*="companies"]');
                data.publishers = Array.from(publisherElements).map(el => el.textContent.trim());
                
                // Release date (more detailed)
                const releaseDateElement = document.querySelector('.game-release-date, .release-date');
                data.detailedReleaseDate = releaseDateElement ? releaseDateElement.textContent.trim() : null;
                
                // Trailer link
                const trailerElement = document.querySelector('a[href*="youtube"], a[href*="trailer"], .trailer-link');
                data.trailerLink = trailerElement ? trailerElement.href : null;
                
                return data;
            });

            // Merge enhanced data with original game data
            return {
                ...game,
                genre: enhancedData.genres.length > 0 ? enhancedData.genres : ['Unknown'],
                platforms: enhancedData.platforms.length > 0 ? enhancedData.platforms : ['Unknown'],
                publishers: enhancedData.publishers.length > 0 ? enhancedData.publishers : ['Unknown'],
                releaseDate: enhancedData.detailedReleaseDate || game.releaseDate,
                trailerLink: enhancedData.trailerLink
            };

        } catch (error) {
            console.log(`⚠️  Could not enhance details for ${game.name}:`, error.message);
            return {
                ...game,
                genre: ['Unknown'],
                platforms: ['Unknown'],
                publishers: ['Unknown'],
                trailerLink: null
            };
        }
    }

    async autoScroll() {
        console.log('📜 Auto-scrolling to load more games...');
        
        await this.page.evaluate(async () => {
            await new Promise((resolve) => {
                let totalHeight = 0;
                const distance = 100;
                const timer = setInterval(() => {
                    const scrollHeight = document.body.scrollHeight;
                    window.scrollBy(0, distance);
                    totalHeight += distance;

                    if (totalHeight >= scrollHeight) {
                        clearInterval(timer);
                        resolve();
                    }
                }, 100);
            });
        });

        // Wait for any lazy-loaded content
        await this.delay(2000);
    }

    async saveToDatabase() {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const filename = `gaming_database_${timestamp}.json`;
        const filepath = path.join(__dirname, filename);

        const database = {
            metadata: {
                scraped_at: new Date().toISOString(),
                total_games: this.games.length,
                source: 'https://www.igdb.com/games/coming_soon',
                scraper_version: '1.0.0'
            },
            games: this.games
        };

        try {
            await fs.writeFile(filepath, JSON.stringify(database, null, 2));
            console.log(`💾 Database saved to: ${filename}`);
            console.log(`📈 Total games collected: ${this.games.length}`);
            
            // Also save a summary
            const summary = this.games.map(game => ({
                name: game.name,
                genre: Array.isArray(game.genre) ? game.genre.join(', ') : game.genre,
                platforms: Array.isArray(game.platforms) ? game.platforms.join(', ') : game.platforms,
                releaseDate: game.releaseDate
            }));
            
            const summaryFilename = `gaming_summary_${timestamp}.json`;
            await fs.writeFile(
                path.join(__dirname, summaryFilename), 
                JSON.stringify(summary, null, 2)
            );
            console.log(`📋 Summary saved to: ${summaryFilename}`);
            
        } catch (error) {
            console.error('❌ Error saving database:', error.message);
        }
    }

    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    async close() {
        if (this.browser) {
            await this.browser.close();
            console.log('🔒 Browser closed');
        }
    }

    // Method to display collected data
    displaySummary() {
        console.log('\n🎮 GAMING DATABASE SUMMARY');
        console.log('=' .repeat(50));
        
        this.games.forEach((game, index) => {
            console.log(`\n${index + 1}. ${game.name}`);
            console.log(`   Genre: ${Array.isArray(game.genre) ? game.genre.join(', ') : game.genre}`);
            console.log(`   Platforms: ${Array.isArray(game.platforms) ? game.platforms.join(', ') : game.platforms}`);
            console.log(`   Release Date: ${game.releaseDate}`);
            console.log(`   Publishers: ${Array.isArray(game.publishers) ? game.publishers.join(', ') : game.publishers}`);
            console.log(`   Has Image: ${game.profileImage ? 'Yes' : 'No'}`);
            console.log(`   Has Trailer: ${game.trailerLink ? 'Yes' : 'No'}`);
        });
    }
}

// Main execution function
async function main() {
    const scraper = new IGDBScraper();
    
    try {
        await scraper.init();
        await scraper.scrapeUpcomingGames();
        await scraper.saveToDatabase();
        scraper.displaySummary();
        
    } catch (error) {
        console.error('💥 Scraping failed:', error.message);
    } finally {
        await scraper.close();
    }
}

// Export for use as module
export default IGDBScraper;

// Run if called directly (ES module equivalent)
if (import.meta.url === `file://${process.argv[1]}`) {
    main().catch(console.error);
}