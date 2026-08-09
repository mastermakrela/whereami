export interface NodeIO {
	fs: typeof import("node:fs/promises");
	path: typeof import("node:path");
}

const FS_MODULE = "node:fs/promises";
const PATH_MODULE = "node:path";

/**
 * `import()` a Node-only module without letting the bundler follow it.
 *
 * `whereamiHandle` runs inside the deployed server, and on edge/isolate runtimes (Cloudflare
 * Workers, Vercel Edge, Deno Deploy) there is no filesystem — every caller of this already
 * has a no-disk fallback. But a *statically analysable* specifier — even inside a dynamic
 * `import("node:fs")` — makes those bundlers resolve it at build time and fail ("add the
 * nodejs_compat compatibility flag") over a code path that could never run there. Passing the
 * specifier as a variable defers it to runtime, where it simply rejects and the fallback
 * takes over. Also normalizes CJS interop, since these are all CJS or builtin modules.
 */
export async function importUnbundled<T>(specifier: string): Promise<T> {
	const mod = await import(/* @vite-ignore */ specifier);
	return (mod.default ?? mod) as T;
}

let cached: Promise<NodeIO | null> | undefined;

/**
 * Load Node's filesystem APIs, or `null` when the runtime has none. Cached, so the callers
 * that need both a path and a read (`favicon.ts`) pay for the import once.
 */
export function loadNodeIO(): Promise<NodeIO | null> {
	cached ??= (async () => {
		try {
			const [fs, path] = await Promise.all([
				importUnbundled<NodeIO["fs"]>(FS_MODULE),
				importUnbundled<NodeIO["path"]>(PATH_MODULE),
			]);
			return { fs, path };
		} catch {
			return null;
		}
	})();
	return cached;
}
