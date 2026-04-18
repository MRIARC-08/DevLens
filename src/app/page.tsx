"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  Link2, ArrowRight, Clock, Loader2,
  Code2, Cpu, FileCode, GitBranch, Search,
  Layers, Users, BarChart3, Zap, Eye, Shield,
  Star, ExternalLink, Mail,
  Network, Sparkles, Terminal, Globe,
  CheckCircle, MessageSquare,
} from "lucide-react";

/* ─── helpers ──────────────────────────────────────────────────────── */

const GITHUB_RE = /^https:\/\/github\.com\/[\w.-]+\/[\w.-]+/;
const LS_KEY = "devlens_recent";

interface RecentRepo { repoId: string; fullName: string; url: string; analyzedAt: string; }

function saveRecent(entry: RecentRepo) {
  try {
    const existing: RecentRepo[] = JSON.parse(localStorage.getItem(LS_KEY) ?? "[]");
    const filtered = existing.filter((r) => r.repoId !== entry.repoId);
    localStorage.setItem(LS_KEY, JSON.stringify([entry, ...filtered].slice(0, 5)));
  } catch {}
}
function loadRecent(): RecentRepo[] {
  try { return JSON.parse(localStorage.getItem(LS_KEY) ?? "[]"); } catch { return []; }
}
function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

/* ─── animated counter ─────────────────────────────────────────────── */

function AnimatedNumber({ target, suffix = "" }: { target: number; suffix?: string }) {
  const [val, setVal] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) return;
      let start = 0;
      const step = Math.max(1, Math.floor(target / 60));
      const id = setInterval(() => {
        start += step;
        if (start >= target) { setVal(target); clearInterval(id); }
        else setVal(start);
      }, 20);
      observer.disconnect();
    }, { threshold: 0.3 });
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, [target]);
  return <span ref={ref}>{val.toLocaleString()}{suffix}</span>;
}

/* ─── page ─────────────────────────────────────────────────────────── */

export default function HomePage() {
  const router = useRouter();
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [recent, setRecent] = useState<RecentRepo[]>([]);

  const [techStackError, setTechStackError] = useState(false);

  useEffect(() => { setRecent(loadRecent()); }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setTechStackError(false);
    const trimmed = url.trim();
    const match = trimmed.match(GITHUB_RE);
    if (!match) { setError("Please enter a valid GitHub repository URL"); return; }
    
    setLoading(true);
    
    try {
      // 1. Language constraint validation against GitHub API
      const exMatch = trimmed.match(/github\.com\/([\w.-]+)\/([\w.-]+)/);
      if (exMatch) {
        const langRes = await fetch(`https://api.github.com/repos/${exMatch[1]}/${exMatch[2]}/languages`);
        if (langRes.ok) {
          const langs = await langRes.json();
          const keys = Object.keys(langs);
          if (keys.length > 0 && !keys.includes("TypeScript") && !keys.includes("JavaScript")) {
            setTechStackError(true);
            setLoading(false);
            return;
          }
        }
      }

      // 2. Proceed with backend analysis
      const res = await fetch("/api/repos/analyze", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: trimmed }),
      });
      const data = await res.json();
      if (!data.success) { setError(data.error ?? "Something went wrong"); setLoading(false); return; }
      
      const fullName = exMatch ? `${exMatch[1]}/${exMatch[2]}` : trimmed;
      saveRecent({ repoId: data.repoId, fullName, url: trimmed, analyzedAt: new Date().toISOString() });
      router.push(`/dashboard`);
    } catch { 
      setError("Failed to connect. Please try again."); 
      setLoading(false); 
    }
  }

  return (
    <div style={{ background: "#252525", minHeight: "100vh", color: "#e8e8ed", fontFamily: "'Inter', -apple-system, sans-serif" }}>

      {/* ═══════════════════════ NAVBAR ═══════════════════════ */}
      <nav style={{
        position: "sticky", top: 0, zIndex: 100, height: 64,
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "0 40px", background: "rgba(10,10,10,0.85)",
        backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)",
        borderBottom: "1px solid #4a4a4a",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 40 }}>
          <a href="/" style={{ display: "flex", alignItems: "center", gap: 10, textDecoration: "none" }}>
            <div style={{
              width: 34, height: 34, borderRadius: 10,
              background: "#ff4500",
              display: "flex", alignItems: "center", justifyContent: "center",
              boxShadow: "0 2px 12px rgba(255,69,0,0.25)",
            }}>
              <Code2 size={18} color="#fff" strokeWidth={2.5} />
            </div>
            <span style={{ fontSize: 21, fontWeight: 800, color: "#fff", letterSpacing: "-0.5px" }}>
              Dev<span style={{ color: "#ff4500" }}>Lens</span>
            </span>
          </a>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <a href="/dashboard" style={{
            fontSize: 15, fontWeight: 600, color: "#fff", textDecoration: "none",
            padding: "8px 22px", borderRadius: 8,
            background: "#ff4500",
            boxShadow: "0 2px 16px rgba(255,69,0,0.3)",
            transition: "all 0.2s",
          }}
            onMouseEnter={e => (e.currentTarget.style.boxShadow = "0 4px 24px rgba(255,69,0,0.45)")}
            onMouseLeave={e => (e.currentTarget.style.boxShadow = "0 2px 16px rgba(255,69,0,0.3)")}
          >Go to Dashboard</a>
        </div>
      </nav>

      {/* ═══════════════════════ HERO ═══════════════════════ */}
      <section style={{
        position: "relative", overflow: "hidden",
        padding: "100px 40px 80px", textAlign: "center",
      }}>
        {/* Glow orbs */}
        <div style={{
          position: "absolute", top: "-20%", left: "50%", transform: "translateX(-50%)",
          width: 900, height: 500, borderRadius: "50%",
          background: "transparent",
          pointerEvents: "none",
        }} />
        <div style={{
          position: "absolute", top: "10%", left: "10%",
          width: 300, height: 300, borderRadius: "50%",
          background: "transparent",
          pointerEvents: "none",
        }} />

        <div style={{ position: "relative", maxWidth: 820, margin: "0 auto" }}>
          {/* Badge */}
          <div style={{
            display: "inline-flex", alignItems: "center", gap: 8,
            padding: "6px 16px", borderRadius: 100,
            background: "rgba(255,69,0,0.08)", border: "1px solid rgba(255,69,0,0.18)",
            marginBottom: 32,
          }}>
            <Sparkles size={14} color="#ff4500" />
            <span style={{ fontSize: 13, fontWeight: 600, color: "#ff4500", letterSpacing: "0.05em", textTransform: "uppercase" }}>
              AI-Powered Code Intelligence
            </span>
          </div>

          <h1 style={{
            fontSize: "clamp(42px, 6vw, 72px)", fontWeight: 800,
            lineHeight: 1.05, letterSpacing: "-2px", color: "#fff",
            margin: 0,
          }}>
            Great code starts with<br />
            <span style={{
              background: "#ff4500",
              WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
              backgroundClip: "text",
            }}>
              a clear view.
            </span>
          </h1>

          <p style={{
            marginTop: 24, fontSize: 19, lineHeight: 1.7, color: "#cccccc",
            maxWidth: 580, marginLeft: "auto", marginRight: "auto",
          }}>
            All the tools you need to explore architecture, map dependencies,
            and understand any GitHub repo — in a single unified platform.
          </p>

          {/* CTA buttons */}
          <div style={{ display: "flex", gap: 16, justifyContent: "center", marginTop: 36 }}>
            <a href="#hero-input" style={{
              display: "inline-flex", alignItems: "center", gap: 8,
              padding: "14px 32px", borderRadius: 10,
              background: "#ff4500",
              color: "#fff", fontSize: 17, fontWeight: 600, textDecoration: "none",
              boxShadow: "0 4px 24px rgba(255,69,0,0.35)",
              transition: "all 0.2s",
            }}
              onMouseEnter={e => (e.currentTarget.style.transform = "translateY(-2px)")}
              onMouseLeave={e => (e.currentTarget.style.transform = "translateY(0)")}
            >
              Get started for free <ArrowRight size={18} />
            </a>
            <a href="#" style={{
              display: "inline-flex", alignItems: "center", gap: 8,
              padding: "14px 32px", borderRadius: 10,
              background: "#252525", border: "1px solid #4a4a4a",
              color: "#ffffff", fontSize: 17, fontWeight: 500, textDecoration: "none",
              transition: "all 0.2s",
            }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = "#444"; e.currentTarget.style.color = "#fff"; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = "#4a4a4a"; e.currentTarget.style.color = "#ccc"; }}
            >
              Get a quote
            </a>
          </div>
        </div>

        {/* ── Input card (Bitly "Start now" style) ── */}
        <div id="hero-input" style={{
          maxWidth: 700, margin: "64px auto 0",
          background: "#303030", border: "1px solid #222",
          borderRadius: 16, padding: "28px 32px 24px",
          boxShadow: "0 16px 48px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,69,0,0.06)",
          position: "relative",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 20 }}>
            <span style={{
              fontSize: 14, fontWeight: 700, color: "#ff4500",
              padding: "5px 14px", borderRadius: 8,
              background: "rgba(255,69,0,0.1)",
            }}>Analyze a Repo</span>
            <span style={{ fontSize: 13, color: "#909090", marginLeft: 8 }}>
              Paste any public GitHub URL
            </span>
          </div>

          <form onSubmit={handleSubmit}>
            <div style={{
              display: "flex", alignItems: "center", gap: 0,
              background: "#252525", border: `1px solid ${error || techStackError ? "rgba(239,68,68,0.4)" : "#4a4a4a"}`,
              borderRadius: 10, overflow: "hidden",
              transition: "border-color 0.2s",
            }}
              onFocus={e => { if (!error && !techStackError) (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,69,0,0.4)"; }}
              onBlur={e => { if (!error && !techStackError) (e.currentTarget as HTMLElement).style.borderColor = "#4a4a4a"; }}
            >
              <div style={{ padding: "0 16px", display: "flex", alignItems: "center" }}>
                <Link2 size={18} color="#555" />
              </div>
              <input
                type="text" value={url}
                onChange={(e) => { setUrl(e.target.value); setError(""); setTechStackError(false); }}
                placeholder="https://github.com/vercel/next.js"
                disabled={loading}
                style={{
                  flex: 1, background: "none", border: "none", outline: "none",
                  color: "#e8e8ed", fontSize: 16, padding: "14px 4px",
                  fontFamily: "inherit",
                }}
              />
              <button
                type="submit" disabled={loading || !url.trim()}
                style={{
                  margin: 4,
                  padding: "10px 24px", borderRadius: 8, border: "none",
                  fontSize: 15, fontWeight: 600, cursor: loading || !url.trim() ? "not-allowed" : "pointer",
                  display: "flex", alignItems: "center", gap: 8,
                  color: "#fff", whiteSpace: "nowrap",
                  background: loading || !url.trim()
                    ? "#4a4a4a"
                    : "#ff4500",
                  boxShadow: loading || !url.trim() ? "none" : "0 2px 16px rgba(255,69,0,0.25)",
                  transition: "all 0.2s",
                }}
              >
                {loading ? <Loader2 size={15} style={{ animation: "spin 1s linear infinite" }} /> : <Search size={15} />}
                {loading ? "Analyzing…" : "Explore"}
              </button>
            </div>

            {error && (
              <p style={{ margin: "8px 0 0", fontSize: 14, color: "#ef4444", fontWeight: 500, textAlign: "left" }}>{error}</p>
            )}
            
            {techStackError && (
              <div style={{ 
                margin: "12px 0 0", background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)", 
                padding: "12px 16px", borderRadius: 8, textAlign: "left" 
              }}>
                <p style={{ margin: "0 0 8px", fontSize: 13, color: "#ef4444", fontWeight: 600 }}>Unsupported Repository Tech Stack</p>
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
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
          </form>

        </div>
      </section>

      {/* ═══════════════════════ TRUST BAR ═══════════════════════ */}
      <section style={{
        borderTop: "1px solid #4a4a4a", borderBottom: "1px solid #4a4a4a",
        background: "#0e0e0e", padding: "48px 40px",
      }}>
        <div style={{
          maxWidth: 1100, margin: "0 auto",
          display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 32,
          textAlign: "center",
        }}>
          {[
            { num: 10000, suffix: "+", label: "Repos Analyzed", icon: Globe },
            { num: 250, suffix: "K+", label: "Files Mapped", icon: FileCode },
            { num: 99, suffix: "%", label: "Accuracy", icon: Shield },
            { num: 50, suffix: "ms", label: "Avg. Response", icon: Zap },
          ].map((s, i) => (
            <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
              <s.icon size={20} color="#ff4500" style={{ marginBottom: 4 }} />
              <span style={{ fontSize: 37, fontWeight: 800, color: "#fff", letterSpacing: "-1px", lineHeight: 1 }}>
                <AnimatedNumber target={s.num} suffix={s.suffix} />
              </span>
              <span style={{ fontSize: 15, color: "#a0a0a0", fontWeight: 500 }}>{s.label}</span>
            </div>
          ))}
        </div>
      </section>

      {/* ═══════════════════════ PRODUCT CARDS (Bitly-style 3-col) ═══════════════════════ */}
      <section style={{ padding: "96px 40px", maxWidth: 1200, margin: "0 auto" }}>
        <div style={{ textAlign: "center", marginBottom: 64 }}>
          <h2 style={{ fontSize: 41, fontWeight: 800, color: "#fff", letterSpacing: "-1px", margin: 0 }}>
            The DevLens Platform
          </h2>
          <p style={{ fontSize: 19, color: "#777", marginTop: 16, maxWidth: 600, margin: "16px auto 0" }}>
            Everything you need to visualize, understand, and communicate code architecture — powered by AI.
          </p>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 24 }}>
          {[
            {
              icon: Network, title: "Dependency Graph",
              desc: "Interactive, zoomable graphs that reveal how every file connects. Click any node to trace imports, exports, and relationships.",
              features: ["Auto-layout with dagre", "Highlight connected nodes", "File type color coding", "Pan, zoom & search"],
              color: "#ff4500",
            },
            {
              icon: Sparkles, title: "AI Code Assistant",
              desc: "Ask natural-language questions about architecture, entry points, routing, and more. Context-aware answers from your actual codebase.",
              features: ["Natural language queries", "Architecture explanations", "Entry point analysis", "Code pattern detection"],
              color: "#ff6a33",
            },
            {
              icon: BarChart3, title: "Insights & Analytics",
              desc: "Instant analytics on file complexity, dependency depth, and code health. Spot bottlenecks before they become problems.",
              features: ["Complexity scoring", "Dependency metrics", "Component analysis", "Function extraction"],
              color: "#ff8a50",
            },
          ].map((card, i) => (
            <div key={i} style={{
              background: "#303030", border: "1px solid #303030",
              borderRadius: 16, padding: 0, overflow: "hidden",
              transition: "all 0.3s", cursor: "pointer",
            }}
              onMouseEnter={e => {
                (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,69,0,0.3)";
                (e.currentTarget as HTMLElement).style.transform = "translateY(-4px)";
                (e.currentTarget as HTMLElement).style.boxShadow = "0 12px 40px rgba(255,69,0,0.08)";
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLElement).style.borderColor = "#303030";
                (e.currentTarget as HTMLElement).style.transform = "translateY(0)";
                (e.currentTarget as HTMLElement).style.boxShadow = "none";
              }}
            >
              {/* Top accent bar */}
              <div style={{ height: 3, background: `var(--accent)` }} />
              <div style={{ padding: "32px 28px 28px" }}>
                <div style={{
                  width: 48, height: 48, borderRadius: 12,
                  background: `rgba(255,69,0,0.08)`, border: "1px solid rgba(255,69,0,0.15)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  marginBottom: 20,
                }}>
                  <card.icon size={22} color={card.color} />
                </div>
                <h3 style={{ fontSize: 21, fontWeight: 700, color: "#fff", margin: "0 0 12px" }}>{card.title}</h3>
                <p style={{ fontSize: 15, color: "#cccccc", lineHeight: 1.7, margin: "0 0 20px" }}>{card.desc}</p>
                <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 10 }}>
                  {card.features.map((f, j) => (
                    <li key={j} style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 14, color: "#aaa" }}>
                      <CheckCircle size={14} color="#ff4500" style={{ flexShrink: 0 }} />
                      {f}
                    </li>
                  ))}
                </ul>
                <div style={{ marginTop: 24 }}>
                  <a href="#hero-input" style={{
                    display: "inline-flex", alignItems: "center", gap: 6,
                    fontSize: 15, fontWeight: 600, color: "#ff4500", textDecoration: "none",
                    transition: "gap 0.2s",
                  }}
                    onMouseEnter={e => (e.currentTarget.style.gap = "10px")}
                    onMouseLeave={e => (e.currentTarget.style.gap = "6px")}
                  >
                    Get started free <ArrowRight size={15} />
                  </a>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ═══════════════════════ SPLIT SECTION — "More than…" ═══════════════════════ */}
      <section style={{
        background: "#0e0e0e", borderTop: "1px solid #4a4a4a",
        borderBottom: "1px solid #4a4a4a", padding: "96px 40px",
      }}>
        <div style={{
          maxWidth: 1100, margin: "0 auto",
          display: "grid", gridTemplateColumns: "1fr 1fr", gap: 80, alignItems: "center",
        }}>
          <div>
            <span style={{
              fontSize: 13, fontWeight: 700, color: "#ff4500", textTransform: "uppercase",
              letterSpacing: "0.1em", marginBottom: 16, display: "block",
            }}>Why DevLens</span>
            <h2 style={{ fontSize: 37, fontWeight: 800, color: "#fff", lineHeight: 1.15, margin: "0 0 20px", letterSpacing: "-0.5px" }}>
              More than a file browser.
            </h2>
            <p style={{ fontSize: 17, color: "#cccccc", lineHeight: 1.75, margin: "0 0 32px" }}>
              Understanding how your code connects should be as easy as reading it.
              DevLens maps every import, export, and function — then lets you query it
              all with natural language. Track, analyze, and navigate in one place.
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
              {[
                { icon: Eye, title: "Visual Architecture", desc: "See the full picture with interactive dependency graphs." },
                { icon: MessageSquare, title: "AI Chat Interface", desc: "Ask questions about any file, function, or pattern." },
                { icon: Terminal, title: "Deep File Analysis", desc: "Explore imports, exports, functions and complexity per file." },
              ].map((item, i) => (
                <div key={i} style={{ display: "flex", gap: 16, alignItems: "flex-start" }}>
                  <div style={{
                    width: 42, height: 42, borderRadius: 10, flexShrink: 0,
                    background: "rgba(255,69,0,0.08)", border: "1px solid rgba(255,69,0,0.12)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}>
                    <item.icon size={18} color="#ff4500" />
                  </div>
                  <div>
                    <h4 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: "#ffffff" }}>{item.title}</h4>
                    <p style={{ margin: "4px 0 0", fontSize: 14, color: "#777", lineHeight: 1.6 }}>{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
            <a href="#hero-input" style={{
              display: "inline-flex", alignItems: "center", gap: 8, marginTop: 36,
              padding: "12px 28px", borderRadius: 10, fontSize: 15, fontWeight: 600,
              background: "#ff4500", color: "#fff",
              textDecoration: "none", boxShadow: "0 2px 16px rgba(255,69,0,0.3)",
              transition: "all 0.2s",
            }}
              onMouseEnter={e => (e.currentTarget.style.transform = "translateY(-2px)")}
              onMouseLeave={e => (e.currentTarget.style.transform = "translateY(0)")}
            >Get started for free <ArrowRight size={16} /></a>
          </div>

          {/* Right: mock dashboard */}
          <div style={{
            background: "#303030", border: "1px solid #303030",
            borderRadius: 16, overflow: "hidden",
            boxShadow: "0 20px 60px rgba(0,0,0,0.4), 0 0 0 1px rgba(255,69,0,0.05)",
          }}>
            {/* Mock toolbar */}
            <div style={{
              padding: "12px 16px", borderBottom: "1px solid #303030",
              display: "flex", alignItems: "center", gap: 8,
            }}>
              <div style={{ display: "flex", gap: 6 }}>
                <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#ff5f57" }} />
                <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#febc2e" }} />
                <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#28c840" }} />
              </div>
              <span style={{ fontSize: 12, color: "#7a7a7a", marginLeft: 12, fontFamily: "monospace" }}>DevLens — vercel/next.js</span>
            </div>
            {/* Mock content */}
            <div style={{ display: "flex", height: 320 }}>
              {/* Sidebar mock */}
              <div style={{ width: 160, borderRight: "1px solid #303030", padding: "12px 10px" }}>
                {["src/", "  app/", "    page.tsx", "    layout.tsx", "  lib/", "    utils.ts", "  components/", "    Header.tsx"].map((f, i) => (
                  <div key={i} style={{
                    fontSize: 12, fontFamily: "monospace", padding: "3px 6px",
                    color: i === 2 ? "#ff4500" : "#555", borderRadius: 4,
                    background: i === 2 ? "rgba(255,69,0,0.08)" : "transparent",
                  }}>{f}</div>
                ))}
              </div>
              {/* Graph mock */}
              <div style={{ flex: 1, position: "relative", overflow: "hidden" }}>
                <div style={{
                  position: "absolute", inset: 0,
                  background: "transparent",
                }} />
                <svg width="100%" height="100%" style={{ position: "absolute", inset: 0 }}>
                  {/* Edges */}
                  <path d="M 80 80 C 160 80, 160 50, 240 50" stroke="#ff4500" strokeWidth="1.5" fill="none" opacity="0.6" />
                  <path d="M 80 80 C 160 80, 160 110, 240 110" stroke="#ff4500" strokeWidth="1.5" fill="none" opacity="0.6" />
                  <path d="M 80 80 C 160 80, 160 170, 240 170" stroke="#ff4500" strokeWidth="1.5" fill="none" opacity="0.4" strokeDasharray="4 3" />
                  <path d="M 240 50 C 310 50, 310 80, 380 80" stroke="#555" strokeWidth="1" fill="none" opacity="0.3" />
                  <path d="M 240 110 C 310 110, 310 140, 380 140" stroke="#555" strokeWidth="1" fill="none" opacity="0.3" />
                  <path d="M 240 170 C 310 170, 310 200, 380 200" stroke="#555" strokeWidth="1" fill="none" opacity="0.3" />
                  <path d="M 240 170 C 310 170, 310 260, 380 260" stroke="#555" strokeWidth="1" fill="none" opacity="0.2" />
                  {/* Nodes */}
                  <circle cx="80" cy="80" r="5" fill="#ff4500" />
                  <circle cx="240" cy="50" r="4" fill="#888" />
                  <circle cx="240" cy="110" r="4" fill="#888" />
                  <circle cx="240" cy="170" r="4" fill="#666" />
                  <circle cx="380" cy="80" r="3" fill="#444" />
                  <circle cx="380" cy="140" r="3" fill="#444" />
                  <circle cx="380" cy="200" r="3" fill="#444" />
                  <circle cx="380" cy="260" r="3" fill="#424242" />
                </svg>
                {/* Node labels */}
                <div style={{ position: "absolute", top: 68, left: 24, fontSize: 11, fontFamily: "monospace", color: "#ff4500", fontWeight: 600,
                  background: "#303030", padding: "2px 8px", borderRadius: 4, border: "1px solid rgba(255,69,0,0.3)" }}>page.tsx</div>
                <div style={{ position: "absolute", top: 38, left: 252, fontSize: 11, fontFamily: "monospace", color: "#aaa",
                  background: "#252525", padding: "2px 8px", borderRadius: 4, border: "1px solid #222" }}>Header</div>
                <div style={{ position: "absolute", top: 98, left: 252, fontSize: 11, fontFamily: "monospace", color: "#aaa",
                  background: "#252525", padding: "2px 8px", borderRadius: 4, border: "1px solid #222" }}>Footer</div>
                <div style={{ position: "absolute", top: 158, left: 252, fontSize: 11, fontFamily: "monospace", color: "#777",
                  background: "#252525", padding: "2px 8px", borderRadius: 4, border: "1px solid #222" }}>utils</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════════════ HOW IT WORKS ═══════════════════════ */}
      <section style={{ padding: "96px 40px", maxWidth: 1100, margin: "0 auto" }}>
        <div style={{ textAlign: "center", marginBottom: 64 }}>
          <h2 style={{ fontSize: 37, fontWeight: 800, color: "#fff", letterSpacing: "-0.5px", margin: 0 }}>
            How it works
          </h2>
          <p style={{ fontSize: 17, color: "#777", marginTop: 14 }}>Three steps. Zero configuration.</p>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 40 }}>
          {[
            { step: "01", icon: Link2, title: "Paste a link", desc: "Drop any public GitHub repo URL into the input bar." },
            { step: "02", icon: Cpu, title: "We analyze", desc: "Our pipeline clones, parses, and maps every file relationship." },
            { step: "03", icon: Network, title: "Explore & ask", desc: "Navigate the interactive graph, inspect files, and chat with AI." },
          ].map((s, i) => (
            <div key={i} style={{ textAlign: "center" }}>
              <div style={{
                width: 72, height: 72, borderRadius: 18, margin: "0 auto 24px",
                background: "rgba(255,69,0,0.06)", border: "1px solid rgba(255,69,0,0.12)",
                display: "flex", alignItems: "center", justifyContent: "center",
                position: "relative",
              }}>
                <s.icon size={28} color="#ff4500" />
                <span style={{
                  position: "absolute", top: -8, right: -8,
                  fontSize: 12, fontWeight: 800, color: "#ff4500",
                  background: "#0e0e0e", border: "1px solid rgba(255,69,0,0.2)",
                  borderRadius: 6, padding: "2px 8px",
                }}>{s.step}</span>
              </div>
              <h3 style={{ fontSize: 19, fontWeight: 700, color: "#fff", margin: "0 0 10px" }}>{s.title}</h3>
              <p style={{ fontSize: 15, color: "#777", lineHeight: 1.65, margin: 0 }}>{s.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ═══════════════════════ TESTIMONIAL / SOCIAL PROOF ═══════════════════════ */}
      <section style={{
        background: "#161616",
        borderTop: "1px solid #4a4a4a", borderBottom: "1px solid #4a4a4a",
        padding: "80px 40px",
      }}>
        <div style={{ maxWidth: 900, margin: "0 auto", textAlign: "center" }}>
          <h2 style={{ fontSize: 33, fontWeight: 800, color: "#fff", margin: "0 0 48px" }}>
            See how teams use DevLens
          </h2>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
            {[
              {
                quote: "DevLens cut our onboarding time from 2 weeks to 2 days. New engineers can see exactly how everything connects.",
                name: "Priya Sharma",
                role: "Engineering Lead at ScaleUp",
                stars: 5,
              },
              {
                quote: "The dependency graph alone saved us from a circular import nightmare. The AI chat is the cherry on top.",
                name: "Alex Chen",
                role: "Senior Developer at CloudBase",
                stars: 5,
              },
            ].map((t, i) => (
              <div key={i} style={{
                background: "#252525", border: "1px solid #303030",
                borderRadius: 14, padding: "28px 28px 24px", textAlign: "left",
                transition: "border-color 0.3s",
              }}
                onMouseEnter={e => (e.currentTarget.style.borderColor = "rgba(255,69,0,0.2)")}
                onMouseLeave={e => (e.currentTarget.style.borderColor = "#303030")}
              >
                <div style={{ display: "flex", gap: 2, marginBottom: 16 }}>
                  {Array.from({ length: t.stars }).map((_, j) => (
                    <Star key={j} size={14} fill="#ff4500" color="#ff4500" />
                  ))}
                </div>
                <p style={{ fontSize: 16, color: "#ffffff", lineHeight: 1.7, margin: "0 0 20px", fontStyle: "italic" }}>
                  &ldquo;{t.quote}&rdquo;
                </p>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <div style={{
                    width: 36, height: 36, borderRadius: "50%",
                    background: "#ff4500",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 14, fontWeight: 700, color: "#fff",
                  }}>{t.name[0]}</div>
                  <div>
                    <p style={{ margin: 0, fontSize: 15, fontWeight: 600, color: "#ffffff" }}>{t.name}</p>
                    <p style={{ margin: 0, fontSize: 13, color: "#a0a0a0" }}>{t.role}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════════════ CTA BANNER ═══════════════════════ */}
      <section style={{ padding: "96px 40px" }}>
        <div style={{
          maxWidth: 900, margin: "0 auto", textAlign: "center",
          background: "rgba(255,69,0,0.06)",
          border: "1px solid rgba(255,69,0,0.12)",
          borderRadius: 20, padding: "64px 48px",
        }}>
          <h2 style={{ fontSize: 37, fontWeight: 800, color: "#fff", margin: 0, letterSpacing: "-0.5px" }}>
            Ready to decode your codebase?
          </h2>
          <p style={{ fontSize: 17, color: "#cccccc", marginTop: 16, maxWidth: 480, margin: "16px auto 0" }}>
            Start for free — no credit card, no setup, no risk. See why developers trust DevLens.
          </p>
          <div style={{ display: "flex", gap: 16, justifyContent: "center", marginTop: 36 }}>
            <a href="#hero-input" style={{
              display: "inline-flex", alignItems: "center", gap: 8,
              padding: "14px 32px", borderRadius: 10,
              background: "#ff4500",
              color: "#fff", fontSize: 16, fontWeight: 600, textDecoration: "none",
              boxShadow: "0 4px 24px rgba(255,69,0,0.3)",
              transition: "all 0.2s",
            }}
              onMouseEnter={e => (e.currentTarget.style.transform = "translateY(-2px)")}
              onMouseLeave={e => (e.currentTarget.style.transform = "translateY(0)")}
            >Try DevLens for free <ArrowRight size={16} /></a>
          </div>
          <div style={{ marginTop: 24, display: "flex", justifyContent: "center", gap: 24 }}>
            {["No credit card needed", "Free forever plan", "5-minute setup"].map((t, i) => (
              <span key={i} style={{ fontSize: 14, color: "#777", display: "flex", alignItems: "center", gap: 6 }}>
                <CheckCircle size={13} color="#ff4500" /> {t}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════════════ FOOTER ═══════════════════════ */}
      <footer style={{
        borderTop: "1px solid #4a4a4a", background: "#252525",
        padding: "64px 40px 32px",
      }}>
        <div style={{ maxWidth: 1200, margin: "0 auto" }}>
          {/* Top row */}
          <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr 1fr", gap: 48, marginBottom: 48 }}>
            {/* Brand */}
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
                <div style={{
                  width: 30, height: 30, borderRadius: 8,
                  background: "#ff4500",
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  <Code2 size={16} color="#fff" />
                </div>
                <span style={{ fontSize: 19, fontWeight: 800, color: "#fff" }}>
                  Dev<span style={{ color: "#ff4500" }}>Lens</span>
                </span>
              </div>
              <p style={{ fontSize: 14, color: "#a0a0a0", lineHeight: 1.7, maxWidth: 260, margin: 0 }}>
                AI-powered code architecture platform. Visualize, understand, and navigate any codebase instantly.
              </p>
              <div style={{ display: "flex", gap: 12, marginTop: 20 }}>
                {[Code2, ExternalLink, Mail].map((Icon, i) => (
                  <a key={i} href="#" style={{
                    width: 32, height: 32, borderRadius: 8, background: "#252525",
                    border: "1px solid #222", display: "flex", alignItems: "center",
                    justifyContent: "center", transition: "all 0.15s",
                  }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = "#ff4500"; }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = "#222"; }}
                  >
                    <Icon size={14} color="#888" />
                  </a>
                ))}
              </div>
            </div>

            {/* Link columns */}
            {[
              { title: "Products", links: ["Dependency Graph", "AI Assistant", "Analytics", "File Explorer"] },
              { title: "Solutions", links: ["Open Source", "Enterprise", "Education", "Startups"] },
              { title: "Resources", links: ["Documentation", "Blog", "Community", "Help Center"] },
              { title: "Company", links: ["About", "Careers", "Contact", "Privacy"] },
            ].map((col, i) => (
              <div key={i}>
                <h4 style={{ fontSize: 13, fontWeight: 700, color: "#909090", textTransform: "uppercase", letterSpacing: "0.08em", margin: "0 0 16px" }}>
                  {col.title}
                </h4>
                <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 10 }}>
                  {col.links.map((link, j) => (
                    <li key={j}>
                      <a href="#" style={{
                        fontSize: 14, color: "#777", textDecoration: "none", transition: "color 0.15s",
                      }}
                        onMouseEnter={e => (e.currentTarget.style.color = "#ff4500")}
                        onMouseLeave={e => (e.currentTarget.style.color = "#777")}
                      >{link}</a>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          {/* Bottom bar */}
          <div style={{
            borderTop: "1px solid #4a4a4a", paddingTop: 24,
            display: "flex", justifyContent: "space-between", alignItems: "center",
          }}>
            <span style={{ fontSize: 13, color: "#7a7a7a" }}>
              © {new Date().getFullYear()} DevLens. Built for developers, by developers.
            </span>
            <div style={{ display: "flex", gap: 20 }}>
              {["Privacy Policy", "Terms of Service", "Cookie Policy"].map((item, i) => (
                <a key={i} href="#" style={{ fontSize: 13, color: "#909090", textDecoration: "none", transition: "color 0.15s" }}
                  onMouseEnter={e => (e.currentTarget.style.color = "#888")}
                  onMouseLeave={e => (e.currentTarget.style.color = "#555")}
                >{item}</a>
              ))}
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
