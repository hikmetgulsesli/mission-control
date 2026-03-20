import { config } from '../config.js';

const MINIMAX_BASE = 'https://api.minimax.io/v1';
const MINIMAX_MODEL = 'MiniMax-M2.7';

async function callLlm(messages: { role: string; content: string }[], maxTokens = 4096): Promise<string> {
  const apiKey = process.env.MINIMAX_API_KEY || process.env.LLM_API_KEY || '';

  let res: Response;
  try {
    res = await fetch(`${MINIMAX_BASE}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: MINIMAX_MODEL,
        messages,
        max_tokens: maxTokens,
        temperature: 0.7,
      }),
      signal: AbortSignal.timeout(300000), // 5 min
    });
  } catch (err: any) {
    // D5 fix: user-friendly timeout message
    if (err.name === 'AbortError' || err.name === 'TimeoutError') {
      throw new Error('LLM istegi 5 dakika icinde tamamlanamadi. Daha kisa bir PRD ile tekrar deneyin.');
    }
    throw new Error(`LLM baglanti hatasi: ${err.message}`);
  }

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`LLM API ${res.status}: ${text}`);
  }

  const data = await res.json() as any;
  return data.choices?.[0]?.message?.content || '';
}

export async function generatePrd(params: {
  title: string;
  platform: string;
  description?: string;
  analysis?: any;
  research?: any;
  chatHistory?: { role: string; content: string }[];
  templateContent?: string;
}): Promise<string> {
  const { title, platform, description, analysis, research, chatHistory, templateContent } = params;

  let systemPrompt = `Sen bir PRD yazicisin. Sana verilen bilgilerle HEMEN bir PRD yaz. Soru sorma, bilgi isteme, aciklama yapma — sadece PRD icerigini Markdown olarak yaz.

KURALLAR:
- Direkt "# PRD — [Proje Adi]" ile basla
- Soru SORMA. Eksik bilgi varsa makul varsayimlar yap ve yaz.
- Asla "bana bilgi verin", "secenekler sunayim", "erisimim yok" gibi seyler yazma.
- Ciktinin tamami PRD olmali, baska metin olmasin.

PRD FORMATI:
1. Proje Genel Bakis (1 paragraf)
2. Tasarim Sistemi: renkler (hex kodlari), fontlar, spacing degerleri
3. Sayfa Listesi: projedeki TUM sayfalari/ekranlari listele (## Sayfalar basligiyla). Her sayfa icin:
   - Sayfa adi (benzersiz, net)
   - 1 satirlik aciklama
   Ornek: "Ana Sayfa — Hero section, ozellikler grid, CTA"
4. Her sayfa icin ayri detay bolumu (## [Sayfa Adi]) — layout, komponentler, davranislar, exact CSS degerleri
5. Animasyonlar: timing (ms), easing, duration
6. Responsive breakpoint'ler (mobile/tablet/desktop)
7. Veri modeli (interface/type tanimlari)
8. API endpoint'leri

ONEMLI: "## Sayfalar" bolumunde TUM sayfalari/ekranlari ac acik listele. Her sayfa sonra ayri ## bolum olarak detaylandirilacak. Sayfa sayisi en az 3, projenin buyuklugune gore 4-8 arasi.

Tech stack: ${platform === 'mobile' ? 'React Native + Expo + TypeScript' : 'React + TypeScript + Tailwind CSS + shadcn/ui'}

DETAY SEVIYESI: "Modern goruntum" YAZMA → exact hex renk yaz. "Guzel animasyon" YAZMA → "300ms ease-out opacity 0→1" yaz.`;

  const messages: { role: string; content: string }[] = [
    { role: 'system', content: systemPrompt },
  ];

  // Build context block — hepsini tek user mesajinda topla
  let contextBlock = '';

  if (analysis) {
    const a = typeof analysis === 'string' ? analysis : JSON.stringify(analysis, null, 2);
    contextBlock += `\n\nREFERANS SITE ANALIZI (bu bilgileri PRD'ye entegre et — renkler, fontlar, yapiyi aynen kullan):\n${a}`;
  }

  if (research) {
    contextBlock += `\n\nWEB ARASTIRMA SONUCLARI:\n${JSON.stringify(research, null, 2)}`;
  }

  if (chatHistory?.length) {
    const qaText = chatHistory.map(m => `${m.role === 'user' ? 'Kullanici' : 'Asistan'}: ${m.content}`).join('\n');
    contextBlock += `\n\nKULLANICI TERCIHLERI (Q&A):\n${qaText}`;
  }

  if (templateContent) {
    messages.push({
      role: 'user',
      content: `Şablon PRD (bunu baz al ama projeye uyarla):\n\n${templateContent}`,
    });
  }

  // Final generation request — tek mesajda tum context + direktif
  messages.push({
    role: 'user',
    content: `"${title}" projesi icin PRD yaz.
Platform: ${platform}
${description ? `Aciklama: ${description}` : ''}
${contextBlock}

SIMDI HEMEN PRD YAZ. "# PRD — ${title}" ile basla. Soru sorma, aciklama yapma, sadece PRD icerigini yaz.`,
  });

  const raw = await callLlm(messages, 8192);
  return cleanPrdOutput(raw);
}

/**
 * LLM ciktisini temizle — thinking bloklari, meta yorumlar, bos satirlari kaldir.
 * Sadece markdown PRD icerigini birak.
 */
function cleanPrdOutput(raw: string): string {
  let text = raw;

  // "The user wants me to..." gibi meta-thinking bloklarini kaldir
  // Bu bloklar genelde PRD'den once gelir
  const prdStart = text.search(/^#\s+PRD/m);
  if (prdStart > 0) {
    text = text.slice(prdStart);
  }

  // Eger hala # ile baslamiyorsa, ilk # satirindan itibaren al
  const firstHeading = text.search(/^#\s/m);
  if (firstHeading > 0) {
    text = text.slice(firstHeading);
  }

  // Sondaki meta yorumlari temizle (genelde --- veya "Note:" ile baslar)
  text = text.replace(/\n---\n[\s\S]*?(?:Note|Disclaimer|Bu PRD|Not:)[\s\S]*$/i, '');

  return text.trim();
}

export async function enhancePrd(currentPrd: string, version: number): Promise<string> {
  const messages = [
    {
      role: 'system',
      content: `Sen bir PRD kalite uzmanısın. Mevcut PRD'yi analiz edip daha detaylı hale getirirsin.

Kurallar:
- Genel ifadeleri spesifik yap ("modern" → exact CSS values)
- Eksik ekranları ekle
- Animasyon timing/easing detayları ekle
- Komponent props/state detayları ekle
- Responsive breakpoint'ler ekle
- Edge case'leri tanımla
- Her iterasyonda önemli ölçüde daha detaylı yap`,
    },
    {
      role: 'user',
      content: `Bu PRD'nin v${version} versiyonu. Bunu geliştirip v${version + 1} yap:

${currentPrd}

Gelistir ve sadece yeni PRD'yi Markdown olarak dondur. Meta yorum, aciklama, dusunce sureci yazma — direkt PRD icerigi.`,
    },
  ];

  const raw = await callLlm(messages, 8192);
  return cleanPrdOutput(raw);
}

export async function generateChatQuestions(context: {
  title?: string;
  platform?: string;
  description?: string;
  urls?: string[];
  analysis?: any;
  chatHistory?: { role: string; content: string }[];
}): Promise<string> {
  const messages = [
    {
      role: 'system',
      content: `Sen bir PRD oluşturma asistanısın. Kullanıcıdan proje detaylarını öğrenmek için akıllı sorular sorarsın. Her seferinde 1-2 soru sor. Kısa ve öz ol. Türkçe konuş.

Sorulacak konular (sırayla, henüz cevaplanmamışları sor):
1. Hedef kitle
2. Tema (dark/light)
3. Dil (Türkçe/İngilizce/çoklu)
4. Login/auth gereksinimi
5. Ekran sayısı tahmini
6. Özel istek veya kısıtlamalar
7. Benzer projeler / ilham kaynakları

Zaten cevaplanan soruları tekrar sorma.`,
    },
  ];

  if (context.chatHistory?.length) {
    for (const msg of context.chatHistory) {
      messages.push(msg);
    }
  }

  messages.push({
    role: 'user',
    content: `Proje: ${context.title || 'Henüz belirsiz'}
Platform: ${context.platform || 'web'}
${context.description ? `Açıklama: ${context.description}` : ''}
${context.urls?.length ? `URL'ler: ${context.urls.join(', ')}` : ''}
${context.analysis ? 'Site analizi yapıldı.' : ''}

Bir sonraki soruyu sor.`,
  });

  return callLlm(messages, 500);
}

export async function generateAbComparison(prd: string, title: string): Promise<{ prdA: string; prdB: string }> {
  const messages = [
    {
      role: 'system',
      content: `İki farklı PRD versiyonu oluştur:
PRD-A: Minimal — az story, hızlı implementasyon, temel özellikler
PRD-B: Detaylı — çok story, yüksek kalite, tüm edge case'ler

Her ikisini de tam PRD formatında yaz. Aralarına "---PRD-B---" ayracı koy.`,
    },
    {
      role: 'user',
      content: `"${title}" projesi için mevcut PRD'yi baz alarak A/B karşılaştırma PRD'leri oluştur:

${prd}`,
    },
  ];

  const response = await callLlm(messages, 12000);
  const parts = response.split('---PRD-B---');
  return {
    prdA: parts[0]?.trim() || response,
    prdB: parts[1]?.trim() || '',
  };
}

export async function analyzeSite(html: string, url: string): Promise<any> {
  const truncatedHtml = html.slice(0, 15000);
  const messages = [
    {
      role: 'system',
      content: `Web sitesi HTML'ini analiz et ve aşağıdaki bilgileri JSON olarak döndür:
{
  "title": "site başlığı",
  "description": "site açıklaması",
  "pages": ["tespit edilen sayfalar"],
  "colors": { "primary": "#hex", "secondary": "#hex", "background": "#hex", "text": "#hex", "accent": "#hex" },
  "fonts": ["font isimleri"],
  "techStack": ["tespit edilen teknolojiler"],
  "components": ["tespit edilen UI komponentleri"],
  "sections": ["ana bölümler"],
  "animations": ["tespit edilen animasyonlar"],
  "responsive": "responsive bilgisi",
  "features": ["temel özellikler"]
}
Sadece JSON döndür, başka açıklama yapma.`,
    },
    {
      role: 'user',
      content: `URL: ${url}\n\nHTML:\n${truncatedHtml}`,
    },
  ];

  const response = await callLlm(messages, 2000);
  try {
    return JSON.parse(response.replace(/```json\n?/g, '').replace(/```\n?/g, ''));
  } catch {
    return { raw: response, url };
  }
}

export async function analyzeScreenshot(base64: string, filename: string): Promise<any> {
  // Gemini API ile gercek vision analizi
  const geminiKey = process.env.GEMINI_API_KEY || '';

  if (geminiKey) {
    try {
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${encodeURIComponent(geminiKey)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [
              {
                text: `Bu bir UI screenshot'i. Analiz et ve asagidaki bilgileri JSON olarak dondur:
{
  "layout": "layout aciklamasi (grid/flex/stack/sidebar+content vb.)",
  "colors": { "primary": "#hex", "secondary": "#hex", "background": "#hex", "text": "#hex", "accent": "#hex" },
  "components": ["tespit edilen UI komponentleri (button, card, nav, modal, input, table, vb.)"],
  "sections": ["ana bolumleri (hero, header, sidebar, content, footer, vb.)"],
  "style": "genel stil (minimal/modern/corporate/playful/cyberpunk/glassmorphism)",
  "typography": { "headingFont": "tahmin", "bodyFont": "tahmin", "sizes": "ornek boyutlar" },
  "spacing": "genel spacing pattern (compact/normal/spacious)",
  "responsive": "gorunen breakpoint ipuclari",
  "suggestions": ["PRD icin oneriler"]
}
Sadece JSON dondur, baska aciklama yapma.`
              },
              {
                inline_data: {
                  mime_type: filename.endsWith('.png') ? 'image/png' : 'image/jpeg',
                  data: base64,
                }
              }
            ]
          }],
          generationConfig: { temperature: 0.3, maxOutputTokens: 2000 },
        }),
        signal: AbortSignal.timeout(30000),
      });

      if (res.ok) {
        const data = await res.json() as any;
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
        try {
          return JSON.parse(text.replace(/```json\n?/g, '').replace(/```\n?/g, ''));
        } catch {
          return { raw: text, filename, source: 'gemini' };
        }
      }
    } catch (err: any) {
      console.warn('[PRD-LLM] Gemini vision failed, falling back to text analysis:', err.message);
    }
  }

  // Fallback: text-only MiniMax analiz (dosya adi ve context'ten tahmin)
  const messages = [
    {
      role: 'system',
      content: `Bir UI screenshot dosya adi ve context'inden, olasi UI yapisini tahmin et. JSON formatinda dondur:
{
  "layout": "tahmin",
  "colors": { "primary": "#hex", "background": "#hex", "text": "#hex" },
  "components": ["olasi komponentler"],
  "sections": ["olasi bolumler"],
  "style": "tahmin",
  "suggestions": ["PRD icin oneriler"]
}
Sadece JSON dondur.`,
    },
    {
      role: 'user',
      content: `Screenshot dosya adi: ${filename}. Bu bir UI tasarimi screenshot'i. Dosya adindan ve genel UI pattern'larindan yapisi hakkinda tahmin yap.`,
    },
  ];

  const response = await callLlm(messages, 1500);
  try {
    return JSON.parse(response.replace(/```json\n?/g, '').replace(/```\n?/g, ''));
  } catch {
    return { raw: response, filename };
  }
}
