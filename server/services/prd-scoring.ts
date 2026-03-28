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
  savedPages?: { name: string; route: string; description: string }[] | null,
): { covered: string[]; missing: string[]; coverage: number } {
  const lines = prdContent.split('\n');
  // If pages are already extracted and saved in DB, use them directly (no regex)
  if (savedPages && savedPages.length > 0) {
    const stopWords = new Set(['bir', 've', 'ile', 'icin', 'the', 'and', 'for', 'with', 'prd', 'sayfa', 'ekran', 'page', 'screen', 'view']);
    const covered: string[] = [];
    const missing: string[] = [];
    const normalize = (r: string) => r.replace(/\/+$/, ''); // strip trailing slash

    for (const page of savedPages) {
      // 1. Route-based exact match (yeni ekranlar — pageRoute field'i var)
      const pageRoute = normalize(page.route || '');
      if (pageRoute) {
        const routeMatch = screens.some(s =>
          (s as any).pageRoute && normalize((s as any).pageRoute) === pageRoute
        );
        if (routeMatch) { covered.push(page.name); continue; }
      }

      // 2. Fuzzy title match (eski ekranlar — pageRoute yok)
      const screenTitles = screens.map(s => s.title.toLowerCase());
      const headingWords = page.name.toLowerCase().split(/\s+/).filter(w => w.length > 2 && !stopWords.has(w));
      if (headingWords.length === 0) { missing.push(page.name); continue; }
      const titleMatch = screenTitles.some(st => {
        const matchCount = headingWords.filter(w => st.includes(w)).length;
        if (headingWords.length === 1) return st.includes(headingWords[0]);
        return matchCount >= 2 || (matchCount / headingWords.length) >= 0.5;
      });
      if (titleMatch) covered.push(page.name);
      else missing.push(page.name);
    }
    const total = covered.length + missing.length;
    return { covered, missing, coverage: total > 0 ? Math.round((covered.length / total) * 100) : 100 };
  }

  // Fallback: extract pages from PRD via regex (for old PRDs without saved pages)
  const sectionHeadings: string[] = [];

  // Strategy 1: Find pages from "Sayfalar" section — numbered/bullet/h3 list items
  // Exit on the NEXT h2 heading after entering (don't stay open for ## X. ... Sayfası)
  let inPagesSection = false;
  for (const line of lines) {
    if (/^##\s+.*sayfalar/i.test(line) && !inPagesSection) { inPagesSection = true; continue; }
    if (inPagesSection && /^##\s/.test(line)) { inPagesSection = false; break; }
    if (inPagesSection) {
      // Numbered list: "1. **Ana Sayfa** (`/`) — desc"
      const mNum = line.match(/^\d+\.\s+\*\*(.+?)\*\*\s*/);
      if (mNum) {
        let name = mNum[1].trim().replace(/\s*\(`[^`]*`\)\s*$/, '').trim();
        if (name.length > 2) sectionHeadings.push(name);
        continue;
      }
      // Bullet list: "- **Ana Sayfa** — desc"
      const mBullet = line.match(/^[-*]\s+\*\*(.+?)\*\*\s*/);
      if (mBullet) {
        let name = mBullet[1].trim().replace(/\s*\(`[^`]*`\)\s*$/, '').trim();
        if (name.length > 2) sectionHeadings.push(name);
        continue;
      }
      // h3 items: "### Page Name (/route)"
      const mH3 = line.match(/^###\s+(?:\d+\.?\d*\s+)?(.+)/);
      if (mH3) {
        let name = mH3[1].trim().replace(/\s*\(?`?\/[^`)]*`?\)?\s*$/, '').trim();
        if (name.length > 2) sectionHeadings.push(name);
      }
    }
  }

  // Strategy 2: If few pages found, look for h2 with route paths like (/path) or (`/path`)
  if (sectionHeadings.length < 2) {
    for (const line of lines) {
      // Match h2 page sections: "## 4. Ana Sayfa (`/`)" or "## 4. Ana Sayfa (/)"
      const m = line.match(/^##\s+(?:\d+\.?\d*\s+)?(.+?)\s*\(`?\/[^)]*`?\)/);
      if (m) {
        const name = m[1].trim();
        if (name.length > 2 && !sectionHeadings.includes(name)) sectionHeadings.push(name);
      }
    }
  }

  // Strategy 3: Also check h3 with route paths (e.g. Blog Post Detail subpage)
  // Dedup by route path — if same route already found via Strategy 1, skip
  if (sectionHeadings.length > 0) {
    // Extract routes from Strategy 1 headings for dedup
    const existingRoutes = new Set<string>();
    for (const line of lines) {
      if (/^\d+\.\s+\*\*/.test(line)) {
        const rm = line.match(/\(`([^`]+)`\)/);
        if (rm) existingRoutes.add(rm[1].trim());
      }
    }
    for (const line of lines) {
      const m = line.match(/^###\s+(?:\d+\.?\d*\s+)?(.+?)\s*\(`?\/[^)]*`?\)/);
      if (m) {
        const name = m[1].trim();
        // Extract route from this h3
        const rm = line.match(/\(`([^`]+)`\)/);
        const route = rm ? rm[1].trim() : '';
        // Skip if route already covered by Strategy 1
        if (route && existingRoutes.has(route)) continue;
        if (name.length > 2 && !sectionHeadings.includes(name)) sectionHeadings.push(name);
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


// Extract page list from PRD content - returns structured array
// Called once when PRD is generated/enhanced, result saved to DB
export function extractPages(prdContent: string): { name: string; route: string; description: string }[] {
  const lines = prdContent.split('\n');
  const pages: { name: string; route: string; description: string }[] = [];

  // Find "Sayfalar" section and parse numbered/bullet list
  let inPagesSection = false;
  for (const line of lines) {
    if (/^##\s+.*sayfalar/i.test(line) && !inPagesSection) { inPagesSection = true; continue; }
    if (inPagesSection && /^##\s/.test(line)) break;
    if (!inPagesSection) continue;

    // Numbered: '1. **Name** (`/route`) - description'
    let m = line.match(/^\d+\.\s+\*\*(.+?)\*\*\s*\(`([^`]+)`[^)]*\)\s*[\u2014\u2013-]\s*(.+)/);
    if (m) { pages.push({ name: m[1].trim(), route: m[2].trim(), description: m[3].trim() }); continue; }
    // Numbered without desc
    m = line.match(/^\d+\.\s+\*\*(.+?)\*\*\s*\(`([^`]+)`[^)]*\)/);
    if (m) { pages.push({ name: m[1].trim(), route: m[2].trim(), description: '' }); continue; }
    // Bullet: '- **Name** (`/route`) - description'
    m = line.match(/^[-*]\s+\*\*(.+?)\*\*\s*\(`([^`]+)`[^)]*\)\s*[\u2014\u2013-]\s*(.+)/);
    if (m) { pages.push({ name: m[1].trim(), route: m[2].trim(), description: m[3].trim() }); continue; }
    // h3: '### Name (`/route`)'
    m = line.match(/^###\s+(?:\d+\.?\d*\s+)?(.+?)\s*\(`([^`]+)`[^)]*\)/);
    if (m) { pages.push({ name: m[1].trim(), route: m[2].trim(), description: '' }); }
  }

  return pages;
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
