import type { HtmlTagDescriptor } from "vite";
import { describe, expect, it } from "vitest";
import {
	applyTitlePrefix,
	badgeTag,
	consoleBannerTag,
	faviconLinkTag,
	metaTags,
	stripFaviconLinks,
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
