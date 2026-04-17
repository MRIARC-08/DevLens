// src/lib/pipeline/walker.ts
// Step 2: Recursively walk the cloned repo and return a list of source files

import fs from "fs";
import path from "path";

/** Shape of each file returned by the walker */
export interface WalkedFile {
  filePath: string; // relative to repo root: "src/components/Button.tsx"
  fileName: string; // just the filename: "Button.tsx"
  directory: string; // just the directory: "src/components"
  extension: string; // without dot: "tsx"
  sizeBytes: number; // raw file size in bytes
  rawContent: string; // full file content as UTF-8 string
}

// Folders we never recurse into
const SKIP_DIRS = new Set([
  "node_modules",
  ".git",
  ".next",
  "dist",
  "build",
  "out",
  "coverage",
  ".turbo",
  ".cache",
  "__pycache__",
  ".vercel",
  ".svelte-kit",
]);

// Only process files with these extensions
const ALLOWED_EXTENSIONS = new Set(["js", "jsx", "ts", "tsx", "mjs", "cjs"]);

// Skip files whose path contains these strings (minified/generated files)
const SKIP_PATH_PATTERNS = [".min.js", ".bundle.js", ".generated."];

// Max file size: 100 KB
const MAX_FILE_SIZE = 100 * 1024;

// Hard cap on total files processed
const MAX_FILES = 200;

/**
 * Walk the cloned repository and return an array of parseable source files.
 * Applies all filters defined above.
 *
 * @param clonedPath  Absolute path to the cloned repo on disk
 * @returns           Array of WalkedFile objects with relative paths
 */
export async function walkRepository(clonedPath: string): Promise<WalkedFile[]> {
  console.log(`[walker] Starting walk of ${clonedPath}`);

  const results: WalkedFile[] = [];

  function recurse(dir: string): void {
    if (results.length >= MAX_FILES) return;

    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch (err) {
      console.warn(`[walker] Could not read directory ${dir}:`, err);
      return;
    }

    for (const entry of entries) {
      if (results.length >= MAX_FILES) break;

      const fullPath = path.join(dir, entry.name);

      if (entry.isDirectory()) {
        // Skip blacklisted folders
        if (SKIP_DIRS.has(entry.name)) continue;
        recurse(fullPath);
        continue;
      }

      if (!entry.isFile()) continue;

      // Check extension
      const ext = entry.name.split(".").pop()?.toLowerCase() ?? "";
      if (!ALLOWED_EXTENSIONS.has(ext)) continue;

      // Get relative path from repo root
      const relativePath = path.relative(clonedPath, fullPath).replace(/\\/g, "/");

      // Skip path-pattern matches (minified/generated)
      if (SKIP_PATH_PATTERNS.some((p) => relativePath.includes(p))) continue;

      // Check file size
      let stat: fs.Stats;
      try {
        stat = fs.statSync(fullPath);
      } catch {
        continue;
      }
      if (stat.size > MAX_FILE_SIZE) {
        console.log(`[walker] Skipping large file (${stat.size}B): ${relativePath}`);
        continue;
      }

      // Read content
      let rawContent: string;
      try {
        rawContent = fs.readFileSync(fullPath, "utf-8");
      } catch (err) {
        console.warn(`[walker] Could not read file ${fullPath}:`, err);
        continue;
      }

      results.push({
        filePath: relativePath,
        fileName: entry.name,
        directory: path.dirname(relativePath).replace(/\\/g, "/"),
        extension: ext,
        sizeBytes: stat.size,
        rawContent,
      });
    }
  }

  recurse(clonedPath);

  if (results.length >= MAX_FILES) {
    console.warn(
      `[walker] ⚠ Hit ${MAX_FILES} file cap — large repo, some files skipped.`
    );
  }

  console.log(`[walker] ✓ Found ${results.length} files to process`);
  return results;
}
