// Prints research notes for a slice of creators: node scripts/dump-research.mjs <start> <end>
import fs from "node:fs";
const [start, end] = process.argv.slice(2).map(Number);
const r = JSON.parse(fs.readFileSync("data/research.json", "utf8"));
const c = JSON.parse(fs.readFileSync("data/creators.json", "utf8"));
for (const e of c.slice(start, end)) {
  const v = r[e.name];
  console.log(`### ${e.name} | subs ${e.channel?.subscribersText} | first: "${e.first?.title}" ${e.first?.uploadDate} on ${e.first?.channelName}${e.note ? ` | NOTE: ${e.note}` : ""}`);
  console.log(`WIKI(${v.wikipedia?.title || "none"}): ${(v.wikipedia?.intro || "").replace(/\s+/g, " ").slice(0, 1400)}`);
  console.log(`CHANNEL: ${(v.channelDescription || "").replace(/\s+/g, " ").slice(0, 300)}\n`);
}
