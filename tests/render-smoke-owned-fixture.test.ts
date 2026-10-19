import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
const hash = (value: string | Uint8Array) => createHash('sha256').update(value).digest('hex');
const load = () => import('../scripts/render-smoke-owned-fixture.mjs');
const GOLDEN_LAUNCH = "{\"missionControl\":{\"buildHash\":\"7777777777777777777777777777777777777777777777777777777777777777\",\"buildIdentityHash\":\"6666666666666666666666666666666666666666666666666666666666666666\",\"harness\":{\"ownedFixtureHash\":\"9999999999999999999999999999999999999999999999999999999999999999\",\"productAuthorityFixtureHash\":\"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa\",\"renderSmokeHash\":\"8888888888888888888888888888888888888888888888888888888888888888\"},\"root\":\"/fixture/mc\",\"sourceSha\":\"4444444444444444444444444444444444444444\",\"treeHash\":\"5555555555555555555555555555555555555555\"},\"schema\":\"mission-control.render-smoke-launch.v1\",\"setfarm\":{\"inputManifestHash\":\"3333333333333333333333333333333333333333333333333333333333333333\",\"root\":\"/fixture/sf\",\"sourceSha\":\"1111111111111111111111111111111111111111\",\"treeHash\":\"2222222222222222222222222222222222222222\"}}";
const GOLDEN_SETUP = "{\"executionId\":\"0123456789abcdef0123456789abcdef\",\"missionControl\":{\"rootPin\":{\"dev\":\"1\",\"ino\":\"102\",\"mode\":493,\"path\":\"/fixture/mc\",\"uid\":501},\"source\":{\"buildHash\":\"7777777777777777777777777777777777777777777777777777777777777777\",\"buildIdentityHash\":\"6666666666666666666666666666666666666666666666666666666666666666\",\"harness\":{\"ownedFixtureHash\":\"9999999999999999999999999999999999999999999999999999999999999999\",\"productAuthorityFixtureHash\":\"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa\",\"renderSmokeHash\":\"8888888888888888888888888888888888888888888888888888888888888888\"},\"root\":\"/fixture/mc\",\"sourceSha\":\"4444444444444444444444444444444444444444\",\"treeHash\":\"5555555555555555555555555555555555555555\"}},\"owner\":{\"commandHash\":\"cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc\",\"executable\":\"/fixture/node\",\"executableHash\":\"bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb\",\"pgid\":41001,\"pid\":41001,\"ppid\":41000,\"startedAt\":\"2026-10-19T09:00:00.000Z\",\"uid\":501},\"postgres\":{\"adminUrlHash\":\"1111111111111111111111111111111111111111111111111111111111111111\",\"data\":{\"dev\":\"1\",\"ino\":\"103\",\"mode\":448,\"path\":\"/fixture/task4-0123456789abcdef0123456789abcdef/postgres-data\",\"uid\":501},\"host\":\"127.0.0.1\",\"major\":17,\"port\":15432,\"process\":{\"commandHash\":\"dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd\",\"executable\":\"/Users/setrox/ai/setrox/.task4-toolchain-v1/Cellar/postgresql@17/17.10/bin/postgres\",\"executableHash\":\"38c50336c63ae8b73b799a8c0ebc4f948e311eee882a633c8286d1ca4110b502\",\"pgid\":41002,\"pid\":41002,\"ppid\":41001,\"startedAt\":\"2026-10-19T09:00:00.000Z\",\"uid\":501},\"serverStartedAt\":\"2026-10-19T09:00:01.000000Z\",\"socket\":{\"dev\":\"1\",\"ino\":\"104\",\"mode\":448,\"path\":\"/fixture/task4-0123456789abcdef0123456789abcdef/postgres-socket\",\"uid\":501},\"versionNum\":170010},\"resourceRoot\":{\"dev\":\"1\",\"ino\":\"100\",\"mode\":448,\"path\":\"/fixture/task4-0123456789abcdef0123456789abcdef\",\"uid\":501},\"schema\":\"setfarm.mc-render-smoke-setup.v1\",\"setfarm\":{\"fixtureHash\":\"ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff\",\"migrationHash\":\"0000000000000000000000000000000000000000000000000000000000000000\",\"rootPin\":{\"dev\":\"1\",\"ino\":\"101\",\"mode\":493,\"path\":\"/fixture/sf\",\"uid\":501},\"runnerHash\":\"eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee\",\"source\":{\"inputManifestHash\":\"3333333333333333333333333333333333333333333333333333333333333333\",\"root\":\"/fixture/sf\",\"sourceSha\":\"1111111111111111111111111111111111111111\",\"treeHash\":\"2222222222222222222222222222222222222222\"}}}";
const GOLDEN_READY = "{\"database\":{\"name\":\"setfarm_p3_222222222222222222222222_clone_333333333333\",\"restrictedUrl\":\"postgres://mc_task4_0123456789abcdef0123456789abcdef:vector-only@127.0.0.1:15432/setfarm_p3_222222222222222222222222_clone_333333333333\",\"restrictedUrlHash\":\"76c9fb63956e114750941817da5948e1ebb4cac206892bf7ef3ff02c95db23b4\",\"role\":\"mc_task4_0123456789abcdef0123456789abcdef\"},\"executionId\":\"0123456789abcdef0123456789abcdef\",\"fixture\":{\"admissionReadyHash\":\"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa\",\"manifestActivationHash\":\"bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb\",\"manifestHeadHash\":\"cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc\",\"privilegeDigest\":\"8888888888888888888888888888888888888888888888888888888888888888\",\"readinessDigest\":\"9999999999999999999999999999999999999999999999999999999999999999\",\"seedDigest\":\"7777777777777777777777777777777777777777777777777777777777777777\"},\"fixtureOwner\":{\"commandHash\":\"4444444444444444444444444444444444444444444444444444444444444444\",\"executable\":\"/fixture/node\",\"executableHash\":\"bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb\",\"pgid\":41004,\"pid\":41005,\"ppid\":41004,\"startedAt\":\"2026-10-19T09:00:00.000Z\",\"uid\":501},\"projection\":{\"inputManifestHash\":\"3333333333333333333333333333333333333333333333333333333333333333\",\"markerHash\":\"6666666666666666666666666666666666666666666666666666666666666666\",\"projectedHead\":\"6666666666666666666666666666666666666666\",\"projectedManifestHash\":\"5555555555555555555555555555555555555555555555555555555555555555\",\"root\":{\"dev\":\"1\",\"ino\":\"105\",\"mode\":448,\"path\":\"/fixture/task4-0123456789abcdef0123456789abcdef/tmp/setfarm-p3-projection-vector/setfarm\",\"uid\":501},\"runDatabasePrefix\":\"setfarm_p3_222222222222222222222222\"},\"schema\":\"mission-control.render-smoke-fixture-ready.v1\",\"setup\":{\"executionId\":\"0123456789abcdef0123456789abcdef\",\"missionControl\":{\"rootPin\":{\"dev\":\"1\",\"ino\":\"102\",\"mode\":493,\"path\":\"/fixture/mc\",\"uid\":501},\"source\":{\"buildHash\":\"7777777777777777777777777777777777777777777777777777777777777777\",\"buildIdentityHash\":\"6666666666666666666666666666666666666666666666666666666666666666\",\"harness\":{\"ownedFixtureHash\":\"9999999999999999999999999999999999999999999999999999999999999999\",\"productAuthorityFixtureHash\":\"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa\",\"renderSmokeHash\":\"8888888888888888888888888888888888888888888888888888888888888888\"},\"root\":\"/fixture/mc\",\"sourceSha\":\"4444444444444444444444444444444444444444\",\"treeHash\":\"5555555555555555555555555555555555555555\"}},\"owner\":{\"commandHash\":\"cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc\",\"executable\":\"/fixture/node\",\"executableHash\":\"bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb\",\"pgid\":41001,\"pid\":41001,\"ppid\":41000,\"startedAt\":\"2026-10-19T09:00:00.000Z\",\"uid\":501},\"postgres\":{\"adminUrlHash\":\"1111111111111111111111111111111111111111111111111111111111111111\",\"data\":{\"dev\":\"1\",\"ino\":\"103\",\"mode\":448,\"path\":\"/fixture/task4-0123456789abcdef0123456789abcdef/postgres-data\",\"uid\":501},\"host\":\"127.0.0.1\",\"major\":17,\"port\":15432,\"process\":{\"commandHash\":\"dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd\",\"executable\":\"/Users/setrox/ai/setrox/.task4-toolchain-v1/Cellar/postgresql@17/17.10/bin/postgres\",\"executableHash\":\"38c50336c63ae8b73b799a8c0ebc4f948e311eee882a633c8286d1ca4110b502\",\"pgid\":41002,\"pid\":41002,\"ppid\":41001,\"startedAt\":\"2026-10-19T09:00:00.000Z\",\"uid\":501},\"serverStartedAt\":\"2026-10-19T09:00:01.000000Z\",\"socket\":{\"dev\":\"1\",\"ino\":\"104\",\"mode\":448,\"path\":\"/fixture/task4-0123456789abcdef0123456789abcdef/postgres-socket\",\"uid\":501},\"versionNum\":170010},\"resourceRoot\":{\"dev\":\"1\",\"ino\":\"100\",\"mode\":448,\"path\":\"/fixture/task4-0123456789abcdef0123456789abcdef\",\"uid\":501},\"schema\":\"setfarm.mc-render-smoke-setup.v1\",\"setfarm\":{\"fixtureHash\":\"ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff\",\"migrationHash\":\"0000000000000000000000000000000000000000000000000000000000000000\",\"rootPin\":{\"dev\":\"1\",\"ino\":\"101\",\"mode\":493,\"path\":\"/fixture/sf\",\"uid\":501},\"runnerHash\":\"eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee\",\"source\":{\"inputManifestHash\":\"3333333333333333333333333333333333333333333333333333333333333333\",\"root\":\"/fixture/sf\",\"sourceSha\":\"1111111111111111111111111111111111111111\",\"treeHash\":\"2222222222222222222222222222222222222222\"}}},\"setupDescriptorHash\":\"0514fad6df757332d6e7ef2e14cd3a428a01af15a8f804203f8306b27d612fcd\"}";
const GOLDEN_SEED = "{\"emptyRelations\":[{\"name\":\"accepted_candidates\",\"rows\":[],\"schema\":\"public\"},{\"name\":\"agent_feed\",\"rows\":[],\"schema\":\"public\"},{\"name\":\"claim_log\",\"rows\":[],\"schema\":\"public\"},{\"name\":\"execution_attempts\",\"rows\":[],\"schema\":\"public\"},{\"name\":\"live_events\",\"rows\":[],\"schema\":\"public\"},{\"name\":\"operational_event_deliveries\",\"rows\":[],\"schema\":\"public\"},{\"name\":\"operational_events\",\"rows\":[],\"schema\":\"public\"},{\"name\":\"operational_outbox\",\"rows\":[],\"schema\":\"public\"},{\"name\":\"prds\",\"rows\":[],\"schema\":\"public\"},{\"name\":\"product_packets\",\"rows\":[],\"schema\":\"public\"},{\"name\":\"run_observations\",\"rows\":[],\"schema\":\"public\"},{\"name\":\"runtime_sessions\",\"rows\":[],\"schema\":\"public\"},{\"name\":\"steps\",\"rows\":[],\"schema\":\"public\"},{\"name\":\"stories\",\"rows\":[],\"schema\":\"public\"},{\"name\":\"tasks\",\"rows\":[],\"schema\":\"public\"},{\"name\":\"v3_canary_admission_claims\",\"rows\":[],\"schema\":\"public\"},{\"name\":\"v3_deploy_receipts\",\"rows\":[],\"schema\":\"public\"},{\"name\":\"v3_project_transfer_acks\",\"rows\":[],\"schema\":\"public\"}],\"productResponse\":{\"authorityHash\":\"3d2c672d27bf99e31965342861be16e1f753a76295c97cd5b12ebc192ea16307\",\"disposition\":\"sealed_packet\",\"packetAuthority\":{\"authorityHash\":\"bb8f13479bfe66e147f4a61d38f0001031e728c932be039c28739d04417890df\",\"buildTopology\":{\"schema\":\"setfarm.build-topology.v1\"},\"compilationReport\":{\"artifactHashes\":{\"buildTopology\":\"ecea5f9291d61028208e5e43e1ae345fce8ab97485ce4203da4cc0b1224fabbe\",\"designGraph\":\"55506752be34099840567d0d00188621adbf7ff9bdfa1f8170fe66cfbe4f6f15\",\"productSpec\":\"01351d873c4cf75cdc148d9454db372c8b877ae9932918097f8083e70d8a6325\",\"storyPlan\":\"fafc4c6e6a46b3a10370fa50e54624f46989974fedb446e6ab13017bff7ccfc1\"},\"compiler\":{\"codeSha\":\"1111111111111111111111111111111111111111\",\"version\":\"3.5.0\"},\"diagnostics\":[],\"inputHashes\":[\"0000000000000000000000000000000000000000000000000000000000000008\"],\"packetHash\":\"9530fba29e2f1aba456ba213e0a856e030465956cb430f2245c63f7fdc03def2\",\"schema\":\"setfarm.product-compilation-report.v1\",\"status\":\"sealed\",\"validationIds\":[\"VALIDATE_PACKET\"]},\"designGraph\":{\"bindings\":[],\"controls\":[],\"schema\":\"setfarm.design-interaction-graph.v1\",\"surfaces\":[]},\"packet\":{\"buildTopologyHash\":\"ecea5f9291d61028208e5e43e1ae345fce8ab97485ce4203da4cc0b1224fabbe\",\"compiler\":{\"codeSha\":\"1111111111111111111111111111111111111111\",\"version\":\"3.5.0\"},\"designGraphHash\":\"55506752be34099840567d0d00188621adbf7ff9bdfa1f8170fe66cfbe4f6f15\",\"packetVersion\":1,\"parentPacketHashes\":[],\"productSpecHash\":\"01351d873c4cf75cdc148d9454db372c8b877ae9932918097f8083e70d8a6325\",\"schema\":\"setfarm.product-build-packet.v1\",\"storyPlanHash\":\"fafc4c6e6a46b3a10370fa50e54624f46989974fedb446e6ab13017bff7ccfc1\",\"validationIds\":[\"VALIDATE_PACKET\"]},\"packetHash\":\"9530fba29e2f1aba456ba213e0a856e030465956cb430f2245c63f7fdc03def2\",\"producer\":{\"codeSha\":\"1111111111111111111111111111111111111111\",\"pass\":\"setup-build\",\"toolVersions\":{\"node\":\"22.13.0\"}},\"productSpec\":{\"actions\":[],\"routes\":[],\"schema\":\"setfarm.product-spec.v1\",\"surfaces\":[]},\"refs\":{\"buildTopology\":\"ecea5f9291d61028208e5e43e1ae345fce8ab97485ce4203da4cc0b1224fabbe\",\"compilationReport\":\"8f0e8b708c8d94f0e13b9f5a2486c4f2711edead8d9661f5765f75b771e166bc\",\"designGraph\":\"55506752be34099840567d0d00188621adbf7ff9bdfa1f8170fe66cfbe4f6f15\",\"packet\":\"9530fba29e2f1aba456ba213e0a856e030465956cb430f2245c63f7fdc03def2\",\"productSpec\":\"01351d873c4cf75cdc148d9454db372c8b877ae9932918097f8083e70d8a6325\",\"storyPlan\":\"fafc4c6e6a46b3a10370fa50e54624f46989974fedb446e6ab13017bff7ccfc1\"},\"runId\":\"ad47fe65-4ec4-4fb5-89da-fff71eb4e79a\",\"schema\":\"setfarm.product-build-authority.v1\",\"storyPlan\":{\"schema\":\"setfarm.story-plan.v1\",\"stories\":[]}},\"refusal\":null,\"runId\":\"ad47fe65-4ec4-4fb5-89da-fff71eb4e79a\",\"schema\":\"setfarm.product-build-authority.v2\"},\"releaseAdmissions\":[{\"admission_hash\":\"00cc494ab034ad23e93995bb0058ed9f7925c0b4522bfb1bb5e57e7cd4a6d385\",\"created_at\":\"2026-07-13T00:00:00.000Z\",\"expires_at\":null,\"gate_hash\":\"241cc90624864a2571197184cc615508fd3e3f9c40439ff67526905aaa26ee7e\",\"gate_ref\":\"sha256/24/241cc90624864a2571197184cc615508fd3e3f9c40439ff67526905aaa26ee7e.json\",\"kind\":\"release_go\",\"payload\":{\"admissionHash\":\"00cc494ab034ad23e93995bb0058ed9f7925c0b4522bfb1bb5e57e7cd4a6d385\",\"expiresAt\":null,\"gate\":{\"hash\":\"241cc90624864a2571197184cc615508fd3e3f9c40439ff67526905aaa26ee7e\",\"ref\":\"sha256/24/241cc90624864a2571197184cc615508fd3e3f9c40439ff67526905aaa26ee7e.json\"},\"issuedAt\":\"2026-07-13T00:00:00.000Z\",\"kind\":\"release_go\",\"preflightHash\":\"57fc751e81715104b94b09692ed5c3c5ae897c6c40feeac6225147c1484728d0\",\"releaseSha\":\"1111111111111111111111111111111111111111\",\"result\":{\"hash\":\"93ce3d7fb77f828943cc8ae7f84e3bdbefc92bcdbad5a49792ccc01d3234aba7\",\"ref\":\"sha256/93/93ce3d7fb77f828943cc8ae7f84e3bdbefc92bcdbad5a49792ccc01d3234aba7.json\"},\"schema\":\"setfarm.v3-release-admission.v1\",\"slots\":[],\"suiteHash\":\"25f108e57ff5a978c88ea7ea84c22cb157daef02332d53b39e3967ab0db8229c\"},\"release_sha\":\"1111111111111111111111111111111111111111\",\"result_hash\":\"93ce3d7fb77f828943cc8ae7f84e3bdbefc92bcdbad5a49792ccc01d3234aba7\",\"result_ref\":\"sha256/93/93ce3d7fb77f828943cc8ae7f84e3bdbefc92bcdbad5a49792ccc01d3234aba7.json\",\"suite_hash\":\"25f108e57ff5a978c88ea7ea84c22cb157daef02332d53b39e3967ab0db8229c\"}],\"runs\":[{\"accepted_candidate_hash\":null,\"activation_preflight_hash\":null,\"assigned_developer\":null,\"compiler_release_sha\":null,\"context\":\"{}\",\"created_at\":\"2026-10-19T00:00:00.000Z\",\"deploy_receipt_hash\":null,\"id\":\"ac8cea43-7686-4d27-8092-1e3dd9207ca4\",\"meta\":null,\"notify_url\":null,\"packet_hash\":null,\"project_transfer_ack_hash\":null,\"protocol\":\"legacy\",\"protocol_version\":1,\"release_admission_hash\":null,\"run_number\":1,\"status\":\"running\",\"task\":\"Task4 render smoke legacy fixture\",\"updated_at\":\"2026-10-19T00:00:00.000Z\",\"workflow_id\":\"feature-dev\"},{\"accepted_candidate_hash\":null,\"activation_preflight_hash\":\"57fc751e81715104b94b09692ed5c3c5ae897c6c40feeac6225147c1484728d0\",\"assigned_developer\":null,\"compiler_release_sha\":\"1111111111111111111111111111111111111111\",\"context\":\"{}\",\"created_at\":\"2026-10-19T00:00:00.000Z\",\"deploy_receipt_hash\":null,\"id\":\"ad47fe65-4ec4-4fb5-89da-fff71eb4e79a\",\"meta\":null,\"notify_url\":null,\"packet_hash\":\"9530fba29e2f1aba456ba213e0a856e030465956cb430f2245c63f7fdc03def2\",\"project_transfer_ack_hash\":null,\"protocol\":\"v3\",\"protocol_version\":1,\"release_admission_hash\":\"00cc494ab034ad23e93995bb0058ed9f7925c0b4522bfb1bb5e57e7cd4a6d385\",\"run_number\":2,\"status\":\"running\",\"task\":\"Task4 render smoke V3 fixture\",\"updated_at\":\"2026-10-19T00:00:00.000Z\",\"workflow_id\":\"feature-dev\"}],\"schema\":\"mission-control.task4-seed-observation.v1\",\"sourceSha\":\"1111111111111111111111111111111111111111\",\"templateRows\":[{\"category\":\"admin\",\"created_at\":\"2026-10-19T00:00:00.000Z\",\"description\":\"CRUD admin panel with users, content management, and settings\",\"id\":\"tpl-admin\",\"name\":\"Admin Panel\",\"platform\":\"web\",\"prd_content\":\"# PRD - Admin Panel\\n\\n## 1. Project Overview\\nBuild a full CRUD admin system with authentication, user management, content management, categories, settings, and audit-friendly tables.\\n\\n**Tech Stack:** React + TypeScript + Tailwind CSS + shadcn/ui + TanStack Table\\n\\n## 2. Design System\\n- Background: #FFFFFF, Sidebar: #F8FAFC, Card: #FFFFFF\\n- Primary: #0F172A, Accent: #2563EB, Border: #E2E8F0\\n- Font: Inter, 14px base\\n- Spacing: 4px grid\\n- Dark mode via CSS custom properties\\n\\n## 3. Pages\\n1. **Login** (/login) - Auth form and password recovery\\n2. **Dashboard** (/) - Metrics, recent activity, quick actions\\n3. **Users** (/users) - User data table and create/edit dialog\\n4. **Content** (/content) - Content data table and editor form\\n5. **Categories** (/categories) - Category table and sorting\\n6. **Settings** (/settings) - General, email, security, backup settings\\n\\n## 4. Page Requirements\\n- Login: centered form, logo, email, password, login button, forgot-password link, error alert.\\n- Dashboard: four metric cards, recent activity list, quick action buttons.\\n- Users: selectable rows, avatar/name, email, role badge, status switch, actions menu, filters.\\n- Content: title, category, author, date, status, create/edit full-page form.\\n- Categories: table with order controls, create/edit dialog, parent category select.\\n- Settings: grouped forms with tabs.\\n\\n## 5. Data Model\\n- User: id, name, email, role, status, avatar, createdAt\\n- Content: id, title, slug, body, categoryId, authorId, status, coverImage, seoTitle, seoDescription, createdAt, updatedAt\\n- Category: id, name, slug, parentId, sortOrder\\n- Setting: key, value, group\\n\"},{\"category\":\"blog\",\"created_at\":\"2026-10-19T00:00:00.000Z\",\"description\":\"Blog site with article list, article details, categories, and search\",\"id\":\"tpl-blog\",\"name\":\"Blog\",\"platform\":\"web\",\"prd_content\":\"# PRD - Blog Platform\\n\\n## 1. Project Overview\\nBuild a modern publishing platform with article discovery, categories, search, article detail pages, author pages, and newsletter capture.\\n\\n**Tech Stack:** React + TypeScript + Tailwind CSS\\n\\n## 2. Design System\\n- Background: #FFFFFF, Card: #F9FAFB\\n- Text: #111827 heading, #4B5563 body, #9CA3AF muted\\n- Primary: #3B82F6, Accent: #8B5CF6, Border: #E5E7EB, Code background: #1F2937\\n- Fonts: Merriweather for editorial headings, Source Sans 3 for body, Fira Code for code\\n- Motion: 300ms page fade, 200ms card hover, 500ms lazy-image blur\\n\\n## 3. Pages\\n1. **Home** (/) - Featured article, latest posts, categories, newsletter\\n2. **Blog** (/blog) - Search, filters, post grid, pagination\\n3. **Category** (/category/:slug) - Category feed and sidebar\\n4. **Article** (/blog/:slug) - Cover, content, table of contents, author box, related posts\\n5. **About** (/about) - Author profile and site mission\\n6. **Contact** (/contact) - Contact form\\n\\n## 4. Page Requirements\\n- Home: featured post card with cover image, category badge, author/date, latest post grid.\\n- Blog: category buttons, search input, post cards, pagination, popular posts sidebar.\\n- Article: large title, author metadata, cover image, markdown rendering, code blocks, blockquotes, TOC, comments.\\n- About: author bio, social links, metrics.\\n- Contact: name, email, subject, message, submit state.\\n\\n## 5. Data Model\\n- Post: id, title, slug, content, excerpt, coverImage, category, tags, author, publishedAt, readingTime\\n- Category: id, name, slug, postCount\\n- Author: id, name, bio, avatar, socialLinks\\n- Comment: id, postId, name, email, content, createdAt\\n\"},{\"category\":\"dashboard\",\"created_at\":\"2026-10-19T00:00:00.000Z\",\"description\":\"Analytics dashboard with charts, tables, metrics, filters, and reports\",\"id\":\"tpl-dashboard\",\"name\":\"Dashboard\",\"platform\":\"web\",\"prd_content\":\"# PRD - Analytics Dashboard\\n\\n## 1. Project Overview\\nBuild a data dashboard with metric cards, charts, tables, filters, reports, and real-time activity visibility.\\n\\n**Tech Stack:** React + TypeScript + Tailwind CSS + Recharts\\n**Default Theme:** Dark\\n\\n## 2. Design System\\n- Background: #09090B, Card: #18181B, Elevated: #27272A\\n- Text: #FAFAFA primary, #A1A1AA secondary, #71717A muted\\n- Primary: #3B82F6, Success: #22C55E, Warning: #EAB308, Error: #EF4444\\n- Chart palette: #3B82F6, #22C55E, #EAB308, #A855F7, #EC4899, #06B6D4\\n- Fonts: Inter for UI, JetBrains Mono for dense tables\\n- Motion: 800ms chart draw, 1.5s counter animation, 200ms card hover\\n\\n## 3. Pages\\n1. **Dashboard** (/) - Date controls, metric cards, charts, latest activity\\n2. **Analytics** (/analytics) - Detailed charts and comparisons\\n3. **Users** (/users) - User table, filters, detail sheet\\n4. **Reports** (/reports) - Report list and report builder\\n5. **Settings** (/settings) - Profile, notifications, integrations, theme\\n\\n## 4. Page Requirements\\n- Dashboard: date range picker, refresh button, four KPI cards, area chart, bar chart, pie chart, transactions table, live activity.\\n- Analytics: multi-series line chart, stacked bar chart, category/country/date filters, comparison overlay.\\n- Users: searchable table with avatar, email, status, last activity, detail sheet.\\n- Reports: report card grid, create-report form with type/date/format fields.\\n- Settings: tabbed forms and switches.\\n\\n## 5. Data Model\\n- Metric: key, value, change, changePercent, period\\n- ChartData: timestamp, values\\n- User: id, name, email, avatar, status, createdAt, lastActive\\n- Transaction: id, userId, type, amount, status, createdAt\\n- Report: id, title, type, dateRange, format, url, createdAt\\n\"},{\"category\":\"docs\",\"created_at\":\"2026-10-19T00:00:00.000Z\",\"description\":\"Documentation site with sidebar navigation, Markdown rendering, and search\",\"id\":\"tpl-docs\",\"name\":\"Documentation\",\"platform\":\"web\",\"prd_content\":\"# PRD - Documentation Site\\n\\n## 1. Project Overview\\nBuild a technical documentation site with sidebar navigation, Markdown rendering, search, code blocks, callouts, and table of contents.\\n\\n**Tech Stack:** React + TypeScript + Tailwind CSS\\n\\n## 2. Design System\\n- Background: #FFFFFF light, #0F1117 dark\\n- Sidebar: #F6F6F7 light, #1A1A24 dark\\n- Code background: #F6F8FA light, #161B22 dark\\n- Primary: #2563EB, Border: #E5E7EB light, #30363D dark\\n- Text: #1F2328 light, #E6EDF3 dark\\n- Fonts: Inter for UI, Fira Code or JetBrains Mono for code\\n- Motion: 200ms sidebar expand, 200ms command dialog scale + opacity\\n\\n## 3. Pages\\n1. **Docs Home** (/) - Intro, quick starts, popular docs\\n2. **Guide** (/docs/:slug) - Markdown content with TOC\\n3. **Search** (/search) - Command palette results\\n4. **Changelog** (/changelog) - Release notes\\n\\n## 4. Page Requirements\\n- Sidebar: logo, search trigger, nav groups, active state, collapsible groups, theme toggle, version badge.\\n- Content: breadcrumb, title, markdown body, headings, lists, tables, images, code blocks with copy button.\\n- Callouts: note, warning, tip, danger with colored left border and icon.\\n- Right TOC: sticky heading list with active scroll-spy.\\n- Search: keyboard shortcut, input, result list, highlighted matches, arrow-key navigation.\\n- Footer nav: previous/next links, edit-on-GitHub link, last updated date.\\n\\n## 5. Data Model\\n- Page: id, slug, title, content, section, order, updatedAt\\n- NavSection: id, title, pages\\n- SearchResult: pageId, title, excerpt, url\\n\"},{\"category\":\"ecommerce\",\"created_at\":\"2026-10-19T00:00:00.000Z\",\"description\":\"Full e-commerce site with product discovery, cart, checkout, and account flows\",\"id\":\"tpl-ecommerce\",\"name\":\"E-Commerce\",\"platform\":\"web\",\"prd_content\":\"# PRD - E-Commerce Platform\\n\\n## 1. Project Overview\\nBuild a modern responsive commerce experience with product discovery, filtering, cart management, checkout, account history, and order tracking.\\n\\n**Tech Stack:** React + TypeScript + Tailwind CSS + shadcn/ui\\n**Goal:** Fast, accessible, SEO-friendly, mobile-first shopping flow.\\n\\n## 2. Design System\\n- Primary: #2563EB, Secondary: #7C3AED, Accent: #F59E0B\\n- Background: #FFFFFF light, #0F172A dark\\n- Text: #1E293B light, #F8FAFC dark\\n- Destructive: #EF4444, Border: #E2E8F0, Muted: #F1F5F9\\n- Fonts: Inter for UI, JetBrains Mono for code/order identifiers\\n- Spacing: 4px base grid, 16px mobile page padding, 32px desktop page padding\\n- Motion: 200ms hover feedback, 300ms page fade, 200ms modal opacity + translateY\\n\\n## 3. Pages\\n1. **Home** (/) - Hero, category grid, featured products, campaign banner, footer\\n2. **Products** (/products) - Filters, sorting, product grid, pagination\\n3. **Product Detail** (/products/:id) - Gallery, variant selection, stock, tabs, related products\\n4. **Cart** (/cart) - Item list, quantity controls, order summary, empty state\\n5. **Checkout** (/checkout) - Address, payment, review, submit order\\n6. **Account** (/account) - Orders, addresses, favorites, settings\\n\\n## 4. Page Requirements\\n- Home: full-width product hero with primary CTA, 4-column desktop category grid, horizontal featured carousel, campaign banner, footer link groups.\\n- Products: sidebar filters for price, category, brand, color, and size; responsive grid; favorite and add-to-cart controls.\\n- Product Detail: image gallery with thumbnails, zoom interaction, price display, variant controls, quantity stepper, add-to-cart animation.\\n- Cart: editable quantities, remove actions, subtotal, shipping, total, checkout CTA, empty-state recovery CTA.\\n- Checkout: 3-step progress indicator, validated form fields, masked card input, sticky desktop summary, mobile accordion summary.\\n- Account: tabbed order/address/favorites/settings sections with order detail dialog.\\n\\n## 5. Data Model\\n- Product: id, title, slug, description, price, salePrice, images, category, brand, variants, stock, rating\\n- Cart: items, total, itemCount\\n- Order: id, items, address, payment, status, total, createdAt\\n- User: id, name, email, phone, addresses, orders\\n\\n## 6. API\\n- GET /api/products\\n- GET /api/products/:id\\n- GET /api/categories\\n- POST /api/cart/add\\n- PATCH /api/cart/update\\n- DELETE /api/cart/remove/:itemId\\n- POST /api/orders\\n- GET /api/orders/:id\\n\"},{\"category\":\"game\",\"created_at\":\"2026-10-19T00:00:00.000Z\",\"description\":\"Canvas/WebGL game with menu, gameplay screen, settings, and score state\",\"id\":\"tpl-game\",\"name\":\"Game\",\"platform\":\"web\",\"prd_content\":\"# PRD - Web Game\\n\\n## 1. Project Overview\\nBuild a browser-based 2D arcade/casual game with menu, gameplay, pause, game over, leaderboard, settings, and persistent high scores.\\n\\n**Tech Stack:** React + TypeScript + HTML5 Canvas\\n**Genre:** 2D arcade/casual\\n\\n## 2. Design System\\n- Background: #0A0A0A, Game area: #1A1A2E\\n- Primary: #E94560, Secondary: #0F3460, Accent: #16C79A\\n- Text: #EAEAEA, Score: #FFD700\\n- Fonts: Press Start 2P for arcade UI or Rajdhani for readable HUD\\n- Motion: 3s menu title float, 200ms button glow, 500ms game-over shake, particle effects\\n\\n## 3. Screens\\n1. **Main Menu** (/) - Logo, play, leaderboard, settings\\n2. **Game** (/play) - Canvas, HUD, controls, pause\\n3. **Pause** (/pause) - Overlay with resume, restart, main menu\\n4. **Game Over** (/game-over) - Final score, high score, replay, main menu\\n5. **Leaderboard** (/leaderboard) - Stored scores\\n6. **Settings** (/settings) - Audio, difficulty, controls\\n\\n## 4. Gameplay Requirements\\n- Canvas target: 60fps requestAnimationFrame loop.\\n- Controls: keyboard arrows/WASD plus mobile touch controls.\\n- State: menu, playing, paused, gameover.\\n- Entities: player, enemies, projectiles, particles, pickups.\\n- Collision: AABB or circle-circle with deterministic rules.\\n- Score: points, combo multiplier, bonus pickups.\\n- Persistence: localStorage high scores and settings.\\n\\n## 5. Data Model\\n- GameState: score, lives, level, entities, timestamp\\n- HighScore: name, score, date\\n- Settings: volume, musicOn, difficulty\\n\"},{\"category\":\"mobile\",\"created_at\":\"2026-10-19T00:00:00.000Z\",\"description\":\"React Native mobile app with tab navigation, lists, details, and profile\",\"id\":\"tpl-mobile\",\"name\":\"Mobile App\",\"platform\":\"mobile\",\"prd_content\":\"# PRD - Mobile Application\\n\\n## 1. Project Overview\\nBuild a React Native + Expo mobile app with tab navigation, searchable lists, detail screens, notifications, profile, and settings.\\n\\n**Tech Stack:** React Native + Expo + TypeScript + NativeWind\\n**Platform:** iOS + Android\\n\\n## 2. Design System\\n- Background: #FFFFFF light, #000000 dark\\n- Card: #F2F2F7 light, #1C1C1E dark\\n- Primary: #007AFF, Destructive: #FF3B30, Success: #34C759\\n- Text: #000000 light, #FFFFFF dark, Secondary text: #8E8E93\\n- Fonts: SF Pro on iOS, Roboto on Android\\n- Motion: 350ms slide transitions, 200ms tab cross-fade, 100ms press feedback\\n\\n## 3. Screens\\n1. **Home** (/) - Header, carousel, feed list, pull-to-refresh\\n2. **Explore** (/explore) - Search, category chips, result list\\n3. **Detail** (/detail/:id) - Image, content, fixed CTA\\n4. **Notifications** (/notifications) - Grouped notification list\\n5. **Profile** (/profile) - Avatar, bio, stats, menu\\n6. **Settings** (/settings) - Switches, selects, destructive account action\\n\\n## 4. Screen Requirements\\n- Bottom tabs: Home, Explore, Notifications, Profile with active/inactive colors.\\n- Home: title, notification icon, horizontal carousel, vertical item cards.\\n- Explore: sticky search bar, horizontal category filter chips, FlatList results.\\n- Detail: top image, back overlay, title, metadata, body, safe-area CTA bar.\\n- Notifications: sectioned groups, unread state, time labels.\\n- Profile: avatar, name, bio, stats row, grouped menu list.\\n- Settings: grouped list with switch/select/button items.\\n\\n## 5. Data Model\\n- Item: id, title, subtitle, image, category, content, createdAt\\n- Notification: id, type, title, message, read, createdAt\\n- User: id, name, avatar, bio, stats\\n\"},{\"category\":\"portfolio\",\"created_at\":\"2026-10-19T00:00:00.000Z\",\"description\":\"Personal portfolio with projects, about, experience, and contact sections\",\"id\":\"tpl-portfolio\",\"name\":\"Portfolio\",\"platform\":\"web\",\"prd_content\":\"# PRD - Portfolio Site\\n\\n## 1. Project Overview\\nBuild a polished personal portfolio that presents identity, work, skills, experience, and contact paths in a single-page or light multi-page experience.\\n\\n**Tech Stack:** React + TypeScript + Tailwind CSS\\n**Goal:** Minimal, memorable, fast, accessible, and responsive.\\n\\n## 2. Design System\\n- Background: #FAFAFA light, #09090B dark\\n- Foreground: #09090B light, #FAFAFA dark\\n- Accent: #6366F1, Muted: #F4F4F5 light, #27272A dark\\n- Fonts: Space Grotesk for headings, Inter for body\\n- Motion: 600ms scroll reveal, 200ms card hover, staggered page load\\n\\n## 3. Pages\\n1. **Home** (/) - Hero, about, projects, experience, contact, footer\\n2. **Projects** (/projects) - Filterable project gallery and project details\\n3. **About** (/about) - Profile, skills, experience, values\\n4. **Contact** (/contact) - Contact form and social links\\n\\n## 4. Page Requirements\\n- Hero: first viewport identity statement, role, short positioning copy, project/contact CTAs, subtle interactive background.\\n- About: profile image, bio, skills grouped by category, progress or proficiency indicators.\\n- Projects: responsive cards with screenshot, title, description, tags, GitHub and live demo links; detail modal with gallery.\\n- Experience: vertical timeline with date, company, role, and impact bullets.\\n- Contact: name, email, subject, message, submit state, GitHub/LinkedIn/email links.\\n\\n## 5. Data Model\\n- Project: id, title, description, image, tags, githubUrl, liveUrl, category\\n- Skill: name, level, category\\n- Experience: company, role, startDate, endDate, description\\n- ContactForm: name, email, subject, message\\n\"},{\"category\":\"saas\",\"created_at\":\"2026-10-19T00:00:00.000Z\",\"description\":\"SaaS landing page with hero, features, pricing, testimonials, and CTA\",\"id\":\"tpl-saas\",\"name\":\"SaaS Landing\",\"platform\":\"web\",\"prd_content\":\"# PRD - SaaS Landing Page\\n\\n## 1. Project Overview\\nBuild a conversion-focused SaaS landing page with product positioning, feature proof, pricing, testimonials, FAQ, and a clear acquisition funnel.\\n\\n**Tech Stack:** React + TypeScript + Tailwind CSS\\n**Goal:** High-conversion, fast, accessible, analytics-ready marketing site.\\n\\n## 2. Design System\\n- Primary: #6366F1, Primary hover: #4F46E5\\n- Background: #FFFFFF, Alternate section: #F8FAFC, Dark section: #0F172A\\n- Text: #0F172A heading, #475569 body, #94A3B8 muted\\n- Success: #10B981, Warning: #F59E0B, Error: #EF4444\\n- Fonts: Cal Sans or Inter for headings, Inter for body\\n- Motion: 500ms scroll reveal, button glow, 2s counter animation\\n\\n## 3. Pages\\n1. **Home** (/) - Sticky nav, hero, logos, features, pricing, testimonials, FAQ, CTA, footer\\n2. **Pricing** (/pricing) - Plan comparison and billing toggle\\n3. **Docs Preview** (/docs) - Product education preview and onboarding CTA\\n4. **Contact Sales** (/contact) - Lead form and qualification fields\\n\\n## 4. Page Requirements\\n- Navbar: logo, nav links, login, primary CTA, mobile sheet.\\n- Hero: clear headline, benefit copy, primary CTA, secondary demo CTA, product screenshot.\\n- Features: 3-column card grid and alternating detailed feature sections.\\n- Pricing: monthly/yearly toggle, three plan cards, popular plan highlight, feature comparison.\\n- Testimonials: carousel cards with quote, name, role, company, avatar.\\n- FAQ: accordion with 6-8 objections handled.\\n- CTA Banner: full-width conversion section with strong copy and CTA.\\n\\n## 5. Data Model\\n- Plan: id, name, price, yearlyPrice, features, cta, popular\\n- Feature: id, title, description, icon\\n- Testimonial: id, text, author, role, company, avatar\\n- FAQ: id, question, answer\\n\"}]}";
const GOLDEN_GRANTS = "{\"additionalColumnGrants\":[],\"applicationRoutineGrants\":[],\"database\":\"setfarm_p3_222222222222222222222222_clone_333333333333\",\"databaseGrants\":[{\"name\":\"setfarm_p3_222222222222222222222222_clone_333333333333\",\"privilege\":\"CONNECT\"}],\"memberships\":[],\"ownedDataObjects\":[],\"relationGrants\":[{\"kind\":\"r\",\"name\":\"accepted_candidates\",\"privilege\":\"SELECT\",\"schema\":\"public\"},{\"kind\":\"r\",\"name\":\"agent_feed\",\"privilege\":\"SELECT\",\"schema\":\"public\"},{\"kind\":\"r\",\"name\":\"claim_log\",\"privilege\":\"SELECT\",\"schema\":\"public\"},{\"kind\":\"r\",\"name\":\"execution_attempts\",\"privilege\":\"SELECT\",\"schema\":\"public\"},{\"kind\":\"r\",\"name\":\"internal_production_owner_producer_manifest_activation_heads_v1\",\"privilege\":\"SELECT\",\"schema\":\"public\"},{\"kind\":\"r\",\"name\":\"internal_production_owner_producer_manifest_set_activations_v1\",\"privilege\":\"SELECT\",\"schema\":\"public\"},{\"kind\":\"r\",\"name\":\"internal_production_owner_producer_manifest_set_current_v1\",\"privilege\":\"SELECT\",\"schema\":\"public\"},{\"kind\":\"r\",\"name\":\"live_events\",\"privilege\":\"SELECT\",\"schema\":\"public\"},{\"kind\":\"r\",\"name\":\"operational_event_deliveries\",\"privilege\":\"SELECT\",\"schema\":\"public\"},{\"kind\":\"r\",\"name\":\"operational_events\",\"privilege\":\"SELECT\",\"schema\":\"public\"},{\"kind\":\"r\",\"name\":\"operational_outbox\",\"privilege\":\"SELECT\",\"schema\":\"public\"},{\"kind\":\"r\",\"name\":\"prd_templates\",\"privilege\":\"SELECT\",\"schema\":\"public\"},{\"kind\":\"r\",\"name\":\"prds\",\"privilege\":\"SELECT\",\"schema\":\"public\"},{\"kind\":\"r\",\"name\":\"product_packets\",\"privilege\":\"SELECT\",\"schema\":\"public\"},{\"kind\":\"r\",\"name\":\"run_observations\",\"privilege\":\"SELECT\",\"schema\":\"public\"},{\"kind\":\"r\",\"name\":\"runs\",\"privilege\":\"SELECT\",\"schema\":\"public\"},{\"kind\":\"r\",\"name\":\"runtime_sessions\",\"privilege\":\"SELECT\",\"schema\":\"public\"},{\"kind\":\"r\",\"name\":\"steps\",\"privilege\":\"SELECT\",\"schema\":\"public\"},{\"kind\":\"r\",\"name\":\"stories\",\"privilege\":\"SELECT\",\"schema\":\"public\"},{\"kind\":\"r\",\"name\":\"tasks\",\"privilege\":\"SELECT\",\"schema\":\"public\"},{\"kind\":\"r\",\"name\":\"v3_canary_admission_claims\",\"privilege\":\"SELECT\",\"schema\":\"public\"},{\"kind\":\"r\",\"name\":\"v3_deploy_receipts\",\"privilege\":\"SELECT\",\"schema\":\"public\"},{\"kind\":\"r\",\"name\":\"v3_project_transfer_acks\",\"privilege\":\"SELECT\",\"schema\":\"public\"},{\"kind\":\"r\",\"name\":\"v3_release_admissions\",\"privilege\":\"SELECT\",\"schema\":\"public\"}],\"role\":{\"bypassRls\":false,\"canLogin\":true,\"createDatabase\":false,\"createRole\":false,\"currentUser\":\"mc_task4_0123456789abcdef0123456789abcdef\",\"inherit\":false,\"name\":\"mc_task4_0123456789abcdef0123456789abcdef\",\"replication\":false,\"sessionUser\":\"mc_task4_0123456789abcdef0123456789abcdef\",\"superuser\":false},\"schema\":\"mission-control.task4-effective-data-read-grants.v1\",\"schemaGrants\":[{\"name\":\"public\",\"privilege\":\"USAGE\"}],\"sequenceGrants\":[],\"settings\":{\"defaultTransactionReadOnly\":\"on\",\"loCompatPrivileges\":false,\"recovery\":false}}";

// Evaluate only the four fixed Source path declarations; no caller/environment selector or effect import.
async function task4FixedSourcePaths() {
    const ts = await import('typescript'), vm = await import('node:vm'), path = await import('node:path'), url = await import('node:url');
    const moduleUrl = new URL('../scripts/render-smoke-owned-fixture.mjs', import.meta.url).href;
    const text = readFileSync(new URL(moduleUrl), 'utf8'), ast = ts.createSourceFile('owned.mjs', text, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
    const names = ['TASK4_MC_ROOT', 'TASK4_TOOLCHAIN_ROOT', 'TASK4_NODE', 'TASK4_PG_BIN'];
    const declarations = ast.statements.filter(ts.isVariableStatement).flatMap(n => [...n.declarationList.declarations]);
    const closed = (node: import('typescript').Expression): boolean => {
        if (ts.isStringLiteral(node)) return true;
        if (ts.isIdentifier(node)) return names.includes(node.text);
        if (ts.isPropertyAccessExpression(node) && node.name.text === 'url' && ts.isMetaProperty(node.expression)) return node.expression.getText(ast) === 'import.meta';
        if (!ts.isCallExpression(node) || !node.arguments.every(closed)) return false;
        return ts.isIdentifier(node.expression) ? node.expression.text === 'fileURLToPath'
            : ts.isPropertyAccessExpression(node.expression) && ts.isIdentifier(node.expression.expression)
                && node.expression.expression.text === 'path' && ['dirname', 'join'].includes(node.expression.name.text);
    };
    const code = names.map(name => {
        const found = declarations.filter(n => n.name.getText(ast) === name); assert.equal(found.length, 1);
        const value = found[0].initializer; assert.ok(value && closed(value));
        return 'const ' + name + ' = ' + value.getText(ast).replace('import.meta.url', 'moduleUrl') + ';';
    }).join('\n');
    return vm.compileFunction(code + '\nreturn { ' + names.join(',') + ' };', ['path', 'fileURLToPath', 'moduleUrl'])(path, url.fileURLToPath, moduleUrl);
}

test('Task4 shared wire accepts exact canonical frames and rejects ambiguous or crossed inputs', async (t) => {
    const m = await load();
    for (const [kind, raw, bytes, digest] of [
        ['launch', GOLDEN_LAUNCH, 876, '156d0ba4ec740d1e73f68770e95e2c2111efff0467cbd7e5493e5687abc3ad98'],
        ['setup', GOLDEN_SETUP, 2564, '0514fad6df757332d6e7ef2e14cd3a428a01af15a8f804203f8306b27d612fcd'],
        ['ready', GOLDEN_READY, 4504, '859c26f23616f5a4f458d6177eb9629afefce65cd82fd1831fd5c6a6c79cf5dd'],
    ] as const) await t.test(kind, () => {
        const frame = Buffer.from(raw + '\n'); assert.equal(frame.length, bytes); assert.equal(hash(frame), digest);
        const parsed = m.parseTask4FrameV1(frame, kind); assert.deepEqual(parsed, JSON.parse(raw)); assert.ok(Object.isFrozen(parsed));
        for (const bad of [raw, raw + '\n\n', ' ' + raw + '\n', '\ufeff' + raw + '\n', raw + '\r\n', raw.replace('{', '{"schema":0,') + '\n'])
            assert.throws(() => m.parseTask4FrameV1(Buffer.from(bad), kind), /TASK4_FRAME_INVALID/);
    });
    assert.throws(() => m.parseTask4FrameV1(Buffer.alloc(16385), 'setup'), /TASK4_FRAME_TOO_LARGE/);
    assert.throws(() => m.parseTask4FrameV1(Buffer.from([255, 10]), 'ready'), /TASK4_FRAME_INVALID/);
    const encode = (value: any) => Buffer.from(m.task4CanonicalV1(value) + '\n');
    for (const change of [
        (v: any) => { v.owner.uid = 0; }, (v: any) => { v.resourceRoot.mode = 511; },
        (v: any) => { v.resourceRoot.path += '/../escape'; }, (v: any) => { v.argv = []; },
        (v: any) => { v.setfarm.rootPin.path = '/foreign'; }, (v: any) => { v.postgres.process.ppid++; },
        (v: any) => { v.owner.startedAt = '2026-02-30T00:00:00.000Z'; },
    ]) { const value = JSON.parse(GOLDEN_SETUP); change(value); assert.throws(() => m.parseTask4FrameV1(encode(value), 'setup')); }
    for (const executable of ['/opt/homebrew/Cellar/postgresql@17/17.10/bin/postgres', '/Users/setrox/ai/setrox/.task4-toolchain-v2/Cellar/postgresql@17/17.10/bin/postgres', '/Users/setrox/ai/setrox/.task4-toolchain-v1/Cellar/postgresql@17/17.10/bin/psql']) {
        const value = JSON.parse(GOLDEN_SETUP); value.postgres.process.executable = executable;
        assert.throws(() => m.parseTask4FrameV1(encode(value), 'setup'), /TASK4_FRAME_INVALID|TASK4_BINDING_REFUSED/);
        const ready = JSON.parse(GOLDEN_READY); ready.setup = value; ready.setupDescriptorHash = hash(m.task4CanonicalV1(value) + '\n');
        assert.throws(() => m.parseTask4FrameV1(encode(ready), 'ready'), /TASK4_FRAME_INVALID|TASK4_BINDING_REFUSED/);
    }
    for (const port of [0, 3080, 3333, 5432, 13081, 18789, 65536]) {
        const value = JSON.parse(GOLDEN_SETUP); value.postgres.port = port; assert.throws(() => m.parseTask4FrameV1(encode(value), 'setup'));
    }
    for (const change of [
        (v: any) => { v.executionId = 'f'.repeat(32); }, (v: any) => { v.setupDescriptorHash = 'f'.repeat(64); },
        (v: any) => { v.projection.inputManifestHash = 'f'.repeat(64); },
        (v: any) => { v.database.restrictedUrl += '?override=1'; v.database.restrictedUrlHash = hash(v.database.restrictedUrl); },
        (v: any) => { v.database.restrictedUrl = v.database.restrictedUrl.replace('127.0.0.1', 'localhost'); v.database.restrictedUrlHash = hash(v.database.restrictedUrl); },
        (v: any) => { v.fixture.extra = true; },
    ]) { const value = JSON.parse(GOLDEN_READY); change(value); assert.throws(() => m.parseTask4FrameV1(encode(value), 'ready')); }
});

test('Task4 dataset reconstructs accepted sealed product and full rows without granting fixture authority', async () => {
    const m = await load();
    const source = '1'.repeat(40), database = 'setfarm_p3_' + '2'.repeat(24) + '_clone_' + '3'.repeat(12), role = 'mc_task4_0123456789abcdef0123456789abcdef';
    assert.equal(Buffer.byteLength(GOLDEN_SEED), 24563); assert.equal(hash(GOLDEN_SEED), 'acbdd5a51a633eb5317d678cb0b9869114461a038efdce5c3b143c372d3bb429');
    assert.equal(Buffer.byteLength(GOLDEN_GRANTS), 2803); assert.equal(hash(GOLDEN_GRANTS), '656d4a9282e79c0c694d5fd542d8c46a78fb735e5d10c640f0dd2b1db000a476');
    assert.equal(m.task4CanonicalV1(m.task4SeedV1(source)), GOLDEN_SEED);
    assert.equal(m.task4CanonicalV1(m.task4GrantsV1(database, role)), GOLDEN_GRANTS);
    for (const change of [
        (v: any) => { v.runs.push(v.runs[0]); }, (v: any) => { v.runs.reverse(); },
        (v: any) => { v.runs[0].context = {}; }, (v: any) => { v.runs[0].meta = ''; },
        (v: any) => { v.emptyRelations[0].rows = [{ foreign: true }]; }, (v: any) => { v.templateRows[0].prd_content += 'foreign'; },
        (v: any) => { v.productResponse.packetAuthority.packetHash = '0'.repeat(64); },
        (v: any) => { v.releaseAdmissions[0].payload.expiresAt = ''; }, (v: any) => { v.runs[0].created_at = '2026-10-19T00:00:00.000001Z'; },
    ]) { const value = JSON.parse(GOLDEN_SEED); change(value); assert.throws(() => m.validateTask4SeedV1(value, source)); }
    assert.throws(() => m.validateTask4SeedV1(m.task4SeedV1('2'.repeat(40)), source));
    for (const change of [
        (v: any) => { v.relationGrants.push({ schema: 'public', name: 'runs', kind: 'r', privilege: 'UPDATE' }); },
        (v: any) => { v.role.superuser = true; }, (v: any) => { v.databaseGrants.push({ name: 'postgres', privilege: 'CONNECT' }); },
        (v: any) => { v.sequenceGrants.push({ schema: 'public', name: 'runs_seq', privilege: 'USAGE' }); },
        (v: any) => { v.relationGrants.pop(); }, (v: any) => { v.relationGrants.reverse(); },
    ]) { const value = JSON.parse(GOLDEN_GRANTS); change(value); assert.throws(() => m.validateTask4GrantsV1(value, database, role)); }
});

test('Task4 fd4 consumes one capped frame through EOF and closes the original stream', async (t) => {
    const m = await load();
    const { PassThrough } = await import('node:stream');
    await t.test('chunked complete frame', async () => {
        const stream = new PassThrough(); let closed = false; stream.once('close', () => { closed = true; });
        const completion = m.readTask4FrameV1(stream, 'launch');
        stream.write(GOLDEN_LAUNCH.slice(0, 9)); stream.end(GOLDEN_LAUNCH.slice(9) + '\n');
        assert.deepEqual(await completion, JSON.parse(GOLDEN_LAUNCH)); assert.equal(stream.destroyed, true); assert.equal(closed, true);
    });
    await t.test('EOF is not original close', async () => {
        const { EventEmitter } = await import('node:events');
        const stream = new EventEmitter() as any;
        stream.destroy = () => { stream.destroyed = true; };
        let settled = false;
        const completion = m.readTask4FrameV1(stream, 'launch').then((value: any) => { settled = true; return value; });
        stream.emit('data', Buffer.from(GOLDEN_LAUNCH + '\n')); stream.emit('end');
        await Promise.resolve();
        try { assert.equal(settled, false); }
        finally { stream.emit('close'); await completion; }
    });
    for (const mode of ['missing_eof', 'extra_frame', 'too_large', 'stream_error', 'premature_close']) await t.test(mode, async () => {
        const stream = new PassThrough();
        t.mock.timers.enable({ apis: ['setTimeout'] });
        try {
            const completion = m.readTask4FrameV1(stream, 'launch');
            const rejection = assert.rejects(completion, /TASK4_FRAME_(TIMEOUT|INVALID|TOO_LARGE|UNAVAILABLE)/);
            if (mode === 'missing_eof') { stream.write(GOLDEN_LAUNCH + '\n'); t.mock.timers.tick(5000); }
            if (mode === 'extra_frame') stream.end(GOLDEN_LAUNCH + '\n' + GOLDEN_LAUNCH + '\n');
            if (mode === 'too_large') stream.write(Buffer.alloc(16385));
            if (mode === 'stream_error') stream.destroy(new Error('PRIVATE_SECRET_MUST_NOT_ESCAPE'));
            if (mode === 'premature_close') stream.destroy();
            await rejection; assert.equal(stream.destroyed, true);
            t.mock.timers.tick(10000);
        } finally { stream.destroy(); t.mock.timers.reset(); }
    });
});

test('Task4 independently extracts only the fixed auxiliary Source literals', async () => {
    const m = await load();
    const source = readFileSync('/Users/setrox/ai/setrox/.worktrees/setfarm-dashboard-cutover-controller-20261007-v1/src/installation/fresh-installation-mission-control-schema-v1.ts', 'utf8');
    assert.equal(hash(source), '914c608236bd44ae4b0b19804b292d4810d2d3b185a726c334ccf2ff94cd4e9f');
    const result = await m.extractTask4AuxiliaryV1(source);
    assert.deepEqual(result.templates, JSON.parse(GOLDEN_SEED).templateRows);
    assert.equal(result.statements.length, 12);
    assert.equal(hash(m.task4CanonicalV1(result.statements)), '8d92f68a499be0da73ae8061acdf1a217fdfc7af138edcc9b9645abce83fbce0');
    assert.deepEqual(result.tables, ['tasks', 'prds', 'prd_templates', 'agent_feed', 'live_events']);
    for (const changed of [
        source + '\nconst TABLES = Object.freeze([]);',
        source.replace('const TABLES', 'let TABLES'),
        source.replace('CREATE TABLE public.tasks', 'DROP TABLE public.tasks'),
        source.replace('const TEMPLATE_CONTENTS: Readonly<Record<string, string>> = Object.freeze(', 'const TEMPLATE_CONTENTS = arbitraryEffect('),
        source.replace('const TABLES = Object.freeze([', 'const TABLES = Object.freeze([...caller, '),
    ]) await assert.rejects(m.extractTask4AuxiliaryV1(changed), /TASK4_AUXILIARY_SOURCE_REFUSED/);
});

function rawDatabaseRows() {
    const seed = JSON.parse(GOLDEN_SEED), grants = JSON.parse(GOLDEN_GRANTS);
    const samples: Record<string, any> = { runs: seed.runs[0], v3_release_admissions: seed.releaseAdmissions[0], prd_templates: seed.templateRows[0] };
    const rows: Record<string, any[]> = {
        seed_catalog: [...Object.keys(samples), ...seed.emptyRelations.map((r: any) => r.name)].sort().map(name => ({
            name, kind: 'r', rls: false, forceRls: false,
            columns: Object.keys(samples[name] ?? { id: '' }).sort().map(name => ({ name,
                type: ['created_at', 'updated_at', 'expires_at'].includes(name) ? 'timestamptz' : name === 'payload' ? 'jsonb' : ['run_number', 'protocol_version'].includes(name) ? 'int4' : 'text' })),
        })),
        seed_runs: seed.runs.map((row: any) => ({ row, precision_ok: true })),
        seed_admissions: seed.releaseAdmissions.map((row: any) => ({ row, precision_ok: true })),
        seed_templates: seed.templateRows.map((row: any) => ({ row, precision_ok: true })),
        role: [grants.role], settings: [{ database: grants.database, ...grants.settings }], memberships: [], owned: [],
        databases: [{ name: grants.database, CONNECT: true, CREATE: false, TEMPORARY: false }, { name: 'postgres', CONNECT: false, CREATE: false, TEMPORARY: false }],
        schemas: [{ name: 'public', USAGE: true, CREATE: false }],
        relations: grants.relationGrants.map(({ schema, name, kind }: any) => ({ schema, name, kind, SELECT: true, INSERT: false, UPDATE: false, DELETE: false, TRUNCATE: false, REFERENCES: false, TRIGGER: false, MAINTAIN: false })),
        columns: [{ schema: 'public', relation: 'runs', column: 'id', SELECT: true, tableSELECT: true, INSERT: false, tableINSERT: false, UPDATE: false, tableUPDATE: false, REFERENCES: false, tableREFERENCES: false }],
        sequences: [{ schema: 'public', name: 'agent_feed_id_seq', USAGE: false, SELECT: false, UPDATE: false }],
        routines: [],
    };
    for (const entry of seed.emptyRelations) rows['empty_' + entry.name] = [];
    return rows;
}

test('Task4 finite observer SQL reads full rows and effective grants; supplied summaries cannot substitute', async (t) => {
    const m = await load();
    const recipes = m.task4ObserverSqlRecipesV1();
    assert.ok(Object.isFrozen(recipes)); assert.equal(new Set(recipes.map((r: any) => r.queryId)).size, recipes.length);
    for (const recipe of recipes) {
        assert.deepEqual(recipe.requiredPhases, ['before', 'after']); assert.ok(Object.isFrozen(recipe));
        assert.ok(recipe.parametersRule.every((name: string) => ['role', 'database', 'source_sha'].includes(name)));
    }
    for (const id of ['identity', 'settings', 'current_pair', 'optional_step_metrics']) assert.ok(recipes.some((r: any) => r.queryId === id));
    assert.equal(recipes.find((r: any) => r.queryId === 'optional_step_metrics').statement, "SELECT to_regclass('public.step_metrics')::text AS relation");
    const seedReads = recipes.filter((r: any) => r.queryId.startsWith('seed_') && r.queryId !== 'seed_catalog' || r.queryId.startsWith('empty_'));
    assert.equal(seedReads.length, 21);
    for (const recipe of seedReads) { assert.match(recipe.statement, /LIMIT 4097$/); assert.doesNotMatch(recipe.statement, /\bWHERE\b|COUNT\(/); }
    const makeSql = (rows: Record<string, any[]>) => {
        const calls: string[] = [];
        return { calls, unsafe: async (statement: string, parameters: unknown[] = []) => {
            const recipe = recipes.find((r: any) => r.statement === statement); assert.ok(recipe, 'only fixed SQL');
            assert.deepEqual(parameters, []); calls.push(recipe.queryId);
            assert.ok(Object.hasOwn(rows, recipe.queryId), recipe.queryId); return structuredClone(rows[recipe.queryId]);
        } };
    };
    const base = rawDatabaseRows(), grants = JSON.parse(GOLDEN_GRANTS);
    const sql = makeSql(base);
    assert.deepEqual(await m.observeTask4SeedV1(sql, '1'.repeat(40)), JSON.parse(GOLDEN_SEED));
    assert.deepEqual(await m.observeTask4GrantsV1(sql, grants.database, grants.role.name), grants);
    assert.equal(sql.calls.filter(id => id.startsWith('empty_')).length, 18);
    for (const [name, mutate] of [
        ['foreign row', (r: any) => { r.empty_tasks.push({ row: { id: 'foreign' } }); }],
        ['missing catalog', (r: any) => { r.seed_catalog.pop(); }],
        ['extra source column', (r: any) => { r.seed_catalog.find((x: any) => x.name === 'runs').columns.push({ name: 'foreign', type: 'text' }); }],
        ['submillisecond timestamp', (r: any) => { r.seed_runs[0].precision_ok = false; }],
        ['changed text context', (r: any) => { r.seed_runs[0].row.context = {}; }],
    ] as const) await t.test(name, async () => { const rows = rawDatabaseRows(); mutate(rows); await assert.rejects(m.observeTask4SeedV1(makeSql(rows), '1'.repeat(40)), /TASK4_DATABASE_REFUSED/); });
    for (const [name, mutate] of [
        ['foreign PUBLIC connect', (r: any) => { r.databases[1].CONNECT = true; }],
        ['additional column write', (r: any) => { r.columns[0].UPDATE = true; }],
        ['application execute', (r: any) => { r.routines.push({ schema: 'public', name: 'write', identity: '', kind: 'f', securityDefiner: true, EXECUTE: true }); }],
        ['nullable privilege', (r: any) => { r.relations[0].UPDATE = null; }],
        ['missing effective select', (r: any) => { r.relations[0].SELECT = false; }],
        ['duplicate catalog tuple', (r: any) => { r.databases.push(r.databases[1]); }],
        ['unknown relation kind', (r: any) => { r.relations[0].kind = 'unknown'; }],
    ] as const) await t.test(name, async () => { const rows = rawDatabaseRows(); mutate(rows); await assert.rejects(m.observeTask4GrantsV1(makeSql(rows), grants.database, grants.role.name), /TASK4_DATABASE_REFUSED/); });
});

function currentPairRows(m: any, ready: any) {
    const receipt: any = { schema: 'setfarm.internal-production-owner-producer-manifest-set-activation.v1', phase: 'A',
        orderedPlans: ['A'], orderedManifestHashes: ['1'.repeat(64)], orderedSourceBuildAuthorities: [{ plan: 'A', sourceBuildAuthorityRef: 'setfarm://fixture', sourceBuildAuthorityHash: '2'.repeat(64) }],
        manifestSetHash: '3'.repeat(64), ownerCategoryRegistryHash: '4'.repeat(64), ownerCategoryCensusMapHash: '5'.repeat(64),
        predecessorActivationRef: null, predecessorActivationHash: null, predecessorHeadRef: null, predecessorHeadHash: null };
    receipt.activationHash = hash(m.task4CanonicalV1(receipt));
    receipt.activationRef = 'setfarm://internal-production/owner-producer-manifest-set-activation/sha256/' + receipt.activationHash;
    const head: any = { schema: 'setfarm.internal-production-owner-producer-manifest-set-activation-head.v1', phase: 'A', activationRef: receipt.activationRef, activationHash: receipt.activationHash, predecessorHeadRef: null, predecessorHeadHash: null };
    head.headHash = hash(m.task4CanonicalV1(head)); head.headRef = 'setfarm://internal-production/owner-producer-manifest-set-activation-head/sha256/' + head.headHash;
    const pair = { activationRef: receipt.activationRef, activationHash: receipt.activationHash, headRef: head.headRef, headHash: head.headHash,
        admissionReadyHash: hash(JSON.stringify({ activationHash: receipt.activationHash, activationRef: receipt.activationRef, headHash: head.headHash, headRef: head.headRef, schema: 'setfarm.p3-projected-admission-ready.v1' })) };
    Object.assign(ready.fixture, { manifestActivationHash: pair.activationHash, manifestHeadHash: pair.headHash, admissionReadyHash: pair.admissionReadyHash });
    return { pair, rows: [{
        current: [{ singleton_key: true, revision: '1', phase: 'A', activation_ref: pair.activationRef, activation_hash: pair.activationHash, head_ref: pair.headRef, head_hash: pair.headHash }],
        activations: [{ activation_ref: pair.activationRef, activation_hash: pair.activationHash, phase: 'A', manifest_set_hash: receipt.manifestSetHash,
            owner_category_registry_hash: receipt.ownerCategoryRegistryHash, owner_category_census_map_hash: receipt.ownerCategoryCensusMapHash,
            predecessor_activation_ref: null, predecessor_activation_hash: null, predecessor_head_ref: null, predecessor_head_hash: null, canonical_body: m.task4CanonicalV1(receipt) }],
        heads: [{ head_ref: pair.headRef, head_hash: pair.headHash, phase: 'A', activation_ref: pair.activationRef, activation_hash: pair.activationHash,
            predecessor_head_ref: null, predecessor_head_hash: null, canonical_body: m.task4CanonicalV1(head) }],
    }] };
}
test('Task4 observer records actual fixed queries, current pair and settlement before linking observations', async (t) => {
    const m = await load(), ready = JSON.parse(GOLDEN_READY);
    ready.fixture.seedDigest = hash(GOLDEN_SEED); ready.fixture.privilegeDigest = hash(GOLDEN_GRANTS);
    const pair = currentPairRows(m, ready), recipes = m.task4ObserverSqlRecipesV1();
    const rows = rawDatabaseRows(); rows.current_pair = pair.rows; rows.optional_step_metrics = [{ relation: null }];
    rows.identity = [{ database: ready.database.name, currentUser: ready.database.role, sessionUser: ready.database.role,
        host: '127.0.0.1', port: ready.setup.postgres.port, serverVersionNum: 170010, serverStartedAt: ready.setup.postgres.serverStartedAt,
        backendPid: 12345, backendStartedAt: '2026-10-19T10:00:00.000000Z', applicationName: 'task4_observer_' + ready.executionId }];
    rows.begin = []; rows.statement_timeout = []; rows.commit = [];
    const makeSql = (data: any, hook = (_id: string) => {}) => ({ unsafe: async (statement: string, parameters: unknown[]) => {
        const recipe = recipes.find((r: any) => r.statement === statement); assert.ok(recipe); assert.deepEqual(parameters, []);
        hook(recipe.queryId); return structuredClone(data[recipe.queryId]);
    } });
    const observer = m.createTask4ObserverV1(ready, makeSql(rows));
    const first = await observer.observe('before'); assert.deepEqual(first.currentPair, pair.pair);
    assert.equal(observer.ledger().complete, false);
    const ref = { sha256: 'a'.repeat(64), bytes: 100 };
    observer.bindObservation('before', ref);
    await assert.rejects(observer.observe('before'), /TASK4_DATABASE_REFUSED/);
    const second = await observer.observe('after'); assert.deepEqual(second.seed, first.seed); observer.bindObservation('after', ref);
    const ledger = observer.ledger(); assert.equal(ledger.complete, true); assert.equal(ledger.queries.length, recipes.length * 2);
    for (const [index, row] of ledger.queries.entries()) {
        assert.equal(row.seq, index + 1); assert.equal(row.backendPid, 12345);
        assert.equal(row.applicationName, 'task4_observer_' + ready.executionId);
        assert.equal(row.statementHash, hash(recipes.find((r: any) => r.queryId === row.queryId).statement));
        assert.equal(row.parametersHash, hash('[]')); assert.ok(row.finishedAt);
        if (['begin', 'statement_timeout', 'commit'].includes(row.queryId)) { assert.equal(row.outcome, 'command'); assert.equal(row.rowCount, null); assert.equal(row.resultHash, null); assert.equal(row.observation, null); }
        else { assert.equal(row.outcome, 'rows'); assert.deepEqual(row.observation, ref); assert.equal(row.resultHash, hash(m.task4CanonicalV1(rows[row.queryId]))); }
    }
    for (const [name, mutate] of [
        ['wrong database', (data: any) => { data.identity[0].database = 'postgres'; }],
        ['unavailable optional relation invented', (data: any) => { data.optional_step_metrics[0].relation = 'step_metrics'; }],
        ['crossed current', (data: any) => { data.current_pair[0].current[0].head_hash = 'f'.repeat(64); }],
        ['duplicate singleton', (data: any) => { data.current_pair[0].current.push(data.current_pair[0].current[0]); }],
        ['changed canonical body', (data: any) => { data.current_pair[0].activations[0].canonical_body += ' '; }],
    ] as const) await t.test(name, async () => {
        const changed = structuredClone(rows); mutate(changed); const observer = m.createTask4ObserverV1(ready, makeSql(changed));
        await assert.rejects(observer.observe('before'), /TASK4_DATABASE_REFUSED/); assert.equal(observer.ledger().complete, false);
    });
    await t.test('original query failure retained, no later reads or forged commit', async () => {
        const original = Object.assign(new Error('private database error'), { code: '42501' }); const calls: string[] = [];
        const observer = m.createTask4ObserverV1(ready, makeSql(rows, id => { calls.push(id); if (id === 'seed_runs') throw original; }));
        await assert.rejects(observer.observe('before'), (error: unknown) => error === original);
        const ledger = observer.ledger(); assert.equal(ledger.complete, false); assert.equal(ledger.queries.at(-1).sqlstate, '42501');
        assert.equal(ledger.queries.at(-1).outcome, 'error'); assert.equal(ledger.queries.at(-1).resultHash, null); assert.ok(!calls.includes('commit'));
        assert.ok(!JSON.stringify(ledger).includes('private database error'));
    });
});

test('Task4 fd4 deadline refuses even when original close has not arrived', async (t) => {
    const m = await load(), { EventEmitter } = await import('node:events');
    const stream = new EventEmitter() as any; stream.destroy = () => { stream.destroyed = true; };
    t.mock.timers.enable({ apis: ['setTimeout'] });
    let error: any = null;
    const completion = m.readTask4FrameV1(stream, 'launch').catch((value: any) => { error = value; });
    try { t.mock.timers.tick(5000); await Promise.resolve(); assert.equal(error?.message, 'TASK4_FRAME_TIMEOUT'); }
    finally { stream.emit('close'); await completion; t.mock.timers.reset(); }
});

test('Task4 Source pins retain original bytes and refuse replacement, symlink and unsafe modes', async () => {
    const m = await load(), fs = await import('node:fs'), os = await import('node:os'), path = await import('node:path');
    const directory = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'mc-task4-component-')));
    const file = path.join(directory, 'member');
    const retained: any[] = [];
    try {
        fs.writeFileSync(file, 'original', { mode: 0o600 });
        const pin = m.captureTask4FileV1(file); retained.push(pin);
        assert.equal(pin.bytes.toString(), 'original'); assert.equal(pin.hash, hash('original')); pin.check();
        fs.writeFileSync(file, 'changed!'); assert.throws(() => pin.check(), /TASK4_SOURCE_DRIFT/);
        fs.unlinkSync(file); fs.writeFileSync(file, 'original', { mode: 0o600 }); assert.throws(() => pin.check(), /TASK4_SOURCE_DRIFT/);
        pin.close(); pin.close(); assert.throws(() => pin.check(), /TASK4_SOURCE_DRIFT/);
        fs.chmodSync(file, 0o666); assert.throws(() => m.captureTask4FileV1(file), /TASK4_SOURCE_DRIFT/);
        fs.chmodSync(file, 0o600); fs.symlinkSync(file, path.join(directory, 'link'));
        assert.throws(() => m.captureTask4FileV1(path.join(directory, 'link')), /TASK4_SOURCE_DRIFT/);
        fs.linkSync(file, path.join(directory, 'hardlink')); assert.throws(() => m.captureTask4FileV1(file), /TASK4_SOURCE_DRIFT/);
    } finally { retained.forEach(pin => pin.close()); fs.rmSync(directory, { recursive: true, force: true }); }
});

test('Task4 complete indexed Source manifest has no omitted, unmerged or symlink member', async () => {
    const m = await load();
    const index = '100644 ' + '1'.repeat(40) + ' 0\tz.ts\0' + '100755 ' + '2'.repeat(40) + ' 0\ta/run.mjs\0';
    const members = [{ path: 'z.ts', sha256: 'a'.repeat(64) }, { path: 'a/run.mjs', sha256: 'b'.repeat(64) }];
    const expected = { schema: 'setfarm.task4.source-input-manifest.v1', entries: [
        { path: 'a/run.mjs', gitMode: '100755', sha256: 'b'.repeat(64) }, { path: 'z.ts', gitMode: '100644', sha256: 'a'.repeat(64) },
    ] };
    assert.equal(m.task4InputManifestV1(index, members), hash(m.task4CanonicalV1(expected)));
    for (const bad of [index.slice(0, -1), index.replace('100644', '120000'), index.replace(' 0\t', ' 1\t'), index.replace('z.ts', '../escape'), index + index])
        assert.throws(() => m.task4InputManifestV1(bad, members), /TASK4_SOURCE_DRIFT/);
    assert.throws(() => m.task4InputManifestV1(index, members.slice(1)), /TASK4_SOURCE_DRIFT/);
    assert.throws(() => m.task4InputManifestV1(index, [members[0], members[0]]), /TASK4_SOURCE_DRIFT/);
});

async function task4ProbeProgram() {
    const ts = await import('typescript');
    const source = readFileSync(new URL('../scripts/render-smoke-owned-fixture.mjs', import.meta.url), 'utf8');
    const ast = ts.createSourceFile('owned.mjs', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
    const values: string[] = [];
    for (const statement of ast.statements) if (ts.isVariableStatement(statement)) for (const declaration of statement.declarationList.declarations)
        if (ts.isIdentifier(declaration.name) && declaration.name.text === 'TASK4_POLICY_PROBE_PROGRAM' && declaration.initializer && ts.isStringLiteral(declaration.initializer)) values.push(declaration.initializer.text);
    assert.equal(values.length, 1, 'one fixed Source probe program');
    assert.ok(!/[\r\n]/.test(values[0])); return values[0];
}

test('Task4 fixed probe waits for original fd3 and each socket close; simulated OS denial only', async (t) => {
    const program = await task4ProbeProgram(), { EventEmitter } = await import('node:events'), vm = await import('node:vm');
    for (const deniedCode of ['EPERM', 'EACCES', 'ECONNREFUSED', 'ETIMEDOUT']) await t.test(deniedCode, async () => {
        const latch = new EventEmitter() as any, sockets: any[] = [], output: string[] = []; let exitCode = 0;
        latch.destroy = () => {};
        const runtime = { argv: ['/fixed/node', '15433', '15434'], stdout: { write(value: string) { output.push(value); } },
            get exitCode() { return exitCode; }, set exitCode(value: number) { exitCode = value; } };
        const require = (name: string) => {
            if (name === 'node:fs') return { createReadStream(_file: unknown, options: any) { assert.deepEqual(JSON.parse(JSON.stringify(options)), { fd: 3, autoClose: true }); return latch; } };
            if (name === 'node:net') return { createConnection(options: any) { assert.equal(options.host, '127.0.0.1'); assert.equal(options.port, 15433 + sockets.length);
                const socket = new EventEmitter() as any; socket.destroy = () => { socket.destroyed = true; }; sockets.push(socket); return socket; } };
            throw new Error('unexpected import');
        };
        vm.runInNewContext(program, { require, process: runtime, Buffer, Date, setTimeout, clearTimeout });
        assert.equal(sockets.length, 0);
        latch.emit('data', Buffer.from('task4-probe-start\n')); latch.emit('end'); await Promise.resolve(); assert.equal(sockets.length, 0);
        latch.emit('close'); await Promise.resolve(); await Promise.resolve(); assert.equal(sockets.length, 1);
        sockets[0].emit('connect'); await Promise.resolve(); assert.equal(sockets.length, 1); assert.equal(output.length, 0);
        sockets[0].emit('close', false); await Promise.resolve(); await Promise.resolve(); assert.equal(sockets.length, 2);
        sockets[1].emit('error', Object.assign(new Error('simulated only'), { code: deniedCode })); await Promise.resolve(); assert.equal(output.length, 0);
        sockets[1].emit('close', true); await Promise.resolve(); await Promise.resolve();
        assert.equal(output.length, 1); const body = JSON.parse(output[0]);
        assert.deepEqual(Object.keys(body), ['schema', 'allowed', 'denied']);
        assert.equal(body.schema, 'mission-control.task4-policy-probe-output.v1'); assert.equal(body.allowed.outcome, 'connected');
        assert.equal(body.allowed.errno, null); assert.equal(body.denied.errno, deniedCode);
        assert.equal(body.denied.outcome, ['EPERM', 'EACCES'].includes(deniedCode) ? 'denied' : 'unknown');
        assert.equal(exitCode, ['EPERM', 'EACCES'].includes(deniedCode) ? 0 : 1);
        assert.ok(output[0].endsWith('\n')); assert.ok(!output[0].includes('simulated only'));
    });
});

test('Task4 fixed probe malformed or incomplete start never opens a socket', async (t) => {
    const program = await task4ProbeProgram(), { EventEmitter } = await import('node:events'), vm = await import('node:vm');
    for (const value of ['task4-probe-start\nextra', 'task4-probe-start', '']) await t.test(JSON.stringify(value), async () => {
        const latch = new EventEmitter() as any; latch.destroy = () => {}; let connections = 0;
        const runtime = { argv: ['/fixed/node', '15433', '15434'], stdout: { write() { assert.fail('no outcome on refused latch'); } }, exitCode: 0 };
        vm.runInNewContext(program, { require(name: string) { return name === 'node:fs' ? { createReadStream() { return latch; } } : { createConnection() { connections++; } }; }, process: runtime, Buffer, Date, setTimeout, clearTimeout });
        latch.emit('data', Buffer.from(value)); latch.emit('end'); latch.emit('close');
        await Promise.resolve(); await Promise.resolve(); assert.equal(connections, 0); assert.equal(runtime.exitCode, 1);
    });
});

test('Task4 original outer command has only four exact scenario forms', async () => {
    const m = await load(), node = '/fixed/node', root = '/fixed/mc', base = node + ' ' + root + '/scripts/render-smoke.mjs';
    for (const [suffix, scenario] of [['', 'pass'], [' --owned-fixture-v1', 'pass'], [' --owned-fixture-assertion-failure-v1', 'assertion_failure'], [' --owned-fixture-owned-cancel-v1', 'owned_cancel']])
        assert.equal(m.task4ScenarioV1(base + suffix, node, root), scenario);
    for (const command of [base + ' ', base + ' --owned-fixture-ready-v1', base + ' --owned-fixture-v1 extra', base.replace('/fixed/node', 'node'), base.replace('/scripts/', '/scripts/../scripts/'), base + '\n'])
        assert.throws(() => m.task4ScenarioV1(command, node, root), /TASK4_BINDING_REFUSED/);
});

test('Task4 fixed evidence publication is canonical exclusive private and refuses directory replacement', async () => {
    const m = await load(), fs = await import('node:fs'), os = await import('node:os'), path = await import('node:path');
    const parent = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'mc-task4-publication-'))), root = path.join(parent, 'owned');
    fs.mkdirSync(root, { mode: 0o700 }); let pin: any;
    try {
        pin = m.captureTask4DirectoryV1(root, true);
        const value = { z: false, a: 1 }, ref = m.publishTask4FixedV1(pin, 'policy-probe-request.json', value);
        const body = fs.readFileSync(path.join(root, 'policy-probe-request.json'));
        assert.equal(body.toString(), '{"a":1,"z":false}\n'); assert.deepEqual(ref, { sha256: hash(body), bytes: body.length });
        assert.equal(fs.statSync(path.join(root, 'policy-probe-request.json')).mode & 0o777, 0o600);
        assert.throws(() => m.publishTask4FixedV1(pin, 'policy-probe-request.json', value), /TASK4_RESULT_PUBLICATION_FAILED/);
        for (const name of ['../outside', 'other.json', 'inner-result.json/extra']) assert.throws(() => m.publishTask4FixedV1(pin, name, value));
        fs.renameSync(root, root + '-retained'); fs.mkdirSync(root, { mode: 0o700 });
        assert.throws(() => pin.check(), /TASK4_SOURCE_DRIFT/);
        assert.throws(() => m.publishTask4FixedV1(pin, 'inner-result.json', value)); assert.ok(!fs.existsSync(path.join(root, 'inner-result.json')));
    } finally { pin?.close(); fs.rmSync(parent, { recursive: true, force: true }); }
});

test('Task4 measured build binds complete directory inventory and original identities', async () => {
    const m = await load(), fs = await import('node:fs'), os = await import('node:os'), path = await import('node:path');
    const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'mc-task4-build-')));
    try {
        fs.mkdirSync(path.join(root, 'dist')); fs.mkdirSync(path.join(root, 'dist-server'));
        fs.writeFileSync(path.join(root, 'dist/index.html'), '<html>owned</html>'); fs.writeFileSync(path.join(root, 'dist-server/index.js'), 'export {};');
        const digest = createHash('sha256').update('mission-control.internal-production-build-content.v1\0');
        for (const name of ['dist-server/index.js', 'dist/index.html']) { const bytes = fs.readFileSync(path.join(root, name)); digest.update(name).update('\0').update(String(bytes.length)).update('\0').update(bytes).update('\0'); }
        const identity = { schema: 'mission-control.internal-production-build-identity.v1', sourceSha: '1'.repeat(40), treeHash: '2'.repeat(40), buildHash: digest.digest('hex') };
        fs.writeFileSync(path.join(root, 'dist-server/internal-production-build-identity.v1.json'), JSON.stringify(identity));
        const measured = m.captureTask4BuildV1(root); assert.deepEqual(measured.identity, identity); assert.equal(measured.identityHash, hash(JSON.stringify(identity))); measured.check();
        fs.writeFileSync(path.join(root, 'dist/extra.js'), 'unexpected'); assert.throws(() => measured.check(), /TASK4_SOURCE_DRIFT/); fs.unlinkSync(path.join(root, 'dist/extra.js'));
        fs.renameSync(path.join(root, 'dist/index.html'), path.join(root, 'retained.html')); fs.copyFileSync(path.join(root, 'retained.html'), path.join(root, 'dist/index.html'));
        assert.throws(() => measured.check(), /TASK4_SOURCE_DRIFT/);
        fs.writeFileSync(path.join(root, 'dist/index.html'), 'changed'); assert.throws(() => m.captureTask4BuildV1(root), /TASK4_SOURCE_DRIFT/);
    } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test('Task4 Source observation binds exact raw Git head/tree/status and every indexed byte hash', async () => {
    const m = await load(), source = JSON.parse(GOLDEN_LAUNCH).setfarm;
    const index = '100644 ' + 'a'.repeat(40) + ' 0\tsrc/main.ts\0', members = [{ path: 'src/main.ts', sha256: 'b'.repeat(64) }];
    source.inputManifestHash = m.task4InputManifestV1(index, members);
    const observed = { head: source.sourceSha + '\n', tree: source.treeHash + '\n', status: '', index, members };
    m.assertTask4SourceObservationV1(source, observed, 'sf');
    for (const change of [
        (v: any) => { v.head = 'c'.repeat(40) + '\n'; }, (v: any) => { v.tree += '\n'; }, (v: any) => { v.status = ' M src/main.ts\n'; },
        (v: any) => { v.members = []; }, (v: any) => { v.members[0].sha256 = 'c'.repeat(64); }, (v: any) => { v.index = v.index.replace(' 0\t', ' 2\t'); },
    ]) { const value = structuredClone(observed); change(value); assert.throws(() => m.assertTask4SourceObservationV1(source, value, 'sf'), /TASK4_SOURCE_DRIFT/); }
});

test('Task4 Source entry refuses all extra argv and loader environments before any work', async () => {
    const m = await load();
    for (const argv of [[], ['--owned-fixture-v1'], ['--owned-fixture-assertion-failure-v1'], ['--owned-fixture-owned-cancel-v1'], ['--owned-fixture-ready-v1']])
        assert.equal(m.parseTask4InvocationV1(argv, [], {}).inner, argv[0] === '--owned-fixture-ready-v1');
    for (const argv of [['--standalone'], ['--owned-fixture-v1', '/tmp/path'], ['--owned-fixture-ready-v1', '--extra']]) assert.throws(() => m.parseTask4InvocationV1(argv, [], {}));
    assert.throws(() => m.parseTask4InvocationV1([], ['--import', 'tsx'], {}));
    for (const key of ['NODE_OPTIONS', 'NODE_PATH', 'LD_PRELOAD', 'DYLD_INSERT_LIBRARIES', 'DYLD_LIBRARY_PATH', 'MC_RENDER_BASE_URL', 'MC_RENDER_ROUTES', 'MC_RENDER_SCREENSHOT_DIR'])
        assert.throws(() => m.parseTask4InvocationV1([], [], { [key]: '' }));
});

test('Task4 process binding uses raw command and independently observed identity, never supplied pid adoption', async () => {
    const m = await load(), node = '/fixed/node', rawArgs = node + ' /fixed/mc/scripts/render-smoke.mjs --owned-fixture-ready-v1';
    const observed = { pid: 41006, ppid: 41005, pgid: 41004, uid: 501, startedAt: '2026-10-19T09:00:00.000Z', executable: node, rawArgs };
    const expected = { pid: 41006, ppid: 41005, uid: 501, executable: node, executableHash: 'a'.repeat(64), rawArgs };
    const pin = m.bindTask4ProcessV1(observed, expected);
    assert.deepEqual(pin, { pid: 41006, ppid: 41005, pgid: 41004, uid: 501, startedAt: observed.startedAt, executable: node, executableHash: expected.executableHash, commandHash: hash(rawArgs) });
    for (const change of [(v: any) => { v.pid++; }, (v: any) => { v.ppid++; }, (v: any) => { v.uid++; }, (v: any) => { v.executable = '/other/node'; },
        (v: any) => { v.rawArgs += ' '; }, (v: any) => { v.rawArgs = v.rawArgs.replace('/fixed/node', 'node'); }, (v: any) => { v.startedAt = 'invalid'; }]) {
        const value = structuredClone(observed); change(value); assert.throws(() => m.bindTask4ProcessV1(value, expected), /TASK4_BINDING_REFUSED/);
    }
});

test('Task4 Source capture rechecks original byte identities and refuses dirty observations before imports', async () => {
    const m = await load(), ts = await import('typescript'), vm = await import('node:vm'), fs = await import('node:fs'), os = await import('node:os'), path = await import('node:path');
    const source = readFileSync(new URL('../scripts/render-smoke-owned-fixture.mjs', import.meta.url), 'utf8');
    const ast = ts.createSourceFile('owned.mjs', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
    const names = ['task4FileSnapshotV1', 'task4SameFileV1', 'captureTask4SourceInputsV1'];
    const declarations = names.map(name => {
        const matches = ast.statements.filter(node => ts.isFunctionDeclaration(node) && node.name?.text === name);
        assert.equal(matches.length, 1, 'one fixed ' + name); return matches[0].getText(ast).replace(/^export /, '');
    });
    const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'mc-task4-source-'))); fs.mkdirSync(path.join(root, 'src')); fs.writeFileSync(path.join(root, 'src/main.ts'), 'original', { mode: 0o644 });
    const index = '100644 ' + 'a'.repeat(40) + ' 0\tsrc/main.ts\0'; let dirty = false;
    const expected = { root, sourceSha: '1'.repeat(40), treeHash: '2'.repeat(40), inputManifestHash: m.task4InputManifestV1(index, [{ path: 'src/main.ts', sha256: hash('original') }]) };
    const bindings = {
        fs, path, Buffer, process, captureTask4FileV1: m.captureTask4FileV1, captureTask4DirectoryV1: m.captureTask4DirectoryV1,
        task4CanonicalV1: m.task4CanonicalV1, task4InputManifestV1: m.task4InputManifestV1, assertTask4SourceObservationV1: m.assertTask4SourceObservationV1,
        fail(code: string) { throw Error(code); }, requireValue(value: unknown, code = 'TASK4_SOURCE_DRIFT') { if (!value) throw Error(code); },
        task4GitV1(directory: string, args: string[]) { assert.equal(directory, root); const command = args.join(' ');
            if (command === 'rev-parse HEAD') return expected.sourceSha + '\n'; if (command === 'rev-parse HEAD^{tree}') return expected.treeHash + '\n';
            if (command === 'status --porcelain=v1 --untracked-files=no') return dirty ? ' M src/main.ts\n' : '';
            if (command === 'ls-files --stage -z') return index; throw Error('unexpected Git command'); },
    };
    const capture = vm.compileFunction(declarations.join('\n') + '\nreturn captureTask4SourceInputsV1;', Object.keys(bindings))(...Object.values(bindings));
    let pinned: any;
    try {
        pinned = capture(expected, 'sf'); pinned.check(); dirty = true; assert.throws(() => pinned.check(), /TASK4_SOURCE_DRIFT/); dirty = false;
        fs.renameSync(path.join(root, 'src/main.ts'), path.join(root, 'retained')); fs.writeFileSync(path.join(root, 'src/main.ts'), 'original', { mode: 0o644 });
        assert.throws(() => pinned.check(), /TASK4_SOURCE_DRIFT/); pinned.close(); assert.throws(() => pinned.check(), /TASK4_SOURCE_DRIFT/);
    } finally { pinned?.close(); fs.rmSync(root, { recursive: true, force: true }); }
});

test('Task4 bootstrap validates Source/build before measured module import and original self observation', async () => {
    const m = await load(), ts = await import('typescript'), vm = await import('node:vm'), path = await import('node:path');
    const text = readFileSync(new URL('../scripts/render-smoke-owned-fixture.mjs', import.meta.url), 'utf8'), ast = ts.createSourceFile('owned.mjs', text, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
    const nodes = ast.statements.filter(node => ts.isFunctionDeclaration(node) && node.name?.text === 'prepareTask4BootstrapV1');
    assert.equal(nodes.length, 1); const code = nodes[0].getText(ast).replace(/^export /, '');
    const launch = JSON.parse(GOLDEN_LAUNCH), node = '/Users/setrox/ai/setrox/.task4-toolchain-v1/Cellar/node/26.4.0/bin/node', executableHash = '59cd4fb59cf5bc239f43d5db8c0cd8c23c22db79419612b92da3b7cf34de8553';
    const log: string[] = []; let drift = false;
    const identity = { schema: 'mission-control.internal-production-build-identity.v1', sourceSha: launch.missionControl.sourceSha, treeHash: launch.missionControl.treeHash, buildHash: launch.missionControl.buildHash };
    const loaded = { status: 'available', response: { loadedBuild: { buildIdentity: identity, buildIdentityHash: launch.missionControl.buildIdentityHash } } };
    const binding = {
        TASK4_MC_ROOT: launch.missionControl.root,
        TASK4_NODE: (await task4FixedSourcePaths()).TASK4_NODE, TASK4_NODE_HASH: executableHash, path,
        process: { argv: [node, '/fixture/mc/scripts/render-smoke.mjs', '--owned-fixture-v1'], execArgv: [], env: {}, execPath: node, pid: 41001, ppid: 41000, getuid: () => 501 },
        fs: { realpathSync: (value: string) => value, existsSync: () => false },
        parseTask4InvocationV1: m.parseTask4InvocationV1, parseTask4FrameV1: m.parseTask4FrameV1, task4CanonicalV1: m.task4CanonicalV1, Buffer,
        task4ScenarioV1: m.task4ScenarioV1, bindTask4ProcessV1: m.bindTask4ProcessV1, hash,
        requireValue(value: unknown, code: string) { if (!value) throw Error(code); },
        captureTask4SourceInputsV1(_source: any, kind: string) { log.push('source:' + kind); return { files: new Map(), rootPin: {}, close() {}, check() { log.push('check:' + kind); if (drift) throw Error('TASK4_SOURCE_DRIFT'); } }; },
        captureTask4BuildV1() { log.push('build'); return { identity, identityHash: launch.missionControl.buildIdentityHash, check() { log.push('check:build'); } }; },
        task4FileSnapshotV1() { log.push('node'); return { hash: executableHash, identity: {} }; }, task4SameFileV1: () => true,
        async task4RuntimeModulesV1() { log.push('import'); return { native: { async observeUiProcessV1() { log.push('observe'); return { pid: 41001, ppid: 41000, pgid: 41001, uid: 501, startedAt: '2026-10-19T09:00:00.000Z', executable: node, rawArgs: node + ' /fixture/mc/scripts/render-smoke.mjs --owned-fixture-v1' }; } }, loaded: { productBuildAuthorityV2LoadedBuildStartupStateV1: () => loaded } }; },
    };
    const bootstrap = vm.compileFunction(code + '\nreturn prepareTask4BootstrapV1;', Object.keys(binding))(...Object.values(binding));
    for (const observedPath of ['/opt/homebrew/Cellar/node/26.4.0/bin/node', '/Users/setrox/ai/setrox/.task4-toolchain-v2/Cellar/node/26.4.0/bin/node']) {
        binding.process.execPath = observedPath;
        await assert.rejects(bootstrap(launch), /TASK4_BINDING_REFUSED/); assert.equal(log.length, 0);
    }
    binding.process.execPath = node;
    binding.fs.realpathSync = (value: string) => value === node ? '/foreign/node' : value;
    await assert.rejects(bootstrap(launch), /TASK4_BINDING_REFUSED/); assert.equal(log.length, 0);
    binding.fs.realpathSync = (value: string) => value;
    const result = await bootstrap(launch); assert.equal(result.scenario, 'pass'); assert.ok(log.indexOf('build') < log.indexOf('import')); assert.ok(log.indexOf('import') < log.indexOf('observe'));
    assert.equal(result.owner.commandHash, hash(node + ' /fixture/mc/scripts/render-smoke.mjs --owned-fixture-v1'));
    drift = true; assert.throws(() => result.check(), /TASK4_SOURCE_DRIFT/); drift = false;
    log.length = 0; const wrong = structuredClone(launch); wrong.missionControl.root = '/other/mc';
    await assert.rejects(bootstrap(wrong), /TASK4_BINDING_REFUSED/); assert.equal(log.length, 0);
    loaded.response.loadedBuild.buildIdentityHash = '0'.repeat(64); await assert.rejects(bootstrap(launch), /TASK4_SOURCE_DRIFT/);
    loaded.response.loadedBuild.buildIdentityHash = launch.missionControl.buildIdentityHash;
    const ready = JSON.parse(GOLDEN_READY);
    for (const owner of [ready.setup.owner, ready.fixtureOwner]) { owner.executable = node; owner.executableHash = executableHash; }
    const outerCommand = node + ' /fixture/mc/scripts/render-smoke.mjs --owned-fixture-owned-cancel-v1';
    ready.setup.owner.commandHash = hash(outerCommand);
    const fixtureCommand = node + ' --import tsx --test --test-concurrency=1 tests/fixtures/mission-control-render-smoke-owned-v1.ts';
    ready.fixtureOwner.commandHash = hash(fixtureCommand); ready.setupDescriptorHash = hash(m.task4CanonicalV1(ready.setup) + '\n');
    const raw = (owner: any, rawArgs: string) => ({ pid: owner.pid, ppid: owner.ppid, pgid: owner.pgid, uid: owner.uid, startedAt: owner.startedAt, executable: owner.executable, rawArgs });
    const observations = new Map([
        [41001, raw(ready.setup.owner, outerCommand)], [41005, raw(ready.fixtureOwner, fixtureCommand)],
        [41006, raw({ ...ready.fixtureOwner, pid: 41006, ppid: 41005 }, node + ' /fixture/mc/scripts/render-smoke.mjs --owned-fixture-ready-v1')],
        [41004, raw({ ...ready.fixtureOwner, pid: 41004, ppid: 41001 }, node + ' --import tsx /fixture/sf/scripts/run-isolated-postgres-tests.ts -- node --import tsx --test --test-concurrency=1 tests/fixtures/mission-control-render-smoke-owned-v1.ts')],
    ]);
    binding.process.argv[2] = '--owned-fixture-ready-v1'; binding.process.pid = 41006; binding.process.ppid = 41005;
    binding.task4RuntimeModulesV1 = async () => ({ native: { observeUiProcessV1: async (pid: number) => observations.get(pid) } as any, loaded: { productBuildAuthorityV2LoadedBuildStartupStateV1: () => loaded } });
    const innerBootstrap = vm.compileFunction(code + '\nreturn prepareTask4BootstrapV1;', Object.keys(binding))(...Object.values(binding));
    assert.equal((await innerBootstrap(ready)).scenario, 'owned_cancel');
    const crossed = structuredClone(ready); crossed.fixtureOwner.executableHash = '0'.repeat(64);
    await assert.rejects(innerBootstrap(crossed), /TASK4_BINDING_REFUSED/);
});

test('Task4 artifact inventory retains exact native leaves and refuses residue or changed bytes', async () => {
    const m = await load(), native = await import('../scripts/ui-regression-lifecycle.mjs'), fs = await import('node:fs'), os = await import('node:os'), path = await import('node:path');
    const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'mc-task4-artifacts-')));
    try {
        const evidence = m.createTask4EvidenceV1(native.createUiArtifactStoreV1(root));
        const json = evidence.put({ schema: 'component.simulated', value: 1 }), png = evidence.png(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, 0]));
        const id = '12345678-1234-4234-8234-123456789abc', value = { schema: 'component.simulated.intent' };
        evidence.store.record('children/' + id + '.intent.json', value);
        const inventory = evidence.inventory(); assert.deepEqual(inventory.json, [json]); assert.deepEqual(inventory.png, [png]);
        assert.equal(inventory.native[0].spawnId, id); assert.equal(inventory.native[0].observed, null); assert.equal(inventory.native[0].closed, null);
        assert.equal(inventory.totalBytes, json.bytes + png.bytes + inventory.native[0].intent.bytes);
        const name = path.join(root, 'artifacts', json.sha256 + '.json'); fs.writeFileSync(name, '{}\n');
        assert.throws(() => evidence.inventory(), /TASK4_INTEGRITY_FAILED/);
        assert.throws(() => evidence.put({ another: true }), /TASK4_INTEGRITY_FAILED/);
    } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test('Task4 evidence caps fail before overflow publication and never infer complete cleanup', async () => {
    const m = await load(), native = await import('../scripts/ui-regression-lifecycle.mjs'), fs = await import('node:fs'), os = await import('node:os'), path = await import('node:path');
    const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'mc-task4-cap-')));
    try {
        const evidence = m.createTask4EvidenceV1(native.createUiArtifactStoreV1(root));
        for (let i = 0; i < 64; i++) evidence.put({ i });
        assert.throws(() => evidence.put({ i: 64 }), /TASK4_INTEGRITY_FAILED/); assert.equal(fs.readdirSync(path.join(root, 'artifacts')).length, 64);
        assert.throws(() => evidence.inventory(), /TASK4_INTEGRITY_FAILED/);
    } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test('Task4 original child requires matching exit AND close and bounded raw streams', async (t) => {
    const m = await load(), { EventEmitter } = await import('node:events');
    for (const mode of ['ok', 'close_only', 'mismatch', 'error', 'overflow']) await t.test(mode, async () => {
        const child = new EventEmitter() as any; child.pid = 12345; child.stdout = new EventEmitter(); child.stderr = new EventEmitter();
        const retained = m.retainTask4ChildV1(child, 1024); let resolved = false;
        const outcome = retained.wait(1000).then((value: any) => { resolved = true; return value; }, (error: any) => { resolved = true; throw error; });
        outcome.catch(() => {}); child.stdout.emit('data', Buffer.from(mode === 'overflow' ? 'x'.repeat(1025) : 'original stdout'));
        child.stderr.emit('data', Buffer.from('original stderr'));
        if (mode === 'error') child.emit('error', Error('original effect failed'));
        if (mode !== 'close_only') child.emit('exit', 0, null);
        await Promise.resolve(); assert.equal(resolved, false, 'exit does not replace close');
        child.emit('close', mode === 'mismatch' ? 1 : 0, null);
        if (mode === 'ok') {
            assert.deepEqual(await outcome, { code: 0, signal: null, exitObserved: true, closeObserved: true });
            assert.equal(retained.originals().stdout, 'original stdout'); assert.equal(retained.originals().stderr, 'original stderr');
        } else await assert.rejects(outcome, /TASK4_CHILD_UNKNOWN/);
    });
});

test('Task4 original child deadline remains unknown without signalling or adopting any process', async (t) => {
    const m = await load(), { EventEmitter } = await import('node:events');
    const child = new EventEmitter() as any; child.stdout = new EventEmitter(); child.stderr = new EventEmitter(); child.kill = () => assert.fail('no fallback signal');
    const retained = m.retainTask4ChildV1(child, 1024); t.mock.timers.enable({ apis: ['setTimeout'] });
    try { const completion = retained.wait(50); t.mock.timers.tick(50); await assert.rejects(completion, /TASK4_CHILD_UNKNOWN/);
        child.emit('exit', 0, null); child.emit('close', 0, null); await assert.rejects(retained.wait(50), /TASK4_CHILD_UNKNOWN/);
    } finally { t.mock.timers.reset(); }
});

test('Task4 filesystem ledger observes raw sync writes and rejects other project material', async () => {
    const m = await load(), native = await import('../scripts/ui-regression-lifecycle.mjs'), fs = await import('node:fs'), os = await import('node:os'), path = await import('node:path');
    const parent = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'mc-task4-filesystem-'))), ready = JSON.parse(GOLDEN_READY);
    const root = path.join(parent, 'task4-' + ready.executionId); fs.mkdirSync(root, { mode: 0o700 }); fs.mkdirSync(path.join(root, 'inner'), { mode: 0o700 });
    ready.setup.resourceRoot.path = root;
    try {
        for (const name of ['server-home', 'server-runtime', 'home', 'profile', 'tmp']) fs.mkdirSync(path.join(root, 'inner', name), { mode: 0o700 });
        const evidence = m.createTask4EvidenceV1(native.createUiArtifactStoreV1(path.join(root, 'inner'))), ledger = m.createTask4FilesystemV1(ready, evidence);
        ledger.capture('server_home', 'before_server'); ledger.capture('server_runtime', 'before_server');
        assert.equal(ledger.value().complete, false);
        fs.mkdirSync(path.join(root, 'inner/server-runtime/setfarm'), { mode: 0o700 });
        const sync = { finishedIds: [], runningIds: ['ac8cea43-7686-4d27-8092-1e3dd9207ca4', 'ad47fe65-4ec4-4fb5-89da-fff71eb4e79a'], savedAt: new Date().toISOString() };
        const raw = JSON.stringify(sync), file = path.join(root, 'inner/server-runtime/setfarm/mc-sync-state.json'); fs.writeFileSync(file, raw, { mode: 0o600 });
        ledger.checkpoint('/'); ledger.capture('server_runtime', 'after_route');
        for (const id of ['server_home', 'server_runtime', 'native_home', 'native_profile', 'native_tmp']) ledger.capture(id, 'after_server_close');
        const value = ledger.value(); assert.equal(value.complete, true); assert.equal(value.syncState.before, null);
        assert.equal(value.syncState.after.sha256, hash(raw)); assert.equal(value.syncState.after.bytes, Buffer.byteLength(raw));
        assert.deepEqual(value.syncState.checkpoints[0].runningIds, sync.runningIds); assert.equal(value.syncState.checkpoints[0].route, '/');
        const other = m.createTask4FilesystemV1(ready, evidence); other.capture('server_home', 'before_server'); other.capture('server_runtime', 'before_server');
        fs.writeFileSync(path.join(root, 'inner/server-runtime/generated-project.txt'), 'forbidden');
        assert.throws(() => other.capture('server_runtime', 'after_route'), /TASK4_RESOURCE_REFUSED/); assert.equal(other.value().complete, false);
    } finally { fs.rmSync(parent, { recursive: true, force: true }); }
});

test('Task4 pre-resource measured loader has only pure bootstrap imports; configured parser is deferred', async () => {
    const ts = await import('typescript'), source = readFileSync(new URL('../scripts/render-smoke-owned-fixture.mjs', import.meta.url), 'utf8');
    const ast = ts.createSourceFile('owned.mjs', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
    const functions = ast.statements.filter(node => ts.isFunctionDeclaration(node) && node.name?.text === 'task4RuntimeModulesV1'); assert.equal(functions.length, 1);
    const paths: string[] = [];
    const visit = (node: import('typescript').Node) => {
        if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword) {
            const literals: string[] = []; const collect = (child: import('typescript').Node) => { if (ts.isStringLiteral(child)) literals.push(child.text); ts.forEachChild(child, collect); };
            collect(node); paths.push(...literals);
        }
        ts.forEachChild(node, visit);
    };
    visit(functions[0]);
    assert.deepEqual(paths, ['dist-server/scripts/ui-regression-lifecycle.mjs', 'dist-server/services/control-ui-worker-protocol.js', 'dist-server/services/product-build-authority-v2-delivery-evidence-v1.js']);
    const parserSource = readFileSync(new URL('../server/services/setfarm-product-build-authority.ts', import.meta.url), 'utf8');
    assert.match(parserSource, /import \{ config \} from "\.\.\/config\.js"/);
});

test('Task4 listener census parses complete original lsof rows and refuses foreign, wildcard or partial results', async () => {
    const m = await load();
    const original = { stdout: 'p41006\ncnode\nf21\nn127.0.0.1:13081\n', stderr: '', exit: { code: 0, signal: null, exitObserved: true, closeObserved: true } };
    assert.equal(m.classifyTask4ListenerV1(original, 13081, 41006), 'listening');
    assert.equal(m.classifyTask4ListenerV1({ stdout: '', stderr: '', exit: { ...original.exit, code: 1 } }, 13081, null), 'absent');
    for (const change of [
        (v: any) => { v.stdout = v.stdout.replace('41006', '999'); }, (v: any) => { v.stdout = v.stdout.replace('127.0.0.1', '*'); },
        (v: any) => { v.stdout += 'p999\ncnode\nf12\nn127.0.0.1:13081\n'; }, (v: any) => { v.stdout = v.stdout.slice(0, -1); },
        (v: any) => { v.stderr = 'warning'; }, (v: any) => { v.exit.closeObserved = false; }, (v: any) => { v.exit.code = 1; },
    ]) { const value = structuredClone(original); change(value); assert.throws(() => m.classifyTask4ListenerV1(value, 13081, 41006), /TASK4_RESOURCE_REFUSED/); }
    assert.throws(() => m.classifyTask4ListenerV1({ ...original, stdout: '' }, 13081, null), /TASK4_RESOURCE_REFUSED/);
});

test('Task4 browser fence registers before navigation and pairs exact original request responses', async () => {
    const m = await load(), { EventEmitter } = await import('node:events'), { parseProductBuildAuthorityV2 } = await import('../server/services/setfarm-product-build-authority.js');
    const ready = JSON.parse(GOLDEN_READY), context = new EventEmitter() as any, page = new EventEmitter() as any;
    let callback: any, websocket: any; context.route = async (pattern: string, fn: any) => { assert.equal(pattern, '**/*'); callback = fn; };
    context.routeWebSocket = async (_pattern: string, fn: any) => { websocket = fn; };
    const fence = m.createTask4BrowserFenceV1(ready, parseProductBuildAuthorityV2); await fence.attach(context, page, '/');
    assert.equal(typeof callback, 'function'); assert.equal(typeof websocket, 'function');
    const request = { method: () => 'GET', url: () => 'http://127.0.0.1:13081/api/overview' }; let continued = 0;
    context.emit('request', request); await callback({ request: () => request, continue: async () => { continued++; }, abort: async () => assert.fail('known request') });
    context.emit('response', { request: () => request, url: request.url, status: () => 200, body: async () => Buffer.from('{"value":0}') });
    await fence.settle(); assert.equal(continued, 1); const rows = fence.value().browser;
    assert.equal(rows.length, 2); assert.equal(rows[0].stage, 'intercept'); assert.equal(rows[1].stage, 'response'); assert.equal(rows[0].requestId, rows[1].requestId);
    assert.equal(rows[1].bodyHash, hash('{"value":0}')); assert.equal(fence.value().complete, true);
    const denied = { method: () => 'POST', url: request.url }; let aborted = 0; context.emit('request', denied);
    await callback({ request: () => denied, continue: async () => assert.fail('mutation'), abort: async () => { aborted++; } });
    assert.equal(aborted, 1); await assert.rejects(fence.settle(), /TASK4_NETWORK_REFUSED/); assert.equal(fence.value().complete, false);
});

test('Task4 browser legacy409 budget requires exact route/body and refuses operational404 or extra diagnostics', async (t) => {
    const m = await load(), { EventEmitter } = await import('node:events'), { parseProductBuildAuthorityV2 } = await import('../server/services/setfarm-product-build-authority.js');
    for (const mode of ['legacy', 'wrong_body', 'operational404', 'extra_console']) await t.test(mode, async () => {
        const ready = JSON.parse(GOLDEN_READY), context = new EventEmitter() as any, page = new EventEmitter() as any; let callback: any;
        context.route = async (_p: string, fn: any) => { callback = fn; }; context.routeWebSocket = async () => {};
        const route = '/setfarm/runs/ac8cea43-7686-4d27-8092-1e3dd9207ca4', url = 'http://127.0.0.1:13081/api/setfarm/runs/ac8cea43-7686-4d27-8092-1e3dd9207ca4/' + (mode === 'operational404' ? 'operational-snapshot' : 'product-build-authority');
        const fence = m.createTask4BrowserFenceV1(ready, parseProductBuildAuthorityV2); await fence.attach(context, page, route);
        const request = { method: () => 'GET', url: () => url }; context.emit('request', request); await callback({ request: () => request, continue: async () => {}, abort: async () => assert.fail('registered path') });
        const body = JSON.stringify({ status: 'unavailable', code: 'SETFARM_PRODUCT_BUILD_AUTHORITY_NOT_READY', reason: mode === 'wrong_body' ? 'other' : 'not_ready', upstreamStatus: 409, upstreamCode: 'RUNTIME_PACKET_RUN_NOT_V3' });
        context.emit('response', { request: () => request, url: () => url, status: () => mode === 'operational404' ? 404 : 409, body: async () => Buffer.from(body) });
        const diagnostic = { type: () => 'error', text: () => 'Failed to load resource: the server responded with a status of 409 (Conflict)', location: () => ({ url }) };
        page.emit('console', diagnostic); if (mode === 'extra_console') page.emit('console', diagnostic);
        if (mode === 'legacy') await fence.settle(); else await assert.rejects(fence.settle(), /TASK4_NETWORK_REFUSED/);
    });
});

test('Task4 Source server policy confines network to original PG/mock and writes to two private roots', async () => {
    const m = await load(), setup = JSON.parse(GOLDEN_SETUP), policy = m.task4ServerPolicyV1(setup, 15433);
    assert.match(policy, /\(deny network\*\)/); assert.match(policy, /\(deny file-write\*\)/);
    assert.ok(policy.includes('(remote ip "localhost:15432")')); assert.ok(policy.includes('(remote ip "localhost:15433")'));
    assert.ok(policy.includes('(local ip "localhost:13081")')); assert.ok(!policy.includes('localhost:*'));
    assert.ok(policy.includes('"' + setup.resourceRoot.path + '/inner/server-home"')); assert.ok(policy.includes('"' + setup.resourceRoot.path + '/inner/server-runtime"'));
    for (const port of [0, 3080, 3333, 5432, 13081, 15432, 18789, 65536]) assert.throws(() => m.task4ServerPolicyV1(setup, port), /TASK4_RESOURCE_REFUSED/);
});

test('Task4 configured parser import occurs only after authenticated inner and isolated environment assignment', async () => {
    const ts = await import('typescript'), vm = await import('node:vm'), path = await import('node:path');
    const text = readFileSync(new URL('../scripts/render-smoke-owned-fixture.mjs', import.meta.url), 'utf8');
    const ast = ts.createSourceFile('owned.mjs', text, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
    const selected = ast.statements.filter(node => ts.isFunctionDeclaration(node) && ['task4ServerEnvironmentV1', 'task4ConfiguredParserV1'].includes(node.name?.text ?? ''));
    assert.equal(selected.length, 2);
    const events: string[] = [], ready = JSON.parse(GOLDEN_READY), originalEnv: any = { HOME: '/ambient', GATEWAY_TOKEN: 'must-never-reach-import', DATABASE_URL: 'private' };
    const bindings = { path, requireValue: (v: unknown, c: string) => { if (!v) throw Error(c); }, process: { env: originalEnv },
        fs: { existsSync: () => false }, pathToFileURL: (p: string) => ({ href: p }),
        task4ImportConfiguredV1: async (url: string) => { events.push('import'); assert.equal(originalEnv.HOME, ready.setup.resourceRoot.path + '/inner/server-home');
            assert.equal(originalEnv.GATEWAY_TOKEN, undefined); assert.equal(originalEnv.DATABASE_URL, undefined); assert.equal(originalEnv.SETFARM_PG_URL, undefined);
            assert.equal(url, '/fixture/mc/dist-server/services/setfarm-product-build-authority.js'); return { parseProductBuildAuthorityV2: (x: any) => x }; } };
    const fn = vm.compileFunction(selected.map(n => n.getText(ast)).join('\n') + '\nreturn task4ConfiguredParserV1;', Object.keys(bindings))(...Object.values(bindings));
    const context = { ready, root: '/fixture/mc', check() { events.push('check'); } };
    const parser = await fn(context, 15433); assert.equal(typeof parser, 'function'); assert.deepEqual(events, ['check', 'import', 'check']);
    assert.equal(originalEnv.SETFARM_PG_URL, undefined);
    events.length = 0; await assert.rejects(fn({ ...context, ready: null }, 15433), /TASK4_BINDING_REFUSED/); assert.deepEqual(events, []);
    bindings.fs.existsSync = () => true; await assert.rejects(fn(context, 15433), /TASK4_RESOURCE_REFUSED/); assert.deepEqual(events, []);
});

test('Task4 six-route runtime retains first completed screenshot before owned failure or cancellation and closes original contexts', async (t) => {
    const ts = await import('typescript'), vm = await import('node:vm'), m = await load();
    const source = readFileSync(new URL('../scripts/render-smoke-owned-fixture.mjs', import.meta.url), 'utf8'), ast = ts.createSourceFile('fixture.mjs', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
    const nodes = ast.statements.filter(n => ts.isFunctionDeclaration(n) && n.name?.text === 'runTask4PagesV1'); assert.equal(nodes.length, 1);
    const routes = m.task4NetworkRecipesV1().browser.filter((r: any) => r.pathId.startsWith('page_')).map((r: any) => r.path);
    for (const scenario of ['pass', 'assertion_failure', 'owned_cancel', 'bad_dom', 'close_failure']) await t.test(scenario, async () => {
        const events: string[] = [], rows: any[] = [], state: any = { browser: { newContext: async (options: any) => {
            assert.deepEqual(options, { viewport: { width: 1440, height: 950 }, deviceScaleFactor: 1, serviceWorkers: 'block' });
            events.push('open'); return { newPage: async () => ({ setDefaultTimeout: (n: number) => assert.equal(n, 8000),
                goto: async (url: string) => { events.push('goto'); assert.ok(url.startsWith('http://127.0.0.1:13081/')); return { status: () => 200 }; },
                waitForResponse: async () => ({ finished: async () => null }), waitForFunction: async () => { events.push('mounted'); }, evaluate: async () => ({ rootWidth: 1440, rootHeight: 950, textLength: scenario === 'bad_dom' ? 0 : 100, visibleElements: 4 }),
                screenshot: async () => { events.push('screenshot'); return Buffer.from('png'); } }),
                close: async () => { events.push('close'); if (scenario === 'close_failure') throw Error('transport'); } };
        } }, native: { census: async () => { events.push('census'); } }, fence: { attach: async () => { events.push('fence'); }, settle: async () => {}, product: () => ({ status: 200 }) },
        filesystem: { capture: () => {}, checkpoint: () => {} }, evidence: { png: () => { const ref = { sha256: hash(String(rows.length)), bytes: 3 }; rows.push(ref); return ref; } },
        contexts: { opened: 0, closed: 0, pending: 0 }, render: { routes: routes.map((route: string) => ({ route, status: 'not_started', code: null, screenshot: null, dom: null, productResponse: null })), stop: { kind: 'unknown', afterRoute: null } }, cancelled: false };
        const bindings = { RENDER_ROUTES: routes, requireValue: (v: unknown, code: string) => { if (!v) throw Error(code); },
            fail: (code: string) => { throw Error(code); }, task4BoundedV1: (p: Promise<any>) => p };
        const fn = vm.compileFunction(nodes[0].getText(ast) + '\nreturn runTask4PagesV1;', Object.keys(bindings))(...Object.values(bindings));
        const ctx = { scenario: ['bad_dom', 'close_failure'].includes(scenario) ? 'pass' : scenario, check() {} };
        if (scenario === 'pass') { await fn(ctx, state); assert.equal(state.render.routes.filter((r: any) => r.status === 'pass').length, 6); }
        else await assert.rejects(fn(ctx, state), scenario === 'assertion_failure' ? /TASK4_QUALIFICATION_ASSERTION_FAILURE/ : scenario === 'owned_cancel' ? /TASK4_CANCELLED/ : scenario === 'close_failure' ? /TASK4_CLEANUP_UNKNOWN/ : /TASK4_ASSERTION_FAILED/);
        assert.equal(events.filter(e => e === 'open').length, scenario === 'pass' ? 6 : 1);
        assert.equal(events.filter(e => e === 'close').length, scenario === 'pass' ? 6 : 1);
        assert.ok(events.indexOf('fence') < events.indexOf('goto')); assert.ok(events.indexOf('mounted') < events.indexOf('close'));
        if (scenario === 'assertion_failure' || scenario === 'owned_cancel') { assert.equal(rows.length, 1); assert.equal(state.render.routes[0].status, 'pass'); assert.equal(state.render.stop.afterRoute, '/'); }
        if (scenario === 'bad_dom') assert.equal(rows.length, 0);
        assert.equal(state.contexts.pending, scenario === 'close_failure' ? 1 : 0);
    });
});

test('Task4 mock runtime records actual request finish and original socket close separately', async () => {
    const ts = await import('typescript'), vm = await import('node:vm'), { EventEmitter } = await import('node:events'), m = await load();
    const text = readFileSync(new URL('../scripts/render-smoke-owned-fixture.mjs', import.meta.url), 'utf8'), ast = ts.createSourceFile('fixture.mjs', text, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
    const nodes = ast.statements.filter(n => ts.isFunctionDeclaration(n) && n.name?.text === 'startTask4MockV1'); assert.equal(nodes.length, 1);
    const server = new EventEmitter() as any; let handler: any, closeCallback: any;
    server.listening = false; server.listen = (_options: any, cb: any) => { server.listening = true; cb(); }; server.address = () => server.listening ? { address: '127.0.0.1', family: 'IPv4', port: 15433 } : null;
    server.close = (cb: any) => { server.listening = false; closeCallback = cb; };
    const bindings = { createHttpServer: (fn: any) => { handler = fn; return server; }, task4ArtifactBindingV1: () => ({}),
        task4MockResponseV1: m.task4MockResponseV1, NETWORK_RECIPES: m.task4NetworkRecipesV1(), hash,
        requireValue: (v: unknown, code = 'TASK4_NETWORK_REFUSED') => { if (!v) throw Error(code); }, fail: (code: string) => { throw Error(code); },
        task4BoundedV1: (p: Promise<any>) => p, freeze: (v: any) => v };
    const fn = vm.compileFunction(nodes[0].getText(ast) + '\nreturn startTask4MockV1;', Object.keys(bindings))(...Object.values(bindings));
    const context = { ready: JSON.parse(GOLDEN_READY), owner: JSON.parse(GOLDEN_READY).fixtureOwner }, artifacts: any[] = [];
    const mock = await fn(context, { put(value: any) { artifacts.push(value); return { sha256: hash(JSON.stringify(value)), bytes: 1 }; } }, {});
    const probeSocket = new EventEmitter(); server.emit('connection', probeSocket); let probeClosed = false;
    const probe = mock.waitProbeClose().then(() => { probeClosed = true; }); await Promise.resolve(); assert.equal(probeClosed, false); probeSocket.emit('close'); await probe; assert.equal(probeClosed, true); assert.equal(mock.probeReceipt().acceptedConnections, 1);
    const socket = new EventEmitter(); server.emit('connection', socket);
    const request = { method: 'GET', url: '/api/runs/ac8cea43-7686-4d27-8092-1e3dd9207ca4/operational-snapshot', headers: { host: '127.0.0.1:15433' }, socket };
    const response = new EventEmitter() as any; response.writeHead = (status: number) => assert.equal(status, 200); response.end = () => response.emit('finish');
    handler(request, response); assert.equal(mock.rows()[0].finished, true); assert.equal(mock.rows()[0].closed, false);
    let closed = false; const completion = mock.close().then(() => { closed = true; }); closeCallback(); await Promise.resolve(); assert.equal(closed, false);
    socket.emit('close'); await completion; assert.equal(closed, true); assert.equal(mock.rows()[0].closed, true);
    assert.equal(mock.cleanup().state, 'closed'); assert.equal(mock.cleanup().acceptedConnections, 2); assert.equal(mock.cleanup().closedConnections, 2);
    assert.equal(artifacts.at(-1).state, 'absent');
    const custody: any = {};
    await assert.rejects(fn(context, { put() { throw Error('publication'); } }, custody), /publication/);
    assert.ok(custody.mock, 'original server must remain reachable when listener publication fails');
    const failedClose = custody.mock.close(); closeCallback(); await assert.rejects(failedClose, /publication/); assert.equal(server.listening, false);
});

test('Task4 server runtime closes only its freshly reobserved original handle and awaits exit plus close', async () => {
    const ts = await import('typescript'), vm = await import('node:vm'), { EventEmitter } = await import('node:events'), m = await load();
    const text = readFileSync(new URL('../scripts/render-smoke-owned-fixture.mjs', import.meta.url), 'utf8'), ast = ts.createSourceFile('fixture.mjs', text, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
    const nodes = ast.statements.filter(n => ts.isFunctionDeclaration(n) && n.name?.text === 'createTask4ServerV1'); assert.equal(nodes.length, 1);
    const child = new EventEmitter() as any; child.pid = 41111; child.stdout = new EventEmitter(); child.stderr = new EventEmitter(); let signals = 0, fresh = true;
    child.kill = (signal: string) => { assert.equal(signal, 'SIGTERM'); signals++; child.emit('exit', null, signal); child.emit('close', null, signal); return true; };
    const ready = JSON.parse(GOLDEN_READY), owner = { ...ready.fixtureOwner, executable: '/fixed/node', executableHash: 'a'.repeat(64) }, bound = { ...owner, pid: child.pid, ppid: owner.pid };
    const events: string[] = [], records: any[] = [];
    const context = { ready, owner, node: '/fixed/node', nodeHash: owner.executableHash, root: '/fixture/mc', check() { events.push('check'); },
        modules: { native: { observeUiProcessV1: async () => { if (!fresh) throw Error('UI_OS_OBSERVATION_INVALID'); events.push('observe'); return {}; } } } };
    const bindings = { path: await import('node:path'), spawn: (_exe: string, argv: string[], options: any) => { assert.equal(_exe, '/usr/bin/sandbox-exec'); assert.deepEqual(argv, ['-f', ready.setup.resourceRoot.path + '/server-launch-policy.sb', '/fixed/node', '/fixture/mc/dist-server/index.js']); assert.equal(options.detached, false); events.push('spawn'); return child; },
        task4ArtifactBindingV1: () => ({}), task4CanonicalV1: m.task4CanonicalV1, hash, retainTask4ChildV1: m.retainTask4ChildV1,
        bindTask4ProcessV1: () => bound, requireValue: (v: unknown, c: string) => { if (!v) throw Error(c); },
        task4ListenerCensusV1: async (_ctx: any, _evidence: any, _port: number, expected: any) => ({ state: expected ? 'listening' : 'absent', value: { state: expected ? 'listening' : 'absent', owner: expected } }),
        task4WaitV1: async () => {}, task4SaveOriginalV1: () => {} };
    const fn = vm.compileFunction(nodes[0].getText(ast) + '\nreturn createTask4ServerV1;', Object.keys(bindings))(...Object.values(bindings));
    const evidence = { put(v: any) { records.push(v); events.push('publish'); return { sha256: hash(JSON.stringify(v)), bytes: 1 }; } };
    const server = fn(context, evidence, { HOME: '/private' }, 'b'.repeat(64), 'c'.repeat(64), 'd'.repeat(64));
    assert.equal(events.includes('spawn'), false); assert.equal(records.length, 1); assert.deepEqual(server.intent(), { sha256: hash(JSON.stringify(records[0])), bytes: 1 });
    await server.launch(); assert.ok(events.indexOf('publish') < events.indexOf('spawn'));
    fresh = false; await assert.rejects(server.close(), /UI_OS_OBSERVATION_INVALID/); assert.equal(signals, 0);
    // A refusal is latched: no later observation may convert an unknown owner into a signal authority.
    fresh = true; await assert.rejects(server.close(), /TASK4_CLEANUP_UNKNOWN/); assert.equal(signals, 0);
});

test('Task4 fixed listener helper passes original bytes and matching exit close into real strict parser', async () => {
    const ts = await import('typescript'), vm = await import('node:vm'), { EventEmitter } = await import('node:events'), m = await load();
    const text = readFileSync(new URL('../scripts/render-smoke-owned-fixture.mjs', import.meta.url), 'utf8'), ast = ts.createSourceFile('fixture.mjs', text, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
    const nodes = ast.statements.filter(n => ts.isFunctionDeclaration(n) && n.name?.text === 'task4ListenerCensusV1'); assert.equal(nodes.length, 1);
    const child = new EventEmitter() as any; child.stdout = new EventEmitter(); child.stderr = new EventEmitter();
    const ready = JSON.parse(GOLDEN_READY), owner = { ...ready.fixtureOwner, pid: 41006 }, records: any[] = [], originals: any[] = [];
    const bindings = { spawn: (exe: string, argv: string[], options: any) => { assert.equal(exe, '/usr/sbin/lsof'); assert.deepEqual(argv, ['-nP', '-iTCP:13081', '-sTCP:LISTEN', '-Fpcfn']);
        assert.deepEqual(options.env, { HOME: ready.setup.resourceRoot.path + '/inner/server-home', PATH: '/usr/bin:/bin:/usr/sbin:/sbin', LANG: 'C', LC_ALL: 'C', TZ: 'UTC' }); return child; },
        path: await import('node:path'), retainTask4ChildV1: m.retainTask4ChildV1, classifyTask4ListenerV1: m.classifyTask4ListenerV1,
        task4ArtifactBindingV1: () => ({}), requireValue: (v: unknown, c: string) => { if (!v) throw Error(c); }, hash, task4CanonicalV1: m.task4CanonicalV1, TASK4_HELPER_SEQUENCES: new WeakMap(),
        task4PrivateBytesV1: (dir: string, name: string, bytes: Buffer) => { assert.equal(dir, ready.setup.resourceRoot.path + '/inner/originals'); assert.equal(name, 'lsof-0001.json'); originals.push(JSON.parse(bytes.toString())); } };
    const fn = vm.compileFunction(nodes[0].getText(ast) + '\nreturn task4ListenerCensusV1;', Object.keys(bindings))(...Object.values(bindings));
    const pending = fn({ ready, check() {} }, { put(v: any) { records.push(v); return { sha256: hash(JSON.stringify(v)), bytes: 1 }; } }, 13081, owner);
    child.stdout.emit('data', Buffer.from('p41006\ncnode\nf21\nn127.0.0.1:13081\n')); child.emit('exit', 0, null); await Promise.resolve(); assert.equal(records.length, 0);
    child.emit('close', 0, null); const result = await pending; assert.equal(result.state, 'listening'); assert.equal(records.length, 0); assert.equal(originals[0].exit.exitObserved, true); assert.equal(originals[0].exit.closeObserved, true);
    assert.equal(originals[0].stdoutHash, hash(originals[0].stdout)); assert.equal(result.value.owner.pid, 41006); assert.equal(records.length, 0);
});

test('Task4 inner composition gates effects on authentication and preserves independent cleanup attempts after rendering failure', async (t) => {
    const ts = await import('typescript'), vm = await import('node:vm');
    const text = readFileSync(new URL('../scripts/render-smoke-owned-fixture.mjs', import.meta.url), 'utf8'), ast = ts.createSourceFile('fixture.mjs', text, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
    const nodes = ast.statements.filter(n => ts.isFunctionDeclaration(n) && n.name?.text === 'runTask4InnerV1'); assert.equal(nodes.length, 1);
    for (const failure of [null, 'pages', 'server_close', 'bootstrap']) await t.test(failure ?? 'pass', async () => {
        const events: string[] = [], state: any = { contexts: { opened: 0, closed: 0, pending: 0 }, readers: { opened: 0, closed: 0, pending: 0 },
            evidence: {}, filesystem: {}, errors: [], observations: {}, cancelled: false };
        const bindings: any = { prepareTask4InnerResourcesV1: async () => { events.push('resources'); if (failure === 'bootstrap') throw Error('TASK4_BINDING_REFUSED'); return state; },
            openTask4ObserverV1: async () => ({ observer: { observe: async (phase: string) => { events.push('observe:' + phase); return {}; } }, close: async () => { events.push('sql_close'); } }),
            startTask4MockV1: async () => ({ port: 15433, close: async () => { events.push('mock_close'); } }),
            task4ConfiguredParserV1: async () => { events.push('parser'); return {}; },
            prepareTask4ServerV1: () => ({ launch: async () => { events.push('server_launch'); }, close: async () => { events.push('server_close'); if (failure === 'server_close') throw Error('TASK4_CLEANUP_UNKNOWN'); } }),
            runTask4InnerProbeV1: async () => { events.push('probe'); }, runTask4PreflightV1: async () => { events.push('preflight'); },
            prepareTask4NativeV1: () => ({ launch: async () => { events.push('native_launch'); return {}; }, close: async () => { events.push('native_close'); return {}; } }),
            createTask4BrowserFenceV1: () => ({}), runTask4PagesV1: async () => { events.push('pages'); if (failure === 'pages') throw Error('TASK4_ASSERTION_FAILED'); },
            retainTask4RenderCandidateV1: () => { events.push('candidate'); },
            finalizeTask4InnerV1: async (_context: any, result: any) => { events.push('final'); return result; },
            task4RecordFailureV1: (s: any, error: any) => { s.errors.push(error.message); }, task4BoundedV1: (value: any) => value,
            requireValue: (v: unknown, code: string) => { if (!v) throw Error(code); } };
        const fn = vm.compileFunction(nodes[0].getText(ast) + '\nreturn runTask4InnerV1;', Object.keys(bindings))(...Object.values(bindings));
        const context = { ready: JSON.parse(GOLDEN_READY), check() { events.push('check'); } };
        if (failure === 'bootstrap') { await assert.rejects(fn(context), /TASK4_BINDING_REFUSED/); assert.deepEqual(events, ['check', 'resources']); return; }
        const result = await fn(context); assert.ok(events.indexOf('probe') < events.indexOf('server_launch'));
        assert.ok(events.indexOf('observe:before') < events.indexOf('server_launch')); assert.ok(events.indexOf('server_close') < events.indexOf('observe:after'));
        for (const name of ['server_close', 'native_close', 'observe:after', 'sql_close', 'mock_close', 'final']) assert.equal(events.filter(e => e === name).length, 1);
        assert.ok(events.indexOf('candidate') > events.indexOf('pages')); assert.ok(events.indexOf('candidate') < events.indexOf('server_close'));
        assert.equal(events.at(-1), 'final'); if (failure) assert.equal(result.errors.length, 1); else assert.equal(result.errors.length, 0);
    });
});

test('Task4 inner pins independently bind projection marker and actual postmaster before owned resource creation', async (t) => {
    const ts = await import('typescript'), vm = await import('node:vm'), path = await import('node:path'), m = await load();
    const text = readFileSync(new URL('../scripts/render-smoke-owned-fixture.mjs', import.meta.url), 'utf8'), ast = ts.createSourceFile('fixture.mjs', text, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
    const nodes = ast.statements.filter(n => ts.isFunctionDeclaration(n) && n.name?.text === 'captureTask4InnerPinsV1'); assert.equal(nodes.length, 1);
    for (const fault of [null, 'marker', 'pg', 'projection', 'root']) await t.test(fault ?? 'bound', async () => {
        const ready = JSON.parse(GOLDEN_READY), closed: string[] = [], dirs = [ready.setup.resourceRoot, ready.projection.root, ready.setup.postgres.data, ready.setup.postgres.socket];
        const marker = { schema: 'setfarm.p3-isolated-projection-marker.v1', projectionRoot: ready.projection.root.path, projectedHead: ready.projection.projectedHead,
            adminUrlSha256: ready.setup.postgres.adminUrlHash, runDatabasePrefix: ready.projection.runDatabasePrefix };
        const bindings = { path, task4CanonicalV1: m.task4CanonicalV1,
            requireValue: (v: unknown, code: string) => { if (!v) throw Error(code); },
            captureTask4DirectoryV1: (locator: string) => ({ value: { ...dirs.find(row => row.path === locator), ...(fault === 'root' && locator === ready.setup.resourceRoot.path ? { ino: '999' } : {}) }, check() {}, close() { closed.push(locator); } }),
            captureTask4FileV1: () => ({ hash: fault === 'marker' ? 'f'.repeat(64) : ready.projection.markerHash, bytes: Buffer.from(JSON.stringify(marker)), check() {}, close() { closed.push('marker'); } }),
            task4FileSnapshotV1: () => ({ hash: ready.setup.postgres.process.executableHash }),
            task4GitV1: () => 'a'.repeat(40) + '\n',
            captureTask4SourceInputsV1: () => { if (fault === 'projection') throw Error('TASK4_SOURCE_DRIFT'); return { check() {}, close() { closed.push('projection'); } }; },
            bindTask4ProcessV1: () => ({ ...ready.setup.postgres.process, ...(fault === 'pg' ? { startedAt: '2026-10-19T09:00:01.000Z' } : {}) }) };
        const fn = vm.compileFunction(nodes[0].getText(ast) + '\nreturn captureTask4InnerPinsV1;', Object.keys(bindings))(...Object.values(bindings));
        const context = { ready, sf: { rootPin: ready.setup.setfarm.rootPin }, mc: { rootPin: ready.setup.missionControl.rootPin }, check() {}, modules: { native: { observeUiProcessV1: async () => ({ rawArgs: 'retained original' }) } } };
        if (fault) { await assert.rejects(fn(context), /TASK4_(BINDING_REFUSED|SOURCE_DRIFT)/); assert.ok(closed.length > 0); }
        else { const pins = await fn(context); pins.check(); pins.close(); assert.equal(closed.length, 6); }
    });
});

test('Task4 private byte publication is exclusive, mode-bound and rejects traversal or replacement', async () => {
    const ts = await import('typescript'), vm = await import('node:vm'), fs = await import('node:fs'), path = await import('node:path'), os = await import('node:os'), m = await load();
    const text = readFileSync(new URL('../scripts/render-smoke-owned-fixture.mjs', import.meta.url), 'utf8'), ast = ts.createSourceFile('fixture.mjs', text, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
    const nodes = ast.statements.filter(n => ts.isFunctionDeclaration(n) && n.name?.text === 'task4PrivateBytesV1'); assert.equal(nodes.length, 1);
    const bindings = { fs, path, hash, captureTask4DirectoryV1: m.captureTask4DirectoryV1, captureTask4FileV1: m.captureTask4FileV1, requireValue: (v: unknown, code: string) => { if (!v) throw Error(code); } };
    const fn = vm.compileFunction(nodes[0].getText(ast) + '\nreturn task4PrivateBytesV1;', Object.keys(bindings))(...Object.values(bindings));
    const root = fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), 'task4-publication-component-')); fs.chmodSync(root, 0o700);
    try {
        const bytes = Buffer.from('retained original\n'), ref = fn(root, 'server.stderr.log', bytes); assert.deepEqual(ref, { sha256: hash(bytes), bytes: bytes.length });
        assert.equal(fs.statSync(path.join(root, 'server.stderr.log')).mode & 0o777, 0o600); assert.deepEqual(fs.readFileSync(path.join(root, 'server.stderr.log')), bytes);
        assert.throws(() => fn(root, 'server.stderr.log', bytes)); assert.throws(() => fn(root, '../outside', bytes));
        fs.symlinkSync(path.join(root, 'server.stderr.log'), path.join(root, 'linked.log')); assert.throws(() => fn(root, 'linked.log', bytes));
    } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test('Task4 inner resource preparation creates only fixed private roots after pins and leaves native creation to original helper', async () => {
    const ts = await import('typescript'), vm = await import('node:vm'), fs = await import('node:fs'), path = await import('node:path'), os = await import('node:os'), m = await load();
    const { createUiArtifactStoreV1 } = await import('../scripts/ui-regression-lifecycle.mjs');
    const text = readFileSync(new URL('../scripts/render-smoke-owned-fixture.mjs', import.meta.url), 'utf8'), ast = ts.createSourceFile('fixture.mjs', text, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
    const names = ['prepareTask4InnerResourcesV1', 'task4PrivateBytesV1']; const nodes = ast.statements.filter(n => ts.isFunctionDeclaration(n) && names.includes(n.name?.text ?? '')); assert.equal(nodes.length, 2);
    const root = fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), 'task4-roots-component-')); fs.chmodSync(root, 0o700);
    let pinned = false, refused = true; const ready = JSON.parse(GOLDEN_READY); ready.setup.resourceRoot.path = root;
    const bindings = { fs, path, hash, captureTask4DirectoryV1: m.captureTask4DirectoryV1, captureTask4FileV1: m.captureTask4FileV1,
        captureTask4InnerPinsV1: async () => { if (refused) throw Error('TASK4_BINDING_REFUSED'); pinned = true; return { check() { assert.equal(pinned, true); }, close() {} }; },
        createTask4EvidenceV1: m.createTask4EvidenceV1, createTask4FilesystemV1: m.createTask4FilesystemV1,
        task4ArtifactBindingV1: () => ({}), randomUUID: () => '12345678-1234-4234-8234-123456789012', RENDER_ROUTES: m.task4NetworkRecipesV1().browser.filter((r: any) => r.pathId.startsWith('page_')).map((r: any) => r.path),
        requireValue: (v: unknown, c: string) => { if (!v) throw Error(c); } };
    const fn = vm.compileFunction(nodes.map(n => n.getText(ast)).join('\n') + '\nreturn prepareTask4InnerResourcesV1;', Object.keys(bindings))(...Object.values(bindings));
    const context = { ready, modules: { native: { createUiArtifactStoreV1 } } };
    try {
        await assert.rejects(fn(context), /TASK4_BINDING_REFUSED/); assert.deepEqual(fs.readdirSync(root), []);
        refused = false; const state = await fn(context); assert.ok(pinned); assert.equal(state.render.routes.length, 6);
        assert.deepEqual(fs.readdirSync(path.join(root, 'inner')).sort(), ['artifacts', 'children', 'originals', 'server-home', 'server-runtime']);
        assert.equal(fs.readFileSync(path.join(root, 'inner/server-runtime/projects.json'), 'utf8'), '[]\n');
        assert.equal(fs.statSync(path.join(root, 'inner')).mode & 0o777, 0o700); state.pins.close();
    } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test('Task4 runtime observer reserves one restricted backend and records closure only after original client end', async () => {
    const ts = await import('typescript'), vm = await import('node:vm');
    const text = readFileSync(new URL('../scripts/render-smoke-owned-fixture.mjs', import.meta.url), 'utf8'), ast = ts.createSourceFile('fixture.mjs', text, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
    const nodes = ast.statements.filter(n => ts.isFunctionDeclaration(n) && n.name?.text === 'openTask4ObserverV1'); assert.equal(nodes.length, 1);
    const ready = JSON.parse(GOLDEN_READY), events: string[] = [], reserved = { release() { events.push('release'); } }; let finish: any;
    const state = { readers: { opened: 0, closed: 0, pending: 0 }, filesystem: { operation: () => {} } };
    const bindings = { task4PostgresV1: async () => (url: string, options: any) => { assert.equal(url, ready.database.restrictedUrl); assert.equal(options.max, 1); assert.equal(Object.hasOwn(options, 'fetch_types'), false); assert.equal(options.prepare, false);
        assert.equal(options.connection.application_name, 'task4_observer_' + ready.executionId); return { reserve: async () => reserved, end: () => new Promise(resolve => { events.push('end'); finish = resolve; }) }; },
        createTask4ObserverV1: (bound: any, original: any) => { assert.equal(bound, ready); assert.equal(original, reserved); return {}; },
        task4BoundedV1: (p: any, ms: number) => { assert.equal(ms, 8000); return p; }, requireValue: (v: unknown, c: string) => { if (!v) throw Error(c); } };
    const fn = vm.compileFunction(nodes[0].getText(ast) + '\nreturn openTask4ObserverV1;', Object.keys(bindings))(...Object.values(bindings));
    const opened = await fn({ ready, check() {} }, state); assert.deepEqual(state.readers, { opened: 1, closed: 0, pending: 1 });
    const closing = opened.close(); await Promise.resolve(); assert.deepEqual(events, ['release', 'end']); assert.equal(state.readers.closed, 0);
    finish(); await closing; assert.deepEqual(state.readers, { opened: 1, closed: 1, pending: 0 }); await assert.rejects(opened.close(), /TASK4_CLEANUP_UNKNOWN/);
});

test('Task4 runtime preflight accepts only exact canonical sealed200 through the real parser', async (t) => {
    const ts = await import('typescript'), vm = await import('node:vm'), m = await load();
    const { parseProductBuildAuthorityV2 } = await import('../server/services/setfarm-product-build-authority.js');
    const text = readFileSync(new URL('../scripts/render-smoke-owned-fixture.mjs', import.meta.url), 'utf8'), ast = ts.createSourceFile('fixture.mjs', text, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
    const nodes = ast.statements.filter(n => ts.isFunctionDeclaration(n) && n.name?.text === 'runTask4PreflightV1'); assert.equal(nodes.length, 1);
    const ready = JSON.parse(GOLDEN_READY), expected = m.task4SeedV1(ready.setup.setfarm.source.sourceSha).productResponse;
    for (const fault of [null, 'status', 'order', 'clone', 'authority']) await t.test(fault ?? 'exact', async () => {
        const body = structuredClone(expected); if (fault === 'authority') body.authorityHash = 'f'.repeat(64);
        const bytes = Buffer.from(fault === 'order' ? JSON.stringify(body, Object.keys(body).reverse()) : m.task4CanonicalV1(body));
        const state: any = { parser: fault === 'clone' ? (v: any) => structuredClone(v) : parseProductBuildAuthorityV2, render: { preflight: null }, proxy: null, evidence: { put: (v: any) => ({ sha256: hash(JSON.stringify(v)), bytes: 1 }) } };
        const bindings = { task4PreflightHttpV1: async () => ({ status: fault === 'status' ? 409 : 200, bytes }), task4SeedV1: m.task4SeedV1,
            task4CanonicalV1: m.task4CanonicalV1, task4ArtifactBindingV1: () => ({}), RUN_IDS: ['ac8cea43-7686-4d27-8092-1e3dd9207ca4', 'ad47fe65-4ec4-4fb5-89da-fff71eb4e79a'], hash,
            requireValue: (v: unknown, c: string) => { if (!v) throw Error(c); } };
        const fn = vm.compileFunction(nodes[0].getText(ast) + '\nreturn runTask4PreflightV1;', Object.keys(bindings))(...Object.values(bindings));
        if (fault) { await assert.rejects(fn({ ready, check() {} }, state)); assert.equal(state.render.preflight, null); }
        else { await fn({ ready, check() {} }, state); assert.equal(state.render.preflight.authorityHash, expected.authorityHash); assert.ok(state.proxy); }
    });
});

test('Task4 preflight transport requires complete response plus original request and socket close', async () => {
    const ts = await import('typescript'), vm = await import('node:vm'), { EventEmitter } = await import('node:events');
    const text = readFileSync(new URL('../scripts/render-smoke-owned-fixture.mjs', import.meta.url), 'utf8'), ast = ts.createSourceFile('fixture.mjs', text, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
    const nodes = ast.statements.filter(n => ts.isFunctionDeclaration(n) && n.name?.text === 'task4PreflightHttpV1'); assert.equal(nodes.length, 1);
    const request = new EventEmitter() as any, response = new EventEmitter() as any, socket = new EventEmitter() as any; request.end = () => {}; request.destroy = () => {};
    response.statusCode = 200; response.headers = { 'content-type': 'application/json; charset=utf-8' }; response.complete = true; response.destroy = () => {};
    socket.remoteAddress = '127.0.0.1'; socket.remotePort = 13081;
    let responseCallback: any;
    const bindings = { requestHttp: (options: any, fn: any) => { assert.deepEqual(options, { host: '127.0.0.1', port: 13081, path: '/api/setfarm/runs/ad47fe65-4ec4-4fb5-89da-fff71eb4e79a/product-build-authority', method: 'GET', agent: false }); responseCallback = fn; return request; },
        RUN_IDS: ['ac8cea43-7686-4d27-8092-1e3dd9207ca4', 'ad47fe65-4ec4-4fb5-89da-fff71eb4e79a'], setTimeout, clearTimeout };
    const fn = vm.compileFunction(nodes[0].getText(ast) + '\nreturn task4PreflightHttpV1;', Object.keys(bindings))(...Object.values(bindings));
    let settled = false; const pending = fn().then((v: any) => { settled = true; return v; }); request.emit('socket', socket); socket.emit('connect');
    responseCallback(response); response.emit('data', Buffer.from('{"ok":true}')); response.emit('end'); await Promise.resolve(); assert.equal(settled, false);
    request.emit('close'); await Promise.resolve(); assert.equal(settled, false); socket.emit('close'); const result = await pending;
    assert.equal(result.status, 200); assert.equal(result.bytes.toString(), '{"ok":true}');
});

test('Task4 native binding uses the measured original inner identity and unchanged default lifecycle without effect injection', async () => {
    const ts = await import('typescript'), vm = await import('node:vm'), path = await import('node:path'), m = await load();
    const text = readFileSync(new URL('../scripts/render-smoke-owned-fixture.mjs', import.meta.url), 'utf8'), ast = ts.createSourceFile('fixture.mjs', text, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
    const nodes = ast.statements.filter(n => ts.isFunctionDeclaration(n) && n.name?.text === 'prepareTask4NativeV1'); assert.equal(nodes.length, 1);
    const ready = JSON.parse(GOLDEN_READY), owner = ready.fixtureOwner, state: any = { evidence: { store: {} }, jobId: '12345678-1234-4234-8234-123456789012', cancelled: false };
    const schema = {}, sentinel = {}; let supplied: any;
    const context = { ready, owner, root: '/fixture/mc', modules: { native: { createUiNativeLifecycleV1(...args: any[]) { assert.equal(args.length, 1); supplied = args[0]; return sentinel; } }, protocol: { UiWorkerLifecycleRecordV1Schema: schema } } };
    const bindings = { path, hash, task4CanonicalV1: m.task4CanonicalV1, task4ArtifactBindingV1: () => ({ readyDescriptorHash: 'a'.repeat(64) }) };
    const fn = vm.compileFunction(nodes[0].getText(ast) + '\nreturn prepareTask4NativeV1;', Object.keys(bindings))(...Object.values(bindings));
    assert.equal(fn(context, state), sentinel); assert.equal(supplied.recordSchema, schema); assert.equal(supplied.store, state.evidence.store);
    assert.deepEqual(supplied.owner, { pid: owner.pid, processStartedAt: owner.startedAt, processGroupId: owner.pgid, source: 'observed_os', executable: owner.executable, script: '/fixture/mc/scripts/render-smoke.mjs', commandHash: owner.commandHash });
    assert.equal(supplied.ownerHash, hash(m.task4CanonicalV1(supplied.owner))); assert.equal(supplied.cancellationRequested(), false); state.cancelled = true; assert.equal(supplied.cancellationRequested(), true);
});

test('Task4 server preparation pins installed sandbox bytes and publishes the exact private policy before intent', async () => {
    const ts = await import('typescript'), vm = await import('node:vm'), path = await import('node:path'), m = await load();
    const text = readFileSync(new URL('../scripts/render-smoke-owned-fixture.mjs', import.meta.url), 'utf8'), ast = ts.createSourceFile('fixture.mjs', text, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
    const nodes = ast.statements.filter(n => ts.isFunctionDeclaration(n) && n.name?.text === 'prepareTask4ServerV1'); assert.equal(nodes.length, 1);
    const ready = JSON.parse(GOLDEN_READY), order: string[] = [], state: any = { mock: { port: 15433 }, evidence: {} }; let valid = false;
    const bindings = { path, hash, task4ServerPolicyV1: m.task4ServerPolicyV1, task4ServerEnvironmentV1: () => ({ HOME: 'private' }),
        task4FileSnapshotV1: () => ({ hash: valid ? '8290e4be7387a0df83cd1559e86afd880464f269450573d012795761fe298f16' : 'f'.repeat(64) }),
        task4PrivateBytesV1: (root: string, name: string, bytes: Buffer) => { assert.equal(root, ready.setup.resourceRoot.path); assert.equal(name, 'server-launch-policy.sb'); assert.equal(bytes.toString(), m.task4ServerPolicyV1(ready.setup, 15433)); order.push('policy'); return { sha256: hash(bytes), bytes: bytes.length }; },
        createTask4ServerV1: () => { order.push('intent'); return {}; }, requireValue: (v: unknown, c: string) => { if (!v) throw Error(c); } };
    const fn = vm.compileFunction(nodes[0].getText(ast) + '\nreturn prepareTask4ServerV1;', Object.keys(bindings))(...Object.values(bindings));
    const context = { ready, build: { files: new Map([['dist-server/index.js', { hash: 'e'.repeat(64) }]]) }, check() {} };
    assert.throws(() => fn(context, state), /TASK4_SOURCE_DRIFT/); assert.deepEqual(order, []); valid = true; fn(context, state); assert.deepEqual(order, ['policy', 'intent']);
});

test('Task4 final settlement retains partial PNGs and never upgrades late integrity or cleanup failures', async (t) => {
    const ts = await import('typescript'), vm = await import('node:vm'), path = await import('node:path'), m = await load();
    const source = readFileSync(new URL('../scripts/render-smoke-owned-fixture.mjs', import.meta.url), 'utf8'), ast = ts.createSourceFile('fixture.mjs', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
    const names = ['task4RecordFailureV1', 'finalizeTask4InnerV1']; const nodes = ast.statements.filter(n => ts.isFunctionDeclaration(n) && names.includes(n.name?.text ?? '')); assert.equal(nodes.length, 2);
    for (const mode of ['pass', 'assertion_failure', 'owned_cancel', 'late_integrity', 'cleanup_unknown', 'publication_failure']) await t.test(mode, async () => {
        const ready = JSON.parse(GOLDEN_READY), values: any[] = [], published: any[] = [], png = { sha256: 'e'.repeat(64), bytes: 100 };
        const put = (v: any) => { values.push(v); return { sha256: hash(m.task4CanonicalV1(v) + '\n'), bytes: Buffer.byteLength(m.task4CanonicalV1(v) + '\n') }; };
        let closedPins = 0; const state: any = { startedAt: '2026-10-19T09:00:01.000Z', jobId: '12345678-1234-4234-8234-123456789012', errors: [], integrity: 'verified', cleanupUnknown: mode === 'cleanup_unknown',
            pins: { check() { if (mode === 'late_integrity') throw Error('TASK4_SOURCE_DRIFT'); }, close() { closedPins++; } },
            evidence: { put, inventory: () => ({ json: values.map(v => ({ sha256: hash(m.task4CanonicalV1(v) + '\n'), bytes: Buffer.byteLength(m.task4CanonicalV1(v) + '\n') })).sort((a, b) => a.sha256.localeCompare(b.sha256)), png: [png], native: [], totalBytes: 100 }) },
            filesystem: { capture() {}, value: () => ({ complete: true, syncState: { before: null, after: { sha256: 'f'.repeat(64) } } }) },
            observations: { before: { observedAt: '2026-10-19T09:00:01.000Z' }, after: { observedAt: '2026-10-19T09:00:02.000Z' } },
            readers: { opened: 1, closed: 1, pending: 0 }, contexts: { opened: 1, closed: 1, pending: 0 },
            nativeCleanup: { browser: 'closed', children: [] }, mock: { cleanup: () => ({ state: 'closed' }) }, server: { snapshot: () => ({ state: 'closed' }) },
            sql: { observer: { bindObservation() {}, ledger: () => ({ complete: true }) } },
            render: { preflight: {}, routes: Array.from({ length: mode === 'assertion_failure' || mode === 'owned_cancel' ? 1 : 6 }, () => ({ status: 'pass', screenshot: png })), stop: { kind: mode === 'owned_cancel' ? 'cancelled' : mode === 'assertion_failure' ? 'failure' : 'complete', afterRoute: '/' } }, cancelled: mode === 'owned_cancel' };
        const context: any = { ready, owner: ready.fixtureOwner, root: '/fixture/mc', scenario: mode === 'assertion_failure' || mode === 'owned_cancel' ? mode : 'pass' };
        const bindings = { path, hash, task4CanonicalV1: m.task4CanonicalV1, task4ArtifactBindingV1: () => ({ setupDescriptorHash: ready.setupDescriptorHash, readyDescriptorHash: 'a'.repeat(64) }),
            buildTask4NetworkV1: () => ({ complete: true }), requireValue: (v: unknown, c: string) => { if (!v) throw Error(c); },
            captureTask4DirectoryV1: () => ({ check() {}, value: ready.setup.resourceRoot, close() {} }),
            publishTask4FixedV1: (_pin: any, name: string, value: any) => { assert.equal(name, 'inner-result.json'); if (mode === 'publication_failure') throw Error('TASK4_RESULT_PUBLICATION_FAILED'); published.push(value); return { sha256: 'd'.repeat(64), bytes: 100 }; }, process: { exitCode: 0 } };
        const funcs = vm.compileFunction(nodes.map(n => n.getText(ast)).join('\n') + '\nreturn {finalizeTask4InnerV1,task4RecordFailureV1};', Object.keys(bindings))(...Object.values(bindings));
        if (mode === 'assertion_failure') funcs.task4RecordFailureV1(state, Error('TASK4_QUALIFICATION_ASSERTION_FAILURE'));
        if (mode === 'owned_cancel') funcs.task4RecordFailureV1(state, Error('TASK4_CANCELLED'));
        if (mode === 'publication_failure') { await assert.rejects(funcs.finalizeTask4InnerV1(context, state), /TASK4_RESULT_PUBLICATION_FAILED/); assert.equal(published.length, 0); }
        else {
            const value = await funcs.finalizeTask4InnerV1(context, state); assert.equal(published.length, 1); assert.deepEqual(value.artifacts.png, [png]);
            const expected = mode === 'pass' ? 'pass' : mode === 'assertion_failure' ? 'fail' : mode === 'owned_cancel' ? 'cancelled' : 'unknown'; assert.equal(value.outcome, expected);
            if (mode === 'late_integrity') { assert.equal(value.integrity, 'failed'); assert.equal(value.cleanup, null); assert.ok(value.diagnostics.includes('TASK4_SOURCE_DRIFT')); }
            if (mode === 'cleanup_unknown') assert.equal(value.cleanup, null);
        }
        assert.equal(closedPins, 1);
    });
});

test('Task4 fixed publication exposes final name only after complete fsynced bytes and preserves failed originals', async (t) => {
    const ts = await import('typescript'), vm = await import('node:vm'), fs = await import('node:fs'), path = await import('node:path'), os = await import('node:os'), m = await load();
    const text = readFileSync(new URL('../scripts/render-smoke-owned-fixture.mjs', import.meta.url), 'utf8'), ast = ts.createSourceFile('fixture.mjs', text, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
    const nodes = ast.statements.filter(n => ts.isFunctionDeclaration(n) && n.name?.text === 'publishTask4FixedV1'); assert.equal(nodes.length, 1);
    for (const mode of ['pass', 'link', 'unlink', 'preexisting', 'replacement', 'mode']) await t.test(mode, () => {
        const root = fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), 'task4-publish-component-')); fs.chmodSync(root, 0o700);
        const target = path.join(root, 'policy-probe.json'), pending = target + '.pending', expected = Buffer.from('{"fixed":true}\n'); let written = false, synced = false;
        const originalPin = m.captureTask4DirectoryV1(root, true);
        const pin = { ...originalPin, sync() { originalPin.sync(); if (mode === 'replacement') { fs.renameSync(target, target + '.original'); fs.writeFileSync(target, expected, { mode: 0o600 }); } if (mode === 'mode') fs.chmodSync(target, 0o400); } };
        const port = { ...fs, writeFileSync(fd: number, bytes: Buffer) { assert.equal(fs.existsSync(target), false); written = true; fs.writeFileSync(fd, bytes); },
            fsyncSync(fd: number) { fs.fsyncSync(fd); synced = true; },
            linkSync(from: string, to: string) { assert.ok(written && synced); assert.equal(from, pending); assert.equal(to, target); assert.deepEqual(fs.readFileSync(from), expected); if (mode === 'link') throw Error('link'); fs.linkSync(from, to); },
            unlinkSync(file: string) { assert.equal(file, pending); if (mode === 'unlink') throw Error('unlink'); fs.unlinkSync(file); } };
        const bindings = { fs: port, path, process, hash, task4CanonicalV1: m.task4CanonicalV1, captureTask4FileV1: m.captureTask4FileV1,
            requireValue: (v: unknown) => { if (!v) throw Error('invalid'); }, fail: (code: string) => { throw Error(code); }, freeze: (v: any) => v };
        const fn = vm.compileFunction(nodes[0].getText(ast).replace(/^export /, '') + '\nreturn publishTask4FixedV1;', Object.keys(bindings))(...Object.values(bindings));
        try {
            if (mode === 'preexisting') fs.writeFileSync(target, 'original', { mode: 0o600 });
            if (mode === 'pass') { assert.deepEqual(fn(pin, 'policy-probe.json', { fixed: true }), { sha256: hash(expected), bytes: expected.length }); assert.equal(fs.existsSync(pending), false); assert.equal(fs.statSync(target).nlink, 1); }
            else { assert.throws(() => fn(pin, 'policy-probe.json', { fixed: true }), /TASK4_RESULT_PUBLICATION_FAILED/); if (mode === 'preexisting') assert.equal(fs.readFileSync(target, 'utf8'), 'original'); else if (mode === 'replacement' || mode === 'mode') assert.deepEqual(fs.readFileSync(target), expected); else assert.deepEqual(fs.readFileSync(pending), expected); }
        } finally { pin.close(); fs.rmSync(root, { recursive: true, force: true }); }
    });
});

test('Task4 live fixed reader never admits pending two-link publication and never retries malformed final evidence', async () => {
    const ts = await import('typescript'), vm = await import('node:vm'), fs = await import('node:fs'), path = await import('node:path'), os = await import('node:os'), m = await load();
    const text = readFileSync(new URL('../scripts/render-smoke-owned-fixture.mjs', import.meta.url), 'utf8'), ast = ts.createSourceFile('fixture.mjs', text, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
    const nodes = ast.statements.filter(n => ts.isFunctionDeclaration(n) && n.name?.text === 'readTask4FixedV1'); assert.equal(nodes.length, 1);
    const bindings = { fs, path, hash, process, task4CanonicalV1: m.task4CanonicalV1, captureTask4FileV1: m.captureTask4FileV1,
        requireValue: (v: unknown, c: string) => { if (!v) throw Error(c); } };
    const fn = vm.compileFunction(nodes[0].getText(ast) + '\nreturn readTask4FixedV1;', Object.keys(bindings))(...Object.values(bindings));
    const root = fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), 'task4-read-component-')); fs.chmodSync(root, 0o700); const pin = m.captureTask4DirectoryV1(root, true);
    const file = path.join(root, 'policy-probe.json'), pending = file + '.pending';
    try {
        assert.equal(fn(pin, 'policy-probe.json', true), null); assert.throws(() => fn(pin, 'policy-probe.json', false), /TASK4_INTEGRITY_FAILED/);
        fs.writeFileSync(pending, '{"fixed":true}\n', { mode: 0o600 }); fs.linkSync(pending, file);
        assert.equal(fn(pin, 'policy-probe.json', true), null); assert.throws(() => fn(pin, 'policy-probe.json', false), /TASK4_INTEGRITY_FAILED/);
        fs.unlinkSync(pending); assert.deepEqual(fn(pin, 'policy-probe.json', true).value, { fixed: true });
        fs.writeFileSync(file, '{incomplete'); assert.throws(() => fn(pin, 'policy-probe.json', true));
        fs.writeFileSync(file, '{"fixed":true}\n'); fs.chmodSync(file, 0o644); assert.throws(() => fn(pin, 'policy-probe.json', true), /TASK4_INTEGRITY_FAILED/);
    } finally { pin.close(); fs.rmSync(root, { recursive: true, force: true }); }
});

test('Task4 original policy output remains exact after canonical record parsing and refuses non-denial or missing close', async (t) => {
    const ts = await import('typescript'), vm = await import('node:vm'), m = await load();
    const text = readFileSync(new URL('../scripts/render-smoke-owned-fixture.mjs', import.meta.url), 'utf8'), ast = ts.createSourceFile('fixture.mjs', text, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
    const nodes = ast.statements.filter(n => ts.isFunctionDeclaration(n) && n.name?.text === 'validateTask4ProbeOriginalV1'); assert.equal(nodes.length, 1);
    const programs = ast.statements.flatMap(s => ts.isVariableStatement(s) ? s.declarationList.declarations.filter(d => ts.isIdentifier(d.name) && d.name.text === 'TASK4_POLICY_PROBE_PROGRAM').map(d => (d.initializer as import('typescript').StringLiteral).text) : []); assert.equal(programs.length, 1);
    const ready = JSON.parse(GOLDEN_READY), binding = { executionId: ready.executionId, setupDescriptorHash: ready.setupDescriptorHash, readyDescriptorHash: hash(GOLDEN_READY + '\n') };
    const allowed = { startedAt: '2026-10-19T09:00:02.000Z', finishedAt: '2026-10-19T09:00:02.010Z', outcome: 'connected', errno: null }, denied = { ...allowed, startedAt: '2026-10-19T09:00:02.010Z', finishedAt: '2026-10-19T09:00:02.020Z', outcome: 'denied', errno: 'EPERM' };
    const owner = { ...ready.setup.owner, pid: 41009, ppid: ready.setup.owner.pid, commandHash: hash([ready.setup.owner.executable, '-e', programs[0], '15433', '15434'].join(' ')) };
    const stdout = JSON.stringify({ schema: 'mission-control.task4-policy-probe-output.v1', allowed, denied }) + '\n';
    const original = { schema: 'mission-control.task4-policy-probe-original.v1', ...binding, owner, parentOwner: ready.setup.owner, policyHash: 'a'.repeat(64), launcherHash: 'b'.repeat(64),
        executableHash: owner.executableHash, commandHash: owner.commandHash, exit: { code: 0, signal: null, exitObserved: true, closeObserved: true }, allowed, denied, stdout, stderr: '', stdoutHash: hash(stdout), stderrHash: hash(''),
        canaryBefore: { sha256: 'c'.repeat(64), bytes: 1 }, canaryAfter: { sha256: 'd'.repeat(64), bytes: 1 }, canaryClosed: { sha256: 'e'.repeat(64), bytes: 1 } };
    const bindings = { hash, task4CanonicalV1: m.task4CanonicalV1, TASK4_POLICY_PROBE_PROGRAM: programs[0], task4ArtifactBindingV1: () => binding,
        keys: (v: any, expected: string) => assert.deepEqual(Object.keys(v).sort(), expected.split(' ').sort()), date: (v: string) => assert.equal(new Date(v).toISOString(), v),
        processPin: (v: any) => { assert.ok(Number.isSafeInteger(v.pid)); }, requireValue: (v: unknown, c: string) => { if (!v) throw Error(c); } };
    const fn = vm.compileFunction(nodes[0].getText(ast) + '\nreturn validateTask4ProbeOriginalV1;', Object.keys(bindings))(...Object.values(bindings));
    for (const fault of [null, 'close', 'errno', 'stdout', 'parent', 'command']) await t.test(fault ?? 'canonical', () => {
        const value = JSON.parse(m.task4CanonicalV1(original)); if (fault === 'close') value.exit.closeObserved = false; if (fault === 'errno') value.denied.errno = 'ECONNREFUSED';
        if (fault === 'stdout') { value.stdout += 'extra'; value.stdoutHash = hash(value.stdout); } if (fault === 'parent') value.parentOwner.pid++; if (fault === 'command') value.commandHash = 'f'.repeat(64);
        const context = { ready, owner: ready.fixtureOwner, node: ready.setup.owner.executable, nodeHash: ready.setup.owner.executableHash };
        if (fault) assert.throws(() => fn(value, context, 'a'.repeat(64), 'b'.repeat(64), 15433, 15434)); else assert.doesNotThrow(() => fn(value, context, 'a'.repeat(64), 'b'.repeat(64), 15433, 15434));
    });
});

test('Task4 artifact reader binds canonical bytes to exact fixed owned-area hash references', async () => {
    const ts = await import('typescript'), vm = await import('node:vm'), fs = await import('node:fs'), path = await import('node:path'), os = await import('node:os'), m = await load();
    const text = readFileSync(new URL('../scripts/render-smoke-owned-fixture.mjs', import.meta.url), 'utf8'), ast = ts.createSourceFile('fixture.mjs', text, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
    const nodes = ast.statements.filter(n => ts.isFunctionDeclaration(n) && n.name?.text === 'readTask4ArtifactV1'); assert.equal(nodes.length, 1);
    const bindings = { fs, path, process, hash, task4CanonicalV1: m.task4CanonicalV1, captureTask4FileV1: m.captureTask4FileV1,
        keys: (v: any, expected: string) => assert.deepEqual(Object.keys(v).sort(), expected.split(' ').sort()), requireValue: (v: unknown, c: string) => { if (!v) throw Error(c); } };
    const fn = vm.compileFunction(nodes[0].getText(ast) + '\nreturn readTask4ArtifactV1;', Object.keys(bindings))(...Object.values(bindings));
    const root = fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), 'task4-artifact-read-component-')); fs.chmodSync(root, 0o700); const pin = m.captureTask4DirectoryV1(root, true);
    try {
        fs.mkdirSync(path.join(root, 'outer'), { mode: 0o700 }); fs.mkdirSync(path.join(root, 'outer/artifacts'), { mode: 0o700 });
        const bytes = Buffer.from('{"fixed":true}\n'), ref = { sha256: hash(bytes), bytes: bytes.length }; fs.writeFileSync(path.join(root, 'outer/artifacts', ref.sha256 + '.json'), bytes, { mode: 0o600 });
        assert.deepEqual(fn(pin, 'outer', ref), { fixed: true }); assert.throws(() => fn(pin, '../outer', ref)); assert.throws(() => fn(pin, 'outer', { ...ref, bytes: ref.bytes + 1 }));
        const malformed = Buffer.from('{"z":1,"a":2}\n'), bad = { sha256: hash(malformed), bytes: malformed.length }; fs.writeFileSync(path.join(root, 'outer/artifacts', bad.sha256 + '.json'), malformed, { mode: 0o600 }); assert.throws(() => fn(pin, 'outer', bad));
    } finally { pin.close(); fs.rmSync(root, { recursive: true, force: true }); }
});

test('Task4 inner policy handshake waits for outer originals and own mock socket closure before accepting final receipt', async (t) => {
    const ts = await import('typescript'), vm = await import('node:vm'), m = await load();
    const text = readFileSync(new URL('../scripts/render-smoke-owned-fixture.mjs', import.meta.url), 'utf8'), ast = ts.createSourceFile('fixture.mjs', text, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
    const nodes = ast.statements.filter(n => ts.isFunctionDeclaration(n) && n.name?.text === 'runTask4InnerProbeV1'); assert.equal(nodes.length, 1);
    for (const fault of [null, 'foreign_final', 'accepted_canary']) await t.test(fault ?? 'bound', async () => {
        const ready = JSON.parse(GOLDEN_READY), events: string[] = [], refs = (n: string) => ({ sha256: n.repeat(64), bytes: 1 });
        const binding = { executionId: ready.executionId, setupDescriptorHash: ready.setupDescriptorHash, readyDescriptorHash: hash(GOLDEN_READY + '\n') };
        const outcome = { startedAt: '2026-10-19T09:00:02.000Z', finishedAt: '2026-10-19T09:00:02.010Z', outcome: 'connected', errno: null };
        const original: any = { owner: ready.setup.owner, allowed: outcome, denied: { ...outcome, outcome: 'denied', errno: 'EPERM' }, canaryBefore: refs('1'), canaryAfter: refs('2'), canaryClosed: refs('3') };
        const mock: any = { schema: 'mission-control.task4-policy-probe-mock.v1', ...binding, owner: ready.fixtureOwner, before: refs('4'), after: refs('5'), acceptedConnections: 1, sockets: { opened: 1, closed: 1, active: 0 } };
        const canary = (state: string) => ({ schema: 'mission-control.task4-policy-probe-listener.v1', ...binding, endpointRole: 'owned_denied_canary', host: '127.0.0.1', port: 15434,
            at: state === 'absent' ? '2026-10-19T09:00:03.000Z' : '2026-10-19T09:00:01.000Z', state, owner: ready.setup.owner, acceptedConnections: fault === 'accepted_canary' ? 1 : 0, original: { method: 'owned_http_server', observed: true } });
        const values = new Map<any, any>([['1'.repeat(64), canary('listening')], ['2'.repeat(64), { ...canary('listening'), at: '2026-10-19T09:00:02.100Z' }], ['3'.repeat(64), canary('absent')]]);
        const final = { schema: 'mission-control.task4-network-policy-probe.v1', ...binding, policyHash: fault === 'foreign_final' ? 'x'.repeat(64) : 'a'.repeat(64), launcherHash: 'b'.repeat(64), owner: original.owner,
            allowed: { endpointRole: 'owned_allowed_mock', ...outcome, listenerBefore: mock.before, listenerAfter: mock.after, acceptedConnections: 1 },
            denied: { endpointRole: 'owned_denied_canary', ...original.denied, listenerBefore: original.canaryBefore, listenerAfter: original.canaryAfter, acceptedConnections: 0 }, exit: { code: 0, signal: null }, closeObserved: true, original: refs('6') };
        values.set('6'.repeat(64), original); values.set('4'.repeat(64), { listener: 'before' }); values.set('5'.repeat(64), { listener: 'after' });
        const state: any = { policyHash: 'a'.repeat(64), launcherHash: 'b'.repeat(64), server: { intent: () => refs('7') }, mock: { port: 15433, listenRef: mock.before, waitProbeClose: async () => { events.push('mock-close'); }, probeReceipt: () => mock } };
        const bindings = { captureTask4DirectoryV1: () => ({ value: ready.setup.resourceRoot, check() {}, close() { events.push('pin-close'); } }), task4ArtifactBindingV1: () => binding,
            publishTask4FixedV1: (_pin: any, name: string) => { events.push(name); return refs('8'); },
            waitTask4FixedV1: async (_context: any, _pin: any, name: string) => { events.push(name); return name === 'policy-probe-original.json' ? { value: original, ref: refs('6') } : { value: final, ref: refs('9') }; },
            readTask4ArtifactV1: (_pin: any, _area: string, ref: any) => values.get(ref.sha256), validateTask4ProbeOriginalV1: () => { events.push('validate-original'); },
            task4CanonicalV1: m.task4CanonicalV1, keys: (v: any, expected: string) => assert.deepEqual(Object.keys(v).sort(), expected.split(' ').sort()), date: (v: string) => assert.equal(new Date(v).toISOString(), v),
            requireValue: (v: unknown, c: string) => { if (!v) throw Error(c); }, task4BoundedV1: (v: any) => v };
        const fn = vm.compileFunction(nodes[0].getText(ast) + '\nreturn runTask4InnerProbeV1;', Object.keys(bindings))(...Object.values(bindings));
        const context = { ready, owner: ready.fixtureOwner, check() {} };
        if (fault) await assert.rejects(fn(context, state)); else { await fn(context, state); assert.deepEqual(state.probe, refs('9')); assert.ok(events.indexOf('mock-close') < events.indexOf('policy-probe-mock.json')); assert.ok(events.indexOf('policy-probe-original.json') < events.indexOf('mock-close')); }
        assert.equal(events[0], 'policy-probe-request.json'); assert.equal(events.at(-1), 'pin-close');
    });
});

test('Task4 network assembly requires real closure counters, original policy receipt and proxy binding', async () => {
    const ts = await import('typescript'), vm = await import('node:vm'), m = await load();
    const text = readFileSync(new URL('../scripts/render-smoke-owned-fixture.mjs', import.meta.url), 'utf8'), ast = ts.createSourceFile('fixture.mjs', text, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
    const nodes = ast.statements.filter(n => ts.isFunctionDeclaration(n) && n.name?.text === 'buildTask4NetworkV1'); assert.equal(nodes.length, 1);
    const ready = JSON.parse(GOLDEN_READY), owner = ready.fixtureOwner, ref = { sha256: 'a'.repeat(64), bytes: 1 };
    let closed = true; const state: any = { policyHash: 'b'.repeat(64), launcherHash: 'c'.repeat(64), probe: ref, proxy: ref,
        server: { binding: () => ({ observed: ref, owner }) }, mock: { rows: () => [{ finished: true, closed }], complete: () => closed },
        fence: { value: () => ({ browserInstalledAt: '2026-10-19T09:00:01.000Z', browser: [{ seq: 1 }], complete: true }) } };
    const bindings = { hash, task4CanonicalV1: m.task4CanonicalV1, NETWORK_RECIPES: m.task4NetworkRecipesV1(), task4ArtifactBindingV1: () => ({}), freeze: (v: any) => v };
    const fn = vm.compileFunction(nodes[0].getText(ast) + '\nreturn buildTask4NetworkV1;', Object.keys(bindings))(...Object.values(bindings));
    const result = fn({ ready }, state); assert.equal(result.complete, true); assert.equal(result.policy.serverLaunchRef, ref); assert.equal(result.osFence.serverOwner, owner);
    assert.equal(result.osFence.actualAllowed.proxy, ref); assert.equal(result.policy.recipeHash, hash(m.task4CanonicalV1(m.task4NetworkRecipesV1())));
    closed = false; assert.equal(fn({ ready }, state).complete, false); closed = true; state.probe = null; assert.equal(fn({ ready }, state).complete, false);
});

test('Task4 outer composition retains original custody and refuses PG stop before paired child cleanup', async (t) => {
    const ts = await import('typescript'), vm = await import('node:vm');
    const text = readFileSync(new URL('../scripts/render-smoke-owned-fixture.mjs', import.meta.url), 'utf8'), ast = ts.createSourceFile('fixture.mjs', text, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
    const nodes = ast.statements.filter(n => ts.isFunctionDeclaration(n) && n.name?.text === 'runTask4OuterV1'); assert.equal(nodes.length, 1);
    for (const fault of [null, 'probe', 'paired', 'pg_close', 'admin']) await t.test(fault ?? 'pass', async () => {
        const events: string[] = [], state: any = { errors: [], runner: null, postgres: null };
        const bindings: any = { requireValue: (v: any, c: string) => { if (!v) throw Error(c); },
            prepareTask4OuterResourcesV1: async () => { events.push('resources'); return state; },
            startTask4PostgresV1: async (_c: any, s: any) => { s.adminClosed = fault !== 'admin'; s.postgres = { close: async () => { events.push('pg_close'); if (fault === 'pg_close') throw Error('TASK4_CLEANUP_UNKNOWN'); } }; events.push('postgres'); },
            startTask4RunnerV1: async (_c: any, s: any) => { s.runner = { wait: async () => { events.push('runner_close'); } }; events.push('runner'); },
            runTask4OuterProbeV1: async () => { events.push('probe'); if (fault === 'probe') throw Error('TASK4_INTEGRITY_FAILED'); },
            readTask4PairedResultsV1: async () => { events.push('paired'); if (fault === 'paired') throw Error('TASK4_INTEGRITY_FAILED'); return { closed: true }; },
            task4RecordFailureV1: (s: any, e: any) => s.errors.push(e.message),
            finalizeTask4OuterV1: async () => { events.push('final'); return state; } };
        const fn = vm.compileFunction(nodes[0].getText(ast) + '\nreturn runTask4OuterV1;', Object.keys(bindings))(...Object.values(bindings));
        await fn({ ready: null, check() { events.push('check'); } });
        assert.ok(events.indexOf('postgres') < events.indexOf('runner')); assert.ok(events.indexOf('runner_close') < events.indexOf('paired'));
        assert.equal(events.includes('pg_close'), fault !== 'paired' && fault !== 'admin'); assert.equal(events.at(-1), 'final');
        if (fault) assert.ok(state.errors.length > 0);
    });
});

test('Task4 PostgreSQL recipe closes logging, authentication and exact owned path inputs without ambient environment', async () => {
    const ts = await import('typescript'), vm = await import('node:vm'), path = await import('node:path');
    const text = readFileSync(new URL('../scripts/render-smoke-owned-fixture.mjs', import.meta.url), 'utf8'), ast = ts.createSourceFile('fixture.mjs', text, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
    const nodes = ast.statements.filter(n => ts.isFunctionDeclaration(n) && n.name?.text === 'task4PostgresRecipeV1'); assert.equal(nodes.length, 1);
    const fn = vm.compileFunction(nodes[0].getText(ast) + '\nreturn task4PostgresRecipeV1;', ['path', 'requireValue'])(path, (v: any) => { if (!v) throw Error('refused'); });
    const r = fn('/private/tmp/task4-' + 'a'.repeat(32), 15432);
    assert.deepEqual(r.initdb.slice(-3), ['--auth-local=scram-sha-256', '--auth-host=scram-sha-256', '--no-instructions']);
    assert.ok(r.postgres.includes('log_min_error_statement=panic')); assert.ok(r.postgres.includes('log_statement=none'));
    assert.ok(r.postgres.includes('log_line_prefix=%m|%p|%c|%u|%d|%a|%e| ')); assert.ok(r.postgres.includes('logging_collector=off'));
    assert.ok(r.postgres.includes('listen_addresses=127.0.0.1')); assert.ok(r.postgres.includes('unix_socket_permissions=0700'));
    assert.deepEqual(Object.keys(r.env).sort(), ['HOME', 'LANG', 'LC_ALL', 'PATH', 'TMPDIR', 'TZ']);
    assert.equal(r.env.PATH, '/usr/bin:/bin'); assert.ok(!JSON.stringify(r).includes('password='));
    for (const port of [3080, 3333, 5432, 13081, 18789, 0, 65536]) assert.throws(() => fn('/private/tmp/task4-' + 'a'.repeat(32), port));
});

test('Task4 outer resources create exclusive private roots and a bounded sanitized locator only after pins', async () => {
    const ts = await import('typescript'), vm = await import('node:vm'), fs = await import('node:fs'), os = await import('node:os'), path = await import('node:path'), m = await load();
    const text = readFileSync(new URL('../scripts/render-smoke-owned-fixture.mjs', import.meta.url), 'utf8'), ast = ts.createSourceFile('fixture.mjs', text, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
    const nodes = ast.statements.filter(n => ts.isFunctionDeclaration(n) && n.name?.text === 'prepareTask4OuterResourcesV1'); assert.equal(nodes.length, 1);
    const temp = fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), 'task4-outer-component-')); const lines: string[] = []; let checked = false;
    const bindings = { fs, path, tmpdir: () => temp, randomBytes: () => Buffer.from('a'.repeat(32), 'hex'),
        captureTask4DirectoryV1: m.captureTask4DirectoryV1, task4CanonicalV1: m.task4CanonicalV1,
        process: { stdout: { write: (v: string) => lines.push(v) } }, requireValue: (v: any, c: string) => { if (!v) throw Error(c); } };
    const fn = vm.compileFunction(nodes[0].getText(ast) + '\nreturn prepareTask4OuterResourcesV1;', Object.keys(bindings))(...Object.values(bindings));
    try { const context: any = { check() { checked = true; } }; const s = await fn(context); assert.ok(checked); assert.equal(lines.length, 1);
        assert.deepEqual(JSON.parse(lines[0]), { schema: 'mission-control.render-smoke-outer-started.v1', executionId: 'a'.repeat(32), resourceRoot: path.join(temp, 'task4-' + 'a'.repeat(32)) });
        assert.deepEqual(fs.readdirSync(s.root.value.path).sort(), ['home', 'outer', 'postgres-data', 'postgres-socket', 'tmp']);
        for (const name of ['home', 'outer', 'postgres-data', 'postgres-socket', 'tmp']) assert.equal(fs.statSync(path.join(s.root.value.path, name)).mode & 0o777, 0o700);
        await assert.rejects(fn(context)); assert.equal(lines.length, 1); s.root.close();
    } finally { fs.rmSync(temp, { recursive: true, force: true }); }
});

test('Task4 owned port guard retains custody before listen and closes only its original listener with zero accepted connections', async () => {
    const ts = await import('typescript'), vm = await import('node:vm'), { EventEmitter } = await import('node:events');
    const text = readFileSync(new URL('../scripts/render-smoke-owned-fixture.mjs', import.meta.url), 'utf8'), ast = ts.createSourceFile('fixture.mjs', text, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
    const nodes = ast.statements.filter(n => ts.isFunctionDeclaration(n) && n.name?.text === 'createTask4PortGuardV1'); assert.equal(nodes.length, 1);
    let finish: any; const server: any = new EventEmitter(); server.listening = false; server.address = () => server.listening ? { address: '127.0.0.1', family: 'IPv4', port: 15439 } : null;
    const state: any = {}; server.listen = (options: any, callback: any) => { assert.ok(state.canary); assert.deepEqual(options, { host: '127.0.0.1', port: 0, exclusive: true }); server.listening = true; callback(); };
    server.close = (callback: any) => { finish = () => { server.listening = false; callback(); }; };
    const bindings = { createHttpServer: () => server, task4BoundedV1: (v: any) => v, requireValue: (v: any, c: string) => { if (!v) throw Error(c); } };
    const fn = vm.compileFunction(nodes[0].getText(ast) + '\nreturn createTask4PortGuardV1;', Object.keys(bindings))(...Object.values(bindings));
    const guard = await fn({ check() {} }, state, 'canary'); assert.equal(guard.port, 15439); assert.equal(guard.closed(), false);
    const closing = guard.close(); await Promise.resolve(); assert.equal(guard.closed(), false); finish(); await closing; assert.equal(guard.closed(), true);
    await assert.rejects(guard.close());
    const s2: any = {}; const g2 = await fn({ check() {} }, s2, 'canary'); server.emit('connection', { on() {} });
    assert.throws(() => g2.snapshot(), /TASK4_NETWORK_REFUSED/);
});

test('Task4 fixed poll refuses evidence arriving at or after its unchanged absolute deadline', async (t) => {
    const ts = await import('typescript'), vm = await import('node:vm');
    const text = readFileSync(new URL('../scripts/render-smoke-owned-fixture.mjs', import.meta.url), 'utf8'), ast = ts.createSourceFile('fixture.mjs', text, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
    const nodes = ast.statements.filter(n => ts.isFunctionDeclaration(n) && n.name?.text === 'waitTask4FixedV1'); assert.equal(nodes.length, 1);
    for (const edge of ['before', 'read', 'context', 'positive']) await t.test(edge, async () => {
        let now = edge === 'before' ? 100 : 98, reads = 0;
        const bindings = { Date: { now: () => now }, readTask4FixedV1: () => { reads++; if (edge === 'read') now = 100; return { value: true }; },
            task4WaitV1: async () => { now = 100; }, requireValue: (v: any, c: string) => { if (!v) throw Error(c); } };
        const fn = vm.compileFunction(nodes[0].getText(ast) + '\nreturn waitTask4FixedV1;', Object.keys(bindings))(...Object.values(bindings));
        const call = fn({ check() { if (edge === 'context') now = 100; } }, {}, 'policy-probe.json', 100);
        if (edge === 'positive') assert.deepEqual(await call, { value: true }); else await assert.rejects(call);
        if (edge === 'before') assert.equal(reads, 0);
    });
});

test('Task4 postmaster controller requires original exit and close plus retained cohort absence; never adopts a changed owner', async (t) => {
    const ts = await import('typescript'), vm = await import('node:vm'), path = await import('node:path'), { EventEmitter } = await import('node:events');
    const text = readFileSync(new URL('../scripts/render-smoke-owned-fixture.mjs', import.meta.url), 'utf8'), ast = ts.createSourceFile('fixture.mjs', text, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
    const nodes = ast.statements.filter(n => ts.isFunctionDeclaration(n) && n.name?.text === 'createTask4PostmasterV1'); assert.equal(nodes.length, 1);
    for (const fault of [null, 'owner', 'close', 'cohort', 'listener']) await t.test(fault ?? 'closed', async () => {
        const events: string[] = [], owner = { pid: 41002, ppid: 41001 }, child: any = new EventEmitter(); child.pid = owner.pid;
        child.kill = (signal: string) => { events.push(signal); return true; }; const state: any = { root: { value: { path: '/private/task4' }, check() {} } };
        const original = { ended: () => false, wait: async () => { events.push('exit_close'); if (fault === 'close') throw Error('unknown'); return { code: 0, signal: null, exitObserved: true, closeObserved: true }; } };
        const bindings: any = { path, TASK4_PG_BIN: (await task4FixedSourcePaths()).TASK4_PG_BIN, fs: { openSync: () => 10, closeSync: () => events.push('log_close'), constants: {} },
            spawn: (exe: string, argv: string[], options: any) => { assert.equal(exe, '/Users/setrox/ai/setrox/.task4-toolchain-v1/Cellar/postgresql@17/17.10/bin/postgres'); assert.equal(options.stdio[2], 10); return child; },
            retainTask4ChildV1: () => original, task4ObservePostmasterV1: async () => { if (fault === 'owner' && events.includes('observed')) throw Error('changed'); events.push('observed'); return owner; },
            task4OuterListenerV1: async () => fault === 'listener' ? 'listening' : 'absent',
            task4PostgresCensusV1: async (_c: any, _s: any, after: boolean) => { events.push(after ? 'absent' : 'census'); if (after && fault === 'cohort') throw Error('retained'); },
            task4CanonicalV1: JSON.stringify, task4FileSnapshotV1: () => ({ hash: 'pg' }), requireValue: (v: any, c: string) => { if (!v) throw Error(c); } };
        const fn = vm.compileFunction(nodes[0].getText(ast) + '\nreturn createTask4PostmasterV1;', Object.keys(bindings))(...Object.values(bindings));
        const controller = fn({ check() {} }, state, { postgres: ['-D', '/private/task4/postgres-data'], env: {} });
        assert.equal(state.postgres, controller); await controller.observe();
        if (fault) { await assert.rejects(controller.close()); assert.equal(controller.settlement(), null); } else { await controller.close(); assert.ok(events.indexOf('census') < events.indexOf('SIGTERM')); assert.ok(events.indexOf('exit_close') < events.indexOf('absent')); assert.ok(controller.settlement()); }
        if (fault === 'owner') assert.ok(!events.includes('SIGTERM'));
    });
});

test('Task4 PostgreSQL census parses complete raw snapshots and rejects retained or foreign descendant identities', async (t) => {
    const ts = await import('typescript'), vm = await import('node:vm'), path = await import('node:path'), m = await load();
    const { parseUiMetadataSnapshotV1 } = await import('../scripts/ui-regression-lifecycle.mjs');
    const text = readFileSync(new URL('../scripts/render-smoke-owned-fixture.mjs', import.meta.url), 'utf8'), ast = ts.createSourceFile('fixture.mjs', text, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
    const nodes = ast.statements.filter(n => ts.isFunctionDeclaration(n) && n.name?.text === 'task4PostgresCensusV1'); assert.equal(nodes.length, 1);
    for (const fault of [null, 'retained', 'foreign', 'malformed']) await t.test(fault ?? 'absent', async () => {
        const owner = { pid: 41002, ppid: 41001, uid: 501, pgid: 41001, startedAt: '2026-10-19T09:00:00.000Z' }, writes: any[] = []; let reads = 0, clock = 1000;
        const before = '41002 41001 41001 501 Mon Oct 19 09:00:00 2026\n41003 41002 41001 ' + (fault === 'foreign' ? '502' : '501') + ' Mon Oct 19 09:00:00 2026\n' + Array.from({ length: 600 }, (_, i) => `${50000+i} 1 1 501 Mon Oct 19 08:00:00 2026\n`).join('');
        const state: any = { root: { value: { path: '/private/task4' }, check() {} }, postgres: { owner } };
        const context = { owner: { uid: 501 }, check() {}, modules: { native: { createUiPsReaderV1: () => async () => { reads++; return reads === 1 || fault === 'retained' ? before : fault === 'malformed' ? 'partial' : '1 0 1 0 Mon Oct 19 08:00:00 2026\n'; }, parseUiMetadataSnapshotV1,
            observeUiProcessV1: async (pid: number) => ({ ...owner, pid, ppid: pid === 41002 ? 41001 : 41002, executable: '/pg', rawArgs: 'pg' }) } } };
        const bindings = { path, Date: class extends Date { static now() { return clock; } }, hash, task4CanonicalV1: m.task4CanonicalV1,
            task4PrivateBytesV1: (_p: string, n: string, b: Buffer) => { writes.push({ n, value: n.endsWith('.log') ? b.toString() : JSON.parse(b.toString()) }); return { sha256: hash(b), bytes: b.length }; },
            task4WaitV1: async (ms: number) => { clock += ms; }, requireValue: (v: any, c: string) => { if (!v) throw Error(c); } };
        const fn = vm.compileFunction(nodes[0].getText(ast) + '\nreturn task4PostgresCensusV1;', Object.keys(bindings))(...Object.values(bindings));
        if (fault === 'foreign') { await assert.rejects(fn(context, state, false)); return; }
        await fn(context, state, false); assert.equal(state.pgCohort.length, 2); assert.equal(writes[0].value, before); assert.equal(writes[1].value.raw.sha256, hash(before));
        if (fault) await assert.rejects(fn(context, state, true)); else { await fn(context, state, true); assert.equal(state.pgAbsence.length, 2); assert.ok(state.pgAbsence[1].observedAtMs - state.pgAbsence[0].observedAtMs >= 100); }
    });
});

test('Task4 PG bootstrap binds original initdb completion before postmaster and verified SQL before setup', async (t) => {
    const ts = await import('typescript'), vm = await import('node:vm'), path = await import('node:path'), m = await load();
    const text = readFileSync(new URL('../scripts/render-smoke-owned-fixture.mjs', import.meta.url), 'utf8'), ast = ts.createSourceFile('fixture.mjs', text, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
    const nodes = ast.statements.filter(n => ts.isFunctionDeclaration(n) && n.name?.text === 'startTask4PostgresV1'); assert.equal(nodes.length, 1);
    for (const fault of [null, 'initdb', 'identity']) await t.test(fault ?? 'verified', async () => {
        const events: string[] = [], ready = JSON.parse(GOLDEN_READY), state: any = { executionId: ready.executionId, root: { value: ready.setup.resourceRoot, check() {} } };
        const context: any = { ready: null, owner: ready.setup.owner, sf: { rootPin: ready.setup.setfarm.rootPin }, mc: { rootPin: ready.setup.missionControl.rootPin }, launch: { setfarm: ready.setup.setfarm.source, missionControl: ready.setup.missionControl.source }, check() {} };
        const bindings: any = { path, Buffer, randomBytes: () => Buffer.from('pw'), hash, task4CanonicalV1: m.task4CanonicalV1, parseTask4FrameV1: (b: Buffer) => JSON.parse(b.toString()),
            task4PostgresRecipeV1: () => ({ initdb: ['fixed'], env: {} }), task4PrivateBytesV1: () => ({}),
            task4PinnedPgV1: () => ({ initdb: '/pg/initdb', postgres: '/pg/postgres' }),
            spawn: () => { events.push('initdb'); return { pid: 41000 }; }, retainTask4ChildV1: () => ({ wait: async () => { events.push('initdb_close'); return { code: fault === 'initdb' ? 1 : 0, signal: null }; }, originals: () => ({}) }),
            task4SaveOriginalV1: () => {}, createTask4PortGuardV1: async () => ({ port: 15432, close: async () => { events.push('port_closed'); } }),
            createTask4PostmasterV1: (_c: any, s: any) => { events.push('postgres'); const pg = { observe: async () => ready.setup.postgres.process }; s.postgres = pg; return pg; },
            task4AwaitPostgresV1: async () => { events.push('sql_verified'); if (fault === 'identity') throw Error('TASK4_DATABASE_REFUSED'); return ready.setup.postgres.serverStartedAt; },
            captureTask4DirectoryV1: (p: string) => ({ value: p.endsWith('postgres-data') ? ready.setup.postgres.data : ready.setup.postgres.socket, close() {} }),
            task4FileSnapshotV1: () => ({ hash: 'a'.repeat(64) }), requireValue: (v: any, c: string) => { if (!v) throw Error(c); } };
        const fn = vm.compileFunction(nodes[0].getText(ast) + '\nreturn startTask4PostgresV1;', Object.keys(bindings))(...Object.values(bindings));
        if (fault) { await assert.rejects(fn(context, state)); assert.equal(state.setup, undefined); } else { await fn(context, state); assert.equal(state.setup.postgres.serverStartedAt, ready.setup.postgres.serverStartedAt); assert.ok(events.indexOf('initdb_close') < events.indexOf('postgres')); assert.equal(state.setup.postgres.adminUrlHash, hash(state.adminUrl)); }
        if (fault === 'initdb') assert.ok(!events.includes('postgres'));
    });
});

test('Task4 installed PG pins and raw postmaster command refuse changed bytes and observed command drift', async () => {
    const ts = await import('typescript'), vm = await import('node:vm'), m = await load();
    const text = readFileSync(new URL('../scripts/render-smoke-owned-fixture.mjs', import.meta.url), 'utf8'), ast = ts.createSourceFile('fixture.mjs', text, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
    const names = ['task4PinnedPgV1', 'task4ObservePostmasterV1'], nodes = ast.statements.filter(n => ts.isFunctionDeclaration(n) && names.includes(n.name?.text ?? '')); assert.equal(nodes.length, 2);
    const hashes: any = { initdb: '43f864de4746e096246a2a9f9784ccbd7364b35b2301b82aeeb6d2a12c1912c4', postgres: '38c50336c63ae8b73b799a8c0ebc4f948e311eee882a633c8286d1ca4110b502', pg_ctl: 'ba12d9fbe4492e3ab0e8bcedd53e3a0da8163fd8c2cef340dfaf619af0e132c5', psql: 'bb4ef660720948d242d8c4e32450ae5607241510dc8f06cf685048e4c493447d' }; let drift = false;
    const bindings = { path: await import('node:path'), TASK4_PG_BIN: (await task4FixedSourcePaths()).TASK4_PG_BIN, task4FileSnapshotV1: (p: string, cap: number, kind: string) => {
        const name = p.split('/').at(-1)!;
        assert.equal(p, '/Users/setrox/ai/setrox/.task4-toolchain-v1/Cellar/postgresql@17/17.10/bin/' + name);
        assert.equal(cap, 536870912); assert.equal(kind, 'installed');
        return { hash: drift ? '0'.repeat(64) : hashes[name] };
    }, bindTask4ProcessV1: m.bindTask4ProcessV1, requireValue: (v: any, c: string) => { if (!v) throw Error(c); } };
    const fns = vm.compileFunction(nodes.map(n => n.getText(ast)).join('\n') + '\nreturn {task4PinnedPgV1,task4ObservePostmasterV1};', Object.keys(bindings))(...Object.values(bindings));
    const bins = fns.task4PinnedPgV1(); assert.equal(Object.keys(bins).length, 4); drift = true; assert.throws(() => fns.task4PinnedPgV1()); drift = false;
    const observed: any = { pid: 41002, ppid: 41001, pgid: 41001, uid: 501, startedAt: '2026-10-19T09:00:00.000Z', executable: bins.postgres, rawArgs: bins.postgres + ' -D /private/data' };
    const context = { owner: { pid: 41001, uid: 501 }, check() {}, modules: { native: { observeUiProcessV1: async () => observed } } };
    await fns.task4ObservePostmasterV1(context, { pid: 41002 }, { postgres: ['-D', '/private/data'] });
    for (const wrong of ['/opt/homebrew/Cellar/postgresql@17/17.10/bin/postgres', bins.postgres.replace('toolchain-v1', 'toolchain-v2')]) {
        observed.executable = wrong; observed.rawArgs = wrong + ' -D /private/data';
        await assert.rejects(fns.task4ObservePostmasterV1(context, { pid: 41002 }, { postgres: ['-D', '/private/data'] }), /TASK4_BINDING_REFUSED/);
    }
    observed.executable = bins.postgres; observed.rawArgs = bins.postgres + ' -D /private/data extra';
    await assert.rejects(fns.task4ObservePostmasterV1(context, { pid: 41002 }, { postgres: ['-D', '/private/data'] }));
});

test('Task4 PG readiness requires original owned listener then exact SQL identity and awaited admin closure', async (t) => {
    const ts = await import('typescript'), vm = await import('node:vm'), path = await import('node:path');
    const text = readFileSync(new URL('../scripts/render-smoke-owned-fixture.mjs', import.meta.url), 'utf8'), ast = ts.createSourceFile('fixture.mjs', text, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
    const nodes = ast.statements.filter(n => ts.isFunctionDeclaration(n) && n.name?.text === 'task4AwaitPostgresV1'); assert.equal(nodes.length, 1);
    for (const fault of [null, 'foreign', 'sql', 'close']) await t.test(fault ?? 'ready', async () => {
        const events: string[] = [], row: any = { database: 'postgres', role: 'task4_admin', data_directory: '/private/root/postgres-data', port: 15432, version: 170010, started_at: '2026-10-19T09:00:01.000000Z' };
        if (fault === 'sql') row.data_directory = '/foreign';
        const state: any = { root: { value: { path: '/private/root' } }, pgPort: 15432, adminUrl: 'private', postgres: { observe: async () => ({ pid: 41002 }) } };
        const bindings = { path, task4OuterListenerV1: async () => { events.push('listener'); if (fault === 'foreign') throw Error('foreign'); return 'listening'; }, task4WaitV1: async () => {},
            task4PostgresV1: async () => (url: string, options: any) => { assert.equal(url, 'private'); assert.equal(options.fetch_types, false); return { unsafe: async () => { events.push('sql'); return [row]; }, end: async () => { events.push('end'); if (fault === 'close') throw Error('close'); } }; },
            task4BoundedV1: (v: any) => v, date: (v: string) => assert.equal(v, row.started_at), requireValue: (v: any, c: string) => { if (!v) throw Error(c); } };
        const fn = vm.compileFunction(nodes[0].getText(ast) + '\nreturn task4AwaitPostgresV1;', Object.keys(bindings))(...Object.values(bindings));
        if (fault) await assert.rejects(fn({ check() {} }, state)); else assert.equal(await fn({ check() {} }, state), row.started_at);
        if (fault === 'foreign') assert.deepEqual(events, ['listener']); else { assert.equal(events.at(-1), 'end'); assert.equal(state.adminClosed, fault !== 'close'); }
    });
});

test('Task4 outer listener preserves original helper bytes and rejects foreign or partial output', async (t) => {
    const ts = await import('typescript'), vm = await import('node:vm'), path = await import('node:path'), m = await load();
    const text = readFileSync(new URL('../scripts/render-smoke-owned-fixture.mjs', import.meta.url), 'utf8'), ast = ts.createSourceFile('fixture.mjs', text, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
    const nodes = ast.statements.filter(n => ts.isFunctionDeclaration(n) && n.name?.text === 'task4OuterListenerV1'); assert.equal(nodes.length, 1);
    for (const fault of [null, 'absent', 'foreign', 'partial']) await t.test(fault ?? 'owned', async () => {
        const raw = fault === 'absent' ? '' : `p${fault === 'foreign' ? 999 : 41002}\ncpostgres\nf7\nn127.0.0.1:15432\n` + (fault === 'partial' ? 'partial' : '');
        const state: any = { root: { value: { path: '/private/root' } } }, writes: any[] = [];
        const bindings = { path, hash, task4CanonicalV1: m.task4CanonicalV1, classifyTask4ListenerV1: m.classifyTask4ListenerV1,
            spawn: (exe: string, argv: string[], options: any) => { assert.equal(exe, '/usr/sbin/lsof'); assert.deepEqual(argv, ['-nP', '-iTCP:15432', '-sTCP:LISTEN', '-Fpcfn']); assert.equal(options.env.HOME, '/private/root/home'); return {}; },
            retainTask4ChildV1: () => ({ wait: async () => ({ code: fault === 'absent' ? 1 : 0, signal: null, exitObserved: true, closeObserved: true }), originals: () => ({ stdout: raw, stderr: '' }) }),
            task4PrivateBytesV1: (_d: string, _n: string, b: Buffer) => { writes.push(JSON.parse(b.toString())); }, requireValue: (v: any, c: string) => { if (!v) throw Error(c); } };
        const fn = vm.compileFunction(nodes[0].getText(ast) + '\nreturn task4OuterListenerV1;', Object.keys(bindings))(...Object.values(bindings));
        const call = fn({ check() {} }, state, 15432, { pid: 41002 });
        if (fault === 'foreign' || fault === 'partial') await assert.rejects(call); else assert.equal(await call, fault === 'absent' ? 'absent' : 'listening');
        assert.equal(writes.length, 1); assert.equal(writes[0].stdout, raw);
    });
});

test('Task4 P3 launcher uses exact six-cell vector and original fd4, retains child on failed delivery, and awaits exit plus close', async (t) => {
    const ts = await import('typescript'), vm = await import('node:vm'), path = await import('node:path'), m = await load();
    const text = readFileSync(new URL('../scripts/render-smoke-owned-fixture.mjs', import.meta.url), 'utf8'), ast = ts.createSourceFile('fixture.mjs', text, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
    const nodes = ast.statements.filter(n => ts.isFunctionDeclaration(n) && n.name?.text === 'startTask4RunnerV1'); assert.equal(nodes.length, 1);
    for (const fault of [null, 'delivery', 'terminal', 'terminal_save']) await t.test(fault ?? 'delivered', async () => {
        let now = 1000; const originalError = Error('TASK4_CHILD_UNKNOWN'), raw = { stdout: 'original runner prefix', stderr: 'original runner diagnostic' };
        const ready = JSON.parse(GOLDEN_READY), events: string[] = [], original = { wait: async (n: number) => { assert.equal(n, 1199993); events.push('exit_close'); if (fault?.startsWith('terminal')) throw originalError; return { code: 0, signal: null, exitObserved: true, closeObserved: true }; }, originals: () => raw };
        const state: any = { setup: ready.setup, root: { value: ready.setup.resourceRoot }, adminUrl: 'private' }; let argv: string[] = [];
        const context = { node: '/fixed/node', nodeHash: 'a'.repeat(64), owner: ready.setup.owner, launch: { setfarm: ready.setup.setfarm.source }, check() {}, modules: { native: { observeUiProcessV1: async () => ({ pid: 41004 }) } } };
        const bindings: any = { Date: { now: () => now }, path, Buffer, task4CanonicalV1: m.task4CanonicalV1, hash,
            spawn: (exe: string, args: string[], options: any) => { now += 7; assert.equal(exe, '/fixed/node'); argv = args; assert.equal(options.env.SETFARM_TEST_PG_ADMIN_URL, 'private'); assert.ok(!Object.hasOwn(options.env, 'NODE_OPTIONS')); assert.deepEqual(options.stdio, ['ignore', 'pipe', 'pipe', 'ignore', 'pipe']); return { pid: 41004, stdio: [null, null, null, null, {}] }; },
            retainTask4ChildV1: () => original, bindTask4ProcessV1: (v: any, expected: any) => { assert.equal(expected.rawArgs, ['/fixed/node', ...argv].join(' ')); return v; },
            task4WriteOriginalV1: async () => { events.push('fd4'); if (fault === 'delivery') throw Error('delivery'); }, task4SaveOriginalV1: (_c: any, role: string, bytes: any) => { assert.equal(role, 'runner'); assert.equal(bytes, raw); events.push('saved'); if (fault === 'terminal_save') throw Error('publication'); }, requireValue: (v: any, c: string) => { if (!v) throw Error(c); } };
        const fn = vm.compileFunction(nodes[0].getText(ast) + '\nreturn startTask4RunnerV1;', Object.keys(bindings))(...Object.values(bindings));
        if (fault === 'delivery') await assert.rejects(fn(context, state)); else await fn(context, state);
        assert.ok(state.runner);
        if (fault?.startsWith('terminal')) {
            await assert.rejects(state.runner.wait(), (error: any) => error === originalError);
            assert.equal(state.runner.completed(), true); assert.equal(state.runner.exit(), null); assert.ok(events.includes('saved')); return;
        }
        assert.equal(state.runner.preparationDeadline, 601000); assert.equal(state.runner.attemptDeadline, 1201000); now = 900000; await state.runner.wait(); await state.runner.wait(); assert.equal(events.filter(v => v === 'exit_close').length, 1); assert.deepEqual(argv.slice(-6), ['node', '--import', 'tsx', '--test', '--test-concurrency=1', 'tests/fixtures/mission-control-render-smoke-owned-v1.ts']);
        assert.equal(state.runner.deliveryFinished(), fault === null); assert.equal(state.runner.exit().closeObserved, true); assert.ok(events.includes('saved'));
    });
});

test('Task4 original fd writer ends once and requires finish rather than close-only publication', async () => {
    const ts = await import('typescript'), vm = await import('node:vm'), { EventEmitter } = await import('node:events');
    const text = readFileSync(new URL('../scripts/render-smoke-owned-fixture.mjs', import.meta.url), 'utf8'), ast = ts.createSourceFile('fixture.mjs', text, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
    const nodes = ast.statements.filter(n => ts.isFunctionDeclaration(n) && n.name?.text === 'task4WriteOriginalV1'); assert.equal(nodes.length, 1);
    const bindings = { setTimeout, clearTimeout, requireValue: (v: any, c: string) => { if (!v) throw Error(c); } };
    const fn = vm.compileFunction(nodes[0].getText(ast) + '\nreturn task4WriteOriginalV1;', Object.keys(bindings))(...Object.values(bindings));
    for (const event of ['finish', 'close', 'error']) { const stream: any = new EventEmitter(); let ends = 0;
        stream.end = (b: Buffer) => { ends++; assert.equal(b.toString(), 'fixed\n'); queueMicrotask(() => stream.emit(event, event === 'error' ? Error('private') : undefined)); };
        const result = fn(stream, Buffer.from('fixed\n')); if (event === 'finish') await result; else await assert.rejects(result); assert.equal(ends, 1); }
});

test('Task4 outer probe authenticates request ancestry, fixed policy and referenced original listener before canary effects', async (t) => {
    const ts = await import('typescript'), vm = await import('node:vm'), path = await import('node:path'), m = await load();
    const text = readFileSync(new URL('../scripts/render-smoke-owned-fixture.mjs', import.meta.url), 'utf8'), ast = ts.createSourceFile('fixture.mjs', text, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
    const nodes = ast.statements.filter(n => ts.isFunctionDeclaration(n) && n.name?.text === 'authenticateTask4ProbeRequestV1'); assert.equal(nodes.length, 1);
    const ready = JSON.parse(GOLDEN_READY), common = { executionId: ready.executionId, setupDescriptorHash: ready.setupDescriptorHash, readyDescriptorHash: hash(GOLDEN_READY + '\n') };
    for (const fault of [null, 'parent', 'policy', 'listener', 'intent']) await t.test(fault ?? 'bound', async () => {
        const inner = { ...ready.fixtureOwner, pid: 41006, ppid: 41005 }, runner = { ...ready.fixtureOwner, pid: 41004 }, fixture = { ...ready.fixtureOwner, pid: 41005, ppid: fault === 'parent' ? 999 : 41004 };
        const policy = m.task4ServerPolicyV1(ready.setup, 15433), launcherHash = '8290e4be7387a0df83cd1559e86afd880464f269450573d012795761fe298f16';
        const request = { schema: 'mission-control.task4-policy-probe-request.v1', ...common, innerOwner: inner, mockListener: { sha256: 'a'.repeat(64), bytes: 1 }, serverIntent: { sha256: 'b'.repeat(64), bytes: 1 }, policyHash: hash(policy), launcherHash };
        const listener = { schema: 'mission-control.task4-listener.v1', ...common, endpointRole: 'mock', host: '127.0.0.1', port: 15433, at: '2026-10-19T09:00:02.000Z', state: 'listening', owner: fault === 'listener' ? runner : inner, original: { method: 'owned_http_server', observed: true } };
        const intent = { schema: 'mission-control.task4-server-intent.v1', ...common, parentOwner: inner, executable: ready.setup.owner.executable, executableHash: ready.setup.owner.executableHash,
            entry: '/fixture/mc/dist-server/index.js', entryHash: fault === 'intent' ? '0'.repeat(64) : 'e'.repeat(64), argvHash: hash(m.task4CanonicalV1(['/fixture/mc/dist-server/index.js'])), environmentHash: 'f'.repeat(64), policyHash: request.policyHash, launcherHash };
        const bindings = { path, Buffer, hash, task4CanonicalV1: m.task4CanonicalV1, task4ServerPolicyV1: m.task4ServerPolicyV1,
            keys: (v: any, e: string) => assert.deepEqual(Object.keys(v).sort(), e.split(' ').sort()), hex: (v: any) => assert.match(v, /^[a-f0-9]{64}$/), processPin: () => {}, date: () => {},
            bindTask4ProcessV1: (v: any) => v, readTask4ArtifactV1: (_r: any, _a: any, ref: any) => ref.sha256 === 'a'.repeat(64) ? listener : intent,
            task4FileSnapshotV1: (p: string) => p.endsWith('.sb') ? { bytes: Buffer.from(fault === 'policy' ? 'drift' : policy), hash: hash(fault === 'policy' ? 'drift' : policy) } : { hash: p.endsWith('sandbox-exec') ? launcherHash : 'e'.repeat(64) },
            requireValue: (v: any, c: string) => { if (!v) throw Error(c); } };
        const fn = vm.compileFunction(nodes[0].getText(ast) + '\nreturn authenticateTask4ProbeRequestV1;', Object.keys(bindings))(...Object.values(bindings));
        const context = { root: '/fixture/mc', node: ready.setup.owner.executable, nodeHash: ready.setup.owner.executableHash, owner: ready.setup.owner, check() {}, modules: { native: { observeUiProcessV1: async (pid: number) => pid === inner.pid ? inner : fixture } } };
        const state = { setup: ready.setup, root: {}, runner: { owner: runner } };
        if (fault) await assert.rejects(fn(context, state, request)); else { const value = await fn(context, state, request); assert.equal(value.mock.port, 15433); assert.deepEqual(value.binding, common); }
    });
});

test('Task4 original probe remains fd3 latched until observed owner and preserves failed original completion without signals', async (t) => {
    const ts = await import('typescript'), vm = await import('node:vm'), path = await import('node:path'), m = await load();
    const text = readFileSync(new URL('../scripts/render-smoke-owned-fixture.mjs', import.meta.url), 'utf8'), ast = ts.createSourceFile('fixture.mjs', text, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
    const nodes = ast.statements.filter(n => ts.isFunctionDeclaration(n) && n.name?.text === 'executeTask4ProbeV1'); assert.equal(nodes.length, 1);
    for (const fault of [null, 'owner', 'output', 'close']) await t.test(fault ?? 'complete', async () => {
        const events: string[] = [], ready = JSON.parse(GOLDEN_READY), owner = { ...ready.setup.owner, pid: 41009, ppid: ready.setup.owner.pid };
        const allowed = { startedAt: '2026-10-19T09:00:02.000Z', finishedAt: '2026-10-19T09:00:02.010Z', outcome: 'connected', errno: null }, denied = { ...allowed, startedAt: '2026-10-19T09:00:02.011Z', finishedAt: '2026-10-19T09:00:02.020Z', outcome: 'denied', errno: fault === 'output' ? 'ECONNREFUSED' : 'EPERM' };
        const stdout = JSON.stringify({ schema: 'mission-control.task4-policy-probe-output.v1', allowed, denied }) + '\n';
        const bindings = { path, hash, TASK4_POLICY_PROBE_PROGRAM: 'fixed-program',
            spawn: (exe: string, args: string[], options: any) => { events.push('spawn'); assert.equal(exe, '/usr/bin/sandbox-exec'); assert.equal(args.at(-2), '15433'); assert.equal(args.at(-1), '15434'); assert.deepEqual(options.stdio, ['ignore', 'pipe', 'pipe', 'pipe']); return { pid: owner.pid, stdio: [null, null, null, {}] }; },
            retainTask4ChildV1: () => ({ wait: async () => { events.push('exit_close'); if (fault === 'close') throw Error('close'); return { code: 0, signal: null, exitObserved: true, closeObserved: true }; }, originals: () => ({ stdout, stderr: '', stdoutHash: hash(stdout), stderrHash: hash('') }) }),
            bindTask4ProcessV1: () => { events.push('observed'); if (fault === 'owner') throw Error('owner'); return owner; },
            task4WriteOriginalV1: async (_s: any, bytes: Buffer) => { assert.equal(bytes.toString(), 'task4-probe-start\n'); events.push('latch'); }, task4SaveOriginalV1: () => events.push('saved'),
            keys: (v: any, e: string) => assert.deepEqual(Object.keys(v).sort(), e.split(' ').sort()), date: () => {}, requireValue: (v: any, c: string) => { if (!v) throw Error(c); } };
        const fn = vm.compileFunction(nodes[0].getText(ast) + '\nreturn executeTask4ProbeV1;', Object.keys(bindings))(...Object.values(bindings));
        const state: any = { root: { value: ready.setup.resourceRoot }, canary: { port: 15434 } }, context = { node: '/fixed/node', nodeHash: 'a'.repeat(64), owner: ready.setup.owner, check() {}, modules: { native: { observeUiProcessV1: async () => ({}) } } };
        if (fault) await assert.rejects(fn(context, state, { mock: { port: 15433 } })); else { const value = await fn(context, state, { mock: { port: 15433 } }); assert.equal(value.denied.errno, 'EPERM'); assert.ok(events.indexOf('observed') < events.indexOf('latch')); }
        assert.ok(state.probeOriginal); assert.ok(events.includes('exit_close')); if (fault === 'owner') assert.ok(!events.includes('latch'));
    });
});

test('Task4 outer probe publishes immutable original before mock receipt and refuses dirty mock closure without final authority', async (t) => {
    const ts = await import('typescript'), vm = await import('node:vm'), m = await load();
    const text = readFileSync(new URL('../scripts/render-smoke-owned-fixture.mjs', import.meta.url), 'utf8'), ast = ts.createSourceFile('fixture.mjs', text, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
    const nodes = ast.statements.filter(n => ts.isFunctionDeclaration(n) && n.name?.text === 'runTask4OuterProbeV1'); assert.equal(nodes.length, 1);
    for (const fault of [null, 'mock', 'probe']) await t.test(fault ?? 'complete', async () => {
        const ready = JSON.parse(GOLDEN_READY), events: string[] = [], records = new Map<string, any>(), binding = { executionId: ready.executionId, setupDescriptorHash: ready.setupDescriptorHash, readyDescriptorHash: hash(GOLDEN_READY + '\n') },
            inner = { ...ready.fixtureOwner, pid: 41006 }, mock: any = { ...binding, schema: 'mission-control.task4-listener.v1', endpointRole: 'mock', host: '127.0.0.1', port: 15433, at: '2026-10-19T09:00:00.000Z', state: 'listening', owner: inner, original: { method: 'owned_http_server', observed: true } };
        const ref = (v: any) => { const b = m.task4CanonicalV1(v) + '\n', r = { sha256: hash(b), bytes: Buffer.byteLength(b) }; records.set(r.sha256, v); return r; }, before = ref(mock), after = ref({ ...mock, at: '2026-10-19T09:00:03.000Z' });
        const allowed = { startedAt: '2026-10-19T09:00:01.000Z', finishedAt: '2026-10-19T09:00:01.100Z', outcome: 'connected', errno: null }, denied = { ...allowed, outcome: 'denied', errno: 'EPERM' };
        let closed = false, snapshots = 0; const state: any = { root: {}, setup: ready.setup }, request = { ...binding, policyHash: 'a'.repeat(64), launcherHash: 'b'.repeat(64), mockListener: before };
        const bindings: any = { Date: class extends Date { static now() { return Date.parse('2026-10-19T09:00:02.000Z'); } }, hash, task4CanonicalV1: m.task4CanonicalV1,
            waitTask4PreparationV1: async () => { events.push('policy-probe-request.json'); return { value: request }; },
            waitTask4FixedV1: async (_c: any, _r: any, name: string, deadline: number) => { assert.equal(deadline, Date.parse(mock.at) + 30000); events.push(name); return { value: name === 'policy-probe-request.json' ? request : { schema: 'mission-control.task4-policy-probe-mock.v1', ...binding, owner: inner, before, after, acceptedConnections: 1, sockets: { opened: 1, closed: fault === 'mock' ? 0 : 1, active: fault === 'mock' ? 1 : 0 } } }; },
            authenticateTask4ProbeRequestV1: async () => ({ request, binding, inner, mock }),
            createTask4PortGuardV1: async (_c: any, s: any) => { s.canary = { port: 15434, snapshot: () => ({ at: closed ? '2026-10-19T09:00:03.000Z' : snapshots++ === 0 ? '2026-10-19T09:00:00.000Z' : '2026-10-19T09:00:02.000Z', state: closed ? 'absent' : 'listening', acceptedConnections: 0 }), close: async () => { closed = true; }, closed: () => closed }; return s.canary; },
            executeTask4ProbeV1: async () => { if (fault === 'probe') throw Error('probe'); return { owner: inner, exit: { code: 0, signal: null, exitObserved: true, closeObserved: true }, allowed, denied, stdout: '', stderr: '', stdoutHash: hash(''), stderrHash: hash('') }; },
            task4OuterArtifactV1: (_s: any, v: any) => ref(v), publishTask4FixedV1: (_r: any, name: string, v: any) => { events.push(name); return ref(v); },
            readTask4ArtifactV1: (_r: any, _a: any, r: any) => records.get(r.sha256),
            keys: (v: any, e: string) => assert.deepEqual(Object.keys(v).sort(), e.split(' ').sort()), date: () => {}, requireValue: (v: any, c: string) => { if (!v) throw Error(c); } };
        const fn = vm.compileFunction(nodes[0].getText(ast) + '\nreturn runTask4OuterProbeV1;', Object.keys(bindings))(...Object.values(bindings));
        if (fault) { await assert.rejects(fn({ owner: ready.setup.owner, check() {} }, state)); assert.ok(!events.includes('policy-probe.json')); } else { await fn({ owner: ready.setup.owner, check() {} }, state); assert.ok(events.indexOf('policy-probe-original.json') < events.indexOf('policy-probe-mock.json')); assert.ok(state.probe); }
        assert.equal(closed, true);
    });
});

test('Task4 outer artifacts are bounded immutable canonical files and same-hash drift is refused', async () => {
    const ts = await import('typescript'), vm = await import('node:vm'), fs = await import('node:fs'), path = await import('node:path'), os = await import('node:os'), m = await load();
    const text = readFileSync(new URL('../scripts/render-smoke-owned-fixture.mjs', import.meta.url), 'utf8'), ast = ts.createSourceFile('fixture.mjs', text, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
    const names = ['task4OuterArtifactV1', 'task4PrivateBytesV1'], nodes = ast.statements.filter(n => ts.isFunctionDeclaration(n) && names.includes(n.name?.text ?? '')); assert.equal(nodes.length, 2);
    const root = fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), 'task4-outer-artifact-component-')); fs.chmodSync(root, 0o700); fs.mkdirSync(path.join(root, 'outer'), { mode: 0o700 }); fs.mkdirSync(path.join(root, 'outer/artifacts'), { mode: 0o700 });
    const bindings = { fs, path, hash, task4CanonicalV1: m.task4CanonicalV1, captureTask4DirectoryV1: m.captureTask4DirectoryV1, captureTask4FileV1: m.captureTask4FileV1,
        requireValue: (v: any, c: string) => { if (!v) throw Error(c); } };
    const fn = vm.compileFunction(nodes.map(n => n.getText(ast)).join('\n') + '\nreturn task4OuterArtifactV1;', Object.keys(bindings))(...Object.values(bindings));
    const pin = m.captureTask4DirectoryV1(root, true), state = { root: pin };
    try { const r = fn(state, { fixed: true }); assert.deepEqual(fn(state, { fixed: true }), r); const file = path.join(root, 'outer/artifacts', r.sha256 + '.json');
        assert.equal(fs.statSync(file).mode & 0o777, 0o600); assert.equal(fs.readFileSync(file, 'utf8'), '{"fixed":true}\n');
        fs.writeFileSync(file, '{}\n'); assert.throws(() => fn(state, { fixed: true }));
    } finally { pin.close(); fs.rmSync(root, { recursive: true, force: true }); }
});

test('Task4 paired settlement binds exact original exits, result links and full cleanup counts before PG stop', async (t) => {
    const ts = await import('typescript'), vm = await import('node:vm'), m = await load();
    const text = readFileSync(new URL('../scripts/render-smoke-owned-fixture.mjs', import.meta.url), 'utf8'), ast = ts.createSourceFile('fixture.mjs', text, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
    const nodes = ast.statements.filter(n => ts.isFunctionDeclaration(n) && n.name?.text === 'readTask4PairedResultsV1'); assert.equal(nodes.length, 1);
    for (const fault of [null, 'exit', 'parent', 'pending', 'hash', 'database']) await t.test(fault ?? 'closed', async () => {
        const ready = JSON.parse(GOLDEN_READY), ref = (s: string) => ({ sha256: s.repeat(64), bytes: 1 }), common = { executionId: ready.executionId, setupDescriptorHash: ready.setupDescriptorHash }, runnerOwner = { ...ready.fixtureOwner, pid: 41004 }, innerOwner = { ...ready.fixtureOwner, pid: 41006, ppid: ready.fixtureOwner.pid }, exit = { code: 0, signal: null, exitObserved: true, closeObserved: true };
        const parent: any = { schema: 'setfarm.task4-parent-result.v1', ...common, readyDescriptorHash: hash(GOLDEN_READY + '\n'), fixtureOwner: ready.fixtureOwner, outcome: 'pass', code: null, integrity: 'verified', projection: ready.projection, database: { name: ready.database.name, role: ready.database.role },
            inner: { owner: innerOwner, exit, result: ref('a') }, evidence: Object.fromEntries(['readinessBefore', 'readinessAfter', 'auditBefore', 'auditAfter', 'untouchedBefore', 'untouchedAfter', 'sqlLedger'].map(k => [k, ref('e')])), cleanup: { readers: { opened: 3, closed: 3, pending: fault === 'pending' ? 1 : 0 }, databaseAbsent: true, roleAbsent: true } };
        const runner: any = { schema: 'setfarm.task4-runner-result.v1', ...common, owner: runnerOwner, outcome: 'pass', code: null, children: [{ role: 'setup', owner: { ...ready.fixtureOwner, pid: 41003 }, exit, fd3: 'finished', fd4: 'not_applicable' }, { role: 'test', owner: ready.fixtureOwner, exit, fd3: 'finished', fd4: 'finished' }], parentResult: ref(fault === 'hash' ? 'f' : 'b'), projection: { root: ready.projection.root, projectedHead: ready.projection.projectedHead }, cleanup: { databasesAbsent: true, projectionAbsent: true } };
        if (fault === 'parent') parent.fixtureOwner = runnerOwner;
        const inner: any = { schema: 'mission-control.render-smoke-inner-result.v1', executionId: ready.executionId, binding: { setupDescriptorHash: ready.setupDescriptorHash, readyDescriptorHash: parent.readyDescriptorHash, resourceRoot: ready.setup.resourceRoot, missionControl: ready.setup.missionControl.source, setfarm: ready.setup.setfarm.source, projection: ready.projection, database: { ...parent.database, restrictedUrlHash: ready.database.restrictedUrlHash }, fixture: ready.fixture, fixtureOwner: ready.fixtureOwner }, owner: innerOwner, scenario: 'pass', startedAt: '2026-10-19T09:00:00.000Z', finishedAt: '2026-10-19T09:00:01.000Z', outcome: 'pass', code: null, integrity: 'verified', observations: { before: ref('c'), after: ref('d') }, render: ref('e'), cleanup: ref('f'), artifacts: {}, diagnostics: [] };
        const state: any = { root: {}, setup: ready.setup, runner: { owner: runnerOwner, deliveryFinished: () => true, exit: () => ({ ...exit, closeObserved: fault !== 'exit' }) }, probeRequest: { inner: innerOwner, fixture: ready.fixtureOwner, binding: { readyDescriptorHash: parent.readyDescriptorHash } } };
        const bindings = { task4CanonicalV1: m.task4CanonicalV1, hash, keys: (v: any, e: string) => assert.deepEqual(Object.keys(v).sort(), e.split(' ').sort()), processPin: () => {}, date: () => {}, hex: () => {},
            readTask4FixedV1: (_r: any, name: string) => name === 'runner-result.json' ? { value: runner, ref: ref('c') } : name === 'parent-result.json' ? { value: parent, ref: ref('b') } : { value: inner, ref: ref('a') },
            readTask4ArtifactV1: () => ({ actual: true }), verifyTask4InnerArtifactsV1: () => {}, task4ProveDatabaseAbsenceV1: async () => { if (fault === 'database') throw Error('retained'); return ref('d'); },
            requireValue: (v: any, c: string) => { if (!v) throw Error(c); } };
        const fn = vm.compileFunction(nodes[0].getText(ast) + '\nreturn readTask4PairedResultsV1;', Object.keys(bindings))(...Object.values(bindings));
        if (fault) await assert.rejects(fn({ scenario: 'pass', check() {} }, state)); else { const v = await fn({ scenario: 'pass', check() {} }, state); assert.equal(v.closed, true); assert.equal(v.outcome, 'pass'); }
    });
});

test('Task4 inner artifact readback requires exact complete inventory, bytes and cleanup identity without accepting hidden files', async (t) => {
    const ts = await import('typescript'), vm = await import('node:vm'), path = await import('node:path'), m = await load();
    const text = readFileSync(new URL('../scripts/render-smoke-owned-fixture.mjs', import.meta.url), 'utf8'), ast = ts.createSourceFile('fixture.mjs', text, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
    const nodes = ast.statements.filter(n => ts.isFunctionDeclaration(n) && n.name?.text === 'verifyTask4InnerArtifactsV1'); assert.equal(nodes.length, 1);
    for (const fault of [null, 'extra', 'bytes', 'pending', 'owner']) await t.test(fault ?? 'bound', () => {
        const ready = JSON.parse(GOLDEN_READY), owner = { ...ready.fixtureOwner, pid: 41006 }, uiOwner = { pid: owner.pid, processStartedAt: owner.startedAt, processGroupId: owner.pgid, source: 'observed_os', executable: owner.executable, script: '/fixture/mc/scripts/render-smoke.mjs', commandHash: owner.commandHash },
            binding = { executionId: ready.executionId, setupDescriptorHash: ready.setupDescriptorHash, readyDescriptorHash: hash(GOLDEN_READY + '\n') };
        const values: any[] = [{ schema: 'mission-control.render-smoke-inner-cleanup.v1', ...binding, ownerHash: hash(m.task4CanonicalV1(fault === 'owner' ? {} : uiOwner)), nativeAudit: { jobId: '12345678-1234-4234-8234-123456789012', intentHash: binding.readyDescriptorHash, owner: uiOwner, state: 'not_started', children: [] }, mock: { state: 'not_started' }, server: { state: 'not_started' }, readers: { opened: 0, closed: 0, pending: fault === 'pending' ? 1 : 0 }, contexts: { opened: 0, closed: 0, pending: 0 }, complete: true }, { schema: 'fixture-render', ...binding }];
        const files = new Map(values.map(v => { const bytes = Buffer.from(m.task4CanonicalV1(v) + '\n'); return [hash(bytes), { bytes, hash: hash(bytes), identity: { mode: '384' } }]; })), refs = [...files].map(([sha256, v]) => ({ sha256, bytes: v.bytes.length }));
        const inner: any = { executionId: ready.executionId, binding: { ...binding }, owner, outcome: 'fail', cleanup: refs[0], render: refs[1], observations: { before: refs[1], after: refs[1] }, artifacts: { json: [...refs].sort((a,b)=>a.sha256.localeCompare(b.sha256)), png: [], native: [], totalBytes: refs.reduce((n,r)=>n+r.bytes,0) } };
        const bindings = { path, Buffer, hash, task4CanonicalV1: m.task4CanonicalV1,
            fs: { readdirSync: (p: string) => p.endsWith('children') ? [] : [...files.keys()].map(h => h + '.json').concat(fault === 'extra' ? ['hidden.json'] : []) },
            task4FileSnapshotV1: (p: string) => { const v = files.get(path.basename(p).split('.')[0])!; return fault === 'bytes' ? { ...v, bytes: Buffer.from('{}\n') } : v; },
            keys: (v: any, e: string) => assert.deepEqual(Object.keys(v).sort(), e.split(' ').sort()), requireValue: (v: any, c: string) => { if (!v) throw Error(c); } };
        const fn = vm.compileFunction(nodes[0].getText(ast) + '\nreturn verifyTask4InnerArtifactsV1;', Object.keys(bindings))(...Object.values(bindings));
        const context = { root: '/fixture/mc', check() {}, modules: { protocol: { UiWorkerLifecycleRecordV1Schema: { parse() { throw Error('unexpected'); } } } } };
        const call = () => fn(context, { root: { value: ready.setup.resourceRoot } }, inner);
        if (fault) assert.throws(call); else call();
    });
});

test('Task4 outer absence proof binds exact clone prefix and role, closes admin client and refuses retained projection or readers', async (t) => {
    const ts = await import('typescript'), vm = await import('node:vm'), path = await import('node:path');
    const text = readFileSync(new URL('../scripts/render-smoke-owned-fixture.mjs', import.meta.url), 'utf8'), ast = ts.createSourceFile('fixture.mjs', text, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
    const nodes = ast.statements.filter(n => ts.isFunctionDeclaration(n) && n.name?.text === 'task4ProveDatabaseAbsenceV1'); assert.equal(nodes.length, 1);
    for (const fault of [null, 'projection', 'databases', 'readers', 'identity', 'client']) await t.test(fault ?? 'absent', async () => {
        const ready = JSON.parse(GOLDEN_READY), events: string[] = [], parent = { projection: ready.projection, database: { name: ready.database.name, role: ready.database.role } };
        const rows: any[] = [{ database: 'postgres', data_directory: ready.setup.postgres.data.path, port: ready.setup.postgres.port, version: 170010, started_at: ready.setup.postgres.serverStartedAt, databases: fault === 'databases' ? 1 : 0, roles: 0, sessions: fault === 'readers' ? 1 : 0 }]; if (fault === 'identity') rows[0].port++;
        const bindings = { path, fs: { lstatSync: () => { if (fault === 'projection') return {}; throw Object.assign(Error('missing'), { code: 'ENOENT' }); } },
            task4PostgresV1: async () => () => ({ unsafe: async (_q: string, params: string[]) => { events.push('sql'); assert.deepEqual(params, [ready.projection.runDatabasePrefix, ready.database.role]); return rows; }, end: async () => { events.push('end'); if (fault === 'client') throw Error('client'); } }),
            task4BoundedV1: (p: any) => p, task4OuterArtifactV1: (_s: any, v: any) => { events.push('artifact'); assert.equal(v.databasesAbsent, true); return { sha256: 'a'.repeat(64), bytes: 1 }; },
            requireValue: (v: any, c: string) => { if (!v) throw Error(c); } };
        const fn = vm.compileFunction(nodes[0].getText(ast) + '\nreturn task4ProveDatabaseAbsenceV1;', Object.keys(bindings))(...Object.values(bindings));
        const state = { setup: ready.setup, executionId: ready.executionId, adminUrl: 'private' };
        if (fault) { await assert.rejects(fn({ check() {} }, state, parent)); assert.ok(!events.includes('artifact')); } else { await fn({ check() {} }, state, parent); assert.deepEqual(events, ['sql', 'end', 'artifact']); }
    });
});

test('Task4 outer final receipt cannot promote unknown cleanup or integrity and never exposes private URLs', async (t) => {
    const ts = await import('typescript'), vm = await import('node:vm'), m = await load();
    const text = readFileSync(new URL('../scripts/render-smoke-owned-fixture.mjs', import.meta.url), 'utf8'), ast = ts.createSourceFile('fixture.mjs', text, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
    const nodes = ast.statements.filter(n => ts.isFunctionDeclaration(n) && n.name?.text === 'finalizeTask4OuterV1'); assert.equal(nodes.length, 1);
    for (const fault of [null, 'cleanup', 'integrity', 'publication']) await t.test(fault ?? 'pass', async () => {
        const ready = JSON.parse(GOLDEN_READY), lines: string[] = [], artifacts: any[] = []; let pinned = true, published: any, status: any = {};
        const exit = { code: 0, signal: null, exitObserved: true, closeObserved: true };
        const state: any = { executionId: ready.executionId, root: { value: ready.setup.resourceRoot, check() {}, close() { pinned = false; } }, startedAt: '2026-10-19T09:00:00.000Z',
            errors: [], integrity: fault === 'integrity' ? 'failed' : 'verified', cleanupUnknown: false, setupRef: { sha256: 'a'.repeat(64), bytes: 1 }, adminUrl: 'never-output-secret',
            paired: { closed: true, outcome: 'pass', code: null }, initdb: { exit }, postgres: { owner: ready.setup.postgres.process, settlement: () => fault === 'cleanup' ? null : { exit, cohort: [] } },
            runner: { owner: ready.fixtureOwner, exit: () => exit, deliveryFinished: () => true }, probeOriginal: { owner: ready.fixtureOwner, exit },
            probe: { sha256: 'b'.repeat(64), bytes: 1 }, adminClosed: true, canary: { closed: () => true }, portReservation: { closed: () => true } };
        const bindings = { Buffer, hash, task4CanonicalV1: m.task4CanonicalV1, process: { stdout: { write: (s: string) => lines.push(s) }, set exitCode(v: number) { status.code = v; } },
            task4RecordFailureV1: (s: any, e: any) => { s.errors.push(e.message); s.cleanupUnknown = true; },
            task4OuterArtifactV1: (_s: any, v: any) => { artifacts.push(v); return { sha256: 'c'.repeat(64), bytes: 1 }; },
            task4PrivateBytesV1: (_r: any, name: string, b: Buffer) => { assert.equal(name, 'outer-result.json'); published = JSON.parse(b.toString()); if (fault === 'publication') throw Error('TASK4_RESULT_PUBLICATION_FAILED'); return { sha256: hash(b), bytes: b.length }; },
            requireValue: (v: any, c: string) => { if (!v) throw Error(c); } };
        const fn = vm.compileFunction(nodes[0].getText(ast) + '\nreturn finalizeTask4OuterV1;', Object.keys(bindings))(...Object.values(bindings));
        const context = { launch: { setfarm: ready.setup.setfarm.source, missionControl: ready.setup.missionControl.source }, owner: ready.setup.owner, scenario: 'pass', check() {} };
        if (fault === 'publication') await assert.rejects(fn(context, state)); else await fn(context, state);
        assert.equal(pinned, false); assert.equal(lines.length, 1); assert.ok(!lines[0].includes('secret')); assert.ok(!JSON.stringify(published).includes('secret'));
        const receipt = JSON.parse(lines[0]); assert.equal(receipt.outcome, fault ? 'unknown' : 'pass'); assert.equal(status.code, fault ? 2 : 0);
        if (fault === 'publication') assert.equal(receipt.result, null);
    });
});


test('Task4 installed-kind capture preserves strict real private ancestry and refuses mode alias and byte drift', async (t) => {
    const m = await load(), fs = await import('node:fs'), os = await import('node:os'), path = await import('node:path');
    for (const fault of ['private', 'writable_ancestor', 'writable_leaf', 'ancestor_drift', 'ancestor_alias', 'leaf_alias', 'hardlink', 'replacement', 'bytes']) await t.test(fault, () => {
        const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'mc-task4-installed-kind-')));
        const parent = path.join(root, 'Cellar'), file = path.join(parent, 'node'); let pin: any;
        try {
            fs.mkdirSync(parent, { mode: 0o700 }); fs.writeFileSync(file, 'owned component bytes', { mode: 0o555 });
            if (fault === 'writable_ancestor' || fault === 'writable_leaf') {
                fs.chmodSync(fault === 'writable_ancestor' ? parent : file, 0o775);
                assert.throws(() => m.captureTask4FileV1(file, 1024, 'installed'), /TASK4_SOURCE_DRIFT/); return;
            }
            if (fault === 'ancestor_alias' || fault === 'leaf_alias') {
                const alias = path.join(root, 'alias'); fs.symlinkSync(fault === 'ancestor_alias' ? parent : file, alias);
                assert.throws(() => m.captureTask4FileV1(fault === 'ancestor_alias' ? path.join(alias, 'node') : alias, 1024, 'installed'), /TASK4_SOURCE_DRIFT/); return;
            }
            if (fault === 'hardlink') {
                fs.linkSync(file, path.join(root, 'hardlink'));
                assert.throws(() => m.captureTask4FileV1(file, 1024, 'installed'), /TASK4_SOURCE_DRIFT/); return;
            }
            pin = m.captureTask4FileV1(file, 1024, 'installed');
            assert.equal(pin.hash, hash('owned component bytes')); assert.equal(pin.bytes.toString(), 'owned component bytes'); pin.check();
            if (fault === 'ancestor_drift') fs.chmodSync(parent, 0o775);
            if (fault === 'replacement') { fs.renameSync(file, path.join(parent, 'original')); fs.writeFileSync(file, 'owned component bytes', { mode: 0o555 }); }
            if (fault === 'bytes') { fs.chmodSync(file, 0o755); fs.writeFileSync(file, 'changed component raw'); fs.chmodSync(file, 0o555); }
            if (fault !== 'private') assert.throws(() => pin.check(), /TASK4_SOURCE_DRIFT/);
        } finally { pin?.close(); fs.rmSync(root, { recursive: true, force: true }); }
    });
});


test('Task4 cold observer uses installed default startup before reserve; simulated ReadyForQuery only', async () => {
    const ts = await import('typescript'), vm = await import('node:vm'), postgres = (await import('postgres')).default;
    const text = readFileSync(new URL('../scripts/render-smoke-owned-fixture.mjs', import.meta.url), 'utf8');
    const ast = ts.createSourceFile('owned.mjs', text, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
    const nodes = ast.statements.filter(n => ts.isFunctionDeclaration(n) && n.name?.text === 'openTask4ObserverV1'); assert.equal(nodes.length, 1);
    const driverText = readFileSync(new URL('../node_modules/postgres/src/connection.js', import.meta.url), 'utf8');
    const driverAst = ts.createSourceFile('connection.js', driverText, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS), found: import('typescript').FunctionDeclaration[] = [];
    const visit = (n: import('typescript').Node) => { if (ts.isFunctionDeclaration(n) && n.name?.text === 'ReadyForQuery') found.push(n); ts.forEachChild(n, visit); }; visit(driverAst); assert.equal(found.length, 1);
    const ready = JSON.parse(GOLDEN_READY), events: string[] = []; let pool: ReturnType<typeof postgres> | undefined;
    const state: any = { readers: { opened: 0, closed: 0, pending: 0 }, filesystem: { operation: (op: string) => events.push(op) } };
    const reserved = { release() { events.push('release'); } };
    const bindings = { task4PostgresV1: async () => (url: string, options: any) => {
        // The installed constructor resolves options only. No real reserve/query/socket is invoked.
        pool = postgres(url, options); const needsTypes = pool.options.fetch_types;
        return { reserve() { events.push('reserve'); return new Promise(resolve => {
            const factory = vm.compileFunction(`let query=null,results=null,errorResponse=null,result=null,initial={reserve:true},retries=0;
                const Result=class{},connectTimer={cancel(){}},target_session_attrs=null,backendParameters={},options={shared:{}},sent=[],connection={reserved:null},ending=false;
                let fetched=false; const fetchArrayTypes=()=>{fetched=true;},onopen=()=>resolve(reserved);
                ${found[0].getText(driverAst)}
                ReadyForQuery(Buffer.alloc(6)); if(fetched){events.push('driver_startup');ReadyForQuery(Buffer.alloc(6));}`,
                ['needsTypes','resolve','reserved','events','Buffer']);
            factory(needsTypes, resolve, reserved, events, Buffer);
        }); }, async end() { events.push('end'); await pool!.end(); } };
    }, task4BoundedV1: (promise: any, ms: number, code: string) => {
        assert.equal(ms, 8000); if (code === 'TASK4_CLEANUP_UNKNOWN') return promise;
        return Promise.race([promise, new Promise((_r, reject) => queueMicrotask(() => reject(Error(code))))]);
    }, createTask4ObserverV1: (_r: any, connection: any) => { assert.equal(connection, reserved); events.push('observer'); return {}; }, requireValue: (v: any, code: string) => { if (!v) throw Error(code); } };
    const open = vm.compileFunction(nodes[0].getText(ast) + '\nreturn openTask4ObserverV1;', Object.keys(bindings))(...Object.values(bindings));
    try { await open({ ready, check() {} }, state); assert.deepEqual(events, ['create','reserve','driver_startup','observer']); }
    finally { if (state.sql) await state.sql.close(); else await pool?.end(); }
    assert.deepEqual(state.readers, { opened: 1, closed: 1, pending: 0 });
});

test('Task4 preparation uses one original runner deadline and refuses early close late files and expiry', async (t) => {
    const ts = await import('typescript'), vm = await import('node:vm');
    const text = readFileSync(new URL('../scripts/render-smoke-owned-fixture.mjs', import.meta.url), 'utf8'), ast = ts.createSourceFile('owned.mjs', text, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
    const nodes = ast.statements.filter(n => ts.isFunctionDeclaration(n) && n.name?.text === 'waitTask4PreparationV1'); assert.equal(nodes.length, 1);
    for (const mode of ['ready','early_close','early_error','expiry','late_read','close_on_read','context_expiry','nonreset']) await t.test(mode, async () => {
        let now = 599990, reads = 0, waits = 0, originalWaits = 0, done = mode.startsWith('early');
        const originalError = Error('TASK4_CHILD_UNKNOWN'), request = { value: { fixed: true } };
        const state = { root: {}, runner: { preparationDeadline: 600000, completed: () => done,
            wait: async () => { originalWaits++; if (mode === 'early_error') throw originalError; return { code: 1, signal: null, exitObserved: true, closeObserved: true }; } } };
        if (mode === 'expiry') now = 600000;
        const bindings = { Date: { now: () => now }, readTask4FixedV1: (_r: any, name: string, live: boolean) => {
            assert.equal(name, 'policy-probe-request.json'); assert.equal(live, true); reads++;
            if (mode === 'late_read') now = 600000; if (mode === 'close_on_read') done = true;
            return mode === 'nonreset' ? null : request;
        }, task4WaitV1: async (ms: number) => { waits++; assert.ok(ms > 0 && ms <= 25); now += ms; }, requireValue: (v: any, c: string) => { if (!v) throw Error(c); }, fail: (c: string) => { throw Error(c); } };
        const fn = vm.compileFunction(nodes[0].getText(ast) + '\nreturn waitTask4PreparationV1;', Object.keys(bindings))(...Object.values(bindings));
        const action = fn({ check() { if (mode === 'context_expiry') now = 600000; } }, state);
        if (mode === 'ready') assert.equal(await action, request);
        else if (mode === 'early_error') await assert.rejects(action, e => e === originalError);
        else await assert.rejects(action, /TASK4_PREPARATION_TIMEOUT|TASK4_RUNNER_CLOSED_BEFORE_REQUEST/);
        if (mode.startsWith('early')) { assert.equal(reads, 0); assert.equal(originalWaits, 1); }
        if (mode === 'expiry' || mode === 'context_expiry') assert.equal(reads, 0);
        if (mode === 'nonreset') { assert.equal(waits, 1); assert.equal(reads, 1); assert.equal(now, 600000); }
        if (mode === 'close_on_read') assert.equal(originalWaits, 1);
    });
});

test('Task4 original child permits fixed whole-runner cap but still refuses overflow and requires exit AND close', async () => {
    const m = await load(), { EventEmitter } = await import('node:events');
    const child: any = new EventEmitter(); child.stdout = new EventEmitter(); child.stderr = new EventEmitter();
    const original = m.retainTask4ChildV1(child); assert.throws(() => original.wait(1200001), /TASK4_CHILD_UNKNOWN/);
    let settled = false; const pending = original.wait(1200000).then(value => { settled = true; return value; });
    child.emit('exit', 1, null); await Promise.resolve(); assert.equal(settled, false);
    child.emit('close', 1, null); assert.deepEqual(await pending, { code: 1, signal: null, exitObserved: true, closeObserved: true });
});
