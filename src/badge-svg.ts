// The quotes around the multi-word family MUST be `&quot;` entities: this string is
// interpolated into a double-quoted XML attribute, and raw `"` would close it early and
// leave the rest as stray markup — which browsers reject outright, since SVG served as
// image/svg+xml is parsed as strict XML rather than forgiving HTML.
const FONT_FAMILY =
	"ui-monospace, SFMono-Regular, Menlo, Consolas, &quot;Liberation Mono&quot;, monospace";
const FONT_SIZE = 11;
const HEIGHT = 20;
// Width per side = characters * this + 10px padding on each side. Monospace is what
// makes this a simple character count instead of needing real font metrics: every
// glyph is the same advance width, so `label.length` is all we need to size the box.
const CHAR_WIDTH = 6.6;
const PADDING = 20;
/** Used both as the last-resort default upstream and as the guard's fallback for a non-hex color. */
export const FALLBACK_COLOR = "#0b7285";
const HEX_COLOR_RE = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

export interface BadgeSvgInput {
	/** Left-hand label, e.g. "deployed". */
	label: string;
	/** Right-hand value, e.g. "v1.2.3". */
	value: string;
	/** Hex color for the right-hand side, e.g. "#0b7285". */
	color: string;
}

function escapeXml(value: string): string {
	return value
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;")
		.replace(/'/g, "&apos;");
}

function textWidth(text: string): number {
	return Math.round(text.length * CHAR_WIDTH) + PADDING;
}

function resolveColor(color: string): string {
	return HEX_COLOR_RE.test(color) ? color : FALLBACK_COLOR;
}

/**
 * Renders a shields.io-style two-part badge as a self-contained SVG string.
 *
 * `textLength` + `lengthAdjust="spacingAndGlyphs"` on every `<text>` pins the glyphs to
 * the box we computed from `CHAR_WIDTH`, regardless of which monospace font the
 * viewer's browser actually substitutes for our font-family list — without it, the
 * pill's background width (chosen at render time, before any font is available) and
 * the text's real rendered width can drift apart on a different fallback font.
 *
 * The output is a pure function of `input`: no timestamps, ids, or randomness, so the
 * same input always produces a byte-identical string (used as an ETag upstream).
 */
export function renderBadgeSvg(input: BadgeSvgInput): string {
	const label = escapeXml(input.label);
	const value = escapeXml(input.value);
	const color = resolveColor(input.color);

	const leftWidth = textWidth(input.label);
	const rightWidth = textWidth(input.value);
	const width = leftWidth + rightWidth;
	const leftTextLength = leftWidth - PADDING;
	const rightTextLength = rightWidth - PADDING;
	const leftX = leftWidth / 2;
	const rightX = leftWidth + rightWidth / 2;
	const ariaLabel = `${label}: ${value}`;

	return (
		`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${HEIGHT}" role="img" aria-label="${ariaLabel}">` +
		`<title>${ariaLabel}</title>` +
		`<clipPath id="whereami-badge-r"><rect width="${width}" height="${HEIGHT}" rx="3"/></clipPath>` +
		`<g clip-path="url(#whereami-badge-r)">` +
		`<rect width="${leftWidth}" height="${HEIGHT}" fill="#555"/>` +
		`<rect x="${leftWidth}" width="${rightWidth}" height="${HEIGHT}" fill="${color}"/>` +
		`</g>` +
		`<g fill="#fff" text-anchor="middle" font-family="${FONT_FAMILY}" font-size="${FONT_SIZE}">` +
		`<text x="${leftX}" y="15" fill="#010101" fill-opacity=".3" textLength="${leftTextLength}" lengthAdjust="spacingAndGlyphs">${label}</text>` +
		`<text x="${leftX}" y="14" textLength="${leftTextLength}" lengthAdjust="spacingAndGlyphs">${label}</text>` +
		`<text x="${rightX}" y="15" fill="#010101" fill-opacity=".3" textLength="${rightTextLength}" lengthAdjust="spacingAndGlyphs">${value}</text>` +
		`<text x="${rightX}" y="14" textLength="${rightTextLength}" lengthAdjust="spacingAndGlyphs">${value}</text>` +
		`</g>` +
		`</svg>`
	);
}
