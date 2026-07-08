// ── Odds → Implied Probability content script ──────────────────────────────

// ── Odds utilities ────────────────────────────────────────────────────────────

function parseOdds(text) {
  text = text.trim();

  // American: explicit sign, ±100–9999
  if (/^[+-]\d{2,4}$/.test(text)) {
    const n = parseInt(text, 10);
    if (Math.abs(n) >= 100 && Math.abs(n) <= 9999) return { format: "american", value: n };
    return null;
  }

  // Fractional: e.g. 5/1, 11/4 — implied probability must be 0.5%–99.5%
  if (/^\d{1,3}\/\d{1,3}$/.test(text)) {
    const [num, den] = text.split("/").map(Number);
    if (den === 0) return null;
    const prob = den / (num + den);
    if (prob < 0.005 || prob > 0.995) return null;
    return { format: "fractional", num, den };
  }

  // Decimal: exactly 2 decimal places, 1.01–200.00
  if (/^\d{1,3}\.\d{2}$/.test(text)) {
    const n = parseFloat(text);
    if (n >= 1.01 && n <= 200.00) return { format: "decimal", value: n };
  }

  return null;
}

function toImpliedProbability(parsed) {
  if (!parsed) return null;
  let prob;
  if (parsed.format === "american") {
    const v = parsed.value;
    prob = v > 0 ? 100 / (v + 100) : Math.abs(v) / (Math.abs(v) + 100);
  } else if (parsed.format === "decimal") {
    prob = 1 / parsed.value;
  } else if (parsed.format === "fractional") {
    prob = parsed.den / (parsed.num + parsed.den);
  } else {
    return null;
  }
  return Math.round(prob * 10000) / 100;
}

function formatLabel(parsed) {
  return { american: "American", decimal: "Decimal", fractional: "Fractional" }[parsed?.format] || "";
}

// ── State ─────────────────────────────────────────────────────────────────────

let toggleMode = false;
let extensionEnabled = true;
const SPAN_CLASS = "odds-iv-span";
const TOOLTIP_ID = "odds-iv-tooltip";

// ── Tooltip ───────────────────────────────────────────────────────────────────

function getTooltip() {
  let tip = document.getElementById(TOOLTIP_ID);
  if (!tip) {
    tip = document.createElement("div");
    tip.id = TOOLTIP_ID;
    document.body.appendChild(tip);
  }
  return tip;
}

function showTooltip(text, x, y) {
  const tip = getTooltip();
  tip.textContent = text;
  tip.style.left = x + "px";
  tip.style.top  = y + "px";
  tip.classList.add("visible");
}

function hideTooltip() {
  const tip = document.getElementById(TOOLTIP_ID);
  if (tip) tip.classList.remove("visible");
}

// ── Currency detection ────────────────────────────────────────────────────────
// Catches both "£2.50" (symbol in same text node) and "<span>£</span>2.50"
// (symbol in a sibling element).

const CURRENCY_RE = /[£$€¥₹₩₽¢]/;

function nodeHasCurrencyContext(node) {
  // Currency in the same text node (e.g. "£2.50 stake")
  if (CURRENCY_RE.test(node.nodeValue)) return true;

  // Currency in an immediately preceding sibling node/element
  const prev = node.previousSibling;
  if (prev) {
    const prevText = prev.nodeType === Node.TEXT_NODE
      ? prev.nodeValue
      : prev.textContent || "";
    if (CURRENCY_RE.test(prevText)) return true;
  }

  // Currency in the parent element's direct text or a preceding child
  const parent = node.parentElement;
  if (parent && CURRENCY_RE.test(parent.textContent || "")) {
    // Only bail if the currency is in a sibling, not a descendant of us
    for (const child of parent.childNodes) {
      if (child === node) break; // stop at our own node
      const childText = child.nodeType === Node.TEXT_NODE
        ? child.nodeValue
        : child.textContent || "";
      if (CURRENCY_RE.test(childText)) return true;
    }
  }

  return false;
}

// ── Text node wrapping ────────────────────────────────────────────────────────

const SKIP_TAGS = new Set([
  "SCRIPT","STYLE","NOSCRIPT","TEXTAREA","INPUT","SELECT","OPTION",
  "IFRAME","SVG","CANVAS","NAV","FOOTER","TIME","CODE","PRE"
]);

// Lookbehinds block currency/letters/digits/% so we never re-match our own output.
// The % lookahead specifically prevents re-matching "66.67" inside "66.67%".
const ODDS_RE = /(?<![£$€¥₹₩₽¢\d.a-zA-Z%])([+-]\d{2,4})(?![\d.a-zA-Z%])|(?<![£$€¥₹₩₽¢\d.\/a-zA-Z%])(\d{1,3}\.\d{2})(?![\d.a-zA-Z%\/])|(?<![£$€¥₹₩₽¢\d.\/a-zA-Z%])(\d{1,3})\/(\d{1,3})(?![\/\d])/g;

function wrapTextNode(node) {
  const parent = node.parentElement;
  if (!parent) return;
  if (parent.classList.contains(SPAN_CLASS) || parent.closest(`.${SPAN_CLASS}`)) return;
  if (SKIP_TAGS.has(parent.tagName)) return;

  // Skip anything near a currency symbol — these are prices/stakes, not odds
  if (nodeHasCurrencyContext(node)) return;

  const text = node.nodeValue;
  if (!text || !text.trim()) return;

  ODDS_RE.lastIndex = 0;
  const parts = [];
  let lastIndex = 0;
  let found = false;
  let match;

  while ((match = ODDS_RE.exec(text)) !== null) {
    const raw    = match[0];
    const parsed = parseOdds(raw);
    if (!parsed) continue;
    const iv = toImpliedProbability(parsed);
    if (iv === null) continue;

    found = true;
    if (match.index > lastIndex) {
      parts.push(document.createTextNode(text.slice(lastIndex, match.index)));
    }

    const span = document.createElement("span");
    span.className         = SPAN_CLASS;
    span.dataset.original  = raw;
    span.dataset.iv        = String(iv);
    span.dataset.ivDisplay = iv + "%";  // consumed by CSS ::after
    span.dataset.format    = formatLabel(parsed);
    span.textContent       = raw;       // NEVER changed — toggle uses CSS only

    if (toggleMode) span.classList.add("iv-mode");

    const fs = window.getComputedStyle(parent).fontSize;
    if (fs) span.style.setProperty("--odds-iv-font-size", fs);

    parts.push(span);
    lastIndex = match.index + raw.length;
  }

  if (!found) return;
  if (lastIndex < text.length) {
    parts.push(document.createTextNode(text.slice(lastIndex)));
  }

  const parentNode = node.parentNode;
  if (!parentNode) return;
  const frag = document.createDocumentFragment();
  parts.forEach(p => frag.appendChild(p));
  parentNode.replaceChild(frag, node);
}

function walkNode(root) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      const p = node.parentElement;
      if (!p) return NodeFilter.FILTER_REJECT;
      if (SKIP_TAGS.has(p.tagName)) return NodeFilter.FILTER_REJECT;
      if (p.classList.contains(SPAN_CLASS)) return NodeFilter.FILTER_REJECT;
      if (p.closest(`.${SPAN_CLASS}`)) return NodeFilter.FILTER_REJECT;
      return NodeFilter.FILTER_ACCEPT;
    }
  });
  const nodes = [];
  let n;
  while ((n = walker.nextNode())) nodes.push(n);
  nodes.forEach(wrapTextNode);
}

// ── Toggle mode ───────────────────────────────────────────────────────────────
// Only adds/removes CSS classes — textContent is never touched.

function applyToggleToSpans() {
  document.querySelectorAll(`.${SPAN_CLASS}`).forEach(span => {
    if (toggleMode) {
      span.classList.add("iv-mode");
    } else {
      span.classList.remove("iv-mode", "iv-hovered");
    }
  });
}

// ── Hover events ──────────────────────────────────────────────────────────────

document.addEventListener("mouseover", e => {
  const span = e.target.closest(`.${SPAN_CLASS}`);
  if (!span) return;

  if (toggleMode) {
    span.classList.add("iv-hovered");
  } else {
    const rect = span.getBoundingClientRect();
    showTooltip(
      `IV: ${span.dataset.iv}%  (${span.dataset.format})`,
      rect.left + window.scrollX,
      rect.top  + window.scrollY - 32
    );
  }
});

document.addEventListener("mouseout", e => {
  const span = e.target.closest(`.${SPAN_CLASS}`);
  if (!span) return;
  if (span.contains(e.relatedTarget)) return;

  if (toggleMode) {
    span.classList.remove("iv-hovered");
  } else {
    hideTooltip();
  }
});

// ── MutationObserver ──────────────────────────────────────────────────────────

const observer = new MutationObserver(mutations => {
  mutations.forEach(m => {
    m.addedNodes.forEach(node => {
      if (node.nodeType === Node.TEXT_NODE) {
        wrapTextNode(node);
      } else if (node.nodeType === Node.ELEMENT_NODE) {
        if (!SKIP_TAGS.has(node.tagName) && !node.classList.contains(SPAN_CLASS)) {
          walkNode(node);
        }
      }
    });
  });
});

// ── Enable / disable ─────────────────────────────────────────────────────────

function stripAllSpans() {
  document.querySelectorAll(`.${SPAN_CLASS}`).forEach(span => {
    span.replaceWith(document.createTextNode(span.dataset.original));
  });
}

function enable() {
  extensionEnabled = true;
  walkNode(document.body);
  observer.observe(document.body, { childList: true, subtree: true });
}

function disable() {
  extensionEnabled = false;
  observer.disconnect();
  hideTooltip();
  stripAllSpans();
}

// ── Messages from popup ───────────────────────────────────────────────────────

chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === "SET_ENABLED") {
    msg.value ? enable() : disable();
  } else if (msg.type === "SET_TOGGLE") {
    toggleMode = msg.value;
    if (extensionEnabled) applyToggleToSpans();
  }
});

// ── Init ──────────────────────────────────────────────────────────────────────

chrome.storage.sync.get(["enabled", "toggleMode"], ({ enabled, toggleMode: saved }) => {
  extensionEnabled = enabled !== false;
  toggleMode = !!saved;
  if (extensionEnabled) {
    walkNode(document.body);
    observer.observe(document.body, { childList: true, subtree: true });
  }
});
