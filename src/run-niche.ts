import { NicheScraper, NicheAnalyzer } from './niche.js';

const keyword = process.argv[2];
if (!keyword) {
    console.error("Please provide a keyword. Usage: tsx src/run-niche.ts \"keyword\"");
    process.exit(1);
}

console.log(`Analizando nicho para: "${keyword}"...`);

const scraper = new NicheScraper();
scraper.scrape(keyword).then((data) => {
    console.log("Datos recolectados. Analizando...");
    const report = NicheAnalyzer.analyze(data);

    console.log("\n====== REPORTE DE VALIDADOR DE NICHO ASO ======");
    console.log(`KEYWORD: ${keyword}`);
    console.log(`VEREDICTO: [ ${report.verdict} ]`);
    console.log("\n--- PUNTUACIONES ---");
    console.log(`Oportunidad: ${report.scores.opportunity}/100`);
    console.log(`Dificultad:  ${report.scores.difficulty}/100`);
    console.log(`Volatilidad: ${report.scores.volatility ? "ALTA (Nuevas apps entrando)" : "BAJA (Estancado)"}`);

    console.log("\n--- ANÁLISIS ---");
    console.log("Oportunidad:", report.analysis.opportunity);
    console.log("Dificultad: ", report.analysis.difficulty);

    console.log("\n--- PUNTOS DE DOLOR (de reseñas de 1-2 estrellas) ---");
    console.log("BUGS CRÍTICOS:", report.painPoints.criticalBugs);
    console.log("FRICCIÓN UX:", report.painPoints.uxFriction);
    console.log("ODIO A LA MONETIZACIÓN:", report.painPoints.monetizationHate);

    console.log("\n--- BLUEPRINT DE PRODUCTO ---");
    console.log("Características MVP:", report.productBlueprint.mvpFeatures);
    console.log("Monetización:", report.productBlueprint.monetization);
    console.log("Stack Técnico:", report.productBlueprint.techStack);

}).catch(err => {
    console.error("Error:", err);
});
