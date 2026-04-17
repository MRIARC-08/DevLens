// src/lib/pipeline/parser.ts
// Extracts imports, exports, and functions from JS/TS source files using REGEX ONLY.
// Supports BOTH ES Modules (import/export) AND CommonJS (require/module.exports).
// Never throws — always returns a valid ParseResult even on partial failure.

/** An import statement found in the file */
export interface ImportItem {
  source: string; // "../services/userService" or "express"
  specifiers: string[]; // ["fetchUser"] or []
  isExternal: boolean; // true if not starting with . or /
  isDynamic: boolean; // true if dynamic import()
}

/** An export found in the file */
export interface ExportItem {
  name: string; // "UserProfile", "default", "static"
  type: "default" | "named";
  kind: "function" | "class" | "variable" | "unknown";
}

/** A function or component found in the file */
export interface FunctionItem {
  name: string;
  isAsync: boolean;
  isExported: boolean;
  isComponent: boolean; // name starts with uppercase
  params: string[];
  lineStart: number;
  lineEnd: number;
}

/** Full result from parsing one file */
export interface ParseResult {
  imports: ImportItem[];
  exports: ExportItem[];
  functions: FunctionItem[];
  parseMethod: "regex";
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Returns the 1-indexed line number of a character position in a string */
function getLineNumber(content: string, index: number): number {
  return content.substring(0, index).split("\n").length;
}

/** Trim, strip aliases, and clean specifier list */
function cleanSpecifiers(raw: string): string[] {
  return raw
    .split(",")
    .map((s) => s.replace(/\s+as\s+\w+/g, "").trim())
    .filter(Boolean);
}

/** Best-effort parameter name extraction */
function parseParams(raw: string): string[] {
  if (!raw.trim()) return [];
  return raw
    .split(",")
    .map((p) =>
      p
        .trim()
        .replace(/[=:].*/g, "")
        .replace(/[{}[\]]/g, "")
        .trim()
    )
    .filter((p) => p && /^\w+/.test(p))
    .slice(0, 10);
}

/** Estimate the closing brace line for a function (best-effort) */
function estimateLineEnd(lines: string[], lineStart: number): number {
  let depth = 0;
  let started = false;
  for (let i = lineStart - 1; i < Math.min(lines.length, lineStart + 200); i++) {
    for (const ch of lines[i]) {
      if (ch === "{") { depth++; started = true; }
      if (ch === "}") depth--;
    }
    if (started && depth <= 0) return i + 1;
  }
  return lineStart + 1;
}

// ─── Import Extraction ────────────────────────────────────────────────────────

function extractImports(content: string): ImportItem[] {
  const imports: ImportItem[] = [];

  // ── ES Module patterns ────────────────────────────────────────────────

  try {
    // 1. Named: import { X, Y } from 'source'  (also: import type { X })
    const namedRe = /import\s+(?:type\s+)?\{([^}]*)\}\s+from\s+['"]([^'"]+)['"]/g;
    for (const m of content.matchAll(namedRe)) {
      imports.push({
        source: m[2],
        specifiers: cleanSpecifiers(m[1]),
        isExternal: !m[2].startsWith(".") && !m[2].startsWith("/"),
        isDynamic: false,
      });
    }

    // 2. Default: import X from 'source'
    const defaultRe =
      /import\s+(?:type\s+)?(\w+)(?:\s*,\s*\{[^}]*\})?\s+from\s+['"]([^'"]+)['"]/g;
    for (const m of content.matchAll(defaultRe)) {
      if (!imports.find((i) => i.source === m[2] && !i.isDynamic)) {
        imports.push({
          source: m[2],
          specifiers: [m[1]],
          isExternal: !m[2].startsWith(".") && !m[2].startsWith("/"),
          isDynamic: false,
        });
      }
    }

    // 3. Namespace: import * as X from 'source'
    const nsRe = /import\s+\*\s+as\s+(\w+)\s+from\s+['"]([^'"]+)['"]/g;
    for (const m of content.matchAll(nsRe)) {
      if (!imports.find((i) => i.source === m[2] && !i.isDynamic)) {
        imports.push({
          source: m[2],
          specifiers: [m[1]],
          isExternal: !m[2].startsWith(".") && !m[2].startsWith("/"),
          isDynamic: false,
        });
      }
    }

    // 4. Side-effect: import 'source'
    const seRe = /import\s+['"]([^'"]+)['"]/g;
    for (const m of content.matchAll(seRe)) {
      if (!imports.find((i) => i.source === m[1])) {
        imports.push({
          source: m[1],
          specifiers: [],
          isExternal: !m[1].startsWith(".") && !m[1].startsWith("/"),
          isDynamic: false,
        });
      }
    }

    // 5. Dynamic: import('source')
    const dynRe = /\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
    for (const m of content.matchAll(dynRe)) {
      imports.push({
        source: m[1],
        specifiers: [],
        isExternal: !m[1].startsWith(".") && !m[1].startsWith("/"),
        isDynamic: true,
      });
    }
  } catch (err) {
    console.warn("[parser] ES import extraction error:", err);
  }

  // ── CommonJS require() patterns ───────────────────────────────────────

  try {
    // CJS-1: const { X, Y } = require('source')  — destructured
    const cjsDestructuredRe =
      /(?:var|const|let)\s+\{([^}]+)\}\s*=\s*require\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
    for (const m of content.matchAll(cjsDestructuredRe)) {
      const source = m[2];
      if (!imports.find((i) => i.source === source && !i.isDynamic)) {
        imports.push({
          source,
          specifiers: cleanSpecifiers(m[1]),
          isExternal: !source.startsWith(".") && !source.startsWith("/"),
          isDynamic: false,
        });
      }
    }

    // CJS-2: const x = require('source')  — simple assignment
    const cjsSimpleRe =
      /(?:var|const|let)\s+(\w+)\s*=\s*require\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
    for (const m of content.matchAll(cjsSimpleRe)) {
      const source = m[2];
      if (!imports.find((i) => i.source === source && !i.isDynamic)) {
        imports.push({
          source,
          specifiers: [m[1]],
          isExternal: !source.startsWith(".") && !source.startsWith("/"),
          isDynamic: false,
        });
      }
    }

    // CJS-3: require('source')  — bare call (side-effect or unassigned)
    const cjsBareRe = /\brequire\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
    for (const m of content.matchAll(cjsBareRe)) {
      const source = m[1];
      if (!imports.find((i) => i.source === source && !i.isDynamic)) {
        imports.push({
          source,
          specifiers: [],
          isExternal: !source.startsWith(".") && !source.startsWith("/"),
          isDynamic: false,
        });
      }
    }
  } catch (err) {
    console.warn("[parser] CJS require extraction error:", err);
  }

  // Deduplicate by source + isDynamic (first occurrence wins)
  const seen = new Set<string>();
  return imports.filter((imp) => {
    const key = `${imp.source}::${imp.isDynamic}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// ─── Export Extraction ────────────────────────────────────────────────────────

function extractExports(content: string): ExportItem[] {
  const exports: ExportItem[] = [];

  // ── ES Module export patterns ─────────────────────────────────────────

  try {
    // export default function Name
    for (const m of content.matchAll(
      /export\s+default\s+(?:async\s+)?function\s+(\w+)/g
    )) {
      exports.push({ name: m[1], type: "default", kind: "function" });
    }

    // export default class Name
    for (const m of content.matchAll(/export\s+default\s+class\s+(\w+)/g)) {
      exports.push({ name: m[1], type: "default", kind: "class" });
    }

    // export function Name
    for (const m of content.matchAll(
      /export\s+(?:async\s+)?function\s+(\w+)/g
    )) {
      exports.push({ name: m[1], type: "named", kind: "function" });
    }

    // export class Name
    for (const m of content.matchAll(/export\s+class\s+(\w+)/g)) {
      exports.push({ name: m[1], type: "named", kind: "class" });
    }

    // export const/let/var Name
    for (const m of content.matchAll(
      /export\s+(?:const|let|var)\s+(\w+)/g
    )) {
      exports.push({ name: m[1], type: "named", kind: "variable" });
    }

    // export type/interface Name
    for (const m of content.matchAll(
      /export\s+(?:type|interface)\s+(\w+)/g
    )) {
      exports.push({ name: m[1], type: "named", kind: "variable" });
    }

    // export { Name1, Name2 }
    for (const m of content.matchAll(/export\s+\{([^}]+)\}/g)) {
      for (const name of cleanSpecifiers(m[1])) {
        exports.push({ name, type: "named", kind: "unknown" });
      }
    }
  } catch (err) {
    console.warn("[parser] ES export extraction error:", err);
  }

  // ── CommonJS export patterns ──────────────────────────────────────────

  try {
    // CJS-1: module.exports = X  (default export — the whole module)
    const modExportsDefaultRe =
      /module\.exports\s*=\s*(?!{|\[)(\w+)?/g;
    for (const m of content.matchAll(modExportsDefaultRe)) {
      const name = m[1] || "default";
      exports.push({ name, type: "default", kind: "unknown" });
    }

    // CJS-2: module.exports.Name = ...
    const modExportsNamedRe = /module\.exports\.(\w+)\s*=/g;
    for (const m of content.matchAll(modExportsNamedRe)) {
      // Detect kind from what's on the right side
      const afterEq = content.slice((m.index ?? 0) + m[0].length).trimStart();
      const kind: ExportItem["kind"] = afterEq.startsWith("function")
        ? "function"
        : afterEq.startsWith("class")
        ? "class"
        : "variable";
      exports.push({ name: m[1], type: "named", kind });
    }

    // CJS-3: exports.Name = ...
    const exportsNamedRe = /(?<!\.)exports\.(\w+)\s*=/g;
    for (const m of content.matchAll(exportsNamedRe)) {
      const afterEq = content.slice((m.index ?? 0) + m[0].length).trimStart();
      const kind: ExportItem["kind"] = afterEq.startsWith("function")
        ? "function"
        : afterEq.startsWith("require")
        ? "variable" // re-exported require
        : "variable";
      exports.push({ name: m[1], type: "named", kind });
    }
  } catch (err) {
    console.warn("[parser] CJS export extraction error:", err);
  }

  // Deduplicate by name+type
  const seen = new Set<string>();
  return exports.filter((e) => {
    const key = `${e.name}::${e.type}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// ─── Function Extraction ──────────────────────────────────────────────────────

function extractFunctions(content: string): FunctionItem[] {
  const functions: FunctionItem[] = [];
  const lines = content.split("\n");

  function push(
    name: string,
    isAsync: boolean,
    isExported: boolean,
    paramsRaw: string,
    index: number
  ) {
    // Skip duplicates by name
    if (functions.find((f) => f.name === name)) return;
    const lineStart = getLineNumber(content, index);
    functions.push({
      name,
      isAsync,
      isExported,
      isComponent: /^[A-Z]/.test(name),
      params: parseParams(paramsRaw),
      lineStart,
      lineEnd: estimateLineEnd(lines, lineStart),
    });
  }

  try {
    // ── ES Module patterns ──────────────────────────────────────────────

    // function declarations: [export] [async] function Name(params)
    for (const m of content.matchAll(
      /^[ \t]*(export\s+)?(default\s+)?(async\s+)?function\s+(\w+)\s*\(([^)]*)\)/gm
    )) {
      push(m[4], !!m[3], !!m[1], m[5] ?? "", m.index ?? 0);
    }

    // Arrow functions: [export] const Name = [async] (params) =>
    for (const m of content.matchAll(
      /^[ \t]*(export\s+)?const\s+(\w+)\s*=\s*(async\s+)?\(([^)]*)\)\s*=>/gm
    )) {
      push(m[2], !!m[3], !!m[1], m[4] ?? "", m.index ?? 0);
    }

    // Simple arrow: const Name = async param =>
    for (const m of content.matchAll(
      /^[ \t]*(export\s+)?const\s+(\w+)\s*=\s*(async\s+)?(\w+)\s*=>/gm
    )) {
      push(m[2], !!m[3], !!m[1], m[4] ?? "", m.index ?? 0);
    }

    // ── CommonJS / older JS patterns ────────────────────────────────────

    // CJS-1: var/const/let name = [async] function [name](params)
    //   var app = function() {}
    //   var Router = function Router() {}
    for (const m of content.matchAll(
      /^[ \t]*(?:var|const|let)\s+(\w+)\s*=\s*(async\s+)?function\s*\w*\s*\(([^)]*)\)/gm
    )) {
      push(m[1], !!m[2], false, m[3] ?? "", m.index ?? 0);
    }

    // CJS-2: proto.name = function name(params) or obj.method = function(params)
    //   app.use = function use(path, fn) {}
    //   proto.render = function(name, options) {}
    //   exports.query = function query() {}
    for (const m of content.matchAll(
      /^[ \t]*[\w.]+\.(\w+)\s*=\s*(async\s+)?function\s*\w*\s*\(([^)]*)\)/gm
    )) {
      const name = m[1];
      // Skip common non-function assignments like module.exports.static = ...
      if (["exports", "module"].includes(name)) continue;
      push(name, !!m[2], false, m[3] ?? "", m.index ?? 0);
    }

    // CJS-3: name: function(params) { — method shorthand in object literals
    //   render: function(req, res) {}
    //   handle: function handle(req, res, next) {}
    for (const m of content.matchAll(
      /^[ \t]+(\w+)\s*:\s*(async\s+)?function\s*\w*\s*\(([^)]*)\)/gm
    )) {
      push(m[1], !!m[2], false, m[3] ?? "", m.index ?? 0);
    }
  } catch (err) {
    console.warn("[parser] Function extraction error:", err);
  }

  // Deduplicate by name (first occurrence wins)
  const seen = new Set<string>();
  return functions.filter((f) => {
    if (seen.has(f.name)) return false;
    seen.add(f.name);
    return true;
  });
}

// ─── Main Export ──────────────────────────────────────────────────────────────

/**
 * Parse a source file and return structured data about its contents.
 * Handles both ES Modules and CommonJS.
 * NEVER throws — guaranteed to return a valid ParseResult.
 */
export async function parseFile(
  content: string,
  filePath: string
): Promise<ParseResult> {
  try {
    const imports = extractImports(content);
    const exports = extractExports(content);
    const functions = extractFunctions(content);

    console.log(
      `[parser] ${filePath} → ${imports.length} imports, ${exports.length} exports, ${functions.length} functions`
    );

    return { imports, exports, functions, parseMethod: "regex" };
  } catch (err) {
    console.error(`[parser] Critical error parsing ${filePath}:`, err);
    return { imports: [], exports: [], functions: [], parseMethod: "regex" };
  }
}
