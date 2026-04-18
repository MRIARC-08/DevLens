"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Plus, Link2, Code2, Loader2, Search } from "lucide-react";
import RepoCard, { RepoCardProps } from "@/components/dashboard/RepoCard";

const GITHUB_RE = /^https:\/\/github\.com\/[\w.-]+\/[\w.-]+/;

export default function DashboardPage() {
  const router = useRouter();
  const [repos, setRepos] = useState<RepoCardProps[]>([]);
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [techStackError, setTechStackError] = useState(false);
  const [fetchingRepos, setFetchingRepos] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  const filteredRepos = repos.filter(repo =>
    repo.fullName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  useEffect(() => {
    async function fetchRepos() {
      try {
        const res = await fetch("/api/repos");
        if (res.ok) {
          const json = await res.json();
          if (json.success) {
            setRepos(json.repos);
          }
        }
      } catch (err) {}
      setFetchingRepos(false);
    }
    fetchRepos();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setTechStackError(false);
    const trimmed = url.trim();
    const match = trimmed.match(GITHUB_RE);
    if (!match) { 
      setError("Please enter a valid GitHub repository URL"); 
      return; 
    }
    
    setLoading(true);
    try {
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

      const res = await fetch("/api/repos/analyze", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: trimmed }),
      });
      const data = await res.json();
      if (!data.success) { 
        setError(data.error ?? "Something went wrong"); 
        setLoading(false); 
        return; 
      }
      
      const newRepo = {
        id: data.repoId,
        fullName: exMatch ? `${exMatch[1]}/${exMatch[2]}` : trimmed,
        url: trimmed,
        status: "PENDING",
        totalFiles: 0,
        parsedFiles: 0,
        failedFiles: 0,
        totalFunctions: 0,
        totalComponents: 0,
        totalEdges: 0,
        createdAt: new Date().toISOString()
      };
      
      // Merge optimistic update into repos list
      setRepos(prev => [newRepo, ...prev.filter(r => r.id !== newRepo.id)]);
      setUrl("");
      setLoading(false);
    } catch { 
      setError("Failed to connect. Please try again."); 
      setLoading(false); 
    }
  }

  return (
    <div style={{ minHeight: "100vh", background: "#161616", color: "#e0e0e0", fontFamily: "var(--font-sans)" }}>
      {/* Navbar */}
      <nav style={{
        position: "sticky", top: 0, zIndex: 100, height: 64,
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "0 40px", background: "rgba(22,22,22,0.85)",
        backdropFilter: "blur(16px)",
        borderBottom: "1px solid #303030",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 32 }}>
          <button 
            onClick={() => router.push("/")}
            style={{ 
              display: "flex", alignItems: "center", gap: 8, background: "none", 
              border: "none", color: "#a0a0a0", cursor: "pointer", fontSize: 14, fontWeight: 500
            }}
            onMouseEnter={e => e.currentTarget.style.color = "#fff"}
            onMouseLeave={e => e.currentTarget.style.color = "#a0a0a0"}
          >
            <ArrowLeft size={16} /> Home
          </button>
          <div style={{ width: 1, height: 24, background: "#303030" }} />
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{
              width: 28, height: 28, borderRadius: 8, background: "#ff4500",
              display: "flex", alignItems: "center", justifyContent: "center"
            }}>
              <Code2 size={14} color="#fff" strokeWidth={2.5} />
            </div>
            <span style={{ fontSize: 16, fontWeight: 700, color: "#fff", letterSpacing: "-0.5px" }}>
              Dev<span style={{ color: "#ff4500" }}>Lens</span> Dashboard
            </span>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main style={{ maxWidth: 1000, margin: "0 auto", padding: "60px 40px 100px" }}>
        <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginBottom: 40, flexWrap: "wrap", gap: 16 }}>
          <div>
            <h1 style={{ margin: 0, fontSize: 32, fontWeight: 800, color: "#fff", letterSpacing: "-0.02em" }}>
              Your Workspaces
            </h1>
            <p style={{ margin: "8px 0 0", fontSize: 16, color: "#909090" }}>
              Analyze new repositories or continue where you left off.
            </p>
          </div>
          
          {repos.length > 0 && (
            <div style={{ 
              display: "flex", alignItems: "center", background: "#1e1e1e", 
              border: "1px solid #303030", borderRadius: 8, padding: "0 12px", 
              width: "100%", maxWidth: 320, transition: "border-color 0.2s" 
            }}
            onFocus={e => e.currentTarget.style.borderColor = "rgba(255,69,0,0.4)"}
            onBlur={e => e.currentTarget.style.borderColor = "#303030"}>
              <Search size={16} color="#7a7a7a" />
              <input 
                type="text" 
                placeholder="Search workspaces by name..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  background: "none", border: "none", outline: "none", color: "#fff", 
                  fontSize: 14, padding: "12px 8px", width: "100%"
                }}
              />
            </div>
          )}
        </div>

        {/* New Analysis Input */}
        <div style={{ 
          background: "#1e1e1e", border: "1px solid #303030", borderRadius: 16, 
          padding: 24, marginBottom: 48, boxShadow: "0 4px 20px rgba(0,0,0,0.2)"
        }}>
          <form onSubmit={handleSubmit}>
            <div style={{ display: "flex", gap: 12 }}>
              <div style={{
                flex: 1, display: "flex", alignItems: "center", gap: 12,
                background: "#161616", border: `1px solid ${error || techStackError ? "#ef4444" : "#303030"}`,
                borderRadius: 10, padding: "0 16px", transition: "border-color 0.2s",
              }}
              onFocus={e => { if (!error && !techStackError) (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,69,0,0.4)"; }}
              onBlur={e => { if (!error && !techStackError) (e.currentTarget as HTMLElement).style.borderColor = "#303030"; }}
              >
                <Link2 size={18} color="#7a7a7a" />
                <input
                  type="text" value={url}
                  onChange={(e) => { setUrl(e.target.value); setError(""); setTechStackError(false); }}
                  placeholder="Paste GitHub URL to analyze..."
                  disabled={loading}
                  style={{
                    flex: 1, background: "none", border: "none", outline: "none",
                    color: "#fff", fontSize: 15, padding: "16px 0",
                    fontFamily: "var(--font-mono, monospace)",
                  }}
                />
              </div>
              <button
                type="submit" disabled={loading || !url.trim()}
                style={{
                  background: "#ff4500", color: "#fff", border: "none",
                  borderRadius: 10, padding: "0 28px", fontSize: 15, fontWeight: 600,
                  cursor: loading || !url.trim() ? "default" : "pointer",
                  opacity: loading || !url.trim() ? 0.6 : 1,
                  display: "flex", alignItems: "center", gap: 8,
                  transition: "background 0.2s"
                }}
              >
                {loading ? <Loader2 size={18} className="animate-spin" /> : <Plus size={18} />}
                Analyze
              </button>
            </div>
            {error && <p style={{ margin: "10px 0 0 12px", color: "#ef4444", fontSize: 13 }}>{error}</p>}
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

        {/* Grid of Repos */}
        {fetchingRepos ? (
          <div style={{ display: "flex", justifyContent: "center", padding: "60px 0" }}>
             <Loader2 size={32} color="#555" className="animate-spin" />
          </div>
        ) : repos.length === 0 ? (
          <div style={{ 
            padding: "60px 0", textAlign: "center", border: "1px dashed #303030", 
            borderRadius: 16, background: "rgba(30,30,30,0.3)" 
          }}>
            <Code2 size={40} color="#424242" style={{ margin: "0 auto 16px" }} />
            <h3 style={{ margin: 0, fontSize: 18, color: "#a0a0a0", fontWeight: 500 }}>No repositories analyzed yet</h3>
            <p style={{ margin: "8px 0 0", color: "#7a7a7a", fontSize: 14 }}>
              Paste a URL above to start your first analysis.
            </p>
          </div>
        ) : filteredRepos.length === 0 ? (
          <div style={{ 
            padding: "60px 0", textAlign: "center", border: "1px dashed #303030", 
            borderRadius: 16, background: "rgba(30,30,30,0.3)" 
          }}>
            <Search size={40} color="#424242" style={{ margin: "0 auto 16px" }} />
            <h3 style={{ margin: 0, fontSize: 18, color: "#a0a0a0", fontWeight: 500 }}>No workspaces found</h3>
            <p style={{ margin: "8px 0 0", color: "#7a7a7a", fontSize: 14 }}>
              No repositories match your search query "{searchQuery}".
            </p>
          </div>
        ) : (
          <div style={{ 
            display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(440px, 1fr))", 
            gap: 20 
          }}>
            {filteredRepos.map(repo => (
              <RepoCard key={repo.id} {...repo} />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
