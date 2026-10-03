// Builds the static site into dist/ from data/creators.json.
// Usage: node scripts/build.mjs
import fs from "node:fs";
import path from "node:path";

const SITE_NAME = "The First Upload";
const SITE_URL = "https://thefirstupload.com";
const TAGLINE = "Where the biggest YouTubers started.";
const OUT = "dist";
const now = new Date();

const all = JSON.parse(fs.readFileSync("data/creators.json", "utf8"));
// Archived subscriber counts per year (scripts/history.mjs). Optional: pages build without it.
const history = fs.existsSync("data/history.json") ? JSON.parse(fs.readFileSync("data/history.json", "utf8")) : {};
const creators = all.filter(c => c.first?.title && c.channel?.channelId);
for (const c of all) if (!creators.includes(c)) console.warn(`Skipping ${c.name}: incomplete data (run "npm run refresh")`);

// ---------- helpers ----------
const esc = s => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const slugify = s => s.toLowerCase().replace(/&/g, "and").replace(/['’.]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const parseCount = t => {
  if (!t) return 0;
  const m = String(t).replace(/,/g, "").match(/([\d.]+)\s*([KMB])?/i);
  return m ? Number(m[1]) * ({ K: 1e3, M: 1e6, B: 1e9 }[(m[2] || "").toUpperCase()] || 1) : 0;
};
const compact = n => {
  if (n == null) return "—";
  if (n >= 1e9) return (n / 1e9).toFixed(n >= 1e10 ? 0 : 1).replace(/\.0$/, "") + "B";
  if (n >= 1e6) return (n / 1e6).toFixed(n >= 1e7 ? 0 : 1).replace(/\.0$/, "") + "M";
  if (n >= 1e3) return (n / 1e3).toFixed(n >= 1e4 ? 0 : 1).replace(/\.0$/, "") + "K";
  return String(n);
};
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const fmtDate = d => { if (!d) return null; const [y, m, day] = d.split("-").map(Number); return `${MONTHS[m - 1]} ${day}, ${y}`; };
const yearsSince = d => d ? (now - new Date(d)) / (365.25 * 864e5) : null;
const duration = s => { if (!s) return null; const h = Math.floor(s / 3600), m = Math.floor(s % 3600 / 60), sec = s % 60; return (h ? `${h}:${String(m).padStart(2, "0")}` : m) + ":" + String(sec).padStart(2, "0"); };
const thumb = (id, size = "hqdefault") => `https://i.ytimg.com/vi/${id}/${size}.jpg`;

// ---------- articles (data/articles/<slug>.md) ----------
// Front matter is "key: value" lines between --- markers; the body supports "## " headings and paragraphs.
function readArticle(slug) {
  const file = path.join("data", "articles", `${slug}.md`);
  if (!fs.existsSync(file)) return null;
  const m = fs.readFileSync(file, "utf8").replace(/\r\n/g, "\n").match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!m) return null;
  const meta = Object.fromEntries(m[1].split("\n").map(l => l.match(/^(\w+):\s*(.*)$/)).filter(Boolean).map(x => [x[1], x[2].trim()]));
  const html = [];
  for (const line of m[2].trim().split("\n")) {
    if (line.startsWith("## ")) html.push({ h: line.slice(3).trim() });
    else if (!line.trim()) html.push(null);
    else if (html.at(-1)?.p != null) html.at(-1).p += " " + line.trim();
    else html.push({ p: line.trim() });
  }
  const blocks = html.filter(Boolean);
  return {
    ...meta,
    html: blocks.map(b => b.h ? `<h3>${esc(b.h)}</h3>` : `<p>${esc(b.p)}</p>`).join("\n"),
    intro: blocks.find(b => b.p)?.p,
  };
}

// ---------- normalise data ----------
const list = creators.map(c => {
  const subs = parseCount(c.channel?.subscribersText);
  const firstDate = c.hideDate ? null : c.first?.uploadDate;
  const slug = slugify(c.name);
  const article = readArticle(slug);
  if (!article) console.warn(`No article for ${c.name} (data/articles/${slug}.md)`);
  return {
    name: c.name,
    slug,
    article,
    category: article?.category,
    handle: c.channel?.handle,
    avatar: c.channel?.avatar?.replace(/=s\d+-/, "=s176-"),
    subs,
    videosText: c.channel?.videosText,
    note: c.note,
    first: c.first && { ...c.first, date: firstDate, playable: c.first.status === "OK" },
    latest: c.latest && { ...c.latest, playable: c.latest.status === "OK" },
  };
}).sort((a, b) => b.subs - a.subs);
list.forEach((c, i) => (c.rank = i + 1));

// ---------- shared page chrome ----------
const page = ({ title, description, image, body, urlPath, depth = 0, absolute = false, bodyClass = "" }) => {
  const root = absolute ? "/" : depth ? "../".repeat(depth) : "./";
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
<link rel="canonical" href="${SITE_URL}${urlPath}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="${esc(SITE_NAME)}">
<meta property="og:url" content="${SITE_URL}${urlPath}">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
${image ? `<meta property="og:image" content="${esc(image)}">` : ""}
<meta name="twitter:card" content="summary_large_image">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,500;12..96,700;12..96,800&family=Inter:wght@400;500;600&display=swap" rel="stylesheet">
<link rel="stylesheet" href="${root}styles.css">
<link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'><rect width='32' height='32' rx='8' fill='%23e60000'/><text x='16' y='23' font-family='Arial' font-weight='900' font-size='18' text-anchor='middle' fill='%23ffffff'>1</text></svg>">
</head>
<body class="${bodyClass}">
<header class="site-header">
  <a class="brand" href="${root}"><span class="brand-mark">1</span>${esc(SITE_NAME)}</a>
  <nav><a href="${root}#grid">All creators</a><a href="${root}about/">About</a></nav>
</header>
${body}
<footer class="site-footer">
  <p>${esc(SITE_NAME)} is a fan project. All videos play through YouTube's official player and belong to their creators.</p>
  <p>Stats updated ${fmtDate(now.toISOString().slice(0, 10))}.</p>
</footer>
<script src="${root}app.js" defer></script>
</body>
</html>`;
};

// A lightweight player: shows the thumbnail and only loads YouTube's iframe on click.
const player = (v, label) => {
  if (!v) return `<div class="player player-missing"><p>No video found</p></div>`;
  if (!v.playable) {
    return `<a class="player player-external" href="https://www.youtube.com/watch?v=${esc(v.id)}" target="_blank" rel="noopener">
      <img src="${thumb(v.id)}" alt="" loading="lazy">
      <span class="external-label">Watch on YouTube ↗</span>
    </a>`;
  }
  return `<button class="player" data-video="${esc(v.id)}" aria-label="Play ${esc(label)}: ${esc(v.title)}">
    <img src="${thumb(v.id)}" alt="" loading="lazy">
    <span class="play"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5.5v13l11-6.5z"/></svg></span>
    ${v.lengthSeconds ? `<span class="len">${duration(v.lengthSeconds)}</span>` : ""}
  </button>`;
};

// ---------- homepage ----------
const withDates = list.filter(c => c.first?.date);
const earliest = [...withDates].sort((a, b) => a.first.date.localeCompare(b.first.date))[0];
const newest = [...withDates].sort((a, b) => b.first.date.localeCompare(a.first.date))[0];
const original = list.filter(c => c.first?.date);
const mostViewed = [...original].filter(c => c.first.views).sort((a, b) => b.first.views - a.first.views)[0];
const leastViewed = [...original].filter(c => c.first.views).sort((a, b) => a.first.views - b.first.views)[0];
const totalFirstViews = list.reduce((s, c) => s + (c.first?.views || 0), 0);
const years = withDates.map(c => Number(c.first.date.slice(0, 4)));

const categories = Object.entries(list.reduce((m, c) => (c.category && (m[c.category] = (m[c.category] || 0) + 1), m), {}))
  .sort((a, b) => b[1] - a[1]);

const highlight = (label, c, value, detail) => `
  <a class="highlight" href="c/${c.slug}/">
    <img src="${thumb(c.first.id, "mqdefault")}" alt="" loading="lazy">
    <div>
      <p class="hl-label">${label}</p>
      <p class="hl-value">${value}</p>
      <p class="hl-detail">${esc(c.name)} · ${detail}</p>
    </div>
  </a>`;

const card = c => `
  <a class="card" href="c/${c.slug}/" data-name="${esc(c.name.toLowerCase())} ${esc((c.handle || "").toLowerCase())}" data-rank="${c.rank}" data-subs="${c.subs}" data-date="${c.first?.date || ""}" data-views="${c.first?.views || 0}" data-category="${esc(c.category || "")}">
    <div class="card-thumb">
      <img src="${thumb(c.first.id, "mqdefault")}" alt="" loading="lazy">
      <span class="card-year">${c.first.date ? c.first.date.slice(0, 4) : "Archive"}</span>
      <span class="card-rank">#${c.rank}</span>
    </div>
    <div class="card-body">
      <img class="avatar" src="${esc(c.avatar)}" alt="" loading="lazy" referrerpolicy="no-referrer" width="40" height="40">
      <div class="card-text">
        <h3>${esc(c.name)}</h3>
        <p class="card-first" title="${esc(c.first.title)}">${esc(c.first.title)}</p>
        <p class="card-stats">${compact(c.subs)} subscribers · ${compact(c.first.views)} views</p>
      </div>
    </div>
  </a>`;

// Hero showcase: a few well-known creators shown as "video one → today", cycling, each linking to its page.
const SHOWCASE = ["MrBeast", "PewDiePie", "IShowSpeed", "Markiplier", "Mark Rober", "Dude Perfect"];
const showcase = SHOWCASE.map(n => list.find(c => c.name === n))
  .filter(c => c?.first?.date && c.first.playable && c.latest?.uploadDate);
const showcaseHtml = !showcase.length ? "" : `
    <div class="showcase" aria-roledescription="carousel" aria-label="Examples: first video and latest video">
      ${showcase.map((c, i) => {
        const gap = Number(c.latest.uploadDate.slice(0, 4)) - Number(c.first.date.slice(0, 4));
        return `
      <a class="slide${i ? "" : " active"}" href="c/${c.slug}/" aria-label="${esc(c.name)}: first video from ${c.first.date.slice(0, 4)} and latest video, ${gap} years apart"${i ? ` aria-hidden="true" tabindex="-1"` : ""}>
        <figure class="shot shot-then">
          <span class="frame"><img src="${thumb(c.first.id, "mqdefault")}" alt="" loading="${i ? "lazy" : "eager"}"><span class="scan"></span></span>
          <figcaption><span class="tag tag-then">Video one · ${c.first.date.slice(0, 4)}</span><span class="shot-title">${esc(c.first.title)}</span></figcaption>
        </figure>
        <span class="years"><strong>${gap}</strong> years later</span>
        <figure class="shot shot-now">
          <span class="frame"><img src="${thumb(c.latest.id, "hqdefault")}" alt="" loading="${i ? "lazy" : "eager"}"></span>
          <figcaption><span class="tag tag-now">Latest · ${c.latest.uploadDate.slice(0, 4)}</span><span class="shot-title">${esc(c.latest.title)}</span></figcaption>
        </figure>
        <span class="who"><img src="${esc(c.avatar)}" alt="" referrerpolicy="no-referrer" width="36" height="36"><span><strong>${esc(c.name)}</strong><span>${compact(c.subs)} subscribers today</span></span></span>
      </a>`;
      }).join("")}
      <div class="dots">${showcase.map((c, i) => `<button type="button" aria-label="Show ${esc(c.name)}"${i ? "" : ` aria-current="true"`}></button>`).join("")}</div>
    </div>`;

const home = page({
  urlPath: "/",
  title: `${SITE_NAME}: ${TAGLINE.replace(/\.$/, "")}`,
  description: `Watch the very first YouTube videos of MrBeast, PewDiePie, IShowSpeed, Markiplier and ${list.length - 4} more of the biggest creators, side by side with their latest uploads.`,
  image: thumb(list[0].first.id),
  body: `
<main>
  <section class="hero">
    <div class="hero-text">
      <p class="eyebrow">${list.length} creators · ${Math.min(...years)}–${Math.max(...years)}</p>
      <h1>Everyone starts<br>with <em>video one.</em></h1>
      <p class="lede">The first YouTube uploads of the ${list.length} biggest creators, side by side with what they post today.</p>
      <div class="hero-stats">
        <div><strong>${compact(totalFirstViews)}</strong><span>views on these ${list.length} first videos</span></div>
        <div><strong>${compact(list.reduce((s, c) => s + c.subs, 0))}</strong><span>subscribers between them today</span></div>
      </div>
    </div>
    ${showcaseHtml}
  </section>

  <section class="highlights" aria-label="Highlights">
    ${highlight("Earliest start", earliest, earliest.first.date.slice(0, 4), esc(earliest.first.title))}
    ${highlight("Most-watched first video", mostViewed, compact(mostViewed.first.views) + " views", esc(mostViewed.first.title))}
    ${highlight("Least-watched first video", leastViewed, compact(leastViewed.first.views) + " views", esc(leastViewed.first.title))}
    ${highlight("Newest start", newest, newest.first.date.slice(0, 4), esc(newest.first.title))}
  </section>

  <section id="grid" class="grid-section">
    <div class="controls">
      <h2>All ${list.length} creators</h2>
      <div class="control-row">
        <label class="search"><span class="sr-only">Search creators</span>
          <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>
          <input id="search" type="search" placeholder="Search creators" autocomplete="off">
        </label>
        <label class="sort"><span>Sort</span>
          <select id="sort">
            <option value="rank">Most subscribers</option>
            <option value="oldest">Earliest first video</option>
            <option value="newest">Newest first video</option>
            <option value="views">Most-viewed first video</option>
            <option value="name">A–Z</option>
          </select>
        </label>
        <label class="sort"><span>Category</span>
          <select id="category">
            <option value="">All</option>
            ${categories.map(([name, n]) => `<option value="${esc(name)}">${esc(name)} (${n})</option>`).join("")}
          </select>
        </label>
      </div>
    </div>
    <div class="grid" id="cards">${list.map(card).join("")}</div>
    <p class="empty" id="empty" hidden>No creators match. Try a different search or category.</p>
  </section>
</main>`,
});

// ---------- creator pages ----------
const videoMeta = (v, isFirst) => {
  if (!v) return "";
  const parts = [];
  if (v.date ?? v.uploadDate) parts.push(fmtDate(v.date ?? v.uploadDate));
  if (v.views != null) parts.push(`${v.views.toLocaleString("en-US")} views`);
  return `<p class="v-title">${esc(v.title)}</p><p class="v-meta">${parts.join(" · ")}</p>`;
};

// Subscriber growth: one column per calendar year from the first archived record, plus today.
// Only recorded figures are drawn; years without a snapshot stay empty.
// Axis: the smallest round step (1, 2, 2.5 or 5 × 10^k) that covers the max in at most six steps.
const niceTicks = v => {
  const p = 10 ** Math.floor(Math.log10(v));
  const step = [0.1, 0.2, 0.25, 0.5, 1, 2, 2.5, 5].map(m => m * p).find(st => Math.ceil(v / st) <= 6);
  return Array.from({ length: Math.ceil(v / step) + 1 }, (_, i) => i * step);
};
// Recorded figures keep the precision YouTube displayed: exact counts in full, rounded ones to 3 significant figures.
const sig3 = n => {
  const [d, unit] = n >= 1e9 ? [1e9, "B"] : n >= 1e6 ? [1e6, "M"] : n >= 1e3 ? [1e3, "K"] : [1, ""];
  return String(Number((n / d).toPrecision(3))) + unit;
};
const fmtSubs = p => p.exact ? p.subs.toLocaleString("en-US") : sig3(p.subs);

const growthSection = c => {
  const points = (history[c.name]?.points || []).filter(p => p.subs > 0);
  if (points.length < 2) return "";
  const byYear = Object.fromEntries(points.map(p => [p.date.slice(0, 4), p]));
  const firstYear = Number(points[0].date.slice(0, 4)), thisYear = now.getFullYear();
  const today = { today: true, subs: c.subs, exact: false };
  const ticks = niceTicks(Math.max(today.subs, ...points.map(p => p.subs)));
  const max = ticks.at(-1);

  let prev = null;
  const cols = [];
  for (let y = firstYear; y <= thisYear; y++) {
    const p = byYear[y];
    if (!p) { cols.push(`<div class="col empty" aria-hidden="true"><span class="x"><span class="x-full">${y}</span><span class="x-short">’${String(y).slice(2)}</span></span></div>`); continue; }
    const change = prev ? ` · ${p.subs >= prev.subs ? "+" : "−"}${compact(Math.abs(p.subs - prev.subs))} since ${fmtDate(prev.date)}` : "";
    const tip = `${fmtDate(p.date)}: ${fmtSubs(p)} subscribers${p.exact ? "" : " (rounded by YouTube)"}${change}`;
    cols.push(`<div class="col" style="--h:${(p.subs / max * 100).toFixed(2)}%" tabindex="0" data-tip="${esc(tip)}" aria-label="${esc(tip)}"><span class="bar"></span>${prev ? "" : `<span class="cap">${p.exact ? compact(p.subs) : sig3(p.subs)}</span>`}<span class="x"><span class="x-full">${y}</span><span class="x-short">’${String(y).slice(2)}</span></span></div>`);
    prev = p;
  }
  const todayTip = `Today: ${sig3(today.subs)} subscribers · +${compact(today.subs - prev.subs)} since ${fmtDate(prev.date)}`;
  cols.push(`<div class="col today" style="--h:${(today.subs / max * 100).toFixed(2)}%" tabindex="0" data-tip="${esc(todayTip)}" aria-label="${esc(todayTip)}"><span class="bar"></span><span class="cap">${sig3(today.subs)}</span><span class="x">Now</span></div>`);

  const rows = points.map(p => `<tr><td>${fmtDate(p.date)}</td><td class="num">${fmtSubs(p)}</td><td>${p.exact ? "Exact" : "Rounded by YouTube"}</td><td><a href="${esc(p.source)}" target="_blank" rel="noopener">Archived page ↗</a></td></tr>`).join("");
  const gaps = thisYear - firstYear + 1 - points.length;

  return `
  <section class="growth" aria-labelledby="growth-title">
    <div class="growth-head">
      <h2 id="growth-title">Subscriber growth</h2>
      <p>One figure per year: the earliest archived copy of the channel page from that year, plus today. Hover a column for the exact date${gaps > 0 ? ". Empty years had no archived record" : ""}.</p>
    </div>
    <div class="chart">
      <div class="chart-plot">
        ${ticks.map(t => `<div class="tick" style="--y:${(t / max * 100).toFixed(2)}%"><span>${t ? compact(t) : "0"}</span></div>`).join("")}
        <div class="cols${cols.length > 12 ? " dense" : ""}" style="--n:${cols.length}">${cols.join("")}</div>
      </div>
      <div class="chart-tip" role="status" hidden></div>
    </div>
    <details class="growth-table">
      <summary>Show the numbers and sources</summary>
      <table>
        <thead><tr><th>Date</th><th class="num">Subscribers</th><th>Precision</th><th>Source</th></tr></thead>
        <tbody>${rows}<tr><td>Today</td><td class="num">${sig3(today.subs)}</td><td>Rounded by YouTube</td><td><a href="https://www.youtube.com/@${esc(c.handle)}" target="_blank" rel="noopener">Channel ↗</a></td></tr></tbody>
      </table>
    </details>
  </section>
`;
};

// The mini wiki: article text beside a fact box.
const aboutSection = c => {
  const a = c.article;
  const facts = [
    a.realName && ["Real name", esc(a.realName)],
    a.from && ["From", esc(a.from)],
    a.knownFor && ["Known for", esc(a.knownFor)],
    a.category && ["Category", esc(a.category)],
    c.first.date && ["Video one", fmtDate(c.first.date)],
    ["Subscribers", compact(c.subs)],
    c.handle && ["Channel", `<a href="https://www.youtube.com/@${esc(c.handle)}" target="_blank" rel="noopener">@${esc(c.handle)}</a>`],
  ].filter(Boolean);
  return `
  <section class="about">
    <article class="wiki">
      <h2>About ${esc(c.name)}</h2>
      ${a.html}
      ${a.wikipedia ? `<p class="wiki-more">More on <a href="${esc(a.wikipedia)}" target="_blank" rel="noopener">Wikipedia ↗</a></p>` : ""}
    </article>
    <aside class="facts" aria-label="Quick facts">
      <h2>Quick facts</h2>
      <dl>${facts.map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join("")}</dl>
    </aside>
  </section>
`;
};

const creatorPage = (c, i) => {
  const prev = list[(i - 1 + list.length) % list.length], next = list[(i + 1) % list.length];
  const yrs = yearsSince(c.first.date);
  const growth = c.first.views && c.latest?.views ? c.latest.views / c.first.views : null;
  const firstYear = c.first.date?.slice(0, 4);
  const tiles = [
    yrs != null && [`${yrs.toFixed(1)}`, "years since video one"],
    [compact(c.subs), "subscribers today"],
    [compact(c.first.views), "views on the first video"],
    growth && growth >= 1.5 && [`${growth >= 100 ? Math.round(growth).toLocaleString("en-US") : growth.toFixed(1)}×`, "more views on the latest video"],
    !growth || growth < 1.5 ? c.latest?.views != null && [compact(c.latest.views), "views on the latest video"] : null,
  ].filter(Boolean);

  return page({
    depth: 2,
    urlPath: `/c/${c.slug}/`,
    title: `${c.name}'s First YouTube Video${firstYear ? ` (${firstYear})` : ""} | ${SITE_NAME}`,
    description: `Watch ${c.name}'s first YouTube video, "${c.first.title}"${c.first.date ? `, uploaded ${fmtDate(c.first.date)}` : ""}, next to their latest upload.`,
    image: thumb(c.first.id),
    body: `
<main class="creator">
  <a class="back" href="../../#grid">← All creators</a>
  <section class="creator-head">
    <img class="avatar-lg" src="${esc(c.avatar)}" alt="" referrerpolicy="no-referrer" width="88" height="88">
    <div>
      <p class="eyebrow">#${c.rank} by subscribers</p>
      <h1>${esc(c.name)}</h1>
      <p class="creator-sub">${c.handle ? `<a href="https://www.youtube.com/@${esc(c.handle)}" target="_blank" rel="noopener">@${esc(c.handle)}</a> · ` : ""}${compact(c.subs)} subscribers${c.videosText ? ` · ${esc(c.videosText)} videos` : ""}</p>
    </div>
  </section>

  <section class="versus">
    <article class="side side-then">
      <p class="side-label"><span class="dot"></span>Video one${firstYear ? ` · ${firstYear}` : ""}</p>
      ${player(c.first, "first video")}
      ${videoMeta(c.first, true)}
      ${c.note ? `<p class="note">${esc(c.note)}</p>` : ""}
    </article>
    <article class="side side-now">
      <p class="side-label"><span class="dot"></span>Latest video${c.latest?.uploadDate ? ` · ${c.latest.uploadDate.slice(0, 4)}` : ""}</p>
      ${player(c.latest, "latest video")}
      ${videoMeta(c.latest, false)}
    </article>
  </section>

  <section class="tiles">
    ${tiles.map(([v, l]) => `<div class="tile"><strong>${v}</strong><span>${l}</span></div>`).join("")}
  </section>
${growthSection(c)}
${c.article ? aboutSection(c) : ""}
  <nav class="pager">
    <a href="../${prev.slug}/"><span>← Previous</span><strong>${esc(prev.name)}</strong></a>
    <a href="../${next.slug}/" class="next"><span>Next →</span><strong>${esc(next.name)}</strong></a>
  </nav>
</main>`,
  });
};

// ---------- about ----------
const about = page({
  depth: 1,
  urlPath: "/about/",
  title: `About | ${SITE_NAME}`,
  description: `How ${SITE_NAME} picks each creator's first video.`,
  body: `
<main class="prose">
  <h1>About ${esc(SITE_NAME)}</h1>
  <p>${esc(SITE_NAME)} collects the first YouTube videos of ${list.length} of the platform's biggest personality creators, so you can see where they started and compare it with what they make today.</p>
  <h2>How first videos are chosen</h2>
  <p>We show each creator's oldest video that is still public. Many creators have deleted or privated their earliest uploads, and some started on a different channel. Where that applies, the creator's page says so.</p>
  <h2>Where the numbers come from</h2>
  <p>Subscriber counts, view counts and latest uploads come from YouTube and are refreshed whenever the site is rebuilt. Videos play through YouTube's official embedded player, so views count toward the creator's channel.</p>
  <h2>Subscriber growth charts</h2>
  <p>YouTube doesn't publish subscriber history, so each yearly figure is read from an archived copy of the creator's own channel page saved by the Internet Archive's Wayback Machine. Every figure links to the snapshot it came from. Years with no archived copy are left empty rather than estimated. Until about 2019 YouTube showed exact counts; after that it showed rounded figures, and we show them as YouTube did.</p>
</main>`,
});

// ---------- write ----------
fs.rmSync(OUT, { recursive: true, force: true });
const write = (p, s) => { fs.mkdirSync(path.dirname(path.join(OUT, p)), { recursive: true }); fs.writeFileSync(path.join(OUT, p), s); };
write("index.html", home);
write("about/index.html", about);
list.forEach((c, i) => write(`c/${c.slug}/index.html`, creatorPage(c, i)));
// The 404 page is served at any missing URL, so it links from the site root.
write("404.html", page({
  absolute: true,
  urlPath: "/404.html",
  title: `Page not found | ${SITE_NAME}`,
  description: "This page doesn't exist.",
  body: `<main class="prose"><h1>Page not found</h1><p>That page doesn't exist. <a href="/">Browse all ${list.length} creators</a>.</p></main>`,
}));
const urls = ["/", "/about/", ...list.map(c => `/c/${c.slug}/`)];
const today = now.toISOString().slice(0, 10);
write("sitemap.xml", `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map(u => `  <url><loc>${SITE_URL}${u}</loc><lastmod>${today}</lastmod></url>`).join("\n")}
</urlset>
`);
write("robots.txt", `User-agent: *
Allow: /

Sitemap: ${SITE_URL}/sitemap.xml
`);
for (const f of ["styles.css", "app.js"]) fs.copyFileSync(path.join("site", f), path.join(OUT, f));
console.log(`Built ${list.length} creator pages into ${OUT}/`);
