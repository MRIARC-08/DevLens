"use client";

import {
  useEffect, useRef, useState, useCallback,
  type MouseEvent as ReactMouseEvent,
} from "react";
import { useParams, useRouter } from "next/navigation";
import {
  Network, FolderTree, Bot, Settings, HelpCircle,
  Plus, AlertCircle, ExternalLink, GitBranch,
  ChevronRight, Layers, Send, Sparkles, Loader2,
  Code2, ArrowLeft, RefreshCw, X, ChevronLeft, Sidebar as SidebarIcon,
  ChevronsLeft, ChevronsRight, Layout, ChevronUp,
} from "lucide-react";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { vscDarkPlus } from "react-syntax-highlighter/dist/esm/styles/prism";

import ProcessingStatus from "@/components/repo/ProcessingStatus";
import FileTree from "@/components/sidebar/FileTree";
import DependencyGraph from "@/components/graph/DependencyGraph";
import FileDetailPanel from "@/components/detail/FileDetailPanel";

// ── Types ─────────────────────────────────────────────────────────────────────

type RepoStatus = "PENDING" | "CLONING" | "READING" | "PARSING" | "GRAPHING" | "READY" | "FAILED";

interface Progress { totalFiles: number; parsedFiles: number; failedFiles: number; percentage: number; }
interface RepoStats { totalFiles: number; totalComponents: number; totalFunctions: number; totalEdges: number; }
interface RepoInfo { owner: string; name: string; fullName: string; url: string; }

const TERMINAL: RepoStatus[] = ["READY", "FAILED"];
const PROCESSING: RepoStatus[] = ["CLONING", "READING", "PARSING", "GRAPHING"];

// ── Drag‑resizable divider hook ───────────────────────────────────────────────

function useDragDivider(
  initial: number,
  min: number,
  max: number,
  direction: "h" | "v" = "h",
  onCollapse?: () => void
) {
  const [size, setSize] = useState(initial);
  const dragging = useRef(false);
  const start = useRef(0);
  const startSize = useRef(initial);

  const onMouseDown = useCallback((e: ReactMouseEvent) => {
    e.preventDefault();
    dragging.current = true;
    start.current = direction === "h" ? e.clientX : e.clientY;
    startSize.current = size;
    document.body.classList.add(direction === "h" ? "dragging-h" : "dragging-v");

    const onUp = () => {
      dragging.current = false;
      document.body.classList.remove("dragging-h", "dragging-v");
      // Use any to bypass TS complaining about optional args in removeEventListener
      window.removeEventListener("mousemove", onMove as any);
      window.removeEventListener("mouseup", onUp);
    };

    const onMove = (ev: globalThis.MouseEvent) => {
      if (!dragging.current) return;
      const delta = direction === "h"
        ? ev.clientX - start.current
        : ev.clientY - start.current;
        
      const currentSize = startSize.current + delta;
      
      // Snap to collapse if dragged well below min
      if (onCollapse && currentSize < min - 50) {
        onCollapse();
        onUp();
        return;
      }
      
      setSize(Math.max(min, Math.min(max, currentSize)));
    };

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }, [size, min, max, direction, onCollapse]);

  return { size, onMouseDown };
}

function useRightDragDivider(
  initial: number,
  min: number,
  max: number,
  onCollapse?: () => void
) {
  const [size, setSize] = useState(initial);
  const dragging = useRef(false);
  const start = useRef(0);
  const startSize = useRef(initial);

  const onMouseDown = useCallback((e: ReactMouseEvent) => {
    e.preventDefault();
    dragging.current = true;
    start.current = e.clientX;
    startSize.current = size;
    document.body.classList.add("dragging-h");

    const onUp = () => {
      dragging.current = false;
      document.body.classList.remove("dragging-h");
      window.removeEventListener("mousemove", onMove as any);
      window.removeEventListener("mouseup", onUp);
    };

    const onMove = (ev: globalThis.MouseEvent) => {
      if (!dragging.current) return;
      const delta = start.current - ev.clientX;
      const currentSize = startSize.current + delta;
      
      if (onCollapse && currentSize < min - 50) {
        onCollapse();
        onUp();
        return;
      }
      
      setSize(Math.max(min, Math.min(max, currentSize)));
    };

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }, [size, min, max, onCollapse]);

  return { size, onMouseDown };
}

// ── Divider bar ───────────────────────────────────────────────────────────────

function DragDivider({
  onMouseDown, direction = "h",
}: { onMouseDown: (e: ReactMouseEvent) => void; direction?: "h" | "v" }) {
  const [hover, setHover] = useState(false);
  const isH = direction === "h";

  return (
    <div
      onMouseDown={onMouseDown}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        flexShrink: 0,
        width:  isH ? 2  : "100%",
        height: isH ? "100%" : 2,
        cursor: isH ? "col-resize" : "row-resize",
        background: hover ? "#ff4500" : "#1a1a1a",
        transition: "background 150ms ease",
        userSelect: "none",
        position: "relative",
        zIndex: 10,
        // Wider hit-area for better UX
        boxShadow: hover ? "0 0 8px rgba(255,69,0,0.4)" : "none",
      }}
    >
      <div style={{
        position: "absolute",
        top: isH ? 0 : -3,
        left: isH ? -3 : 0,
        right: isH ? -3 : 0,
        bottom: isH ? 0 : -3,
        zIndex: -1,
      }} />
    </div>
  );
}

// ── Stat pill ─────────────────────────────────────────────────────────────────

function StatPill({ value, label }: { value: number; label: string }) {
  const [hover, setHover] = useState(false);
  return (
    <div 
      onClick={() => {
        const msg = `Tell me about the ${label} in this codebase.`;
        window.dispatchEvent(new CustomEvent("DEV_LENS_CHAT_TRIGGER", { detail: { message: msg } }));
      }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{ 
        display: "flex", alignItems: "center", gap: 5, padding: "4px 8px",
        borderRadius: 6, cursor: "pointer", transition: "all 150ms ease",
        background: hover ? "rgba(255,69,0,0.05)" : "transparent",
        border: `1px solid ${hover ? "rgba(255,69,0,0.15)" : "transparent"}`,
      }}
    >
      <span style={{ fontSize: 14, fontWeight: 600, color: hover ? "#ff4500" : "#ffffff", transition: "color 150ms ease" }}>{value.toLocaleString()}</span>
      <span style={{ fontSize: 13, color: hover ? "#ccc" : "#909090", transition: "color 150ms ease" }}>{label}</span>
      {hover && <ExternalLink size={10} color="#ff4500" style={{ marginLeft: "auto" }} />}
    </div>
  );
}

// ── Sidebar nav button ────────────────────────────────────────────────────────

function NavBtn({
  icon: Icon, label, active, onClick,
}: { icon: React.ElementType; label: string; active: boolean; onClick: () => void }) {
  const [hover, setHover] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        width: "100%", display: "flex", alignItems: "center",
        gap: 10, padding: "9px 12px", borderRadius: 8,
        border: "none",
        background: active ? "rgba(255,69,0,0.1)" : hover ? "#4a4a4a" : "none",
        color: active ? "#ff4500" : hover ? "#ccc" : "#666",
        fontSize: 14, fontWeight: active ? 600 : 400,
        cursor: "pointer", textAlign: "left",
        transition: "all 150ms ease", userSelect: "none",
      }}
    >
      <Icon size={16} strokeWidth={1.75} />
      {label}
      {active && (
        <div style={{
          marginLeft: "auto", width: 6, height: 6, borderRadius: "50%",
          background: "#ff4500",
        }} />
      )}
    </button>
  );
}

// ── Section header ────────────────────────────────────────────────────────────

function SectionHeader({ label }: { label: string }) {
  return (
    <div style={{
      padding: "12px 14px 6px",
      fontSize: 11, fontWeight: 700,
      color: "#7a7a7a", textTransform: "uppercase", letterSpacing: "0.1em",
    }}>
      {label}
    </div>
  );
}

// ── Panel topbar ──────────────────────────────────────────────────────────────

function PanelBar({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      height: 44, display: "flex", alignItems: "center",
      padding: "0 16px", borderBottom: "1px solid #303030",
      background: "#0d0d0d", flexShrink: 0, gap: 8,
    }}>
      {children}
    </div>
  );
}

// ── Universal loading skeleton ────────────────────────────────────────────────

function PageSkeleton() {
  return (
    <div style={{
      display: "flex", height: "100vh", overflow: "hidden",
      background: "#252525",
    }}>
      {/* Sidebar skeleton */}
      <div style={{
        width: 220, flexShrink: 0, borderRight: "1px solid #303030",
        background: "#252525", padding: "16px 14px",
        display: "flex", flexDirection: "column", gap: 12,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
          <div className="shimmer" style={{ width: 30, height: 30, borderRadius: 8 }} />
          <div>
            <div className="shimmer" style={{ width: 80, height: 12, borderRadius: 4 }} />
            <div className="shimmer" style={{ width: 60, height: 8, borderRadius: 4, marginTop: 6 }} />
          </div>
        </div>
        <div className="shimmer" style={{ width: "100%", height: 34, borderRadius: 6 }} />
        <div style={{ marginTop: 12 }}>
          <div className="shimmer" style={{ width: 50, height: 8, borderRadius: 4, marginBottom: 10 }} />
          <div className="shimmer" style={{ width: "100%", height: 30, borderRadius: 6, marginBottom: 6 }} />
          <div className="shimmer" style={{ width: "100%", height: 30, borderRadius: 6 }} />
        </div>
        <div style={{ flex: 1 }} />
        <div className="shimmer" style={{ width: "100%", height: 28, borderRadius: 4 }} />
        <div className="shimmer" style={{ width: "100%", height: 28, borderRadius: 4 }} />
      </div>
      {/* Main area skeleton */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
        <div style={{
          height: 44, borderBottom: "1px solid #303030",
          display: "flex", alignItems: "center", padding: "0 16px", gap: 12,
        }}>
          <div className="shimmer" style={{ width: 14, height: 14, borderRadius: 3 }} />
          <div className="shimmer" style={{ width: 140, height: 10, borderRadius: 4 }} />
          <div style={{ flex: 1 }} />
          <div className="shimmer" style={{ width: 80, height: 10, borderRadius: 4 }} />
        </div>
        <div style={{
          flex: 1, display: "flex", alignItems: "center", justifyContent: "center",
          flexDirection: "column", gap: 16,
        }}>
          <div style={{ position: "relative", width: 52, height: 52 }}>
            <div style={{
              position: "absolute", inset: 0, borderRadius: "50%",
              border: "2px solid #303030",
            }} />
            <div style={{
              position: "absolute", inset: 0, borderRadius: "50%",
              border: "2px solid transparent",
              borderTopColor: "#ff4500",
              animation: "spin 0.9s linear infinite",
            }} />
            <div style={{
              position: "absolute", inset: 0,
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <Code2 size={18} color="#ff4500" />
            </div>
          </div>
          <p style={{ fontSize: 15, fontWeight: 500, color: "#a0a0a0", margin: 0 }}>
            Loading workspace…
          </p>
        </div>
      </div>
    </div>
  );
}

// ── Chat message types ────────────────────────────────────────────────────────

interface ChatMsg { role: "user" | "assistant"; text: string; ts: number; }

const STARTER_QUESTIONS = [
  "Explain the entry point",
  "How does routing work?",
  "What are the main services?",
  "Which files have the most dependencies?",
];

// ── Chat panel ────────────────────────────────────────────────────────────────

function ChatPanel({ repoId, repoName, model, updateAiModel }: { repoId: string; repoName?: string; model?: string; updateAiModel?: (m: string) => void }) {
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [rateLimits, setRateLimits] = useState<Record<string, string>>({});
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const loadingRef = useRef(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const send = useCallback(async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || loadingRef.current) return;
    
    setInput("");
    const userMsg: ChatMsg = { role: "user", text: trimmed, ts: Date.now() };
    setMessages(prev => [...prev, userMsg]);
    
    loadingRef.current = true;
    setLoading(true);

    try {
      const res = await fetch(`/api/repos/${repoId}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: trimmed, model: model }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({ error: "Internal Server Error" }));
        throw new Error(errorData.error || `Server failed with status ${res.status}`);
      }

      const data = await res.json();
      const reply: ChatMsg = {
        role: "assistant",
        text: data.response ?? "I couldn't generate a response. Please try again.",
        ts: Date.now(),
      };
      setMessages(prev => [...prev, reply]);
    } catch (err: any) {
      console.error("Chat Error:", err);
      const errMsg = err.message || "Failed to connect to intelligence layer.";
      
      let rateLimitText = errMsg;
      if (errMsg.includes("429") || errMsg.includes("rate_limit_exceeded")) {
        const match = errMsg.match(/try again in\s+([0-9a-z.]+)/i);
        const resetTime = match ? match[1] : "a few minutes";
        setRateLimits(prev => ({ ...prev, [model || "llama-3.3-70b-versatile"]: resetTime }));
        rateLimitText = `Model rate limit reached. Please select a different model below or try again in ${resetTime}.`;
      }

      setMessages(prev => [...prev, {
        role: "assistant",
        text: `Architecture AI Error: ${rateLimitText}`,
        ts: Date.now(),
      }]);
    } finally {
      loadingRef.current = false;
      setLoading(false);
    }
  }, [repoId, model]);

  useEffect(() => {
    const handleExecute = (e: any) => send(e.detail.message);
    const handlePrefill = (e: any) => setInput(e.detail.message);
    window.addEventListener("DEV_LENS_CHAT_EXECUTE", handleExecute);
    window.addEventListener("DEV_LENS_CHAT_PREFILL", handlePrefill);
    return () => {
      window.removeEventListener("DEV_LENS_CHAT_EXECUTE", handleExecute);
      window.removeEventListener("DEV_LENS_CHAT_PREFILL", handlePrefill);
    };
  }, [send]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const empty = messages.length === 0;

  const MODELS = [
    { id: "llama-3.3-70b-versatile", name: "70B Power" },
    { id: "llama-3.1-8b-instant", name: "8B Speed" },
  ];

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", background: "#252525" }}>
      {/* Messages */}
      <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: 0 }}>
        {empty ? (
          <div style={{
            flex: 1, display: "flex", flexDirection: "column",
            alignItems: "center", justifyContent: "center", padding: 40, gap: 20,
          }}>
            <div style={{
              width: 60, height: 60, borderRadius: "50%",
              background: "rgba(255,69,0,0.08)",
              border: "1px solid rgba(255,69,0,0.15)",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <Bot size={28} color="#ff4500" strokeWidth={1.5} />
            </div>
            <div style={{ textAlign: "center" }}>
              <p style={{ margin: 0, fontSize: 17, fontWeight: 600, color: "#ffffff" }}>
                Ask about {repoName ?? "this repo"}
              </p>
              <p style={{ margin: "8px 0 0", fontSize: 14, color: "#909090", maxWidth: 360, lineHeight: 1.6 }}>
                I can explain files, trace dependencies, describe architecture, and answer questions about this codebase.
              </p>
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, justifyContent: "center", maxWidth: 500, marginTop: 8 }}>
              {STARTER_QUESTIONS.map(q => (
                <button
                  key={q}
                  onClick={() => send(q)}
                  style={{
                    fontSize: 13, color: "#cccccc",
                    background: "#303030", border: "1px solid #4a4a4a",
                    borderRadius: 20, padding: "8px 16px",
                    cursor: "pointer", transition: "all 150ms ease",
                  }}
                  onMouseEnter={e => {
                    (e.currentTarget as HTMLElement).style.borderColor = "#ff4500";
                    (e.currentTarget as HTMLElement).style.color = "#ff4500";
                    (e.currentTarget as HTMLElement).style.background = "rgba(255,69,0,0.05)";
                  }}
                  onMouseLeave={e => {
                    (e.currentTarget as HTMLElement).style.borderColor = "#4a4a4a";
                    (e.currentTarget as HTMLElement).style.color = "#888";
                    (e.currentTarget as HTMLElement).style.background = "#303030";
                  }}
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div style={{ padding: "16px 0", display: "flex", flexDirection: "column", gap: 2 }}>
            {messages.map((msg, i) => (
              <ChatBubble key={i} msg={msg} />
            ))}
            {loading && <TypingIndicator />}
            <div ref={bottomRef} />
          </div>
        )}
      </div>

      {/* Input */}
      <div style={{ padding: "12px 16px", borderTop: "1px solid #303030", flexShrink: 0 }}>
        <div style={{
          display: "flex", alignItems: "flex-end", gap: 10,
          background: "#303030", border: "1px solid #4a4a4a",
          borderRadius: 12, padding: "10px 14px",
          transition: "border-color 150ms ease",
        }}
          onFocusCapture={e => (e.currentTarget as HTMLElement).style.borderColor = "#ff4500"}
          onBlurCapture={e => (e.currentTarget as HTMLElement).style.borderColor = "#4a4a4a"}
        >
          <textarea
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send(input);
              }
            }}
            placeholder="Ask anything about the codebase…"
            rows={4}
            style={{
              flex: 1, background: "none", border: "none", outline: "none",
              color: "#ffffff", fontSize: 14, fontFamily: "inherit",
              resize: "vertical", lineHeight: 1.55,
              minHeight: 80, maxHeight: 240, overflowY: "auto",
              paddingTop: 4, width: "100%",
            }}
          />
          <button
            onClick={() => send(input)}
            disabled={!input.trim() || loading}
            style={{
              width: 34, height: 34, borderRadius: 8, flexShrink: 0,
              background: input.trim() && !loading ? "#ff4500" : "#4a4a4a",
              border: "none", cursor: input.trim() && !loading ? "pointer" : "default",
              display: "flex", alignItems: "center", justifyContent: "center",
              transition: "all 150ms ease",
              boxShadow: input.trim() && !loading ? "0 2px 10px rgba(255,69,0,0.3)" : "none",
            }}
          >
            {loading
              ? <Loader2 size={14} color="#555" className="animate-spin" />
              : <Send size={14} color={input.trim() ? "#fff" : "#444"} />
            }
          </button>
        </div>
        
        {/* Bottom Accessories below the textarea container */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 10, position: "relative" }}>
           
           {/* Model Selector Button */}
           {updateAiModel && (
             <div style={{ position: "relative" }}>
               <button 
                 onClick={() => setDropdownOpen(!dropdownOpen)}
                 style={{
                   display: "flex", alignItems: "center", gap: 6,
                   background: "#252525", border: "1px solid #3a3a3a",
                   borderRadius: 12, padding: "4px 10px",
                   color: "#ccc", fontSize: 12, fontWeight: 500,
                   cursor: "pointer", outline: "none",
                   transition: "background 150ms ease"
                 }}
                 onMouseEnter={e => e.currentTarget.style.background = "#303030"}
                 onMouseLeave={e => e.currentTarget.style.background = "#252525"}
               >
                 <ChevronUp size={14} color="#888" />
                 {MODELS.find(m => m.id === model)?.name || "Select Model"}
               </button>

               {/* Dropdown Menu */}
               {dropdownOpen && (
                 <>
                   {/* Invisible backdrop to close dropdown */}
                   <div 
                     style={{ position: "fixed", inset: 0, zIndex: 100 }} 
                     onClick={() => setDropdownOpen(false)} 
                   />
                   <div style={{
                     position: "absolute", bottom: "100%", left: 0, marginBottom: 8,
                     background: "#1e1e1e", border: "1px solid #333",
                     borderRadius: 8, padding: "4px 0", width: 220,
                     boxShadow: "0 10px 40px rgba(0,0,0,0.8)", zIndex: 101,
                     display: "flex", flexDirection: "column"
                   }}>
                     <div style={{ padding: "8px 12px 4px", fontSize: 11, color: "#666", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                       Model
                     </div>
                     {MODELS.map(m => {
                       const isRateLimited = !!rateLimits[m.id];
                       const isSelected = m.id === model;
                       return (
                         <div
                           key={m.id}
                           onClick={() => {
                             if (!isRateLimited) {
                               updateAiModel(m.id);
                               setDropdownOpen(false);
                             }
                           }}
                           style={{
                             padding: "8px 12px", display: "flex", alignItems: "center", justifyContent: "space-between",
                             background: isSelected ? "rgba(255,69,0,0.1)" : "transparent",
                             color: isRateLimited ? "#666" : isSelected ? "#fff" : "#ccc",
                             cursor: isRateLimited ? "not-allowed" : "pointer",
                             fontSize: 13, transition: "background 150ms ease"
                           }}
                           onMouseEnter={e => { if (!isRateLimited && !isSelected) e.currentTarget.style.background = "#2a2a2a"; }}
                           onMouseLeave={e => { if (!isRateLimited && !isSelected) e.currentTarget.style.background = "transparent"; }}
                         >
                            <span>{m.name}</span>
                            {isRateLimited && <span style={{ fontSize: 10, color: "#ef4444", fontWeight: 700, padding: "2px 6px", background: "rgba(239,68,68,0.1)", borderRadius: 4 }}>Wait {rateLimits[m.id]}</span>}
                         </div>
                       )
                     })}
                   </div>
                 </>
               )}
             </div>
           )}
           <div style={{ fontSize: 11, color: "#555" }}>
             ↵ to send
           </div>
        </div>
      </div>
    </div>
  );
}

function ChatBubble({ msg }: { msg: ChatMsg }) {
  const isUser = msg.role === "user";
  return (
    <div style={{
      display: "flex",
      flexDirection: isUser ? "row-reverse" : "row",
      alignItems: "flex-start",
      gap: 10,
      padding: "8px 16px",
    }}>
      <div style={{
        width: 30, height: 30, borderRadius: "50%", flexShrink: 0,
        background: isUser ? "rgba(255,69,0,0.12)" : "#252525",
        border: `1px solid ${isUser ? "rgba(255,69,0,0.2)" : "#4a4a4a"}`,
        display: "flex", alignItems: "center", justifyContent: "center",
        marginTop: 2,
      }}>
        {isUser
          ? <span style={{ fontSize: 12, color: "#ff4500", fontWeight: 700 }}>U</span>
          : <Sparkles size={13} color="#ff4500" />
        }
      </div>
      <div style={{
        maxWidth: "75%",
        background: isUser ? "rgba(255,69,0,0.08)" : "#303030",
        border: `1px solid ${isUser ? "rgba(255,69,0,0.15)" : "#4a4a4a"}`,
        borderRadius: isUser ? "14px 4px 14px 14px" : "4px 14px 14px 14px",
        padding: "12px 16px",
        minWidth: 0,
      }}>
        {isUser ? (
          <p style={{
            margin: 0, fontSize: 15, color: "#d0d0d0", lineHeight: 1.65,
            whiteSpace: "pre-wrap", wordBreak: "break-word",
            fontFamily: "inherit",
          }}>
            {msg.text}
          </p>
        ) : (
          <div className="md-body">
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
                code({ node, className, children, ...props }: any) {
                  const match = /language-(\w+)/.exec(className || "");
                  const inline = !match;
                  return inline ? (
                    <code
                      style={{
                        background: "rgba(255,255,255,0.08)",
                        color: "#e06c75",
                        borderRadius: 4,
                        padding: "2px 6px",
                        fontSize: "0.88em",
                        fontFamily: "var(--font-mono, monospace)",
                      }}
                      {...props}
                    >
                      {children}
                    </code>
                  ) : (
                    <SyntaxHighlighter
                      style={vscDarkPlus as any}
                      language={match[1]}
                      PreTag="div"
                      customStyle={{
                        margin: "10px 0",
                        borderRadius: 8,
                        fontSize: 13,
                        border: "1px solid #3a3a3a",
                      }}
                      {...props}
                    >
                      {String(children).replace(/\n$/, "")}
                    </SyntaxHighlighter>
                  );
                },
              }}
            >
              {msg.text}
            </ReactMarkdown>
          </div>
        )}
      </div>
    </div>
  );
}

function TypingIndicator() {
  return (
    <div style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: "8px 16px" }}>
      <div style={{
        width: 30, height: 30, borderRadius: "50%",
        background: "#252525", border: "1px solid #4a4a4a",
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        <Sparkles size={13} color="#ff4500" />
      </div>
      <div style={{
        background: "#303030", border: "1px solid #4a4a4a",
        borderRadius: "4px 14px 14px 14px",
        padding: "14px 18px",
        display: "flex", gap: 5, alignItems: "center",
      }}>
        {[0, 0.2, 0.4].map((delay, i) => (
          <div key={i} style={{
            width: 7, height: 7, borderRadius: "50%",
            background: "#ff4500", opacity: 0.7,
            animation: `dl-pulse 1s ${delay}s ease-in-out infinite`,
          }} />
        ))}
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function RepoPage() {
  const { id: repoId } = useParams<{ id: string }>();
  const router = useRouter();

  const [status, setStatus]       = useState<RepoStatus | null>(null);
  const [progress, setProgress]   = useState<Progress | null>(null);
  const [errorMsg, setErrorMsg]   = useState<string | null>(null);
  const [repoStats, setRepoStats] = useState<RepoStats | null>(null);
  const [repoInfo, setRepoInfo]   = useState<RepoInfo | null>(null);
  const [selectedFileId, setSelected] = useState<string | null>(null);
  const [detailVisible, setDetailVisible] = useState(false);
  const [rightTab, setRightTab]   = useState<"chat"|"insights"|"code">("chat");
  const [showNewAnalysis, setShowNewAnalysis] = useState(false);
  const [newRepoUrl, setNewRepoUrl] = useState("");
  const [newRepoLoading, setNewRepoLoading] = useState(false);
  const [newRepoError, setNewRepoError] = useState("");
  const [newRepoTechStackError, setNewRepoTechStackError] = useState(false);

  const [leftCodeOpen, setLeftCodeOpen] = useState(false);
  const [leftCodeFileId, setLeftCodeFileId] = useState<string | null>(null);

  // Panel visibility
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [rightPanelOpen, setRightPanelOpen] = useState(true);

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Resizable panels
  const sidebar   = useDragDivider(260, 160, 360, "h", () => setSidebarOpen(false));
  const codePanel = useDragDivider(400, 250, 800, "h", () => setLeftCodeOpen(false));
  const chatSize  = useRightDragDivider(320, 250, 600, () => setRightPanelOpen(false));

  const [aiModel, setAiModel] = useState("llama-3.3-70b-versatile");

  useEffect(() => {
    const saved = localStorage.getItem("devlens-ai-model");
    if (saved) setAiModel(saved);
  }, []);

  const updateAiModel = (m: string) => {
    setAiModel(m);
    localStorage.setItem("devlens-ai-model", m);
  };

  useEffect(() => {
    const handleTrigger = (e: any) => {
      const { message } = e.detail;
      setRightPanelOpen(true);
      setRightTab("chat");
      // Use a small delay to ensure ChatPanel is rendered
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent("DEV_LENS_CHAT_PREFILL", { detail: { message } }));
      }, 50);
    };
    window.addEventListener("DEV_LENS_CHAT_TRIGGER", handleTrigger);
    return () => window.removeEventListener("DEV_LENS_CHAT_TRIGGER", handleTrigger);
  }, []);

  useEffect(() => {
    const handleLeftCode = (e: any) => {
      const { fileId, section } = e.detail;
      setLeftCodeFileId(fileId);
      setLeftCodeOpen(true);
      const sectionName = section === "imports" ? "imports" : section === "uses" ? "usage footprint" : "exported functions";
      window.dispatchEvent(new CustomEvent("DEV_LENS_CHAT_TRIGGER", {
        detail: { message: `Explain the ${sectionName} of this specific file context.` }
      }));
    };
    window.addEventListener("DEV_LENS_OPEN_LEFT_CODE", handleLeftCode);
    return () => window.removeEventListener("DEV_LENS_OPEN_LEFT_CODE", handleLeftCode);
  }, []);

  useEffect(() => {
    if (!repoId) return;
    const poll = async () => {
      try {
        const res  = await fetch(`/api/repos/${repoId}/status`);
        const data = await res.json();
        if (!data.success) return;
        setStatus(data.status);
        setProgress(data.progress ?? null);
        if (data.status === "READY") {
          setRepoStats(data.stats);
          try {
            const recent = JSON.parse(localStorage.getItem("devlens_recent") ?? "[]");
            const found  = recent.find((r: { repoId: string }) => r.repoId === repoId);
            if (found) {
              const [owner, name] = found.fullName.split("/");
              setRepoInfo({ owner, name, fullName: found.fullName, url: found.url });
            }
          } catch {}
        }
        if (data.status === "FAILED") setErrorMsg(data.error ?? "Analysis failed");
        if (TERMINAL.includes(data.status)) {
          if (intervalRef.current) clearInterval(intervalRef.current);
        }
      } catch {}
    };
    poll();
    intervalRef.current = setInterval(poll, 2000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [repoId]);

  const handleNodeClick = useCallback((id: string) => {
    setSelected(id || null);
    if (id) {
      setDetailVisible(true);
      setRightTab("insights");
    } else {
      setRightTab("chat");
      setDetailVisible(false);
    }
  }, []);

  const handleFileSelect = useCallback((id: string) => {
    setSelected(id);
    setDetailVisible(true);
    setRightTab("insights");
    setLeftCodeFileId(id);
    setLeftCodeOpen(true);
  }, []);

  const handleCloseDetail = useCallback(() => {
    setDetailVisible(false);
    setSelected(null);
    setRightTab("chat");
  }, []);

  const handleAnalyzeNew = useCallback(async () => {
    setNewRepoError("");
    setNewRepoTechStackError(false);
    const trimmed = newRepoUrl.trim();
    const match = trimmed.match(/^https:\/\/github\.com\/([\w.-]+)\/([\w.-]+)/);
    if (!match) {
      setNewRepoError("Please enter a valid GitHub repository URL");
      return;
    }
    setNewRepoLoading(true);
    try {
      const langRes = await fetch(`https://api.github.com/repos/${match[1]}/${match[2]}/languages`);
      if (langRes.ok) {
        const langs = await langRes.json();
        const keys = Object.keys(langs);
        if (keys.length > 0 && !keys.includes("TypeScript") && !keys.includes("JavaScript")) {
          setNewRepoTechStackError(true);
          setNewRepoLoading(false);
          return;
        }
      }

      const res = await fetch("/api/repos/analyze", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: trimmed }),
      });
      const data = await res.json();
      if (!data.success) {
        setNewRepoError(data.error ?? "Something went wrong");
        setNewRepoLoading(false);
        return;
      }
      
      try {
        const match = trimmed.match(/github\.com\/([\w.-]+\/[\w.-]+)/);
        const fullName = match ? match[1] : trimmed;
        const entry = { repoId: data.repoId, fullName, url: trimmed, analyzedAt: new Date().toISOString() };
        const LS_KEY = "devlens_recent";
        const existing = JSON.parse(localStorage.getItem(LS_KEY) ?? "[]");
        const filtered = existing.filter((r: any) => r.repoId !== entry.repoId);
        localStorage.setItem(LS_KEY, JSON.stringify([entry, ...filtered].slice(0, 5)));
      } catch {}

      setShowNewAnalysis(false);
      router.push(`/dashboard`);
    } catch {
      setNewRepoError("Failed to connect. Please try again.");
      setNewRepoLoading(false);
    }
  }, [newRepoUrl, router]);

  // ── Initial loading (no status fetched yet) ─────────────────────────────────

  if (status === null) {
    return <PageSkeleton />;
  }

  // ── Processing (CLONING/READING/PARSING/GRAPHING) ───────────────────────────

  if (PROCESSING.includes(status) || status === "PENDING") {
    return (
      <div style={{ background: "#252525", minHeight: "100vh" }}>
        <ProcessingStatus status={status} progress={progress} repoName={repoInfo?.fullName} />
      </div>
    );
  }

  // ── Error ────────────────────────────────────────────────────────────────────

  if (status === "FAILED") {
    return (
      <div style={{
        background: "#252525", minHeight: "100vh",
        display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center", gap: 24,
      }}>
        <div style={{
          width: 64, height: 64, borderRadius: "50%",
          background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.15)",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <AlertCircle size={28} color="#ef4444" />
        </div>
        <div style={{ textAlign: "center" }}>
          <h2 style={{ margin: 0, fontSize: 23, fontWeight: 700, color: "#ffffff" }}>Analysis Failed</h2>
          <p style={{ margin: "8px 0 0", fontSize: 16, color: "#a0a0a0", maxWidth: 400 }}>{errorMsg}</p>
        </div>
        <div style={{ display: "flex", gap: 12 }}>
          <button
            onClick={() => router.push("/")}
            style={{
              display: "flex", alignItems: "center", gap: 8,
              background: "#303030", border: "1px solid #4a4a4a",
              color: "#aaa", borderRadius: 8,
              padding: "10px 20px", fontSize: 15, fontWeight: 500, cursor: "pointer",
              transition: "all 150ms ease",
            }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = "#444"; e.currentTarget.style.color = "#fff"; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = "#4a4a4a"; e.currentTarget.style.color = "#aaa"; }}
          >
            <ArrowLeft size={15} /> Back to home
          </button>
          <button
            onClick={() => window.location.reload()}
            style={{
              display: "flex", alignItems: "center", gap: 8,
              background: "#ff4500", border: "none",
              color: "#fff", borderRadius: 8,
              padding: "10px 20px", fontSize: 15, fontWeight: 600, cursor: "pointer",
              boxShadow: "0 2px 12px rgba(255,69,0,0.3)",
              transition: "all 150ms ease",
            }}
          >
            <RefreshCw size={15} /> Try again
          </button>
        </div>
      </div>
    );
  }

  // ── Ready UI ──────────────────────────────────────────────────────────────────

  return (
    <div style={{
      display: "flex", height: "100vh", overflow: "hidden",
      background: "#252525",
    }}>

      {/* ── Static nav sidebar ── */}
      {sidebarOpen && (
        <div style={{
          width: sidebar.size, flexShrink: 0,
          background: "#252525", borderRight: "1px solid #303030",
          display: "flex", flexDirection: "column", overflow: "hidden",
          minWidth: 160, maxWidth: 320,
        }}>
          {/* Logo */}
          <div style={{
            padding: "14px 16px 12px",
            borderBottom: "1px solid #303030",
            display: "flex", alignItems: "center", gap: 10, cursor: "pointer",
          }}
            onClick={() => router.push("/")}
          >
            <div style={{
              width: 30, height: 30, borderRadius: 8,
              background: "#ff4500",
              display: "flex", alignItems: "center", justifyContent: "center",
              flexShrink: 0, boxShadow: "0 2px 8px rgba(255,69,0,0.2)",
            }}>
              <Code2 size={15} color="#fff" strokeWidth={2.5} />
            </div>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ fontSize: 16, fontWeight: 800, color: "#ffffff", letterSpacing: "-0.02em" }}>
                Dev<span style={{ color: "#ff4500" }}>Lens</span>
              </div>
              <div style={{ fontSize: 11, color: "#909090", marginTop: 1, fontWeight: 500 }}>Code Intelligence</div>
            </div>
            <button 
              onClick={(e) => { e.stopPropagation(); setSidebarOpen(false); }}
              style={{ background: "none", border: "none", color: "#555", cursor: "pointer", padding: 4 }}
              title="Collapse sidebar"
            >
              <ChevronsLeft size={16} />
            </button>
          </div>

          {/* Repository info */}
          {repoInfo && (
            <div style={{
              padding: "10px 14px", borderBottom: "1px solid #303030",
              display: "flex", alignItems: "center", justifyContent: "space-between", gap: 6,
            }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 11, color: "#909090", textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 600, marginBottom: 3 }}>
                  Repository
                </div>
                <div style={{
                  fontSize: 13, fontWeight: 500, color: "#aaa",
                  overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis",
                  fontFamily: "var(--font-mono)",
                }}>
                  {repoInfo.fullName}
                </div>
              </div>
              <a href={repoInfo.url} target="_blank" rel="noopener noreferrer"
                style={{
                  flexShrink: 0, color: "#909090", transition: "color 150ms ease",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  width: 28, height: 28, borderRadius: 6, background: "#303030",
                  border: "1px solid #303030",
                }}
                onMouseEnter={e => { e.currentTarget.style.color = "#ff4500"; e.currentTarget.style.borderColor = "#ff4500"; }}
                onMouseLeave={e => { e.currentTarget.style.color = "#555"; e.currentTarget.style.borderColor = "#303030"; }}
              >
                <ExternalLink size={12} />
              </a>
            </div>
          )}

          {/* Explorer Tree */}
          <div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column", borderTop: "1px solid #303030" }}>
            <FileTree repoId={repoId} selectedFileId={selectedFileId} onFileSelect={handleFileSelect} />
          </div>

          {/* Stats */}
          {repoStats && (
            <div style={{
              padding: "12px 14px",
              borderTop: "1px solid #303030",
            }}>
              <div style={{ fontSize: 11, color: "#909090", textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 600, marginBottom: 8 }}>
                Stats
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px 0" }}>
                <StatPill value={repoStats.totalFiles}      label="files" />
                <StatPill value={repoStats.totalComponents} label="components" />
                <StatPill value={repoStats.totalFunctions}  label="functions" />
                <StatPill value={repoStats.totalEdges}      label="edges" />
              </div>
            </div>
          )}

          {/* Bottom actions */}
          <div style={{ padding: "6px 8px 10px", borderTop: "1px solid #303030" }}>
            {[
              { icon: HelpCircle, label: "Help",     action: () => window.open("https://github.com", "_blank") },
              { icon: Settings,   label: "Settings",  action: () => {} },
            ].map(item => (
              <button
                key={item.label}
                onClick={item.action}
                style={{
                  width: "100%", display: "flex", alignItems: "center", gap: 10,
                  padding: "8px 12px", borderRadius: 6, border: "none",
                  background: "none", color: "#909090", fontSize: 14,
                  cursor: "pointer", transition: "all 150ms ease",
                }}
                onMouseEnter={e => {
                  (e.currentTarget as HTMLElement).style.background = "#252525";
                  (e.currentTarget as HTMLElement).style.color = "#aaa";
                }}
                onMouseLeave={e => {
                  (e.currentTarget as HTMLElement).style.background = "none";
                  (e.currentTarget as HTMLElement).style.color = "#555";
                }}
              >
                <item.icon size={14} strokeWidth={1.75} />
                {item.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Sidebar ↔ content divider */}
      {sidebarOpen && <DragDivider onMouseDown={sidebar.onMouseDown} />}

      {/* ── Main area ── */}
      <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>

        {/* Source Code Panel */}
        {leftCodeOpen && leftCodeFileId && (
          <div style={{
            width: codePanel.size, flexShrink: 0,
            background: "#252525", borderRight: "1px solid #303030",
            display: "flex", flexDirection: "column", overflow: "hidden",
          }}>
            <PanelBar>
              <Code2 size={14} color="#ff4500" strokeWidth={1.75} />
              <span style={{ fontSize: 13, fontWeight: 600, color: "#cccccc", letterSpacing: "0.04em", textTransform: "uppercase", flex: 1 }}>
                Source Code
              </span>
              <button 
                onClick={() => setLeftCodeOpen(false)}
                style={{ background: "none", border: "none", color: "#555", cursor: "pointer", padding: 4 }}
                title="Collapse code"
              >
                <ChevronLeft size={16} />
              </button>
            </PanelBar>
            <div style={{ flex: 1, overflow: "hidden" }}>
              <FileDetailPanel
                fileId={leftCodeFileId}
                onClose={() => setLeftCodeOpen(false)}
                onFileSelect={handleFileSelect}
                activeTab="code"
              />
            </div>
          </div>
        )}

        {leftCodeOpen && leftCodeFileId && <DragDivider onMouseDown={codePanel.onMouseDown} />}

        {/* Graph */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
          <PanelBar>
            {/* If sidebar is closed, show a restore button */}
            {!sidebarOpen && (
              <div style={{ display: "flex", gap: 6, marginRight: 10 }}>
                <button 
                  onClick={() => setSidebarOpen(true)}
                  style={{ background: "#252525", border: "1px solid #3a3a3a", borderRadius: 4, padding: "2px 6px", display: "flex", alignItems: "center", gap: 4, color: "#999", fontSize: 11, cursor: "pointer" }}
                >
                  <SidebarIcon size={12} /> Sidebar
                </button>
              </div>
            )}

            <GitBranch size={14} color="#ff4500" strokeWidth={1.75} />
            <span style={{ fontSize: 14, fontWeight: 600, color: "#cccccc" }}>Dependency Graph</span>
            {repoInfo && (
              <>
                <ChevronRight size={13} color="#424242" />
                <span style={{ fontSize: 13, color: "#909090", fontFamily: "var(--font-mono)" }}>
                  {repoInfo.fullName}
                </span>
              </>
            )}
            {repoStats && (
              <div style={{ marginLeft: "auto", display: "flex", gap: 16, alignItems: "center" }}>
                <StatPill value={repoStats.totalFiles} label="files" />
                <div style={{ width: 1, height: 14, background: "#4a4a4a" }} />
                <StatPill value={repoStats.totalEdges} label="edges" />
                
                {/* Right panel toggle if closed */}
                {!rightPanelOpen && (
                  <button 
                    onClick={() => setRightPanelOpen(true)}
                    style={{ 
                      background: "#ff4500", border: "none", borderRadius: 4, 
                      padding: "4px 8px", color: "#fff", fontSize: 11, fontWeight: 600,
                      cursor: "pointer", marginLeft: 8, display: "flex", alignItems: "center", gap: 4
                    }}
                  >
                    <Bot size={12} color="#fff" /> AI
                  </button>
                )}
              </div>
            )}
          </PanelBar>
          <DependencyGraph
            repoId={repoId}
            selectedFileId={selectedFileId}
            onNodeClick={handleNodeClick}
          />
        </div>

        {/* Right side — Tabs (Chat / Insights / Code) */}
        {rightPanelOpen && <DragDivider onMouseDown={chatSize.onMouseDown} />}
        {rightPanelOpen && (
          <div style={{ 
            width: chatSize.size, flexShrink: 0, 
            minWidth: 250, maxWidth: 600,
            borderLeft: "1px solid #303030", 
            display: "flex", flexDirection: "column",
            background: "#252525"
          }}>
            {/* Tab Bar */}
            <div style={{ 
              display: "flex", height: 44, borderBottom: "1px solid #303030", 
              background: "#0d0d0d", padding: "0 8px", alignItems: "center" 
            }}>
              <button 
                onClick={() => setRightTab("chat")}
                style={{
                  flex: 1, background: "none", border: "none", height: "100%",
                  color: rightTab === "chat" ? "#ff4500" : "#666",
                  fontSize: 13, fontWeight: rightTab === "chat" ? 600 : 500,
                  cursor: "pointer", borderBottom: `2px solid ${rightTab === "chat" ? "#ff4500" : "transparent"}`
                }}
              >
                AI Assistant
              </button>
              {selectedFileId && (
                <>
                  <button 
                    onClick={() => setRightTab("insights")}
                    style={{
                      flex: 1, background: "none", border: "none", height: "100%",
                      color: rightTab === "insights" ? "#ff4500" : "#666",
                      fontSize: 13, fontWeight: rightTab === "insights" ? 600 : 500,
                      cursor: "pointer", borderBottom: `2px solid ${rightTab === "insights" ? "#ff4500" : "transparent"}`
                    }}
                  >
                    Insights
                  </button>
                </>
              )}
              <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "0 10px", marginLeft: "auto", height: "100%" }}>
                <button 
                  onClick={() => setRightPanelOpen(false)}
                  style={{ background: "none", border: "none", color: "#555", cursor: "pointer", padding: 0, height: "100%", display: "flex", alignItems: "center" }}
                  title="Close panel"
                >
                  <ChevronsRight size={18} />
                </button>
              </div>
            </div>

            {/* Tab Content */}
            <div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column" }}>
              {rightTab === "chat" && <ChatPanel repoId={repoId} repoName={repoInfo?.fullName} model={aiModel} updateAiModel={updateAiModel} />}
              {rightTab === "insights" && selectedFileId && (
                <FileDetailPanel
                  fileId={selectedFileId}
                  onClose={handleCloseDetail}
                  onFileSelect={handleNodeClick}
                  activeTab="insights"
                />
              )}
            </div>
          </div>
        )}
      </div>

      {/* New Analysis Modal */}
      {showNewAnalysis && (
        <div style={{
          position: "fixed", inset: 0, zIndex: 1000,
          background: "rgba(0,0,0,0.8)", backdropFilter: "blur(4px)",
          display: "flex", alignItems: "center", justifyContent: "center"
        }}>
          <div style={{
            background: "#303030", border: "1px solid #4a4a4a", borderRadius: 12,
            padding: 24, width: 400, display: "flex", flexDirection: "column", gap: 16,
            boxShadow: "0 8px 32px rgba(0,0,0,0.8)"
          }}>
            <h3 style={{ margin: 0, fontSize: 17, color: "#fff", fontWeight: 600 }}>Analyze New Repository</h3>
            <input 
              autoFocus
              placeholder="GitHub URL (e.g. https://github.com/user/repo)"
              value={newRepoUrl}
              onChange={e => { setNewRepoUrl(e.target.value); setNewRepoError(""); setNewRepoTechStackError(false); }}
              onKeyDown={e => {
                 if (e.key === "Enter" && newRepoUrl.trim()) handleAnalyzeNew();
              }}
              disabled={newRepoLoading}
              style={{
                background: "#252525", border: `1px solid ${newRepoError || newRepoTechStackError ? "#ef4444" : "#4a4a4a"}`, fontSize: 14,
                padding: "10px 14px", borderRadius: 6, color: "#fff", outline: "none",
                fontFamily: "var(--font-mono, monospace)"
              }}
            />
            {newRepoError && <div style={{ color: "#ef4444", fontSize: 13, marginTop: -8 }}>{newRepoError}</div>}
            {newRepoTechStackError && (
              <div style={{ color: "#ef4444", fontSize: 13, marginTop: -8, display: "flex", flexDirection: "column", gap: 6 }}>
                Unsupported Repository Tech Stack.
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginTop: 4 }}>
                  <span style={{ fontSize: 11, fontWeight: 600, color: "#ffaaaa", textTransform: "uppercase", letterSpacing: "0.05em" }}>INITIAL RELEASE SUPPORT:</span>
                  <div style={{ display: "flex", gap: 6 }}>
                    {["TypeScript", "JavaScript", "React", "Next.js", "Node"].map((lang, i) => (
                      <span key={i} style={{
                        fontSize: 11, color: "#fff", background: "rgba(239,68,68,0.15)", padding: "2px 8px",
                        borderRadius: 4, border: "1px solid rgba(239,68,68,0.3)"
                      }}>
                        {lang}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            )}
            
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 8 }}>
              <button 
                 onClick={() => { setShowNewAnalysis(false); setNewRepoUrl(""); setNewRepoError(""); setNewRepoTechStackError(false); }}
                 disabled={newRepoLoading}
                 style={{ 
                   background: "none", border: "none", color: "#a0a0a0", cursor: "pointer", 
                   fontSize: 14, padding: "8px 14px", transition: "color 150ms ease",
                   opacity: newRepoLoading ? 0.5 : 1
                 }}
                 onMouseEnter={e => e.currentTarget.style.color = "#fff"}
                 onMouseLeave={e => e.currentTarget.style.color = "#a0a0a0"}
              >
                Cancel
              </button>
              <button 
                disabled={!newRepoUrl.trim() || newRepoLoading}
                onClick={handleAnalyzeNew}
                style={{ 
                   background: "#ff4500", color: "#fff", border: "none", display: "flex", alignItems: "center", gap: 6,
                   borderRadius: 6, padding: "8px 20px", cursor: "pointer", fontSize: 14, fontWeight: 600,
                   opacity: newRepoUrl.trim() && !newRepoLoading ? 1 : 0.5, transition: "background 150ms ease"
                }}
                onMouseEnter={e => { if (newRepoUrl.trim() && !newRepoLoading) e.currentTarget.style.background = "#ff6534"; }}
                onMouseLeave={e => { if (newRepoUrl.trim() && !newRepoLoading) e.currentTarget.style.background = "#ff4500"; }}
              >
                {newRepoLoading ? "Analyzing..." : "Analyze"}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
