import { existsSync } from "node:fs";
import { readFile, rm } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { type ViteDevServer, build, createServer } from "vite";
import { afterEach, describe, expect, it } from "vitest";
import whereami from "../src/index.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const basicRoot = path.join(here, "fixtures/basic");
const withIconRoot = path.join(here, "fixtures/withicon");

let server: ViteDevServer | undefined;

afterEach(async () => {
	await server?.close();
	server = undefined;
	await rm(path.join(basicRoot, "dist-test"), { recursive: true, force: true });
	await rm(path.join(withIconRoot, "dist-test"), { recursive: true, force: true });
});

describe("build", () => {
	it("leaves everything untouched in prod (no changes)", async () => {
		await build({
			root: basicRoot,
			configFile: false,
			logLevel: "silent",
			mode: "production",
			build: { outDir: "dist-test", write: true },
			plugins: [whereami()],
		});

		const html = await readFile(path.join(basicRoot, "dist-test/index.html"), "utf-8");
		expect(html).toContain("<title>My App</title>");
		expect(html).not.toContain('rel="icon"');
		// banner still shows in prod by design — only favicon/title are untouched
		expect(html).toContain('name="app-environment" content="prod"');
		expect(html).toContain("fixture-basic@1.2.3");
	});

	it("tints the title and generates a favicon in dev mode", async () => {
		await build({
			root: basicRoot,
			configFile: false,
			logLevel: "silent",
			mode: "development",
			build: { outDir: "dist-test", write: true },
			plugins: [whereami()],
		});

		const html = await readFile(path.join(basicRoot, "dist-test/index.html"), "utf-8");
		expect(html).toContain("<title>🟢 My App</title>");
		expect(html).toContain('rel="icon"');
		expect(html).toContain('href="/__whereami-favicon.svg"');
		expect(html).toContain('name="app-name" content="fixture-basic"');
		expect(html).toContain('name="app-version" content="1.2.3"');
		expect(html).toContain('name="app-environment" content="dev"');
		expect(existsSync(path.join(basicRoot, "dist-test/__whereami-favicon.svg"))).toBe(true);
	});

	it("tints an existing favicon instead of generating a default one", async () => {
		await build({
			root: withIconRoot,
			configFile: false,
			logLevel: "silent",
			mode: "staging",
			build: { outDir: "dist-test", write: true },
			plugins: [whereami()],
		});

		const html = await readFile(path.join(withIconRoot, "dist-test/index.html"), "utf-8");
		expect(html).toContain('href="/__whereami-favicon.svg"');
		const favicon = await readFile(
			path.join(withIconRoot, "dist-test/__whereami-favicon.svg"),
			"utf-8",
		);
		expect(favicon).toContain("<filter");
		expect(favicon).toContain('flood-color="#f59e0b"');
	});

	it("respects a custom detect() and environments map", async () => {
		await build({
			root: basicRoot,
			configFile: false,
			logLevel: "silent",
			mode: "whatever",
			build: { outDir: "dist-test", write: true },
			plugins: [
				whereami({
					detect: () => "qa",
					environments: { qa: { color: "#ff00ff", titlePrefix: "[QA] " } },
				}),
			],
		});

		const html = await readFile(path.join(basicRoot, "dist-test/index.html"), "utf-8");
		expect(html).toContain("<title>[QA] My App</title>");
		expect(html).toContain('name="app-environment" content="qa"');
	});

	it("disables the banner entirely when banner: false", async () => {
		await build({
			root: basicRoot,
			configFile: false,
			logLevel: "silent",
			mode: "development",
			build: { outDir: "dist-test", write: true },
			plugins: [whereami({ banner: false })],
		});

		const html = await readFile(path.join(basicRoot, "dist-test/index.html"), "utf-8");
		expect(html).not.toContain("app-name");
		expect(html).not.toContain("console.log");
	});
});

describe("dev server", () => {
	it("serves the generated favicon and transforms index.html", async () => {
		server = await createServer({
			root: basicRoot,
			configFile: false,
			logLevel: "silent",
			mode: "development",
			server: { port: 0, strictPort: false },
			plugins: [whereami()],
		});
		await server.listen();

		const address = server.httpServer?.address();
		if (!address || typeof address === "string") throw new Error("no server address");
		const base = `http://localhost:${address.port}`;

		const htmlRes = await fetch(`${base}/`);
		const html = await htmlRes.text();
		expect(html).toContain("<title>🟢 My App</title>");
		expect(html).toContain('href="/__whereami-favicon.svg"');

		const faviconRes = await fetch(`${base}/__whereami-favicon.svg`);
		expect(faviconRes.status).toBe(200);
		expect(faviconRes.headers.get("content-type")).toContain("image/svg+xml");
		expect(await faviconRes.text()).toContain("<svg");
	});
});
