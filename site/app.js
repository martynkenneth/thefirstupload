// Click-to-play: swap the thumbnail for YouTube's player only when asked.
document.addEventListener("click", e => {
  const btn = e.target.closest("button.player[data-video]");
  if (!btn) return;
  const iframe = document.createElement("iframe");
  iframe.src = `https://www.youtube-nocookie.com/embed/${btn.dataset.video}?autoplay=1&rel=0`;
  iframe.title = btn.getAttribute("aria-label");
  iframe.allow = "autoplay; encrypted-media; picture-in-picture; fullscreen";
  iframe.allowFullscreen = true;
  const wrap = document.createElement("div");
  wrap.className = "player";
  wrap.append(iframe);
  btn.replaceWith(wrap);
});

// Homepage search and sort.
const grid = document.getElementById("cards");
if (grid) {
  const cards = [...grid.children];
  const search = document.getElementById("search");
  const sort = document.getElementById("sort");
  const empty = document.getElementById("empty");
  const sorters = {
    rank: (a, b) => a.dataset.rank - b.dataset.rank,
    oldest: (a, b) => (a.dataset.date || "9999").localeCompare(b.dataset.date || "9999"),
    newest: (a, b) => (b.dataset.date || "").localeCompare(a.dataset.date || ""),
    views: (a, b) => b.dataset.views - a.dataset.views,
    name: (a, b) => a.dataset.name.localeCompare(b.dataset.name),
  };
  const update = () => {
    const q = search.value.trim().toLowerCase();
    let shown = 0;
    cards.sort(sorters[sort.value]).forEach(card => {
      const match = !q || card.dataset.name.includes(q);
      card.hidden = !match;
      shown += match;
      grid.appendChild(card);
    });
    empty.hidden = shown > 0;
  };
  search.addEventListener("input", update);
  sort.addEventListener("change", update);
}
