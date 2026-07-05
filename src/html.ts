import type { HtmlTagDescriptor } from "vite";
import type { ResolvedBannerOptions } from "./types.js";

const TITLE_RE = /(<title>)([\s\S]*?)(<\/title>)/i;

export function applyTitlePrefix(html: string, prefix: string): string {
	if (!prefix || !TITLE_RE.test(html)) return html;
	return html.replace(TITLE_RE, (_m, open, text, close) => `${open}${prefix}${text}${close}`);
}

/** Remove any existing favicon `<link>` tags so ours doesn't end up alongside a stale one. */
export function stripFaviconLinks(html: string): string {
	return html.replace(/<link\s+[^>]*rel=["'](?:shortcut icon|icon)["'][^>]*>\s*/gi, "");
}

export function faviconLinkTag(href: string, ext: "svg" | "png"): HtmlTagDescriptor {
	return {
		tag: "link",
		injectTo: "head",
		attrs: {
			rel: "icon",
			type: ext === "svg" ? "image/svg+xml" : "image/png",
			href,
		},
	};
}

export function bannerTags(
	options: ResolvedBannerOptions,
	pkg: { name: string; version: string },
	env: string,
	color: string,
): HtmlTagDescriptor[] {
	const tags: HtmlTagDescriptor[] = [];

	if (options.meta) {
		for (const [suffix, content] of [
			["name", pkg.name],
			["version", pkg.version],
			["environment", env],
		] as const) {
			tags.push({
				tag: "meta",
				injectTo: "head",
				attrs: { name: `${options.metaPrefix}-${suffix}`, content },
			});
		}
	}

	if (options.console) {
		tags.push({
			tag: "script",
			injectTo: "head",
			children: consoleBannerScript(pkg, env, color),
		});
	}

	return tags;
}

function consoleBannerScript(pkg: { name: string; version: string }, env: string, color: string) {
	return `(function(){console.log(
  ${JSON.stringify(`%c ${pkg.name}@${pkg.version} %c ${env} `)},
  ${JSON.stringify(
		"background:#111;color:#fff;padding:2px 0 2px 6px;border-radius:3px 0 0 3px;font-weight:600",
	)},
  ${JSON.stringify(`background:${color};color:#111;padding:2px 6px 2px 0;border-radius:0 3px 3px 0;font-weight:600`)}
);})();`;
}
