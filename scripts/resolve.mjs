// Resolves data/creators.source.json into data/creators.json using public YouTube pages
// (no API key): verifies first videos, finds channels, and pulls each channel's latest upload.
// Usage: node scripts/resolve.mjs [--only "Name"]
import fs from "node:fs";

const SRC = "data/creators.source.json";
const OUT = "data/creators.json";
const HEADERS = { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)", "Accept-Language": "en-US,en;q=0.9", Cookie: "CONSENT=YES+1" };

const only = process.argv.includes("--only") ? process.argv[process.argv.indexOf("--only") + 1] : null;
const issuesOnly = process.argv.includes("--issues"); // re-run only entries that had problems

// YouTube's RSS endpoint returns spurious 404s, so callers can opt into retrying them.
async function get(url, { retry404 = false } = {}) {
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      const res = await fetch(url, { headers: HEADERS });
      if (res.status === 404 && !retry404) return null;
      if (res.ok) return await res.text();
    } catch {}
    await new Promise(r => setTimeout(r, 2000 * (attempt + 1)));
  }
  // Persistent failures are usually rate limiting: fail loudly rather than record a false "not found".
  throw new Error(`fetch failed: ${url}`);
}

// Pull a JSON object that follows `marker` in the page, using brace matching.
function extractJson(html, marker) {
  const i = html.indexOf(marker);
  if (i < 0) return null;
  const start = html.indexOf("{", i);
  let depth = 0, inStr = false, esc = false;
  for (let j = start; j < html.length; j++) {
    const c = html[j];
    if (inStr) { if (esc) esc = false; else if (c === "\\") esc = true; else if (c === '"') inStr = false; continue; }
    if (c === '"') inStr = true;
    else if (c === "{") depth++;
    else if (c === "}" && --depth === 0) {
      try { return JSON.parse(html.slice(start, j + 1)); } catch { return null; }
    }
  }
  return null;
}

function* walk(obj, key) {
  if (!obj || typeof obj !== "object") return;
  for (const [k, v] of Object.entries(obj)) {
    if (k === key) yield v;
    yield* walk(v, key);
  }
}

const norm = s => (s || "").toLowerCase().replace(/&amp;/g, "&").replace(/[^a-z0-9]+/g, " ").trim();
function similarity(a, b) {
  const A = new Set(norm(a).split(" ").filter(Boolean)), B = new Set(norm(b).split(" ").filter(Boolean));
  if (!A.size || !B.size) return 0;
  let hit = 0; for (const w of A) if (B.has(w)) hit++;
  return hit / Math.max(A.size, B.size);
}

async function videoInfo(id) {
  const html = await get(`https://www.youtube.com/watch?v=${id}&hl=en`);
  if (!html) return { id, status: "NOT_FOUND" };
  const pr = extractJson(html, "var ytInitialPlayerResponse = ");
  if (!pr) return { id, status: "PARSE_ERROR" };
  const vd = pr.videoDetails || {}, mf = pr.microformat?.playerMicroformatRenderer || {};
  return {
    id,
    status: pr.playabilityStatus?.status || "UNKNOWN",
    reason: pr.playabilityStatus?.reason,
    embeddable: pr.playabilityStatus?.playableInEmbed ?? mf.isFamilySafe !== undefined,
    title: vd.title || mf.title?.simpleText,
    channelId: vd.channelId || mf.externalChannelId,
    channelName: vd.author || mf.ownerChannelName,
    channelUrl: mf.ownerProfileUrl,
    views: vd.viewCount ? Number(vd.viewCount) : null,
    uploadDate: (mf.uploadDate || mf.publishDate || "").slice(0, 10) || null,
    lengthSeconds: vd.lengthSeconds ? Number(vd.lengthSeconds) : null,
  };
}

async function searchVideos(query) {
  const html = await get(`https://www.youtube.com/results?search_query=${encodeURIComponent(query)}&hl=en`);
  const data = html && extractJson(html, "var ytInitialData = ");
  if (!data) return [];
  return [...walk(data, "videoRenderer")].map(v => ({
    id: v.videoId,
    title: v.title?.runs?.map(r => r.text).join("") || "",
    channel: v.ownerText?.runs?.[0]?.text || "",
  }));
}

async function searchRaw(query) {
  const html = await get(`https://www.youtube.com/results?search_query=${encodeURIComponent(query)}&hl=en`);
  return (html && extractJson(html, "var ytInitialData = ")) || {};
}

async function searchChannel(name) {
  const html = await get(`https://www.youtube.com/results?search_query=${encodeURIComponent(name)}&sp=EgIQAg%253D%253D&hl=en`);
  const data = html && extractJson(html, "var ytInitialData = ");
  if (!data) return null;
  const ch = [...walk(data, "channelRenderer")][0];
  if (!ch) {
    // Fall back to the owner of the top video result.
    const v = [...walk(data, "videoRenderer")][0] || [...walk(await searchRaw(name), "videoRenderer")][0];
    const run = v?.ownerText?.runs?.[0];
    const base = run?.navigationEndpoint?.browseEndpoint?.canonicalBaseUrl || "";
    return run ? { channelId: run.navigationEndpoint.browseEndpoint.browseId, handle: base.startsWith("/@") ? decodeURIComponent(base.slice(2)) : null, title: run.text } : null;
  }
  const base = ch.navigationEndpoint?.browseEndpoint?.canonicalBaseUrl || "";
  return { channelId: ch.channelId, handle: base.startsWith("/@") ? decodeURIComponent(base.slice(2)) : null, title: ch.title?.simpleText };
}

async function channelInfo(handleOrId) {
  const url = handleOrId.startsWith("UC") && handleOrId.length === 24
    ? `https://www.youtube.com/channel/${handleOrId}?hl=en`
    : `https://www.youtube.com/@${handleOrId}?hl=en`;
  const html = await get(url);
  if (!html) return null;
  const meta = p => html.match(new RegExp(`<meta property="${p}" content="([^"]*)"`))?.[1];
  const handle = html.match(/"vanityChannelUrl":"https?:\/\/www\.youtube\.com\/@([^"]+)"/)?.[1];
  // The page header's own counts; other "subscribers" strings on the page belong to featured channels.
  const subs = html.match(/"content":"(\d[\d.,]*[KMB]?) subscribers"/)?.[1];
  const videos = html.match(/"content":"(\d[\d.,]*[KMB]?) videos?"/)?.[1];
  return {
    channelId: html.match(/"externalId":"(UC[^"]+)"/)?.[1],
    handle: handle ? decodeURIComponent(handle) : null,
    title: meta("og:title")?.replace(/&amp;/g, "&").replace(/&#39;/g, "'"),
    avatar: meta("og:image"),
    subscribersText: subs || null,
    videosText: videos || null,
  };
}

// A channel tab ("videos" or "shorts"). Returns its newest upload and, via the tab's "Oldest"
// sort option, its oldest public uploads. The Videos tab excludes Shorts and livestreams.
async function channelTab(channelId, tab) {
  const html = await get(`https://www.youtube.com/channel/${channelId}/${tab}?hl=en`);
  const data = html && extractJson(html, "var ytInitialData = ");
  if (!data) return { latest: null, oldest: [] };
  const items = root => [
    ...[...walk(root, "lockupViewModel")].map(l => ({ id: l.contentId, title: l.metadata?.lockupMetadataViewModel?.title?.content })),
    ...[...walk(root, "shortsLockupViewModel")].map(l => ({ id: [...walk(l, "reelWatchEndpoint")][0]?.videoId, title: l.accessibilityText?.replace(/, [\d.,]+ \w+ views? - play Short$/, "") })),
  ].filter(v => v.id);
  const latest = items(data)[0] || null;

  let oldest = [];
  // Depending on the layout served, "Oldest" is either a chip or an item in a sort menu.
  const item = [...walk(data, "chipViewModel")].find(c => c.text === "Oldest")
    || [...walk(data, "listItemViewModel")].find(i => i.title?.content === "Oldest");
  const token = item && [...walk(item, "continuationCommand")][0]?.token;
  const clientVersion = html.match(/"INNERTUBE_CLIENT_VERSION":"([^"]+)"/)?.[1];
  if (token && clientVersion) {
    const res = await fetch("https://www.youtube.com/youtubei/v1/browse?prettyPrint=false", {
      method: "POST",
      headers: { ...HEADERS, "Content-Type": "application/json" },
      body: JSON.stringify({ context: { client: { clientName: "WEB", clientVersion, hl: "en" } }, continuation: token }),
    }).catch(() => null);
    const json = res?.ok ? await res.json() : null;
    oldest = json ? items(json).slice(0, 3) : [];
  }
  return { latest, oldest };
}

// The channel's oldest public upload across regular videos and Shorts, with its date.
async function oldestUpload(videosOldest, channelId) {
  const shorts = await channelTab(channelId, "shorts");
  const candidates = [videosOldest[0], shorts.oldest[0]].filter(Boolean);
  const infos = await Promise.all(candidates.map(c => videoInfo(c.id)));
  return infos.filter(v => v.uploadDate).sort((a, b) => a.uploadDate.localeCompare(b.uploadDate))[0] || null;
}

async function resolve(src) {
  const out = { ...src, issues: [] };

  // 1. First video: verify the given ID, or search by listed title.
  let first = null;
  if (src.firstVideoId) {
    first = await videoInfo(src.firstVideoId);
  } else if (src.listedTitle) {
    const results = await searchVideos(`${src.name} ${src.listedTitle}`);
    const scored = results.map(r => ({ ...r, score: similarity(r.title, src.listedTitle) })).sort((a, b) => b.score - a.score);
    if (scored[0] && scored[0].score >= 0.6) {
      first = await videoInfo(scored[0].id);
      first.matchScore = Number(scored[0].score.toFixed(2));
    } else {
      out.issues.push(`no search match for listed title "${src.listedTitle}"`);
    }
  }
  if (first && first.status !== "OK") out.issues.push(`first video ${first.id} status: ${first.status}${first.reason ? ` (${first.reason})` : ""}`);
  if (first && src.listedTitle && first.title && similarity(first.title, src.listedTitle) < 0.6) out.issues.push(`title differs from list: "${first.title}"`);
  out.first = first;

  // 2. Main channel.
  let ch = src.handle ? await channelInfo(src.handle) : null;
  if (!ch?.channelId) {
    const found = await searchChannel(src.name);
    if (found) ch = await channelInfo(found.handle || found.channelId);
    out.channelFoundBySearch = true;
  }
  if (!ch?.channelId) out.issues.push("channel not found");
  out.channel = ch;

  // 3. Compare against the channel's oldest public upload, and get the latest one.
  const { latest, oldest } = ch?.channelId ? await channelTab(ch.channelId, "videos") : { latest: null, oldest: [] };
  const o = ch?.channelId ? await oldestUpload(oldest, ch.channelId) : null;
  out.oldestPublic = o && { id: o.id, title: o.title, uploadDate: o.uploadDate };
  // No first video given: use the channel's oldest public upload (regular videos and Shorts).
  if (!src.firstVideoId && !src.listedTitle && o) {
    first = out.first = { ...o, auto: true };
    out.issues = out.issues.filter(i => i !== "no first video given");
  }
  const onMainChannel = first?.channelId && first.channelId === ch?.channelId;
  if (first?.channelId && ch?.channelId && !onMainChannel) {
    first.otherChannel = true;
    if (!src.dagger) out.issues.push(`first video is on a different channel: ${first.channelName}`);
  }
  const firstOk = first?.status === "OK";
  const olderExists = !first || !firstOk || (onMainChannel && o && o.id !== first.id && (!first.uploadDate || o.uploadDate < first.uploadDate));
  if (o && olderExists) out.issues.push(`channel's oldest public video is "${o.title}" (${o.id}, ${o.uploadDate})`);
  if (ch?.channelId && !o) out.issues.push("couldn't read oldest uploads");

  out.latest = latest ? await videoInfo(latest.id) : null;
  if (ch?.channelId && !out.latest) out.issues.push("no latest upload found");
  return out;
}

const source = JSON.parse(fs.readFileSync(SRC, "utf8"));
const existing = fs.existsSync(OUT) ? JSON.parse(fs.readFileSync(OUT, "utf8")) : [];
const results = new Map(existing.map(e => [e.name, e]));
const todo = source.filter(s => (!only || s.name === only) && (!issuesOnly || !results.get(s.name) || results.get(s.name).issues?.length));
let done = 0;
const queue = [...todo];
await Promise.all(Array.from({ length: 3 }, async () => {
  while (queue.length) {
    const s = queue.shift();
    try { results.set(s.name, await resolve(s)); }
    // Keep the last good result so a failed refresh never wipes data; --issues will retry it.
    catch (err) { results.set(s.name, { ...(results.get(s.name) || s), issues: [`error: ${err.message}`] }); }
    process.stderr.write(`\r${++done}/${todo.length}`);
    await new Promise(r => setTimeout(r, 1500)); // stay well under YouTube's rate limits
  }
}));
process.stderr.write("\n");

const ordered = source.map(s => results.get(s.name)).filter(Boolean);
fs.writeFileSync(OUT, JSON.stringify(ordered, null, 2));
const flagged = ordered.filter(e => e.issues?.length);
console.log(`${ordered.length} resolved, ${flagged.length} with issues`);
for (const e of flagged) console.log(`- ${e.name}: ${e.issues.join("; ")}`);
