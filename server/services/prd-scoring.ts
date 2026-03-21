export interface ScoreDetails {
  pageDetail: number;       // 0-20
  designSystem: number;     // 0-20
  components: number;       // 0-15
  animations: number;       // 0-10
  responsive: number;       // 0-10
  dataModel: number;        // 0-10
  screenCount: number;      // 0-15
  total: number;            // 0-100
  missing: string[];        // Eksik bölümler
}

export function scorePrd(content: string): ScoreDetails {
  const lower = content.toLowerCase();
  const lines = content.split('\n');
  const missing: string[] = [];

  // 1. Sayfa/ekran detayı (0-20)
  let pageDetail = 0;
  // Count pages: headings with "sayfa/page/screen/view" OR headings with route paths like (/path)
  const screenHeaders = lines.filter(l =>
    /^#{1,3}\s.*(sayfa|ekran|page|screen|view)/i.test(l) ||
    /^#{1,3}\s+.*\(\/[^)]*\)/.test(l) ||
    /^#{1,3}\s+.*\(\/\)/.test(l)
  ).length;
  const hasRoutes = /route|path|sayfa\s*haritası|navigation|\(\/[a-z]/i.test(lower);
  const hasPageDescriptions = screenHeaders >= 2;
  if (screenHeaders >= 4) pageDetail = 20;
  else if (screenHeaders >= 2) pageDetail = 14;
  else if (screenHeaders >= 1) pageDetail = 8;
  else { pageDetail = 2; missing.push('Sayfa/ekran detayları eksik'); }
  if (hasRoutes) pageDetail = Math.min(20, pageDetail + 3);
  if (!hasPageDescriptions) missing.push('Her sayfa için detaylı açıklama ekleyin');

  // 2. Tasarım sistemi (0-20)
  let designSystem = 0;
  const hasColors = /renk|color|palette|#[0-9a-f]{3,6}/i.test(lower);
  const hasFonts = /font|yazı\s*tipi|typography/i.test(lower);
  const hasSpacing = /spacing|aralık|padding|margin|gap/i.test(lower);
  const hasTheme = /tema|theme|dark|light/i.test(lower);
  if (hasColors) designSystem += 6;
  else missing.push('Renk paleti tanımlayın');
  if (hasFonts) designSystem += 5;
  else missing.push('Font/tipografi bilgisi ekleyin');
  if (hasSpacing) designSystem += 4;
  if (hasTheme) designSystem += 5;
  else missing.push('Tema bilgisi (dark/light) belirtin');

  // 3. Komponent tanımları (0-15)
  let components = 0;
  const componentKeywords = ['button', 'card', 'modal', 'dialog', 'input', 'form', 'header', 'footer', 'sidebar', 'nav', 'table', 'list', 'tab', 'dropdown', 'tooltip', 'buton', 'kart', 'tablo', 'liste'];
  const foundComponents = componentKeywords.filter(k => lower.includes(k)).length;
  if (foundComponents >= 8) components = 15;
  else if (foundComponents >= 5) components = 11;
  else if (foundComponents >= 3) components = 7;
  else if (foundComponents >= 1) components = 4;
  else { components = 0; missing.push('UI komponent tanımları ekleyin'); }

  // 4. Animasyon/geçiş detayı (0-10)
  let animations = 0;
  const hasAnimations = /animasyon|animation|transition|geçiş|hover|easing|duration|timing/i.test(lower);
  const hasTimings = /\d+ms|\d+s|ease|cubic-bezier|linear/i.test(lower);
  if (hasAnimations && hasTimings) animations = 10;
  else if (hasAnimations) animations = 6;
  else { animations = 0; missing.push('Animasyon ve geçiş efektleri tanımlayın'); }

  // 5. Responsive tanımı (0-10)
  let responsive = 0;
  const hasBreakpoints = /breakpoint|responsive|mobil|mobile|tablet|desktop|media\s*query|küçük\s*ekran/i.test(lower);
  const hasGridInfo = /grid|flex|layout|düzen|kolon|column/i.test(lower);
  if (hasBreakpoints && hasGridInfo) responsive = 10;
  else if (hasBreakpoints || hasGridInfo) responsive = 5;
  else { responsive = 0; missing.push('Responsive tasarım kurallarını belirtin'); }

  // 6. Veri modeli (0-10)
  let dataModel = 0;
  const hasApi = /api|endpoint|veri|data|fetch|backend|veritabanı|database/i.test(lower);
  const hasModels = /model|schema|tablo|table|field|alan|type|interface/i.test(lower);
  const hasState = /state|durum|store|context/i.test(lower);
  if (hasApi) dataModel += 4;
  if (hasModels) dataModel += 3;
  if (hasState) dataModel += 3;
  if (dataModel === 0) missing.push('Veri modeli ve API tanımlarını ekleyin');

  // 7. Ekran sayısı yeterliliği (0-15)
  let screenCount = 0;
  const totalScreens = screenHeaders + (lower.match(/ekran|screen|view|sayfa|page/g)?.length || 0) / 3;
  if (totalScreens >= 6) screenCount = 15;
  else if (totalScreens >= 4) screenCount = 11;
  else if (totalScreens >= 2) screenCount = 7;
  else if (totalScreens >= 1) screenCount = 3;
  else { screenCount = 0; missing.push('Daha fazla ekran/sayfa tanımlayın'); }

  const total = pageDetail + designSystem + components + animations + responsive + dataModel + screenCount;

  return {
    pageDetail,
    designSystem,
    components,
    animations,
    responsive,
    dataModel,
    screenCount,
    total,
    missing,
  };
}

export function checkScreenCoverage(
  prdContent: string,
  screens: { title: string; id?: string }[],
): { covered: string[]; missing: string[]; coverage: number } {
  const lines = prdContent.split('\n');
  // Extract PAGE headings from PRD (h3 with route paths or "Sayfa" in name)
  const sectionHeadings: string[] = [];

  // Strategy 1: Find pages from "Sayfalar" section (h3 items under h2 "Sayfalar")
  let inPagesSection = false;
  for (const line of lines) {
    if (/^##\s+.*sayfalar/i.test(line)) { inPagesSection = true; continue; }
    if (inPagesSection && /^##\s/.test(line) && !/sayfa/i.test(line)) { inPagesSection = false; continue; }
    if (inPagesSection) {
      const m = line.match(/^###\s+(?:\d+\.\d+\s+)?(.+)/);
      if (m) {
        let name = m[1].trim().replace(/\s*\([\/][^)]*\)\s*$/, '').trim(); // Remove (/route)
        if (name.length > 2) sectionHeadings.push(name);
      }
    }
  }

  // Strategy 2: If no pages found, look for h2/h3 with route paths like (/path)
  if (sectionHeadings.length < 2) {
    for (const line of lines) {
      const m = line.match(/^#{2,3}\s+(?:\d+\.?\d*\s+)?(.+?)\s*\(\/[^)]*\)/);
      if (m) {
        const name = m[1].trim();
        if (name.length > 2 && !sectionHeadings.includes(name)) sectionHeadings.push(name);
      }
    }
  }

  // Strategy 3: Bullet list pages ("- Ana Sayfa — desc")
  if (sectionHeadings.length < 2) {
    let inPageList = false;
    for (const line of lines) {
      if (/^#{1,3}\s+.*(?:sayfa\s*listesi|sayfalar)/i.test(line)) { inPageList = true; continue; }
      if (inPageList && /^#{1,2}\s/.test(line)) { inPageList = false; continue; }
      if (inPageList) {
        const m = line.match(/^[-*]\s+(?:\*\*)?([^*\n]+?)(?:\*\*)?\s*[—–-]\s/);
        if (m && m[1].trim().length > 2) sectionHeadings.push(m[1].trim());
      }
    }
  }

  const screenTitles = screens.map(s => s.title.toLowerCase());
  const covered: string[] = [];
  const missing: string[] = [];

  // B5 fix: require at least 2 word matches or 50%+ word overlap to avoid false positives
  const stopWords = new Set(['bir', 've', 'ile', 'icin', 'the', 'and', 'for', 'with', 'prd', 'sayfa', 'ekran', 'page', 'screen', 'view']);

  for (const heading of sectionHeadings) {
    const headingLower = heading.toLowerCase();
    const headingWords = headingLower.split(/\s+/).filter(w => w.length > 2 && !stopWords.has(w));
    if (headingWords.length === 0) { missing.push(heading); continue; }

    const isMatched = screenTitles.some(st => {
      const matchCount = headingWords.filter(w => st.includes(w)).length;
      // Require at least 2 matches, or if heading has only 1 significant word, require exact match
      if (headingWords.length === 1) return st.includes(headingWords[0]);
      return matchCount >= 2 || (matchCount / headingWords.length) >= 0.5;
    });

    if (isMatched) {
      covered.push(heading);
    } else {
      missing.push(heading);
    }
  }

  const total = covered.length + missing.length;
  const coverage = total > 0 ? Math.round((covered.length / total) * 100) : 100;

  return { covered, missing, coverage };
}

export function estimateCost(prd: string): {
  storyCount: number;
  tokenCost: number;
  estimatedMinutes: number;
  successRate: number;
} {
  const lines = prd.split('\n');
  const headers = lines.filter(l => /^#{1,3}\s/.test(l)).length;
  const totalLength = prd.length;

  // Story count heuristic: ~1 story per major section, more for longer PRDs
  const storyCount = Math.max(3, Math.min(15, Math.round(headers * 0.8 + totalLength / 3000)));

  // Token cost: ~$0.30 per story (MiniMax pricing)
  const tokenCost = parseFloat((storyCount * 0.30).toFixed(2));

  // Time: ~5 min per story (parallel execution)
  const estimatedMinutes = Math.round(storyCount * 5);

  // Success rate based on PRD quality
  const score = scorePrd(prd);
  const successRate = Math.min(95, Math.max(40, score.total));

  return { storyCount, tokenCost, estimatedMinutes, successRate };
}
