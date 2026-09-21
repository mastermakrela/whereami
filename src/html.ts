import type { HtmlTagDescriptor } from "vite";
import { ICON_LINK_RE, faviconMimeType } from "./favicon.js";
import type { PkgInfo } from "./pkg.js";
import type { ResolvedBannerOptions } from "./types.js";

const TITLE_RE = /(<title[^>]*>)([\s\S]*?)(<\/title>)/i;
const STRIP_ICON_LINKS_RE = new RegExp(`${ICON_LINK_RE.source}\\s*`, "gi");
const NEUTRALIZE_ICON_LINKS_RE = new RegExp(ICON_LINK_RE.source, "gi");
// The negative lookbehind keeps this from re-matching inside an already-neutralized
// `data-whereami-rel="icon"` (which ends in the same "rel=..." substring) — without it, a
// second pass (two handles in a `sequence`, or any re-transform) would double-prefix the
// attribute into `data-whereami-data-whereami-rel="icon"`.
const REL_ATTR_RE = /(?<![\w-])rel=(["'])(shortcut icon|icon)\1/i;

export function applyTitlePrefix(html: string, prefix: string): string {
	if (!prefix || !TITLE_RE.test(html)) return html;
	return html.replace(TITLE_RE, (_m, open, text, close) => `${open}${prefix}${text}${close}`);
}

/** Remove any existing favicon `<link>` tags so ours doesn't end up alongside a stale one. */
export function stripFaviconLinks(html: string): string {
	return html.replace(STRIP_ICON_LINKS_RE, "");
}

/**
 * Like `stripFaviconLinks`, but for HTML that may be inside SvelteKit's head-hydration block
 * (`<!--[-->…<!--]-->` on older Svelte, `<!--svelte-HASH-->…<!---->` on 5.56+): removing the
 * element there shifts the hydration cursor onto the wrong node and throws
 * `TypeError: element.getAttribute is not a function` ("Failed to hydrate"). Instead, rewrite
 * the tag IN PLACE — same position, same `href`, whitespace around it untouched — renaming
 * `rel="icon"` / `rel="shortcut icon"` to `data-whereami-rel="..."` so it's no longer an icon,
 * while our own tinted `<link rel="icon">` is injected separately.
 *
 * This is safe against Svelte 5.56's hydration, verified against
 * `svelte/src/internal/client/dom/elements/attributes.js`:
 *  - The scaffold typically has a *dynamic* `href={favicon}` (an imported asset), so
 *    `set_attribute` for `href` on a `LINK` element does run during hydration — but it stores
 *    the current value, runs its dev-only src/hydration-mismatch check (which passes, since we
 *    leave `href` byte-identical between server and client), and then early-returns without
 *    ever calling `setAttribute`, specifically to avoid triggering a second network request.
 *  - Static attributes (a plain `rel="icon"`, not `rel={...}`) aren't re-asserted during
 *    hydration at all, so renaming it here survives untouched. Only a *dynamic* `rel={...}`
 *    binding would restore `rel="icon"` on the next update — acceptable, since that's not the
 *    common case this fixes.
 * Node count and order inside the hydration block stay identical either way, and the result
 * has exactly one `rel="icon"` in the document (ours), so nothing relies on "last icon wins".
 */
export function neutralizeFaviconLinks(html: string): string {
	return html.replace(NEUTRALIZE_ICON_LINKS_RE, (tag) =>
		tag.replace(
			REL_ATTR_RE,
			(_m, quote: string, relValue: string) => `data-whereami-rel=${quote}${relValue}${quote}`,
		),
	);
}

function escapeAttr(value: string): string {
	return value.replace(/&/g, "&amp;").replace(/"/g, "&quot;");
}

function renderTag(tag: HtmlTagDescriptor): string {
	const attrs = Object.entries(tag.attrs ?? {})
		.map(([key, value]) => ` ${key}="${escapeAttr(String(value))}"`)
		.join("");
	if (tag.tag === "script") return `<script${attrs}>${tag.children ?? ""}</script>`;
	return `<${tag.tag}${attrs}>`;
}

/**
 * Insert `tags` right before `</head>`, for contexts (like SvelteKit's `transformPageChunk`)
 * that hand us a raw HTML string instead of going through Vite's own tag-injection machinery.
 */
export function injectIntoHead(html: string, tags: HtmlTagDescriptor[]): string {
	if (tags.length === 0) return html;
	const insertion = tags.map(renderTag).join("");
	return /<\/head>/i.test(html) ? html.replace(/<\/head>/i, `${insertion}</head>`) : html;
}

export function faviconLinkTag(href: string, ext: "svg" | "png"): HtmlTagDescriptor {
	return {
		tag: "link",
		injectTo: "head",
		attrs: {
			rel: "icon",
			type: faviconMimeType(ext),
			href,
		},
	};
}

type Pkg = PkgInfo;

/**
 * `JSON.stringify` for values embedded in an inline `<script>` tag. Escapes `<` so a
 * value containing `</script` (from `metadata`, which is arbitrary user data) can't
 * prematurely close the tag and get the rest re-parsed as HTML.
 */
function jsonForScript(value: unknown): string {
	return JSON.stringify(value).replace(/</g, "\\u003c");
}

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

function scriptTag(children: string): HtmlTagDescriptor {
	return { tag: "script", injectTo: "head", children };
}

/**
 * Svelte's compiled `<title>` does `document.title = ...` unconditionally on every update
 * (see `TitleElement.js` in the client transform), including right after hydration — so an
 * SSR-only `applyTitlePrefix()` gets silently overwritten the moment the page hydrates. This
 * keeps the prefix alive client-side: a `MutationObserver` on `document.head` re-applies it
 * whenever `document.title` changes and doesn't already start with it, which also covers an
 * SPA setting `document.title` again later (e.g. client-side navigation).
 *
 * The `document.title` *getter* normalizes ASCII whitespace (trims and collapses runs of it),
 * so a raw prefix like `"🟢  "` never round-trips through it byte-for-byte — comparing against
 * a normalized copy of the prefix is what makes the "already prefixed" check work, while the
 * raw prefix is still what actually gets prepended. That same check doubles as the loop guard:
 * setting `document.title` triggers another mutation, but by then the title already starts
 * with the (normalized) prefix, so `ensure()` is a no-op on the reentrant call.
 */
function titleKeeperScript(prefix: string): string {
	const normalizedPrefix = prefix.trim().replace(/\s+/g, " ");
	return `(function(){
var prefix = ${jsonForScript(prefix)};
var normalizedPrefix = ${jsonForScript(normalizedPrefix)};
if (typeof MutationObserver === "undefined" || !normalizedPrefix) return;
function ensure(){
  if (document.title.indexOf(normalizedPrefix) !== 0) document.title = prefix + document.title;
}
ensure();
new MutationObserver(ensure).observe(document.head, { subtree: true, childList: true, characterData: true });
})();`;
}

export function titleKeeperTag(prefix: string): HtmlTagDescriptor {
	return scriptTag(titleKeeperScript(prefix));
}

export function consoleBannerTag(
	pkg: Pkg,
	env: string,
	color: string,
	metadata: Record<string, unknown>,
): HtmlTagDescriptor {
	return scriptTag(consoleBannerScript(pkg, env, color, metadata));
}

export function badgeTag(
	pkg: Pkg,
	env: string,
	color: string,
	metadata: Record<string, unknown>,
): HtmlTagDescriptor {
	return scriptTag(badgeScript(pkg, env, color, metadata));
}

function consoleBannerScript(
	pkg: Pkg,
	env: string,
	color: string,
	metadata: Record<string, unknown>,
): string {
	const hasMetadata = Object.keys(metadata).length > 0;
	return `(function(){console.log(
  ${jsonForScript(`%c ${pkg.name}@${pkg.version} %c ${env} `)},
  ${JSON.stringify(
		"background:#111;color:#fff;padding:2px 0 2px 6px;border-radius:3px 0 0 3px;font-weight:600",
	)},
  ${JSON.stringify(`background:${color};color:#111;padding:2px 6px 2px 0;border-radius:0 3px 3px 0;font-weight:600`)}
);${hasMetadata ? `\nconsole.log(${jsonForScript(metadata)});` : ""}})();`;
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
  var info = ${jsonForScript(info)};
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
