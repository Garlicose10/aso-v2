import { NicheScraper, NicheAnalyzer } from './niche.js';
import dotenv from 'dotenv';

dotenv.config();

async function test() {
    const scraper = new NicheScraper();
    console.log('Scraping niche: "whatsapp"...');
    const data = await scraper.scrape('whatsapp');

    console.log('Found apps:', data.apps.length);
    console.log('Found reviews for apps:', Object.keys(data.reviews));

    const report = NicheAnalyzer.analyze(data);
    console.log('Report Pain Points:', JSON.stringify(report.painPoints, null, 2));
}

test().catch(console.error);
