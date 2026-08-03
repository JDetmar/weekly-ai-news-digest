// Renders docs/template.html into a concrete page the way the agent would
// (Jinja loops replaced with real cards), then drives the real filter JS in jsdom.
import { readFileSync } from "node:fs";
import { JSDOM } from "jsdom";

const tpl = readFileSync(process.argv[2] || new URL("../docs/template.html", import.meta.url), "utf8");

const STORIES = [
  { t: "Claude Code ships subagents", s: "Claude Code",         b: "AI Coding Tools",   i: "High",   tags: ["AI", "Coding Agents", "Anthropic"], d: "2026-08-01" },
  { t: "GPT-5.6 released",            s: "OpenAI",              b: "Models & Research", i: "High",   tags: ["AI", "Models", "OpenAI"],           d: "2026-07-30" },
  { t: "Gemini Robotics ER 2",        s: "Google DeepMind",     b: "Models & Research", i: "Medium", tags: ["AI", "Models", "Google"],           d: "2026-07-29" },
  { t: "Copilot code review GA",      s: "GitHub Changelog",    b: "AI Coding Tools",   i: "Medium", tags: ["GitHub", "Coding Agents"],          d: "2026-07-28" },
  { t: "Azure AI Foundry update",     s: "Microsoft Developer", b: "Platform & APIs",   i: "Low",    tags: ["Azure", "Cloud", "Microsoft"],      d: "2026-07-27" },
  { t: "On evals that matter",        s: "Simon Willison",      b: "AI Engineering",    i: "Medium", tags: ["AI", "Evals"],                      d: "2026-07-26" },
  { t: "EU AI Act phase 2",           s: "TechCrunch",          b: "Industry & Policy", i: "High",   tags: ["Policy", "AI"],                     d: "2026-07-25" },
];

const card = (st, idx) => `
  <article class="story-card"
    data-rank="${idx + 1}"
    data-published="${st.d}"
    data-tags="${st.tags.join(",")}"
    data-source="${st.s}"
    data-bucket="${st.b}"
    data-importance="${st.i}"
    data-search="${st.t} ${st.s} ${st.b} ${st.i} tldr text why it matters ${st.tags.join(" ")}">
    <div class="story-head"><div class="rank">${idx + 1}</div><div>
      <div class="story-meta-line">
        <div class="source">${st.s}</div>
        <div class="bucket">${st.b}</div>
        <div class="importance importance-${st.i.toLowerCase()}"><span>${st.i}</span></div>
      </div>
      <div class="title"><a href="https://example.com/${idx}">${st.t}</a></div>
    </div></div>
  </article>`;

// Replace the Jinja story loop with concrete cards, stats loops with concrete stats.
let html = tpl.replace(
  /\{%\s*for story in stories\s*%\}[\s\S]*?\{%\s*endfor\s*%\}/,
  STORIES.map(card).join("\n"),
);
const tally = (key) => {
  const m = {};
  STORIES.forEach((s) => { m[s[key]] = (m[s[key]] || 0) + 1; });
  return Object.entries(m).map(([k, v]) => `<div class="stat">${v} ${k}</div>`).join("");
};
html = html
  .replace(/\{%\s*for bucket, count in buckets\.items\(\)\s*%\}[\s\S]*?\{%\s*endfor\s*%\}/, tally("b"))
  .replace(/\{%\s*for source, count in sources\.items\(\)\s*%\}[\s\S]*?\{%\s*endfor\s*%\}/, tally("s"))
  .replace(/\{\{[^}]*\}\}/g, "sample")
  .replace(/\{%[^%]*%\}/g, "");

if (/\{\{|\{%/.test(html)) throw new Error("unrendered Jinja remains");

const dom = new JSDOM(html, {
  runScripts: "dangerously",
  pretendToBeVisual: true,
  url: "https://example.com/", // localStorage is unavailable on opaque origins
});
const { document: doc } = dom.window;

let failures = 0;
const check = (name, cond, extra = "") => {
  if (cond) { console.log(`  PASS  ${name}`); }
  else { console.log(`  FAIL  ${name} ${extra}`); failures++; }
};
const visible = () =>
  [...doc.querySelectorAll(".story-card")].filter((c) => c.style.display !== "none").length;
const chips = (id) => [...doc.querySelectorAll(`#${id} .chip`)];
const click = (el) => el.dispatchEvent(new dom.window.Event("click", { bubbles: true }));

console.log("\nDefault landing view");
const srcChips = chips("sourceFilters");
check("all 7 source chips rendered", srcChips.length === 7, `got ${srcChips.length}`);
check("every source chip active on load", srcChips.every((c) => c.classList.contains("active")),
  `inactive: ${srcChips.filter((c) => !c.classList.contains("active")).map((c) => c.textContent)}`);
check("all 7 stories visible on load", visible() === 7, `got ${visible()}`);
check('active-filter summary says "All"', /Sources: All/.test(doc.getElementById("activeFilters").textContent),
  doc.getElementById("activeFilters").textContent);
check("result line shows 7 of 7", /Showing 7 of 7/.test(doc.getElementById("resultLine").textContent),
  doc.getElementById("resultLine").textContent);

console.log("\nBucket filter");
const bChips = chips("bucketFilters");
check("5 bucket chips rendered", bChips.length === 5, `got ${bChips.length} -> ${bChips.map((c) => c.textContent)}`);
const coding = bChips.find((c) => c.textContent === "AI Coding Tools");
click(coding);
check("AI Coding Tools filters to 2", visible() === 2, `got ${visible()}`);
check("bucket appears in summary", /Buckets: AI Coding Tools/.test(doc.getElementById("activeFilters").textContent));

console.log("\nDeselecting a source");
click(srcChips.find((c) => c.textContent === "OpenAI"));
check("OpenAI chip now inactive", !srcChips.find((c) => c.textContent === "OpenAI").classList.contains("active"));
check("summary no longer says All", !/Sources: All/.test(doc.getElementById("activeFilters").textContent));

console.log("\nSearch");
click(coding); // clear bucket
doc.getElementById("searchInput").value = "gemini";
doc.getElementById("searchInput").dispatchEvent(new dom.window.Event("input", { bubbles: true }));
check("search 'gemini' matches 1", visible() === 1, `got ${visible()}`);

console.log("\nClear all restores defaults");
click(doc.getElementById("clearFilters"));
check("search emptied", doc.getElementById("searchInput").value === "");
check("all source chips active again", srcChips.every((c) => c.classList.contains("active")),
  `inactive: ${srcChips.filter((c) => !c.classList.contains("active")).map((c) => c.textContent)}`);
check("bucket chips deactivated", bChips.every((c) => !c.classList.contains("active")));
check("all 7 stories visible again", visible() === 7, `got ${visible()}`);
check("sort back to rank", doc.getElementById("sortSelect").value === "rank");
check('summary back to "All"', /Sources: All/.test(doc.getElementById("activeFilters").textContent));

console.log("\nSorting");
doc.getElementById("sortSelect").value = "newest";
doc.getElementById("sortSelect").dispatchEvent(new dom.window.Event("change", { bubbles: true }));
const order = [...doc.querySelectorAll(".story-card")].map((c) => c.dataset.published);
check("newest-first ordering", order.join() === [...order].sort().reverse().join(), order.join());
check("rank badges unchanged by sort",
  [...doc.querySelectorAll(".story-card")].every((c) => c.querySelector(".rank").textContent === c.dataset.rank));

console.log(failures === 0 ? "\nALL CHECKS PASSED\n" : `\n${failures} CHECK(S) FAILED\n`);
process.exit(failures === 0 ? 0 : 1);
