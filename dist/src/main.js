// main.ts
// @ts-ignore
import * as appStoreScraperDefault from 'app-store-scraper';
// @ts-ignore
import * as googlePlayScraperDefault from 'google-play-scraper';
import { ScoreCalculator, KeywordAnalyzer } from './utils.js';
import { ASOAnalyzer } from './analyzer.js';
import debug from 'debug';
import { cache } from './cache.js';
import pThrottle from 'p-throttle';
import pRetry from 'p-retry';
import * as R from 'ramda';
import { HttpProxyAgent, HttpsProxyAgent } from 'hpagent';
const log = debug('aso');
// Global state to track if we are currently rate-limited/blocked by Google on local network
let isLocallyBlocked = false;
const BLOCK_COOLDOWN_MS = 60 * 60 * 1000; // 1 hour cooldown if blocked
let lastBlockTime = 0;
const NO_PROXY_DELAY_MS = 500; // 500ms delay between non-proxied requests
// Normaliza as APIs para garantir que temos as funções necessárias
const normalizeAPI = (api) => {
    const methods = {
        search: api.search || api.default?.search,
        app: api.app || api.default?.app,
        similar: api.similar || api.default?.similar,
        suggest: api.suggest || api.default?.suggest,
        list: api.list || api.default?.list,
        reviews: api.reviews || api.default?.reviews
    };
    return methods;
};
// --- STEALTH MODES ---
const USER_AGENTS = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Safari/605.1.15',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36 Edg/119.0.0.0'
];
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));
// Fix para os módulos que não têm export default
const appStore = normalizeAPI(appStoreScraperDefault);
const google = normalizeAPI(googlePlayScraperDefault);
export class ASO {
    store;
    api;
    MAX_SEARCH;
    MAX_LIST;
    MAX_KEYWORD_LENGTH = 25;
    throttle;
    config;
    constructor(store, config = {}) {
        this.store = store;
        this.api = store === 'gplay' ? google : appStore;
        this.MAX_SEARCH = store === 'gplay' ? 250 : 200;
        this.MAX_LIST = store === 'gplay' ? 120 : 100;
        // Configure API with defaults
        this.config = {
            country: 'us',
            language: 'en',
            throttle: 20,
            timeout: 30000,
            cache: true,
            stealth: true,
            ...config
        };
        // Setup request throttling
        this.throttle = pThrottle({
            limit: 1,
            interval: this.config.throttle
        });
    }
    /**
     * Execute API request with retry, throttling, and stealth
     */
    async executeRequest(method, params) {
        // 1. Check Cache
        const cacheKey = `${this.store}_${method}_${JSON.stringify(params)}_${this.config.country}_${this.config.language}`;
        const cached = cache.get(cacheKey);
        if (cached) {
            log(`Returning cached data for ${cacheKey}`);
            return cached.data;
        }
        const throttled = this.throttle(async () => {
            // Refresh local block status
            if (isLocallyBlocked && Date.now() - lastBlockTime > BLOCK_COOLDOWN_MS) {
                log('Local block cooldown expired, trying local network again...');
                isLocallyBlocked = false;
            }
            log(`Executing ${method} (Hybrid Mode) with params:`, params);
            return pRetry(async (attemptCount) => {
                const isReviews = method === 'reviews';
                // Fallback to proxy if:
                // - We are currently blocked locally
                // - It's not the first attempt (retry after a failure)
                // - AND we have a proxy configured
                const useProxy = !!this.config.proxy && (isLocallyBlocked || attemptCount > 1);
                if (!useProxy) {
                    log(`Attempting ${method} without proxy...`);
                    // Only delay for search and reviews, getAppInfo is usually safe and we need it fast
                    if (method === 'search' || method === 'reviews') {
                        await sleep(NO_PROXY_DELAY_MS);
                    }
                }
                else {
                    log(`Attempting ${method} with ScraperAPI proxy...`);
                }
                const useStealth = this.config.stealth && attemptCount === 1 && !isReviews;
                let requestHeaders = { ...params.requestOptions?.headers };
                if (useStealth) {
                    const userAgent = USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
                    requestHeaders['User-Agent'] = userAgent;
                }
                else if (isReviews && useProxy) {
                    // Force a "Known Good" User Agent for reviews to avoid 400s when using proxy
                    requestHeaders['User-Agent'] = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
                }
                // Merge config with params
                const mergedParams = {
                    ...params,
                    country: this.config.country,
                    language: this.config.language,
                    lang: this.config.language,
                    timeout: 60000,
                    requestOptions: useProxy ? {
                        headers: requestHeaders,
                        agent: {
                            http: new HttpProxyAgent({ proxy: this.config.proxy }),
                            https: new HttpsProxyAgent({ proxy: this.config.proxy, rejectUnauthorized: false })
                        },
                        timeout: 60000
                    } : (Object.keys(requestHeaders).length > 0 ? { headers: requestHeaders, timeout: 60000 } : { timeout: 60000 })
                };
                if (!this.api[method]) {
                    throw new Error(`Method ${method} not found in API`);
                }
                try {
                    log(`Calling ${method} with:`, JSON.stringify(mergedParams, null, 2));
                    const result = await this.api[method](mergedParams);
                    log(`${method} result fetched successfully.`);
                    // Save to cache on success
                    cache.set(cacheKey, result);
                    return result;
                }
                catch (error) {
                    const statusCode = error.response?.statusCode;
                    // If we get an error on local network, set global flag and retry with proxy
                    if (!useProxy) {
                        log(`LOCAL NETWORK ERROR with status ${statusCode || 'unknown'}: ${error.message}. Switching to proxy for next requests.`);
                        isLocallyBlocked = true;
                        lastBlockTime = Date.now();
                    }
                    throw error;
                }
            }, {
                retries: this.config.proxy ? 2 : 1,
                onFailedAttempt: error => {
                    log(`Attempt failed: ${error.message}.`);
                }
            });
        });
        return throttled();
    }
    /**
     * Search for apps in the store
     */
    async search(options) {
        return this.executeRequest('search', {
            term: options.term,
            num: options.num || 10,
            fullDetail: options.fullDetail
        });
    }
    /**
     * Get detailed app information
     */
    async getAppInfo(appId) {
        return this.executeRequest('app', { appId });
    }
    async getSimilarApps(appId) {
        return this.executeRequest('similar', { appId, fullDetail: true, num: 20 });
    }
    /**
     * Get search suggestions
     */
    async getSuggestions(term) {
        const results = await this.executeRequest('suggest', { term });
        return this.store === 'itunes'
            ? results.map(r => r.term)
            : results;
    }
    /**
     * Get collection of apps
     */
    async getCollection(options) {
        return this.executeRequest('list', {
            collection: options.collection,
            category: options.category,
            num: options.num || this.MAX_LIST,
        });
    }
    /**
     * Get app reviews
     */
    async getReviews(appId, options = {}) {
        return this.executeRequest('reviews', {
            appId,
            ...options
        });
    }
    /**
     * Analyze a keyword
     */
    async analyzeKeyword(keyword) {
        log(`Analyzing keyword: ${keyword}`);
        const searchResults = await this.search({
            term: keyword,
            num: 100,
            fullDetail: true
        });
        const [difficulty, traffic] = await Promise.all([
            this.calculateDifficulty(keyword, searchResults),
            this.calculateTraffic(keyword, searchResults)
        ]);
        return { difficulty, traffic };
    }
    /**
     * Calculate keyword difficulty metrics
     */
    async calculateDifficulty(keyword, apps) {
        const topApps = apps.slice(0, 10);
        const [titleMatches, competitors, installs, rating, age] = await Promise.all([
            this.analyzeTitleMatches(keyword, topApps),
            this.analyzeCompetitors(keyword, topApps),
            this.calculateInstallsScore(topApps),
            this.calculateRatingScore(topApps),
            this.calculateAgeScore(topApps)
        ]);
        const score = ScoreCalculator.aggregate([4, 3, 5, 2, 1], [
            titleMatches.score,
            competitors.score,
            installs.score,
            rating.score,
            age.score
        ]);
        return {
            titleMatches,
            competitors,
            installs,
            rating,
            age,
            score
        };
    }
    /**
     * Calculate keyword traffic metrics
     */
    async calculateTraffic(keyword, apps) {
        const topApps = apps.slice(0, 10);
        const [suggest, ranked, installs, length] = await Promise.all([
            this.calculateSuggestScore(keyword),
            this.calculateRankedScore(topApps),
            this.calculateInstallsScore(topApps),
            this.calculateLengthScore(keyword)
        ]);
        const score = ScoreCalculator.aggregate([8, 3, 2, 1], [suggest.score, ranked.score, installs.score, length.score]);
        return {
            suggest,
            ranked,
            installs,
            length,
            score
        };
    }
    /**
     * Get keyword suggestions based on strategy
     */
    async suggest(options) {
        const finalOptions = {
            strategy: 'category',
            num: 30,
            ...options
        };
        log('Getting suggestions with options:', finalOptions);
        const apps = await this.getAppsByStrategy(finalOptions);
        const keywords = await this.extractKeywordsFromApps(apps);
        const filtered = this.filterSeedKeywords(keywords, finalOptions.keywords || []);
        return R.slice(0, finalOptions.num, filtered);
    }
    /**
     * Get all keywords from an app
     */
    async getAppKeywords(appId) {
        const app = await this.getAppInfo(appId);
        return KeywordAnalyzer.extractKeywords(`${app.title} ${app.description} `);
    }
    // Private helper methods
    async analyzeTitleMatches(keyword, apps) {
        // Implementation moved to analyzer.ts for better organization
        return ASOAnalyzer.analyzeTitleMatches(keyword, apps);
    }
    async analyzeCompetitors(keyword, apps) {
        // Implementation moved to analyzer.ts
        return ASOAnalyzer.analyzeCompetitors(keyword, apps);
    }
    calculateInstallsScore(apps) {
        // Implementation moved to analyzer.ts
        return ASOAnalyzer.calculateInstallsScore(apps, this.store);
    }
    calculateRatingScore(apps) {
        // Implementation moved to analyzer.ts
        return ASOAnalyzer.calculateRatingScore(apps);
    }
    calculateAgeScore(apps) {
        // Implementation moved to analyzer.ts
        return ASOAnalyzer.calculateAgeScore(apps);
    }
    async calculateSuggestScore(keyword) {
        // Implementation moved to analyzer.ts
        return ASOAnalyzer.calculateSuggestScore(keyword, this);
    }
    async calculateRankedScore(apps) {
        // Implementation moved to analyzer.ts
        return ASOAnalyzer.calculateRankedScore(apps, this);
    }
    calculateLengthScore(keyword) {
        // Implementation moved to analyzer.ts
        return ASOAnalyzer.calculateLengthScore(keyword, this.MAX_KEYWORD_LENGTH);
    }
    async getAppsByStrategy(options) {
        // Implementation moved to analyzer.ts
        return ASOAnalyzer.getAppsByStrategy(options, this);
    }
    async extractKeywordsFromApps(apps) {
        const texts = apps.map(app => `${app.title} ${app.description} `);
        return Promise.all(texts.map(text => KeywordAnalyzer.extractKeywords(text))).then(results => R.uniq(R.flatten(results)));
    }
    filterSeedKeywords(keywords, seeds) {
        return keywords.filter(kw => !seeds.includes(kw));
    }
    // Static methods
    isGPlay() {
        return this.store === 'gplay';
    }
    isITunes() {
        return this.store === 'itunes';
    }
}
//# sourceMappingURL=main.js.map