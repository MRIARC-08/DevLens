"use client";

import { useEffect, useState } from "react";
import {
  X, Loader2, Sparkles, ChevronDown, ChevronRight,
  ArrowDownToLine, ArrowUpFromLine, FunctionSquare,
  AlertCircle,
} from "lucide-react";
import { Light as SyntaxHighlighter } from "react-syntax-highlighter";
import js from "react-syntax-highlighter/dist/esm/languages/hljs/javascript";
import ts from "react-syntax-highlighter/dist/esm/languages/hljs/typescript";
import { atomOneDark } from "react-syntax-highlighter/dist/esm/styles/hljs";
import { FILE_TYPE_COLORS } from "@/components/graph/FileNode";

SyntaxHighlighter.registerLanguage("javascript", js);
SyntaxHighlighter.registerLanguage("typescript", ts);

// ── Types ────────────────────────────────────────────────────────────────────

interface LinkedFile {
  id: string;
  fileName: string;
  filePath: string;
  fileType: string;
  importRaw: string;
  specifiers?: string[];
}

interface FunctionDef {
  name: string;
  isAsync: boolean;
  isExported: boolean;
  isComponent: boolean;
  lineStart: number;
}

interface FileDetail {
  id: string;
  fileName: string;
  filePath: string;
  fileType: string;
  extension: string;
  sizeBytes: number;
  rawContent: string;
  parseStatus: string;
  parsedData: {
    importCount: number;
    exportCount: number;
    functionCount: number;
    componentCount: number;
    functions: FunctionDef[];
  } | null;
  imports: LinkedFile[];
  importedBy: LinkedFile[];
  explanation: string | null;
}

interface FileDetailPanelProps {
  fileId: string;
  onClose: () => void;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatBytes(b: number) {
  if (b < 1024) return `${b} B`;
  if (b < 1024 ** 2) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / 1024 ** 2).toFixed(1)} MB`;
}

function getLanguage(ext: string) {
  if (["ts", "tsx"].includes(ext)) return "typescript";
  return "javascript";
}

function SectionHeader({ title, count }: { title: string; count?: number }) {
  return (
    <div className="flex items-center gap-2 px-4 py-2 border-b border-[#1a1a1a]">
      <span className="text-xs font-medium text-[#a1a1aa]">{title}</span>
      {count !== undefined && (
        <span className="text-[10px] bg-[#1a1a1a] text-[#71717a] rounded px-1.5 py-0.5">
          {count}
        </span>
      )}
    </div>
  );
}

// ── Component ────────────────────────────────────────────────────────────────

export default function FileDetailPanel({ fileId, onClose }: FileDetailPanelProps) {
  const [file, setFile] = useState<FileDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [explanation, setExplanation] = useState<string | null>(null);
  const [loadingExpl, setLoadingExpl] = useState(false);
  const [codeOpen, setCodeOpen] = useState(false);

  useEffect(() => {
    setFile(null);
    setLoading(true);
    setExplanation(null);
    setCodeOpen(false);

    fetch(`/api/files/${fileId}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.success) {
          setFile(data.file);
          if (data.file.explanation) setExplanation(data.file.explanation);
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [fileId]);

  async function handleExplain() {
    setLoadingExpl(true);
    try {
      const res = await fetch(`/api/files/${fileId}/explain`, { method: "POST" });
      const data = await res.json();
      if (data.success) setExplanation(data.explanation);
    } catch {}
    setLoadingExpl(false);
  }

  if (loading) {
    return (
      <div className="flex flex-col h-full bg-[#0f0f0f] border-l border-[#222222]">
        <div className="flex items-center justify-between px-4 py-3 border-b border-[#222222]">
          <div className="h-4 w-32 rounded bg-[#1a1a1a] animate-pulse" />
          <button onClick={onClose}><X size={16} className="text-[#52525b]" /></button>
        </div>
        <div className="flex flex-col gap-3 p-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-3 rounded bg-[#1a1a1a] animate-pulse" style={{ width: `${40 + i * 10}%` }} />
          ))}
        </div>
      </div>
    );
  }

  if (!file) {
    return (
      <div className="flex flex-col h-full bg-[#0f0f0f] border-l border-[#222222] items-center justify-center gap-3">
        <AlertCircle size={20} className="text-red-400" />
        <p className="text-sm text-[#71717a]">Failed to load file</p>
      </div>
    );
  }

  const typeColor = FILE_TYPE_COLORS[file.fileType] ?? FILE_TYPE_COLORS.UNKNOWN;

  return (
    <div className="flex flex-col h-full bg-[#0f0f0f] border-l border-[#222222] overflow-hidden">
      {/* Header */}
      <div className="flex items-start justify-between px-4 py-3 border-b border-[#222222] shrink-0">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-white truncate">{file.fileName}</p>
          <span
            className="text-[10px] font-medium rounded px-1.5 py-0.5 mt-1 inline-block"
            style={{ color: typeColor, background: `${typeColor}18` }}
          >
            {file.fileType}
          </span>
        </div>
        <button
          onClick={onClose}
          className="text-[#52525b] hover:text-white transition-colors shrink-0 ml-2 mt-0.5"
        >
          <X size={15} />
        </button>
      </div>

      {/* Scrollable body */}
      <div className="flex-1 overflow-y-auto">

        {/* Section 1: File Info */}
        <SectionHeader title="Info" />
        <div className="px-4 py-3 space-y-1.5">
          <InfoRow label="Path" value={file.filePath} mono />
          <InfoRow label="Size" value={formatBytes(file.sizeBytes)} />
          <InfoRow label="Functions" value={String(file.parsedData?.functionCount ?? 0)} />
          <InfoRow label="Imports" value={String(file.parsedData?.importCount ?? 0)} />
        </div>

        {/* Section 2: Imported By */}
        <SectionHeader title="Imported by" count={file.importedBy.length} />
        <div className="px-3 py-2">
          {file.importedBy.length === 0 ? (
            <p className="text-xs text-[#52525b] px-1">No files import this</p>
          ) : (
            file.importedBy.map((f) => <FileLink key={f.id} file={f} />)
          )}
        </div>

        {/* Section 3: Imports */}
        <SectionHeader title="Imports" count={file.imports.length} />
        <div className="px-3 py-2">
          {file.imports.length === 0 ? (
            <p className="text-xs text-[#52525b] px-1">No internal imports</p>
          ) : (
            file.imports.map((f) => <FileLink key={f.id} file={f} />)
          )}
        </div>

        {/* Section 4: Functions */}
        {(file.parsedData?.functions?.length ?? 0) > 0 && (
          <>
            <SectionHeader title="Functions" count={file.parsedData!.functions.length} />
            <div className="px-3 py-2 space-y-1">
              {file.parsedData!.functions.map((fn, i) => (
                <div key={i} className="flex items-center gap-1.5 px-1">
                  <FunctionSquare size={11} className="text-[#52525b] shrink-0" />
                  <span className="text-xs text-[#d4d4d8] font-mono">{fn.name}</span>
                  <div className="flex gap-1 ml-auto shrink-0">
                    {fn.isAsync && <Tag label="async" color="#f59e0b" />}
                    {fn.isExported && <Tag label="export" color="#10b981" />}
                    {fn.isComponent && <Tag label="jsx" color="#6366f1" />}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {/* Section 5: AI Explanation */}
        <SectionHeader title="AI Explanation" />
        <div className="px-4 py-3">
          {explanation ? (
            <p className="text-xs text-[#a1a1aa] leading-relaxed">{explanation}</p>
          ) : (
            <button
              onClick={handleExplain}
              disabled={loadingExpl}
              className="flex items-center gap-2 text-xs bg-indigo-600 hover:bg-indigo-500
                disabled:opacity-50 text-white rounded-lg px-3 py-2 transition-colors"
            >
              {loadingExpl ? (
                <><Loader2 size={13} className="animate-spin" /> Analyzing...</>
              ) : (
                <><Sparkles size={13} /> Explain this file</>
              )}
            </button>
          )}
        </div>

        {/* Section 6: Source Code (collapsible) */}
        <div className="border-t border-[#1a1a1a]">
          <button
            onClick={() => setCodeOpen((v) => !v)}
            className="w-full flex items-center justify-between px-4 py-2
              hover:bg-[#161616] transition-colors"
          >
            <span className="text-xs font-medium text-[#a1a1aa]">Source Code</span>
            {codeOpen ? (
              <ChevronDown size={13} className="text-[#52525b]" />
            ) : (
              <ChevronRight size={13} className="text-[#52525b]" />
            )}
          </button>

          {codeOpen && (
            <div className="max-h-96 overflow-auto">
              <SyntaxHighlighter
                language={getLanguage(file.extension)}
                style={atomOneDark}
                customStyle={{
                  margin: 0,
                  padding: "12px 16px",
                  fontSize: 11,
                  background: "#0a0a0a",
                  lineHeight: 1.6,
                }}
                showLineNumbers
                lineNumberStyle={{ color: "#3f3f46", minWidth: "2em" }}
              >
                {file.rawContent}
              </SyntaxHighlighter>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function InfoRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-start gap-2">
      <span className="text-[10px] text-[#52525b] w-16 shrink-0 pt-0.5">{label}</span>
      <span className={`text-xs text-[#a1a1aa] break-all leading-relaxed ${mono ? "font-mono text-[10px]" : ""}`}>
        {value}
      </span>
    </div>
  );
}

function FileLink({ file }: { file: LinkedFile }) {
  const color = FILE_TYPE_COLORS[file.fileType] ?? FILE_TYPE_COLORS.UNKNOWN;
  return (
    <div className="flex items-center gap-2 px-1 py-1 rounded hover:bg-[#161616] transition-colors">
      <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: color }} />
      <span className="text-xs text-[#a1a1aa] truncate">{file.fileName}</span>
    </div>
  );
}

function Tag({ label, color }: { label: string; color: string }) {
  return (
    <span
      className="text-[9px] rounded px-1 font-medium"
      style={{ color, background: `${color}18` }}
    >
      {label}
    </span>
  );
}
