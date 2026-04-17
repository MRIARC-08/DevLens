"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import {
  ChevronRight, ChevronDown,
  Folder, FolderOpen,
  FileCode, FileText, FileJson, File,
  Search,
} from "lucide-react";
import { FILE_TYPE_COLORS } from "@/components/graph/FileNode";

// ── Types ─────────────────────────────────────────────────────────────────────

interface FileItem {
  id: string;
  fileName: string;
  filePath: string;
  fileType: string;
  directory: string;
  sizeBytes: number;
  parseStatus: string;
  functionCount: number;
}

type TreeNode =
  | { kind: "dir"; name: string; path: string; children: TreeNode[] }
  | { kind: "file"; name: string; path: string; file: FileItem };

interface FileTreeProps {
  repoId: string;
  selectedFileId: string | null;
  onFileSelect: (fileId: string) => void;
}

// ── Tree builder ──────────────────────────────────────────────────────────────

/** Intermediate mutable map used during tree construction */
interface MutableDir {
  kind: "dir";
  name: string;
  path: string;
  children: Record<string, MutableDir | { kind: "file"; name: string; path: string; file: FileItem }>;
}

function buildTree(files: FileItem[]): TreeNode[] {
  const root: MutableDir["children"] = {};

  for (const file of files) {
    // Normalise: strip leading slashes, split on /
    const parts = file.filePath.replace(/^\/+/, "").split("/").filter(Boolean);
    if (parts.length === 0) continue;

    let cur = root;

    // Walk all directory segments
    for (let i = 0; i < parts.length - 1; i++) {
      const seg = parts[i];
      const dirPath = parts.slice(0, i + 1).join("/");
      if (!cur[seg]) {
        cur[seg] = { kind: "dir", name: seg, path: dirPath, children: {} };
      }
      const node = cur[seg];
      if (node.kind === "dir") cur = node.children;
    }

    // Leaf = the file itself
    const fileName = parts[parts.length - 1];
    cur[fileName] = { kind: "file", name: fileName, path: file.filePath, file };
  }

  /** Recursively convert the mutable map into a sorted TreeNode array */
  function toSortedNodes(map: MutableDir["children"]): TreeNode[] {
    const dirs: TreeNode[] = [];
    const files: TreeNode[] = [];

    for (const node of Object.values(map)) {
      if (node.kind === "dir") {
        dirs.push({ kind: "dir", name: node.name, path: node.path, children: toSortedNodes(node.children) });
      } else {
        files.push({ kind: "file", name: node.name, path: node.path, file: node.file });
      }
    }

    // Directories first, then files — both sorted alphabetically
    dirs.sort((a, b) => a.name.localeCompare(b.name));
    files.sort((a, b) => a.name.localeCompare(b.name));
    return [...dirs, ...files];
  }

  return toSortedNodes(root);
}

// ── File icon helper ──────────────────────────────────────────────────────────

function getFileIcon(name: string, fileType: string) {
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  const color = FILE_TYPE_COLORS[fileType] ?? "#6b6b80";

  if (["ts", "tsx", "js", "jsx", "mjs", "cjs"].includes(ext)) return <FileCode size={14} color={color} />;
  if (["json", "jsonc"].includes(ext)) return <FileJson size={14} color="#f59e0b" />;
  if (["md", "mdx", "txt"].includes(ext)) return <FileText size={14} color="#94a3b8" />;
  return <File size={14} color="#6b6b80" />;
}

// ── Row height constant ───────────────────────────────────────────────────────

const ROW_H = 22;

// ── Recursive tree renderer ───────────────────────────────────────────────────

function TreeNodeRow({
  node,
  depth,
  expanded,
  toggleDir,
  selectedFileId,
  onFileSelect,
}: {
  node: TreeNode;
  depth: number;
  expanded: Set<string>;
  toggleDir: (path: string) => void;
  selectedFileId: string | null;
  onFileSelect: (id: string) => void;
}) {
  const indent = depth * 12; // 12px per level (VS Code default is ~16px, slightly tighter)
  const isOpen = expanded.has(node.path);

  if (node.kind === "dir") {
    return (
      <>
        {/* Directory row */}
        <button
          onClick={() => toggleDir(node.path)}
          style={{
            width: "100%",
            display: "flex",
            alignItems: "center",
            height: ROW_H,
            paddingLeft: indent + 4,
            paddingRight: 8,
            gap: 4,
            border: "none",
            background: "none",
            cursor: "pointer",
            color: "#c5c5c8",
            fontSize: 13,
            textAlign: "left",
            transition: "background 0.1s",
            position: "relative",
            userSelect: "none",
          }}
          onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,255,255,0.05)")}
          onMouseLeave={e => (e.currentTarget.style.background = "none")}
        >
          {/* Indent guide lines */}
          {Array.from({ length: depth }).map((_, i) => (
            <div key={i} style={{
              position: "absolute",
              left: i * 12 + 12,
              top: 0, bottom: 0,
              width: 1,
              background: "rgba(255,255,255,0.05)",
              pointerEvents: "none",
            }} />
          ))}

          {/* Chevron */}
          <span style={{ width: 16, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            {isOpen
              ? <ChevronDown size={12} color="#6b6b80" />
              : <ChevronRight size={12} color="#6b6b80" />}
          </span>

          {/* Folder icon */}
          {isOpen
            ? <FolderOpen size={14} color="#c09553" style={{ flexShrink: 0 }} />
            : <Folder size={14} color="#c09553" style={{ flexShrink: 0 }} />}

          {/* Name */}
          <span style={{
            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1,
          }}>{node.name}</span>
        </button>

        {/* Children */}
        {isOpen && node.children.map((child) => (
          <TreeNodeRow
            key={child.path}
            node={child}
            depth={depth + 1}
            expanded={expanded}
            toggleDir={toggleDir}
            selectedFileId={selectedFileId}
            onFileSelect={onFileSelect}
          />
        ))}
      </>
    );
  }

  // ── File row ────────────────────────────────────────────────────────────────

  const isSelected = node.file.id === selectedFileId;

  return (
    <button
      onClick={() => onFileSelect(node.file.id)}
      title={node.path}
      style={{
        width: "100%",
        display: "flex",
        alignItems: "center",
        height: ROW_H,
        paddingLeft: indent + 20, // 20 = chevron placeholder width
        paddingRight: 8,
        gap: 6,
        border: "none",
        background: isSelected ? "rgba(124,107,240,0.16)" : "none",
        borderLeft: isSelected ? "2px solid #7c6bf0" : "2px solid transparent",
        cursor: "pointer",
        color: isSelected ? "#ffffff" : "#c5c5c8",
        fontSize: 13,
        textAlign: "left",
        transition: "background 0.1s",
        position: "relative",
        userSelect: "none",
      }}
      onMouseEnter={e => { if (!isSelected) { (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.05)"; } }}
      onMouseLeave={e => { if (!isSelected) { (e.currentTarget as HTMLElement).style.background = "none"; } }}
    >
      {/* Indent guide lines */}
      {Array.from({ length: depth }).map((_, i) => (
        <div key={i} style={{
          position: "absolute",
          left: i * 12 + 12,
          top: 0, bottom: 0,
          width: 1,
          background: "rgba(255,255,255,0.05)",
          pointerEvents: "none",
        }} />
      ))}

      {/* File icon */}
      <span style={{ flexShrink: 0 }}>
        {getFileIcon(node.name, node.file.fileType)}
      </span>

      {/* Name */}
      <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}>
        {node.name}
      </span>
    </button>
  );
}

// ── Search result row (flat) ──────────────────────────────────────────────────

function SearchRow({
  file,
  query,
  selectedFileId,
  onFileSelect,
}: {
  file: FileItem;
  query: string;
  selectedFileId: string | null;
  onFileSelect: (id: string) => void;
}) {
  const isSelected = file.id === selectedFileId;
  const q = query.toLowerCase();

  // Highlight matching part in name
  const lo = file.fileName.toLowerCase();
  const idx = lo.indexOf(q);
  const namePart = idx >= 0
    ? <>{file.fileName.slice(0, idx)}<mark style={{ background: "rgba(124,107,240,0.4)", color: "#fff", borderRadius: 2 }}>{file.fileName.slice(idx, idx + q.length)}</mark>{file.fileName.slice(idx + q.length)}</>
    : file.fileName;

  return (
    <button
      onClick={() => onFileSelect(file.id)}
      style={{
        width: "100%",
        display: "flex",
        flexDirection: "column",
        alignItems: "flex-start",
        height: "auto",
        padding: "4px 12px",
        gap: 1,
        border: "none",
        background: isSelected ? "rgba(124,107,240,0.16)" : "none",
        borderLeft: isSelected ? "2px solid #7c6bf0" : "2px solid transparent",
        cursor: "pointer",
        color: isSelected ? "#fff" : "#c5c5c8",
        fontSize: 13,
        textAlign: "left",
        transition: "background 0.1s",
        userSelect: "none",
      }}
      onMouseEnter={e => { if (!isSelected) (e.currentTarget.style.background = "rgba(255,255,255,0.05)"); }}
      onMouseLeave={e => { if (!isSelected) (e.currentTarget.style.background = "none"); }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        {getFileIcon(file.fileName, file.fileType)}
        <span>{namePart}</span>
      </div>
      <span style={{ fontSize: 11, color: "#4a4a5a", paddingLeft: 20 }}>{file.filePath}</span>
    </button>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function FileTree({ repoId, selectedFileId, onFileSelect }: FileTreeProps) {
  const [flatList, setFlatList] = useState<FileItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetch(`/api/repos/${repoId}/files`)
      .then((r) => r.json())
      .then((data) => {
        if (data.success) {
          setFlatList(data.flatList);
          // Auto-expand top-level directories
          const topDirs = new Set<string>();
          for (const f of data.flatList as FileItem[]) {
            const parts = f.filePath.split("/");
            if (parts.length > 1) topDirs.add(parts[0]);
          }
          setExpanded(topDirs);
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [repoId]);

  const toggleDir = useCallback((path: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  }, []);

  const tree = useMemo(() => buildTree(flatList), [flatList]);

  const filtered = useMemo(() => {
    if (!search) return [];
    const q = search.toLowerCase();
    return flatList.filter(
      (f) => f.fileName.toLowerCase().includes(q) || f.filePath.toLowerCase().includes(q)
    );
  }, [flatList, search]);

  // ── Loading ─────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div style={{ padding: "8px 12px", display: "flex", flexDirection: "column", gap: 4 }}>
        {Array.from({ length: 10 }).map((_, i) => (
          <div key={i} className="shimmer" style={{
            height: ROW_H, borderRadius: 3,
            width: `${45 + (i % 5) * 12}%`,
            marginLeft: (i % 3) * 12,
          }} />
        ))}
      </div>
    );
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden", background: "#0d0d14" }}>
      {/* Search bar */}
      <div style={{ padding: "8px 10px", flexShrink: 0, borderBottom: "1px solid #1a1a2a" }}>
        <div style={{
          display: "flex", alignItems: "center", gap: 6,
          background: "#111118", border: "1px solid #1e1e2e",
          borderRadius: 4, padding: "4px 8px",
        }}>
          <Search size={12} color="#4a4a5a" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search files..."
            style={{
              flex: 1, background: "none", border: "none", outline: "none",
              color: "#e2e2e8", fontSize: 12, fontFamily: "inherit",
            }}
          />
        </div>
      </div>

      {/* File count */}
      {!search && (
        <div style={{
          padding: "4px 12px 2px",
          fontSize: 10, color: "#3a3a5a",
          textTransform: "uppercase", letterSpacing: "0.08em",
          flexShrink: 0,
        }}>
          {flatList.length} files
        </div>
      )}

      {/* Tree / Search results */}
      <div style={{ flex: 1, overflowY: "auto" }}>
        {search
          ? filtered.length > 0
            ? filtered.map((f) => (
                <SearchRow
                  key={f.id}
                  file={f}
                  query={search}
                  selectedFileId={selectedFileId}
                  onFileSelect={onFileSelect}
                />
              ))
            : (
              <div style={{ padding: "20px 16px", textAlign: "center", fontSize: 12, color: "#3a3a5a" }}>
                No files match "{search}"
              </div>
            )
          : tree.map((node) => (
              <TreeNodeRow
                key={node.path}
                node={node}
                depth={0}
                expanded={expanded}
                toggleDir={toggleDir}
                selectedFileId={selectedFileId}
                onFileSelect={onFileSelect}
              />
            ))
        }
      </div>
    </div>
  );
}
