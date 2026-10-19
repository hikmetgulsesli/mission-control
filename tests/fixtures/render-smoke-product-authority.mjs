// Fixed, synthetic Task4 data. These values are never operational authority.
// Source: accepted-task4-dataset-observation-addendum-proposal-v1.md.
import { createHash } from 'node:crypto';
const canonical = value => value === null || typeof value !== 'object' ? JSON.stringify(value)
    : Array.isArray(value) ? '[' + value.map(canonical).join(',') + ']'
        : '{' + Object.keys(value).sort().map(key => JSON.stringify(key) + ':' + canonical(value[key])).join(',') + '}';
const digest = value => createHash('sha256').update(canonical(value)).digest('hex');
const freeze = value => { if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); } return value; };
const SEED = freeze({
  "emptyRelations": [
    {
      "name": "accepted_candidates",
      "rows": [],
      "schema": "public"
    },
    {
      "name": "agent_feed",
      "rows": [],
      "schema": "public"
    },
    {
      "name": "claim_log",
      "rows": [],
      "schema": "public"
    },
    {
      "name": "execution_attempts",
      "rows": [],
      "schema": "public"
    },
    {
      "name": "live_events",
      "rows": [],
      "schema": "public"
    },
    {
      "name": "operational_event_deliveries",
      "rows": [],
      "schema": "public"
    },
    {
      "name": "operational_events",
      "rows": [],
      "schema": "public"
    },
    {
      "name": "operational_outbox",
      "rows": [],
      "schema": "public"
    },
    {
      "name": "prds",
      "rows": [],
      "schema": "public"
    },
    {
      "name": "product_packets",
      "rows": [],
      "schema": "public"
    },
    {
      "name": "run_observations",
      "rows": [],
      "schema": "public"
    },
    {
      "name": "runtime_sessions",
      "rows": [],
      "schema": "public"
    },
    {
      "name": "steps",
      "rows": [],
      "schema": "public"
    },
    {
      "name": "stories",
      "rows": [],
      "schema": "public"
    },
    {
      "name": "tasks",
      "rows": [],
      "schema": "public"
    },
    {
      "name": "v3_canary_admission_claims",
      "rows": [],
      "schema": "public"
    },
    {
      "name": "v3_deploy_receipts",
      "rows": [],
      "schema": "public"
    },
    {
      "name": "v3_project_transfer_acks",
      "rows": [],
      "schema": "public"
    }
  ],
  "productResponse": {
    "authorityHash": "3d2c672d27bf99e31965342861be16e1f753a76295c97cd5b12ebc192ea16307",
    "disposition": "sealed_packet",
    "packetAuthority": {
      "authorityHash": "bb8f13479bfe66e147f4a61d38f0001031e728c932be039c28739d04417890df",
      "buildTopology": {
        "schema": "setfarm.build-topology.v1"
      },
      "compilationReport": {
        "artifactHashes": {
          "buildTopology": "ecea5f9291d61028208e5e43e1ae345fce8ab97485ce4203da4cc0b1224fabbe",
          "designGraph": "55506752be34099840567d0d00188621adbf7ff9bdfa1f8170fe66cfbe4f6f15",
          "productSpec": "01351d873c4cf75cdc148d9454db372c8b877ae9932918097f8083e70d8a6325",
          "storyPlan": "fafc4c6e6a46b3a10370fa50e54624f46989974fedb446e6ab13017bff7ccfc1"
        },
        "compiler": {
          "codeSha": "1111111111111111111111111111111111111111",
          "version": "3.5.0"
        },
        "diagnostics": [],
        "inputHashes": [
          "0000000000000000000000000000000000000000000000000000000000000008"
        ],
        "packetHash": "9530fba29e2f1aba456ba213e0a856e030465956cb430f2245c63f7fdc03def2",
        "schema": "setfarm.product-compilation-report.v1",
        "status": "sealed",
        "validationIds": [
          "VALIDATE_PACKET"
        ]
      },
      "designGraph": {
        "bindings": [],
        "controls": [],
        "schema": "setfarm.design-interaction-graph.v1",
        "surfaces": []
      },
      "packet": {
        "buildTopologyHash": "ecea5f9291d61028208e5e43e1ae345fce8ab97485ce4203da4cc0b1224fabbe",
        "compiler": {
          "codeSha": "1111111111111111111111111111111111111111",
          "version": "3.5.0"
        },
        "designGraphHash": "55506752be34099840567d0d00188621adbf7ff9bdfa1f8170fe66cfbe4f6f15",
        "packetVersion": 1,
        "parentPacketHashes": [],
        "productSpecHash": "01351d873c4cf75cdc148d9454db372c8b877ae9932918097f8083e70d8a6325",
        "schema": "setfarm.product-build-packet.v1",
        "storyPlanHash": "fafc4c6e6a46b3a10370fa50e54624f46989974fedb446e6ab13017bff7ccfc1",
        "validationIds": [
          "VALIDATE_PACKET"
        ]
      },
      "packetHash": "9530fba29e2f1aba456ba213e0a856e030465956cb430f2245c63f7fdc03def2",
      "producer": {
        "codeSha": "1111111111111111111111111111111111111111",
        "pass": "setup-build",
        "toolVersions": {
          "node": "22.13.0"
        }
      },
      "productSpec": {
        "actions": [],
        "routes": [],
        "schema": "setfarm.product-spec.v1",
        "surfaces": []
      },
      "refs": {
        "buildTopology": "ecea5f9291d61028208e5e43e1ae345fce8ab97485ce4203da4cc0b1224fabbe",
        "compilationReport": "8f0e8b708c8d94f0e13b9f5a2486c4f2711edead8d9661f5765f75b771e166bc",
        "designGraph": "55506752be34099840567d0d00188621adbf7ff9bdfa1f8170fe66cfbe4f6f15",
        "packet": "9530fba29e2f1aba456ba213e0a856e030465956cb430f2245c63f7fdc03def2",
        "productSpec": "01351d873c4cf75cdc148d9454db372c8b877ae9932918097f8083e70d8a6325",
        "storyPlan": "fafc4c6e6a46b3a10370fa50e54624f46989974fedb446e6ab13017bff7ccfc1"
      },
      "runId": "ad47fe65-4ec4-4fb5-89da-fff71eb4e79a",
      "schema": "setfarm.product-build-authority.v1",
      "storyPlan": {
        "schema": "setfarm.story-plan.v1",
        "stories": []
      }
    },
    "refusal": null,
    "runId": "ad47fe65-4ec4-4fb5-89da-fff71eb4e79a",
    "schema": "setfarm.product-build-authority.v2"
  },
  "releaseAdmissions": [
    {
      "admission_hash": "00cc494ab034ad23e93995bb0058ed9f7925c0b4522bfb1bb5e57e7cd4a6d385",
      "created_at": "2026-07-13T00:00:00.000Z",
      "expires_at": null,
      "gate_hash": "241cc90624864a2571197184cc615508fd3e3f9c40439ff67526905aaa26ee7e",
      "gate_ref": "sha256/24/241cc90624864a2571197184cc615508fd3e3f9c40439ff67526905aaa26ee7e.json",
      "kind": "release_go",
      "payload": {
        "admissionHash": "00cc494ab034ad23e93995bb0058ed9f7925c0b4522bfb1bb5e57e7cd4a6d385",
        "expiresAt": null,
        "gate": {
          "hash": "241cc90624864a2571197184cc615508fd3e3f9c40439ff67526905aaa26ee7e",
          "ref": "sha256/24/241cc90624864a2571197184cc615508fd3e3f9c40439ff67526905aaa26ee7e.json"
        },
        "issuedAt": "2026-07-13T00:00:00.000Z",
        "kind": "release_go",
        "preflightHash": "57fc751e81715104b94b09692ed5c3c5ae897c6c40feeac6225147c1484728d0",
        "releaseSha": "1111111111111111111111111111111111111111",
        "result": {
          "hash": "93ce3d7fb77f828943cc8ae7f84e3bdbefc92bcdbad5a49792ccc01d3234aba7",
          "ref": "sha256/93/93ce3d7fb77f828943cc8ae7f84e3bdbefc92bcdbad5a49792ccc01d3234aba7.json"
        },
        "schema": "setfarm.v3-release-admission.v1",
        "slots": [],
        "suiteHash": "25f108e57ff5a978c88ea7ea84c22cb157daef02332d53b39e3967ab0db8229c"
      },
      "release_sha": "1111111111111111111111111111111111111111",
      "result_hash": "93ce3d7fb77f828943cc8ae7f84e3bdbefc92bcdbad5a49792ccc01d3234aba7",
      "result_ref": "sha256/93/93ce3d7fb77f828943cc8ae7f84e3bdbefc92bcdbad5a49792ccc01d3234aba7.json",
      "suite_hash": "25f108e57ff5a978c88ea7ea84c22cb157daef02332d53b39e3967ab0db8229c"
    }
  ],
  "runs": [
    {
      "accepted_candidate_hash": null,
      "activation_preflight_hash": null,
      "assigned_developer": null,
      "compiler_release_sha": null,
      "context": "{}",
      "created_at": "2026-10-19T00:00:00.000Z",
      "deploy_receipt_hash": null,
      "id": "ac8cea43-7686-4d27-8092-1e3dd9207ca4",
      "meta": null,
      "notify_url": null,
      "packet_hash": null,
      "project_transfer_ack_hash": null,
      "protocol": "legacy",
      "protocol_version": 1,
      "release_admission_hash": null,
      "run_number": 1,
      "status": "running",
      "task": "Task4 render smoke legacy fixture",
      "updated_at": "2026-10-19T00:00:00.000Z",
      "workflow_id": "feature-dev"
    },
    {
      "accepted_candidate_hash": null,
      "activation_preflight_hash": "57fc751e81715104b94b09692ed5c3c5ae897c6c40feeac6225147c1484728d0",
      "assigned_developer": null,
      "compiler_release_sha": "1111111111111111111111111111111111111111",
      "context": "{}",
      "created_at": "2026-10-19T00:00:00.000Z",
      "deploy_receipt_hash": null,
      "id": "ad47fe65-4ec4-4fb5-89da-fff71eb4e79a",
      "meta": null,
      "notify_url": null,
      "packet_hash": "9530fba29e2f1aba456ba213e0a856e030465956cb430f2245c63f7fdc03def2",
      "project_transfer_ack_hash": null,
      "protocol": "v3",
      "protocol_version": 1,
      "release_admission_hash": "00cc494ab034ad23e93995bb0058ed9f7925c0b4522bfb1bb5e57e7cd4a6d385",
      "run_number": 2,
      "status": "running",
      "task": "Task4 render smoke V3 fixture",
      "updated_at": "2026-10-19T00:00:00.000Z",
      "workflow_id": "feature-dev"
    }
  ],
  "schema": "mission-control.task4-seed-observation.v1",
  "sourceSha": "1111111111111111111111111111111111111111",
  "templateRows": [
    {
      "category": "admin",
      "created_at": "2026-10-19T00:00:00.000Z",
      "description": "CRUD admin panel with users, content management, and settings",
      "id": "tpl-admin",
      "name": "Admin Panel",
      "platform": "web",
      "prd_content": "# PRD - Admin Panel\n\n## 1. Project Overview\nBuild a full CRUD admin system with authentication, user management, content management, categories, settings, and audit-friendly tables.\n\n**Tech Stack:** React + TypeScript + Tailwind CSS + shadcn/ui + TanStack Table\n\n## 2. Design System\n- Background: #FFFFFF, Sidebar: #F8FAFC, Card: #FFFFFF\n- Primary: #0F172A, Accent: #2563EB, Border: #E2E8F0\n- Font: Inter, 14px base\n- Spacing: 4px grid\n- Dark mode via CSS custom properties\n\n## 3. Pages\n1. **Login** (/login) - Auth form and password recovery\n2. **Dashboard** (/) - Metrics, recent activity, quick actions\n3. **Users** (/users) - User data table and create/edit dialog\n4. **Content** (/content) - Content data table and editor form\n5. **Categories** (/categories) - Category table and sorting\n6. **Settings** (/settings) - General, email, security, backup settings\n\n## 4. Page Requirements\n- Login: centered form, logo, email, password, login button, forgot-password link, error alert.\n- Dashboard: four metric cards, recent activity list, quick action buttons.\n- Users: selectable rows, avatar/name, email, role badge, status switch, actions menu, filters.\n- Content: title, category, author, date, status, create/edit full-page form.\n- Categories: table with order controls, create/edit dialog, parent category select.\n- Settings: grouped forms with tabs.\n\n## 5. Data Model\n- User: id, name, email, role, status, avatar, createdAt\n- Content: id, title, slug, body, categoryId, authorId, status, coverImage, seoTitle, seoDescription, createdAt, updatedAt\n- Category: id, name, slug, parentId, sortOrder\n- Setting: key, value, group\n"
    },
    {
      "category": "blog",
      "created_at": "2026-10-19T00:00:00.000Z",
      "description": "Blog site with article list, article details, categories, and search",
      "id": "tpl-blog",
      "name": "Blog",
      "platform": "web",
      "prd_content": "# PRD - Blog Platform\n\n## 1. Project Overview\nBuild a modern publishing platform with article discovery, categories, search, article detail pages, author pages, and newsletter capture.\n\n**Tech Stack:** React + TypeScript + Tailwind CSS\n\n## 2. Design System\n- Background: #FFFFFF, Card: #F9FAFB\n- Text: #111827 heading, #4B5563 body, #9CA3AF muted\n- Primary: #3B82F6, Accent: #8B5CF6, Border: #E5E7EB, Code background: #1F2937\n- Fonts: Merriweather for editorial headings, Source Sans 3 for body, Fira Code for code\n- Motion: 300ms page fade, 200ms card hover, 500ms lazy-image blur\n\n## 3. Pages\n1. **Home** (/) - Featured article, latest posts, categories, newsletter\n2. **Blog** (/blog) - Search, filters, post grid, pagination\n3. **Category** (/category/:slug) - Category feed and sidebar\n4. **Article** (/blog/:slug) - Cover, content, table of contents, author box, related posts\n5. **About** (/about) - Author profile and site mission\n6. **Contact** (/contact) - Contact form\n\n## 4. Page Requirements\n- Home: featured post card with cover image, category badge, author/date, latest post grid.\n- Blog: category buttons, search input, post cards, pagination, popular posts sidebar.\n- Article: large title, author metadata, cover image, markdown rendering, code blocks, blockquotes, TOC, comments.\n- About: author bio, social links, metrics.\n- Contact: name, email, subject, message, submit state.\n\n## 5. Data Model\n- Post: id, title, slug, content, excerpt, coverImage, category, tags, author, publishedAt, readingTime\n- Category: id, name, slug, postCount\n- Author: id, name, bio, avatar, socialLinks\n- Comment: id, postId, name, email, content, createdAt\n"
    },
    {
      "category": "dashboard",
      "created_at": "2026-10-19T00:00:00.000Z",
      "description": "Analytics dashboard with charts, tables, metrics, filters, and reports",
      "id": "tpl-dashboard",
      "name": "Dashboard",
      "platform": "web",
      "prd_content": "# PRD - Analytics Dashboard\n\n## 1. Project Overview\nBuild a data dashboard with metric cards, charts, tables, filters, reports, and real-time activity visibility.\n\n**Tech Stack:** React + TypeScript + Tailwind CSS + Recharts\n**Default Theme:** Dark\n\n## 2. Design System\n- Background: #09090B, Card: #18181B, Elevated: #27272A\n- Text: #FAFAFA primary, #A1A1AA secondary, #71717A muted\n- Primary: #3B82F6, Success: #22C55E, Warning: #EAB308, Error: #EF4444\n- Chart palette: #3B82F6, #22C55E, #EAB308, #A855F7, #EC4899, #06B6D4\n- Fonts: Inter for UI, JetBrains Mono for dense tables\n- Motion: 800ms chart draw, 1.5s counter animation, 200ms card hover\n\n## 3. Pages\n1. **Dashboard** (/) - Date controls, metric cards, charts, latest activity\n2. **Analytics** (/analytics) - Detailed charts and comparisons\n3. **Users** (/users) - User table, filters, detail sheet\n4. **Reports** (/reports) - Report list and report builder\n5. **Settings** (/settings) - Profile, notifications, integrations, theme\n\n## 4. Page Requirements\n- Dashboard: date range picker, refresh button, four KPI cards, area chart, bar chart, pie chart, transactions table, live activity.\n- Analytics: multi-series line chart, stacked bar chart, category/country/date filters, comparison overlay.\n- Users: searchable table with avatar, email, status, last activity, detail sheet.\n- Reports: report card grid, create-report form with type/date/format fields.\n- Settings: tabbed forms and switches.\n\n## 5. Data Model\n- Metric: key, value, change, changePercent, period\n- ChartData: timestamp, values\n- User: id, name, email, avatar, status, createdAt, lastActive\n- Transaction: id, userId, type, amount, status, createdAt\n- Report: id, title, type, dateRange, format, url, createdAt\n"
    },
    {
      "category": "docs",
      "created_at": "2026-10-19T00:00:00.000Z",
      "description": "Documentation site with sidebar navigation, Markdown rendering, and search",
      "id": "tpl-docs",
      "name": "Documentation",
      "platform": "web",
      "prd_content": "# PRD - Documentation Site\n\n## 1. Project Overview\nBuild a technical documentation site with sidebar navigation, Markdown rendering, search, code blocks, callouts, and table of contents.\n\n**Tech Stack:** React + TypeScript + Tailwind CSS\n\n## 2. Design System\n- Background: #FFFFFF light, #0F1117 dark\n- Sidebar: #F6F6F7 light, #1A1A24 dark\n- Code background: #F6F8FA light, #161B22 dark\n- Primary: #2563EB, Border: #E5E7EB light, #30363D dark\n- Text: #1F2328 light, #E6EDF3 dark\n- Fonts: Inter for UI, Fira Code or JetBrains Mono for code\n- Motion: 200ms sidebar expand, 200ms command dialog scale + opacity\n\n## 3. Pages\n1. **Docs Home** (/) - Intro, quick starts, popular docs\n2. **Guide** (/docs/:slug) - Markdown content with TOC\n3. **Search** (/search) - Command palette results\n4. **Changelog** (/changelog) - Release notes\n\n## 4. Page Requirements\n- Sidebar: logo, search trigger, nav groups, active state, collapsible groups, theme toggle, version badge.\n- Content: breadcrumb, title, markdown body, headings, lists, tables, images, code blocks with copy button.\n- Callouts: note, warning, tip, danger with colored left border and icon.\n- Right TOC: sticky heading list with active scroll-spy.\n- Search: keyboard shortcut, input, result list, highlighted matches, arrow-key navigation.\n- Footer nav: previous/next links, edit-on-GitHub link, last updated date.\n\n## 5. Data Model\n- Page: id, slug, title, content, section, order, updatedAt\n- NavSection: id, title, pages\n- SearchResult: pageId, title, excerpt, url\n"
    },
    {
      "category": "ecommerce",
      "created_at": "2026-10-19T00:00:00.000Z",
      "description": "Full e-commerce site with product discovery, cart, checkout, and account flows",
      "id": "tpl-ecommerce",
      "name": "E-Commerce",
      "platform": "web",
      "prd_content": "# PRD - E-Commerce Platform\n\n## 1. Project Overview\nBuild a modern responsive commerce experience with product discovery, filtering, cart management, checkout, account history, and order tracking.\n\n**Tech Stack:** React + TypeScript + Tailwind CSS + shadcn/ui\n**Goal:** Fast, accessible, SEO-friendly, mobile-first shopping flow.\n\n## 2. Design System\n- Primary: #2563EB, Secondary: #7C3AED, Accent: #F59E0B\n- Background: #FFFFFF light, #0F172A dark\n- Text: #1E293B light, #F8FAFC dark\n- Destructive: #EF4444, Border: #E2E8F0, Muted: #F1F5F9\n- Fonts: Inter for UI, JetBrains Mono for code/order identifiers\n- Spacing: 4px base grid, 16px mobile page padding, 32px desktop page padding\n- Motion: 200ms hover feedback, 300ms page fade, 200ms modal opacity + translateY\n\n## 3. Pages\n1. **Home** (/) - Hero, category grid, featured products, campaign banner, footer\n2. **Products** (/products) - Filters, sorting, product grid, pagination\n3. **Product Detail** (/products/:id) - Gallery, variant selection, stock, tabs, related products\n4. **Cart** (/cart) - Item list, quantity controls, order summary, empty state\n5. **Checkout** (/checkout) - Address, payment, review, submit order\n6. **Account** (/account) - Orders, addresses, favorites, settings\n\n## 4. Page Requirements\n- Home: full-width product hero with primary CTA, 4-column desktop category grid, horizontal featured carousel, campaign banner, footer link groups.\n- Products: sidebar filters for price, category, brand, color, and size; responsive grid; favorite and add-to-cart controls.\n- Product Detail: image gallery with thumbnails, zoom interaction, price display, variant controls, quantity stepper, add-to-cart animation.\n- Cart: editable quantities, remove actions, subtotal, shipping, total, checkout CTA, empty-state recovery CTA.\n- Checkout: 3-step progress indicator, validated form fields, masked card input, sticky desktop summary, mobile accordion summary.\n- Account: tabbed order/address/favorites/settings sections with order detail dialog.\n\n## 5. Data Model\n- Product: id, title, slug, description, price, salePrice, images, category, brand, variants, stock, rating\n- Cart: items, total, itemCount\n- Order: id, items, address, payment, status, total, createdAt\n- User: id, name, email, phone, addresses, orders\n\n## 6. API\n- GET /api/products\n- GET /api/products/:id\n- GET /api/categories\n- POST /api/cart/add\n- PATCH /api/cart/update\n- DELETE /api/cart/remove/:itemId\n- POST /api/orders\n- GET /api/orders/:id\n"
    },
    {
      "category": "game",
      "created_at": "2026-10-19T00:00:00.000Z",
      "description": "Canvas/WebGL game with menu, gameplay screen, settings, and score state",
      "id": "tpl-game",
      "name": "Game",
      "platform": "web",
      "prd_content": "# PRD - Web Game\n\n## 1. Project Overview\nBuild a browser-based 2D arcade/casual game with menu, gameplay, pause, game over, leaderboard, settings, and persistent high scores.\n\n**Tech Stack:** React + TypeScript + HTML5 Canvas\n**Genre:** 2D arcade/casual\n\n## 2. Design System\n- Background: #0A0A0A, Game area: #1A1A2E\n- Primary: #E94560, Secondary: #0F3460, Accent: #16C79A\n- Text: #EAEAEA, Score: #FFD700\n- Fonts: Press Start 2P for arcade UI or Rajdhani for readable HUD\n- Motion: 3s menu title float, 200ms button glow, 500ms game-over shake, particle effects\n\n## 3. Screens\n1. **Main Menu** (/) - Logo, play, leaderboard, settings\n2. **Game** (/play) - Canvas, HUD, controls, pause\n3. **Pause** (/pause) - Overlay with resume, restart, main menu\n4. **Game Over** (/game-over) - Final score, high score, replay, main menu\n5. **Leaderboard** (/leaderboard) - Stored scores\n6. **Settings** (/settings) - Audio, difficulty, controls\n\n## 4. Gameplay Requirements\n- Canvas target: 60fps requestAnimationFrame loop.\n- Controls: keyboard arrows/WASD plus mobile touch controls.\n- State: menu, playing, paused, gameover.\n- Entities: player, enemies, projectiles, particles, pickups.\n- Collision: AABB or circle-circle with deterministic rules.\n- Score: points, combo multiplier, bonus pickups.\n- Persistence: localStorage high scores and settings.\n\n## 5. Data Model\n- GameState: score, lives, level, entities, timestamp\n- HighScore: name, score, date\n- Settings: volume, musicOn, difficulty\n"
    },
    {
      "category": "mobile",
      "created_at": "2026-10-19T00:00:00.000Z",
      "description": "React Native mobile app with tab navigation, lists, details, and profile",
      "id": "tpl-mobile",
      "name": "Mobile App",
      "platform": "mobile",
      "prd_content": "# PRD - Mobile Application\n\n## 1. Project Overview\nBuild a React Native + Expo mobile app with tab navigation, searchable lists, detail screens, notifications, profile, and settings.\n\n**Tech Stack:** React Native + Expo + TypeScript + NativeWind\n**Platform:** iOS + Android\n\n## 2. Design System\n- Background: #FFFFFF light, #000000 dark\n- Card: #F2F2F7 light, #1C1C1E dark\n- Primary: #007AFF, Destructive: #FF3B30, Success: #34C759\n- Text: #000000 light, #FFFFFF dark, Secondary text: #8E8E93\n- Fonts: SF Pro on iOS, Roboto on Android\n- Motion: 350ms slide transitions, 200ms tab cross-fade, 100ms press feedback\n\n## 3. Screens\n1. **Home** (/) - Header, carousel, feed list, pull-to-refresh\n2. **Explore** (/explore) - Search, category chips, result list\n3. **Detail** (/detail/:id) - Image, content, fixed CTA\n4. **Notifications** (/notifications) - Grouped notification list\n5. **Profile** (/profile) - Avatar, bio, stats, menu\n6. **Settings** (/settings) - Switches, selects, destructive account action\n\n## 4. Screen Requirements\n- Bottom tabs: Home, Explore, Notifications, Profile with active/inactive colors.\n- Home: title, notification icon, horizontal carousel, vertical item cards.\n- Explore: sticky search bar, horizontal category filter chips, FlatList results.\n- Detail: top image, back overlay, title, metadata, body, safe-area CTA bar.\n- Notifications: sectioned groups, unread state, time labels.\n- Profile: avatar, name, bio, stats row, grouped menu list.\n- Settings: grouped list with switch/select/button items.\n\n## 5. Data Model\n- Item: id, title, subtitle, image, category, content, createdAt\n- Notification: id, type, title, message, read, createdAt\n- User: id, name, avatar, bio, stats\n"
    },
    {
      "category": "portfolio",
      "created_at": "2026-10-19T00:00:00.000Z",
      "description": "Personal portfolio with projects, about, experience, and contact sections",
      "id": "tpl-portfolio",
      "name": "Portfolio",
      "platform": "web",
      "prd_content": "# PRD - Portfolio Site\n\n## 1. Project Overview\nBuild a polished personal portfolio that presents identity, work, skills, experience, and contact paths in a single-page or light multi-page experience.\n\n**Tech Stack:** React + TypeScript + Tailwind CSS\n**Goal:** Minimal, memorable, fast, accessible, and responsive.\n\n## 2. Design System\n- Background: #FAFAFA light, #09090B dark\n- Foreground: #09090B light, #FAFAFA dark\n- Accent: #6366F1, Muted: #F4F4F5 light, #27272A dark\n- Fonts: Space Grotesk for headings, Inter for body\n- Motion: 600ms scroll reveal, 200ms card hover, staggered page load\n\n## 3. Pages\n1. **Home** (/) - Hero, about, projects, experience, contact, footer\n2. **Projects** (/projects) - Filterable project gallery and project details\n3. **About** (/about) - Profile, skills, experience, values\n4. **Contact** (/contact) - Contact form and social links\n\n## 4. Page Requirements\n- Hero: first viewport identity statement, role, short positioning copy, project/contact CTAs, subtle interactive background.\n- About: profile image, bio, skills grouped by category, progress or proficiency indicators.\n- Projects: responsive cards with screenshot, title, description, tags, GitHub and live demo links; detail modal with gallery.\n- Experience: vertical timeline with date, company, role, and impact bullets.\n- Contact: name, email, subject, message, submit state, GitHub/LinkedIn/email links.\n\n## 5. Data Model\n- Project: id, title, description, image, tags, githubUrl, liveUrl, category\n- Skill: name, level, category\n- Experience: company, role, startDate, endDate, description\n- ContactForm: name, email, subject, message\n"
    },
    {
      "category": "saas",
      "created_at": "2026-10-19T00:00:00.000Z",
      "description": "SaaS landing page with hero, features, pricing, testimonials, and CTA",
      "id": "tpl-saas",
      "name": "SaaS Landing",
      "platform": "web",
      "prd_content": "# PRD - SaaS Landing Page\n\n## 1. Project Overview\nBuild a conversion-focused SaaS landing page with product positioning, feature proof, pricing, testimonials, FAQ, and a clear acquisition funnel.\n\n**Tech Stack:** React + TypeScript + Tailwind CSS\n**Goal:** High-conversion, fast, accessible, analytics-ready marketing site.\n\n## 2. Design System\n- Primary: #6366F1, Primary hover: #4F46E5\n- Background: #FFFFFF, Alternate section: #F8FAFC, Dark section: #0F172A\n- Text: #0F172A heading, #475569 body, #94A3B8 muted\n- Success: #10B981, Warning: #F59E0B, Error: #EF4444\n- Fonts: Cal Sans or Inter for headings, Inter for body\n- Motion: 500ms scroll reveal, button glow, 2s counter animation\n\n## 3. Pages\n1. **Home** (/) - Sticky nav, hero, logos, features, pricing, testimonials, FAQ, CTA, footer\n2. **Pricing** (/pricing) - Plan comparison and billing toggle\n3. **Docs Preview** (/docs) - Product education preview and onboarding CTA\n4. **Contact Sales** (/contact) - Lead form and qualification fields\n\n## 4. Page Requirements\n- Navbar: logo, nav links, login, primary CTA, mobile sheet.\n- Hero: clear headline, benefit copy, primary CTA, secondary demo CTA, product screenshot.\n- Features: 3-column card grid and alternating detailed feature sections.\n- Pricing: monthly/yearly toggle, three plan cards, popular plan highlight, feature comparison.\n- Testimonials: carousel cards with quote, name, role, company, avatar.\n- FAQ: accordion with 6-8 objections handled.\n- CTA Banner: full-width conversion section with strong copy and CTA.\n\n## 5. Data Model\n- Plan: id, name, price, yearlyPrice, features, cta, popular\n- Feature: id, title, description, icon\n- Testimonial: id, text, author, role, company, avatar\n- FAQ: id, question, answer\n"
    }
  ]
});
const GRANTS = freeze({
  "additionalColumnGrants": [],
  "applicationRoutineGrants": [],
  "database": "setfarm_p3_222222222222222222222222_clone_333333333333",
  "databaseGrants": [
    {
      "name": "setfarm_p3_222222222222222222222222_clone_333333333333",
      "privilege": "CONNECT"
    }
  ],
  "memberships": [],
  "ownedDataObjects": [],
  "relationGrants": [
    {
      "kind": "r",
      "name": "accepted_candidates",
      "privilege": "SELECT",
      "schema": "public"
    },
    {
      "kind": "r",
      "name": "agent_feed",
      "privilege": "SELECT",
      "schema": "public"
    },
    {
      "kind": "r",
      "name": "claim_log",
      "privilege": "SELECT",
      "schema": "public"
    },
    {
      "kind": "r",
      "name": "execution_attempts",
      "privilege": "SELECT",
      "schema": "public"
    },
    {
      "kind": "r",
      "name": "internal_production_owner_producer_manifest_activation_heads_v1",
      "privilege": "SELECT",
      "schema": "public"
    },
    {
      "kind": "r",
      "name": "internal_production_owner_producer_manifest_set_activations_v1",
      "privilege": "SELECT",
      "schema": "public"
    },
    {
      "kind": "r",
      "name": "internal_production_owner_producer_manifest_set_current_v1",
      "privilege": "SELECT",
      "schema": "public"
    },
    {
      "kind": "r",
      "name": "live_events",
      "privilege": "SELECT",
      "schema": "public"
    },
    {
      "kind": "r",
      "name": "operational_event_deliveries",
      "privilege": "SELECT",
      "schema": "public"
    },
    {
      "kind": "r",
      "name": "operational_events",
      "privilege": "SELECT",
      "schema": "public"
    },
    {
      "kind": "r",
      "name": "operational_outbox",
      "privilege": "SELECT",
      "schema": "public"
    },
    {
      "kind": "r",
      "name": "prd_templates",
      "privilege": "SELECT",
      "schema": "public"
    },
    {
      "kind": "r",
      "name": "prds",
      "privilege": "SELECT",
      "schema": "public"
    },
    {
      "kind": "r",
      "name": "product_packets",
      "privilege": "SELECT",
      "schema": "public"
    },
    {
      "kind": "r",
      "name": "run_observations",
      "privilege": "SELECT",
      "schema": "public"
    },
    {
      "kind": "r",
      "name": "runs",
      "privilege": "SELECT",
      "schema": "public"
    },
    {
      "kind": "r",
      "name": "runtime_sessions",
      "privilege": "SELECT",
      "schema": "public"
    },
    {
      "kind": "r",
      "name": "steps",
      "privilege": "SELECT",
      "schema": "public"
    },
    {
      "kind": "r",
      "name": "stories",
      "privilege": "SELECT",
      "schema": "public"
    },
    {
      "kind": "r",
      "name": "tasks",
      "privilege": "SELECT",
      "schema": "public"
    },
    {
      "kind": "r",
      "name": "v3_canary_admission_claims",
      "privilege": "SELECT",
      "schema": "public"
    },
    {
      "kind": "r",
      "name": "v3_deploy_receipts",
      "privilege": "SELECT",
      "schema": "public"
    },
    {
      "kind": "r",
      "name": "v3_project_transfer_acks",
      "privilege": "SELECT",
      "schema": "public"
    },
    {
      "kind": "r",
      "name": "v3_release_admissions",
      "privilege": "SELECT",
      "schema": "public"
    }
  ],
  "role": {
    "bypassRls": false,
    "canLogin": true,
    "createDatabase": false,
    "createRole": false,
    "currentUser": "mc_task4_0123456789abcdef0123456789abcdef",
    "inherit": false,
    "name": "mc_task4_0123456789abcdef0123456789abcdef",
    "replication": false,
    "sessionUser": "mc_task4_0123456789abcdef0123456789abcdef",
    "superuser": false
  },
  "schema": "mission-control.task4-effective-data-read-grants.v1",
  "schemaGrants": [
    {
      "name": "public",
      "privilege": "USAGE"
    }
  ],
  "sequenceGrants": [],
  "settings": {
    "defaultTransactionReadOnly": "on",
    "loCompatPrivileges": false,
    "recovery": false
  }
});

export function task4SeedV1(sourceSha) {
    if (!/^[a-f0-9]{40}$/.test(sourceSha)) throw new Error('TASK4_SHAPE_INVALID');
    const seed = structuredClone(SEED);
    seed.sourceSha = sourceSha;
    const authority = seed.productResponse.packetAuthority;
    authority.producer.codeSha = sourceSha;
    const artifact = payload => digest({ schema: 'setfarm.semantic-artifact-envelope.v1', artifactType: payload.schema, producer: authority.producer, payload });
    const hashes = {};
    for (const key of ['productSpec', 'designGraph', 'buildTopology', 'storyPlan']) hashes[key] = artifact(authority[key]);
    authority.packet.compiler.codeSha = sourceSha;
    for (const key of Object.keys(hashes)) authority.packet[key + 'Hash'] = hashes[key];
    authority.packetHash = artifact(authority.packet);
    authority.compilationReport.compiler.codeSha = sourceSha;
    authority.compilationReport.packetHash = authority.packetHash;
    authority.compilationReport.artifactHashes = hashes;
    authority.refs = { ...hashes, packet: authority.packetHash, compilationReport: artifact(authority.compilationReport) };
    delete authority.authorityHash;
    authority.authorityHash = digest(authority);
    delete seed.productResponse.authorityHash;
    seed.productResponse.authorityHash = digest(seed.productResponse);
    const suiteHash = digest({ fixture: 'v3-release-admission', releaseSha: sourceSha });
    const resultHash = digest({ fixture: 'v3-release-result', releaseSha: sourceSha });
    const gateHash = digest({ fixture: 'v3-release-gate', releaseSha: sourceSha, resultHash });
    const preflightHash = digest({ fixture: 'v3-release-preflight', releaseSha: sourceSha });
    const ref = hash => `sha256/${hash.slice(0, 2)}/${hash}.json`;
    const payload = { schema: 'setfarm.v3-release-admission.v1', kind: 'release_go', releaseSha: sourceSha, suiteHash,
        result: { hash: resultHash, ref: ref(resultHash) }, gate: { hash: gateHash, ref: ref(gateHash) }, preflightHash,
        slots: [], issuedAt: '2026-07-13T00:00:00.000Z', expiresAt: null };
    payload.admissionHash = digest(payload);
    seed.releaseAdmissions = [{ admission_hash: payload.admissionHash, kind: payload.kind, release_sha: sourceSha,
        suite_hash: suiteHash, result_hash: resultHash, result_ref: ref(resultHash), gate_hash: gateHash, gate_ref: ref(gateHash),
        payload, created_at: payload.issuedAt, expires_at: null }];
    Object.assign(seed.runs[1], { compiler_release_sha: sourceSha, packet_hash: authority.packetHash,
        activation_preflight_hash: preflightHash, release_admission_hash: payload.admissionHash });
    return freeze(seed);
}
export function task4GrantsV1(database, role) {
    if (typeof database !== 'string' || !/^setfarm_p3_[a-f0-9]{24}_clone_[a-f0-9]{12}$/.test(database)
        || typeof role !== 'string' || !/^mc_task4_[a-f0-9]{32}$/.test(role)) throw new Error('TASK4_SHAPE_INVALID');
    const grants = structuredClone(GRANTS);
    grants.database = database;
    grants.databaseGrants[0].name = database;
    grants.role.name = role; grants.role.currentUser = role; grants.role.sessionUser = role;
    return freeze(grants);
}

// Fixed inert operational projections of the same two seeded rows. These do not
// assert complete lifecycle capability, runtime ownership, or operator authority.
export function task4OperationalSnapshotV1(sourceSha, runId) {
    const run = task4SeedV1(sourceSha).runs.find(row => row.id === runId);
    if (!run) throw new Error('TASK4_BINDING_REFUSED');
    const snapshot = {
        schema: 'setfarm.run-operational-snapshot.v1', generatedAt: '2026-10-19T00:00:00.000Z',
        source: { database: 'postgres', projection: 'partial', migrationVersions: [], verifiedReleaseSha: null,
            capabilities: { attempts: false, claimBinding: false, runtimeOwnership: false, managerCompletion: false, effectLedger: false,
                findingRecovery: false, evidenceLedger: false, acceptedCandidate: false, deploymentReceipt: false, projectTransferAck: false } },
        run: { ref: 'setfarm://run/' + run.id, id: run.id, runNumber: run.run_number, protocol: run.protocol,
            status: run.status, terminal: false, updatedAt: run.updated_at },
        summary: { lifecycleState: run.protocol === 'legacy' ? 'legacy_untracked' : 'idle', health: 'attention', activeClaims: 0,
            activeAttempts: 0, activeRuntimes: 0, openCompletions: 0, mandatoryEffectsPending: 0, unpublishedOutbox: 0, invariantViolations: 0,
            operatorActions: {
                stop: { allowed: false, reasonCode: 'FIXTURE_READ_ONLY', stateHash: digest({ fixture: 'task4-read-only', runId: run.id, action: 'stop' }) },
                resume: { allowed: false, reasonCode: 'FIXTURE_READ_ONLY', stateHash: digest({ fixture: 'task4-read-only', runId: run.id, action: 'resume' }) },
            } },
        claims: [], attempts: [], runtimeSessions: [], completionRequests: [], terminationRequests: [], outbox: [], invariants: [],
    };
    const { generatedAt: ignored, ...state } = snapshot;
    return freeze({ ...snapshot, snapshotHash: digest(state) });
}
// Fixed buildRunOperationalModel output for an inert feature-dev run, empty
// steps/stories/observations, and its Source default Vite stack inference.
export function task4OperationalModelV1(sourceSha, runId) {
    const run = task4SeedV1(sourceSha).runs.find(row => row.id === runId);
    if (!run) throw new Error('TASK4_BINDING_REFUSED');
    return freeze({ schema: 'setfarm.run-operational-model.v1', run: {
        id: run.id, runNumber: run.run_number, workflow: run.workflow_id, status: run.status, terminal: false, task: run.task, updatedAt: run.updated_at },
        stack: { stackPackId: 'vite-react-web-app', label: 'Vite React Web App', runtimeKind: 'browser', systemSmokeRunner: 'setfarm-smoke-test',
            shouldAllocateRuntime: true, evidenceClasses: ['build', 'test', 'smoke', 'dom', 'visual'], confidence: 'low', evidence: ['default web stack fallback'] },
        pipeline: { currentStepId: null, currentStoryId: null, failedStepId: null, stepsTotal: 0, stepsDone: 0 },
        stories: { total: 0, verified: 0, doneAwaitingVerify: 0, failed: 0, skipped: 0, running: 0, pending: 0, completed: 0 },
        failure: { present: false, owner: 'none', action: 'none', category: 'none', reason: '', retryable: false, recoveryPolicy: 'no_action',
            postMergeQualityRegression: false, mergedPrQualityFailure: false, sourceStepId: null, sourceStoryId: null, summary: '' },
        evidence: { latestSummary: null, latestStatus: null, observationCount: 0 } });
}
