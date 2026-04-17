// src/lib/pipeline/cloner.ts
// Step 1: Clone a GitHub repo to a temp directory using simple-git

import simpleGit from "simple-git";
import fs from "fs";
import path from "path";

/**
 * Clones a GitHub repository to a local temp directory.
 * Uses --depth 1 (shallow clone) for speed — we don't need git history.
 *
 * @param repoUrl  Full GitHub URL e.g. "https://github.com/vercel/next.js"
 * @param repoId   Unique ID from DB — used as the folder name
 * @returns        Absolute path to the cloned directory
 */
export async function cloneRepository(
  repoUrl: string,
  repoId: string
): Promise<string> {
  const base = process.env.CLONE_BASE_PATH ?? "/tmp/devlens";
  const clonePath = path.join(base, repoId);

  console.log(`[cloner] Starting clone of ${repoUrl} → ${clonePath}`);

  try {
    // Create the target directory if it doesn't exist
    fs.mkdirSync(clonePath, { recursive: true });

    const git = simpleGit();

    // Shallow clone — depth 1 means only the latest commit, much faster
    await git.clone(repoUrl, clonePath, ["--depth", "1"]);

    console.log(`[cloner] ✓ Clone complete: ${clonePath}`);
    return clonePath;
  } catch (err) {
    console.error(`[cloner] ✗ Clone failed for ${repoUrl}:`, err);

    // Clean up partial clone if it exists
    try {
      if (fs.existsSync(clonePath)) {
        fs.rmSync(clonePath, { recursive: true, force: true });
      }
    } catch {
      // Ignore cleanup errors
    }

    throw new Error(
      "Failed to clone repository. Make sure it is public and the URL is correct."
    );
  }
}
