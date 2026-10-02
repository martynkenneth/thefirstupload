// Prints a review table of every creator's chosen first video. Usage: node scripts/report.mjs [names...]
import fs from "node:fs";

const data = JSON.parse(fs.readFileSync("data/creators.json", "utf8"));
const names = process.argv.slice(2);
for (const e of data.filter(e => !names.length || names.includes(e.name))) {
  const f = e.first || {};
  console.log([e.name.padEnd(22), f.uploadDate || "?", `${f.lengthSeconds ?? "?"}s`.padStart(6), f.status, (f.title || "").slice(0, 55)].join("  "));
}
