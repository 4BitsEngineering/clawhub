# Graph Report - .  (2026-07-27)

## Corpus Check
- Large corpus: 169 files · ~1,437,069 words. Semantic extraction will be expensive (many Claude tokens). Consider running on a subfolder.

## Summary
- 759 nodes · 1572 edges · 84 communities (53 shown, 31 thin omitted)
- Extraction: 95% EXTRACTED · 5% INFERRED · 0% AMBIGUOUS · INFERRED: 86 edges (avg confidence: 0.85)
- Token cost: 605,637 input · 0 output

## Community Hubs (Navigation)
- Firm Dashboard Pages
- API Routes & Cron Jobs
- Headless Agent Client
- Framework Dependencies
- Package Dev Dependencies
- Shared UI Components
- TypeScript Build Config
- Product Docs & Specs
- Operator Team Pages
- Component Aliases Config
- Demo Pack Script
- Prisma Client Scripts
- Installer & Stack API
- Initial DB Migration
- Agent Catalog Seeder
- Baseline Diff Logic
- Mock Bridge Server
- CI Release Workflows
- Mock Instance Script
- App Layout & Theme
- Activity Timeline UI
- Release Bundle Script
- Community Portrait
- Legal-Light Portrait
- Personal Assistant Portrait
- SEO Writer Portrait
- Baseline MemorySearch Fixer
- Pin Firm Stack Script
- Release Installer Script
- NextAuth Authentication
- Prisma Seed
- Analytics CRO Portrait
- Automation Engineer Portrait
- Content Strategist Portrait
- CRM Email Portrait
- Executive Portrait
- Marketing Strategist Portrait
- Outbound SDR Portrait
- Paid Media Portrait
- Video Director Portrait
- Visual Director Portrait
- MCP Catalog Seeder
- E2E Test Script
- Agents API Route
- Office Templates API
- Firm Baseline Migration
- Stack Bundle Migration
- MCP Catalog Migration
- Agent Catalog Migration
- Community Engagement Portrait
- Copywriter Portrait
- SEO Strategist Portrait
- File Icon Asset
- Globe Icon Asset
- Vercel Logo Asset
- Window Icon Asset
- Skills Seeder
- Privacy Page
- Terms Page
- Operator Navigation
- Vercel Cron Config
- ESLint Config
- Next.js Config
- PostCSS Config
- Skills Migration
- Instance Command Migration
- Usage Record Migration
- Running Versions Migration
- Activity Log Migration
- Invitations Migration
- Baseline Promotion Migration
- Repair Token Migration
- Firm Agent Install Migration
- Firm Status Migration
- Instance MAC Migration
- Kill Switch Migration
- Bundle Platform Migration
- Pair Attempt Migration
- Next.js Logo Asset
- Auth Route Handler

## God Nodes (most connected - your core abstractions)
1. `db` - 50 edges
2. `cn()` - 43 edges
3. `recordActivity()` - 37 edges
4. `requireOperator()` - 30 edges
5. `Button()` - 26 edges
6. `Card()` - 26 edges
7. `CardContent()` - 26 edges
8. `CardHeader()` - 25 edges
9. `CardTitle()` - 25 edges
10. `CardDescription()` - 25 edges

## Surprising Connections (you probably didn't know these)
- `Baselines (snapshot_to_baseline / reset_to_baseline)` --semantically_similar_to--> `FirmBaseline as Install Package`  [INFERRED] [semantically similar]
  README.md → docs/configurator-install-flow.md
- `main()` --references--> `@prisma/client`  [EXTRACTED]
  scripts/seed-mcp-catalog.ts → package.json
- `main()` --references--> `@prisma/client`  [EXTRACTED]
  scripts/_seed-skills.ts → package.json
- `AI-Office Center Control Plane` --conceptually_related_to--> `Phone-Home Protocol`  [INFERRED]
  README.md → SPEC.md
- `Unified Flow: configurator → clawhub → installer → machine` --conceptually_related_to--> `Token Attribution via trace_spans and /api/v0/usage`  [INFERRED]
  docs/configurator-install-flow.md → README.md

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Phone-Home Protocol Flow (pair + heartbeat + states)** — spec_phone_home_protocol, spec_pairing_flow, spec_heartbeat_protocol, spec_instance_states, spec_api_v0_pair, spec_api_v0_heartbeat, clients_headless_readme_clawhub_agent [EXTRACTED 1.00]
- **Kill-Switch Suspension Flow (Firm.status → heartbeat → dispatcher → bridge gate)** — docs_superpowers_plans_2026_06_14_clawhub_kill_switch_kill_switch, docs_superpowers_plans_2026_06_14_clawhub_kill_switch_firm_status, docs_superpowers_plans_2026_06_14_clawhub_kill_switch_dispatcher_translation, docs_superpowers_plans_2026_06_14_clawhub_kill_switch_bridge_suspension_gate [EXTRACTED 1.00]
- **Configurator → clawhub → Installer Provisioning Flow** — docs_configurator_install_flow_unified_install_flow, docs_configurator_install_flow_configurator, docs_configurator_install_flow_firmbaseline_package, docs_configurator_install_flow_mac_registration, docs_superpowers_specs_2026_07_11_first_pair_sin_baseline_design_promoted_baseline, docs_superpowers_specs_2026_07_11_first_pair_sin_baseline_design_first_pair_block [EXTRACTED 1.00]

## Communities (84 total, 31 thin omitted)

### Community 0 - "Firm Dashboard Pages"
Cohesion: 0.09
Nodes (67): CATEGORIES, FirmMcpPage(), FirmPage(), FirmSettingsPage(), FirmUsagePage(), formatCost(), formatNumber(), parseRange() (+59 more)

### Community 1 - "API Routes & Cron Jobs"
Cohesion: 0.06
Nodes (54): checkAuth(), GET(), POST(), runSweep(), baseUrl(), Body, generateToken(), POST() (+46 more)

### Community 2 - "Headless Agent Client"
Cohesion: 0.07
Nodes (49): BRIDGE_URL, buildEnv(), CLAWHUB_URL, deleteConfig(), ensureDir(), { fetchJson }, fs, heartbeat() (+41 more)

### Community 3 - "Framework Dependencies"
Cohesion: 0.05
Nodes (39): @auth/prisma-adapter, @base-ui/react, class-variance-authority, clsx, lucide-react, next, next-auth, next-themes (+31 more)

### Community 4 - "Package Dev Dependencies"
Cohesion: 0.06
Nodes (34): dotenv, eslint, eslint-config-next, devDependencies, dotenv, eslint, eslint-config-next, tailwindcss (+26 more)

### Community 5 - "Shared UI Components"
Cohesion: 0.09
Nodes (20): CardAction(), CardFooter(), DialogContent(), DialogDescription(), DialogFooter(), DialogHeader(), DialogOverlay(), DialogTitle() (+12 more)

### Community 6 - "TypeScript Build Config"
Cohesion: 0.06
Nodes (30): dom, dom.iterable, esnext, **/*.mts, .next/dev/types/**/*.ts, next-env.d.ts, .next/types/**/*.ts, node_modules (+22 more)

### Community 7 - "Product Docs & Specs"
Cohesion: 0.09
Nodes (30): Next.js Bleeding-Edge Caveat Rule, CLAUDE.md Project Instructions Include, clawhub-agent Headless Phone-Home Client, clawhub as License Authority, Configurator Web Wizard, FirmBaseline as Install Package, MAC/Device Registration in Instance (gap), Unified Flow: configurator → clawhub → installer → machine (+22 more)

### Community 8 - "Operator Team Pages"
Cohesion: 0.13
Nodes (20): CatalogDefaults, CatalogPresentation, FirmTeamPage(), readDefaults(), readPresentation(), VOICE_KINDS, COMMAND_KIND_LIST, COMMAND_KINDS (+12 more)

### Community 9 - "Component Aliases Config"
Cohesion: 0.09
Nodes (21): aliases, components, hooks, lib, ui, utils, iconLibrary, menuAccent (+13 more)

### Community 10 - "Demo Pack Script"
Cohesion: 0.21
Nodes (17): Args, defaultExcludes(), dirSize(), extractTarGz(), formatSize(), logStep(), main(), packTarGz() (+9 more)

### Community 11 - "Prisma Client Scripts"
Cohesion: 0.13
Nodes (9): @prisma/client, @prisma/client, main(), main(), main(), main(), main(), db (+1 more)

### Community 12 - "Installer & Stack API"
Cohesion: 0.33
Nodes (7): GET(), GET(), resolvePlatform(), GET(), ManifestEntry, resolveBundle(), resolveDownloadUrl()

### Community 13 - "Initial DB Migration"
Cohesion: 0.39
Nodes (8): "Account", "Firm", "Heartbeat", "Instance", "PairingToken", "Session", "User", "VerificationToken"

### Community 14 - "Agent Catalog Seeder"
Cohesion: 0.31
Nodes (8): AGENTS_DIR, clawcrewCommit(), copyPortrait(), main(), Manifest, PUBLIC_CATALOG_DIR, readManifests(), TEMPLATES

### Community 15 - "Baseline Diff Logic"
Cohesion: 0.29
Nodes (7): BaselineDetailPage(), statusLabel(), BaselineDiff, BaselineFileSummary, diffBaselines(), DiffEntry, isPreservedPath()

### Community 16 - "Mock Bridge Server"
Cohesion: 0.29
Nodes (5): AGENTS, HEALTH, http, port, server

### Community 17 - "CI Release Workflows"
Cohesion: 0.48
Nodes (7): Stack Distribution as Package Manager, CI/CD Bundle Auto-Publish Flow (tag v* → Release → register), POST /api/v0/bundles/register Endpoint, release-bridge.yml Workflow (kind=BRIDGE), release-installer.yml Workflow (kind=INSTALLER, .exe), release-openclaw.yml Workflow (kind=OPENCLAW), release-overlay.yml Workflow (kind=OVERLAY)

### Community 18 - "Mock Instance Script"
Cohesion: 0.38
Nodes (6): args, heartbeat(), intervalIdx, labelIdx, main(), pair()

### Community 19 - "App Layout & Theme"
Cohesion: 0.33
Nodes (4): inter, jetbrainsMono, metadata, ThemeProvider()

### Community 20 - "Activity Timeline UI"
Cohesion: 0.48
Nodes (6): ActivityTimeline(), ActivityWithActor, actorLabel(), formatDayHeader(), formatTime(), kindEmoji()

### Community 21 - "Release Bundle Script"
Cohesion: 0.53
Nodes (5): Args, main(), packTarGz(), parseArgs(), sha256File()

### Community 22 - "Community Portrait"
Cohesion: 0.50
Nodes (5): ClawCrew Community Portrait Image, ClawCrew Catalog (public/catalog/clawcrew assets), Community Persona (young woman taking a photo with smartphone), Black-and-White Halftone Comic Illustration Style, User Content Sharing / Social Photography Theme

### Community 23 - "Legal-Light Portrait"
Cohesion: 0.50
Nodes (5): ClawCrew Agent Catalog, Monochrome Halftone Portrait Style, Legal-Light Persona Portrait (halftone ink portrait of a professional woman in a dark blazer and white collared shirt), Legacy Persona Catalog (pre Lean PyME), Legal-Light Agent Persona

### Community 24 - "Personal Assistant Portrait"
Cohesion: 0.60
Nodes (5): Personal Assistant Agent Portrait (monochrome comic-style illustration of a professional woman with a fountain pen tucked behind her ear, holding a notebook), ClawCrew Catalog (agent persona gallery served from public assets), Monochrome Halftone Comic Art Style (shared visual identity for catalog portraits), Organization and Note-Taking Iconography (notebook, fountain pen, business attire signaling assistant duties), Personal Assistant Persona (ClawCrew catalog agent)

### Community 25 - "SEO Writer Portrait"
Cohesion: 0.50
Nodes (5): ClawCrew Catalog, Monochrome Manga Ink Illustration Style, SEO Writer Agent Portrait, SEO Writer (ClawCrew catalog agent), Writer Persona (quill, notebook, glasses)

### Community 26 - "Baseline MemorySearch Fixer"
Cohesion: 0.50
Nodes (4): APPLY, fixMemorySearch(), main(), Row

### Community 27 - "Pin Firm Stack Script"
Cohesion: 0.60
Nodes (4): Args, main(), nullable(), parseArgs()

### Community 28 - "Release Installer Script"
Cohesion: 0.60
Nodes (4): Args, main(), parseArgs(), sha256File()

### Community 29 - "NextAuth Authentication"
Cohesion: 0.40
Nodes (3): { handlers, auth, signIn, signOut }, next-auth, Session

### Community 31 - "Analytics CRO Portrait"
Cohesion: 0.50
Nodes (4): Analytics / CRO ClawCrew Persona, ClawCrew Catalog, Monochrome Halftone / Engraved Illustration Style, Analytics CRO Agent Portrait (engraved-style illustration of a woman)

### Community 32 - "Automation Engineer Portrait"
Cohesion: 0.50
Nodes (4): Automation Engineer Persona, ClawCrew Catalog, Monochrome Engraved Illustration Style, Automation Engineer Portrait (ClawCrew)

### Community 33 - "Content Strategist Portrait"
Cohesion: 0.50
Nodes (4): ClawCrew Agent Catalog, Content Strategist Persona, Engraved Halftone Illustration Style, Content Strategist Portrait (ClawCrew)

### Community 34 - "CRM Email Portrait"
Cohesion: 0.67
Nodes (4): ClawCrew Catalog (public agent catalog with persona portraits), CRM Email Agent (ClawCrew catalog entry persona), Persona Portrait Visual Style (monochrome halftone/engraving illustration used for agent avatars), CRM Email Agent Portrait (black-and-white engraved-style illustration of a smiling woman with shoulder-length wavy dark hair, hoop earrings, and a ribbed crew-neck sweater)

### Community 35 - "Executive Portrait"
Cohesion: 0.50
Nodes (4): ClawCrew Catalog, Executive Persona (ClawCrew catalog entry), Monochrome Halftone Comic Illustration Style, Executive Persona Portrait (ClawCrew)

### Community 36 - "Marketing Strategist Portrait"
Cohesion: 0.67
Nodes (4): ClawCrew Agent Catalog, Comic Halftone Illustration Style, Marketing Strategist Persona, Marketing Strategist Portrait (ClawCrew)

### Community 37 - "Outbound SDR Portrait"
Cohesion: 0.67
Nodes (4): ClawCrew Catalog, Comic Halftone Illustration Style, Outbound SDR (Sales Development Representative) Agent, Outbound SDR Agent Portrait

### Community 38 - "Paid Media Portrait"
Cohesion: 0.67
Nodes (4): Paid Media Agent Portrait, ClawCrew Agent Catalog, Monochrome Halftone Illustration Style, Paid Media Specialist Persona

### Community 39 - "Video Director Portrait"
Cohesion: 0.50
Nodes (4): ClawCrew Catalog, Engraved Halftone Illustration Style, Video Director Portrait (ClawCrew), Video Director Agent Persona

### Community 40 - "Visual Director Portrait"
Cohesion: 0.50
Nodes (4): ClawCrew Agent Catalog, Monochrome Halftone Ink Illustration Style, Visual Director Portrait Image, Visual Director Persona (ClawCrew)

### Community 41 - "MCP Catalog Seeder"
Cohesion: 0.50
Nodes (3): CATALOG, CatalogEntry, main()

### Community 42 - "E2E Test Script"
Cohesion: 0.67
Nodes (3): db, main(), step()

### Community 49 - "Community Engagement Portrait"
Cohesion: 1.00
Nodes (3): ClawCrew Catalog (persona portraits served from public/catalog/clawcrew), Community Engagement (ClawCrew Catalog Entry), Community Engagement Portrait (halftone B/W illustration of a young man with wavy dark hair, stubble, dark crew-neck sweater)

### Community 50 - "Copywriter Portrait"
Cohesion: 0.67
Nodes (3): ClawCrew Catalog, Copywriter (ClawCrew persona), Copywriter Persona Portrait (halftone engraving illustration)

### Community 51 - "SEO Strategist Portrait"
Cohesion: 1.00
Nodes (3): ClawCrew Agent Catalog, SEO Strategist Portrait Image, SEO Strategist ClawCrew Persona

### Community 52 - "File Icon Asset"
Cohesion: 0.67
Nodes (3): Document/File Icon Concept, Next.js Starter Template Public Assets, File Document Icon (file.svg)

### Community 53 - "Globe Icon Asset"
Cohesion: 0.67
Nodes (3): Globe Icon (globe.svg), Next.js Default Template Asset, Wireframe Globe Glyph

### Community 54 - "Vercel Logo Asset"
Cohesion: 0.67
Nodes (3): Vercel Logo (White Triangle SVG), Next.js Starter Template Public Asset, Vercel Deployment Platform

### Community 55 - "Window Icon Asset"
Cohesion: 0.67
Nodes (3): Browser Window UI Metaphor, Window Icon (window.svg), Next.js Default Starter Assets

## Knowledge Gaps
- **239 isolated node(s):** `http`, `port`, `HEALTH`, `AGENTS`, `server` (+234 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **31 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `@prisma/client` connect `Prisma Client Scripts` to `Framework Dependencies`, `MCP Catalog Seeder`, `Demo Pack Script`, `Agent Catalog Seeder`, `Release Bundle Script`, `Skills Seeder`, `Baseline MemorySearch Fixer`, `Pin Firm Stack Script`, `Release Installer Script`?**
  _High betweenness centrality (0.026) - this node is a cross-community bridge._
- **Why does `dependencies` connect `Framework Dependencies` to `Prisma Client Scripts`, `Package Dev Dependencies`?**
  _High betweenness centrality (0.025) - this node is a cross-community bridge._
- **Why does `db` connect `Firm Dashboard Pages` to `API Routes & Cron Jobs`, `Operator Team Pages`, `Agents API Route`, `Installer & Stack API`, `Office Templates API`, `NextAuth Authentication`?**
  _High betweenness centrality (0.023) - this node is a cross-community bridge._
- **What connects `http`, `port`, `HEALTH` to the rest of the system?**
  _239 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Firm Dashboard Pages` be split into smaller, more focused modules?**
  _Cohesion score 0.09097966154323862 - nodes in this community are weakly interconnected._
- **Should `API Routes & Cron Jobs` be split into smaller, more focused modules?**
  _Cohesion score 0.055905220288781934 - nodes in this community are weakly interconnected._
- **Should `Headless Agent Client` be split into smaller, more focused modules?**
  _Cohesion score 0.06753246753246753 - nodes in this community are weakly interconnected._