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
      signal: AbortSignal.timeout(600000), // 5 min
    });
  } catch (err: any) {
    // D5 fix: user-friendly timeout message
    if (err.name === 'AbortError' || err.name === 'TimeoutError') {
      throw new Error('LLM request did not complete within 5 minutes. Try again with a shorter PRD.');
    }
    throw new Error(`LLM connection error: ${err.message}`);
  }

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`LLM API ${res.status}: ${text}`);
  }

  const data = await res.json() as any;
  return data.choices?.[0]?.message?.content || '';
}

export const TRENDS_2026 = {
  ui: ["Bento Box grid layouts", "Glassmorphism 2.0 with backdrop-blur", "Micro-animations on every interaction", "Scroll-driven animations", "Skeleton-first loading patterns", "Dark mode as default"],
  features: ["AI-powered search and recommendations", "Real-time collaboration", "Offline-first PWA architecture", "Voice UI integration", "Accessibility-first design (WCAG 2.1 AA)"],
  tech: ["React Server Components", "Edge computing with Vercel/Cloudflare Workers", "View Transitions API", "Container queries for responsive design", "Variable fonts for premium typography"],
};

export function buildTrendEnhancementPrompt(currentPrd: string, trends: typeof TRENDS_2026): string {
  return `You are enhancing an existing PRD with 2026 technology and design trends.

Current PRD:
${currentPrd.slice(0, 3000)}

Apply these 2026 trends where relevant:
UI Trends: ${trends.ui.join(", ")}
Feature Trends: ${trends.features.join(", ")}
Tech Trends: ${trends.tech.join(", ")}

Rules:
1. Keep the original project scope — don't change the core idea
2. Add trend-aligned enhancements as NEW sections
3. Suggest modern UI patterns for existing screens
4. Add an "AI Features" section if applicable
5. Output the ENHANCED PRD (full content, not just additions)`;
}

export { callLlm };

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

  let systemPrompt = `You are a PRD writer. Use the provided information and write the PRD immediately. Do not ask questions, request more information, or add explanations. Output only Markdown PRD content.

RULES:
- Start directly with "# PRD — [Project Name]"
- Do NOT ask questions. If information is missing, make reasonable assumptions and document them.
- Never write phrases like "give me more information", "I can offer options", or "I do not have access".
- The entire output must be the PRD, with no extra commentary.

PRD FORMAT:
1. Project Overview (one paragraph)
2. Design System: colors with hex codes, fonts, spacing values
3. Page List: use a "## Pages" heading. Every page must use this EXACT format:
   N. **Page Name** (\`/route\`) — Short description
   
   Example:
   1. **Home** (\`/\`) — Hero section, feature grid, CTA
   2. **About** (\`/about\`) — Team intro and company story
   3. **Blog** (\`/blog\`) — Article list, categories, search
   
   REQUIRED: route inside backticks (\`/path\`), bold name (**Name**), dash and description. This format must not change.
4. A separate detail section for each page (## [Page Name]) with layout, components, behaviors, exact CSS values
5. Animasyonlar: timing (ms), easing, duration
6. Responsive breakpoints (mobile/tablet/desktop)
7. Data model (interface/type definitions)
8. API endpoints

IMPORTANT: List ALL pages in the "## Pages" section using the exact format: N. **Name** (\`/route\`) — Description. Each page must later have its own ## detail section. Include at least 3 pages, usually 4-8 depending on project size.

Tech stack: ${(() => {
  switch (platform) {
    case 'mobile':
    case 'mobile-rn':
      return 'React Native + Expo + TypeScript';
    case 'game-web':
      return 'React + Three.js (WebGL) + TypeScript + Tailwind';
    case 'game-native':
      return 'Unity 2D + C# (or Godot 4 + GDScript)';
    case 'python-api':
      return 'Python 3.12 + FastAPI + Pydantic + SQLAlchemy async';
    case 'python-cli':
      return 'Python 3.12 + Typer + Rich + pytest';
    case 'docs':
      return 'Next.js + MDX + Fumadocs';
    case 'web':
    default:
      return 'React + TypeScript + Tailwind CSS + shadcn/ui';
  }
})()}

NAME RULE: Never rewrite or "correct" user-provided names or words from a domain. Preserve them exactly. Example: if the user wrote "gulsesli", do not change it to "gulesli".

DETAIL LEVEL: Do not write vague phrases like "modern look"; provide exact hex colors. Do not write "nice animation"; write details like "300ms ease-out opacity 0->1".`;

  const messages: { role: string; content: string }[] = [
    { role: 'system', content: systemPrompt },
  ];

  // Build one compact user context block.
  let contextBlock = '';

  if (analysis) {
    const a = typeof analysis === 'string' ? analysis : JSON.stringify(analysis, null, 2);
    contextBlock += `\n\nREFERENCE SITE ANALYSIS (integrate these details into the PRD; preserve colors, fonts, and structure where relevant):\n${a}`;

    // Inject structured screenshot analysis as explicit design rules
    if (typeof analysis === 'object' && analysis !== null) {
      contextBlock += `\n\nSCREENSHOT ANALYSIS (follow these design rules):`;
      if (analysis.colors) contextBlock += `\n- Colors: ${JSON.stringify(analysis.colors)}`;
      if (analysis.typography) contextBlock += `\n- Typography: ${JSON.stringify(analysis.typography)}`;
      if (analysis.components) contextBlock += `\n- Components: ${JSON.stringify(analysis.components)}`;
      if (analysis.layout) contextBlock += `\n- Layout: ${analysis.layout}`;
      if (analysis.sections) contextBlock += `\n- Sections: ${JSON.stringify(analysis.sections)}`;
      if (analysis.style) contextBlock += `\n- Style: ${typeof analysis.style === 'string' ? analysis.style : JSON.stringify(analysis.style)}`;
    }
  }

  if (research) {
    contextBlock += `\n\nWEB RESEARCH RESULTS:\n${JSON.stringify(research, null, 2)}`;
  }

  if (chatHistory?.length) {
    const qaText = chatHistory.map(m => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`).join('\n');
    contextBlock += `\n\nUSER PREFERENCES (Q&A):\n${qaText}`;
  }

  if (templateContent) {
    messages.push({
      role: 'user',
      content: `Template PRD (use as a base, but adapt it to the project):\n\n${templateContent}`,
    });
  }

  // Final generation request with all context and directives.
  messages.push({
    role: 'user',
    content: `Write a PRD for the "${title}" project.
Platform: ${platform}
${description ? `Description: ${description}` : ''}
${contextBlock}

WRITE THE PRD NOW. Start with "# PRD — ${title}". Do not ask questions, do not add commentary, output only PRD content.`,
  });

  const raw = await callLlm(messages, 16000);
  return cleanPrdOutput(raw);
}

/**
 * Clean LLM output by removing thinking blocks, meta commentary, and empty wrapper text.
 * Keep only Markdown PRD content.
 */
function cleanPrdOutput(raw: string): string {
  let text = raw;

  // Strip <think>...</think> blocks (LLM reasoning output)
  text = text.replace(/<think>[\s\S]*?<\/think>/g, '').trim();

  // Remove meta-thinking blocks that usually appear before the PRD.
  const prdStart = text.search(/^#\s+PRD/m);
  if (prdStart > 0) {
    text = text.slice(prdStart);
  }

  // If output still does not start with a heading, keep content from the first heading.
  const firstHeading = text.search(/^#\s/m);
  if (firstHeading > 0) {
    text = text.slice(firstHeading);
  }

  // Remove trailing meta commentary.
  text = text.replace(/\n---\n[\s\S]*?(?:Note|Disclaimer|Bu PRD|Not:)[\s\S]*$/i, '');

  return text.trim();
}

export async function enhancePrd(currentPrd: string, version: number): Promise<string> {
  const messages = [
    {
      role: 'system',
      content: `You are a PRD quality specialist. Analyze the existing PRD and make it more complete.

CRITICAL RULES:
- NEVER DELETE EXISTING PAGE SECTIONS. Preserve all page details such as ## Home or ## Projects.
- Preserve existing content; only add or expand details.
- Replace vague wording with specific requirements ("modern" -> exact CSS values).
- Add missing pages/screens and also add them to the "## Pages" list.
- Add animation timing/easing details when missing.
- Add component props/state details when missing.
- Add responsive breakpoints when missing.
- Define edge cases.
- OUTPUT: the complete previous PRD plus the additions. Do not remove any section.
- If the PRD already scores 100, make only small improvements and do not remove sections.
- The "## Pages" list format is: N. **Page Name** (\`/route\`) — Description. This format must not change.
- New pages may be added, but they must use the same format. Existing page names and routes must not change.
- Do not change existing design-system values such as font-family, hex colors, spacing, or shadows; only add missing values.
- Existing fonts, colors, and design tokens must be preserved exactly.`,
    },
    {
      role: 'user',
      content: `This is version v${version} of the PRD. Improve it into v${version + 1}:

${currentPrd}

Improve it and return only the new PRD as Markdown. Do not include meta commentary, explanation, or reasoning. Output direct PRD content.`,
    },
  ];

  const raw = await callLlm(messages, 16000);
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
      content: `You are a PRD discovery assistant. Ask smart questions to learn the user's project details. Ask 1-2 questions at a time. Be concise. Speak English.

Topics to ask about, in order, skipping anything already answered:
1. Target audience
2. Tema (dark/light)
3. Language (English, multilingual, or another explicit target language)
4. Login/auth requirements
5. Estimated screen count
6. Special requests or constraints
7. Similar projects or inspiration sources

Do not repeat questions that have already been answered.`,
    },
  ];

  if (context.chatHistory?.length) {
    for (const msg of context.chatHistory) {
      messages.push(msg);
    }
  }

  messages.push({
    role: 'user',
    content: `Project: ${context.title || 'Not specified yet'}
Platform: ${context.platform || 'web'}
${context.description ? `Description: ${context.description}` : ''}
${context.urls?.length ? `URLs: ${context.urls.join(', ')}` : ''}
${context.analysis ? 'Site analysis is available.' : ''}

Ask the next question.`,
  });

  return callLlm(messages, 500);
}


export async function analyzeSite(html: string, url: string): Promise<any> {
  const truncatedHtml = html.slice(0, 15000);
  const messages = [
    {
      role: 'system',
      content: `Analyze this website HTML and return the following information as JSON:
{
  "title": "site title",
  "description": "site description",
  "pages": ["detected pages"],
  "colors": { "primary": "#hex", "secondary": "#hex", "background": "#hex", "text": "#hex", "accent": "#hex" },
  "fonts": ["font names"],
  "techStack": ["detected technologies"],
  "components": ["detected UI components"],
  "sections": ["main sections"],
  "animations": ["detected animations"],
  "responsive": "responsive bilgisi",
  "features": ["core features"]
}
Return only JSON, with no extra explanation.`,
    },
    {
      role: 'user',
      content: `URL: ${url}\n\nHTML:\n${truncatedHtml}`,
    },
  ];

  const response = await callLlm(messages, 2000);
  try {
    // Strip <think> blocks before parsing
    const cleaned = response.replace(/<think>[\s\S]*?<\/think>/g, '').trim();
    return JSON.parse(cleaned.replace(/```json\n?/g, '').replace(/```\n?/g, ''));
  } catch {
    // Try to extract JSON from mixed output
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try { return JSON.parse(jsonMatch[0]); } catch {}
    }
    return { raw: response.slice(0, 500), url };
  }
}

export async function analyzeScreenshot(base64: string, filename: string): Promise<any> {
  // Real vision analysis through Gemini API.
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
                text: `This is a UI screenshot. Analyze it and return the following information as JSON:
{
  "suggestedTitle": "a suitable short 2-4 word project/page title for this UI",
  "layout": "layout description (grid/flex/stack/sidebar+content, etc.)",
  "colors": { "primary": "#hex", "secondary": "#hex", "background": "#hex", "text": "#hex", "accent": "#hex" },
  "components": ["detected UI components (button, card, nav, modal, input, table, etc.)"],
  "sections": ["main sections (hero, header, sidebar, content, footer, etc.)"],
  "style": "overall style (minimal/modern/corporate/playful/cyberpunk/glassmorphism)",
  "typography": { "headingFont": "estimated heading font family", "bodyFont": "estimated body font family", "sizes": "example sizes (h1: 32px, body: 16px, etc.)" },
  "spacing": "overall spacing pattern (compact/normal/spacious) and pixel values (padding: 16px, gap: 12px, etc.)",
  "responsive": "visible breakpoint clues",
  "suggestions": ["PRD suggestions"]
}
IMPORTANT: use real hex values in colors, such as #1a1a2e. Estimate fonts in typography. Always fill suggestedTitle.
Return only JSON, with no extra explanation.`
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
          const cleaned2 = text.replace(/<think>[\s\S]*?<\/think>/g, '').trim();
          return JSON.parse(cleaned2.replace(/```json\n?/g, '').replace(/```\n?/g, ''));
        } catch {
          const jsonMatch2 = text.match(/\{[\s\S]*\}/);
          if (jsonMatch2) { try { return JSON.parse(jsonMatch2[0]); } catch {} }
          return { raw: text.slice(0, 500), filename, source: 'gemini' };
        }
      }
    } catch (err: any) {
      console.warn('[PRD-LLM] Gemini vision failed, falling back to text analysis:', err.message);
    }
  }

  // Fallback: text-only MiniMax analysis based on filename and context.
  const messages = [
    {
      role: 'system',
      content: `Infer a likely UI structure from a UI screenshot filename and context. Return JSON:
{
  "suggestedTitle": "a suitable project/page title for this UI",
  "layout": "estimate",
  "colors": { "primary": "#hex", "secondary": "#hex", "background": "#hex", "text": "#hex", "accent": "#hex" },
  "components": ["likely components"],
  "sections": ["likely sections"],
  "style": "estimate",
  "typography": { "headingFont": "estimate", "bodyFont": "estimate", "sizes": "example sizes" },
  "spacing": "estimate (compact/normal/spacious)",
  "suggestions": ["PRD suggestions"]
}
Return only JSON.`,
    },
    {
      role: 'user',
      content: `Screenshot filename: ${filename}. This is a UI design screenshot. Infer its structure from the filename and common UI patterns.`,
    },
  ];

  const response = await callLlm(messages, 1500);
  try {
    return JSON.parse(response.replace(/```json\n?/g, '').replace(/```\n?/g, ''));
  } catch {
    return { raw: response, filename };
  }
}
