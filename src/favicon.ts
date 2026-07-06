import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { PNG } from "pngjs";
import { hexToHsl, hslToRgb } from "./color.js";
import type { FaviconOptions } from "./types.js";

export interface FaviconResult {
	ext: "svg" | "png";
	content: string | Buffer;
}

/** Matches an existing favicon `<link>` tag, shared with `stripFaviconLinks` in html.ts. */
export const ICON_LINK_RE = /<link\s+[^>]*rel=["'](?:shortcut icon|icon)["'][^>]*>/i;
const HREF_RE = /href=["']([^"']+)["']/i;

const DEFAULT_CANDIDATES = ["public/favicon.svg", "public/favicon.png", "public/favicon.ico"];

export function faviconMimeType(ext: "svg" | "png"): string {
	return ext === "svg" ? "image/svg+xml" : "image/png";
}

/** Find the project's existing favicon: explicit option > index.html <link> > common defaults. */
export async function findFaviconSource(
	root: string,
	options: FaviconOptions | undefined,
): Promise<string | null> {
	if (options?.path) {
		const resolved = path.resolve(root, options.path);
		if (!existsSync(resolved)) {
			throw new Error(`whereami: favicon.path "${options.path}" does not exist`);
		}
		return resolved;
	}

	const indexPath = path.join(root, "index.html");
	if (existsSync(indexPath)) {
		const html = await readFile(indexPath, "utf-8");
		const linkMatch = html.match(ICON_LINK_RE)?.[0];
		const href = linkMatch?.match(HREF_RE)?.[1];
		if (href && !href.startsWith("http") && !href.startsWith("data:")) {
			const resolved = path.resolve(root, href.replace(/^\//, ""));
			if (existsSync(resolved)) return resolved;
		}
	}

	for (const candidate of DEFAULT_CANDIDATES) {
		const resolved = path.join(root, candidate);
		if (existsSync(resolved)) return resolved;
	}

	return null;
}

/** Tint `source` if given, otherwise generate the default letter icon; never throws. */
export async function resolveFavicon(
	source: string | null,
	color: string,
	pkgName: string,
): Promise<FaviconResult> {
	if (!source) return { ext: "svg", content: generateDefaultIcon(color, pkgName) };
	try {
		return await tintFavicon(source, color);
	} catch (err) {
		if (err instanceof UnsupportedFaviconError) {
			console.warn(`[vite-plugin-whereami] ${err.message} — generating a default icon instead`);
			return { ext: "svg", content: generateDefaultIcon(color, pkgName) };
		}
		throw err;
	}
}

/**
 * Recolor an image while preserving its shape: hue/saturation come from `color`,
 * lightness comes from the original pixel. Equivalent to a template/tint-icon effect.
 */
export async function tintFavicon(sourcePath: string, color: string): Promise<FaviconResult> {
	const ext = path.extname(sourcePath).toLowerCase();

	if (ext === ".svg") {
		const svg = await readFile(sourcePath, "utf-8");
		return { ext: "svg", content: tintSvg(svg, color) };
	}

	if (ext === ".png") {
		const buffer = await readFile(sourcePath);
		return { ext: "png", content: tintPng(buffer, color) };
	}

	throw new UnsupportedFaviconError(ext);
}

export class UnsupportedFaviconError extends Error {
	constructor(public ext: string) {
		super(`whereami: unsupported favicon format "${ext}" (only .svg and .png are supported)`);
	}
}

/** Wrap an SVG's content in a `<g filter>` that desaturates it and re-tints it with `color`. */
export function tintSvg(svg: string, color: string): string {
	const match = svg.match(/^([\s\S]*?<svg\b[^>]*>)([\s\S]*)(<\/svg>\s*)$/i);
	if (!match) return svg;
	const [, open, inner, close] = match;

	const filter = `<defs><filter id="whereami-tint" color-interpolation-filters="sRGB">
<feColorMatrix type="saturate" values="0" result="whereami-gray"/>
<feFlood flood-color="${color}" result="whereami-flood"/>
<feComposite in="whereami-flood" in2="SourceGraphic" operator="in" result="whereami-flood-clip"/>
<feBlend in="whereami-flood-clip" in2="whereami-gray" mode="color"/>
</filter></defs>`;

	return `${open}${filter}<g filter="url(#whereami-tint)">${inner}</g>${close}`;
}

/** Per-pixel recolor: keep each pixel's lightness, replace its hue/saturation with `color`'s. */
export function tintPng(buffer: Buffer, color: string): Buffer {
	const { h, s } = hexToHsl(color);
	const png = PNG.sync.read(buffer);

	for (let i = 0; i < png.data.length; i += 4) {
		const r = png.data[i];
		const g = png.data[i + 1];
		const b = png.data[i + 2];
		const l = (Math.max(r, g, b) + Math.min(r, g, b)) / 2 / 255;
		const tinted = hslToRgb(h, s, l);
		png.data[i] = tinted.r;
		png.data[i + 1] = tinted.g;
		png.data[i + 2] = tinted.b;
		// alpha (i + 3) untouched
	}

	return PNG.sync.write(png);
}

/** Generate a simple rounded-square icon with the package name's first letter, in `color`. */
export function generateDefaultIcon(color: string, name: string): string {
	const letter = (name.match(/[a-zA-Z0-9]/)?.[0] ?? "W").toUpperCase();
	return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
<rect width="64" height="64" rx="14" fill="${color}"/>
<text x="32" y="43" font-family="ui-sans-serif, system-ui, sans-serif" font-size="34" font-weight="700" fill="#fff" text-anchor="middle">${letter}</text>
</svg>`;
}
