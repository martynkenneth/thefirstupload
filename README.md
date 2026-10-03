# The First Upload (thefirstupload.com)

A static site showing the first YouTube videos of the biggest creators, side by side with their latest uploads.

## Files

- `data/creators.source.json`: the curated list (name, channel handle, first video ID, optional `note` shown to visitors). Edit this one.
- `data/creators.json`: generated. Verified video details, channel stats and latest uploads.
- `data/articles/<slug>.md`: the mini wiki article for each creator. Front matter (`realName`, `from`, `knownFor`, `category`, `wikipedia`) fills the Quick facts box and the homepage category filter; the body uses `## ` headings and paragraphs.
- `scripts/research.mjs`: collects Wikipedia intros and channel descriptions into `data/research.json` (not committed) as source material for writing articles.
- `data/history.json`: subscriber counts per year for the growth charts, each read from an Internet Archive snapshot of the creator's own channel page (the source link is kept with every figure). Built by `scripts/history.mjs` (slow: about 1.5 hours for all creators) and checked with `scripts/check-history.mjs`. Years without a readable snapshot are left empty, never estimated. Counts are exact until about 2019, then rounded the way YouTube displayed them.
- `scripts/resolve.mjs`: checks each creator against YouTube's public pages (no API key needed) and writes `creators.json`.
- `scripts/build.mjs`: generates the site into `dist/`.
- `site/`: stylesheet and the small script for search, sort and click-to-play.

## Commands

```bash
npm run refresh            # re-check all creators (slow: about 5 minutes)
node scripts/resolve.mjs --issues   # re-check only creators with problems
npm run build              # build dist/
npm run preview            # serve dist/ at http://localhost:4173
```

## Deploying

The site is hosted on Netlify, connected to this repository. `netlify.toml` tells Netlify to run the build and publish `dist/`, so pushing to `main` updates the live site. `dist/` itself is not committed.

To update the stats: run `npm run refresh`, then commit and push `data/creators.json`.

## Notes

- "First video" means the oldest video still public. Where the true first upload was deleted, made private or posted on another channel, the creator's `note` says so.
- YouTube rate-limits heavy use. If a refresh reports `fetch failed`, wait a while and run it again with `--issues`. Failed lookups never overwrite good data.
