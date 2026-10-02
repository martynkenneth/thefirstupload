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

// ---------- normalise data ----------
const list = creators.map(c => {
  const subs = parseCount(c.channel?.subscribersText);
  const firstDate = c.hideDate ? null : c.first?.uploadDate;
  return {
    name: c.name,
    slug: slugify(c.name),
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
<link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'><rect width='32' height='32' rx='8' fill='%23ffb547'/><text x='16' y='23' font-family='Arial' font-weight='900' font-size='18' text-anchor='middle' fill='%23121014'>1</text></svg>">
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
  <a class="card" href="c/${c.slug}/" data-name="${esc(c.name.toLowerCase())} ${esc((c.handle || "").toLowerCase())}" data-rank="${c.rank}" data-subs="${c.subs}" data-date="${c.first?.date || ""}" data-views="${c.first?.views || 0}">
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

const home = page({
  urlPath: "/",
  title: `${SITE_NAME}: ${TAGLINE.replace(/\.$/, "")}`,
  description: `Watch the very first YouTube videos of MrBeast, PewDiePie, IShowSpeed, Markiplier and 96 more of the biggest creators, side by side with their latest uploads.`,
  image: thumb(list[0].first.id),
  body: `
<main>
  <section class="hero">
    <p class="eyebrow">${list.length} creators · ${Math.min(...years)}–${Math.max(...years)}</p>
    <h1>Everyone starts<br>with <em>video one.</em></h1>
    <p class="lede">The first YouTube uploads of the ${list.length} biggest creators, side by side with what they post today.</p>
    <div class="hero-stats">
      <div><strong>${compact(totalFirstViews)}</strong><span>views on these ${list.length} first videos</span></div>
      <div><strong>${compact(list.reduce((s, c) => s + c.subs, 0))}</strong><span>subscribers between them today</span></div>
    </div>
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
      </div>
    </div>
    <div class="grid" id="cards">${list.map(card).join("")}</div>
    <p class="empty" id="empty" hidden>No creators match that search.</p>
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
  <p>${esc(SITE_NAME)} collects the first YouTube videos of 100 of the platform's biggest personality creators, so you can see where they started and compare it with what they make today.</p>
  <h2>How first videos are chosen</h2>
  <p>We show each creator's oldest video that is still public. Many creators have deleted or privated their earliest uploads, and some started on a different channel. Where that applies, the creator's page says so.</p>
  <h2>Where the numbers come from</h2>
  <p>Subscriber counts, view counts and latest uploads come from YouTube and are refreshed whenever the site is rebuilt. Videos play through YouTube's official embedded player, so views count toward the creator's channel.</p>
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
