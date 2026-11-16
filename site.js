// ── Change this one line to update the date across every page ──
const LAST_UPDATED = '19/07/2026';

document.querySelectorAll('.last-updated').forEach(el => {
  el.textContent = 'last updated ' + LAST_UPDATED;
});

// temporary: redesign notice (delete this block when the new design ships)
const wip = document.createElement('div');
wip.textContent = '🚧 redesign in progress — things might look different soon 🚧';
wip.style.cssText = 'background:#ffe27a;color:#333;text-align:center;font-size:0.85rem;padding:0.45rem 1rem;border-bottom:1px solid #e6c85a;';
document.body.prepend(wip);
const bs = getComputedStyle(document.body);
wip.style.margin = `-${bs.paddingTop} -${bs.paddingRight} 2rem -${bs.paddingLeft}`;
