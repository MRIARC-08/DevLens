// src/lib/pipeline/classifier.ts
// Step 5: Detect the FileType of each source file based on path + content signals.

import { FileType } from "@prisma/client";
import type { FunctionItem } from "./parser";

// JSX pattern: an uppercase component tag like <MyComponent or <React.
const JSX_PATTERN = /<[A-Z][A-Za-z]/;

/**
 * Classify a source file into one of the FileType enum values.
 * Rules are evaluated in priority order — first match wins.
 *
 * @param filePath   Relative path: "src/components/Button.tsx"
 * @param content    Raw source code content
 * @param functions  Parsed functions from parser.ts (used for component signal)
 * @returns          A FileType enum value
 */
export function classifyFile(
  filePath: string,
  content: string,
  functions: FunctionItem[]
): FileType {
  const lower = filePath.toLowerCase();
  const fileName = lower.split("/").pop() ?? lower;
  const ext = fileName.split(".").pop() ?? "";

  // ── 1. HOOK ─────────────────────────────────────────────────────────────
  // File name starts with "use" (case-sensitive on the original) and is TS/TSX
  const rawFileName = filePath.split("/").pop() ?? filePath;
  if (
    rawFileName.startsWith("use") &&
    (ext === "ts" || ext === "tsx")
  ) {
    return FileType.HOOK;
  }

  // ── 2. PAGE ─────────────────────────────────────────────────────────────
  // Lives inside /pages/ or /app/ and has a JS/TS extension
  if (
    (lower.includes("/pages/") || lower.includes("/app/")) &&
    ["js", "jsx", "ts", "tsx"].includes(ext)
  ) {
    return FileType.PAGE;
  }

  // ── 3. CONTEXT ──────────────────────────────────────────────────────────
  // File name contains "context" or "provider"
  if (fileName.includes("context") || fileName.includes("provider")) {
    return FileType.CONTEXT;
  }

  // ── 4. COMPONENT (first chance) ─────────────────────────────────────────
  // .jsx or .tsx AND is in a components/ui folder OR contains JSX
  if (ext === "jsx" || ext === "tsx") {
    const inComponentPath =
      lower.includes("/components/") || lower.includes("/ui/");
    const hasJsx = JSX_PATTERN.test(content);
    if (inComponentPath || hasJsx) {
      return FileType.COMPONENT;
    }
  }

  // ── 5. SERVICE ──────────────────────────────────────────────────────────
  // Lives in /services/, /api/, or /server/ paths
  if (
    lower.includes("/services/") ||
    lower.includes("/api/") ||
    lower.includes("/server/")
  ) {
    return FileType.SERVICE;
  }

  // ── 6. TYPE ─────────────────────────────────────────────────────────────
  // .d.ts file, OR in /types/ or /interfaces/, OR name contains "types"/"interface"
  if (
    rawFileName.endsWith(".d.ts") ||
    lower.includes("/types/") ||
    lower.includes("/interfaces/") ||
    fileName.includes("types") ||
    fileName.includes("interface")
  ) {
    return FileType.TYPE;
  }

  // ── 7. UTILITY ──────────────────────────────────────────────────────────
  // Lives in /utils/, /lib/, /helpers/, or /shared/
  if (
    lower.includes("/utils/") ||
    lower.includes("/lib/") ||
    lower.includes("/helpers/") ||
    lower.includes("/shared/")
  ) {
    return FileType.UTILITY;
  }

  // ── 8. CONFIG ───────────────────────────────────────────────────────────
  // File name contains config, constants, or settings
  if (
    fileName.includes("config") ||
    fileName.includes("constants") ||
    fileName.includes("settings")
  ) {
    return FileType.CONFIG;
  }

  // ── 9. COMPONENT (second chance) ────────────────────────────────────────
  // Didn't match above, but content has JSX — still a component
  if (JSX_PATTERN.test(content)) {
    return FileType.COMPONENT;
  }

  // ── 10. UNKNOWN ─────────────────────────────────────────────────────────
  return FileType.UNKNOWN;
}
