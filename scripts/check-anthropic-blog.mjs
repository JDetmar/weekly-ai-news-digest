// Verifies the claude.com/blog scraping rule in .github/workflows/weekly-news-digest.md
// still holds. Anthropic publishes no RSS/Atom feed and its sitemap has no lastmod, so
// that page is the only machine-windowable primary source for Anthropic news - and it is
// markup, not a contract. Run this after any digest run that silently dropped Anthropic.
//
// Network-dependent, so deliberately NOT part of `npm test`.
//   node scripts/check-anthropic-blog.mjs

const URL_INDEX = "https://claude.com/blog";
const WINDOW_DAYS = 14;

const res = await fetch(URL_INDEX, { redirect: "follow" });
if (!res.ok) {
  console.error(`FAIL  ${URL_INDEX} returned ${res.status}`);
  process.exit(1);
}
const html = await res.text();

// Each card keeps heading + date together in one block, then the link. Pairing a title
// with the *nearest following* date is off by one and silently misdates every entry.
const CARD = new RegExp(
  'fs-list-field="heading">(?<title>[^<]+)</div>[\\s\\S]*?' +
    'fs-list-field="date">(?<date>[^<]+)</div>[\\s\\S]*?' +
    'href="(?<slug>/blog/[a-z0-9-]+)"',
  "g",
);

const seen = new Set();
const posts = [];
for (const m of html.matchAll(CARD)) {
  const { title, date, slug } = m.groups;
  if (seen.has(slug)) continue;
  seen.add(slug);
  const published = new Date(date.trim());
  if (Number.isNaN(published.valueOf())) continue;
  posts.push({ title: title.trim(), slug, published });
}

const cutoff = new Date(Date.now() - WINDOW_DAYS * 86400000);
const inWindow = posts.filter((p) => p.published >= cutoff);

let failures = 0;
const check = (name, cond, detail = "") => {
  console.log(`  ${cond ? "PASS" : "FAIL"}  ${name}${detail ? `  ${detail}` : ""}`);
  if (!cond) failures++;
};

console.log(`\nAnthropic blog extraction (${URL_INDEX})`);
check("page is server-rendered with card attributes", html.includes('fs-list-field="date"'));
check("at least 5 cards parse into title + date + link", posts.length >= 5, `got ${posts.length}`);
check("every parsed card links to a real /blog/<slug>", posts.every((p) => /^\/blog\/[a-z0-9-]+$/.test(p.slug)));
check("every parsed card has a usable title", posts.every((p) => p.title.length > 3));
check(`at least 1 post inside the ${WINDOW_DAYS}-day window`, inWindow.length >= 1, `got ${inWindow.length}`);

if (inWindow.length) {
  console.log(`\n  ${inWindow.length} post(s) in window, most recent first:`);
  for (const p of inWindow.sort((a, b) => b.published - a.published).slice(0, 5)) {
    console.log(`    ${p.published.toISOString().slice(0, 10)}  ${p.title.slice(0, 62)}`);
  }
}

console.log(
  failures === 0
    ? "\nOK - the scraping rule in weekly-news-digest.md still matches the live page.\n"
    : `\n${failures} check(s) failed - the page layout likely changed. Update the HTML sources\n` +
        "section of .github/workflows/weekly-news-digest.md, or drop the source.\n",
);
process.exit(failures === 0 ? 0 : 1);
