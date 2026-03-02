import express from 'express';
import cors from 'cors';
import { NicheScraper, NicheAnalyzer } from './niche.js';
import dotenv from 'dotenv';

dotenv.config();

// Allow unauthorized certificates for scraping proxies
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const app = express();
const port = 3000;

app.use(cors());
app.use(express.json());

const scraper = new NicheScraper();

app.get('/api/analyze', async (req, res) => {
    try {
        const keyword = req.query.keyword as string;

        if (!keyword) {
            return res.status(400).json({ error: 'Keyword is required' });
        }

        console.log(`Analyzing keyword: ${keyword}`);

        const data = await scraper.scrape(keyword);
        const report = NicheAnalyzer.analyze(data);

        res.json(report);
    } catch (error) {
        console.error('Analysis failed:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

app.get('/api/analyze-app', async (req, res) => {
    try {
        const appId = req.query.appId as string;

        if (!appId) {
            return res.status(400).json({ error: 'App ID is required' });
        }

        console.log(`Analyzing App URL/ID: ${appId}`);

        // Support full URL or just ID
        let targetId = appId;
        if (appId.includes('id=')) {
            targetId = appId.split('id=')[1].split('&')[0];
        }

        const data = await scraper.analyzeApp(targetId);
        const report = NicheAnalyzer.analyze(data);

        res.json(report);
    } catch (error) {
        console.error('App Analysis failed:', error);
        res.status(500).json({ error: 'Analysis failed. Check App ID.' });
    }
});

app.get('/api/search', async (req, res) => {
    try {
        const query = req.query.q as string;
        if (!query) return res.status(400).json({ error: 'Query is required' });

        const results = await scraper.searchApps(query);
        res.json(results);
    } catch (error) {
        console.error('Search failed:', error);
        res.status(500).json({ error: 'Search failed' });
    }
});

app.listen(port, () => {
    console.log(`ASO Server running at http://localhost:${port}`);
});
