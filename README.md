# Yourpedia — Setup Tool

A web tool that turns a résumé (PDF or freeform text) into a deployable
Wikipedia-styled personal wiki, ready to drop into a fork of
[colarpedia-template](https://github.com/wangxuzhou666-arch/colarpedia-template).

**Status:** Phase 1B (LLM-powered auto-fill). Local-only — not yet
deployed.

## What it does

1. User uploads a PDF résumé (or pastes any self-description text).
2. Server calls Claude Haiku 4.5 to extract structured wiki data.
3. Data auto-fills the form. User edits anything they want.
4. Browser packages a zip with `site.config.js` + `wiki/<You>.md` +
   a 5-step deploy README.
5. User forks [colarpedia-template](https://github.com/wangxuzhou666-arch/colarpedia-template),
   drops in the zip contents, pushes, deploys to Vercel — done.

## Stack

- **Next.js 15** App Router (mixed SSR + static)
- **Anthropic Claude Haiku 4.5** — résumé parsing via tool-use structured output
- **pdf-parse** — server-side PDF text extraction
- **react-hook-form + zod + @hookform/resolvers** — form + validation
- **jszip** — in-browser archive packaging

## Local dev

```bash
# 1. Get an Anthropic API key
#    https://console.anthropic.com/settings/keys
#    (Free tier: $5 credit, ~1000 generations of Haiku 4.5)

# 2. Configure env
cp .env.example .env.local
# Edit .env.local and paste your sk-ant-... key

# 3. Install + run
npm install
npm run dev
# → http://localhost:3000/setup/
```

## Architecture

| Route | Render | Purpose |
|---|---|---|
| `/` | Static | Client-side redirect to `/setup/` |
| `/setup` | Static + client | Form, upload UI, in-browser zip generation |
| `/api/parse` | Dynamic SSR | Anthropic SDK call (API key never exposed to browser) |

The form generates files entirely in the browser via `JSZip`. Only the
LLM parsing step touches the server.

## Cost & rate limits

- Per generation: ~$0.005 (5K input + 3K output tokens against Haiku 4.5).
- Default rate limit: 10 generations / day / IP (configurable via
  `RATE_LIMIT_PER_DAY` env). In-memory, per-process — replace with
  Upstash/Redis once you have steady traffic.
- Cost alert env: `COST_ALERT_USD` (default 20).

## Deploy

Vercel project, Node.js runtime (not Edge — pdf-parse needs Node APIs).
Set `ANTHROPIC_API_KEY` in Project Settings → Environment Variables.

## License

MIT (see LICENSE).

## Roadmap

- **Phase 1B** (here): PDF / text → structured wiki data, manual deploy
- Phase 1C: GitHub OAuth + auto-fork + Vercel Deploy Button (3-5h)
- Phase 1B v2: LinkedIn URL + GitHub URL ingestion (3-5h)
- Phase 2: Profile card generator (`@vercel/og` 1080×1350) integrated