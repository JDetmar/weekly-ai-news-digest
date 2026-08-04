# Weekly AI News Digest

> **An agentic digest of AI and technology news, generated daily with [GitHub Agentic Workflows](https://github.github.com/gh-aw/).**

[![Weekly Digest](https://github.com/JDetmar/weekly-ai-news-digest/actions/workflows/weekly-news-digest.lock.yml/badge.svg)](https://github.com/JDetmar/weekly-ai-news-digest/actions/workflows/weekly-news-digest.lock.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

This is a fork of [elbruno/weekly-ai-news-digest](https://github.com/elbruno/weekly-ai-news-digest), kept as a working example for learning gh-aw.
The author's blog post, illustrations, and personal tooling have been removed so that what remains is the workflow itself.

## How It Works

```text
GitHub Agentic Workflows (daily)
  -> Research 16 feeds plus the Anthropic blog from the last 14 days
  -> Deduplicate and curate up to 30 stories, balanced across the AI landscape
  -> Write docs/index.html
  -> Create a scoped safe-outputs pull request
  -> Auto-merge the digest PR (optional, see below)
  -> Deploy docs/ with GitHub Pages
```

The agent runs in a sandboxed container with read-only repository permissions and an explicit outbound network allowlist.
It researches the approved sources and writes its output to the workspace, but it never pushes to the repository.
A separate `safe_outputs` job with its own permissions opens the pull request after threat detection runs.

## The gh-aw Parts

Everything specific to GitHub Agentic Workflows lives in `.github/`:

| Path | Role |
| --- | --- |
| `workflows/weekly-news-digest.md` | The source of truth, and the only file you normally edit. YAML frontmatter declares triggers, permissions, the network allowlist, and safe outputs; the Markdown body is the agent's prompt. |
| `workflows/weekly-news-digest.lock.yml` | Compiled output of `gh aw compile`. Generated, do not hand-edit. |
| `workflows/agent-cost-tracker.md` | A second agentic workflow. Finds the most recent digest run, reads the token accounting gh-aw records, and reports what it cost. A useful contrast with the digest: its safe outputs are a comment and an issue rather than a pull request. |
| `aw/actions-lock.json` | Pinned SHAs for the actions the compiler emits. |
| `mcp.json` | Wires `gh aw mcp-server` into your editor's agent so it can compile, audit, and read run logs. |
| `agents/`, `skills/` | Authoring helpers shipped by gh-aw for designing and debugging workflows. |
| `workflows/copilot-setup-steps.yml` | Installs the gh-aw CLI for the GitHub Copilot coding agent. |

The two remaining workflows are ordinary, non-agentic Actions.
`deploy-pages.yml` publishes `docs/` to GitHub Pages.
`auto-merge-digest.yml` squash-merges any open PR labeled `digest` once a digest run succeeds, resolving conflicts in favor of the PR's `docs/index.html`.
That second one removes the human review step that the pull request exists to provide, so consider disabling it while you are still learning what the agent produces.

## Cost Tracking

[`agent-cost-tracker.md`](.github/workflows/agent-cost-tracker.md) runs after each digest and reports what the run cost.
It is adapted from the [githubnext/agentics cost-tracker](https://github.com/githubnext/agentics/blob/main/workflows/cost-tracker.md), rewritten against the artifact layout this repository's gh-aw version actually produces.

gh-aw's firewall sits between the agent and the model API, so it records every request's token counts.
Those land in an artifact named `usage`, alongside an `agent_usage.json` aggregate:

```json
{"input_tokens":4728,"output_tokens":15780,"cache_read_tokens":274209,
 "cache_write_tokens":52715,"ai_credits":51.664,"primary_model":"claude-sonnet-4.6"}
```

`ai_credits` is the actual billed figure in Copilot premium request credits, so the tracker reports it as the headline number.
It also computes a dollar estimate at published per-token API rates, which is useful for comparing runs but is not what you are charged.
The report goes on the digest pull request as a comment, or into an issue when there is no pull request to comment on.
A second issue opens if a run exceeds 100 credits, roughly 2x an observed normal run.

Two things worth understanding:

- **The dollar figure is an estimate, not an invoice.** Credits are the real unit here. The estimate exists to compare runs against published API rates, nothing more.
- **The pricing table only covers Claude models.** The Copilot engine can serve GPT and Gemini models too. Rather than apply a fallback rate and produce an authoritative-looking wrong number, the tracker reports any unpriced model's token counts separately and excludes it from the total.

The tracker runs on a daily schedule at 11:00 UTC rather than on `workflow_run` after the digest.
That is a workaround, not a preference: gh-aw compiles a fixed activation guard for `workflow_run` triggers that includes `!(github.event.workflow_run.repository.fork)`, and this repository is a fork, so every job was silently skipped.
The schedule sidesteps the guard, at the cost of having to find the run itself and avoid reporting the same run twice on days the digest did not run.

Both of those, and every other GitHub read, happen in a frontmatter `steps:` block rather than in the prompt.
That is not a stylistic choice: **the `gh` CLI is not authenticated inside the agent sandbox**, so `gh` there fails with exit code 4.
`steps:` runs on the runner, where the token exists, and leaves compact JSON under `/tmp/gh-aw/data/` for the agent to read.
It is worth internalizing early, because an unauthenticated `gh` inside the sandbox fails in a way that looks like an ordinary empty result.

If the tracker finds no usage data, or the run it found was already reported, it produces no output at all.

## Customizing the Workflow

Edit [`.github/workflows/weekly-news-digest.md`](.github/workflows/weekly-news-digest.md) to change the prompt.
Any change to the frontmatter or the body requires a recompile:

```bash
gh extension install github/gh-aw
gh aw compile .github/workflows/weekly-news-digest.md
```

Commit both the Markdown definition and the regenerated `.lock.yml`.
The compiler stores hashes of the frontmatter and body in the lock file, so a stale lock file is detected rather than silently ignored.

## Running It In Your Own Fork

A few things are not inherited when you fork this repository:

- Scheduled workflows are disabled on new forks. Enable them from the Actions tab.
- **Settings > Actions > General > "Allow GitHub Actions to create and approve pull requests" must be checked.** Without it the agent researches, writes the digest, passes threat detection, and then fails on the very last step with `GitHub Actions is not permitted to create or approve pull requests`. The whole run is wasted.
- **Issues must be enabled**, which they are not by default on a fork. Both workflows fall back to opening an issue when they cannot create or comment on a pull request, and that fallback fails silently-ish otherwise.
- GitHub Pages needs to be enabled in repository settings with **GitHub Actions** as the source.
- The workflow declares no `engine:`, so it defaults to the Copilot engine and consumes your Copilot entitlement on every run. The `copilot-requests: write` permission in the frontmatter is what grants it.
- The schedule is a daily cron at 10:00 UTC. GitHub disables scheduled workflows in repositories with no activity for 60 days.

You can always trigger a run by hand from [Actions](../../actions/workflows/weekly-news-digest.lock.yml) instead of waiting for the schedule.

## What the Digest Includes

- A landscape view of AI rather than one vendor's release notes, spanning model labs, coding agents, platform changes, engineering practice, and industry news.
- Cross-feed deduplication, primary sources preferred over secondary reporting of the same news.
- A "TL;DR — AI coding tools" highlights section covering whichever vendors shipped that period.
- Concise summaries, developer impact notes, and Low/Medium/High importance indicators for every story.
- Source, coverage-area, tag, and importance filters; rank/importance/date sorting; a clear-all control; full-text search; and a responsive dark, light, or system theme.
- Every source selected on first load, so the landing view is the whole landscape.

### Coverage Buckets

Every story is assigned exactly one bucket, and the curation rules stop any one bucket or vendor from taking over a week's page.

| Bucket | What lands here |
| --- | --- |
| Models & Research | Frontier model releases, capability jumps, notable papers and evaluations |
| AI Coding Tools | Claude Code, GitHub Copilot, OpenAI Codex, Cursor, and comparable agentic developer tools |
| Platform & APIs | Changelog-style updates to developer platforms and cloud AI services |
| AI Engineering | Techniques, architectures, retrospectives, and analysis about building real systems |
| Industry & Policy | Funding, competitive moves, regulation, safety and governance |

The balance rules are at most 5 stories per source, at most 8 per vendor ecosystem (GitHub Changelog, GitHub Blog, and Microsoft Developer count as one), and at most 12 per bucket.
Tune those numbers in `.github/workflows/weekly-news-digest.md` under **Balance rules**.

### News Sources

| Source | Feed | Bucket bias |
| --- | --- | --- |
| Anthropic | `claude.com/blog` (HTML, no feed exists) | Models & Research |
| OpenAI | `openai.com/news/rss.xml` | Models & Research |
| Google DeepMind | `blog.google/innovation-and-ai/models-and-research/google-deepmind/rss/` | Models & Research |
| Mistral AI | `mistral.ai/rss.xml` | Models & Research |
| Claude Code | `github.com/anthropics/claude-code/releases.atom` | AI Coding Tools |
| GitHub Changelog | `github.blog/changelog/feed/` | Platform & APIs |
| GitHub Blog | `github.blog/feed/` | AI Coding Tools |
| Microsoft Developer Changelog | `developer.microsoft.com/api/changelog/rss` | Platform & APIs |
| Simon Willison | `simonwillison.net/atom/everything/` | AI Engineering |
| Latent Space | `www.latent.space/feed` | AI Engineering |
| Import AI | `jack-clark.net/feed/` | Industry & Policy |
| TechCrunch AI | `techcrunch.com/category/artificial-intelligence/feed/` | Industry & Policy |
| MIT Technology Review | `technologyreview.com/feed/` | Industry & Policy |
| Hacker News | `hnrss.org/frontpage` | mixed |
| Ars Technica | `feeds.arstechnica.com/arstechnica/technology-lab` | mixed |
| The Verge | `theverge.com/rss/tech/index.xml` | mixed |
| VentureBeat AI | `venturebeat.com/category/ai/feed/` | mixed |

Anthropic publishes no RSS or Atom feed anywhere, and its sitemap carries no `lastmod`, so there is no machine-readable way to window its posts.
`claude.com/blog` is therefore the one **scraped** source: it is server-rendered, returns `200` to a plain non-browser client, allows everything in `robots.txt`, and puts each post's title, date, and link in dedicated `fs-list-field` attributes.
That makes it parseable, but it is markup rather than a contract, so the prompt tells the agent to skip the source and note it in the run summary if those attributes disappear, rather than guessing at dates.
`anthropic.com/news` and `anthropic.com/engineering` were evaluated and rejected: both list articles but expose no publish dates, so the 14-day window cannot be applied without fetching every article.

The Claude Code release feed covers the tool itself; the prompt collapses a window of patch releases into at most two cards so version bumps cannot flood the page.
Anthropic and Claude Code count as one vendor ecosystem for the balance rules.

Two feeds were evaluated and left out because they return `403` to non-browser clients and would fail from the Actions runner: Google DeepMind's own `deepmind.google/blog/rss.xml` (covered instead via `blog.google`) and `huggingface.co/blog/feed.xml`.

Adding a source means editing two places in the workflow Markdown: the source list in the prompt body, and the `network.allowed` list in the frontmatter.
The sandbox blocks any domain that is not on that allowlist, so a feed added only to the prompt will fail to fetch.
Check the feed's final URL after redirects and allowlist that exact host, since subdomains are not covered implicitly.

## Project Structure

```text
weekly-ai-news-digest/
├── .github/
│   ├── agents/agentic-workflows.md            # gh-aw authoring agent
│   ├── skills/                                # gh-aw authoring skills
│   ├── aw/actions-lock.json                   # Pinned action SHAs
│   ├── mcp.json                               # gh aw mcp-server for editor agents
│   ├── workflows/weekly-news-digest.md        # Workflow prompt and frontmatter
│   ├── workflows/weekly-news-digest.lock.yml  # Compiled workflow
│   ├── workflows/agent-cost-tracker.md        # Cost tracker prompt and frontmatter
│   ├── workflows/agent-cost-tracker.lock.yml  # Compiled cost tracker
│   ├── workflows/auto-merge-digest.yml        # Digest PR auto-merge
│   ├── workflows/copilot-setup-steps.yml      # gh-aw CLI for Copilot agent
│   └── workflows/deploy-pages.yml             # GitHub Pages deploy
├── docs/
│   ├── index.html                             # Generated digest site
│   └── template.html                          # Reference design read by the agent
├── scripts/
│   ├── template-filters.test.mjs              # Filter/sort regression test
│   └── check-anthropic-blog.mjs               # Verifies the scraped Anthropic source
├── package.json                               # Test harness only
└── README.md
```

`docs/template.html` is not used by any build step.
The prompt instructs the agent to read it as a style reference before writing `docs/index.html`, which makes it a useful example of steering an agent with a file instead of with more prose.

### Testing the template

The template carries the real filter, search, and sort JavaScript that the generated page inherits, so it is worth guarding.

```bash
npm install
npm test
```

The test renders `docs/template.html` into a concrete page the way the agent would, loads it in jsdom, and drives the actual controls: default selection, source and bucket filters, search, clear-all, and sorting.
It is not wired into CI yet, so run it after editing the template.

`claude.com/blog` is the one scraped source, and scraped markup breaks silently.
If a digest run drops Anthropic entirely, check whether the page layout moved:

```bash
npm run check:anthropic-blog
```

That script is network-dependent and deliberately excluded from `npm test`.
It re-runs the exact extraction rule the prompt describes and tells you to update or drop the source if the attributes are gone.

## License

[MIT](LICENSE) © [El Bruno](https://github.com/elbruno).
The original copyright notice is retained as the license requires.
