import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import { whereamiHandle } from "../src/sveltekit.js";
import type { WhereAmIOptions } from "../src/types.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const basicPkgPath = path.join(here, "fixtures/basic/package.json");
const withIconPath = path.join(here, "fixtures/withicon/public/favicon.svg");

const HEAD_CHUNK = "<html><head><title>My App</title></head><body>%sveltekit.body%";
const BODY_CHUNK = "<h1>hello</h1></body></html>";

/** Stands in for SvelteKit's real `resolve`: runs `transformPageChunk` over fake chunks. */
async function render(
	handle: ReturnType<typeof whereamiHandle>,
	chunks = [HEAD_CHUNK, BODY_CHUNK],
) {
	const event = {} as never;
	const resolve = async (
		_event: unknown,
		opts?: {
			transformPageChunk?: (input: {
				html: string;
				done: boolean;
			}) => string | Promise<string> | undefined;
		},
	) => {
		const transformed = await Promise.all(
			chunks.map(
				(html, i) => opts?.transformPageChunk?.({ html, done: i === chunks.length - 1 }) ?? html,
			),
		);
		return new Response(transformed.join(""));
	};
	const response = await handle({ event, resolve } as never);
	return response.text();
}

const originalNodeEnv = process.env.NODE_ENV;
const originalWhereamiEnv = process.env.WHEREAMI_ENV;

afterEach(() => {
	process.env.NODE_ENV = originalNodeEnv;
	process.env.WHEREAMI_ENV = originalWhereamiEnv;
});

describe("whereamiHandle", () => {
	it("prefixes the title and injects the banner for a custom detect() result", async () => {
		const html = await render(
			whereamiHandle({
				detect: () => "qa",
				environments: { qa: { color: "#ff00ff", titlePrefix: "[QA] " } },
				packageJsonPath: basicPkgPath,
			} satisfies WhereAmIOptions),
		);

		expect(html).toContain("<title>[QA] My App</title>");
		expect(html).toContain('name="app-environment" content="qa"');
		expect(html).toContain('name="app-name" content="fixture-basic"');
		expect(html).toContain("data:image/svg+xml;base64,");
	});

	it("leaves title/favicon/badge untouched for an environment with no color, but keeps the banner", async () => {
		const html = await render(
			whereamiHandle({ detect: () => "prod", packageJsonPath: basicPkgPath }),
		);

		expect(html).toContain("<title>My App</title>");
		expect(html).not.toContain('rel="icon"');
		expect(html).not.toContain("clip-path:polygon");
		expect(html).toContain('name="app-environment" content="prod"');
	});

	it("tints an existing favicon source instead of generating a default one", async () => {
		const html = await render(
			whereamiHandle({
				detect: () => "staging",
				environments: { staging: { color: "#f59e0b", titlePrefix: "🟠 " } },
				favicon: { path: withIconPath },
				packageJsonPath: basicPkgPath,
			}),
		);

		expect(html).toContain("data:image/svg+xml;base64,");
		const dataUri = html.match(/href="(data:image\/svg\+xml;base64,[^"]+)"/)?.[1];
		const svg = Buffer.from(dataUri?.split(",")[1] ?? "", "base64").toString("utf-8");
		expect(svg).toContain("<filter");
		expect(svg).toContain('flood-color="#f59e0b"');
	});

	it("disables the banner entirely when banner: false", async () => {
		const html = await render(
			whereamiHandle({ detect: () => "dev", banner: false, packageJsonPath: basicPkgPath }),
		);

		expect(html).not.toContain("app-name");
		expect(html).not.toContain("console.log");
	});

	it("disables the badge via badge: false while keeping the console banner", async () => {
		const html = await render(
			whereamiHandle({ detect: () => "dev", badge: false, packageJsonPath: basicPkgPath }),
		);

		expect(html).not.toContain("clip-path:polygon");
		expect(html).toContain("console.log(");
	});

	it("includes custom metadata in the badge and console banner", async () => {
		const html = await render(
			whereamiHandle({
				detect: () => "dev",
				metadata: { region: "eu-central" },
				packageJsonPath: basicPkgPath,
			}),
		);

		expect(html).toContain('"region":"eu-central"');
		expect(html).toContain('console.log({"region":"eu-central"});');
	});

	it("passes through body chunks that don't contain </head> unchanged", async () => {
		const html = await render(
			whereamiHandle({ detect: () => "dev", packageJsonPath: basicPkgPath }),
		);

		expect(html).toContain("<h1>hello</h1>");
	});

	it("uses the default detector, trusting NODE_ENV=production outright (no Vite build step here)", async () => {
		process.env.NODE_ENV = "production";
		delete process.env.WHEREAMI_ENV;

		const html = await render(whereamiHandle({ packageJsonPath: basicPkgPath }));

		expect(html).toContain('name="app-environment" content="prod"');
	});

	it("lets WHEREAMI_ENV override the default detector", async () => {
		process.env.NODE_ENV = "production";
		process.env.WHEREAMI_ENV = "staging";

		const html = await render(whereamiHandle({ packageJsonPath: basicPkgPath }));

		expect(html).toContain('name="app-environment" content="staging"');
	});

	it("uses an explicit pkg option instead of reading package.json off disk", async () => {
		const html = await render(
			whereamiHandle({
				detect: () => "dev",
				pkg: { name: "edge-app", version: "9.9.9" },
			}),
		);

		expect(html).toContain('name="app-name" content="edge-app"');
		expect(html).toContain('name="app-version" content="9.9.9"');
		expect(html).not.toContain('content="app"');
	});

	it("uses the build-time __WHEREAMI_PKG__ global when set (as the whereami() Vite plugin's define would inject)", async () => {
		Object.assign(globalThis, { __WHEREAMI_PKG__: { name: "baked-in", version: "3.3.3" } });
		try {
			const html = await render(whereamiHandle({ detect: () => "dev" }));
			expect(html).toContain('name="app-name" content="baked-in"');
			expect(html).toContain('name="app-version" content="3.3.3"');
		} finally {
			delete (globalThis as { __WHEREAMI_PKG__?: unknown }).__WHEREAMI_PKG__;
		}
	});

	it("prefers an explicit pkg option over the build-time __WHEREAMI_PKG__ global", async () => {
		Object.assign(globalThis, { __WHEREAMI_PKG__: { name: "baked-in", version: "3.3.3" } });
		try {
			const html = await render(
				whereamiHandle({ detect: () => "dev", pkg: { name: "explicit", version: "1.1.1" } }),
			);
			expect(html).toContain('name="app-name" content="explicit"');
		} finally {
			delete (globalThis as { __WHEREAMI_PKG__?: unknown }).__WHEREAMI_PKG__;
		}
	});
});
