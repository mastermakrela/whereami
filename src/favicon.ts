import { hexToHsl, hslToRgb } from "./color.js";
import { importUnbundled, loadNodeIO, type NodeIO } from "./node-io.js";
import type { FaviconOptions } from "./types.js";

export interface FaviconResult {
	ext: "svg" | "png";
	content: string | Uint8Array;
}

/** Matches an existing favicon `<link>` tag, shared with `stripFaviconLinks` in html.ts. */
export const ICON_LINK_RE = /<link\s+[^>]*rel=["'](?:shortcut icon|icon)["'][^>]*>/i;
const HREF_RE = /href=["']([^"']+)["']/i;

const DEFAULT_CANDIDATES = ["public/favicon.svg", "public/favicon.png", "public/favicon.ico"];

export function faviconMimeType(ext: "svg" | "png"): string {
	return ext === "svg" ? "image/svg+xml" : "image/png";
}

/**
 * Inline a resolved favicon as a `data:` URI, for the SvelteKit handle — there's no Vite
 * build pipeline to emit an asset file into at request time. Encoded via `btoa` rather than
 * `Buffer`, which doesn't exist on edge/isolate runtimes.
 */
export function faviconDataUri(favicon: FaviconResult): string {
	const bytes =
		typeof favicon.content === "string"
			? new TextEncoder().encode(favicon.content)
			: favicon.content;
	let binary = "";
	for (const byte of bytes) binary += String.fromCharCode(byte);
	return `data:${faviconMimeType(favicon.ext)};base64,${btoa(binary)}`;
}

async function exists(io: NodeIO, target: string): Promise<boolean> {
	try {
		await io.fs.stat(target);
		return true;
	} catch {
		return false;
	}
}

/**
 * Find the project's existing favicon: explicit option > index.html <link> > common defaults.
 * Returns null on runtimes without a filesystem — the caller falls back to the generated
 * letter icon, which needs no disk access.
 */
export async function findFaviconSource(
	root: string,
	options: FaviconOptions | undefined,
): Promise<string | null> {
	const io = await loadNodeIO();
	if (!io) {
		if (options?.path) {
			console.warn(
				`[vite-plugin-whereami] favicon.path "${options.path}" can't be read without a filesystem (edge/isolate runtime) — generating a default icon instead`,
			);
		}
		return null;
	}

	if (options?.path) {
		const resolved = io.path.resolve(root, options.path);
		if (!(await exists(io, resolved))) {
			throw new Error(`whereami: favicon.path "${options.path}" does not exist`);
		}
		return resolved;
	}

	const indexPath = io.path.join(root, "index.html");
	if (await exists(io, indexPath)) {
		const html = await io.fs.readFile(indexPath, "utf-8");
		const linkMatch = html.match(ICON_LINK_RE)?.[0];
		const href = linkMatch?.match(HREF_RE)?.[1];
		if (href && !href.startsWith("http") && !href.startsWith("data:")) {
			const resolved = io.path.resolve(root, href.replace(/^\//, ""));
			if (await exists(io, resolved)) return resolved;
		}
	}

	// Sequential on purpose: `DEFAULT_CANDIDATES` is in preference order and the first hit
	// wins, so checking them in parallel would only stat files we don't need.
	for (const candidate of DEFAULT_CANDIDATES) {
		const resolved = io.path.join(root, candidate);
		// oxlint-disable-next-line no-await-in-loop
		if (await exists(io, resolved)) return resolved;
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
	// Cached, and always resolved here: `sourcePath` can only have come from
	// `findFaviconSource`, which returns null when there is no filesystem.
	const io = await loadNodeIO();
	if (!io) throw new Error("whereami: no filesystem available to read the favicon");

	const ext = io.path.extname(sourcePath).toLowerCase();

	if (ext === ".svg") {
		const svg = await io.fs.readFile(sourcePath, "utf-8");
		return { ext: "svg", content: tintSvg(svg, color) };
	}

	if (ext === ".png") {
		const buffer = await io.fs.readFile(sourcePath);
		return { ext: "png", content: await tintPng(buffer, color) };
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

/**
 * Per-pixel recolor: keep each pixel's lightness, replace its hue/saturation with `color`'s.
 * `pngjs` is loaded through `importUnbundled` so it (and its `zlib`/`util`/`stream` needs)
 * only load when a `.png` favicon is actually tinted — which requires a filesystem, so an
 * edge bundle must never pull it in. The default SVG letter icon doesn't need it either.
 */
export async function tintPng(buffer: Buffer, color: string): Promise<Buffer> {
	const { PNG } = await importUnbundled<typeof import("pngjs")>("pngjs");
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
