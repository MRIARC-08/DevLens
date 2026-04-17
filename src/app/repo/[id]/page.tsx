"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  FolderOpen, GitBranch, Play, Puzzle, Bot,
  HelpCircle, Settings, Plus, AlertCircle,
  ChevronRight, ExternalLink,
} from "lucide-react";

import ProcessingStatus from "@/components/repo/ProcessingStatus";
import FileTree from "@/components/sidebar/FileTree";
import DependencyGraph from "@/components/graph/DependencyGraph";
import FileDetailPanel from "@/components/detail/FileDetailPanel";

// ── Types ─────────────────────────────────────────────────────────────────────

type RepoStatus = "PENDING" | "CLONING" | "READING" | "PARSING" | "GRAPHING" | "READY" | "FAILED";
type NavItem = "explorer" | "ai";

interface Progress { totalFiles: number; parsedFiles: number; failedFiles: number; percentage: number; }
interface RepoStats { totalFiles: number; totalComponents: number; totalFunctions: number; totalEdges: number; }
interface RepoInfo { owner: string; name: string; fullName: string; url: string; }

const TERMINAL: RepoStatus[] = ["READY", "FAILED"];

// ── Sidebar nav config ────────────────────────────────────────────────────────

const NAV_TOP = [
  { id: "explorer" as NavItem, icon: FolderOpen, label: "File Explorer" },
  { id: null, icon: GitBranch, label: "Source Control" },
  { id: null, icon: Play, label: "Run & Debug" },
  { id: null, icon: Puzzle, label: "Extensions" },
  { id: "ai" as NavItem, icon: Bot, label: "AI Assistant" },
];

// ── Page ──────────────────────────────────────────────────────────────────────

export default function RepoPage() {
  const { id: repoId } = useParams<{ id: string }>();
  const router = useRouter();

  const [status, setStatus] = useState<RepoStatus | null>(null);
  const [progress, setProgress] = useState<Progress | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [repoStats, setRepoStats] = useState<RepoStats | null>(null);
  const [repoInfo, setRepoInfo] = useState<RepoInfo | null>(null);
  const [selectedFileId, setSelectedFileId] = useState<string | null>(null);
  const [activeNav, setActiveNav] = useState<NavItem>("explorer");

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!repoId) return;
    const poll = async () => {
      try {
        const res = await fetch(`/api/repos/${repoId}/status`);
        const data = await res.json();
        if (!data.success) return;
        setStatus(data.status);
        setProgress(data.progress ?? null);
        if (data.status === "READY") {
          setRepoStats(data.stats);
          try {
            const recent = JSON.parse(localStorage.getItem("devlens_recent") ?? "[]");
            const found = recent.find((r: { repoId: string }) => r.repoId === repoId);
            if (found) {
              const [owner, name] = found.fullName.split("/");
              setRepoInfo({ owner, name, fullName: found.fullName, url: found.url });
            }
          } catch {}
        }
        if (data.status === "FAILED") setErrorMessage(data.error ?? "Analysis failed");
        if (TERMINAL.includes(data.status)) {
          if (intervalRef.current) clearInterval(intervalRef.current);
        }
      } catch {}
    };
    poll();
    intervalRef.current = setInterval(poll, 2000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [repoId]);

  const handleNodeClick = useCallback((id: string) => setSelectedFileId(id), []);
  const handleFileSelect = useCallback((id: string) => { setSelectedFileId(id); setActiveNav("explorer"); }, []);

  // ── Processing ───────────────────────────────────────────────────────────────

  if (!status || !TERMINAL.includes(status)) {
    return (
      <div style={{ background: "#0a0a0f", minHeight: "100vh" }}>
        <ProcessingStatus
          status={status ?? "PENDING"}
          progress={progress}
          repoName={repoInfo?.fullName}
        />
      </div>
    );
  }

  // ── Error ────────────────────────────────────────────────────────────────────

  if (status === "FAILED") {
    return (
      <div style={{
        background: "#0a0a0f", minHeight: "100vh",
        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16,
      }}>
        <div style={{ padding: 20, borderRadius: "50%", background: "rgba(248,113,113,0.1)", border: "1px solid rgba(248,113,113,0.2)" }}>
          <AlertCircle size={40} color="#f87171" />
        </div>
        <h2 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: "#fff" }}>Analysis Failed</h2>
        <p style={{ margin: 0, fontSize: 14, color: "#6b6b80", maxWidth: 400, textAlign: "center" }}>{errorMessage}</p>
        <button
          onClick={() => router.push("/")}
          style={{
            marginTop: 8, background: "#13131e", border: "1px solid #1e1e2e",
            color: "#e2e2e8", borderRadius: 8, padding: "10px 20px",
            fontSize: 14, cursor: "pointer", display: "flex", alignItems: "center", gap: 8,
          }}
        >
          ← Back to Home
        </button>
      </div>
    );
  }

  // ── Ready — full IDE layout ──────────────────────────────────────────────────

  return (
    <div style={{ display: "flex", height: "100vh", overflow: "hidden", background: "#0a0a0f" }}>
      {/* ── Left sidebar ── */}
      <div style={{
        width: 220, flexShrink: 0, background: "#0d0d14",
        borderRight: "1px solid #1a1a2a",
        display: "flex", flexDirection: "column",
        overflow: "hidden",
      }}>
        {/* Brand header */}
        <div style={{
          padding: "14px 16px", borderBottom: "1px solid #1a1a2a",
          display: "flex", alignItems: "center", gap: 10,
        }}>
          <div style={{
            width: 32, height: 32, borderRadius: 8,
            background: "linear-gradient(135deg, #7c6bf0, #a855f7)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 13, fontWeight: 800, color: "#fff", flexShrink: 0,
          }}>D</div>
          <div>
            <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: "#fff" }}>Developer Suite</p>
            <p style={{ margin: 0, fontSize: 11, color: "#4a4a5a" }}>v1.0.0</p>
          </div>
        </div>

        {/* New Analysis button */}
        <div style={{ padding: "12px 12px 8px" }}>
          <button
            onClick={() => router.push("/")}
            style={{
              width: "100%", display: "flex", alignItems: "center", gap: 8,
              background: "linear-gradient(135deg, #7c6bf0, #6d5be8)",
              border: "none", borderRadius: 8, padding: "9px 14px",
              color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer",
            }}
          >
            <Plus size={15} />
            New Analysis
          </button>
        </div>

        {/* Nav items */}
        <nav style={{ flex: 1, padding: "4px 8px", overflow: "hidden" }}>
          {NAV_TOP.map((item, i) => {
            const isActive = item.id && activeNav === item.id;
            const isClickable = item.id !== null;

            return (
              <button
                key={i}
                onClick={() => item.id && setActiveNav(item.id)}
                style={{
                  width: "100%", display: "flex", alignItems: "center", gap: 10,
                  padding: "9px 10px", borderRadius: 8, border: "none",
                  background: isActive ? "rgba(124,107,240,0.15)" : "none",
                  color: isActive ? "#a89cf7" : isClickable ? "#7a7a8e" : "#3a3a5a",
                  fontSize: 13, fontWeight: isActive ? 600 : 400,
                  cursor: isClickable ? "pointer" : "default",
                  textAlign: "left", marginBottom: 2,
                  transition: "all 0.15s",
                  borderLeft: isActive ? "2px solid #7c6bf0" : "2px solid transparent",
                }}
                onMouseEnter={e => { if (isClickable && !isActive) { (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.04)"; (e.currentTarget as HTMLElement).style.color = "#a1a1b0"; } }}
                onMouseLeave={e => { if (isClickable && !isActive) { (e.currentTarget as HTMLElement).style.background = "none"; (e.currentTarget as HTMLElement).style.color = "#7a7a8e"; } }}
              >
                <item.icon size={16} />
                {item.label}
              </button>
            );
          })}
        </nav>

        {/* Repo info strip */}
        {repoInfo && (
          <div style={{ padding: "8px 12px", borderTop: "1px solid #1a1a2a" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <p style={{ margin: 0, fontSize: 11, color: "#4a4a5a", truncate: "true" as never } as React.CSSProperties}>
                {repoInfo.fullName}
              </p>
              <a href={repoInfo.url} target="_blank" rel="noopener noreferrer">
                <ExternalLink size={11} color="#3a3a5a" />
              </a>
            </div>
          </div>
        )}

        {/* Bottom nav */}
        <div style={{ padding: "8px 8px 12px", borderTop: "1px solid #1a1a2a", display: "flex", flexDirection: "column", gap: 2 }}>
          {[{ icon: HelpCircle, label: "Help" }, { icon: Settings, label: "Settings" }].map((item) => (
            <button
              key={item.label}
              style={{
                width: "100%", display: "flex", alignItems: "center", gap: 10,
                padding: "8px 10px", borderRadius: 8, border: "none",
                background: "none", color: "#4a4a5a", fontSize: 13, cursor: "pointer",
                transition: "all 0.15s",
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = "#a1a1b0"; (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.04)"; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = "#4a4a5a"; (e.currentTarget as HTMLElement).style.background = "none"; }}
            >
              <item.icon size={15} />
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Main content area ── */}
      <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
        {activeNav === "explorer" && (
          <>
            {/* File tree sub-panel */}
            <div style={{ width: 240, flexShrink: 0, borderRight: "1px solid #1a1a2a", overflow: "hidden" }}>
              <div style={{ padding: "12px 16px", borderBottom: "1px solid #1a1a2a" }}>
                <p style={{ margin: 0, fontSize: 11, fontWeight: 600, color: "#4a4a5a", textTransform: "uppercase", letterSpacing: "0.08em" }}>
                  File Explorer
                </p>
              </div>
              <div style={{ height: "calc(100% - 41px)", overflow: "auto" }}>
                <FileTree
                  repoId={repoId}
                  selectedFileId={selectedFileId}
                  onFileSelect={handleFileSelect}
                />
              </div>
            </div>

            {/* Graph */}
            <div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column" }}>
              {/* Top bar */}
              <div style={{
                height: 42, display: "flex", alignItems: "center", justifyContent: "space-between",
                padding: "0 16px", borderBottom: "1px solid #1a1a2a", background: "#0d0d14", flexShrink: 0,
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <GitBranch size={14} color="#7c6bf0" />
                  <span style={{ fontSize: 13, color: "#a1a1b0", fontWeight: 500 }}>Dependency Graph</span>
                  {repoInfo && <span style={{ fontSize: 12, color: "#3a3a5a" }}>· {repoInfo.fullName}</span>}
                </div>
                {repoStats && (
                  <div style={{ display: "flex", gap: 16 }}>
                    {[
                      { label: "files", value: repoStats.totalFiles },
                      { label: "functions", value: repoStats.totalFunctions },
                      { label: "edges", value: repoStats.totalEdges },
                    ].map(s => (
                      <span key={s.label} style={{ fontSize: 12, color: "#4a4a5a" }}>
                        <span style={{ color: "#a1a1b0", fontWeight: 600 }}>{s.value}</span> {s.label}
                      </span>
                    ))}
                  </div>
                )}
              </div>
              <DependencyGraph
                repoId={repoId}
                selectedFileId={selectedFileId}
                onNodeClick={handleNodeClick}
              />
            </div>

            {/* Detail panel */}
            {selectedFileId && (
              <div style={{ width: 320, flexShrink: 0, borderLeft: "1px solid #1a1a2a", overflow: "hidden" }}>
                <FileDetailPanel fileId={selectedFileId} onClose={() => setSelectedFileId(null)} />
              </div>
            )}
          </>
        )}

        {activeNav === "ai" && (
          <ChatPlaceholder repoId={repoId} repoName={repoInfo?.fullName} />
        )}
      </div>
    </div>
  );
}

// ── Chat placeholder (Phase 5 drop-in) ───────────────────────────────────────

function ChatPlaceholder({ repoId, repoName }: { repoId: string; repoName?: string }) {
  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", background: "#0a0a0f" }}>
      {/* Header */}
      <div style={{
        padding: "16px 24px", borderBottom: "1px solid #1a1a2a", background: "#0d0d14",
        display: "flex", alignItems: "flex-start", justifyContent: "space-between",
      }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: "#fff" }}>Chat with this codebase</h2>
          <p style={{ margin: "4px 0 0", fontSize: 13, color: "#4a4a5a" }}>
            Ask anything about {repoName ?? repoId}
          </p>
        </div>
      </div>

      {/* Coming soon body */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12 }}>
        <div style={{ padding: 20, borderRadius: "50%", background: "rgba(124,107,240,0.08)", border: "1px solid rgba(124,107,240,0.15)" }}>
          <Bot size={36} color="#7c6bf0" />
        </div>
        <p style={{ margin: 0, fontSize: 16, fontWeight: 600, color: "#e2e2e8" }}>AI Assistant</p>
        <p style={{ margin: 0, fontSize: 14, color: "#4a4a5a", maxWidth: 300, textAlign: "center" }}>
          Interactive chat with your codebase coming in Phase 5.
        </p>
        <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
          {["How does routing work?", "Explain the entry point"].map((q) => (
            <div key={q} style={{
              fontSize: 12, color: "#6b6b80", background: "#13131e",
              border: "1px solid #1e1e2e", borderRadius: 20, padding: "6px 14px",
            }}>{q}</div>
          ))}
        </div>
      </div>

      {/* Input bar (visual only) */}
      <div style={{ padding: 16, borderTop: "1px solid #1a1a2a" }}>
        <div style={{
          display: "flex", alignItems: "center", gap: 12,
          background: "#13131e", border: "1px solid #1e1e2e",
          borderRadius: 12, padding: "10px 16px",
        }}>
          <Plus size={16} color="#4a4a5a" />
          <span style={{ flex: 1, fontSize: 14, color: "#2e2e4e" }}>Ask anything about the codebase...</span>
          <div style={{
            width: 32, height: 32, borderRadius: 8,
            background: "linear-gradient(135deg, #7c6bf0, #6d5be8)",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <ChevronRight size={16} color="#fff" />
          </div>
        </div>
        <p style={{ margin: "8px 0 0", fontSize: 11, color: "#2e2e4e", textAlign: "center" }}>
          DevLens may produce inaccurate information about codebases. Verify important details.
        </p>
      </div>
    </div>
  );
}
