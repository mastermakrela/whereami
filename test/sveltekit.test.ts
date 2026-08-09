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

async function resolvePage() {
	return new Response("<html><head></head><body>page</body></html>");
}

/** Fires a plain (non-page) request straight at the handle, bypassing `resolve` entirely. */
async function request(
	handle: ReturnType<typeof whereamiHandle>,
	pathname: string,
	headers: Record<string, string> = {},
) {
	const event = {
		url: new URL(pathname, "http://localhost"),
		request: new Request(new URL(pathname, "http://localhost"), { headers }),
	} as never;
	return handle({ event, resolve: resolvePage } as never);
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

	describe("badgeEndpoint", () => {
		it("leaves every path untouched when badgeEndpoint is unset", async () => {
			const response = await request(
				whereamiHandle({ detect: () => "dev", pkg: { name: "app", version: "1.0.0" } }),
				"/_whereami/badge.svg",
			);

			expect(response.status).toBe(200);
			expect(await response.text()).toContain("page");
		});

		it("serves the SVG badge at the configured path", async () => {
			const response = await request(
				whereamiHandle({
					detect: () => "dev",
					pkg: { name: "app", version: "1.0.0" },
					badgeEndpoint: { path: "/_whereami/badge.svg" },
				}),
				"/_whereami/badge.svg",
			);

			expect(response.status).toBe(200);
			expect(response.headers.get("content-type")).toBe("image/svg+xml; charset=utf-8");
			const body = await response.text();
			expect(body).toContain("v1.0.0");
		});

		it("renders the page normally for a different path (exact match, not a prefix)", async () => {
			const response = await request(
				whereamiHandle({
					detect: () => "dev",
					pkg: { name: "app", version: "1.0.0" },
					badgeEndpoint: { path: "/_whereami/badge.svg" },
				}),
				"/_whereami/badge.svg/extra",
			);

			expect(response.headers.get("content-type")).not.toBe("image/svg+xml; charset=utf-8");
			expect(await response.text()).toContain("page");
		});

		it("includes name, version, and environment when show lists all three", async () => {
			const response = await request(
				whereamiHandle({
					detect: () => "staging",
					pkg: { name: "my-app", version: "1.0.0" },
					badgeEndpoint: { path: "/badge.svg", show: ["name", "version", "environment"] },
				}),
				"/badge.svg",
			);

			const body = await response.text();
			expect(body).toContain("my-app v1.0.0 staging");
		});

		it("defaults show to just the version, excluding name and environment", async () => {
			const response = await request(
				whereamiHandle({
					detect: () => "staging",
					pkg: { name: "my-app", version: "1.0.0" },
					badgeEndpoint: { path: "/badge.svg" },
				}),
				"/badge.svg",
			);

			const body = await response.text();
			expect(body).toContain("v1.0.0");
			expect(body).not.toContain("my-app");
			expect(body).not.toContain("staging");
		});

		it("never leaks metadata into the badge body", async () => {
			const response = await request(
				whereamiHandle({
					detect: () => "dev",
					pkg: { name: "my-app", version: "1.0.0" },
					metadata: { secret: "do-not-leak" },
					badgeEndpoint: { path: "/badge.svg", show: ["name", "version", "environment"] },
				}),
				"/badge.svg",
			);

			const body = await response.text();
			expect(body).not.toContain("secret");
			expect(body).not.toContain("do-not-leak");
		});

		it("returns 304 when if-none-match matches the current etag", async () => {
			const handle = whereamiHandle({
				detect: () => "dev",
				pkg: { name: "app", version: "1.0.0" },
				badgeEndpoint: { path: "/badge.svg" },
			});

			const first = await request(handle, "/badge.svg");
			const etag = first.headers.get("etag");
			expect(etag).toBeTruthy();

			const second = await request(handle, "/badge.svg", { "if-none-match": etag ?? "" });
			expect(second.status).toBe(304);
			expect(await second.text()).toBe("");
		});

		// A proxy that re-encodes the body (Cloudflare gzipping the SVG) weakens the strong tag
		// on the way out, and clients may send a list — a byte-equality check would miss both and
		// silently serve a full 200 forever.
		it.each([
			["weakened by a proxy", (etag: string) => `W/${etag}`],
			["sent as part of a list", (etag: string) => `"stale", ${etag}`],
			["the wildcard", () => "*"],
		])("returns 304 when if-none-match is %s", async (_label, makeHeader) => {
			const handle = whereamiHandle({
				detect: () => "dev",
				pkg: { name: "app", version: "1.0.0" },
				badgeEndpoint: { path: "/badge.svg" },
			});

			const first = await request(handle, "/badge.svg");
			const etag = first.headers.get("etag") ?? "";

			const second = await request(handle, "/badge.svg", { "if-none-match": makeHeader(etag) });
			expect(second.status).toBe(304);
		});

		it("still serves 200 when if-none-match holds a different etag", async () => {
			const response = await request(
				whereamiHandle({
					detect: () => "dev",
					pkg: { name: "app", version: "1.0.0" },
					badgeEndpoint: { path: "/badge.svg" },
				}),
				"/badge.svg",
				{ "if-none-match": '"deadbeef"' },
			);

			expect(response.status).toBe(200);
			expect(await response.text()).toContain("v1.0.0");
		});

		it("drops an unrecognized show field instead of rendering the version twice", async () => {
			const response = await request(
				whereamiHandle({
					detect: () => "staging",
					pkg: { name: "my-app", version: "1.0.0" },
					// `"env"` is a plausible typo for `"environment"` and only TS would catch it.
					badgeEndpoint: {
						path: "/badge.svg",
						show: ["name", "env" as "environment", "version"],
					},
				}),
				"/badge.svg",
			);

			expect(await response.text()).toContain("my-app v1.0.0");
		});

		it.each(["", "   ", "/"])(
			"ignores badgeEndpoint entirely for the useless path %j",
			async (badgePath) => {
				const response = await request(
					whereamiHandle({
						detect: () => "dev",
						pkg: { name: "app", version: "1.0.0" },
						badgeEndpoint: { path: badgePath },
					}),
					"/",
				);

				expect(await response.text()).toContain("page");
			},
		);

		it("lets badgeEndpoint.color override the environment color", async () => {
			const withOverride = await request(
				whereamiHandle({
					detect: () => "staging",
					environments: { staging: { color: "#f59e0b" } },
					pkg: { name: "app", version: "1.0.0" },
					badgeEndpoint: { path: "/badge.svg", color: "#ff00ff" },
				}),
				"/badge.svg",
			);
			const withoutOverride = await request(
				whereamiHandle({
					detect: () => "staging",
					environments: { staging: { color: "#f59e0b" } },
					pkg: { name: "app", version: "1.0.0" },
					badgeEndpoint: { path: "/badge.svg" },
				}),
				"/badge.svg",
			);

			expect(await withOverride.text()).toContain("#ff00ff");
			expect(await withoutOverride.text()).toContain("#f59e0b");
		});
	});
});
