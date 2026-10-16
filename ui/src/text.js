// SPDX-License-Identifier: MIT
/* Text on the canvas: one font for the whole screen, digits that keep their place,
   and cutting text to a length. */

export function font(size, weight = 700) {
  return `${weight} ${size}px system-ui, -apple-system, "Segoe UI", sans-serif`;
}

/** Draw `value` at x, y and return its width. */
export function text(ctx, value, x, y, size, { weight = 700, align = 'center' } = {}) {
  ctx.font = font(size, weight);
  ctx.textAlign = align;
  ctx.textBaseline = 'middle';
  ctx.fillText(value, x, y);
  return ctx.measureText(value).width;
}

/** Draw `value` centred on x, y with every digit in a cell of the same width, so
    that a changing digit never shifts the others (canvas text has no tabular
    figures). */
export function digits(ctx, value, x, y, size) {
  ctx.font = font(size);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const chars = [...value];
  const widths = chars.map((c) => (/[0-9]/.test(c) ? 0.62 * size : ctx.measureText(c).width + 0.06 * size));
  let left = x - widths.reduce((sum, w) => sum + w, 0) / 2;
  chars.forEach((c, i) => {
    ctx.fillText(c, left + widths[i] / 2, y);
    left += widths[i];
  });
}

/** At most `length` characters of `value`: characters, not UTF-16 units, so that
    an emoji is never cut in half. */
export const clip = (value, length) => [...value].slice(0, length).join('');
