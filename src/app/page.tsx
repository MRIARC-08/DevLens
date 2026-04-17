"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Link2, Bell, Settings, Search, ArrowRight,
  Clock, ExternalLink, Loader2, Database, Globe, Layers,
} from "lucide-react";

const GITHUB_RE = /^https:\/\/github\.com\/[\w.-]+\/[\w.-]+/;
const LS_KEY = "devlens_recent";

interface RecentRepo {
  repoId: string;
  fullName: string;
  url: string;
  analyzedAt: string;
}

function saveRecent(entry: RecentRepo) {
  try {
    const existing: RecentRepo[] = JSON.parse(localStorage.getItem(LS_KEY) ?? "[]");
    const filtered = existing.filter((r) => r.repoId !== entry.repoId);
    localStorage.setItem(LS_KEY, JSON.stringify([entry, ...filtered].slice(0, 5)));
  } catch {}
}

function loadRecent(): RecentRepo[] {
  try {
    return JSON.parse(localStorage.getItem(LS_KEY) ?? "[]");
  } catch { return []; }
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins} mins ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} hrs ago`;
  return `${Math.floor(hrs / 24)} days ago`;
}

const CARD_ICONS = [Database, Globe, Layers];

export default function HomePage() {
  const router = useRouter();
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [recent, setRecent] = useState<RecentRepo[]>([]);

  useEffect(() => { setRecent(loadRecent()); }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const trimmed = url.trim();
    if (!GITHUB_RE.test(trimmed)) {
      setError("Please enter a valid GitHub repository URL");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/repos/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: trimmed }),
      });
      const data = await res.json();
      if (!data.success) { setError(data.error ?? "Something went wrong"); setLoading(false); return; }
      const match = trimmed.match(/github\.com\/([\w.-]+\/[\w.-]+)/);
      const fullName = match ? match[1] : trimmed;
      saveRecent({ repoId: data.repoId, fullName, url: trimmed, analyzedAt: new Date().toISOString() });
      router.push(`/repo/${data.repoId}`);
    } catch {
      setError("Failed to connect. Please try again.");
      setLoading(false);
    }
  }

  return (
    <div style={{ background: "#0a0a0f", minHeight: "100vh", color: "#e2e2e8" }}>
      {/* ── Navbar ── */}
      <nav style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "0 32px", height: 56, borderBottom: "1px solid #1a1a2a",
        background: "#0d0d14",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 32 }}>
          <span style={{ fontSize: 20, fontWeight: 800, color: "#fff", letterSpacing: "-0.5px" }}>
            Dev<span style={{ color: "#7c6bf0" }}>Lens</span>
          </span>
          <div style={{ display: "flex", gap: 24 }}>
            {["Docs", "Plugins", "Community"].map((item) => (
              <a key={item} href="#" style={{ fontSize: 14, color: "#6b6b80", textDecoration: "none", transition: "color 0.15s" }}
                onMouseEnter={e => (e.currentTarget.style.color = "#e2e2e8")}
                onMouseLeave={e => (e.currentTarget.style.color = "#6b6b80")}>
                {item}
              </a>
            ))}
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{
            display: "flex", alignItems: "center", gap: 8,
            background: "#13131e", border: "1px solid #1e1e2e",
            borderRadius: 8, padding: "6px 14px", width: 200,
          }}>
            <Search size={14} color="#4a4a5a" />
            <span style={{ fontSize: 13, color: "#4a4a5a" }}>Search repos...</span>
          </div>
          <button style={{ background: "none", border: "none", cursor: "pointer", color: "#4a4a5a", display: "flex", padding: 6 }}>
            <Bell size={18} />
          </button>
          <button style={{ background: "none", border: "none", cursor: "pointer", color: "#4a4a5a", display: "flex", padding: 6 }}>
            <Settings size={18} />
          </button>
          <div style={{
            width: 32, height: 32, borderRadius: "50%",
            background: "linear-gradient(135deg, #7c6bf0, #a855f7)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 12, fontWeight: 700, color: "#fff",
          }}>D</div>
        </div>
      </nav>

      {/* ── Hero ── */}
      <div style={{ textAlign: "center", padding: "80px 24px 48px", maxWidth: 720, margin: "0 auto" }}>
        <h1 style={{ fontSize: "clamp(36px, 5vw, 58px)", fontWeight: 800, lineHeight: 1.1, margin: 0, color: "#fff", letterSpacing: "-1.5px" }}>
          Understand any codebase,
          <br />
          <span style={{ color: "#7c6bf0" }}>instantly.</span>
        </h1>
        <p style={{ marginTop: 20, fontSize: 16, color: "#6b6b80", lineHeight: 1.6, maxWidth: 520, margin: "20px auto 0" }}>
          Drop your repository link below. Our AI weaves through your architecture,
          mapping dependencies and explaining complex logic so you can start building faster.
        </p>

        {/* ── Input bar ── */}
        <form onSubmit={handleSubmit} style={{ marginTop: 40, position: "relative" }}>
          <div style={{
            display: "flex", alignItems: "center",
            background: "#13131e", border: "1px solid #252535",
            borderRadius: 12, padding: "4px 4px 4px 16px",
            maxWidth: 640, margin: "0 auto",
            boxShadow: "0 0 0 1px rgba(124,107,240,0.1), 0 8px 32px rgba(0,0,0,0.4)",
          }}>
            <Link2 size={16} color="#4a4a5a" style={{ flexShrink: 0 }} />
            <input
              type="text"
              value={url}
              onChange={(e) => { setUrl(e.target.value); setError(""); }}
              placeholder="https://github.com/your-org/your-repo"
              disabled={loading}
              style={{
                flex: 1, background: "none", border: "none", outline: "none",
                color: "#e2e2e8", fontSize: 15, padding: "10px 12px",
                fontFamily: "inherit",
              }}
            />
            <button
              type="submit"
              disabled={loading || !url.trim()}
              style={{
                background: loading || !url.trim()
                  ? "#2a2a3e"
                  : "linear-gradient(135deg, #7c6bf0, #6d5be0)",
                border: "none", borderRadius: 8, padding: "10px 20px",
                color: "#fff", fontSize: 14, fontWeight: 600,
                cursor: loading || !url.trim() ? "not-allowed" : "pointer",
                display: "flex", alignItems: "center", gap: 8,
                transition: "all 0.2s", whiteSpace: "nowrap",
              }}
            >
              {loading ? <Loader2 size={15} className="animate-spin" /> : <ArrowRight size={15} />}
              {loading ? "Analyzing..." : "Analyze Repo"}
            </button>
          </div>
          {error && (
            <p style={{ marginTop: 10, fontSize: 13, color: "#f87171", textAlign: "center" }}>{error}</p>
          )}
        </form>
      </div>

      {/* ── Recent Insights ── */}
      <div style={{ maxWidth: 960, margin: "0 auto", padding: "0 24px 60px" }}>
        {recent.length > 0 && (
          <>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
              <h2 style={{ fontSize: 18, fontWeight: 700, color: "#fff", margin: 0 }}>Recent Insights</h2>
              <button style={{ background: "none", border: "none", cursor: "pointer", fontSize: 13, color: "#7c6bf0", display: "flex", alignItems: "center", gap: 4 }}>
                View all <ArrowRight size={13} />
              </button>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 16 }}>
              {recent.slice(0, 3).map((r, i) => {
                const Icon = CARD_ICONS[i % CARD_ICONS.length];
                const [owner, name] = r.fullName.split("/");
                return (
                  <button
                    key={r.repoId}
                    onClick={() => router.push(`/repo/${r.repoId}`)}
                    style={{
                      background: "#111118", border: "1px solid #1e1e2e",
                      borderRadius: 12, padding: 20, textAlign: "left",
                      cursor: "pointer", transition: "all 0.2s",
                      display: "flex", flexDirection: "column", gap: 10,
                    }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = "#2e2e4e"; (e.currentTarget as HTMLElement).style.background = "#141420"; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = "#1e1e2e"; (e.currentTarget as HTMLElement).style.background = "#111118"; }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                      <div style={{
                        width: 36, height: 36, borderRadius: 8, background: "#1e1e2e",
                        display: "flex", alignItems: "center", justifyContent: "center",
                      }}>
                        <Icon size={16} color="#7c6bf0" />
                      </div>
                      <div>
                        <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: "#fff" }}>{name}</p>
                        <p style={{ margin: 0, fontSize: 12, color: "#4a4a5a", display: "flex", alignItems: "center", gap: 4, marginTop: 2 }}>
                          <Clock size={10} /> Analyzed {timeAgo(r.analyzedAt)}
                        </p>
                      </div>
                    </div>
                    <p style={{ margin: 0, fontSize: 13, color: "#6b6b80", lineHeight: 1.5 }}>
                      {owner}/{name} — click to view the dependency graph and AI analysis
                    </p>
                    <div style={{ display: "flex", gap: 6 }}>
                      {owner && (
                        <span style={{ fontSize: 11, color: "#7c6bf0", background: "rgba(124,107,240,0.12)", borderRadius: 4, padding: "2px 8px" }}>
                          {owner}
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </>
        )}

        {/* Empty state */}
        {recent.length === 0 && (
          <div style={{ textAlign: "center", padding: "40px 0" }}>
            <p style={{ fontSize: 14, color: "#3a3a4e" }}>No recent analyses yet. Paste a GitHub URL above to get started.</p>
          </div>
        )}
      </div>
    </div>
  );
}
