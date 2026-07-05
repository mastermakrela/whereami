import { readFile } from "node:fs/promises";
import path from "node:path";

export interface PkgInfo {
	name: string;
	version: string;
}

export async function readPkgInfo(root: string, pkgPath = "package.json"): Promise<PkgInfo> {
	const resolved = path.resolve(root, pkgPath);
	try {
		const raw = await readFile(resolved, "utf-8");
		const json = JSON.parse(raw);
		return { name: json.name ?? "app", version: json.version ?? "0.0.0" };
	} catch {
		return { name: "app", version: "0.0.0" };
	}
}
