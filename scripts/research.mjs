// Gathers source material for the creator articles: each creator's Wikipedia lead section
// (when an article exists) and their own channel description. Writes data/research.json,
// which is reference material for writing data/articles/*.md and is not published.
// Usage: node scripts/research.mjs
import fs from "node:fs";

const UA = { "User-Agent": "TheFirstUploadResearch/1.0 (https://thefirstupload.com)" };
const YT = { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)", "Accept-Language": "en-US,en;q=0.9" };
const sleep = ms => new Promise(r => setTimeout(r, ms));
// Throws on rate limiting so a throttled response is never mistaken for "no article".
const getJson = async url => {
  const r = await fetch(url, { headers: UA });
  if (r.status === 429) throw new Error("Wikipedia rate limit");
  const text = await r.text();
  if (/too many requests/i.test(text)) throw new Error("Wikipedia rate limit");
  return r.ok ? JSON.parse(text) : null;
};

// Candidate Wikipedia titles, tried in order. An empty list means "no article".
const WIKI_TITLES = {
  "MrBeast": ["MrBeast"], "Markiplier": ["Markiplier"], "DanTDM": ["DanTDM"], "Dream": ["Dream (YouTuber)"],
  "Mrwhosetheboss": ["Arun Maini", "Mrwhosetheboss"], "Ben Azelart": ["Ben Azelart"], "Emma Chamberlain": ["Emma Chamberlain"],
  "Jesser": ["Jesser (YouTuber)", "Jesser"], "Nick DiGiovanni": ["Nick DiGiovanni"], "The Royalty Family": ["The Royalty Family"],
  "LankyBox": ["LankyBox"], "ZHC": ["ZHC (YouTuber)", "Zhong Hua Chen"], "SSundee": ["SSundee"], "Aphmau": ["Aphmau"],
  "James Charles": ["James Charles (internet personality)", "James Charles (YouTuber)"], "Supercar Blondie": ["Supercar Blondie", "Alex Hirschi"],
  "penguinz0": ["MoistCr1TiKaL", "Penguinz0", "Charles White Jr. (YouTuber)"], "Jenna Marbles": ["Jenna Marbles"],
  "Shane Dawson": ["Shane Dawson"], "Rosanna Pansino": ["Rosanna Pansino"], "Jeffree Star": ["Jeffree Star"],
  "Safiya Nygaard": ["Safiya Nygaard"], "Kallmekris": ["Kallmekris", "Kris Collins"], "NileRed": ["NileRed"],
  "Linus Tech Tips": ["Linus Tech Tips", "Linus Sebastian"], "colinfurze": ["Colin Furze"], "Beta Squad": ["Beta Squad"],
  "Grian": ["Grian (YouTuber)", "Hermitcraft"], "Mumbo Jumbo": ["Mumbo Jumbo (YouTuber)"], "JoshDub": ["JoshDub"],
  "Alan Becker": ["Alan Becker"], "Dan Rhodes": ["Dan Rhodes (magician)", "Dan Rhodes (YouTuber)"], "Anna McNulty": ["Anna McNulty"],
  "Jeff Nippard": ["Jeff Nippard"], "Jeenie.Weenie": ["Jeenie.Weenie", "Jeenie Weenie"], "NichLmao": ["NichLmao"],
  "Topper Guild": ["Topper Guild"], "Zhong": ["Zhong (YouTuber)"], "Preston": ["PrestonPlayz"], "Ludwig": ["Ludwig Ahgren"],
  "Lachlan": ["Lachlan Power"], "Vsauce": ["Vsauce"], "Smosh": ["Smosh"], "Sidemen": ["Sidemen"], "nigahiga": ["Ryan Higa"],
  "Technoblade": ["Technoblade"], "Ryan's World": ["Ryan's World"], "Veritasium": ["Veritasium", "Derek Muller"],
  "Good Mythical Morning": ["Good Mythical Morning", "Rhett & Link"],
  // Creators 101+
  "Ninja": ["Ninja (gamer)", "Ninja (streamer)"], "Infinite": ["Infinite (YouTuber)"], "Fresh": ["Fresh (YouTuber)"],
  "Bionic": [], "WILDCAT": ["Wildcat (YouTuber)"], "Deji": [], "Nogla": ["Nogla", "Daithi De Nogla"],
  "MooseCraft": [], "Grizzy": [], "Caylus": [], "Miniminter": ["Miniminter", "Simon Minter"], "Vikkstar123": ["Vikkstar123", "Vikram Barn"],
  "stampylonghead": ["Stampylonghead", "Stampy Cat", "Joseph Garrett"], "Ms Rachel": ["Ms Rachel", "Rachel Griffin Accurso"],
  "Unbox Therapy": ["Unbox Therapy", "Lewis Hilsenteger"], "bald and bankrupt": ["Bald and Bankrupt"], "Dhar Mann Studios": ["Dhar Mann"],
  "Zack D. Films": ["Zack D. Films"], "Daily Dose Of Internet": ["Daily Dose of Internet"], "Primitive Technology": ["Primitive Technology"],
  "Yes Theory": ["Yes Theory"], "Peter McKinnon": ["Peter McKinnon"], "Guga Foods": ["Guga Foods"], "Skeppy": ["Skeppy"],
  "Quackity": ["Quackity"], "Sapnap": ["Sapnap"], "Tubbo": ["Tubbo"],
  "Fundy": ["Fundy (YouTuber)", "Fundy"], "The Norris Nuts": ["The Norris Nuts"], "SMii7Y": ["SMii7Y"], "Kara and Nate": ["Kara and Nate"],
  "Drew Binsky": ["Drew Binsky"], "Tfue": ["Tfue"], "CaptainSparklez": ["CaptainSparklez", "Jordan Maron"], "Mark Wiens": ["Mark Wiens"],
  "Ali Abdaal": ["Ali Abdaal"], "ChrisMD": ["ChrisMD"], "WillNE": ["WillNE"], "Memeulous": ["Memeulous"], "Loserfruit": ["Loserfruit"],
  "Kurtis Conner": ["Kurtis Conner"], "Drew Gooden": ["Drew Gooden (comedian)", "Drew Gooden"], "Danny Gonzalez": ["Danny Gonzalez"],
  "SypherPK": ["SypherPK"], "PopularMMOs": ["PopularMMOs"], "H2ODelirious": ["H2ODelirious"], "FGTeeV": ["FGTeeV"],
  "Thinknoodles": ["Thinknoodles"], "TheDooo": ["TheDooo"], "Danny Aarons": ["Danny Aarons"],
  "Beau Miles": ["Beau Miles"], "Ranboo": [], "BadBoyHalo": [], "Danny Aarons": [], "Devon Rodriguez": ["Devon Rodriguez"], "Daniel LaBelle": ["Daniel LaBelle"], "Zach Choi": ["Zach Choi"],
};
const ABOUT_CREATOR = /youtub|internet personality|influencer|streamer|content creator|web series|online/i;

async function wikiPage(title) {
  const q = await getJson(`https://en.wikipedia.org/w/api.php?action=query&prop=extracts&exintro=1&explaintext=1&redirects=1&titles=${encodeURIComponent(title)}&format=json`);
  const page = q && Object.values(q.query.pages)[0];
  if (!page?.extract || /may refer to|may also refer to/i.test(page.extract) || !ABOUT_CREATOR.test(page.extract)) return null;
  return { title: page.title, url: `https://en.wikipedia.org/wiki/${encodeURIComponent(page.title.replace(/ /g, "_"))}`, intro: page.extract };
}

async function wiki(name) {
  if (name in WIKI_TITLES) {
    for (const t of WIKI_TITLES[name]) { const p = await wikiPage(t); if (p) return p; }
    return null;
  }
  // Otherwise trust a search hit only when its title closely matches the creator's name.
  const s = await getJson(`https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(`${name} YouTube`)}&srlimit=5&format=json`);
  const norm = x => x.toLowerCase().replace(/\(.*\)/, "").replace(/[^a-z0-9]/g, "");
  const hit = s?.query?.search?.find(h => norm(h.title) === norm(name) || norm(h.title).includes(norm(name)));
  return hit ? wikiPage(hit.title) : null;
}

async function channelDescription(handle) {
  if (!handle) return null;
  const r = await fetch(`https://www.youtube.com/@${handle}?hl=en`, { headers: YT });
  if (!r.ok) return null;
  const html = await r.text();
  const raw = html.match(/<meta property="og:description" content="([^"]*)"/)?.[1];
  return raw ? raw.replace(/&amp;/g, "&").replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/&#10;/g, "\n") : null;
}

const rerun = process.argv.includes("--recheck"); // re-fetch names listed in WIKI_TITLES
const missingOnly = process.argv.includes("--missing"); // re-check creators with no Wikipedia match
const creators = JSON.parse(fs.readFileSync("data/creators.json", "utf8"));
const out = fs.existsSync("data/research.json") ? JSON.parse(fs.readFileSync("data/research.json", "utf8")) : {};
for (const [i, c] of creators.entries()) {
  if (out[c.name]?.done && !(rerun && c.name in WIKI_TITLES) && !(missingOnly && !out[c.name].wikipedia)) continue;
  const prev = out[c.name];
  let w;
  try { w = await wiki(c.name); } catch (e) { console.error(`
${c.name}: ${e.message}; stopping`); break; }
  const d = prev?.channelDescription ?? await channelDescription(c.channel?.handle).catch(() => null);
  out[c.name] = { done: true, wikipedia: w, channelDescription: d };
  fs.writeFileSync("data/research.json", JSON.stringify(out, null, 2));
  process.stderr.write(`\r${i + 1}/${creators.length}`);
  await sleep(missingOnly ? 4000 : 1200);
}
process.stderr.write("\n");
const noWiki = creators.filter(c => !out[c.name].wikipedia).map(c => c.name);
console.log(`Wikipedia found for ${creators.length - noWiki.length}; none for: ${noWiki.join(", ")}`);
