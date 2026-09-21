import type { HtmlTagDescriptor } from "vite";
import { describe, expect, it } from "vitest";
import {
	applyTitlePrefix,
	badgeTag,
	consoleBannerTag,
	faviconLinkTag,
	metaTags,
	neutralizeFaviconLinks,
	stripFaviconLinks,
	titleKeeperTag,
} from "../src/html.js";

function names(tags: HtmlTagDescriptor[]) {
	return tags.map((t) => t.attrs?.name);
}

describe("applyTitlePrefix", () => {
	it("prepends the prefix inside the title tag", () => {
		expect(applyTitlePrefix("<title>App</title>", "🟢 ")).toBe("<title>🟢 App</title>");
	});

	it("is a no-op for an empty prefix or missing title", () => {
		expect(applyTitlePrefix("<title>App</title>", "")).toBe("<title>App</title>");
		expect(applyTitlePrefix("<div>no title</div>", "🟢 ")).toBe("<div>no title</div>");
	});
});

describe("stripFaviconLinks", () => {
	it("removes existing icon link tags", () => {
		const html = '<head><link rel="icon" href="/favicon.ico" /><title>x</title></head>';
		expect(stripFaviconLinks(html)).toBe("<head><title>x</title></head>");
	});
});

describe("neutralizeFaviconLinks", () => {
	it('renames a double-quoted rel="icon" without touching position, href, or surrounding whitespace', () => {
		const html = '<head>\n\t<link rel="icon" href="/favicon.ico" />\n\t<title>x</title>\n</head>';
		const out = neutralizeFaviconLinks(html);
		expect(out).toBe(
			'<head>\n\t<link data-whereami-rel="icon" href="/favicon.ico" />\n\t<title>x</title>\n</head>',
		);
	});

	it("renames a single-quoted rel", () => {
		const html = "<link rel='icon' href='/favicon.ico' />";
		expect(neutralizeFaviconLinks(html)).toBe(
			"<link data-whereami-rel='icon' href='/favicon.ico' />",
		);
	});

	it("renames shortcut icon, preserving the original rel value in the data attribute", () => {
		const html = '<link rel="shortcut icon" href="/favicon.ico">';
		expect(neutralizeFaviconLinks(html)).toBe(
			'<link data-whereami-rel="shortcut icon" href="/favicon.ico">',
		);
	});

	it("handles a self-closing tag", () => {
		const html = '<link rel="icon" href="/favicon.svg"/>';
		expect(neutralizeFaviconLinks(html)).toBe(
			'<link data-whereami-rel="icon" href="/favicon.svg"/>',
		);
	});

	it("is a no-op when there is no icon link", () => {
		const html = "<head><title>x</title></head>";
		expect(neutralizeFaviconLinks(html)).toBe(html);
	});

	it("neutralizes every icon link tag in the document", () => {
		const html = '<link rel="icon" href="/a.ico" /><link rel="shortcut icon" href="/b.ico" />';
		expect(neutralizeFaviconLinks(html)).toBe(
			'<link data-whereami-rel="icon" href="/a.ico" /><link data-whereami-rel="shortcut icon" href="/b.ico" />',
		);
	});

	it("preserves a Svelte head-hydration block's markers and node count around the tag", () => {
		const html =
			'<!--[--><link rel="icon" href="/favicon.svg" /><meta name="x" content="y"><!--]-->';
		const out = neutralizeFaviconLinks(html);
		expect(out).toBe(
			'<!--[--><link data-whereami-rel="icon" href="/favicon.svg" /><meta name="x" content="y"><!--]-->',
		);
	});

	it("is idempotent: applying it twice matches applying it once", () => {
		const html = '<link rel="icon" href="/favicon.ico" />';
		const once = neutralizeFaviconLinks(html);
		expect(neutralizeFaviconLinks(once)).toBe(once);
	});
});

describe("titleKeeperTag", () => {
	it("builds an inline script containing the prefix", () => {
		const tag = titleKeeperTag("🟢 ");
		expect(tag.tag).toBe("script");
		expect(tag.children).toContain("MutationObserver");
		expect(tag.children).toContain(JSON.stringify("🟢 "));
	});

	it("guards MutationObserver access so it's a no-op in odd environments", () => {
		const tag = titleKeeperTag("[QA] ");
		expect(tag.children).toContain('typeof MutationObserver === "undefined"');
	});
});

describe("faviconLinkTag", () => {
	it("builds a link tag descriptor with the right mime type", () => {
		expect(faviconLinkTag("/x.svg", "svg").attrs?.type).toBe("image/svg+xml");
		expect(faviconLinkTag("/x.png", "png").attrs?.type).toBe("image/png");
	});
});

describe("metaTags", () => {
	const pkg = { name: "app", version: "1.0.0" };

	it("builds name/version/environment meta tags", () => {
		const tags = metaTags(
			{ enabled: true, meta: true, console: true, metaPrefix: "app" },
			pkg,
			"dev",
		);
		expect(names(tags)).toEqual(["app-name", "app-version", "app-environment"]);
	});

	it("respects a custom metaPrefix", () => {
		const tags = metaTags(
			{ enabled: true, meta: true, console: true, metaPrefix: "whereami" },
			pkg,
			"dev",
		);
		expect(names(tags)).toEqual(["whereami-name", "whereami-version", "whereami-environment"]);
	});

	it("returns nothing when meta is disabled", () => {
		expect(
			metaTags({ enabled: true, meta: false, console: true, metaPrefix: "app" }, pkg, "dev"),
		).toEqual([]);
	});
});

describe("consoleBannerTag", () => {
	const pkg = { name: "app", version: "1.0.0" };

	it("embeds name/version/environment in the script", () => {
		const tag = consoleBannerTag(pkg, "dev", "#22c55e", {});
		expect(tag.tag).toBe("script");
		expect(tag.children).toContain("app@1.0.0");
		expect(tag.children).toContain("#22c55e");
		expect(tag.children).not.toContain("console.log({");
	});

	it("logs custom metadata as a second console.log call when provided", () => {
		const tag = consoleBannerTag(pkg, "dev", "#22c55e", { region: "eu-central" });
		expect(tag.children).toContain('console.log({"region":"eu-central"});');
	});
});

describe("badgeTag", () => {
	const pkg = { name: "app", version: "1.0.0" };

	it("embeds the color and a merged info object including metadata", () => {
		const tag = badgeTag(pkg, "staging", "#f59e0b", { region: "eu-central" });
		expect(tag.tag).toBe("script");
		expect(tag.children).toContain('"#f59e0b"');
		const info = JSON.parse((tag.children as string).match(/var info = (\{.*?\});/)?.[1] ?? "{}");
		expect(info).toEqual({
			region: "eu-central",
			name: "app",
			version: "1.0.0",
			environment: "staging",
		});
	});

	it("lets the built-in fields win over a colliding metadata key", () => {
		const tag = badgeTag(pkg, "staging", "#f59e0b", { name: "custom" });
		const info = JSON.parse((tag.children as string).match(/var info = (\{.*?\});/)?.[1] ?? "{}");
		expect(info.name).toBe("app");
	});
});
