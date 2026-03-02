import { ASO } from './main.js';
import { AppInfo, Review } from './types.js';
import * as R from 'ramda';
import debug from 'debug';

export interface NicheData {
    keyword: string;
    apps: AppInfo[];
    reviews: Record<string, Review[]>;
    stats: {
        avgRating: number;
        avgInstalls: number;
        volatility: number;
        megacorps: number;
    };
    context?: 'niche' | 'app-clone';
    targetAppId?: string;
}

export interface CompetitorSummary {
    appId: string;
    title: string;
    icon: string;
    developer: string;
    developerId?: string;
    developerEmail?: string;
    developerWebsite?: string;
    developerAddress?: string;
    rating: number;
    ratings?: number;
    reviews: number;
    scoreText?: string;
    downloads: string;
    minInstalls?: number;
    lastUpdated: string;
    released?: string;
    recentChanges?: string;
    summary?: string;
    description?: string;
    genre?: string;
    genreId?: string;
    price?: number;
    currency?: string;
    free?: boolean;
    offersIAP?: boolean;
    IAPRange?: string;
    adSupported?: boolean;
    size?: string;
    androidVersion?: string;
    androidVersionText?: string;
    contentRating?: string;
    contentRatingDescription?: string;
    screenshots?: string[];
    video?: string;
    videoImage?: string;
    previewVideo?: string;
    histogram?: { [key: string]: number };
    weakness?: 'Baja Calidad' | 'Abandonada' | 'Quejas de Monetización' | null;
    link: string;
    url?: string;
    version?: string;
    headerImage?: string;
    preregister?: boolean;
    earlyAccessEnabled?: boolean;
    isAvailableInPlayPass?: boolean;
}


export interface NicheReport {
    verdict: 'GREEN LIGHT' | 'PROCEED WITH CAUTION' | 'ABANDON';
    scores: {
        opportunity: number;
        difficulty: number;
        volatility: boolean;
    };
    analysis: {
        opportunity: string;
        difficulty: string;
    };
    productBlueprint: {
        mvpFeatures: string[];
        monetization: string;
        techStack: string;
    };
    painPoints: {
        criticalBugs: string[];
        uxFriction: string[];
        monetizationHate: string[];
    };
    competitors: CompetitorSummary[];
}

const log = debug('niche-validator');

export class NicheScraper {
    private aso: ASO;

    constructor() {
        this.aso = new ASO('gplay', {
            country: 'es',
            language: 'es',
            throttle: 500,
            timeout: 30000,
            stealth: false,
            proxy: process.env.PROXY_URL
        });
    }

    async scrape(keyword: string): Promise<NicheData> {
        const [usApps, esApps] = await Promise.all([
            this.searchStore(keyword, 'us'),
            this.searchStore(keyword, 'es')
        ]);

        // Merge and deduplicate by appId
        const allApps = R.uniqBy(app => (app as any).id || app.appId, [...usApps, ...esApps]);
        const topApps = allApps.slice(0, 20);

        // Identify apps for sentiment analysis:
        // Priority 1: High downloads (>10k) BUT Low rating (<4.2) - The "Vulnerable Giants"
        let candidates = topApps
            .filter(app => (app.minInstalls || 0) > 10000 && (app.score || 0) < 4.2);

        // Priority 2 (Fallback): If no giants, just take the absolute lowest rated ones in Top 20
        if (candidates.length === 0) {
            candidates = [...topApps].sort((a, b) => (a.score || 0) - (b.score || 0)).slice(0, 3);
        } else {
            candidates = candidates.sort((a, b) => (a.score || 0) - (b.score || 0)).slice(0, 3);
        }

        console.log(`Found ${candidates.length} apps for sentiment analysis.`);

        const reviewsMap: Record<string, Review[]> = {};
        for (const app of candidates) {
            try {
                // Get newest reviews to find recent pain points
                const reviews = await this.aso.getReviews(app.appId, { num: 150, sort: 1 });

                let reviewList: Review[] = [];
                if (Array.isArray(reviews)) {
                    reviewList = reviews;
                } else if (reviews && Array.isArray(reviews.data)) {
                    reviewList = reviews.data;
                }

                // Filter for negative reviews (1-3 stars) to cast a wider net
                const negatives = reviewList.filter(r => r.score <= 3);
                console.log(`App ${app.appId}: Fetched ${reviewList.length} reviews. Found ${negatives.length} negative reviews.`);
                reviewsMap[app.appId] = negatives.slice(0, 50);

            } catch (e) {
                console.error(`Failed to get reviews for ${app.appId}:`, e instanceof Error ? e.message : e);
            }
        }

        return {
            keyword,
            apps: topApps,
            reviews: reviewsMap,
            stats: {
                avgRating: R.mean(topApps.map(a => a.score || 0)),
                avgInstalls: R.mean(topApps.map(a => a.minInstalls || 0)),
                volatility: 0,
                megacorps: 0
            }
        };
    }

    async analyzeApp(appId: string): Promise<NicheData> {
        console.log(`Analyzing App Clone Opportunity for: ${appId}`);

        try {
            // 1. Get Target App Details
            const targetApp = await this.aso.getAppInfo(appId);

            // 2. Get Similar Apps (Competitors)
            const similarApps = await this.aso.getSimilarApps(appId);

            // 3. Combine them (Target is always first)
            // Ensure unique just in case target is in similar list
            const allApps = R.uniqBy(app => (app as any).id || app.appId, [targetApp, ...similarApps]);
            const topApps = allApps.slice(0, 20); // Focus on top 20 context

            // 4. Get Reviews for Target App (Crucial for weaknesses)
            // We also want reviews for the "vulnerable" similar apps to see if the whole niche is suffering
            const reviewsMap: Record<string, Review[]> = {};

            // Always fetch reviews for target app
            try {
                const targetReviews = await this.aso.getReviews(appId, { num: 150, sort: 1 });
                let reviewList: Review[] = [];
                if (Array.isArray(targetReviews)) {
                    reviewList = targetReviews;
                } else if (targetReviews && Array.isArray(targetReviews.data)) {
                    reviewList = targetReviews.data;
                }
                // Filter negative reviews for "weakness detection"
                reviewsMap[appId] = reviewList.filter(r => r.score <= 3).slice(0, 50);
            } catch (e) {
                console.warn(`Failed to fetch reviews for target app ${appId}`);
            }

            // Also fetch reviews for other vulnerable apps in the similar list
            const vulnerable = topApps
                .filter(app => app.appId !== appId && (app.minInstalls || 0) > 10000 && (app.score || 0) < 4.2)
                .slice(0, 2); // Limit to 2 others to save time

            for (const app of vulnerable) {
                try {
                    const reviews = await this.aso.getReviews(app.appId, { num: 150, sort: 1 });
                    let reviewList: Review[] = [];
                    if (Array.isArray(reviews)) reviewList = reviews;
                    else if (reviews && Array.isArray(reviews.data)) reviewList = reviews.data;
                    reviewsMap[app.appId] = reviewList.filter(r => r.score <= 3).slice(0, 50);
                } catch (e) {
                    // Ignore
                }
            }

            return {
                keyword: targetApp.title, // Use app title as "keyword" context
                apps: topApps,
                reviews: reviewsMap,
                stats: {
                    avgRating: R.mean(topApps.map(a => a.score || 0)),
                    avgInstalls: R.mean(topApps.map(a => a.minInstalls || 0)),
                    volatility: 0,
                    megacorps: 0
                },
                context: 'app-clone',
                targetAppId: appId
            };

        } catch (e) {
            console.error(`Failed to analyze app ${appId}:`, e);
            throw e;
        }
    }

    async searchApps(query: string): Promise<AppInfo[]> {
        return this.searchStore(query, 'es'); // Default to ES for search selection, or maybe US? Let's do ES for now or param
    }

    private async searchStore(keyword: string, country: string): Promise<AppInfo[]> {
        // Throttling: 500ms between requests to avoid 429s (which cause HTML errors)
        const aso = new ASO('gplay', { country, cache: true, throttle: 500 });

        try {
            // 1. Search without full details first (safer)
            const results = await aso.search({ term: keyword, num: 20, fullDetail: false });

            // 2. Fetch details for each app individually, ignoring failures
            const detailedResults = await Promise.all(
                results.map(async (app) => {
                    const appId = app.appId || (app as any).id;
                    if (!appId) return app;
                    try {
                        return await aso.getAppInfo(appId);
                    } catch (e) {
                        console.warn(`[WARNING] Failed to fetch details for ${appId} (${country}):`, e instanceof Error ? e.message : e);
                        // Return basic info if detail fetch fails (better than nothing)
                        return app;
                    }
                })
            );

            return detailedResults;
        } catch (e) {
            console.error(`[ERROR] Search failed for ${keyword} in ${country}:`, e);
            return [];
        }
    }
}

export class NicheAnalyzer {
    static analyze(data: NicheData): NicheReport {
        const { apps, reviews, context, targetAppId } = data;

        // --- 1. Dynamic Difficulty Score (0-100) ---
        // Base Difficulty starts at 0 and grows with competition strength
        let difficultyScore = 0;
        const top10 = apps.slice(0, 10);

        // Factor A: Saturation of High Quality Apps (Rating > 4.5)
        // If 10/10 apps are > 4.5, +50 points.
        const highQualityCount = top10.filter(a => (a.score || 0) >= 4.5).length;
        difficultyScore += highQualityCount * 5;

        // Factor B: Established Players (Installs > 1M)
        // Hard to unseat apps with massive userbases. +4 points each.
        const giantsCount = top10.filter(a => (a.minInstalls || 0) >= 1000000).length;
        difficultyScore += giantsCount * 4;

        // Factor C: Megacorps
        // Fighting Google/Amazon is hard. +10 points each.
        const megacorps = ['Google', 'Meta', 'Microsoft', 'Amazon', 'Facebook', 'Instagram', 'WhatsApp', 'Netflix', 'Spotify', 'Adobe', 'Samsung'];
        const megacorpCount = top10.filter(a => megacorps.some(corp => (a.developer || '').includes(corp))).length;
        difficultyScore += megacorpCount * 10;

        // Cap Difficulty
        difficultyScore = Math.min(100, Math.round(difficultyScore));


        // --- 2. Dynamic Opportunity Score (0-100) ---
        // Measures "Gap" in the market. 
        let opportunityScore = 0; // Reset for calculation
        const avgRatingTop10 = R.mean(top10.map(a => a.score || 0));

        // CLONE SPECIFIC LOGIC
        if (context === 'app-clone' && targetAppId) {
            const target = apps.find(a => a.appId === targetAppId);
            if (target) {
                // If Target is weak, HUGE opportunity
                if ((target.score || 0) < 4.0) opportunityScore += 40;
                if ((target.score || 0) < 3.5) opportunityScore += 20;

                const lastUpdate = new Date(target.updated || 0);
                const oneYearAgo = Date.now() - 365 * 24 * 60 * 60 * 1000;
                if (lastUpdate.getTime() < oneYearAgo) opportunityScore += 30; // Abandoned target

                // If target has tons of installs, it's worth cloning
                if ((target.minInstalls || 0) > 100000) opportunityScore += 10;
                if ((target.minInstalls || 0) > 1000000) opportunityScore += 10;
            }
        } else {
            // Standard Keyword Logic (Existing)
            if (avgRatingTop10 < 4.0) opportunityScore += 20;
            const oneYearAgo = Date.now() - 365 * 24 * 60 * 60 * 1000;
            const outdatedGiants = apps.filter(a => (a.minInstalls || 0) > 100000 && (new Date(a.updated || 0).getTime() < oneYearAgo));
            if (outdatedGiants.length > 0) opportunityScore += 20;
            // Factor A: Vulnerable Competitors in Top 10
            // Every app with rating < 4.0 is a gap. +8 points.
            const weakCompetitors = top10.filter(a => (a.score || 0) < 4.0).length;
            opportunityScore += weakCompetitors * 8;

            // Factor B: Abandoned Apps (Last update > 1 year)
            // Users hate abandoned apps. +8 points.
            const abandonedCount = top10.filter(a => new Date(a.updated || 0).getTime() < oneYearAgo).length;
            opportunityScore += abandonedCount * 8;
        }

        // Add Shared Factors
        // Factor C: Market Demand (Average Installs) - REUSED
        const avgInstalls = R.mean(top10.map(a => a.minInstalls || 0));
        if (avgInstalls > 1000000) opportunityScore += 20; // Reduced weight for shared
        else if (avgInstalls > 100000) opportunityScore += 15;
        else if (avgInstalls > 10000) opportunityScore += 10;

        // Final Cap & Boosts
        if (difficultyScore < 30 && avgInstalls > 10000) opportunityScore += 15;
        opportunityScore = Math.min(100, Math.round(opportunityScore));


        // --- 3. Volatility Index ---
        // "Volatility Index: ¿Hay apps nuevas (menos de 6 meses) en el Top 20?"
        const sixMonthsAgo = Date.now() - 180 * 24 * 60 * 60 * 1000;
        const volatileApps = apps.filter(a => {
            const released = (a as any).released;
            if (released) {
                return new Date(released).getTime() > sixMonthsAgo;
            }
            return false;
        });
        const hasVolatility = volatileApps.length > 0;

        // --- 4. Análisis de Sentimiento ---
        const allReviews = Object.values(reviews).flat();
        const painPoints = this.analyzeSentiment(allReviews);

        // --- 5. Competitor Analysis ---
        const competitors: CompetitorSummary[] = top10.map(app => {
            let weakness: CompetitorSummary['weakness'] = null;
            const updated = new Date(app.updated || 0);

            if ((app.score || 0) < 4.0) weakness = 'Baja Calidad';
            else if (updated.getTime() < Date.now() - 365 * 24 * 60 * 60 * 1000) weakness = 'Abandonada';

            // Si no tiene debilidad obvia, miramos si tenemos reviews de monetización
            const appReviews = reviews[app.appId];
            if (!weakness && appReviews) {
                const sentiment = this.analyzeSentiment(appReviews);
                if (sentiment.monetizationHate.length > 0) weakness = 'Quejas de Monetización';
            }

            return {
                appId: app.appId,
                title: app.title,
                icon: (app as any).icon || '',
                developer: app.developer || 'Unknown',
                developerId: (app as any).developerId,
                developerEmail: (app as any).developerEmail,
                developerWebsite: (app as any).developerWebsite,
                developerAddress: (app as any).developerAddress,
                rating: app.score || 0,
                ratings: (app as any).ratings,
                reviews: (app as any).reviews || 0,
                scoreText: (app as any).scoreText,
                downloads: (app as any).installs || ((app as any).minInstalls ? (app as any).minInstalls + '+' : 'N/A'),
                minInstalls: (app as any).minInstalls,
                lastUpdated: updated.toLocaleDateString(),
                released: (app as any).released,
                recentChanges: (app as any).recentChanges,
                summary: (app as any).summary,
                description: app.description,
                genre: (app as any).genre,
                genreId: (app as any).genreId,
                price: (app as any).price,
                currency: (app as any).currency,
                free: (app as any).free,
                offersIAP: (app as any).offersIAP,
                IAPRange: (app as any).IAPRange,
                adSupported: (app as any).adSupported,
                size: (app as any).size,
                androidVersion: (app as any).androidVersion,
                androidVersionText: (app as any).androidVersionText,
                contentRating: (app as any).contentRating,
                contentRatingDescription: (app as any).contentRatingDescription,
                screenshots: (app as any).screenshots,
                video: (app as any).video,
                videoImage: (app as any).videoImage,
                previewVideo: (app as any).previewVideo,
                histogram: (app as any).histogram,
                weakness,
                link: (app as any).url || '',
                url: (app as any).url,
                version: (app as any).version,
                headerImage: (app as any).headerImage,
                preregister: (app as any).preregister,
                earlyAccessEnabled: (app as any).earlyAccessEnabled,
                isAvailableInPlayPass: (app as any).isAvailableInPlayPass
            };
        });


        // --- Veredicto ---
        let verdict: 'GREEN LIGHT' | 'PROCEED WITH CAUTION' | 'ABANDON' = 'PROCEED WITH CAUTION';

        // Condiciones de Luz Verde (Oportunidades > Dificultad)
        if (opportunityScore >= 70 && difficultyScore < 60) verdict = 'GREEN LIGHT';

        // Condiciones de Abandono
        if (difficultyScore >= 80 || (difficultyScore > 60 && opportunityScore < 40)) verdict = 'ABANDON';

        // Custom Analysis Text for Clone context
        let opportunityText = `Puntuación: ${opportunityScore}. Demanda estimada: ${avgInstalls > 100000 ? 'Alta' : 'Media-Baja'}.`;
        if (context === 'app-clone') {
            const target = apps.find(a => a.appId === targetAppId);
            if (target) {
                opportunityText = `Análisis de Clonado para: ${target.title}. Oportunidad: ${opportunityScore}. Estado Objetivo: ${(target.score || 0) < 4.0 ? 'VULNERABLE (Rating Bajo)' : 'FUERTE'}.`;
            }
        }

        return {
            verdict,
            scores: {
                opportunity: Math.min(100, opportunityScore),
                difficulty: Math.min(100, difficultyScore),
                volatility: hasVolatility
            },
            analysis: {
                opportunity: opportunityText,
                difficulty: `Puntuación: ${difficultyScore}. ${megacorpCount} Megacorporaciones. ${highQualityCount}/10 apps de alta calidad (>4.5).`
            },
            productBlueprint: {
                mvpFeatures: this.suggestFeatures(painPoints),
                monetization: this.suggestMonetization(painPoints),
                techStack: "Flutter + Supabase (Recomendado para velocidad y tiempo real)"
            },
            painPoints,
            competitors
        };
    }

    private static analyzeSentiment(reviews: Review[]) {
        const categories = {
            criticalBugs: [] as string[],
            uxFriction: [] as string[],
            monetizationHate: [] as string[]
        };

        const keywords = {
            bugs: ['crash', 'freeze', 'bug', 'error', 'fails', 'closes', 'cierra', 'falla', 'lento', 'slow', 'broken', 'deja de funcionar', 'no abre', 'se sale', 'reinicia'],
            ux: ['ugly', 'confusing', 'hard', 'difficult', 'dificil', 'feo', 'button', 'menu', 'interfaz', 'interface', 'complicated', 'complicado', 'difícil', 'horroroso', 'botones', 'mal diseño'],
            money: ['expensive', 'trial', 'pay', 'money', 'caro', 'pago', 'suscripcion', 'subscription', 'ads', 'anuncios', 'cost', 'estafa', 'dinero', 'comprar', 'precios']
        };

        reviews.forEach(r => {
            const text = (r.text + " " + (r.title || "")).toLowerCase();
            if (keywords.bugs.some(k => text.includes(k))) categories.criticalBugs.push(r.text);
            if (keywords.ux.some(k => text.includes(k))) categories.uxFriction.push(r.text);
            if (keywords.money.some(k => text.includes(k))) categories.monetizationHate.push(r.text);
        });

        // Los 3 únicos para cada categoría (recortar longitud)
        const format = (list: string[]) => R.uniq(list).slice(0, 3).map(s => s.length > 100 ? s.slice(0, 100) + "..." : s);

        categories.criticalBugs = format(categories.criticalBugs);
        categories.uxFriction = format(categories.uxFriction);
        categories.monetizationHate = format(categories.monetizationHate);

        return categories;
    }

    private static suggestFeatures(painPoints: any) {
        const features = [];
        if (painPoints.criticalBugs.length > 0) features.push("Lógica estable y sin fallos");
        if (painPoints.uxFriction.length > 0) features.push("UI/UX Simplificada y Moderna");
        features.push("Modo Offline (Siempre es un plus)");
        return features;
    }

    private static suggestMonetization(painPoints: any) {
        if (painPoints.monetizationHate.length > 0) return "Freemium con precio justo o Pago único (los usuarios odian las suscripciones aquí)";
        return "Híbrido: Anuncios + IAP para quitar anuncios";
    }
}
