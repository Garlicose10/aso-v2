import { AppInfo, Review } from './types.js';
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
    histogram?: {
        [key: string]: number;
    };
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
export declare class NicheScraper {
    private aso;
    constructor();
    scrape(keyword: string): Promise<NicheData>;
    analyzeApp(appId: string): Promise<NicheData>;
    searchApps(query: string): Promise<AppInfo[]>;
    private searchStore;
}
export declare class NicheAnalyzer {
    static analyze(data: NicheData): NicheReport;
    private static analyzeSentiment;
    private static suggestFeatures;
    private static suggestMonetization;
}
