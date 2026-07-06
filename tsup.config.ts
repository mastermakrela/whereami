import { defineConfig } from "tsup";

export default defineConfig({
	entry: ["src/index.ts", "src/sveltekit.ts"],
	format: ["esm", "cjs"],
	dts: true,
	sourcemap: true,
	clean: true,
	target: "node18",
});
