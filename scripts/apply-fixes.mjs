// One-off corrections from verifying the curated list (2026-10-02). Notes are shown to visitors.
import fs from "node:fs";

const SRC = "data/creators.source.json";
const OLDEST = "Their earliest uploads were deleted or made private, so this is the oldest video still public.";
const fixes = {
  "Logan Paul": { note: "Age-restricted by YouTube, so it plays on YouTube rather than here." },
  "Ryan Trahan": { firstVideoId: "yyl8RHdoUb0", note: "His original first video is now private, so this race video is the oldest one still public." },
  "Alan's Universe": { firstVideoId: "AYH23vlzYzo" }, // a 2020 Short, older than anything on the Videos tab
  "Lucas and Marcus": { handle: "LucasandMarcus" },
  "LankyBox": { firstVideoId: "IMuCvEZga7Y" },
  "Supercar Blondie": { firstVideoId: "Oi285tDEnus" },
  "VanossGaming": { firstVideoId: "V5xE-NUcf1M" },
  "penguinz0": { firstVideoId: "-FoH_02Icjk" },
  "David Dobrik": { firstVideoId: "acbA1plzXFY" },
  "Pokimane": { firstVideoId: "mLO_WnRQMNk" },
  "Grian": { firstVideoId: "3cOliXW3nYs", note: OLDEST },
  "Mumbo Jumbo": { firstVideoId: "ldqqOy6MpwE", note: OLDEST },
  "Jeff Nippard": { firstVideoId: "PKxv_hDsTaE" },
  "JoshDub": { firstVideoId: "-wjUD5gv1kg" },
  "Lachlan": { firstVideoId: "cjIPdD19eac" },
  "NichLmao": { firstVideoId: "D3K38sDHQ9Y" }, // a 2019 Short, older than anything on the Videos tab
  "Dan Rhodes": { firstVideoId: "mzTa-pUPSh4" },
  "Anna McNulty": { firstVideoId: "IZy3tc2PetE" },
  "LazarBeam": { firstVideoId: "JFWaV2Qbl2Y" },
  "Shane Dawson": { note: "The original was deleted. This copy was re-uploaded to his archive channel in 2024.", hideDate: true },
  "KSI": { note: "Uploaded to his original channel, JideJunior." },
};

const src = JSON.parse(fs.readFileSync(SRC, "utf8"));
for (const s of src) {
  if (fixes[s.name]) { Object.assign(s, fixes[s.name]); delete s.needsResearch; }
}
fs.writeFileSync(SRC, JSON.stringify(src, null, 2));
console.log(`applied ${Object.keys(fixes).length} fixes`);
