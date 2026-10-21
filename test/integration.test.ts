import { existsSync } from "node:fs";
import { mkdir, readFile, rm, symlink } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { type ViteDevServer, build, createServer } from "vite";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
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
		// prod has no titlePrefix configured, so no title keeper script either.
		expect(html).not.toContain("MutationObserver");
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
		// A prefixed environment also gets the client-side title keeper, so the prefix survives
		// a framework re-setting document.title after this SSR HTML hydrates.
		expect(html).toContain("MutationObserver");
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

	it("uses an explicit pkg option instead of reading package.json off disk", async () => {
		await build({
			root: basicRoot,
			configFile: false,
			logLevel: "silent",
			mode: "development",
			build: { outDir: "dist-test", write: true },
			plugins: [whereami({ pkg: { name: "overridden", version: "9.9.9" } })],
		});

		const html = await readFile(path.join(basicRoot, "dist-test/index.html"), "utf-8");
		expect(html).toContain('name="app-name" content="overridden"');
		expect(html).toContain('name="app-version" content="9.9.9"');
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

	it("includes the on-screen badge with metadata in dev, but not in prod", async () => {
		const metadata = { region: "eu-central" };

		await build({
			root: basicRoot,
			configFile: false,
			logLevel: "silent",
			mode: "development",
			build: { outDir: "dist-test", write: true },
			plugins: [whereami({ metadata })],
		});
		const devHtml = await readFile(path.join(basicRoot, "dist-test/index.html"), "utf-8");
		expect(devHtml).toContain("clip-path:polygon");
		expect(devHtml).toContain('"region":"eu-central"');
		expect(devHtml).toContain('console.log({"region":"eu-central"});');

		await build({
			root: basicRoot,
			configFile: false,
			logLevel: "silent",
			mode: "production",
			build: { outDir: "dist-test", write: true },
			plugins: [whereami({ metadata })],
		});
		const prodHtml = await readFile(path.join(basicRoot, "dist-test/index.html"), "utf-8");
		expect(prodHtml).not.toContain("clip-path:polygon");
	});

	it("disables the badge via badge: false while keeping the console banner", async () => {
		await build({
			root: basicRoot,
			configFile: false,
			logLevel: "silent",
			mode: "development",
			build: { outDir: "dist-test", write: true },
			plugins: [whereami({ badge: false })],
		});

		const html = await readFile(path.join(basicRoot, "dist-test/index.html"), "utf-8");
		expect(html).not.toContain("clip-path:polygon");
		expect(html).toContain("console.log(");
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

/** An SSR build, like SvelteKit's server build, where a node_modules import is externalized. */
async function ssrBuild(plugin = whereami()) {
	const output = await build({
		root: basicRoot,
		configFile: false,
		logLevel: "silent",
		mode: "production",
		build: { ssr: "build-info.js", write: false },
		plugins: [plugin],
	});
	const result = Array.isArray(output) ? output[0] : output;
	if (!("output" in result)) throw new Error("expected a one-off build, not a watcher");
	return result.output[0].code;
}

describe("vite-plugin-whereami/build", () => {
	// Installed like in a real app: the dev server externalizes whatever node_modules resolves.
	const installed = path.join(basicRoot, "node_modules/vite-plugin-whereami");
	beforeAll(async () => {
		await mkdir(path.dirname(installed), { recursive: true });
		await rm(installed, { force: true });
		await symlink(path.join(here, ".."), installed);
	});
	afterAll(() => rm(installed, { force: true }));

	afterEach(() => {
		delete process.env.CI_COMMIT_SHORT_SHA;
	});

	it("bakes the build-time environment and the version plus commit into the SSR bundle", async () => {
		process.env.CI_COMMIT_SHORT_SHA = "abc1234";

		const code = await ssrBuild(whereami({ detect: ({ env }) => env.DEPLOY_TARGET ?? "staging" }));

		expect(code).toContain('"environment": "staging"');
		expect(code).toContain('"version": "1.2.3+abc1234"');
		expect(code).not.toMatch(/from "vite-plugin-whereami\/build"/);
	});

	it("keeps an explicit pkg exactly as given", async () => {
		process.env.CI_COMMIT_SHORT_SHA = "abc1234";

		const code = await ssrBuild(whereami({ pkg: { name: "mine", version: "2.0.0" } }));

		expect(code).toContain('"version": "2.0.0"');
		expect(code).toContain('"environment": "prod"');
	});

	it("answers the import in the dev server's SSR module graph too", async () => {
		server = await createServer({
			root: basicRoot,
			configFile: false,
			logLevel: "silent",
			server: { middlewareMode: true },
			// Keep the node_modules path, or the symlinked package would count as source code.
			resolve: { preserveSymlinks: true },
			plugins: [whereami()],
		});

		const mod = await server.ssrLoadModule("/build-info.js");

		expect(mod.default.environment).toBe("dev");
		expect(mod.default.pkg.name).toBe("fixture-basic");
	});

	it("drops its HTML hooks next to SvelteKit, which warns about transformIndexHtml", async () => {
		const plugin = whereami();
		await build({
			root: basicRoot,
			configFile: false,
			logLevel: "silent",
			mode: "development",
			build: { outDir: "dist-test", write: true },
			plugins: [{ name: "vite-plugin-sveltekit-setup" }, plugin],
		});

		expect(plugin.transformIndexHtml).toBeUndefined();
		expect(existsSync(path.join(basicRoot, "dist-test/__whereami-favicon.svg"))).toBe(false);
	});
});
