/**
 * Normalizes any color input into a valid 7-character lowercase hex string (#rrggbb)
 * for safe consumption by HTML5 <input type="color">.
 */
export function toValidHexColor(val: unknown, fallback = '#00e5ff'): string {
  if (typeof val !== 'string') return fallback;
  const str = val.trim();
  if (/^#[0-9a-fA-F]{6}$/.test(str)) return str.toLowerCase();
  if (/^#[0-9a-fA-F]{3}$/.test(str)) {
    return `#${str[1]}${str[1]}${str[2]}${str[2]}${str[3]}${str[3]}`.toLowerCase();
  }
  if (/^[0-9a-fA-F]{6}$/.test(str)) return `#${str}`.toLowerCase();
  if (/^[0-9a-fA-F]{3}$/.test(str)) {
    return `#${str[0]}${str[0]}${str[1]}${str[1]}${str[2]}${str[2]}`.toLowerCase();
  }
  return fallback;
}
