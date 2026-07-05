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

type Pkg = { name: string; version: string };

/** Merge name/version/environment with custom metadata; the built-ins always win on key clash. */
function buildInfo(pkg: Pkg, env: string, metadata: Record<string, unknown>) {
	return { ...metadata, name: pkg.name, version: pkg.version, environment: env };
}

export function metaTags(
	options: ResolvedBannerOptions,
	pkg: Pkg,
	env: string,
): HtmlTagDescriptor[] {
	if (!options.meta) return [];
	const entries: Array<[string, string]> = [
		["name", pkg.name],
		["version", pkg.version],
		["environment", env],
	];
	return entries.map(([suffix, content]) => ({
		tag: "meta",
		injectTo: "head",
		attrs: { name: `${options.metaPrefix}-${suffix}`, content },
	}));
}

export function consoleBannerTag(
	pkg: Pkg,
	env: string,
	color: string,
	metadata: Record<string, unknown>,
): HtmlTagDescriptor {
	return {
		tag: "script",
		injectTo: "head",
		children: consoleBannerScript(pkg, env, color, metadata),
	};
}

export function badgeTag(
	pkg: Pkg,
	env: string,
	color: string,
	metadata: Record<string, unknown>,
): HtmlTagDescriptor {
	return { tag: "script", injectTo: "head", children: badgeScript(pkg, env, color, metadata) };
}

function consoleBannerScript(
	pkg: Pkg,
	env: string,
	color: string,
	metadata: Record<string, unknown>,
): string {
	const hasMetadata = Object.keys(metadata).length > 0;
	return `(function(){console.log(
  ${JSON.stringify(`%c ${pkg.name}@${pkg.version} %c ${env} `)},
  ${JSON.stringify(
		"background:#111;color:#fff;padding:2px 0 2px 6px;border-radius:3px 0 0 3px;font-weight:600",
	)},
  ${JSON.stringify(`background:${color};color:#111;padding:2px 6px 2px 0;border-radius:0 3px 3px 0;font-weight:600`)}
);${hasMetadata ? `\nconsole.log(${JSON.stringify(metadata)});` : ""}})();`;
}

function badgeScript(
	pkg: Pkg,
	env: string,
	color: string,
	metadata: Record<string, unknown>,
): string {
	const info = buildInfo(pkg, env, metadata);
	return `(function(){
function mount(){
  var color = ${JSON.stringify(color)};
  var info = ${JSON.stringify(info)};
  var open = false;

  var triangle = document.createElement("div");
  triangle.title = "whereami: " + info.environment;
  triangle.style.cssText = "position:fixed;bottom:0;left:0;width:36px;height:36px;background:" + color + ";clip-path:polygon(0 0,100% 100%,0 100%);cursor:pointer;z-index:2147483647;";

  var panel = document.createElement("div");
  panel.style.cssText = "position:fixed;bottom:44px;left:8px;display:none;background:#111;color:#f3f4f6;border-radius:8px;box-shadow:0 4px 16px rgba(0,0,0,.35);z-index:2147483647;overflow:hidden;font:12px/1.4 ui-monospace,SFMono-Regular,Menlo,monospace;";

  var header = document.createElement("div");
  header.style.cssText = "display:flex;align-items:center;justify-content:space-between;gap:12px;padding:6px 8px 6px 10px;background:" + color + ";color:#111;font-weight:700;";
  header.textContent = info.name + "@" + info.version;

  var close = document.createElement("button");
  close.textContent = "\\u00d7";
  close.setAttribute("aria-label", "Close");
  close.style.cssText = "appearance:none;border:0;background:transparent;color:#111;font-size:16px;line-height:1;cursor:pointer;padding:0 2px;";
  close.addEventListener("click", function(e){ e.stopPropagation(); setOpen(false); });
  header.appendChild(close);

  var pre = document.createElement("pre");
  pre.style.cssText = "margin:0;padding:10px 12px;max-width:min(420px,calc(100vw - 32px));max-height:min(320px,calc(100vh - 96px));overflow:auto;white-space:pre-wrap;word-break:break-word;";
  pre.textContent = JSON.stringify(info, null, 2);

  panel.appendChild(header);
  panel.appendChild(pre);

  function setOpen(next){ open = next; panel.style.display = open ? "block" : "none"; }
  triangle.addEventListener("click", function(e){ e.stopPropagation(); setOpen(!open); });
  document.addEventListener("click", function(e){ if (open && !panel.contains(e.target)) setOpen(false); });
  document.addEventListener("keydown", function(e){ if (open && e.key === "Escape") setOpen(false); });

  document.body.appendChild(triangle);
  document.body.appendChild(panel);
}
if (document.body) mount(); else document.addEventListener("DOMContentLoaded", mount);
})();`;
}
