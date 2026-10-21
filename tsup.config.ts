import { defineConfig } from "tsup";

export default defineConfig({
	entry: ["src/index.ts", "src/sveltekit.ts"],
	format: ["esm", "cjs"],
	// tsup's dts build always injects `baseUrl`, which TypeScript 6 rejects as deprecated.
	dts: {
		entry: ["src/index.ts", "src/sveltekit.ts", "src/build.ts"],
		compilerOptions: { ignoreDeprecations: "6.0" },
	},
	sourcemap: true,
	clean: true,
	target: "node18",
});
