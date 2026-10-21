import type { WhereAmIBuild } from "./types.js";

/**
 * What an app gets when the `whereami()` Vite plugin isn't installed: nothing, so
 * `whereamiHandle({ ...build })` falls back to its request-time detection. With the plugin,
 * Vite never loads this file — the plugin answers the import with the build-time values.
 */
const build: WhereAmIBuild = {};

export default build;
