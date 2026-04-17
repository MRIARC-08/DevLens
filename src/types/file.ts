// src/types/file.ts
// File and ParsedFile TypeScript types

export type FileType =
  | "COMPONENT"
  | "PAGE"
  | "SERVICE"
  | "UTILITY"
  | "HOOK"
  | "CONTEXT"
  | "CONFIG"
  | "TYPE"
  | "UNKNOWN";

export type ParseStatus = "PENDING" | "SUCCESS" | "PARTIAL" | "FAILED" | "SKIPPED";

export interface FileRecord {
  id: string;
  repositoryId: string;
  filePath: string;
  fileName: string;
  directory: string;
  extension: string;
  sizeBytes: number;
  rawContent: string;
  fileType: FileType;
  parseStatus: ParseStatus;
  parseError?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ParsedImport {
  source: string;
  specifiers: string[];
  isExternal: boolean;
  isDynamic: boolean;
  resolvedPath?: string;
}

export interface ParsedExport {
  name: string;
  type: "default" | "named";
  kind: "function" | "class" | "variable" | "type";
}

export interface ParsedFunction {
  name: string;
  isAsync: boolean;
  isExported: boolean;
  isComponent: boolean;
  lineStart: number;
  lineEnd: number;
  params: string[];
}

export interface ParsedFile {
  id: string;
  fileId: string;
  imports: ParsedImport[];
  exports: ParsedExport[];
  functions: ParsedFunction[];
  importCount: number;
  exportCount: number;
  functionCount: number;
  componentCount: number;
}
