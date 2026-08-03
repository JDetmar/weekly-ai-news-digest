---
on:
  schedule:
    - cron: "0 10 * * *"       # 06:00 ET during daylight saving (UTC schedule)
  workflow_dispatch:            # Manual trigger from Actions tab

permissions:
  contents: read
  pull-requests: read
  copilot-requests: write

network:
  allowed:
    - defaults
    # General tech and AI press
    - "techcrunch.com"
    - "technologyreview.com"
    - "hnrss.org"
    - "feeds.arstechnica.com"
    - "arstechnica.com"
    - "theverge.com"
    - "venturebeat.com"
    - "feeds.feedburner.com"
    # Platform and developer changelogs
    - "github.blog"
    - "developer.microsoft.com"
    # Frontier labs and model makers
    - "openai.com"
    - "blog.google"
    - "mistral.ai"
    # Independent AI engineering analysis
    - "simonwillison.net"
    - "www.latent.space"
    - "jack-clark.net"

safe-outputs:
  create-pull-request:
    title-prefix: "📰 Weekly AI News Digest – "
    labels: [digest, automated]
    draft: false
    base-branch: main
    preserve-branch-name: true
    recreate-ref: true
    max-patch-files: 5
    auto-close-issue: false

---

# Weekly AI & Tech News Digest

You are an expert tech journalist. Your job is to research, curate, and summarize **up to 30 of the most important AI and technology stories from the last 14 days**, then write a polished static HTML page to `docs/index.html`.

## Step 1 — Research

Fetch the following RSS feeds and extract all entries published in the last 14 days.
No single group below owns the digest; they exist so that one week's page can span model releases, tooling, platform changes, and industry news rather than a single vendor's changelog.

**Frontier labs and model makers**

- `https://openai.com/news/rss.xml` ← **OpenAI**
- `https://blog.google/innovation-and-ai/models-and-research/google-deepmind/rss/` ← **Google DeepMind**
- `https://mistral.ai/rss.xml` ← **Mistral AI**
- `https://github.com/anthropics/claude-code/releases.atom` ← **Claude Code** (release notes; see the aggregation rule below)

**AI coding tools and platform changelogs**

- `https://github.blog/changelog/feed/` ← **GitHub Changelog** (product & API updates, including Copilot)
- `https://github.blog/feed/` ← **GitHub Blog** (deeper Copilot and platform posts)
- `https://developer.microsoft.com/api/changelog/rss` ← **Microsoft Developer Changelog** (unified Azure, GitHub, and Microsoft developer updates)

**Independent AI engineering analysis**

- `https://simonwillison.net/atom/everything/` ← **Simon Willison**
- `https://www.latent.space/feed` ← **Latent Space**
- `https://jack-clark.net/feed/` ← **Import AI**

**General tech and AI press**

- `https://techcrunch.com/category/artificial-intelligence/feed/`
- `https://technologyreview.com/feed/`
- `https://hnrss.org/frontpage?count=30`
- `https://feeds.arstechnica.com/arstechnica/technology-lab`
- `https://theverge.com/rss/tech/index.xml`
- `https://venturebeat.com/category/ai/feed/`

Anthropic does not publish a general news RSS feed, so Anthropic company news arrives through the press and analysis feeds above rather than a primary source. Treat well-sourced Anthropic coverage from those feeds as first-class, not as second-tier reporting.

If a feed fails to fetch or returns nothing in the window, continue with the rest and note the skipped feed in the run summary. A single unavailable feed must never abort the digest.

For each entry capture: **title**, **URL**, **source name**, **published date**, **RSS categories/product metadata**, and a **plain-text excerpt**.

Before curation, deduplicate entries across all feeds:
- Normalize each URL by lowercasing the host and removing fragments, tracking parameters, and trailing slashes.
- Treat matching normalized URLs as the same story.
- When URLs differ or are missing, use a normalized title match as a fallback.
- Assign source from the canonical article origin, not from the feed that exposed it. The Microsoft Developer feed republishes GitHub entries, and the two GitHub feeds overlap with each other; in every case keep one copy and label it by where the article actually lives:
  - URL host `github.blog` with a path starting `/changelog/` → **GitHub Changelog**
  - URL host `github.blog`, any other path → **GitHub Blog**
  - Anything else surfaced by the Microsoft Developer feed → **Microsoft Developer**
  - A card whose URL host is `github.blog` must never use **Microsoft Developer** as its source.
- Every selected story must link to its exact article or changelog entry. Never substitute a publisher homepage or root URL (for example, `https://arstechnica.com/`) when the article URL is unavailable; omit that candidate instead.
- The Claude Code feed publishes a release per patch, often several per day. Never emit one card per version. Collapse the whole window into **at most 2 cards** that summarize the notable user-facing changes across those releases, and link to the most significant single release. Ignore releases whose notes are only dependency bumps or internal fixes. Apply the same collapsing rule to any other feed that publishes routine per-version releases.
- When a lab's own announcement and a press write-up cover the same news, keep the primary source as the card and treat the press piece as redundant.

## Step 2 — Curate

Select **up to 30 unique, important, and impactful stories**. Do not pad the digest with weak or out-of-window entries when fewer than 30 qualify.

The goal is a **landscape view of AI**, not a single vendor's release notes. Rank candidates purely on how much they matter to someone building with AI, then apply the balance rules below to stop any one vendor or outlet from dominating.

### Coverage buckets

Assign every candidate to exactly one bucket. Use these names verbatim; they are the values that end up in `data-bucket` and in the filter chips.

- **`Models & Research`** — frontier model releases, capability jumps, notable papers and evaluations.
- **`AI Coding Tools`** — Claude Code, GitHub Copilot, OpenAI Codex, Cursor, and comparable agentic developer tools, open or closed.
- **`Platform & APIs`** — changelog-style updates to developer platforms and cloud AI services.
- **`AI Engineering`** — techniques, architectures, retrospectives, and analysis about building real systems.
- **`Industry & Policy`** — funding, competitive moves, regulation, safety and governance.

### Balance rules (hard)

- **At most 5 stories from any single source.**
- **At most 8 stories from any single vendor ecosystem**, counting a vendor's own channels together. GitHub Changelog, GitHub Blog, and Microsoft Developer count as one Microsoft/GitHub ecosystem; OpenAI's own posts count as one; Google's count as one.
- **No bucket may exceed 12 stories.** `Models & Research`, `AI Coding Tools`, and `Industry & Policy` should each contribute at least 3 when qualifying entries exist.
- Aim for **at least 4 distinct vendors or labs** represented across `Models & Research` and `AI Coding Tools`.

If a rule cannot be met because the window genuinely lacks qualifying entries, drop the weakest constraint rather than padding with filler, and note which constraint you relaxed in the run summary.

### Tie-breakers

When two candidates are close, prefer in this order:
1. Primary sources over secondary reporting of the same news.
2. Stories a practitioner could act on this week over pure speculation.
3. Coverage that fills an under-represented bucket or vendor over one that repeats a well-covered angle.

For each selected story, write:
- **TL;DR** — 2 concise sentences with the key facts
- **Why it matters** — 1 sentence on real-world impact
- **Importance** — exactly one of `High`, `Medium`, or `Low`, based on this rubric:
  - `High`: broad developer impact, urgent security or migration implications, a major platform/tooling change, or immediate action required.
  - `Medium`: a meaningful product, API, framework, research, or ecosystem change relevant to a substantial developer segment.
  - `Low`: a narrower announcement, regional availability update, incremental enhancement, or informational change with limited immediate action.
- **Bucket** — exactly one of `Models & Research`, `AI Coding Tools`, `Platform & APIs`, `AI Engineering`, `Industry & Policy`
- **Tags** — 2–5 tags chosen only from: `AI`, `LLMs`, `Models`, `Agents`, `Coding Agents`, `Evals`, `Safety`, `Open Source`, `Security`, `Cloud`, `Infrastructure`, `Anthropic`, `OpenAI`, `Google`, `GitHub`, `Microsoft`, `Azure`, `.NET`, `DevOps`, `APIs`, `Databases`, `Data`, `Web`, `Mobile`, `Enterprise`, `Productivity`, `Developer Experience`, `Startups`, `Research`, `Tools`, `Policy`

Vendor tags (`Anthropic`, `OpenAI`, `Google`, `GitHub`, `Microsoft`) are for identifying who the story is about. Apply them accurately, including on stories from press feeds, so readers can filter by the vendors they care about.

Also produce a separate **AI coding tools highlights set**:
- Exactly 5 concise bullets for a top-page section named **"TL;DR — AI coding tools"**
- These 5 bullets must be derived only from stories in the `AI Coding Tools` bucket, spanning whichever vendors shipped that period rather than defaulting to one. If fewer than 5 qualify, write fewer bullets rather than filling the gap from other buckets.

## Step 3 — Generate Page

Read the reference design from `docs/template.html` to understand the visual style, then write a **complete, self-contained HTML5 file** to `docs/index.html`.

Requirements:
- Dark GitHub-themed design — background `#0d1117`, cards `#161b22`, accent `#58a6ff`
- **No external dependencies** — all CSS inline in a `<style>` block; no CDN links
- Header with "Weekly AI & Tech News" title, current week date range, and story count
- Add a **"TL;DR — Top takeaways" section at the top** (above the story list) with exactly 5 concise bullets summarizing the week
- Implement **theme modes**: `system` (default), `light`, and `dark`; include a visible theme selector and persist user choice in `localStorage`
- Implement **filters**:
  - Source filter chips (e.g., OpenAI, Google DeepMind, Claude Code, GitHub Changelog, Microsoft Developer, Simon Willison, TechCrunch, etc.) with multi-select support
  - Source filter must default to **all sources selected** on first load, so the landing view is the full landscape rather than one vendor
  - Bucket filter chips for `Models & Research`, `AI Coding Tools`, `Platform & APIs`, `AI Engineering`, and `Industry & Policy`
  - Free-text keyword search that filters stories by title, source, TL;DR, why-it-matters text, importance, bucket, and tags
  - Label/tag filter chips that can be toggled (multi-select)
  - Importance filter chips for `Low`, `Medium`, and `High`
  - Visible active-filter summary and a **Clear all** control that restores the default state: search emptied, all source chips selected, no bucket/tag/importance filters active, sorting back to curated rank, and every story visible
  - Display "Showing X of Y stories" based on active filters, where Y is the actual generated story count
- Implement **sorting** for curated rank, importance high-to-low, importance low-to-high, newest, and oldest
- Up to 30 ranked story cards, each showing: numbered badge, source icon + name, linked title, accessible low-to-high importance icon plus visible importance label, bucket label, TL;DR paragraph, "💡 Why it matters" callout, tag chips, publication date, "Read full story →" link
- Each card must include machine-readable `data-rank`, `data-published` (ISO date), `data-source`, `data-bucket`, `data-tags`, and `data-importance` attributes for filtering and sorting
- Stats bar showing story count plus breakdowns by bucket and by source
- Footer: "Generated by [GitHub Agentic Workflows](https://github.github.com/gh-aw/) · Source: [JDetmar/weekly-ai-news-digest](https://github.com/JDetmar/weekly-ai-news-digest) · Deployed via GitHub Pages"
- Fully responsive for mobile

## Step 4 — Mandatory Preflight

Before writing `docs/index.html`, validate the final data and client behavior. Fix every failure instead of publishing a partial or non-compliant page:

- The page contains between 1 and 30 story cards.
- Canonical article URLs are unique, normalized titles are unique, and no story URL is only a site homepage/root path.
- No single source exceeds 5 cards, and no single vendor ecosystem exceeds 8.
- No bucket exceeds 12 cards, and every bucket present in the data has a working filter chip.
- At most 2 cards summarize Claude Code releases, and no card is a bare per-version release note.
- Every `github.blog` story is labeled **GitHub Changelog** or **GitHub Blog**; **Microsoft Developer** is used only for non-GitHub entries discovered through the Microsoft Developer feed.
- Every card has exactly one `High`, `Medium`, or `Low` importance, exactly one bucket, and 2–5 tags from the controlled taxonomy.
- Every card has non-empty `data-rank`, `data-published`, `data-source`, `data-bucket`, `data-tags`, `data-importance`, and `data-search` attributes.
- Search includes title, source, TL;DR, why-it-matters, importance, bucket, and tags.
- Source, bucket, tag, and importance controls cover every distinct value present in the cards.
- Every source filter chip is selected on first load.
- The **Clear all** handler restores the default state: search emptied, all source chips selected, bucket/tag/importance chips deactivated, sorting reset to curated rank, and every story visible.
- Sorting and filtering update the visible result count without changing the original curated rank badges.

The output file `docs/index.html` must be a valid, complete HTML document that renders correctly in a browser with no external resources.
