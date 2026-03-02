import { ASO } from './src/main.js';

async function testDiscover() {
    const aso = new ASO('gplay', { country: 'es', language: 'es' });
    const categories = ['PRODUCTIVITY', 'LIFESTYLE', 'TOOLS'];
    try {
        for (const cat of categories) {
            console.log(`\nFetching TOP_FREE apps for ${cat}...`);
            const apps = await aso.getCollection({
                collection: 'TOP_FREE',
                category: cat,
                num: 200
            });

            // Step 1: Filter by score only
            const lowScoreApps = apps.filter(a => (a.score || 0) > 0 && (a.score || 0) <= 4.5);
            console.log(`Found ${lowScoreApps.length} apps with score <= 4.5. Fetching details for top 5 to check installs...`);

            // Step 2: Fetch details for a few to check minInstalls
            for (const app of lowScoreApps.slice(0, 5)) {
                try {
                    const detail = await aso.getAppInfo(app.appId || (app as any).id);
                    console.log(`  - ${detail.title} | Rating: ${detail.score} | Installs: ${detail.minInstalls}`);
                    if ((detail.minInstalls || 0) >= 100000 && (detail.score || 0) <= 4.1) {
                        console.log(`    >>> OCEAN AZUL ENCONTRADO!`);
                    }
                } catch (e) {
                    console.log(`  - Failed to fetch details for ${app.appId}`);
                }
            }
        }
    } catch (e) {
        console.error('Error:', e);
    }
}

testDiscover();
