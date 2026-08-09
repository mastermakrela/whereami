import { loadNodeIO } from "./node-io.js";

export interface PkgInfo {
	name: string;
	version: string;
}

const FALLBACK: PkgInfo = { name: "app", version: "0.0.0" };

export async function readPkgInfo(root: string, pkgPath?: string): Promise<PkgInfo> {
	const explicit = pkgPath !== undefined;
	const io = await loadNodeIO();
	if (!io) {
		console.warn(
			`[vite-plugin-whereami] no filesystem at request time (edge/isolate runtime), so package.json can't be read — pass \`pkg: { name, version }\` imported from your package.json instead; falling back to "app@0.0.0"`,
		);
		return FALLBACK;
	}

	const resolved = io.path.resolve(root, pkgPath ?? "package.json");
	try {
		const raw = await io.fs.readFile(resolved, "utf-8");
		const json = JSON.parse(raw);
		return { name: json.name ?? "app", version: json.version ?? "0.0.0" };
	} catch (err) {
		if (explicit || (err as NodeJS.ErrnoException).code !== "ENOENT") {
			console.warn(
				`[vite-plugin-whereami] couldn't read package info from "${resolved}" (${(err as Error).message}) — falling back to "app@0.0.0"`,
			);
		}
		return FALLBACK;
	}
}
