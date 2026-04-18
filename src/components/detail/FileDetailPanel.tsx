"use client";

import { useEffect, useState } from "react";
import {
  X, Loader2, Sparkles, ChevronDown, ChevronRight,
  ArrowDownToLine, ArrowUpFromLine, FunctionSquare,
  AlertCircle, FileCode,
} from "lucide-react";
import { Light as SyntaxHighlighter } from "react-syntax-highlighter";
import js from "react-syntax-highlighter/dist/esm/languages/hljs/javascript";
import ts from "react-syntax-highlighter/dist/esm/languages/hljs/typescript";
import { atomOneDark } from "react-syntax-highlighter/dist/esm/styles/hljs";
import { FILE_TYPE_COLORS } from "@/components/graph/FileNode";

SyntaxHighlighter.registerLanguage("javascript", js);
SyntaxHighlighter.registerLanguage("typescript", ts);

// ── Types ─────────────────────────────────────────────────────────────────────

interface LinkedFile {
  id: string; fileName: string; filePath: string;
  fileType: string; importRaw: string; specifiers?: string[];
}
interface FunctionDef {
  name: string; isAsync: boolean; isExported: boolean;
  isComponent: boolean; lineStart: number;
}
interface FileDetail {
  id: string; fileName: string; filePath: string;
  fileType: string; extension: string; sizeBytes: number;
  rawContent: string; parseStatus: string;
  parsedData: {
    importCount: number; exportCount: number;
    functionCount: number; componentCount: number;
    functions: FunctionDef[];
  } | null;
  imports: LinkedFile[];
  importedBy: LinkedFile[];
  explanation: string | null;
}
interface FileDetailPanelProps { fileId: string; onClose: () => void; activeTab?: "insights" | "code"; onFileSelect?: (id: string) => void; }

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatBytes(b: number) {
  if (b < 1024) return `${b} B`;
  if (b < 1024 ** 2) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / 1024 ** 2).toFixed(1)} MB`;
}
function getLang(ext: string) {
  return ["ts", "tsx"].includes(ext) ? "typescript" : "javascript";
}

// ── Sub-components ────────────────────────────────────────────────────────────

function SectionLabel({ label, count }: { label: string; count?: number }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", justifyContent: "space-between",
      padding: "10px 14px 5px",
    }}>
      <span style={{ fontSize: 11, fontWeight: 600, color: "#7a7a7a", textTransform: "uppercase", letterSpacing: "0.08em" }}>
        {label}
      </span>
      {count !== undefined && (
        <span style={{
          fontSize: 11, color: "#909090",
          background: "#4a4a4a", borderRadius: 4,
          padding: "1px 6px", fontWeight: 500,
        }}>
          {count}
        </span>
      )}
    </div>
  );
}

function CollapsibleSection({ label, count, initiallyOpen = true, children }: { label: string; count?: number; initiallyOpen?: boolean; children: React.ReactNode }) {
  const [open, setOpen] = useState(initiallyOpen);
  return (
    <div>
      <div 
        onClick={() => setOpen(!open)}
        style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "10px 14px 5px", cursor: "pointer", userSelect: "none"
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          {open ? <ChevronDown size={14} color="#666" /> : <ChevronRight size={14} color="#666" />}
          <span style={{ fontSize: 11, fontWeight: 600, color: "#7a7a7a", textTransform: "uppercase", letterSpacing: "0.08em" }}>
            {label}
          </span>
        </div>
        {count !== undefined && (
          <span style={{
            fontSize: 11, color: "#909090",
            background: "#4a4a4a", borderRadius: 4,
            padding: "1px 6px", fontWeight: 500,
          }}>
            {count}
          </span>
        )}
      </div>
      {open && children}
    </div>
  );
}

function Divider() {
  return <div style={{ height: 1, background: "#4a4a4a", margin: "4px 0" }} />;
}

function InfoRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div style={{ display: "flex", gap: 10, padding: "2px 0" }}>
      <span style={{ fontSize: 12, color: "#7a7a7a", width: 64, flexShrink: 0, paddingTop: 1 }}>{label}</span>
      <span style={{
        fontSize: mono ? 10 : 11,
        color: "#a0a0a0",
        fontFamily: mono ? "monospace" : "inherit",
        wordBreak: "break-all", lineHeight: 1.5,
      }}>
        {value}
      </span>
    </div>
  );
}

function FileLink({ file, onSelect }: { file: LinkedFile; onSelect?: (id: string) => void }) {
  const color = FILE_TYPE_COLORS[file.fileType] ?? FILE_TYPE_COLORS.UNKNOWN;
  return (
    <div
      onClick={() => onSelect?.(file.id)}
      style={{
        display: "flex", alignItems: "center", gap: 8,
        padding: "5px 14px", cursor: onSelect ? "pointer" : "default",
        transition: "all 120ms ease", borderRadius: 0,
      }}
      onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = "#303030"}
      onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = "none"}
    >
      <div style={{ width: 6, height: 6, borderRadius: "50%", background: color, flexShrink: 0 }} />
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 13, color: "#cccccc", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {file.fileName}
        </div>
        <div style={{ fontSize: 11, color: "#7a7a7a", fontFamily: "var(--font-mono, 'JetBrains Mono', monospace)", marginTop: 1, overflow: "hidden", textOverflow: "ellipsis" }}>
          {file.importRaw}
        </div>
      </div>
    </div>
  );
}

function FnTag({ label, color }: { label: string; color: string }) {
  return (
    <span style={{
      fontSize: 10, fontWeight: 500, padding: "1px 5px",
      borderRadius: 3, color, background: `${color}18`,
    }}>
      {label}
    </span>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function FileDetailPanel({ fileId, onClose, activeTab = "insights", onFileSelect }: FileDetailPanelProps) {
  const [file, setFile]           = useState<FileDetail | null>(null);
  const [loading, setLoading]     = useState(true);
  const [explanation, setExpl]    = useState<string | null>(null);
  const [loadingExpl, setLoadingExpl] = useState(false);

  const [selectedText, setSelectedText] = useState("");
  const [popupPos, setPopupPos] = useState({ x: 0, y: 0 });

  useEffect(() => {
    setFile(null); setLoading(true); setExpl(null);
    fetch(`/api/files/${fileId}`)
      .then(r => r.json())
      .then(data => {
        if (data.success) {
          setFile(data.file);
          if (data.file.explanation) setExpl(data.file.explanation);
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [fileId]);

  async function handleExplain() {
    setLoadingExpl(true);
    try {
      const res  = await fetch(`/api/files/${fileId}/explain`, { method: "POST" });
      const data = await res.json();
      if (data.success) setExpl(data.explanation);
    } catch {}
    setLoadingExpl(false);
  }

  const handleMouseUp = (e: React.MouseEvent) => {
    if (activeTab !== "code") return;
    const selection = window.getSelection();
    const text = selection?.toString().trim();
    if (text) {
      // Calculate position relative to viewport
      const range = selection?.getRangeAt(0);
      const rect = range?.getBoundingClientRect();
      if (rect) {
        setPopupPos({ x: e.clientX, y: rect.top - 40 });
        setSelectedText(text);
      }
    } else {
      setSelectedText("");
    }
  };

  // ── Loading ─────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div style={{ display: "flex", flexDirection: "column", height: "100%", background: "#252525" }}>
        <div style={{
          height: 40, display: "flex", alignItems: "center",
          justifyContent: "space-between", padding: "0 14px",
          borderBottom: "1px solid #4a4a4a", flexShrink: 0,
        }}>
          <div style={{ height: 10, width: 120, borderRadius: 4 }} className="shimmer" />
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "#7a7a7a", display: "flex" }}>
            <X size={15} />
          </button>
        </div>
        <div style={{ padding: "14px", display: "flex", flexDirection: "column", gap: 8 }}>
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="shimmer" style={{ height: 10, borderRadius: 4, width: `${35 + i * 8}%` }} />
          ))}
        </div>
      </div>
    );
  }

  if (!file) {
    return (
      <div style={{
        display: "flex", flexDirection: "column", height: "100%",
        background: "#252525", alignItems: "center", justifyContent: "center", gap: 10,
      }}>
        <AlertCircle size={18} color="#ef4444" />
        <p style={{ margin: 0, fontSize: 13, color: "#909090" }}>Failed to load file</p>
      </div>
    );
  }

  const typeColor = FILE_TYPE_COLORS[file.fileType] ?? FILE_TYPE_COLORS.UNKNOWN;

  return (
    <div style={{
      display: "flex", flexDirection: "column",
      height: "100%", background: "#252525", overflow: "hidden",
    }}>
      {/* ── Header ── */}
      <div style={{
        height: 40, display: "flex", alignItems: "center",
        justifyContent: "space-between", padding: "0 14px",
        borderBottom: "1px solid #4a4a4a", flexShrink: 0, gap: 10,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
          <FileCode size={13} color={typeColor} />
          <span style={{
            fontSize: 13, fontWeight: 600, color: "#ffffff",
            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
          }}>
            {file.fileName}
          </span>
          <span style={{
            fontSize: 10, fontWeight: 500,
            padding: "2px 6px", borderRadius: 4,
            background: `${typeColor}18`, color: typeColor,
            textTransform: "uppercase", letterSpacing: "0.05em",
            flexShrink: 0,
          }}>
            {file.fileType.toLowerCase()}
          </span>
        </div>
        <button
          onClick={onClose}
          style={{
            background: "none", border: "none", cursor: "pointer",
            color: "#7a7a7a", display: "flex", flexShrink: 0,
            transition: "color 120ms ease",
          }}
          onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = "#888888"}
          onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = "#444444"}
        >
          <X size={14} />
        </button>
      </div>

      {/* ── Body ── */}
      <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column" }}>

        {activeTab === "insights" && (
          <>
            {/* Info */}
            <SectionLabel label="Info" />
            <div style={{ padding: "0 14px 10px" }}>
              <InfoRow label="Path" value={file.filePath} mono />
              <InfoRow label="Size" value={formatBytes(file.sizeBytes)} />
              <InfoRow label="Functions" value={String(file.parsedData?.functionCount ?? 0)} />
              <InfoRow label="Imports" value={String(file.parsedData?.importCount ?? 0)} />
              <InfoRow label="Exports" value={String(file.parsedData?.exportCount ?? 0)} />
            </div>

            {/* Quick stats row */}
            <div style={{
              display: "grid", gridTemplateColumns: "1fr 1fr 1fr",
              gap: 1, margin: "0 14px 12px",
              background: "#4a4a4a", borderRadius: 6, overflow: "hidden",
            }}>
              {[
                { icon: ArrowDownToLine, label: "Imports", value: file.importedBy.length },
                { icon: ArrowUpFromLine, label: "Uses",    value: file.imports.length },
                { icon: FunctionSquare, label: "Fns",     value: file.parsedData?.functionCount ?? 0 },
              ].map(stat => (
                <div key={stat.label} style={{
                  display: "flex", flexDirection: "column", alignItems: "center",
                  padding: "8px 4px", background: "#303030", gap: 3,
                }}>
                  <stat.icon size={11} color="#444444" />
                  <span style={{ fontSize: 14, fontWeight: 600, color: "#ffffff" }}>{stat.value}</span>
                  <span style={{ fontSize: 10, color: "#7a7a7a", textTransform: "uppercase", letterSpacing: "0.05em" }}>{stat.label}</span>
                </div>
              ))}
            </div>

            <Divider />

            {/* Imported by */}
            <CollapsibleSection label="Imported by" count={file.importedBy.length}>
              {file.importedBy.length === 0
                ? <p style={{ fontSize: 12, color: "#7a7a7a", padding: "2px 14px 10px", margin: 0 }}>Nothing imports this file</p>
                : file.importedBy.map(f => <FileLink key={f.id} file={f} onSelect={onFileSelect} />)
              }
            </CollapsibleSection>

            <Divider />

            {/* Imports */}
            <CollapsibleSection label="Imports" count={file.imports.length}>
              {file.imports.length === 0
                ? <p style={{ fontSize: 12, color: "#7a7a7a", padding: "2px 14px 10px", margin: 0 }}>No internal imports</p>
                : file.imports.map(f => <FileLink key={f.id} file={f} onSelect={onFileSelect} />)
              }
            </CollapsibleSection>

            {/* Functions */}
            {(file.parsedData?.functions?.length ?? 0) > 0 && (
              <>
                <Divider />
                <CollapsibleSection label="Functions" count={file.parsedData!.functions.length}>
                  <div style={{ padding: "2px 14px 10px", display: "flex", flexDirection: "column", gap: 3 }}>
                    {file.parsedData!.functions.map((fn, i) => (
                      <div key={i} style={{ display: "flex", alignItems: "center", gap: 6, padding: "3px 0" }}>
                        <FunctionSquare size={10} color="#444444" style={{ flexShrink: 0 }} />
                        <span style={{ fontSize: 12, color: "#cccccc", fontFamily: "var(--font-mono, 'JetBrains Mono', monospace)", flex: 1 }}>{fn.name}</span>
                        <div style={{ display: "flex", gap: 3, flexShrink: 0 }}>
                          {fn.isAsync    && <FnTag label="async"  color="#f59e0b" />}
                          {fn.isExported && <FnTag label="export" color="#10b981" />}
                          {fn.isComponent && <FnTag label="jsx"   color="#ff4500" />}
                        </div>
                      </div>
                    ))}
                  </div>
                </CollapsibleSection>
              </>
            )}

            <Divider />

            {/* AI Explanation */}
            <SectionLabel label="AI Explanation" />
            <div style={{ padding: "2px 14px 12px" }}>
              {explanation ? (
                <p style={{ margin: 0, fontSize: 13, color: "#a0a0a0", lineHeight: 1.65 }}>{explanation}</p>
              ) : (
                <button
                  onClick={handleExplain}
                  disabled={loadingExpl}
                  style={{
                    display: "flex", alignItems: "center", gap: 7,
                    background: "rgba(255,69,0,0.1)",
                    border: "1px solid rgba(255,69,0,0.2)",
                    borderRadius: 6, padding: "7px 12px",
                    color: "#ff6534", fontSize: 13, fontWeight: 500,
                    cursor: "pointer", transition: "all 150ms ease",
                    opacity: loadingExpl ? 0.6 : 1,
                  }}
                  onMouseEnter={e => {
                    if (!loadingExpl) (e.currentTarget as HTMLElement).style.background = "rgba(255,69,0,0.15)";
                  }}
                  onMouseLeave={e => {
                    (e.currentTarget as HTMLElement).style.background = "rgba(255,69,0,0.1)";
                  }}
                >
                  {loadingExpl
                    ? <><Loader2 size={12} className="animate-spin" /> Analyzing...</>
                    : <><Sparkles size={12} /> Explain this file</>
                  }
                </button>
              )}
            </div>
            <div style={{ height: 20 }} />
          </>
        )}

        {activeTab === "code" && (
          <div onMouseUp={handleMouseUp} style={{ flex: 1, overflow: "auto", display: "flex", flexDirection: "column" }}>
            {selectedText && (
              <div style={{
                position: "fixed", top: popupPos.y, left: popupPos.x, transform: "translateX(-50%)",
                background: "#303030", border: "1px solid #4a4a4a", borderRadius: 6,
                padding: "4px 6px", display: "flex", gap: 4, boxShadow: "0 4px 16px rgba(0,0,0,0.6)", zIndex: 1000,
              }}>
                <button 
                  onClick={() => {
                    const msg = `Explain this snippet from \`${file.fileName}\`:\n\n\`\`\`${getLang(file.extension)}\n${selectedText}\n\`\`\`\n\n`;
                    window.dispatchEvent(new CustomEvent("DEV_LENS_CHAT_PREFILL", { detail: { message: msg } }));
                    setSelectedText("");
                  }}
                  style={{ 
                    background: "none", color: "#ccc", border: "none", borderRadius: 4, 
                    padding: "4px 8px", fontSize: 11, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 
                  }}
                  onMouseEnter={e => (e.currentTarget.style.background = "#4a4a4a")}
                  onMouseLeave={e => (e.currentTarget.style.background = "none")}
                >
                  <Sparkles size={11} color="#ff4500" /> Explain Selection
                </button>
              </div>
            )}
            <SyntaxHighlighter
              language={getLang(file.extension)}
              style={atomOneDark}
              customStyle={{ margin: 0, padding: "12px 14px", fontSize: 12, background: "#252525", lineHeight: 1.6, flex: 1 }}
              showLineNumbers
              lineNumberStyle={{ color: "#2a3040", minWidth: "2em" }}
            >
              {file.rawContent}
            </SyntaxHighlighter>
          </div>
        )}
      </div>
    </div>
  );
}
