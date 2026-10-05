// Builds data/history.json: each creator's subscriber count at the start of each year, read from
// Internet Archive (Wayback Machine) snapshots of their own channel page. Only real recorded figures
// are kept. Years without a readable snapshot are left out, never estimated.
// Usage: node scripts/history.mjs [--only "Name"] [--redo]
import fs from "node:fs";

const OUT = "data/history.json";
const UA = { "User-Agent": "TheFirstUploadHistory/1.0 (https://thefirstupload.com)" };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const args = process.argv.slice(2);
const only = args.includes("--only") ? args[args.indexOf("--only") + 1] : null;
const redo = args.includes("--redo");

// The Internet Archive rate-limits heavy use. On "429 Too Many Requests" the whole run stops
// (keeping everything collected so far) instead of retrying into a longer block.
class RateLimited extends Error {}
let lastRequest = 0;
async function get(url, { json = false } = {}) {
  for (let attempt = 0; attempt < 3; attempt++) {
    const wait = lastRequest + 4000 - Date.now(); // at most one request every 4 seconds
    if (wait > 0) await sleep(wait);
    lastRequest = Date.now();
    let res;
    try { res = await fetch(url, { headers: UA, signal: AbortSignal.timeout(60000) }); } catch { await sleep(5000); continue; }
    if (res.status === 429) throw new RateLimited("Internet Archive returned 429 Too Many Requests");
    if (res.status === 404) return null;
    if (res.ok) return json ? await res.json() : await res.text();
    await sleep(5000 * (attempt + 1));
  }
  // Persistent failure: fail this creator so its previous data is kept rather than replaced.
  throw new Error(`request failed: ${url}`);
}

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
    else if (c === "}" && --depth === 0) { try { return JSON.parse(html.slice(start, j + 1)); } catch { return null; } }
  }
  return null;
}
function* walk(o, key) {
  if (!o || typeof o !== "object") return;
  for (const [k, v] of Object.entries(o)) { if (k === key) yield v; yield* walk(v, key); }
}
function* strings(o) {
  if (typeof o === "string") yield o;
  else if (o && typeof o === "object") for (const v of Object.values(o)) yield* strings(v);
}

// Archived pages can be in any language, so numbers may use "," "." or spaces as thousands
// separators ("1.894.885") and a decimal comma before a unit ("24,7 M"). Anything ambiguous is
// rejected rather than guessed.
const UNITS = {
  k: 1e3, thousand: 1e3, mil: 1e3, tsd: 1e3, "тыс": 1e3, tys: 1e3, tis: 1e3, ezer: 1e3,
  m: 1e6, million: 1e6, mi: 1e6, mio: 1e6, "млн": 1e6, mln: 1e6, milj: 1e6,
  b: 1e9, billion: 1e9, mrd: 1e9, "млрд": 1e9,
};
const integer = s => /^\d{1,3}([.,   '’]\d{3})+$|^\d+$/.test(s) ? Number(s.replace(/\D/g, "")) : null;
const decimal = s => /^\d+([.,]\d{1,2})?$/.test(s) ? Number(s.replace(",", ".")) : null;

// "28.6M subscribers", "24,7 M de suscriptores", "18,459", "1.894.885" -> { subs, exact }
function toNumber(text) {
  const t = text.replace(/[  ]/g, " ").trim();
  let m = t.match(/(\d[\d.,]*)\s*(thousand|million|billion|млрд|milj|mil|mio|mrd|tsd|тыс|млн|mln|tys|tis|ezer|mi|k|m|b)\.?(?![a-zа-я])/i);
  if (m) {
    const v = decimal(m[1]) ?? integer(m[1]);
    return v == null ? null : { subs: Math.round(v * UNITS[m[2].toLowerCase()]), exact: false };
  }
  // A bare number, optionally followed by one word such as "subscribers". A short or abbreviated
  // word is probably a unit we don't know ("32 млн"), so it's rejected rather than read as 32.
  m = t.match(/^(\d[\d.,   '’]*\d|\d)(?:\s+(\S+))?$/);
  if (m?.[2] && (m[2].length <= 5 || m[2].includes("."))) return null;
  const v = m && integer(m[1].trim());
  return v == null ? null : { subs: v, exact: true };
}

// The channel a page belongs to. Pages also mention other channels (featured channels, links),
// so this reads the page's own metadata rather than checking whether an ID appears anywhere.
function ownChannelId(html, data) {
  const fromData = data?.metadata?.channelMetadataRenderer?.externalId || data?.header?.c4TabbedHeaderRenderer?.channelId;
  if (fromData) return fromData;
  return html.match(/<meta itemprop="channelId" content="(UC[\w-]{22})"/)?.[1]
    || html.match(/<link rel="canonical" href="https?:\/\/(?:www\.)?youtube\.com\/channel\/(UC[\w-]{22})"/)?.[1]
    || null;
}

// Reads the channel's OWN subscriber count from an archived channel page. Pages also list
// featured channels with their own counts, so only the channel header is considered.
function parseSnapshot(html, channelId) {
  const data = extractJson(html, "var ytInitialData = ") || extractJson(html, 'window["ytInitialData"] = ');
  if (ownChannelId(html, data) !== channelId) return null; // another channel's page, a redirect, or unidentifiable

  if (data?.header) {
    const h = data.header;
    const c4 = h.c4TabbedHeaderRenderer;
    if (c4?.subscriberCountText) {
      const s = c4.subscriberCountText;
      const text = s.simpleText || s.runs?.map(r => r.text).join("") || s.accessibility?.accessibilityData?.label;
      if (text) return toNumber(text);
    }
    // Newer layout: counts live in the page header's metadata rows.
    for (const s of strings(h)) if (/^[\d.,]+\s*(K|M|B|thousand|million|billion)?\s+subscribers?$/i.test(s.trim())) return toNumber(s);
  }

  // Classic layout (2014 to ~2020): the header's subscribe button shows the count, either as a
  // tooltip (title="18,459") or as its text (>19,481,416< or, later, >24M<). Before 2014 pages
  // didn't include the count. Abbreviated values ("24M", "1.25M") are kept as rounded.
  let headerStart = html.indexOf("c4-primary-header-contents");
  if (headerStart < 0) headerStart = html.indexOf("channel-header");
  if (headerStart >= 0) {
    // Read the whole value: it may contain spaces ("4 613 452") or a unit word ("32 млн").
    const m = html.slice(headerStart, headerStart + 20000).match(/subscriber-count-branded-horizontal[^"]*"([^>]*)>([^<]*)</i);
    const value = m && (m[1].match(/title="([^"]*)"/)?.[1] || m[2]).trim();
    if (value) return toNumber(value);
  }
  return null;
}

async function snapshotsByYear(urls) {
  const byYear = {};
  for (const u of urls) {
    const rows = await get(`https://web.archive.org/cdx/search/cdx?url=${encodeURIComponent(u)}&output=json&filter=statuscode:200&fl=timestamp,original&collapse=timestamp:6`, { json: true });
    for (const [ts, original] of (rows || []).slice(1)) (byYear[ts.slice(0, 4)] ||= []).push({ ts, original });
  }
  for (const y of Object.keys(byYear)) byYear[y].sort((a, b) => a.ts.localeCompare(b.ts));
  return byYear;
}

async function history(c) {
  const id = c.channel.channelId, handle = c.channel.handle;
  const urls = [`youtube.com/channel/${id}`];
  if (handle) urls.push(`youtube.com/@${handle}`, `youtube.com/user/${handle}`, `youtube.com/c/${handle}`);
  const byYear = await snapshotsByYear(urls);
  const points = [];
  for (const year of Object.keys(byYear).sort()) {
    // Earliest readable snapshot in the year; try up to three different months.
    const seenMonths = new Set();
    for (const snap of byYear[year]) {
      const month = snap.ts.slice(0, 6);
      if (seenMonths.has(month)) continue;
      if (seenMonths.size >= 3) break;
      seenMonths.add(month);
      const url = `https://web.archive.org/web/${snap.ts}id_/${snap.original}`;
      const html = await get(url);
      const r = html && parseSnapshot(html, id);
      if (r?.subs > 0) {
        points.push({ date: `${snap.ts.slice(0, 4)}-${snap.ts.slice(4, 6)}-${snap.ts.slice(6, 8)}`, ...r, source: `https://web.archive.org/web/${snap.ts}/${snap.original}` });
        break;
      }
    }
  }
  return points;
}

const creators = JSON.parse(fs.readFileSync("data/creators.json", "utf8"));
const out = fs.existsSync(OUT) ? JSON.parse(fs.readFileSync(OUT, "utf8")) : {};
const todo = creators.filter(c => (!only || c.name === only) && (redo || only || !out[c.name]));
let done = 0;
const queue = [...todo];
// One creator at a time. A creator's entry is only replaced after a complete, successful run.
for (const c of queue) {
  try {
    out[c.name] = { checked: new Date().toISOString().slice(0, 10), points: await history(c) };
    fs.writeFileSync(OUT, JSON.stringify(out, null, 2));
    console.log(`${++done}/${todo.length} ${c.name}: ${out[c.name].points.length} years`);
  } catch (e) {
    console.log(`${++done}/${todo.length} ${c.name}: FAILED (${e.message}); kept previous data`);
    if (e instanceof RateLimited) {
      console.log("Stopping: rate-limited by the Internet Archive. Run again later; finished creators are skipped.");
      process.exit(1);
    }
  }
}
