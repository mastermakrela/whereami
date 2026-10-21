import type { WhereAmIBuild } from "./types.js";

/**
 * Types only: the `whereami()` Vite plugin answers this import. A runtime file here would be
 * SSR-externalized by `vite dev` before the plugin ever saw the import.
 */
declare const build: WhereAmIBuild;

export default build;
