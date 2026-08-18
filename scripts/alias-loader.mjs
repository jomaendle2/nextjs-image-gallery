/**
 * Teaches plain `node` the `@/` import alias.
 *
 * Node runs this project's TypeScript directly — no build step, no extra
 * dependency — but it resolves imports itself and knows nothing about the
 * `paths` mapping in `tsconfig.json`. So a script can import
 * `src/lib/database.ts` happily and then fail the moment that file imports
 * something as `@/lib/...`, which most of them eventually do.
 *
 * Thirty lines here rather than adding `tsx` or `vite-node` to the project:
 * the alternative is a dependency and a second way of running TypeScript,
 * for a rewrite rule that fits on one line.
 *
 * Used by the smoke scripts:
 *
 *   node --import ./scripts/alias-loader.mjs --env-file=.env.local script.mts
 */
import { register } from "node:module";
import { pathToFileURL } from "node:url";

const projectRoot = new URL("..", import.meta.url);

/*
 * Two rewrites, because app code relies on the bundler for both: `@/` for
 * the project root, and the omitted `.ts` extension. Node requires an
 * explicit extension in ESM, so the candidates are tried in the same order a
 * bundler would.
 */
register(
  `data:text/javascript,
   const root = ${JSON.stringify(projectRoot.href)};
   export async function resolve(specifier, context, nextResolve) {
     const target = specifier.startsWith("@/")
       ? new URL("src/" + specifier.slice(2), root).href
       : specifier;

     const candidates = /\\.[cm]?[jt]sx?$/.test(target)
       ? [target]
       : [target, target + ".ts", target + ".tsx", target + "/index.ts"];

     let lastError;
     for (const candidate of candidates) {
       try {
         return await nextResolve(candidate, context);
       } catch (error) {
         lastError = error;
       }
     }
     throw lastError;
   }`,
  pathToFileURL("./"),
);
