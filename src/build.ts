import type { WhereAmIBuild } from "./types.js";

/** Only loaded without the `whereami()` Vite plugin, which answers this import itself. */
const build: WhereAmIBuild = {};

export default build;
