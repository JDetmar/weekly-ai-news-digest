// Verifies the claude.com/blog extraction rule in .github/workflows/weekly-news-digest.md
// still holds. Anthropic publishes no RSS/Atom feed for its full post stream, so that
// page is the only machine-windowable primary source for Anthropic news - and its
// embedded page data is not a contract. Run this after any digest run that silently
// dropped Anthropic.
//
// Network-dependent, so deliberately NOT part of `npm test`.
//   node scripts/check-anthropic-blog.mjs

const URL_INDEX = "https://claude.com/blog";
const WINDOW_DAYS = 14;
const MAX_PAGES = 5;

// The post list is rendered client-side from Next.js flight data: JSON string literals
// passed to self.__next_f.push([1, "..."]). Decode and concatenate them in order.
function flightData(html) {
  let text = "";
  for (const m of html.matchAll(/self\.__next_f\.push\(\[1,("(?:[^"\\]|\\.)*")\]\)/g)) {
    text += JSON.parse(m[1]);
  }
  return text;
}

// Returns the end index of the JSON array or object starting at `start`.
function jsonEnd(text, start) {
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = start; i < text.length; i++) {
    const c = text[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (c === "\\") escaped = true;
      else if (c === '"') inString = false;
    } else if (c === '"') inString = true;
    else if (c === "[" || c === "{") depth++;
    else if ((c === "]" || c === "}") && --depth === 0) return i + 1;
  }
  return -1;
}

function blogPosts(flight) {
  const posts = [];
  const marker = '"items":';
  for (let i = flight.indexOf(marker); i !== -1; i = flight.indexOf(marker, i + 1)) {
    const start = i + marker.length;
    if (flight[start] !== "[") continue;
    const end = jsonEnd(flight, start);
    if (end === -1) continue;
    let items;
    try {
      items = JSON.parse(flight.slice(start, end));
    } catch {
      continue;
    }
    for (const it of items) {
      if (it?._type !== "blogPost") continue;
      posts.push({
        title: (it.title ?? "").trim(),
        date: it.date ?? "",
        url: it.slug ? `${URL_INDEX}/${it.slug}` : (it.externalUrl ?? ""),
      });
    }
  }
  return posts;
}

const cutoff = new Date(Date.now() - WINDOW_DAYS * 86400000).toISOString().slice(0, 10);
const byUrl = new Map();
let pagesFetched = 0;
let firstPageParsed = 0;

for (let page = 1; page <= MAX_PAGES; page++) {
  const url = page === 1 ? URL_INDEX : `${URL_INDEX}?page=${page}`;
  const res = await fetch(url, { redirect: "follow" });
  if (!res.ok) {
    console.error(`FAIL  ${url} returned ${res.status}`);
    process.exit(1);
  }
  const posts = blogPosts(flightData(await res.text()));
  pagesFetched++;
  if (page === 1) firstPageParsed = posts.length;
  for (const p of posts) if (p.url && !byUrl.has(p.url)) byUrl.set(p.url, p);
  const oldest = [...byUrl.values()].map((p) => p.date).sort()[0];
  if (!posts.length || (oldest && oldest < cutoff)) break;
}

const posts = [...byUrl.values()];
const inWindow = posts.filter((p) => p.date >= cutoff);
const oldest = posts.map((p) => p.date).sort()[0] ?? "none";

let failures = 0;
const check = (name, cond, detail = "") => {
  console.log(`  ${cond ? "PASS" : "FAIL"}  ${name}${detail ? `  ${detail}` : ""}`);
  if (!cond) failures++;
};

console.log(`\nAnthropic blog extraction (${URL_INDEX}, ${pagesFetched} page(s))`);
check("first page embeds blogPost objects", firstPageParsed > 0, `got ${firstPageParsed}`);
check("at least 5 distinct posts parse", posts.length >= 5, `got ${posts.length}`);
check("every post has an ISO date", posts.every((p) => /^\d{4}-\d{2}-\d{2}$/.test(p.date)));
check(
  "every post links to an article, not the index",
  posts.every((p) => /^https:\/\/[^/]+\/.+/.test(p.url) && p.url !== `${URL_INDEX}/`),
);
check("every post has a usable title", posts.every((p) => p.title.length > 3));
check(`paging reaches past the ${WINDOW_DAYS}-day window`, oldest < cutoff, `oldest ${oldest}`);
check(`at least 1 post inside the ${WINDOW_DAYS}-day window`, inWindow.length >= 1, `got ${inWindow.length}`);

if (inWindow.length) {
  console.log(`\n  ${inWindow.length} post(s) in window, most recent first:`);
  for (const p of inWindow.sort((a, b) => b.date.localeCompare(a.date)).slice(0, 8)) {
    console.log(`    ${p.date}  ${p.title.slice(0, 62)}`);
  }
}

console.log(
  failures === 0
    ? "\nOK - the extraction rule in weekly-news-digest.md still matches the live page.\n"
    : `\n${failures} check(s) failed - the page data likely changed. Update the HTML sources\n` +
        "section of .github/workflows/weekly-news-digest.md, or drop the source.\n",
);
process.exit(failures === 0 ? 0 : 1);
