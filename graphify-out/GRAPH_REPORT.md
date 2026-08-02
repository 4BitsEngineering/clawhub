# Graph Report - .  (2026-08-01)

## Corpus Check
- Large corpus: 206 files · ~1,296,168 words. Semantic extraction will be expensive (many Claude tokens). Consider running on a subfolder.

## Summary
- 1253 nodes · 2335 edges · 167 communities (81 shown, 86 thin omitted)
- Extraction: 97% EXTRACTED · 3% INFERRED · 0% AMBIGUOUS · INFERRED: 68 edges (avg confidence: 0.84)
- Token cost: 570,638 input · 0 output

## Community Hubs (Navigation)
- Empresa Sales Dashboard
- Headless Agent Client
- Prisma Admin Scripts
- OpenClaw Plugin Policy
- Configurator Install Flow
- Frontend Dependencies
- Dev Dependencies
- TypeScript Config
- UI Component Library
- Component Aliases Config
- OpenSpec Workflow Commands
- Loop Detection Config
- OpenClaw Template Config
- Demo Pack Script
- Command Security Config
- Gateway Auth Config
- Model Providers Config
- Firm Invitations API
- Agent Defaults Config
- Plugin Enablement Flags
- Baselines API Routes
- Instance API Routes
- Session Pruning Config
- Skills Workshop Config
- TTS Voice Config
- Installer Download API
- Firm Install Plan
- Provider Config Entries
- ElevenLabs TTS Config
- Operator Cron and Bundles API
- Architecture and Project Docs
- Web Search Config
- Subagents Config
- Initial Database Schema
- Sales Suite Database Schema
- Browser SSRF Config
- Model Provider Endpoints
- Baseline Diff Logic
- Public Landing Page
- Mock Bridge Server
- Messaging Channels Config
- Mock Instance Script
- Root Layout and Theme
- Activity Timeline UI
- MCP Bridge Config
- Compaction Config
- Instance Register API
- Skills API Routes
- Image Generation Config
- Fallback Model Config
- Streaming Models Config
- NextAuth Setup
- Pairing API Route
- Database Seed Script
- Community Portrait Assets
- Content Strategist Portrait
- Executive Portrait
- Legal Light Portrait
- SEO Strategist Portrait
- Video Director Portrait
- E2E Test Script
- Agents Catalog API
- Office Templates API
- Context Pruning Config
- Memory Search Config
- Firm Baseline Migration
- Stack Bundle Migration
- MCP Catalog Migration
- Agent Catalog Migration
- Analytics CRO Portrait
- Community Engagement Portrait
- Copywriter Portrait
- CRM Email Portrait
- Marketing Strategist Portrait
- Outbound SDR Portrait
- Paid Media Portrait
- SEO Writer Portrait
- Visual Director Portrait
- Next.js Template Icons
- Instance Detail Page
- Privacy Page
- Terms Page
- Operator Navigation
- Sales Navigation
- Vercel Cron Config
- Project Instructions
- ESLint Config
- Next.js Config
- 1Password Plugin Flag
- Apple Notes Plugin Flag
- Apple Reminders Plugin Flag
- Audio Spot Plugin Flag
- Blogwatcher Plugin Flag
- Blucli Plugin Flag
- BlueBubbles Plugin Flag
- Camsnap Plugin Flag
- Canvas Plugin Flag
- Coding Agent Plugin Flag
- Discord Plugin Flag
- DOCX Formatting Plugin Flag
- Eightctl Plugin Flag
- Gemini Plugin Flag
- GH Issues Plugin Flag
- Gifgrep Plugin Flag
- GitHub Plugin Flag
- Gog Plugin Flag
- Healthcheck Plugin Flag
- Himalaya Plugin Flag
- iMessage Plugin Flag
- Jira Plugin Flag
- LinkedIn Post Plugin Flag
- Mcporter Plugin Flag
- Model Usage Plugin Flag
- n8n Workflows Plugin Flag
- Nano PDF Plugin Flag
- Node Connect Plugin Flag
- Notion Plugin Flag
- Obsidian Plugin Flag
- Whisper Plugin Flag
- Whisper API Plugin Flag
- OpenHue Plugin Flag
- Oracle Plugin Flag
- Ordercli Plugin Flag
- PDF Processing Plugin Flag
- Peekaboo Plugin Flag
- PPTX Formatting Plugin Flag
- Sag Plugin Flag
- Session Logs Plugin Flag
- Sherpa TTS Plugin Flag
- Skill Creator Plugin Flag
- Songsee Plugin Flag
- Sonoscli Plugin Flag
- Spotify Player Plugin Flag
- Summarize Plugin Flag
- Things Mac Plugin Flag
- Tmux Plugin Flag
- Trello Plugin Flag
- Video Frames Plugin Flag
- Voice Call Plugin Flag
- Weather Plugin Flag
- Xurl Plugin Flag
- PostCSS Config
- Skill Table Migration
- Instance Command Migration
- Usage Record Migration
- Running Versions Migration
- Activity Log Migration
- Invitation Migration
- Baseline Promotion Migration
- Repair Token Migration
- Firm Agent Install Migration
- Firm Status Migration
- Instance MAC Migration
- Kill Switch Migration
- Bundle Platform Migration
- Pair Attempt Migration
- Framework Logos
- OpenSpec Config
- Route Re-export

## God Nodes (most connected - your core abstractions)
1. `db` - 63 edges
2. `entries` - 62 edges
3. `cn()` - 43 edges
4. `recordActivity()` - 37 edges
5. `Card()` - 35 edges
6. `CardContent()` - 35 edges
7. `Button()` - 34 edges
8. `CardHeader()` - 32 edges
9. `CardTitle()` - 32 edges
10. `requireOperator()` - 31 edges

## Surprising Connections (you probably didn't know these)
- `POST /api/v0/pair (Pairing Flow)` --semantically_similar_to--> `OPERATOR_API_KEY (M2M auth for bundle registration)`  [INFERRED] [semantically similar]
  SPEC.md → scripts/ci-templates/README.md
- `clawhub-agent (headless phone-home client)` --semantically_similar_to--> `Dispatcher firm_status → bridge suspend/resume translation`  [INFERRED] [semantically similar]
  clients/headless/README.md → docs/superpowers/plans/2026-06-14-clawhub-kill-switch.md
- `Sales Suite (clawhub) - project status` --conceptually_related_to--> `AI-Office Center (multi-tenant control plane)`  [INFERRED]
  ACCIONES-PENDIENTES.md → README.md
- `Funcionalidades — Estado Actual (2026-07-27)` --conceptually_related_to--> `Unified Flow: configurator → clawhub → installer → machine`  [INFERRED]
  openspec/funionales.md → docs/configurator-install-flow.md
- `openclaw-configurator Review Notes` --conceptually_related_to--> `Unified Flow: configurator → clawhub → installer → machine`  [INFERRED]
  openspec/revisar/revisar.md → docs/configurator-install-flow.md

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **OPSX Command Suite (OpenSpec experimental workflow commands)** — claude_commands_opsx_apply_opsx_apply, claude_commands_opsx_archive_opsx_archive, claude_commands_opsx_explore_opsx_explore, claude_commands_opsx_propose_opsx_propose, claude_commands_opsx_sync_opsx_sync, claude_commands_opsx_update_opsx_update [EXTRACTED 1.00]
- **OpenSpec Skill Suite (generated by openspec CLI 1.6.0)** — claude_skills_openspec_apply_change_skill_openspec_apply_change, claude_skills_openspec_archive_change_skill_openspec_archive_change, claude_skills_openspec_explore_skill_openspec_explore, claude_skills_openspec_propose_skill_openspec_propose, claude_skills_openspec_sync_specs_skill_openspec_sync_specs, claude_skills_openspec_update_change_skill_openspec_update_change [EXTRACTED 1.00]
- **Phone-home Lifecycle (pair → token → heartbeat → status)** — spec_pair_endpoint, spec_heartbeat_endpoint, spec_instance, spec_pairingtoken, clients_headless_readme_clawhub_agent [EXTRACTED 1.00]
- **Bundle Release Pipeline (tag push → GitHub Release → clawhub register)** — scripts_ci_templates_release_overlay_workflow, scripts_ci_templates_release_bridge_workflow, scripts_ci_templates_release_openclaw_workflow, scripts_ci_templates_release_installer_workflow, scripts_ci_templates_readme_bundles_register_endpoint, scripts_ci_templates_readme_operator_api_key [EXTRACTED 1.00]
- **Sales Attribution Funnel (prospect → tracking link → landing → Stripe → commission)** — openspec_funionales_vista_comercial, openspec_funionales_tracking_token, openspec_funionales_landing_publica, openspec_funionales_stripe_edge_function, openspec_funionales_comisiones [EXTRACTED 1.00]
- **** — public_file_fileicon, public_globe_globeicon, public_next_nextjslogo, public_vercel_vercellogo, public_window_windowicon [INFERRED 0.95]

## Communities (167 total, 86 thin omitted)

### Community 0 - "Empresa Sales Dashboard"
Cohesion: 0.06
Nodes (111): EmpresaCampaignDetailPage(), SEND_STATUS_LABELS, EmpresaCampaignsPage(), STATUS_LABELS, EmpresaCommissionsPage(), fmt(), EmpresaLandingPage(), EmpresaPage() (+103 more)

### Community 1 - "Headless Agent Client"
Cohesion: 0.07
Nodes (49): BRIDGE_URL, buildEnv(), CLAWHUB_URL, deleteConfig(), ensureDir(), { fetchJson }, fs, heartbeat() (+41 more)

### Community 2 - "Prisma Admin Scripts"
Cohesion: 0.05
Nodes (36): @prisma/client, @prisma/client, main(), main(), main(), main(), main(), Args (+28 more)

### Community 3 - "OpenClaw Plugin Policy"
Cohesion: 0.04
Nodes (47): paths, plugins, allow, deny, load, acpx, anthropic, asset-downloader (+39 more)

### Community 4 - "Configurator Install Flow"
Cohesion: 0.07
Nodes (45): clawhub-agent (headless phone-home client), clawhub as License Authority, FirmBaseline (configurator package), MAC/deviceId capture gap in Instance, smartbotics Retirement from Installer, StackBundle (installer/bundle artifact), Supabase Project Paused (blocker), Unified Flow: configurator → clawhub → installer → machine (+37 more)

### Community 5 - "Frontend Dependencies"
Cohesion: 0.05
Nodes (43): @auth/prisma-adapter, @base-ui/react, class-variance-authority, clsx, lucide-react, next, next-auth, next-themes (+35 more)

### Community 6 - "Dev Dependencies"
Cohesion: 0.06
Nodes (35): dotenv, eslint, eslint-config-next, devDependencies, dotenv, eslint, eslint-config-next, tailwindcss (+27 more)

### Community 7 - "TypeScript Config"
Cohesion: 0.06
Nodes (31): dom, dom.iterable, esnext, **/*.mts, .next/dev/types/**/*.ts, next-env.d.ts, .next/types/**/*.ts, node_modules (+23 more)

### Community 8 - "UI Component Library"
Cohesion: 0.09
Nodes (20): CardAction(), CardFooter(), DialogContent(), DialogDescription(), DialogFooter(), DialogHeader(), DialogOverlay(), DialogTitle() (+12 more)

### Community 9 - "Component Aliases Config"
Cohesion: 0.09
Nodes (21): aliases, components, hooks, lib, ui, utils, iconLibrary, menuAccent (+13 more)

### Community 10 - "OpenSpec Workflow Commands"
Cohesion: 0.20
Nodes (21): Fluid Workflow: Actions on a Change Model. Rationale: implementation is not phase-locked; apply can be invoked anytime and artifact updates are allowed when implementation reveals design issues, OpenSpec CLI, OPSX: Apply Command, Spec-Driven Workflow Schema, OpenSpec Store Selection (--store flag), OPSX: Archive Command, Explore Mode Stance. Rationale: a stance not a workflow - thinking partner mode with no fixed steps; never writes code because exploring and implementing must stay separated; creating OpenSpec artifacts counts as capturing thinking, not implementing, OPSX: Explore Command (+13 more)

### Community 11 - "Loop Detection Config"
Cohesion: 0.10
Nodes (21): genericRepeat, knownPollNoProgress, pingPong, detectors, enabled, enabled, tools, alsoAllow (+13 more)

### Community 12 - "OpenClaw Template Config"
Cohesion: 0.10
Nodes (19): bindings, commands, ownerAllowFrom, cron, sessionRetention, discovery, mdns, env (+11 more)

### Community 13 - "Demo Pack Script"
Cohesion: 0.21
Nodes (17): Args, defaultExcludes(), dirSize(), extractTarGz(), formatSize(), logStep(), main(), packTarGz() (+9 more)

### Community 14 - "Command Security Config"
Cohesion: 0.12
Nodes (17): allowInsecurePath, args, command, passEnv, source, trustedDirs, bridge_tokens, secrets (+9 more)

### Community 15 - "Gateway Auth Config"
Cohesion: 0.12
Nodes (16): mode, token, enabled, allowInsecureAuth, dangerouslyDisableDeviceAuth, chatCompletions, gateway, auth (+8 more)

### Community 16 - "Model Providers Config"
Cohesion: 0.12
Nodes (16): dreaming, enabled, frequency, litellm, memory-core, minimax, ollama, openai (+8 more)

### Community 17 - "Firm Invitations API"
Cohesion: 0.24
Nodes (11): baseUrl(), Body, generateToken(), POST(), POST(), POST(), POST(), FirmBaselinesPage() (+3 more)

### Community 18 - "Agent Defaults Config"
Cohesion: 0.13
Nodes (15): agents, defaults, list, bootstrapMaxChars, bootstrapTotalMaxChars, contextInjection, heartbeat, maxConcurrent (+7 more)

### Community 19 - "Plugin Enablement Flags"
Cohesion: 0.13
Nodes (15): enabled, enabled, enabled, enabled, bear-notes, clawflow, clawflow-inbox-triage, clawhub (+7 more)

### Community 20 - "Baselines API Routes"
Cohesion: 0.18
Nodes (12): Body, FileBody, POST(), POST(), ResultBody, ActivityActor, ActorRole, inferActor() (+4 more)

### Community 21 - "Instance API Routes"
Cohesion: 0.27
Nodes (8): GET(), HeartbeatBody, POST(), GET(), Body, POST(), Record, hashToken()

### Community 22 - "Session Pruning Config"
Cohesion: 0.17
Nodes (12): maxPingPongTurns, maxEntries, mode, pruneAfter, atHour, idleMinutes, mode, session (+4 more)

### Community 23 - "Skills Workshop Config"
Cohesion: 0.17
Nodes (12): enabled, extraDirs, skills, load, workshop, approvalPolicy, autonomous, maxPending (+4 more)

### Community 24 - "TTS Voice Config"
Cohesion: 0.18
Nodes (11): api, apiKey, baseUrl, model, models, pitch, speed, timeoutSeconds (+3 more)

### Community 25 - "Installer Download API"
Cohesion: 0.33
Nodes (7): GET(), GET(), resolvePlatform(), GET(), ManifestEntry, resolveBundle(), resolveDownloadUrl()

### Community 26 - "Firm Install Plan"
Cohesion: 0.25
Nodes (10): FirmTeamPage(), readDefaults(), readPresentation(), buildAgentCliCommands(), buildInstallCommandArgs(), buildInstallPlan(), PREFIX_BY_OVERLAY, prefixForOverlay() (+2 more)

### Community 27 - "Provider Config Entries"
Cohesion: 0.29
Nodes (10): id, provider, source, apiKey, baseUrl, apiKey, n8n, config (+2 more)

### Community 28 - "ElevenLabs TTS Config"
Cohesion: 0.20
Nodes (10): languageCode, voiceId, messages, tts, enabled, elevenlabs, auto, modelOverrides (+2 more)

### Community 29 - "Operator Cron and Bundles API"
Cohesion: 0.36
Nodes (8): checkAuth(), GET(), POST(), runSweep(), Body, checkAuth(), POST(), systemActor()

### Community 30 - "Architecture and Project Docs"
Cohesion: 0.25
Nodes (9): Production Readiness Checklist (live Stripe key, disable dev auth, Resend domain, prod webhook), Sales Suite (clawhub) - project status, Stripe Webhook Supabase Edge Function (checkout.session.completed -> Purchase, Firm, User, Prospect, Commission), AI-Office Center (multi-tenant control plane), On-Prem Architecture. Rationale: sensitive worker data (mail, conversations, agent memory) NEVER leaves the PC; the worker PC makes only outbound HTTPS to the control plane, so no inbound ports, no VPN, no exposed credentials, Pairing Flow (single-use 8-char pairing code, seat quota enforcement), Remote Command Queue (11 command kinds with instance_token auth and idempotency), Stack Distribution (bundle registry, per-firm pinned manifest, sha256-verified bootstrap, auto-update) (+1 more)

### Community 31 - "Web Search Config"
Cohesion: 0.22
Nodes (9): config, enabled, webSearch, config, enabled, brave, duckduckgo, region (+1 more)

### Community 32 - "Subagents Config"
Cohesion: 0.22
Nodes (9): subagents, allowAgents, archiveAfterMinutes, delegationMode, maxChildrenPerAgent, maxConcurrent, maxSpawnDepth, runTimeoutSeconds (+1 more)

### Community 33 - "Initial Database Schema"
Cohesion: 0.39
Nodes (8): "Account", "Firm", "Heartbeat", "Instance", "PairingToken", "Session", "User", "VerificationToken"

### Community 34 - "Sales Suite Database Schema"
Cohesion: 0.47
Nodes (8): "Campaign", "CampaignSend", "Commission", "LandingPage", "LandingVisit", "Prospect", "Purchase", "SalesRep"

### Community 35 - "Browser SSRF Config"
Cohesion: 0.25
Nodes (8): browser, enabled, ssrfPolicy, browser, allowedHostnames, dangerouslyAllowPrivateNetwork, 127.0.0.1, localhost

### Community 36 - "Model Provider Endpoints"
Cohesion: 0.25
Nodes (8): models, mode, providers, api, apiKey, baseUrl, models, ollama

### Community 37 - "Baseline Diff Logic"
Cohesion: 0.29
Nodes (7): BaselineDetailPage(), statusLabel(), BaselineDiff, BaselineFileSummary, diffBaselines(), DiffEntry, isPreservedPath()

### Community 38 - "Public Landing Page"
Cohesion: 0.32
Nodes (3): CountdownTimer(), getTimeLeft(), TimeLeft

### Community 39 - "Mock Bridge Server"
Cohesion: 0.29
Nodes (5): AGENTS, HEALTH, http, port, server

### Community 40 - "Messaging Channels Config"
Cohesion: 0.29
Nodes (7): channels, slack, whatsapp, slack, whatsapp, enabled, enabled

### Community 41 - "Mock Instance Script"
Cohesion: 0.38
Nodes (6): args, heartbeat(), intervalIdx, labelIdx, main(), pair()

### Community 42 - "Root Layout and Theme"
Cohesion: 0.33
Nodes (4): inter, jetbrainsMono, metadata, ThemeProvider()

### Community 43 - "Activity Timeline UI"
Cohesion: 0.48
Nodes (6): ActivityTimeline(), ActivityWithActor, actorLabel(), formatDayHeader(), formatTime(), kindEmoji()

### Community 44 - "MCP Bridge Config"
Cohesion: 0.33
Nodes (6): config, enabled, mcpServers, openClawToolsMcpBridge, pluginToolsMcpBridge, acpx

### Community 45 - "Compaction Config"
Cohesion: 0.33
Nodes (6): keepRecentTokens, midTurnPrecheck, mode, reserveTokens, compaction, enabled

### Community 46 - "Instance Register API"
Cohesion: 0.47
Nodes (5): Body, checkAuth(), FileBody, POST(), generatePairingCode()

### Community 47 - "Skills API Routes"
Cohesion: 0.60
Nodes (3): GET(), GET(), authenticateInstance()

### Community 48 - "Image Generation Config"
Cohesion: 0.40
Nodes (5): imageGenerationModel, fallbacks, primary, timeoutMs, minimax-portal/image-01

### Community 49 - "Fallback Model Config"
Cohesion: 0.40
Nodes (5): model, fallbacks, primary, minimax/MiniMax-M2.7, ollama/gemma4-gpu

### Community 50 - "Streaming Models Config"
Cohesion: 0.40
Nodes (5): models, streaming, streaming, minimax/MiniMax-M2.7, minimax/MiniMax-M3

### Community 51 - "NextAuth Setup"
Cohesion: 0.40
Nodes (3): { handlers, auth, signIn, signOut }, next-auth, Session

### Community 52 - "Pairing API Route"
Cohesion: 0.70
Nodes (4): getClientIpHash(), PairBody, POST(), generateInstanceToken()

### Community 54 - "Community Portrait Assets"
Cohesion: 0.67
Nodes (4): ClawCrew Community Catalog Section, Black-and-white Halftone Comic/Manga Art Style, Community Portrait Illustration (woman holding smartphone), Smartphone Photography / Content Creation Motif

### Community 55 - "Content Strategist Portrait"
Cohesion: 0.50
Nodes (4): ClawCrew Catalog, Content Strategist Persona, Engraved / Halftone Portrait Art Style, Content Strategist Portrait (engraved-style avatar of smiling woman)

### Community 56 - "Executive Portrait"
Cohesion: 0.50
Nodes (4): ClawCrew Catalog, ClawCrew Executive Persona, Monochrome Halftone Comic Illustration Style, Executive Portrait Illustration

### Community 57 - "Legal Light Portrait"
Cohesion: 0.50
Nodes (4): ClawCrew Catalog Assets, Black-and-White Halftone Comic Portrait Style, Legal Light Persona (Professional Woman in Business Suit), Legal Light Portrait Image

### Community 58 - "SEO Strategist Portrait"
Cohesion: 0.67
Nodes (4): ClawCrew Agent Catalog, Monochrome Halftone Engraving Illustration Style, SEO Strategist Portrait Image, SEO Strategist Persona

### Community 59 - "Video Director Portrait"
Cohesion: 0.50
Nodes (4): ClawCrew Catalog, Monochrome Halftone Illustration Style, Video Director Portrait Image, Video Director Agent Persona

### Community 60 - "E2E Test Script"
Cohesion: 0.67
Nodes (3): db, main(), step()

### Community 63 - "Context Pruning Config"
Cohesion: 0.67
Nodes (3): mode, ttl, contextPruning

### Community 64 - "Memory Search Config"
Cohesion: 0.67
Nodes (3): memorySearch, enabled, provider

### Community 69 - "Analytics CRO Portrait"
Cohesion: 1.00
Nodes (3): Analytics & CRO Specialist Persona, ClawCrew Agent Catalog, Analytics-CRO Agent Portrait (ink/halftone illustration of a woman with dark updo hair, hoop earrings, knit sweater)

### Community 70 - "Community Engagement Portrait"
Cohesion: 0.67
Nodes (3): ClawCrew Catalog (public/catalog/clawcrew asset collection), Community Engagement ClawCrew Persona, Community Engagement Agent Portrait (halftone-style illustration of a smiling young man with wavy dark hair, stubble, and a dark crew-neck sweater)

### Community 71 - "Copywriter Portrait"
Cohesion: 0.67
Nodes (3): ClawCrew Catalog (collection of persona assets under public/catalog/clawcrew), Copywriter Persona (ClawCrew catalog agent character), Copywriter Portrait Image (halftone engraving-style B&W illustration of a smiling woman with wavy dark hair, hoop earrings, blazer)

### Community 72 - "CRM Email Portrait"
Cohesion: 1.00
Nodes (3): Agent Persona Avatar (humanized portrait style for catalog agents), CRM Email Agent (ClawCrew catalog item), CRM Email Agent Portrait (engraved halftone illustration of a smiling woman with shoulder-length wavy dark hair, hoop earrings, ribbed sweater)

### Community 73 - "Marketing Strategist Portrait"
Cohesion: 0.67
Nodes (3): ClawCrew Catalog (public catalog of agent personas), Marketing Strategist Persona (ClawCrew catalog agent), Marketing Strategist Portrait (black-and-white halftone comic-style headshot of a professional woman with long wavy dark hair, hoop earrings, and a blazer, on a white background)

### Community 74 - "Outbound SDR Portrait"
Cohesion: 0.67
Nodes (3): ClawCrew Catalog, Outbound SDR Agent Persona, Outbound SDR Portrait Illustration

### Community 75 - "Paid Media Portrait"
Cohesion: 0.67
Nodes (3): ClawCrew Catalog (public catalog of agent personas), Paid Media Persona (ClawCrew catalog member), Paid Media Agent Portrait (halftone comic-style male avatar with glasses)

### Community 76 - "SEO Writer Portrait"
Cohesion: 0.67
Nodes (3): ClawCrew Catalog, SEO Writer Portrait Image, SEO Writer Persona (ClawCrew Agent)

### Community 77 - "Visual Director Portrait"
Cohesion: 0.67
Nodes (3): Engraved Halftone Black-and-White Illustration Style, Visual Director Portrait Image, Visual Director Persona (ClawCrew Catalog Agent)

### Community 78 - "Next.js Template Icons"
Cohesion: 1.00
Nodes (3): File Icon (default Next.js template asset), Globe Icon (default Next.js template asset), Browser Window Icon (default Next.js template asset)

### Community 79 - "Instance Detail Page"
Cohesion: 0.67
Nodes (3): formatTokens(), formatUptime(), InstanceDetailPage()

## Knowledge Gaps
- **488 isolated node(s):** `http`, `port`, `HEALTH`, `AGENTS`, `server` (+483 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **86 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `entries` connect `Plugin Enablement Flags` to `Sherpa TTS Plugin Flag`, `Skill Creator Plugin Flag`, `Songsee Plugin Flag`, `Sonoscli Plugin Flag`, `Spotify Player Plugin Flag`, `Summarize Plugin Flag`, `Things Mac Plugin Flag`, `Tmux Plugin Flag`, `Trello Plugin Flag`, `Video Frames Plugin Flag`, `Voice Call Plugin Flag`, `Weather Plugin Flag`, `Xurl Plugin Flag`, `Skills Workshop Config`, `Messaging Channels Config`, `1Password Plugin Flag`, `Apple Notes Plugin Flag`, `Apple Reminders Plugin Flag`, `Audio Spot Plugin Flag`, `Blogwatcher Plugin Flag`, `Blucli Plugin Flag`, `BlueBubbles Plugin Flag`, `Camsnap Plugin Flag`, `Canvas Plugin Flag`, `Coding Agent Plugin Flag`, `Discord Plugin Flag`, `DOCX Formatting Plugin Flag`, `Eightctl Plugin Flag`, `Gemini Plugin Flag`, `GH Issues Plugin Flag`, `Gifgrep Plugin Flag`, `GitHub Plugin Flag`, `Gog Plugin Flag`, `Healthcheck Plugin Flag`, `Himalaya Plugin Flag`, `iMessage Plugin Flag`, `Jira Plugin Flag`, `LinkedIn Post Plugin Flag`, `Mcporter Plugin Flag`, `Model Usage Plugin Flag`, `n8n Workflows Plugin Flag`, `Nano PDF Plugin Flag`, `Node Connect Plugin Flag`, `Notion Plugin Flag`, `Obsidian Plugin Flag`, `Whisper Plugin Flag`, `Whisper API Plugin Flag`, `OpenHue Plugin Flag`, `Oracle Plugin Flag`, `Ordercli Plugin Flag`, `PDF Processing Plugin Flag`, `Peekaboo Plugin Flag`, `PPTX Formatting Plugin Flag`, `Sag Plugin Flag`, `Session Logs Plugin Flag`?**
  _High betweenness centrality (0.054) - this node is a cross-community bridge._
- **Why does `skills` connect `Skills Workshop Config` to `Plugin Enablement Flags`, `OpenClaw Template Config`?**
  _High betweenness centrality (0.052) - this node is a cross-community bridge._
- **Why does `plugins` connect `OpenClaw Plugin Policy` to `Model Providers Config`, `OpenClaw Template Config`?**
  _High betweenness centrality (0.035) - this node is a cross-community bridge._
- **What connects `http`, `port`, `HEALTH` to the rest of the system?**
  _488 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Empresa Sales Dashboard` be split into smaller, more focused modules?**
  _Cohesion score 0.05946448740947445 - nodes in this community are weakly interconnected._
- **Should `Headless Agent Client` be split into smaller, more focused modules?**
  _Cohesion score 0.06753246753246753 - nodes in this community are weakly interconnected._
- **Should `Prisma Admin Scripts` be split into smaller, more focused modules?**
  _Cohesion score 0.05053191489361702 - nodes in this community are weakly interconnected._