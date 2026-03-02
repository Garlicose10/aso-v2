import { useState, useEffect } from 'react';

// Define types based on backend response
interface NicheReport {
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
  competitors: Array<{
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
    weakness?: string;
    link: string;
    url?: string;
    version?: string;
    headerImage?: string;
    preregister?: boolean;
    earlyAccessEnabled?: boolean;
    isAvailableInPlayPass?: boolean;
  }>;
}


function App() {
  const [keyword, setKeyword] = useState('');
  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState<NicheReport | null>(null);
  const [error, setError] = useState('');
  const [selectedApp, setSelectedApp] = useState<any | null>(null);

  // New State for Clone Mode
  const [mode, setMode] = useState<'keyword' | 'app' | 'discover'>('keyword');
  const [appSearchQuery, setAppSearchQuery] = useState('');
  const [appSearchResults, setAppSearchResults] = useState<any[]>([]);
  const [selectedTargetApp, setSelectedTargetApp] = useState<any | null>(null);

  // Oceans State
  const [discoveredOceans, setDiscoveredOceans] = useState<any[]>([]);

  // History State
  const [history, setHistory] = useState<any[]>([]);

  useEffect(() => {
    const saved = localStorage.getItem('aso_history');
    if (saved) {
      try {
        setHistory(JSON.parse(saved));
      } catch (e) {
        console.error('Failed to parse history', e);
      }
    }
  }, []);

  const addToHistory = (type: 'keyword' | 'app', query: string, verdict: string, score: number) => {
    const newItem = {
      type,
      query,
      verdict,
      score,
      timestamp: Date.now()
    };

    // Avoid duplicates at the top
    const newHistory = [newItem, ...history.filter(h => h.query !== query).slice(0, 9)];
    setHistory(newHistory);
    localStorage.setItem('aso_history', JSON.stringify(newHistory));
  };

  const searchApps = async (query: string) => {
    if (query.length < 3) {
      setAppSearchResults([]);
      return;
    }
    try {
      const response = await fetch(`http://localhost:3000/api/search?q=${encodeURIComponent(query)}`);
      if (response.ok) {
        const data = await response.json();
        setAppSearchResults(data);
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      if (mode === 'app' && appSearchQuery) {
        searchApps(appSearchQuery);
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [appSearchQuery, mode]);

  const analyze = async (overrideApp?: any) => {
    setLoading(true);
    setError('');
    setReport(null);

    try {
      let url = '';
      const targetApp = overrideApp || selectedTargetApp;

      if (mode === 'keyword') {
        if (!keyword.trim()) return;
        url = `http://localhost:3000/api/analyze?keyword=${encodeURIComponent(keyword)}`;
      } else {
        if (!targetApp && !appSearchQuery.includes('http')) {
          setError('Por favor selecciona una app de la lista o pega una URL válida');
          setLoading(false);
          return;
        }
        // If user pasted a URL directly
        const appId = targetApp ? targetApp.appId : appSearchQuery; // Server handles URL parsing
        url = `http://localhost:3000/api/analyze-app?appId=${encodeURIComponent(appId)}`;
      }

      const response = await fetch(url);
      if (!response.ok) throw new Error('Error al obtener análisis');
      const data = await response.json();
      setReport(data);

      // Save to History
      addToHistory(
        mode === 'discover' ? 'app' : mode,
        mode === 'keyword' ? keyword : (targetApp?.title || appSearchQuery),
        data.verdict,
        data.scores.opportunity
      );

    } catch (err) {
      setError('Análisis fallido. Por favor intenta de nuevo.');
    } finally {
      setLoading(false);
    }
  };

  const discoverOceans = async () => {
    setMode('discover');
    setLoading(true);
    setError('');
    setReport(null);
    setDiscoveredOceans([]);

    try {
      const response = await fetch('http://localhost:3000/api/discover');
      if (!response.ok) throw new Error('Error al explorar océanos');
      const data = await response.json();
      setDiscoveredOceans(data);
    } catch (err) {
      setError('Exploración fallida. Por favor intenta de nuevo.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 text-white font-sans selection:bg-purple-500 selection:text-white">
      <header className="bg-slate-900 border-b border-white/10 sticky top-0 z-50 backdrop-blur-md bg-opacity-80">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-2xl">⚡</span>
            <h1 className="text-xl font-bold bg-gradient-to-r from-purple-400 to-pink-600 bg-clip-text text-transparent">
              Prompt Maestro ASO
            </h1>
          </div>
          <div className="text-sm text-slate-400">Validador de Nicho 2.0</div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-12">
        {/* Search Section */}
        <section className="text-center mb-16 space-y-6">
          <h2 className="text-5xl font-extrabold tracking-tight bg-gradient-to-br from-white via-slate-200 to-slate-500 bg-clip-text text-transparent">
            Encuentra tu Océano Azul.
          </h2>
          <p className="text-lg text-slate-400 max-w-2xl mx-auto">
            Analiza saturación de mercado, debilidad de competidores y puntos de dolor de usuarios en segundos.
          </p>


          {/* Mode Switcher */}
          <div className="flex justify-center mb-8">
            <div className="bg-slate-800 p-1 rounded-xl flex">
              <button
                onClick={() => setMode('keyword')}
                className={`px-6 py-2 rounded-lg text-sm font-bold transition-all ${mode === 'keyword' ? 'bg-purple-600 text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}
              >
                🔍 Buscar Nicho
              </button>
              <button
                onClick={() => setMode('app')}
                className={`px-6 py-2 rounded-lg text-sm font-bold transition-all ${mode === 'app' ? 'bg-pink-600 text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}
              >
                🐑 Clonar App
              </button>
              <button
                onClick={discoverOceans}
                className={`px-6 py-2 rounded-lg text-sm font-bold transition-all ${mode === 'discover' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}
              >
                🌊 Océanos Azules
              </button>
            </div>
          </div>

          <div className="relative max-w-xl mx-auto group z-20">
            <div className={`absolute -inset-0.5 bg-gradient-to-r ${mode === 'keyword' ? 'from-purple-600 to-pink-600' : mode === 'app' ? 'from-pink-600 to-orange-600' : 'from-blue-600 to-cyan-500'} rounded-xl blur opacity-75 group-hover:opacity-100 transition duration-1000 group-hover:duration-200 animate-tilt`}></div>
            <div className="relative flex gap-2 p-2 bg-slate-900 rounded-xl border border-white/10">

              {mode === 'discover' ? (
                <div className="flex-1 w-full text-center py-3 text-blue-400 font-bold">
                  {loading ? 'Navegando aguas profundas...' : <button onClick={discoverOceans} className="underline">Explorar de nuevo</button>}
                </div>
              ) : mode === 'keyword' ? (
                <input
                  type="text"
                  placeholder="Palabra clave semilla (ej: 'yoga para perros')"
                  className="flex-1 bg-transparent border-none outline-none text-white px-4 placeholder-slate-500 text-lg h-12"
                  value={keyword}
                  onChange={(e) => setKeyword(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && analyze()}
                />
              ) : (
                <div className="flex-1 relative">
                  <input
                    type="text"
                    placeholder="Nombre de App o URL de Google Play"
                    className="w-full bg-transparent border-none outline-none text-white px-4 placeholder-slate-500 text-lg h-12"
                    value={appSearchQuery}
                    onChange={(e) => {
                      setAppSearchQuery(e.target.value);
                      setSelectedTargetApp(null); // Reset selection on type
                    }}
                    onKeyDown={(e) => e.key === 'Enter' && analyze()}
                  />
                  {/* Search Dropdown */}
                  {appSearchResults.length > 0 && !selectedTargetApp && (
                    <div className="absolute top-14 left-0 w-full bg-slate-800 border border-white/10 rounded-xl shadow-2xl overflow-hidden max-h-60 overflow-y-auto z-50">
                      {appSearchResults.map(app => (
                        <div
                          key={app.appId}
                          className="p-3 hover:bg-slate-700 cursor-pointer flex items-center gap-3 transition-colors border-b border-white/5 last:border-0"
                          onClick={() => {
                            setSelectedTargetApp(app);
                            setAppSearchQuery(app.title);
                            setAppSearchResults([]);
                          }}
                        >
                          <img src={app.icon} className="w-8 h-8 rounded bg-slate-600" referrerPolicy="no-referrer" />
                          <div className='overflow-hidden'>
                            <div className="text-sm font-bold text-white truncate">{app.title}</div>
                            <div className="text-xs text-slate-400 truncate">{app.developer}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {mode !== 'discover' && (
                <button
                  onClick={() => analyze()}
                  disabled={loading}
                  className="bg-white text-slate-900 px-8 rounded-lg font-bold hover:bg-slate-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {loading ? (
                    <>
                      <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      {mode === 'keyword' ? 'Minando...' : 'Analizando...'}
                    </>
                  ) : (
                    'Analizar'
                  )}
                </button>
              )}
            </div>

            {/* Discovered Oceans Results */}
            {mode === 'discover' && discoveredOceans.length > 0 && !report && (
              <div className="mt-8 text-left mx-auto animate-fade-in">
                <h3 className="text-xl font-bold text-blue-400 mb-4 ml-2">🌊 Oportunidades Encontradas</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {discoveredOceans.map((app, i) => (
                    <div
                      key={i}
                      onClick={() => {
                        setMode('app');
                        setSelectedTargetApp(app);
                        setAppSearchQuery(app.title);
                        analyze(app);
                      }}
                      className="bg-slate-800/80 border border-white/5 hover:border-blue-500/50 hover:bg-slate-800 p-4 rounded-xl flex items-start gap-4 cursor-pointer group transition-all"
                    >
                      <img src={app.icon} className="w-16 h-16 rounded-xl bg-slate-700" referrerPolicy="no-referrer" />
                      <div className="flex-1 overflow-hidden">
                        <div className="font-bold text-white group-hover:text-blue-300 transition-colors truncate">{app.title}</div>
                        <div className="text-xs text-slate-400 mb-2 truncate">{app.developer}</div>
                        <div className="flex gap-2 text-xs font-bold">
                          <span className="bg-red-500/20 text-red-400 px-2 py-1 rounded">⭐ {app.score?.toFixed(1) || '?'}</span>
                          <span className="bg-green-500/20 text-green-400 px-2 py-1 rounded">⏬ {app.installs}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Recent Searches */}
            {history.length > 0 && !report && mode !== 'discover' && (
              <div className="mt-8 text-left max-w-lg mx-auto animate-fade-in">
                <h3 className="text-xs font-bold text-slate-500 uppercase mb-3 ml-2">Historial Reciente</h3>
                <div className="space-y-2">
                  {history.map((item, i) => (
                    <div
                      key={i}
                      onClick={() => {
                        if (item.type === 'keyword') {
                          setMode('keyword');
                          setKeyword(item.query);
                          // Auto-trigger? Maybe just set it so user clicks
                        } else {
                          setMode('app');
                          setAppSearchQuery(item.query);
                          // We don't have the full app object here easily unless we store it, 
                          // but for now setting query allows re-search.
                        }
                      }}
                      className="bg-slate-800/50 border border-white/5 hover:border-white/20 p-3 rounded-xl flex items-center justify-between cursor-pointer group transition-all"
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-lg">{item.type === 'keyword' ? '🔍' : '🐑'}</span>
                        <div>
                          <div className="font-medium text-slate-300 group-hover:text-white transition-colors">{item.query}</div>
                          <div className="text-[10px] text-slate-500">{new Date(item.timestamp).toLocaleDateString()}</div>
                        </div>
                      </div>
                      <div className={`text-xs font-bold px-2 py-1 rounded ${item.score >= 70 ? 'bg-green-500/20 text-green-400' : 'bg-orange-500/20 text-orange-400'}`}>
                        {item.score} pts
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

          </div>
          {error && <p className="text-red-400 bg-red-400/10 inline-block px-4 py-2 rounded-lg mt-4">{error}</p>}
        </section>

        {/* Report Section */}
        {report && (
          <div className="space-y-8 animate-fade-in-up">
            {/* Verdict Banner */}
            <div className={`
              p-1 rounded-2xl bg-gradient-to-r 
              ${report.verdict === 'GREEN LIGHT' ? 'from-green-500 to-emerald-500' :
                report.verdict === 'PROCEED WITH CAUTION' ? 'from-yellow-500 to-orange-500' :
                  'from-red-500 to-rose-600'}
            `}>
              <div className="bg-slate-900 rounded-xl p-8 text-center relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-1 bg-white/20"></div>
                <h3 className="text-sm font-bold tracking-widest text-white/50 mb-2 uppercase">Veredicto</h3>
                <div className={`text-4xl font-black ${report.verdict === 'GREEN LIGHT' ? 'text-green-400' :
                  report.verdict === 'PROCEED WITH CAUTION' ? 'text-yellow-400' :
                    'text-red-400'
                  }`}>
                  {report.verdict === 'GREEN LIGHT' ? 'LUZ VERDE' :
                    report.verdict === 'PROCEED WITH CAUTION' ? 'PROCEDER CON CAUTELA' :
                      'ABANDONAR'}
                </div>
              </div>
            </div>

            {/* Scores Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <ScoreCard
                label="Oportunidad"
                score={report.scores.opportunity}
                description={report.analysis.opportunity}
              />
              <ScoreCard
                label="Dificultad"
                score={report.scores.difficulty}
                description={report.analysis.difficulty}
                inverse
              />
              <div className="bg-slate-800/50 p-6 rounded-xl border border-white/5 hover:border-white/10 transition-colors">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-bold text-slate-300">Volatilidad</h4>
                  <span className={`px-2 py-1 rounded text-xs font-bold ${report.scores.volatility ? 'bg-purple-500/20 text-purple-400' : 'bg-slate-700 text-slate-400'}`}>
                    ÍNDICE
                  </span>
                </div>
                <div className="text-3xl font-bold mb-2">
                  {report.scores.volatility ? 'Alta' : 'Baja'}
                </div>
                <p className="text-sm text-slate-400 leading-relaxed">
                  {report.scores.volatility ? 'Sangre fresca entrando al top 20. El mercado es fluido.' : 'El Top 20 está estancado. Difícil de entrar.'}
                </p>
              </div>
            </div>

            {/* Deep Dive Section */}
            <div className="grid md:grid-cols-2 gap-8">
              {/* Pain Points */}
              <div className="space-y-4">
                <h3 className="text-xl font-bold flex items-center gap-2">
                  <span className="text-red-400">🔥</span> Puntos de Dolor del Mercado
                </h3>
                <div className="space-y-3">
                  <PainPointCard title="Bugs Críticos" items={report.painPoints.criticalBugs} />
                  <PainPointCard title="Fricción UX" items={report.painPoints.uxFriction} />
                  <PainPointCard title="Odio a la Monetización" items={report.painPoints.monetizationHate} />
                </div>
              </div>

              {/* Product Blueprint */}
              <div className="space-y-4">
                <h3 className="text-xl font-bold flex items-center gap-2">
                  <span className="text-cyan-400">💎</span> Blueprint de Producto
                </h3>
                <div className="bg-slate-800/30 border border-white/5 rounded-2xl p-6 space-y-6">
                  <div>
                    <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Stack Técnico Recomendado</h4>
                    <div className="text-cyan-300 font-mono text-sm bg-cyan-950/30 inline-block px-3 py-1 rounded border border-cyan-500/20">
                      {report.productBlueprint.techStack}
                    </div>
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Estrategia de Monetización</h4>
                    <p className="text-slate-300">{report.productBlueprint.monetization}</p>
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Características MVP</h4>
                    <ul className="space-y-2">
                      {report.productBlueprint.mvpFeatures.map((feature, i) => (
                        <li key={i} className="flex items-start gap-2 text-slate-300 text-sm">
                          <span className="text-green-400 mt-1">✓</span> {feature}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            </div>

            {/* Competitor Analysis Section */}
            <div className="space-y-6 pt-8 border-t border-white/10">
              <h3 className="text-2xl font-bold bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent flex items-center gap-2">
                <span>⚔️</span> Análisis de Competencia (Top 10)
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {report.competitors && report.competitors.map((app: any) => (
                  <div
                    key={app.appId}
                    onClick={() => setSelectedApp(app)}
                    className="block bg-slate-800/40 border border-white/5 rounded-xl p-4 hover:bg-slate-800/60 hover:border-white/20 transition-all group cursor-pointer"
                  >
                    <div className="flex items-start gap-3">
                      <img
                        src={app.icon}
                        alt={app.title}
                        className="w-12 h-12 rounded-lg object-cover bg-slate-700"
                        referrerPolicy="no-referrer"
                      />
                      <div className="flex-1 min-w-0">
                        <h4 className="font-bold text-slate-200 truncate group-hover:text-cyan-400 transition-colors">{app.title}</h4>
                        <p className="text-xs text-slate-400 truncate">{app.developer}</p>

                        <div className="flex items-center gap-3 mt-2 text-xs text-slate-400">
                          <span className="flex items-center gap-1" title="Valoración">
                            ⭐ <span className="text-slate-200">{app.rating.toFixed(1)}</span>
                          </span>
                          <span className="flex items-center gap-1" title="Reseñas">
                            💬 <span className="text-slate-200">{new Intl.NumberFormat('es-ES', { notation: 'compact' }).format(app.reviews)}</span>
                          </span>
                          <span className="flex items-center gap-1" title="Descargas">
                            ⬇️ <span className="text-slate-200">{app.downloads}</span>
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex gap-2 mt-3">
                      {app.offersIAP && <span className="text-[10px] bg-yellow-500/10 text-yellow-500 px-1.5 py-0.5 rounded border border-yellow-500/20">IAP</span>}
                      {app.adSupported && <span className="text-[10px] bg-blue-500/10 text-blue-400 px-1.5 py-0.5 rounded border border-blue-500/20">ADS</span>}
                      {app.video && <span className="text-[10px] bg-red-500/10 text-red-400 px-1.5 py-0.5 rounded border border-red-500/20">VIDEO</span>}
                    </div>

                    {app.weakness && (
                      <div className="mt-3 bg-red-500/10 text-red-400 text-xs py-1 px-2 rounded border border-red-500/20 inline-flex items-center gap-1.5 w-full">
                        <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse"></span>
                        {app.weakness}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

          </div>
        )}

        {/* App Details Modal */}
        {selectedApp && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in" onClick={() => setSelectedApp(null)}>
            <div className="bg-slate-900 border border-white/10 rounded-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto shadow-2xl" onClick={e => e.stopPropagation()}>
              <div className="p-6">

                {/* Header */}
                <div className="flex items-start justify-between mb-6">
                  <div className="flex gap-4">
                    <img src={selectedApp.icon} className="w-20 h-20 rounded-2xl bg-slate-800 shadow-lg" referrerPolicy="no-referrer" />
                    <div>
                      <h2 className="text-2xl font-bold text-white mb-1">{selectedApp.title}</h2>
                      <a href={selectedApp.link} target="_blank" className="text-cyan-400 hover:text-cyan-300 text-sm flex items-center gap-1">
                        {selectedApp.developer}
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"></path></svg>
                      </a>
                      <div className="flex gap-2 mt-2">
                        <span className="text-xs bg-slate-800 px-2 py-1 rounded text-slate-300">{selectedApp.genre}</span>
                        <span className="text-xs bg-slate-800 px-2 py-1 rounded text-slate-300">v{selectedApp.version || 'Latest'}</span>
                        <span className="text-xs bg-slate-800 px-2 py-1 rounded text-slate-300">{selectedApp.contentRating}</span>
                      </div>
                    </div>
                  </div>
                  <button onClick={() => setSelectedApp(null)} className="text-slate-400 hover:text-white bg-slate-800 p-2 rounded-full hover:bg-slate-700 transition">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                  </button>
                </div>

                {/* Screenshots Carousel */}
                {selectedApp.screenshots && (
                  <div className="mb-8 overflow-x-auto pb-4 flex gap-3 snap-x">
                    {selectedApp.video && (
                      <a href={selectedApp.video} target="_blank" className="shrink-0 w-48 h-80 bg-slate-800 rounded-lg flex items-center justify-center relative overflow-hidden group snap-center">
                        {selectedApp.videoImage ? <img src={selectedApp.videoImage} className="absolute inset-0 w-full h-full object-cover opacity-50" referrerPolicy="no-referrer" /> : null}
                        <div className="w-12 h-12 rounded-full bg-red-600 flex items-center justify-center group-hover:scale-110 transition z-10">
                          <svg className="w-6 h-6 text-white ml-1" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
                        </div>
                        <span className="absolute bottom-4 left-4 text-xs font-bold uppercase tracking-wider">Video Preview</span>
                      </a>
                    )}
                    {selectedApp.screenshots.map((src: string, i: number) => (
                      <img key={i} src={src} className="shrink-0 h-80 rounded-lg border border-white/10 snap-center" referrerPolicy="no-referrer" loading="lazy" />
                    ))}
                  </div>
                )}

                <div className="grid md:grid-cols-3 gap-8">
                  {/* Left Col: Main Info */}
                  <div className="md:col-span-2 space-y-6">

                    {/* Description */}
                    <div>
                      <h3 className="font-bold text-white mb-2">Descripción</h3>
                      <div className="text-slate-300 text-sm leading-relaxed max-h-60 overflow-y-auto pr-2 text-justify whitespace-pre-line bg-slate-800/20 p-4 rounded-xl border border-white/5">
                        {selectedApp.description}
                      </div>
                    </div>

                    {/* Changelog */}
                    {selectedApp.recentChanges && (
                      <div>
                        <h3 className="font-bold text-white mb-2 text-xs uppercase tracking-wider text-slate-500">Novedades</h3>
                        <p className="text-slate-400 text-sm italic border-l-2 border-green-500/30 pl-3">
                          "{selectedApp.recentChanges}"
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Right Col: Stats */}
                  <div className="space-y-6">
                    <div className="bg-slate-800/50 rounded-xl p-4 space-y-4">
                      <div>
                        <div className="text-xs text-slate-500 uppercase font-bold mb-1">Valoración</div>
                        <div className="text-3xl font-black text-white flex items-end gap-2">
                          {selectedApp.scoreText || selectedApp.rating.toFixed(1)}
                          <span className="text-sm font-normal text-slate-400 mb-1">/ 5.0</span>
                        </div>
                        <div className="text-xs text-slate-400 mt-1">{selectedApp.ratings?.toLocaleString()} votos</div>
                      </div>

                      <div>
                        <div className="text-xs text-slate-500 uppercase font-bold mb-1">Descargas</div>
                        <div className="text-xl font-bold text-white">{selectedApp.downloads}</div>
                        <div className="text-xs text-slate-400 mt-1">Min. Installs</div>
                      </div>

                      <div>
                        <div className="text-xs text-slate-500 uppercase font-bold mb-1">Actualizado</div>
                        <div className="text-sm font-medium text-slate-300">{selectedApp.lastUpdated}</div>
                      </div>

                      <div className="pt-4 border-t border-white/10 space-y-2">
                        <div className="flex justify-between text-sm">
                          <span className="text-slate-500">Precio</span>
                          <span className={selectedApp.free ? "text-green-400" : "text-white"}>
                            {selectedApp.free ? "GRATIS" : selectedApp.price + " " + selectedApp.currency}
                          </span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-slate-500">IAP</span>
                          <span className={selectedApp.offersIAP ? "text-orange-400" : "text-slate-600"}>
                            {selectedApp.offersIAP ? "Sí" : "No"}
                          </span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-slate-500">Anuncios</span>
                          <span className={selectedApp.adSupported ? "text-red-400" : "text-slate-600"}>
                            {selectedApp.adSupported ? "Sí" : "No"}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Developer Info */}
                    <div className="p-4 rounded-xl border border-white/5 space-y-2">
                      <h4 className="text-xs font-bold text-slate-500 uppercase">Desarrollador</h4>
                      <div className="text-sm text-slate-300 truncate">{selectedApp.developer}</div>
                      {selectedApp.developerAddress && <div className="text-xs text-slate-500 line-clamp-2">{selectedApp.developerAddress}</div>}
                      {selectedApp.developerWebsite && <a href={selectedApp.developerWebsite} target="_blank" className="text-xs text-cyan-400 block hover:underline">Sitio Web</a>}
                      {selectedApp.developerEmail && <a href={`mailto:${selectedApp.developerEmail}`} className="text-xs text-cyan-400 block hover:underline">{selectedApp.developerEmail}</a>}
                    </div>
                  </div>
                </div>

              </div>
            </div>
          </div>
        )}

      </main>
    </div>

  );
}

export default App;

// Subcomponents

function ScoreCard({ label, score, description, inverse = false }: { label: string, score: number, description: string, inverse?: boolean }) {
  const isGood = inverse ? score < 60 : score > 60;
  return (
    <div className="bg-slate-800/50 p-6 rounded-xl border border-white/5 hover:border-white/10 transition-colors group">
      <div className="flex items-center justify-between mb-4">
        <h4 className="font-bold text-slate-300">{label}</h4>
        <div className={`text-2xl font-black ${isGood ? 'text-green-400' : 'text-orange-400'}`}>
          {score}
        </div>
      </div>
      <div className="w-full bg-slate-700 h-2 rounded-full mb-3 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-1000 ${isGood ? 'bg-green-500' : 'bg-orange-500'}`}
          style={{ width: `${score}%` }}
        ></div>
      </div>
      <p className="text-xs text-slate-400 leading-relaxed opacity-75 group-hover:opacity-100 transition-opacity">
        {description}
      </p>
    </div>
  );
}

function PainPointCard({ title, items }: { title: string, items: string[] }) {
  if (items.length === 0) return null;
  return (
    <div className="bg-slate-800/30 border border-white/5 rounded-xl p-4">
      <h4 className="font-semibold text-slate-300 text-sm mb-3">{title}</h4>
      <ul className="space-y-2">
        {items.map((item, i) => (
          <li key={i} className="text-xs text-slate-400 pl-3 border-l-2 border-slate-700 italic">
            "{item}"
          </li>
        ))}
      </ul>
    </div>
  );
}
