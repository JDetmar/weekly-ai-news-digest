# Weekly AI News Digest

> **An agentic digest of AI and technology news, generated daily with [GitHub Agentic Workflows](https://github.github.com/gh-aw/).**

[![Weekly Digest](https://github.com/JDetmar/weekly-ai-news-digest/actions/workflows/weekly-news-digest.lock.yml/badge.svg)](https://github.com/JDetmar/weekly-ai-news-digest/actions/workflows/weekly-news-digest.lock.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

This is a fork of [elbruno/weekly-ai-news-digest](https://github.com/elbruno/weekly-ai-news-digest), kept as a working example for learning gh-aw.
The author's blog post, illustrations, and personal tooling have been removed so that what remains is the workflow itself.

## How It Works

```text
GitHub Agentic Workflows (daily)
  -> Research seven RSS feeds from the last 14 days
  -> Curate 15 developer-relevant stories
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
| `workflows/agent-cost-tracker.md` | A second agentic workflow. Fires on `workflow_run` after a digest completes, reads the token accounting gh-aw records, and posts an estimated cost. A useful contrast with the digest: it is triggered by another workflow rather than a schedule, and its safe outputs are a comment and an issue rather than a pull request. |
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
Those land in an artifact named `usage`, as `agent/token_usage.jsonl` for the digest agent and `detection/token_usage.jsonl` for the separate threat-detection pass that inspects the agent's output before the pull request is created.
The tracker reads both, multiplies by published per-token rates, and comments the total on the digest pull request (or opens an issue if it cannot find one).
It opens a second issue if a run exceeds $1.00, which is deliberately low for a digest that should cost cents.

Two caveats worth understanding before trusting the number:

- **It is an estimate, not an invoice.** This repository runs the Copilot engine, which bills as Copilot premium requests rather than per token. The dollar figure is a good proxy for relative cost between runs and is not what you are charged.
- **The pricing table only covers Claude models.** The Copilot engine can serve GPT and Gemini models too. Rather than apply a fallback rate and produce an authoritative-looking wrong number, the tracker reports any unpriced model's token counts separately and excludes it from the total.

If the tracker finds no usage data it produces no output at all, so it stays quiet rather than opening an empty issue every day.

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
- GitHub Pages needs to be enabled in repository settings with **GitHub Actions** as the source.
- The workflow declares no `engine:`, so it defaults to the Copilot engine and consumes your Copilot entitlement on every run. The `copilot-requests: write` permission in the frontmatter is what grants it.
- The schedule is a daily cron at 10:00 UTC. GitHub disables scheduled workflows in repositories with no activity for 60 days.

You can always trigger a run by hand from [Actions](../../actions/workflows/weekly-news-digest.lock.yml) instead of waiting for the schedule.

## What the Digest Includes

- A GitHub-first selection of AI and developer-platform news.
- A GitHub-only TL;DR highlights section.
- Concise summaries and developer impact notes for every story.
- Source and tag filters, full-text search, and a responsive dark, light, or system theme.

### News Sources

| Source | Feed |
| --- | --- |
| GitHub Changelog | `github.blog/changelog/feed/` |
| TechCrunch AI | `techcrunch.com/category/artificial-intelligence/feed/` |
| MIT Technology Review | `technologyreview.com/feed/` |
| Hacker News | `hnrss.org/frontpage` |
| Ars Technica | `feeds.arstechnica.com/arstechnica/technology-lab` |
| The Verge | `theverge.com/rss/tech/index.xml` |
| VentureBeat AI | `venturebeat.com/category/ai/feed/` |

Adding a source means editing two places in the workflow Markdown: the feed list in the prompt body, and the `network.allowed` list in the frontmatter.
The sandbox blocks any domain that is not on that allowlist, so a feed added only to the prompt will fail to fetch.

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
└── README.md
```

`docs/template.html` is not used by any build step.
The prompt instructs the agent to read it as a style reference before writing `docs/index.html`, which makes it a useful example of steering an agent with a file instead of with more prose.

## License

[MIT](LICENSE) © [El Bruno](https://github.com/elbruno).
The original copyright notice is retained as the license requires.
