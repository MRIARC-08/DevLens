// src/lib/pipeline/resolver.ts
// Step 4: Resolve relative import paths to actual file paths in the repo.

import path from "path";
import type { ImportItem } from "./parser";

/** An import with its resolved path (or null if unresolvable) */
export interface ResolvedImport extends ImportItem {
  resolvedPath: string | null; // "src/services/userService.ts" or null
  targetFileId: string | null; // filled in by the orchestrator after DB save
}

// Extensions to try when resolving bare paths (no extension in import string)
const TRY_EXTENSIONS = [".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"];

// Index files to try inside a directory
const TRY_INDEX = ["index.ts", "index.tsx", "index.js", "index.jsx"];

/**
 * Try to find a matching file in allFilePaths for a given candidate path.
 * Tries: exact, then each extension, then /index.* variants.
 */
function findMatch(candidate: string, allFilePaths: string[]): string | null {
  // 1. Exact match (import already had an extension)
  if (allFilePaths.includes(candidate)) return candidate;

  // 2. Try appending common extensions
  for (const ext of TRY_EXTENSIONS) {
    const withExt = candidate + ext;
    if (allFilePaths.includes(withExt)) return withExt;
  }

  // 3. Try as a directory → index file
  for (const idx of TRY_INDEX) {
    const asIndex = `${candidate}/${idx}`;
    if (allFilePaths.includes(asIndex)) return asIndex;
  }

  return null;
}

/**
 * Resolves the list of imports for one file against the full list of known
 * file paths in the repository.
 *
 * @param imports          Parsed imports from parser.ts
 * @param currentFilePath  Relative path of the file owning these imports
 *                         e.g. "src/components/UserProfile.tsx"
 * @param allFilePaths     All relative file paths in the repo
 */
export function resolveImports(
  imports: ImportItem[],
  currentFilePath: string,
  allFilePaths: string[]
): ResolvedImport[] {
  const resolved: ResolvedImport[] = [];

  const sourceDir = path.dirname(currentFilePath).replace(/\\/g, "/");

  for (const imp of imports) {
    try {
      // External packages (react, lodash, etc.) — never resolvable in the repo
      if (imp.isExternal) {
        resolved.push({
          ...imp,
          resolvedPath: null,
          targetFileId: null,
        });
        continue;
      }

      // Dynamic imports that aren't plain string literals are unresolvable
      // (e.g. import(variable) — source would be empty or a template)
      if (!imp.source) {
        resolved.push({ ...imp, resolvedPath: null, targetFileId: null });
        continue;
      }

      // Resolve the raw import source relative to the current file's directory
      // path.posix.join handles the ../ traversal correctly
      const rawResolved = path
        .posix
        .join(sourceDir, imp.source)
        .replace(/\\/g, "/");

      // rawResolved might be like "src/services/userService" (no extension)
      const match = findMatch(rawResolved, allFilePaths);

      resolved.push({
        ...imp,
        resolvedPath: match,
        targetFileId: null, // orchestrator fills this in after DB save
      });
    } catch (err) {
      console.warn(
        `[resolver] Error resolving "${imp.source}" in ${currentFilePath}:`,
        err
      );
      resolved.push({ ...imp, resolvedPath: null, targetFileId: null });
    }
  }

  return resolved;
}
