import { readFile } from "node:fs/promises";
import path from "node:path";

export interface PkgInfo {
	name: string;
	version: string;
}

export async function readPkgInfo(root: string, pkgPath?: string): Promise<PkgInfo> {
	const explicit = pkgPath !== undefined;
	const resolved = path.resolve(root, pkgPath ?? "package.json");
	try {
		const raw = await readFile(resolved, "utf-8");
		const json = JSON.parse(raw);
		return { name: json.name ?? "app", version: json.version ?? "0.0.0" };
	} catch (err) {
		if (explicit || (err as NodeJS.ErrnoException).code !== "ENOENT") {
			console.warn(
				`[vite-plugin-whereami] couldn't read package info from "${resolved}" (${(err as Error).message}) — falling back to "app@0.0.0"`,
			);
		}
		return { name: "app", version: "0.0.0" };
	}
}
