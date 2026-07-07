// Odds detection and conversion utilities

// Regex patterns for each odds format
const PATTERNS = {
  // American: +150, -110, +1200, -300 (must have sign)
  american: /^([+-]\d{2,4})$/,

  // Decimal: 1.5, 2.00, 11.0, 1.01 (number with decimal point, >= 1.01)
  decimal: /^(\d{1,3}\.\d{1,2})$/,

  // Fractional UK: 5/1, 11/4, 1/2, 100/30
  fractional: /^(\d+)\/(\d+)$/,

  // European (same as decimal but sometimes shown without sign context)
  // Handled by decimal pattern
};

// Combined inline text regex for scanning DOM text nodes
// Matches: +150, -110, 2.50, 5/1, 11/4 etc.
const INLINE_REGEX = /(?<![\/\d])([+-]\d{2,4})(?![\d\/])|(?<!\d)(\d{1,3}\.\d{1,2})(?!\d)|(?<!\d)(\d+)\/(\d+)(?!\d)/g;

function parseOdds(text) {
  text = text.trim();

  // American
  if (/^[+-]\d{2,4}$/.test(text)) {
    const n = parseInt(text, 10);
    return { format: "american", value: n };
  }

  // Fractional
  if (/^\d+\/\d+$/.test(text)) {
    const [num, den] = text.split("/").map(Number);
    return { format: "fractional", num, den };
  }

  // Decimal (must be >= 1.01 to be a valid odds)
  if (/^\d{1,3}\.\d{1,2}$/.test(text)) {
    const n = parseFloat(text);
    if (n >= 1.01 && n <= 1001) {
      return { format: "decimal", value: n };
    }
  }

  return null;
}

function toImpliedProbability(parsed) {
  if (!parsed) return null;

  let prob;
  switch (parsed.format) {
    case "american": {
      const v = parsed.value;
      prob = v > 0 ? 100 / (v + 100) : Math.abs(v) / (Math.abs(v) + 100);
      break;
    }
    case "decimal":
      prob = 1 / parsed.value;
      break;
    case "fractional":
      prob = parsed.den / (parsed.num + parsed.den);
      break;
    default:
      return null;
  }

  return Math.round(prob * 10000) / 100; // e.g. 66.67
}

function formatLabel(parsed) {
  if (!parsed) return "";
  switch (parsed.format) {
    case "american": return "American";
    case "decimal":  return "Decimal";
    case "fractional": return "Fractional";
    default: return "";
  }
}

// Export for use in content.js (loaded via importScripts or inline)
if (typeof module !== "undefined") {
  module.exports = { parseOdds, toImpliedProbability, formatLabel, INLINE_REGEX };
}
