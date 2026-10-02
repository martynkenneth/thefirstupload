# The First Upload (thefirstupload.com)

A static site showing the first YouTube videos of 100 big creators, side by side with their latest uploads.

## Files

- `data/creators.source.json`: the curated list (name, channel handle, first video ID, optional `note` shown to visitors). Edit this one.
- `data/creators.json`: generated. Verified video details, channel stats and latest uploads.
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
