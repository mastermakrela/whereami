import { describe, expect, it } from "vitest";
import { applyTitlePrefix, bannerTags, faviconLinkTag, stripFaviconLinks } from "../src/html.js";

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

describe("bannerTags", () => {
	const pkg = { name: "app", version: "1.0.0" };

	it("includes meta and script tags when both are enabled", () => {
		const tags = bannerTags(
			{ enabled: true, meta: true, console: true, metaPrefix: "app" },
			pkg,
			"dev",
			"#22c55e",
		);
		const metaNames = tags.filter((t) => t.tag === "meta").map((t) => t.attrs?.name);
		expect(metaNames).toEqual(["app-name", "app-version", "app-environment"]);
		expect(tags.some((t) => t.tag === "script")).toBe(true);
	});

	it("omits meta tags when meta is disabled", () => {
		const tags = bannerTags(
			{ enabled: true, meta: false, console: true, metaPrefix: "app" },
			pkg,
			"dev",
			"#22c55e",
		);
		expect(tags.some((t) => t.tag === "meta")).toBe(false);
	});

	it("omits the script when console is disabled", () => {
		const tags = bannerTags(
			{ enabled: true, meta: true, console: false, metaPrefix: "app" },
			pkg,
			"dev",
			"#22c55e",
		);
		expect(tags.some((t) => t.tag === "script")).toBe(false);
	});
});
