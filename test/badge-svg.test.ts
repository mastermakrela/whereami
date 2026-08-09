import { describe, expect, it } from "vitest";
import { renderBadgeSvg } from "../src/badge-svg.js";

const FALLBACK_COLOR = "#0b7285";

/**
 * A deliberately strict, dependency-free scanner (there is no DOM in the vitest node
 * environment, and a jsdom dependency is not worth one assertion). It consumes the
 * whole string as a sequence of tags and text, requiring every attribute to be
 * `name="value"` with no raw `"`, `<` or `>` inside the value, and every element to be
 * closed in order. Anything it cannot consume is malformed.
 */
function assertWellFormed(svg: string): void {
	const tagRe = /<(\/?)([A-Za-z][\w:.-]*)((?:\s+[\w:.-]+="[^"<>]*")*)\s*(\/?)>/y;
	const stack: string[] = [];
	let i = 0;

	while (i < svg.length) {
		if (svg[i] === "<") {
			tagRe.lastIndex = i;
			const m = tagRe.exec(svg);
			if (!m) throw new Error(`malformed tag at ${i}: ${JSON.stringify(svg.slice(i, i + 90))}`);
			const [, closing, name, , selfClosing] = m;
			if (closing) {
				if (stack.pop() !== name) throw new Error(`mismatched </${name}> at ${i}`);
			} else if (!selfClosing) {
				stack.push(name);
			}
			i = tagRe.lastIndex;
		} else {
			const next = svg.indexOf("<", i);
			const text = svg.slice(i, next === -1 ? undefined : next);
			if (text.includes(">")) throw new Error(`stray ">" in text at ${i}`);
			i = next === -1 ? svg.length : next;
		}
	}

	if (stack.length) throw new Error(`unclosed: ${stack.join(", ")}`);
}

function widthFor(text: string): number {
	return Math.round(text.length * 6.6) + 20;
}

function svgWidth(svg: string): number {
	const match = svg.match(/^<svg[^>]*\bwidth="(\d+)"/);
	if (!match) throw new Error("no width attribute found on <svg>");
	return Number(match[1]);
}

describe("renderBadgeSvg", () => {
	it("includes the label and value text", () => {
		const svg = renderBadgeSvg({ label: "deployed", value: "v1.2.3", color: "#0b7285" });
		expect(svg).toContain(">deployed<");
		expect(svg).toContain(">v1.2.3<");
	});

	it("grows the width for longer text, matching the documented formula", () => {
		const short = renderBadgeSvg({ label: "a", value: "b", color: "#0b7285" });
		const long = renderBadgeSvg({ label: "deployed", value: "v1.2.3-beta", color: "#0b7285" });
		expect(svgWidth(long)).toBeGreaterThan(svgWidth(short));

		expect(svgWidth(short)).toBe(widthFor("a") + widthFor("b"));
		expect(svgWidth(long)).toBe(widthFor("deployed") + widthFor("v1.2.3-beta"));
	});

	it("sets textLength and lengthAdjust on both text elements", () => {
		const svg = renderBadgeSvg({ label: "env", value: "prod", color: "#0b7285" });
		const textEls = svg.match(/<text[^>]*>/g) ?? [];
		expect(textEls).toHaveLength(4);
		for (const el of textEls) {
			expect(el).toMatch(/textLength="\d+"/);
			expect(el).toContain('lengthAdjust="spacingAndGlyphs"');
		}
	});

	it("computes textLength from the documented per-side formula", () => {
		const svg = renderBadgeSvg({ label: "env", value: "production", color: "#0b7285" });
		expect(svg).toContain(`textLength="${widthFor("env") - 20}"`);
		expect(svg).toContain(`textLength="${widthFor("production") - 20}"`);
	});

	it("XML-escapes label and value so no raw special chars leak into markup", () => {
		const svg = renderBadgeSvg({
			label: `<l>&"'`,
			value: `<v>&"'`,
			color: "#0b7285",
		});
		expect(svg).not.toContain("<l>");
		expect(svg).not.toContain("<v>");
		expect(svg).toContain("&lt;l&gt;&amp;&quot;&apos;");
		expect(svg).toContain("&lt;v&gt;&amp;&quot;&apos;");

		// No stray bare `&` or `<` outside of the escaped entities / real tags.
		const withoutEntities = svg.replace(/&(?:amp|lt|gt|quot|apos);/g, "");
		expect(withoutEntities).not.toContain("&");
		const withoutTags = svg.replace(/<[^>]*>/g, "");
		expect(withoutTags).not.toContain("<");
	});

	it("escapes the aria-label and title too", () => {
		const svg = renderBadgeSvg({ label: `a&b`, value: `c<d`, color: "#0b7285" });
		expect(svg).toContain('aria-label="a&amp;b: c&lt;d"');
		expect(svg).toContain("<title>a&amp;b: c&lt;d</title>");
	});

	it("falls back to the default color for invalid input, never emitting it raw", () => {
		for (const bad of ["red", "#12", "#12345", "javascript:alert(1)", "#gggggg"]) {
			const svg = renderBadgeSvg({ label: "x", value: "y", color: bad });
			expect(svg).toContain(FALLBACK_COLOR);
			expect(svg).not.toContain(bad);
		}
	});

	it("uses a valid 3-digit hex color as-is", () => {
		const svg = renderBadgeSvg({ label: "x", value: "y", color: "#abc" });
		expect(svg).toContain('fill="#abc"');
	});

	it("uses a valid 6-digit hex color as-is", () => {
		const svg = renderBadgeSvg({ label: "x", value: "y", color: "#a1b2c3" });
		expect(svg).toContain('fill="#a1b2c3"');
	});

	it("is deterministic for identical input", () => {
		const input = { label: "deployed", value: "v1.2.3", color: "#0b7285" };
		expect(renderBadgeSvg(input)).toBe(renderBadgeSvg({ ...input }));
	});

	it("sets role=img and an aria-label containing both label and value", () => {
		const svg = renderBadgeSvg({ label: "deployed", value: "v1.2.3", color: "#0b7285" });
		expect(svg).toContain('role="img"');
		const match = svg.match(/aria-label="([^"]*)"/);
		expect(match?.[1]).toContain("deployed");
		expect(match?.[1]).toContain("v1.2.3");
	});

	// Every other test here is a substring check, and substring checks cannot see a broken
	// document: an unescaped `"` inside an attribute closes it early and leaves stray markup,
	// yet all the expected fragments are still "present". Browsers parse image/svg+xml as
	// strict XML, so a malformed badge renders as nothing at all. Parse it for real.
	describe("is well-formed XML", () => {
		// Guard the guard: the scanner must reject the exact bug this block exists to catch —
		// a raw double quote inside an attribute value.
		it("rejects an attribute value containing a raw double quote", () => {
			expect(() => assertWellFormed('<svg font-family="a, "B C", d"></svg>')).toThrow();
			expect(() =>
				assertWellFormed('<svg font-family="a, &quot;B C&quot;, d"></svg>'),
			).not.toThrow();
		});

		it("for a plain badge", () => {
			expect(() =>
				assertWellFormed(renderBadgeSvg({ label: "deployed", value: "v1.2.3", color: "#0b7285" })),
			).not.toThrow();
		});

		it("with a font-family containing a quoted multi-word family", () => {
			const svg = renderBadgeSvg({ label: "deployed", value: "v1.2.3", color: "#0b7285" });
			expect(svg.match(/font-family="([^"]*)"/)?.[1]).toContain("&quot;Liberation Mono&quot;");
			expect(() => assertWellFormed(svg)).not.toThrow();
		});

		it("when label and value contain XML metacharacters", () => {
			const svg = renderBadgeSvg({
				label: `a<b&c"d'e`,
				value: "<script>alert(1)</script>",
				color: "#fff",
			});
			expect(() => assertWellFormed(svg)).not.toThrow();
			// The payload must survive as escaped text, never as markup.
			expect(svg).not.toContain("<script>");
			expect(svg).toContain("&lt;script&gt;");
		});

		it("for empty label and value", () => {
			expect(() =>
				assertWellFormed(renderBadgeSvg({ label: "", value: "", color: "#0b7285" })),
			).not.toThrow();
		});
	});
});
