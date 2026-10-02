// Flags suspicious points in data/history.json for manual review against their archived source.
// Usage: node scripts/check-history.mjs
import fs from "node:fs";

const history = JSON.parse(fs.readFileSync("data/history.json", "utf8"));
const creators = JSON.parse(fs.readFileSync("data/creators.json", "utf8"));
const parseCount = t => {
  const m = String(t || "").replace(/,/g, "").match(/([\d.]+)\s*([KMB])?/i);
  return m ? Number(m[1]) * ({ K: 1e3, M: 1e6, B: 1e9 }[(m[2] || "").toUpperCase()] || 1) : 0;
};

let flagged = 0;
for (const c of creators) {
  const points = history[c.name]?.points || [];
  const now = parseCount(c.channel?.subscribersText);
  const issues = [];
  points.forEach((p, i) => {
    const prev = points[i - 1];
    if (prev && p.subs < prev.subs * 0.75) issues.push(`${p.date}: ${p.subs.toLocaleString()} is a big drop from ${prev.subs.toLocaleString()} on ${prev.date}`);
    if (now && p.subs > now * 1.15) issues.push(`${p.date}: ${p.subs.toLocaleString()} is above today's ${now.toLocaleString()}`);
    if (p.exact && p.date >= "2020") issues.push(`${p.date}: exact count after 2019 (YouTube showed rounded counts then)`);
  });
  if (issues.length) { flagged++; console.log(`${c.name}\n  ${issues.join("\n  ")}`); }
}
const covered = creators.filter(c => (history[c.name]?.points || []).length >= 2).length;
console.log(`\n${covered}/${creators.length} creators have a chart (2+ records); ${flagged} flagged for review.`);
