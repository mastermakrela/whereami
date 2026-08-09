import path from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";
import { describe, expect, it } from "vitest";

const here = path.dirname(fileURLToPath(import.meta.url));
const sveltekitEntry = path.join(here, "../src/sveltekit.ts");

/**
 * The whole point of these: unit tests all run on Node, where a stray `node:fs` import is
 * invisible. Bundling the SvelteKit entry the way a Cloudflare Workers / Vercel Edge build
 * does — no Node builtins available, no `nodejs_compat` flag — is what actually catches a
 * static `node:*` (or transitively Node-only, e.g. `pngjs`) import creeping back in.
 */
async function bundleForEdge() {
	return build({
		entryPoints: [sveltekitEntry],
		bundle: true,
		write: false,
		format: "esm",
		platform: "neutral",
		conditions: ["worker", "browser", "import"],
		mainFields: ["module", "main"],
		// SvelteKit is a peer dependency the host app provides, and this entry only imports
		// its types anyway.
		external: ["@sveltejs/kit"],
	});
}

describe("edge bundle", () => {
	it("bundles for a runtime with no Node builtins", async () => {
		const result = await bundleForEdge();
		expect(result.errors).toEqual([]);
	});

	it("keeps Node-only modules out of the bundle", async () => {
		const result = await bundleForEdge();
		const code = result.outputFiles[0].text;

		// Node-only modules survive only as runtime-resolved specifiers (see
		// `importUnbundled`), never as something the bundler followed and inlined.
		expect(code).not.toMatch(/from\s*["']node:/);
		expect(code).not.toMatch(/require\(["']node:/);
		expect(code).toContain('"node:fs/promises"');
		expect(code).not.toContain("node_modules/pngjs");
		// `Buffer` and an unguarded `process` are undefined on workerd without `nodejs_compat`.
		expect(code).not.toMatch(/\bBuffer\./);
		expect(code).not.toMatch(/\bprocess\.(env|cwd)\b/);
	});
});
