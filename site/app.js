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

// Hero showcase: cycles through examples; pauses on hover/focus; no autoplay with reduced motion.
const showcase = document.querySelector(".showcase");
if (showcase) {
  const slides = [...showcase.querySelectorAll(".slide")];
  const dots = [...showcase.querySelectorAll(".dots button")];
  let current = 0, paused = false;
  const go = i => {
    current = (i + slides.length) % slides.length;
    slides.forEach((s, j) => {
      s.classList.toggle("active", j === current);
      s.toggleAttribute("aria-hidden", j !== current);
      s.tabIndex = j === current ? 0 : -1;
    });
    dots.forEach((d, j) => d.setAttribute("aria-current", String(j === current)));
  };
  dots.forEach((d, j) => d.addEventListener("click", () => go(j)));
  showcase.addEventListener("pointerenter", () => (paused = true));
  showcase.addEventListener("pointerleave", () => (paused = false));
  showcase.addEventListener("focusin", () => (paused = true));
  showcase.addEventListener("focusout", () => (paused = false));
  if (!matchMedia("(prefers-reduced-motion: reduce)").matches && slides.length > 1) {
    setInterval(() => { if (!paused && !document.hidden) go(current + 1); }, 5000);
  }
}

// Subscriber chart tooltip: follows hover and keyboard focus on each column.
for (const chart of document.querySelectorAll(".chart")) {
  const tip = chart.querySelector(".chart-tip");
  const show = col => {
    if (!col?.dataset.tip) return;
    tip.textContent = col.dataset.tip;
    tip.hidden = false;
    const c = chart.getBoundingClientRect(), b = col.getBoundingClientRect(), bar = col.querySelector(".bar").getBoundingClientRect();
    const left = Math.min(Math.max(b.left - c.left + b.width / 2 - tip.offsetWidth / 2, 0), c.width - tip.offsetWidth);
    tip.style.left = `${left}px`;
    tip.style.top = `${Math.max(bar.top - c.top - tip.offsetHeight - 10, 0)}px`;
  };
  const hide = () => (tip.hidden = true);
  chart.addEventListener("pointerover", e => show(e.target.closest(".col")));
  chart.addEventListener("pointerleave", hide);
  chart.addEventListener("focusin", e => show(e.target.closest(".col")));
  chart.addEventListener("focusout", hide);
}

// Homepage search and sort.
const grid = document.getElementById("cards");
if (grid) {
  const cards = [...grid.children];
  const search = document.getElementById("search");
  const sort = document.getElementById("sort");
  const category = document.getElementById("category");
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
      const match = (!q || card.dataset.name.includes(q)) && (!category.value || card.dataset.category === category.value);
      card.hidden = !match;
      shown += match;
      grid.appendChild(card);
    });
    empty.hidden = shown > 0;
  };
  search.addEventListener("input", update);
  sort.addEventListener("change", update);
  category.addEventListener("change", update);
}
