import { useCallback, useRef, useEffect, useState } from 'react';
import { api } from '../lib/api';
import { usePrdStore } from '../store/prdStore';
import { PrdChat } from '../components/prd/PrdChat';
import { PrdEditor } from '../components/prd/PrdEditor';
import { PrdScore } from '../components/prd/PrdScore';
import { PrdMockups } from '../components/prd/PrdMockups';
import { ScreenLightbox } from '../components/prd/ScreenLightbox';
import { PrdHistory } from '../components/prd/PrdHistory';
import { CostEstimate } from '../components/prd/CostEstimate';
import { ScreenshotUpload } from '../components/prd/ScreenshotUpload';
import { AnalysisLog } from '../components/prd/AnalysisLog';
import { CompetitiveTable } from '../components/prd/CompetitiveTable';
import { ProgressBar } from '../components/prd/ProgressBar';

const PRD_TEMPLATES = [
  { id: "landing", name: "Landing Page", icon: "🚀", desc: "Hero, features, pricing, CTA" },
  { id: "dashboard", name: "Dashboard", icon: "📊", desc: "Charts, tables, sidebar, metrics" },
  { id: "ecommerce", name: "E-Commerce", icon: "🛒", desc: "Products, cart, checkout, user account" },
  { id: "blog", name: "Blog / Portfolio", icon: "✍️", desc: "Posts, categories, author pages" },
  { id: "saas", name: "SaaS App", icon: "⚡", desc: "Auth, settings, billing, team management" },
  { id: "game", name: "Game UI", icon: "🎮", desc: "Menu, HUD, leaderboard, settings" },
];


// Client-side PRD scoring (mirrors backend logic for instant template preview)
function scorePrdLocal(content: string) {
  const lower = content.toLowerCase();
  const lines = content.split('\n');
  const screenHeaders = lines.filter((l: string) => /^#{1,3}\s.*(sayfa|ekran|page|screen|view)/i.test(l)).length;
  const hasRoutes = /route|path|navigation/i.test(lower);
  const hasColors = /renk|color|#[0-9a-f]{3,6}/i.test(lower);
  const hasFonts = /font|typography/i.test(lower);
  const hasTheme = /tema|theme|dark|light/i.test(lower);
  const componentKw = ['button', 'card', 'modal', 'input', 'form', 'header', 'footer', 'table', 'tab', 'nav'];
  const foundC = componentKw.filter(k => lower.includes(k)).length;
  const hasAnim = /animation|transition|hover|easing/i.test(lower);
  const hasResp = /breakpoint|responsive|mobile|tablet/i.test(lower);
  const hasApi = /api|endpoint|data|fetch/i.test(lower);
  const totalScreens = screenHeaders + (lower.match(/ekran|screen|view|sayfa|page/g)?.length || 0) / 3;
  const pageDetail = Math.min(20, (screenHeaders >= 4 ? 20 : screenHeaders >= 2 ? 14 : screenHeaders >= 1 ? 8 : 2) + (hasRoutes ? 3 : 0));
  const designSystem = (hasColors ? 6 : 0) + (hasFonts ? 5 : 0) + (hasTheme ? 5 : 0);
  const components = foundC >= 8 ? 15 : foundC >= 5 ? 11 : foundC >= 3 ? 7 : foundC >= 1 ? 4 : 0;
  const animations = hasAnim ? 6 : 0;
  const responsive = hasResp ? 5 : 0;
  const dataModel = hasApi ? 4 : 0;
  const screenCount = totalScreens >= 6 ? 15 : totalScreens >= 4 ? 11 : totalScreens >= 2 ? 7 : totalScreens >= 1 ? 3 : 0;
  const total = pageDetail + designSystem + components + animations + responsive + dataModel + screenCount;
  return { pageDetail, designSystem, components, animations, responsive, dataModel, screenCount, total, missing: [] as string[] };
}

function estimateCostLocal(content: string) {
  const headers = content.split('\n').filter((l: string) => /^#{1,3}\s/.test(l)).length;
  const storyCount = Math.max(3, Math.min(15, Math.round(headers * 0.8 + content.length / 3000)));
  const tokenCost = parseFloat((storyCount * 0.30).toFixed(2));
  const estimatedMinutes = Math.round(storyCount * 5);
  const successRate = Math.min(95, Math.max(40, scorePrdLocal(content).total));
  return { storyCount, tokenCost, estimatedMinutes, successRate };
}

export function PrdGenerator() {
  const store = usePrdStore();
  const [previousPrd, setPreviousPrd] = useState('');
  const esRef = useRef<EventSource | null>(null);

  // Sayfa acildiginda son PRD'yi DB'den otomatik yukle
  useEffect(() => {
    if (store.id) return; // zaten yuklu
    api.prdHistory().then(prds => {
      if (prds.length > 0 && !usePrdStore.getState().id) {
        const last = prds[0];
        setStore({
          id: last.id,
          title: last.title,
          platform: last.platform || 'web',
          urls: last.urls?.length ? last.urls : [''],
          description: last.description || '',
          prdContent: last.prd_content || '',
          prdVersion: last.prd_version || 0,
          score: last.score,
          scoreDetails: last.score_details,
          costEstimate: last.cost_estimate,
          analysis: last.analysis,
          research: last.research,
          chatHistory: last.chat_history || [],
          stitchProjectId: (last as any).stitch_project_id || (last.mockup_screens || []).find((s: any) => s.projectId)?.projectId || null,
          mockupScreens: (() => {
            const pid = (last as any).stitch_project_id || (last.mockup_screens || []).find((s: any) => s.projectId)?.projectId;
            return pid ? (last.mockup_screens || []).filter((s: any) => s.projectId === pid) : (last.mockup_screens || []);
          })(),
          runId: null, // Will be set below if run is still active
          projectName: last.title || '',
        });
      }
      // Check if last run is still active — if not, clear runId
      if (Z.run_id) {
        fetch('/api/setfarm/pipeline').then(r => r.json()).then((pipe: any) => {
          const running = [...(pipe.running || []), ...(pipe.recent || [])];
          const run = running.find((r: any) => r.id === Z.run_id);
          if (run && run.status === 'running') {
            i({ runId: Z.run_id });
          }
        }).catch(() => {});
      }
    }).catch(() => {});
  }, []);
  const { setState: setStore, addLog, setLoading, reset } = store;

  // URL veya aciklamadan otomatik proje adi onerisi
  const autoTitle = (source: string, type: 'url' | 'desc') => {
    if (store.title) return; // zaten elle girilmis
    let name = '';
    if (type === 'url') {
      try {
        const u = new URL(source);
        // domain'den anlamli isim cikar: "alexcinovoj.dev" -> "Alexcinovoj"
        const host = u.hostname.replace(/^www\./, '');
        const parts = host.split('.');
        // apps.apple.com/app/xyz -> xyz, play.google.com -> ilk path segment
        if (/apps\.apple\.com|play\.google\.com/.test(host)) {
          const pathParts = u.pathname.split('/').filter(Boolean);
          name = pathParts[pathParts.length - 1]?.replace(/-/g, ' ') || parts[0];
        } else {
          name = parts[0]; // domain'in ilk kismi
        }
        name = name.charAt(0).toUpperCase() + name.slice(1);
      } catch { /* invalid url, skip */ }
    } else {
      // aciklamadan ilk 3-4 kelimeyi al
      const words = source.trim().split(/\s+/).slice(0, 4);
      if (words.length > 0) {
        name = words.join(' ');
        if (name.length > 40) name = name.slice(0, 40).trim();
      }
    }
    if (name) setStore({ title: name });
  };

  // URL'den platform auto-detect
  const handleUrlChange = (index: number, value: string) => {
    const newUrls = [...store.urls];
    newUrls[index] = value;
    setStore({ urls: newUrls });
    if (/apps\.apple\.com|play\.google\.com/.test(value)) {
      setStore({ platform: 'mobile' });
    }
    // ilk URL girildiginde otomatik proje adi oner
    if (index === 0 && value.startsWith('http')) {
      autoTitle(value, 'url');
    }
  };

  const addUrl = () => setStore({ urls: [...store.urls, ''] });
  const removeUrl = (index: number) => setStore({ urls: store.urls.filter((_, i) => i !== index) });

  // Site analiz et
  const handleAnalyze = async () => {
    const validUrls = store.urls.filter(u => u.trim());
    if (validUrls.length === 0 && !store.description) { addLog('URL veya aciklama gerekli'); return; }

    setLoading('analyze', true);
    const allAnalyses: any[] = [];
    for (const url of validUrls) {
      addLog(`Analiz ediliyor: ${url}`);
      try {
        const result = await api.prdAnalyze({ url });
        allAnalyses.push(result.analysis);
        addLog(`Analiz tamamlandi: ${url}`);
        if (result.platform) setStore({ platform: result.platform });
        // Analiz sonucundan site title'i ile proje adi oner
        if (!store.title && result.analysis?.title) {
          setStore({ title: result.analysis.title });
        }
      } catch (err: any) {
        addLog(`Analiz hatasi: ${err.message}`);
      }
    }
    setStore({ analyses: allAnalyses, analysis: allAnalyses.length === 1 ? allAnalyses[0] : allAnalyses });
    setLoading('analyze', false);
  };

  // Screenshot analiz
  const handleScreenshot = async (base64: string, filename: string) => {
    setLoading('screenshot', true);
    addLog(`Screenshot analiz ediliyor: ${filename}`);
    try {
      const result = await api.prdAnalyze({ screenshot: base64, filename });
      setStore({ analysis: { ...store.analysis, ...result.analysis, screenshot: true } });
      addLog('Screenshot analizi tamamlandi');
    } catch (err: any) {
      addLog(`Screenshot hatasi: ${err.message}`);
    }
    setLoading('screenshot', false);
  };

  // Web arastirma
  const handleResearch = async () => {
    setLoading('research', true);
    addLog('Web arastirmasi baslatiliyor...');
    try {
      const topic = store.title || store.description || store.urls[0];
      const result = await api.prdResearch({ topic, query: topic });
      setStore({ research: result.research });
      addLog('Arastirma tamamlandi');
    } catch (err: any) {
      addLog(`Arastirma hatasi: ${err.message}`);
    }
    setLoading('research', false);
  };

  // PRD olustur
  const handleGenerate = async () => {
    if (!store.title.trim()) { addLog('Proje adi gerekli'); return; }
    setLoading('generate', true);
    addLog('PRD olusturuluyor...');
    try {
      const result = await api.prdGenerate({
        prdId: store.id,
        title: store.title,
        platform: store.platform,
        description: store.description,
        analysis: store.analysis,
        research: store.research,
        chatHistory: store.chatHistory,
        urls: store.urls.filter(u => u.trim()),
      });
      setStore({
        id: result.id,
        prdContent: result.prd_content,
        prdVersion: result.prd_version,
        score: result.score,
        scoreDetails: result.score_details,
        costEstimate: result.cost_estimate,
      });
      addLog(`PRD v${result.prd_version} olusturuldu — Skor: ${result.score}/100`);
    } catch (err: any) {
      addLog(`PRD olusturma hatasi: ${err.message}`);
    }
    setLoading('generate', false);
  };

  // PRD gelistir
  const handleEnhance = async () => {
    setPreviousPrd(store.prdContent || '');
    if (!store.id) return;
    setLoading('enhance', true);
    addLog('PRD gelistiriliyor...');
    try {
      // Start async enhance job
      await fetch('/api/prd/enhance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prdId: store.id }),
      });
      // Poll for completion every 5s
      const result = await new Promise<any>((resolve, reject) => {
        const poll = setInterval(async () => {
          try {
            const res = await fetch('/api/prd/enhance/status?prdId=' + encodeURIComponent(store.id!));
            const data = await res.json();
            if (data.status === 'done') { clearInterval(poll); resolve(data.result); }
            else if (data.status === 'error') { clearInterval(poll); reject(new Error(data.error)); }
            else if (data.status === 'idle') { clearInterval(poll); reject(new Error('Islem bulunamadi — tekrar deneyin')); }
          } catch { clearInterval(poll); reject(new Error('Polling hatasi')); }
        }, 5000);
        // Timeout after 10 minutes
        setTimeout(() => { clearInterval(poll); reject(new Error('Zaman asimi (10dk)')); }, 600000);
      });
      setStore({
        prdContent: result.prd_content,
        prdVersion: result.prd_version,
        score: result.score,
        scoreDetails: result.score_details,
        costEstimate: result.cost_estimate,
      });
      addLog(`PRD v${result.prd_version} — Skor: ${result.score}/100`);
      // Coverage yeniden hesapla (PRD degisti, yeni sayfalar eklenmis olabilir)
      const currentScreens = usePrdStore.getState().mockupScreens;
      if (currentScreens.length > 0 && result.prd_content) {
        try {
          const cov = await api.prdScreenCoverage({ prdContent: result.prd_content, screens: currentScreens, prdId: store.id || undefined });
          setStore({ screenCoverage: cov });
          if (cov.missing.length > 0) {
            addLog(`${cov.missing.length} yeni/eksik sayfa tespit edildi`);
          }
        } catch { /* optional */ }
      }
    } catch (err: any) {
      addLog(`Gelistirme hatasi: ${err.message}`);
    }
    setLoading('enhance', false);
  };

// Mockup uret (SSE streaming — ekranlar teker teker gelir)
  const handleMockups = async () => {
    if (!store.prdContent) return;
    setLoading('mockups', true);
    setStore({ mockupScreens: [], activeTab: 'mockup', screenCoverage: null });
    addLog('Mockup uretiliyor...');

    // PRD DB'de yoksa once kaydet (SSE icin prdId lazim, prdContent URL'e sigmaz)
    let prdId = store.id;
    if (!prdId) {
      try {
        const result = await api.prdGenerate({
          title: store.title || 'Untitled',
          platform: store.platform,
          description: store.description,
          analysis: store.analysis,
          research: store.research,
          chatHistory: store.chatHistory,
          urls: store.urls.filter((u: string) => u.trim()),
        });
        prdId = result.id;
        setStore({ id: result.id, prdVersion: result.prd_version, score: result.score, scoreDetails: result.score_details, costEstimate: result.cost_estimate });
      } catch (err: any) {
        addLog(`PRD kaydetme hatasi: ${err.message}`);
        setLoading('mockups', false);
        return;
      }
    }

    const params = new URLSearchParams({ prdId: prdId! });
    if (store.title) params.set('title', store.title);

    const es = new EventSource(`/api/prd/mockups/stream?${params.toString()}`);
    esRef.current = es;
    let closed = false;
    const closeEs = () => { if (!closed) { closed = true; es.close(); setLoading('mockups', false); } };

    es.addEventListener('start', (e) => {
      const data = JSON.parse(e.data);
      setStore({ stitchProjectId: data.projectId || null });
      addLog(`Stitch projesi olusturuldu — ${data.total} ekran uretilecek`);
    });

    es.addEventListener('progress', (e) => {
      const data = JSON.parse(e.data);
      addLog(`[${data.index + 1}/${data.total}] ${data.title} uretiliyor...`);
    });

    es.addEventListener('screen', (e) => {
      const data = JSON.parse(e.data);
      const current = usePrdStore.getState().mockupScreens;
      setStore({ mockupScreens: [...current, data.screen] });
      addLog(`[${data.index + 1}/${data.total}] ${data.screen.name} tamamlandi`);
    });

    es.addEventListener('done', (e) => {
      const data = JSON.parse(e.data);
      setStore({ mockupScreens: data.screens, stitchProjectId: data.projectId });
      addLog(`${data.total} ekran mockup'i uretildi`);
      closeEs();
      // Coverage check
      const prdContent = usePrdStore.getState().prdContent;
      if (data.screens.length > 0 && prdContent) {
        api.prdScreenCoverage({ prdContent, screens: data.screens, prdId: store.id || undefined })
          .then(cov => setStore({ screenCoverage: cov }))
          .catch(() => {});
      }
    });

    es.addEventListener('error', (e) => {
      try {
        const data = JSON.parse((e as MessageEvent).data);
        addLog(`Mockup hatasi: ${data.message}`);
      } catch {
        const current = usePrdStore.getState().mockupScreens;
        if (current.length > 0) {
          addLog(`Baglanti kesildi ama ${current.length} ekran mevcut`);
          // Coverage check — eksik sayfalari goster
          const prdContent = usePrdStore.getState().prdContent;
          if (prdContent) {
            api.prdScreenCoverage({ prdContent, screens: current, prdId: store.id || undefined })
              .then(cov => {
                setStore({ screenCoverage: cov });
                if (cov.missing.length > 0) addLog(`${cov.missing.length} eksik sayfa var — tiklayarak uretebilirsiniz`);
              }).catch(() => {});
          }
        } else {
          addLog('Mockup baglantisi kesildi');
        }
      }
      closeEs();
    });

    es.onerror = () => { closeEs(); };
  };

  // Mockup devam et — coverage'daki eksik sayfalari sirayla uret
  const handleResumeMockups = async () => {
    if (!store.prdContent || !store.id) return;
    const existingCount = store.mockupScreens.length;
    if (existingCount === 0) { handleMockups(); return; }

    // Coverage varsa eksik sayfalari kullan, yoksa once coverage hesapla
    let missingPages = store.screenCoverage?.missing || [];
    if (missingPages.length === 0) {
      try {
        const cov = await api.prdScreenCoverage({ prdContent: store.prdContent, screens: store.mockupScreens, prdId: store.id || undefined });
        setStore({ screenCoverage: cov });
        missingPages = cov.missing || [];
      } catch {}
    }

    if (missingPages.length === 0) {
      addLog('Tum sayfalar zaten kapsaniyor — eksik sayfa yok');
      return;
    }

    // Recover stitchProjectId from existing screens if lost (e.g. page reload)
    let projectId = store.stitchProjectId;
    if (!projectId && store.mockupScreens.length > 0) {
      projectId = store.mockupScreens.find((s: any) => s.projectId)?.projectId || null;
      if (projectId) setStore({ stitchProjectId: projectId });
    }
    if (!projectId) {
      addLog('Stitch project ID bulunamadi — once "Mockup Uret" ile yeni uretim yapin');
      return;
    }

    setLoading('mockups', true);

    addLog(`${missingPages.length} eksik sayfa icin mockup uretiliyor...`);

    // Generate missing pages one by one
    for (let i = 0; i < missingPages.length; i++) {
      const title = missingPages[i];
      addLog(`[${i + 1}/${missingPages.length}] "${title}" uretiliyor...`);
      try {
        const prdTruncated = store.prdContent.length > 12000 ? store.prdContent.slice(0, 12000) : store.prdContent;
        const prompt = `Build a complete, production-ready web page design for: "${title}"\n\nFULL PROJECT PRD:\n${prdTruncated}\n\nTARGET PAGE: "${title}"\nUse the EXACT design system from the PRD. Match existing screens style.`;
        const res = await fetch('/api/prd/screens/' + store.id + '/generate-missing', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title, prompt, projectId }),
        });
        if (!res.ok) { addLog(`"${title}" uretim hatasi: ${res.status}`); continue; }
        const result = await res.json();
        if (result.screen) {
          const updated = [...usePrdStore.getState().mockupScreens, result.screen];
          setStore({ mockupScreens: updated });
          addLog(`[${i + 1}/${missingPages.length}] "${title}" tamamlandi`);
        }
        // Rate limit
        if (i < missingPages.length - 1) await new Promise(r => setTimeout(r, 2000));
      } catch (err: any) {
        addLog(`"${title}" hatasi: ${err.message}`);
      }
    }

    // Final coverage update
    const finalScreens = usePrdStore.getState().mockupScreens;
    addLog(`Tamamlandi! Toplam ${finalScreens.length} ekran`);
    try {
      const cov = await api.prdScreenCoverage({ prdContent: store.prdContent, screens: finalScreens, prdId: store.id || undefined });
      setStore({ screenCoverage: cov });
    } catch {}
    setLoading('mockups', false);
  };


  // Pipeline'a gonder
  const handleStartRun = async () => {
    if (!store.id || !store.prdContent) return;
    setLoading('startRun', true);
    const projectName = store.projectName || store.title;
    const screens = store.mockupScreens;

    addLog('--- PIPELINE BASLATIYOR ---');
    addLog(`1/6 Repo olusturuluyor: ~/projects/${projectName.toLowerCase().replace(/[^a-z0-9]+/g, '-')}/`);

    if (screens.length > 0) {
      addLog(`2/6 Design dosyalari yerlestiriliyor (${screens.length} ekran)...`);
      addLog('   stitch/ dizini + .stitch + DESIGN_MANIFEST.json');
    } else {
      addLog('2/6 Design dosyasi yok — design step sifirdan calisacak');
    }

    addLog(`3/6 PRD + metadata task string olusturuluyor...`);
    addLog(`4/6 setfarm workflow run ${store.workflow} calistiriliyor...`);

    try {
      const result = await api.prdStartRun({
        prdId: store.id,
        projectName,
        workflow: store.workflow,
      });
      setStore({ runId: result.runId });
      addLog(`5/6 Pipeline baslatildi! Run ID: ${result.runId}`);
      if (result.repoPath) addLog(`   Repo: ${result.repoPath}`);
      addLog('6/6 AGENTS tabindan takip edebilirsiniz');
      addLog('--- PIPELINE AKTIF ---');
    } catch (err: any) {
      addLog(`Pipeline hatasi: ${err.message}`);
    }
    setLoading('startRun', false);
  };

  // Chat message
  const handleChatMessage = async (message: string) => {
    const newHistory = [...store.chatHistory, { role: 'user', content: message }];
    setStore({ chatHistory: newHistory });
    try {
      const result = await api.prdChat({
        prdId: store.id,
        message,
        context: {
          title: store.title,
          platform: store.platform,
          description: store.description,
          urls: store.urls,
          analysis: store.analysis,
          chatHistory: newHistory,
        },
      });
      setStore({ chatHistory: result.chatHistory });
    } catch (err: any) {
      setStore({ chatHistory: [...newHistory, { role: 'assistant', content: `Hata: ${err.message}` }] });
    }
  };
  const handleGenerateMissing = async (title: string) => {
    if (!store.stitchProjectId || !store.id) { addLog('Once mockup uretimi yapilmali'); return; }
    setLoading('mockups', true);
    addLog(`"${title}" sayfasi icin mockup uretiliyor...`);
    try {
      // SSE stream ile tek sayfa uret (variant degil, yeni bagimsiz ekran)
      const params = new URLSearchParams({
        prdId: store.id,
        prdContent: store.prdContent,
        title: title,
        projectId: store.stitchProjectId,
        skipCount: String(store.mockupScreens.length),
      });
      // Use single screen generation via regenerate endpoint with full PRD context
      const prdTruncated = store.prdContent.length > 8000 ? store.prdContent.slice(0, 8000) : store.prdContent;
      const prompt = `Build a complete, production-ready web page design for: "${title}"\n\nFULL PROJECT PRD:\n${prdTruncated}\n\nTARGET PAGE: "${title}"\n\nUse the EXACT design system from the PRD. Match existing screens style.`;

      // Use regenerate on a dummy screen or generate fresh
      const res = await fetch('/api/prd/screens/' + store.id + '/generate-missing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, prompt, projectId }),
      });
      if (!res.ok) throw new Error('Generation failed: ' + res.status);
      const result = await res.json();
      if (result.screen) {
        const updated = [...store.mockupScreens, result.screen];
        setStore({ mockupScreens: updated });
        addLog(`"${title}" mockup'i uretildi`);
        // Coverage guncelle
        api.prdScreenCoverage({ prdContent: store.prdContent, screens: updated, prdId: store.id || undefined })
          .then(cov => setStore({ screenCoverage: cov }))
          .catch(() => {});
      } else {
        addLog(`"${title}" uretilemedi`);
      }
    } catch (err: any) {
      addLog(`Uretim hatasi: ${err.message}`);
    }
    setLoading('mockups', false);
  };

  // Mockup uretimini durdur
  const handleStopMockups = () => {
    if (esRef.current) {
      esRef.current.close();
      esRef.current = null;
    }
    setLoading('mockups', false);
    const current = usePrdStore.getState().mockupScreens;
    addLog(`Uretim durduruldu — ${current.length} ekran mevcut`);
  };

  // Toplu sil (state + DB)
  const handleClearAllScreens = async () => {
    setStore({ mockupScreens: [], screenCoverage: null, lightboxScreenId: null });
    if (store.id) {
      try { await api.prdClearScreens(store.id); } catch {}
    }
    addLog('Tum ekranlar silindi');
  };

  // Screen gallery handlers
  const handleScreenClick = (screenId: string) => {
    setStore({ lightboxScreenId: screenId });
  };

  const handleDeleteScreen = async (screenId: string) => {
    if (!store.id) return;
    try {
      const result = await api.prdDeleteScreen(store.id, screenId);
      setStore({ mockupScreens: result.screens, lightboxScreenId: null });
      addLog('Ekran silindi');
      // Refresh coverage
      if (store.prdContent && result.screens.length > 0) {
        try {
          const cov = await api.prdScreenCoverage({ prdContent: store.prdContent, screens: result.screens, prdId: store.id || undefined });
          setStore({ screenCoverage: cov });
        } catch { /* optional */ }
      } else {
        setStore({ screenCoverage: null });
      }
    } catch (err: any) {
      addLog(`Silme hatasi: ${err.message}`);
    }
  };

  const handleRegenerateScreen = async (screenId: string) => {
    if (!store.id) return;
    setLoading('screenAction', true);
    addLog('Ekran yeniden uretiliyor...');
    try {
      const result = await api.prdRegenerateScreen(store.id, screenId);
      setStore({ mockupScreens: result.screens });
      addLog('Ekran yeniden uretildi');
    } catch (err: any) {
      addLog(`Yeniden uretim hatasi: ${err.message}`);
    }
    setLoading('screenAction', false);
  };

  const handleSavePrd = async () => {
    if (!store.prdId || !store.prdContent) return;
    try {
      await fetch('/api/prd/' + store.prdId, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prd_content: store.prdContent }),
      });
      setStore({ editMode: false });
    } catch (err: any) {
      console.error('PRD save failed:', err);
    }
  };

  const handleEditPromptScreen = async (screenId: string, newPrompt: string) => {
    if (!store.id) return;
    setLoading('screenAction', true);
    addLog('Ekran yeni prompt ile uretiliyor...');
    try {
      const result = await api.prdRegenerateScreen(store.id, screenId, { prompt: newPrompt });
      setStore({ mockupScreens: result.screens });
      addLog('Ekran guncellendi');
    } catch (err: any) {
      addLog(`Prompt uretim hatasi: ${err.message}`);
    }
    setLoading('screenAction', false);
  };

  const handleGenerateVariant = async (screenId: string) => {
    if (!store.id) return;
    setLoading('screenAction', true);
    addLog('Varyant uretiliyor...');
    try {
      const result = await api.prdVariantScreen(store.id, { sourceScreenId: screenId });
      setStore({ mockupScreens: result.screens });
      addLog('Varyant uretildi');
    } catch (err: any) {
      addLog(`Varyant hatasi: ${err.message}`);
    }
    setLoading('screenAction', false);
  };

  // Gecmisten PRD yukle
  const handleLoadPrd = (prd: any) => {
    setStore({
      id: prd.id,
      title: prd.title,
      platform: prd.platform,
      urls: prd.urls?.length ? prd.urls : [''],
      description: prd.description || '',
      prdContent: prd.prd_content || '',
      prdVersion: prd.prd_version || 0,
      score: prd.score,
      scoreDetails: prd.score_details,
      costEstimate: prd.cost_estimate,
      analysis: prd.analysis,
      research: prd.research,
      chatHistory: prd.chat_history || [],
      mockupScreens: prd.mockup_screens || [],
      runId: prd.run_id,
      projectName: prd.title,
      showHistory: false,
      stitchProjectId: null,
      screenCoverage: null,
      lightboxScreenId: null,
    });
    addLog(`PRD yuklendi: ${prd.title} (v${prd.prd_version})`);
  };

  // Template sec
  const handleSelectTemplate = (template: any) => {
    if (template.prd_content) {
      const score = scorePrdLocal(template.prd_content);
      const cost = estimateCostLocal(template.prd_content);
      setStore({
        title: store.title || template.name,
        platform: template.platform || 'web',
        description: store.description || template.description,
        prdContent: template.prd_content,
        prdVersion: 1,
        score: score.total,
        scoreDetails: score,
        costEstimate: cost,
        showTemplates: false,
      });
      addLog(`Sablon yuklendi: ${template.name} (icerikli)`);
    } else {
      setStore({
        title: store.title || template.name,
        platform: template.platform || 'web',
        description: store.description || template.description,
        showTemplates: false,
      });
      addLog(`Sablon secildi: ${template.name}`);
    }
  };

  // Yeni PRD
  const handleNew = () => {
    reset();
    addLog('Yeni PRD basladi');
  };

  return (
    <div className="prd-page">
      <div className="prd-page__header">
        <h1 className="glitch">PRD GENERATOR</h1>
        <div className="prd-page__header-actions">
          <button className="btn btn--small" onClick={handleNew}>Yeni</button>
          <button className="btn btn--small" onClick={() => setStore({ showHistory: true })}>Gecmis</button>
          <button className="btn btn--small" onClick={() => setStore({ showTemplates: true })}>Sablon</button>
        </div>
      </div>

      {store.showHistory && (
        <PrdHistory onSelect={handleLoadPrd} onClose={() => setStore({ showHistory: false })} />
      )}
      {store.showTemplates && (
        <PrdHistory onSelect={handleSelectTemplate} onClose={() => setStore({ showTemplates: false })} templatesMode />
      )}

      <div className="prd-page__content">
        {/* SOL PANEL */}
        <div className="prd-page__left">
          <div className="prd-input-group">
            <label className="prd-label">Platform</label>
            <div className="prd-platform-toggle">
              <button className={`prd-platform-btn ${store.platform === 'web' ? 'prd-platform-btn--active' : ''}`} onClick={() => setStore({ platform: 'web' })}>Web</button>
              <button className={`prd-platform-btn ${store.platform === 'mobile' ? 'prd-platform-btn--active' : ''}`} onClick={() => setStore({ platform: 'mobile' })}>Mobile</button>
            </div>
          </div>

          <div className="prd-input-group">
            <label className="prd-label">URL(ler)</label>
            {store.urls.map((url, i) => (
              <div key={i} className="prd-url-row">
                <input type="text" className="prd-input" placeholder="https://example.com" value={url} onChange={(e) => handleUrlChange(i, e.target.value)} />
                {store.urls.length > 1 && <button className="prd-url-remove" onClick={() => removeUrl(i)}>x</button>}
              </div>
            ))}
            <div className="prd-url-actions">
              <button className="btn btn--small" onClick={addUrl}>+ URL ekle</button>
              <button className="btn btn--small btn--primary" onClick={handleAnalyze} disabled={store.loading.analyze}>{store.loading.analyze ? 'Analiz...' : 'Analiz Et'}</button>
            </div>
          </div>

          <ScreenshotUpload onUpload={handleScreenshot} loading={!!store.loading.screenshot} />

          <div className="prd-input-group">
            <label className="prd-label">Aciklama / Konu</label>
            <textarea className="prd-textarea" placeholder="Proje aciklamasi, istekler, detaylar..." value={store.description} onChange={(e) => setStore({ description: e.target.value })} onBlur={(e) => autoTitle(e.target.value, 'desc')} rows={3} />
            <button className="btn btn--small" onClick={handleResearch} disabled={store.loading.research}>{store.loading.research ? 'Arastiriliyor...' : 'Web Arastir'}</button>
          </div>

          <PrdChat chatHistory={store.chatHistory} onSend={handleChatMessage} />
          <AnalysisLog logs={store.logs} />
        </div>

        {/* SAG PANEL */}
        <div className="prd-page__right">
          <div className="prd-tabs">
            {(['prd', 'mockup', 'analysis'] as const).map(tab => (
              <button key={tab} className={`prd-tab ${store.activeTab === tab ? 'prd-tab--active' : ''}`} onClick={() => setStore({ activeTab: tab })}>{tab === 'prd' ? 'PRD' : tab === 'mockup' ? 'Mockup' : 'Analiz'}</button>
            ))}
            {store.prdVersion > 0 && <span className="prd-version-badge">v{store.prdVersion}</span>}
          </div>

          {/* Sticky progress bar — scroll'da kaybolmaz */}
          {Object.values(store.loading).some(v => v) && (
            <div className="prd-progress-sticky">
              <ProgressBar active={!!store.loading.analyze} startedAt={store.loadingStartedAt.analyze || 0} label="Site Analiz Ediliyor" steps={['HTML indiriliyor...', 'Sayfa yapisi inceleniyor...', 'Renkler ve fontlar cikariliyor...', 'Komponentler tespit ediliyor...', 'Analiz tamamlaniyor...']} />
            <ProgressBar active={!!store.loading.generate} startedAt={store.loadingStartedAt.generate || 0} label="PRD Olusturuluyor" steps={['Veriler hazirlaniyor...', 'Analiz entegre ediliyor...', 'PRD yaziliyor...', 'Sayfalar tanimlaniyor...', 'Komponentler eslestiriliyor...', 'Puanlama yapiliyor...']} />
            <ProgressBar active={!!store.loading.enhance} startedAt={store.loadingStartedAt.enhance || 0} label="PRD Gelistiriliyor" steps={['Mevcut PRD analiz ediliyor...', 'Eksik bolumler tespit ediliyor...', 'Detaylar ekleniyor...', 'Animasyonlar tanimlaniyor...', 'Puanlama yapiliyor...']} />
            <ProgressBar active={!!store.loading.mockups} startedAt={store.loadingStartedAt.mockups || 0} label={`Mockup Uretiliyor (${store.mockupScreens.length} ekran hazir)`} steps={["Ekranlar uretiliyor...", "Indiriliyor...", "Tamamlaniyor..."]} />
            <ProgressBar active={!!store.loading.research} startedAt={store.loadingStartedAt.research || 0} label="Web Arastirmasi" steps={['Konu arastiriliyor...', 'Best practice\'ler toplanilyor...', 'UX pattern\'lar analiz ediliyor...', 'Sonuclar derleniyor...']} />
            </div>
          )}

          <div className="prd-tab-content">
            {store.activeTab === 'prd' && (
              store.prdContent ? (
                <PrdEditor content={store.prdContent} editMode={store.editMode} onChange={(c) => setStore({ prdContent: c })} previousContent={previousPrd} />
              ) : !Object.values(store.loading).some(v => v) ? (
                <div className="prd-empty">
                  <p>Henuz PRD olusturulmadi.</p>
                  <p className="prd-empty__hint">Sol panelden bilgileri girin ve "PRD Olustur" butonuna basin.</p>
                </div>
              ) : null
            )}
            {store.activeTab === 'mockup' && (
              <PrdMockups
                screens={store.mockupScreens}
                coverage={store.screenCoverage}
                onScreenClick={handleScreenClick}
                onClearAll={handleClearAllScreens}
                onGenerateMissing={handleGenerateMissing}
                onDeleteScreen={handleDeleteScreen}
                stitchProjectId={store.stitchProjectId}
              />
            )}
            {store.activeTab === 'analysis' && (
              <>
                {store.analyses.length > 1 ? (
                  <CompetitiveTable analyses={store.analyses} urls={store.urls} />
                ) : store.analysis ? (
                  <div className="prd-analysis-result"><h3>Site Analizi</h3><pre className="prd-analysis-json">{JSON.stringify(store.analysis, null, 2)}</pre></div>
                ) : (
                  <div className="prd-empty"><p>Henuz analiz yapilmadi.</p></div>
                )}
                {store.research && (
                  <div className="prd-analysis-result"><h3>Web Arastirmasi</h3><pre className="prd-analysis-json">{JSON.stringify(store.research, null, 2)}</pre></div>
                )}
              </>
            )}
          </div>

          {/* STICKY FOOTER — her zaman gorunur */}
          <div className="prd-footer">
            {store.score !== null && (
              <div className="prd-bottom-bar">
                <PrdScore score={store.score} details={store.scoreDetails} />
                <CostEstimate estimate={store.costEstimate} />
              </div>
            )}

            <div className="prd-actions">
              {!store.prdContent ? (
                <>
                  <div className="prd-input-group" style={{ flex: 1 }}>
                    <input type="text" className="prd-input" placeholder="Proje Adi" value={store.title} onChange={(e) => setStore({ title: e.target.value })} />
                  </div>
                  <button className="btn btn--primary" onClick={handleGenerate} disabled={store.loading.generate || !store.title.trim()}>{store.loading.generate ? 'Olusturuluyor...' : 'PRD Olustur'}</button>
                </>
              ) : (
                <>
                  <button className="btn btn--small" onClick={() => setStore({ editMode: !store.editMode })}>{store.editMode ? 'Onizle' : 'Duzenle'}</button>
                  {store.editMode && <button className="btn btn--small btn--primary" onClick={handleSavePrd}>Kaydet</button>}
                  <button className="btn btn--small btn--primary" onClick={handleEnhance} disabled={store.loading.enhance}>{store.loading.enhance ? 'Gelistiriliyor...' : 'Gelistir'}</button>
                  <button className="btn btn--small" onClick={handleMockups} disabled={store.loading.mockups}>{store.loading.mockups ? 'Uretiliyor...' : 'Mockup Uret'}</button>
                  {store.loading.mockups && (
                    <button className="btn btn--small btn--danger" onClick={handleStopMockups}>Durdur</button>
                  )}
                  {store.mockupScreens.length > 0 && !store.loading.mockups && store.screenCoverage && store.screenCoverage.missing.length > 0 && (
                    <button className="btn btn--small btn--primary" onClick={handleResumeMockups}>Tamamla</button>
                  )}
                  <button className="btn btn--small" onClick={() => {
                    const blob = new Blob([store.prdContent], { type: 'text/markdown' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `${(store.title || 'prd').replace(/[^a-zA-Z0-9-_]/g, '-')}.md`;
                    a.click();
                    URL.revokeObjectURL(url);
                  }}>Indir .md</button>
                </>
              )}
            </div>

            {store.prdContent && (
              <div className="prd-launch">
                <div className="prd-launch__inputs">
                  <input type="text" className="prd-input" placeholder="Proje Adi" value={store.projectName || store.title} onChange={(e) => setStore({ projectName: e.target.value })} />
                  <select className="prd-select" value={store.workflow} onChange={(e) => setStore({ workflow: e.target.value })}>
                    <option value="feature-dev">feature-dev</option>
                    <option value="bug-fix">bug-fix</option>
                    <option value="ui-refactor">ui-refactor</option>
                  </select>
                </div>
                <button className="btn btn--primary prd-launch__btn" onClick={handleStartRun} disabled={store.loading.startRun}>
                  {store.loading.startRun ? 'Baslatiliyor...' : store.runId ? 'Yeniden Baslat' : 'Gorevi Baslat'}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Screen Lightbox */}
      {store.lightboxScreenId && (() => {
        const screen = store.mockupScreens.find((s: any) => s.id === store.lightboxScreenId);
        if (!screen) return null;
        return (
          <ScreenLightbox
            screen={screen}
            screens={store.mockupScreens}
            onClose={() => setStore({ lightboxScreenId: null })}
            onDelete={handleDeleteScreen}
            onRegenerate={handleRegenerateScreen}
            onEditPrompt={handleEditPromptScreen}
            onVariant={handleGenerateVariant}
            onNavigate={(id) => setStore({ lightboxScreenId: id })}
            loading={!!store.loading.screenAction}
          />
        );
      })()}
    </div>
  );
}
