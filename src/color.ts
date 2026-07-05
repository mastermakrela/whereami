export interface Hsl {
	h: number;
	s: number;
	l: number;
}

export function parseHexColor(hex: string): { r: number; g: number; b: number } {
	const normalized = hex.replace("#", "");
	const full =
		normalized.length === 3
			? normalized
					.split("")
					.map((c) => c + c)
					.join("")
			: normalized;
	const int = Number.parseInt(full, 16);
	if (full.length !== 6 || Number.isNaN(int)) {
		throw new Error(`whereami: invalid hex color "${hex}"`);
	}
	return {
		r: (int >> 16) & 255,
		g: (int >> 8) & 255,
		b: int & 255,
	};
}

export function hexToHsl(hex: string): Hsl {
	const { r, g, b } = parseHexColor(hex);
	return rgbToHsl(r, g, b);
}

export function rgbToHsl(r: number, g: number, b: number): Hsl {
	const rn = r / 255;
	const gn = g / 255;
	const bn = b / 255;
	const max = Math.max(rn, gn, bn);
	const min = Math.min(rn, gn, bn);
	const l = (max + min) / 2;

	if (max === min) {
		return { h: 0, s: 0, l };
	}

	const d = max - min;
	const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
	let h: number;
	switch (max) {
		case rn:
			h = (gn - bn) / d + (gn < bn ? 6 : 0);
			break;
		case gn:
			h = (bn - rn) / d + 2;
			break;
		default:
			h = (rn - gn) / d + 4;
			break;
	}
	h /= 6;

	return { h, s, l };
}

export function hslToRgb(h: number, s: number, l: number): { r: number; g: number; b: number } {
	if (s === 0) {
		const v = Math.round(l * 255);
		return { r: v, g: v, b: v };
	}

	const hue2rgb = (p: number, q: number, t: number): number => {
		let tt = t;
		if (tt < 0) tt += 1;
		if (tt > 1) tt -= 1;
		if (tt < 1 / 6) return p + (q - p) * 6 * tt;
		if (tt < 1 / 2) return q;
		if (tt < 2 / 3) return p + (q - p) * (2 / 3 - tt) * 6;
		return p;
	};

	const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
	const p = 2 * l - q;

	return {
		r: Math.round(hue2rgb(p, q, h + 1 / 3) * 255),
		g: Math.round(hue2rgb(p, q, h) * 255),
		b: Math.round(hue2rgb(p, q, h - 1 / 3) * 255),
	};
}
