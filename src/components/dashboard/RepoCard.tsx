"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { GitBranch, Loader2, Clock, CheckCircle, ChevronRight, AlertCircle, Activity, Box, FunctionSquare, LayoutTemplate } from "lucide-react";

export interface RepoCardProps {
  id: string;
  fullName: string;
  url: string;
  status: string;
  totalFiles: number;
  parsedFiles: number;
  failedFiles: number;
  totalFunctions: number;
  totalComponents: number;
  totalEdges: number;
  createdAt: string;
}

export default function RepoCard(initialData: RepoCardProps) {
  const router = useRouter();
  const [data, setData] = useState(initialData);

  const processing = !["READY", "FAILED"].includes(data.status);
  const error = data.status === "FAILED";

  useEffect(() => {
    if (!processing && !error) return;

    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/repos/${data.id}/status`);
        const json = await res.json();
        if (json.success) {
          setData(prev => ({
            ...prev,
            status: json.status,
            totalFiles: json.stats?.totalFiles ?? prev.totalFiles,
            parsedFiles: json.stats?.parsedFiles ?? prev.parsedFiles,
            failedFiles: json.stats?.failedFiles ?? prev.failedFiles,
            totalFunctions: json.stats?.totalFunctions ?? prev.totalFunctions,
            totalComponents: json.stats?.totalComponents ?? prev.totalComponents,
            totalEdges: json.stats?.totalEdges ?? prev.totalEdges,
          }));
        }
      } catch (err) {}
    }, 2000);

    return () => clearInterval(interval);
  }, [data.id, processing, error]);

  const handleNavigate = () => {
    if (!processing && !error) {
      router.push(`/repo/${data.id}`);
    }
  };

  const timeStr = new Date(data.createdAt).toLocaleDateString(undefined, { 
    month: "short", day: "numeric", hour: "numeric", minute: "2-digit" 
  });

  const healthPercent = data.totalFiles > 0 
    ? Math.round((data.parsedFiles / data.totalFiles) * 100) 
    : 0;
    
  const isHealthy = healthPercent > 80;
  const isPartial = healthPercent > 0 && healthPercent <= 80;

  return (
    <div 
      onClick={handleNavigate}
      style={{
        background: "#161616",
        border: `1px solid ${processing ? "#2a2a2a" : "#303030"}`,
        borderRadius: 12,
        padding: "20px 24px",
        cursor: processing || error ? "default" : "pointer",
        opacity: processing ? 0.8 : 1,
        transition: "all 0.2s ease",
        position: "relative",
        overflow: "hidden",
        boxShadow: !processing && !error ? "0 4px 20px rgba(0,0,0,0.2)" : "none",
        display: "flex", flexDirection: "column"
      }}
      onMouseEnter={e => {
        if (!processing && !error) {
          const el = e.currentTarget;
          el.style.borderColor = "#ff4500";
          el.style.transform = "translateY(-2px)";
          el.style.boxShadow = "0 8px 30px rgba(255,69,0,0.15)";
        }
      }}
      onMouseLeave={e => {
        if (!processing && !error) {
          const el = e.currentTarget;
          el.style.borderColor = "#303030";
          el.style.transform = "translateY(0)";
          el.style.boxShadow = "0 4px 20px rgba(0,0,0,0.2)";
        }
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ 
            width: 40, height: 40, borderRadius: 10, 
            background: processing ? "#1e1e1e" : "rgba(255,69,0,0.1)",
            color: processing ? "#888" : "#ff4500",
            display: "flex", alignItems: "center", justifyContent: "center",
            flexShrink: 0
          }}>
            <GitBranch size={20} />
          </div>
          <div>
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: processing ? "#bbb" : "#fff", wordBreak: "break-all" }}>
              {data.fullName}
            </h3>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 4 }}>
              <span style={{ fontSize: 12, color: "#7a7a7a", fontFamily: "var(--font-mono, monospace)" }}>
                {data.url.replace(/^https?:\/\//, "")}
              </span>
            </div>
          </div>
        </div>
      </div>
      
      {/* Metrics Row */}
      {(!error) ? (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 20, flex: 1 }}>
          <div style={{ background: "#1e1e1e", borderRadius: 8, padding: "10px", display: "flex", flexDirection: "column" }}>
             <div style={{ display: "flex", alignItems: "center", gap: 6, color: "#a0a0a0", marginBottom: 6 }}>
               <Activity size={13} />
               <span style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>Health</span>
             </div>
             <span style={{ fontSize: 18, fontWeight: 700, color: processing ? "#888" : isHealthy ? "#10b981" : isPartial ? "#f59e0b" : "#ef4444" }}>
               {processing ? "--" : `${healthPercent}%`}
             </span>
             {!processing && <span style={{ fontSize: 10, color: "#666", marginTop: 2 }}>{data.failedFiles} failed</span>}
          </div>
          <div style={{ background: "#1e1e1e", borderRadius: 8, padding: "10px", display: "flex", flexDirection: "column" }}>
             <div style={{ display: "flex", alignItems: "center", gap: 6, color: "#a0a0a0", marginBottom: 6 }}>
               <Box size={13} />
               <span style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>Files</span>
             </div>
             <span style={{ fontSize: 18, fontWeight: 700, color: processing ? "#888" : "#fff" }}>
               {processing ? "--" : data.parsedFiles}
             </span>
             {!processing && <span style={{ fontSize: 10, color: "#666", marginTop: 2 }}>of {data.totalFiles} parsed</span>}
          </div>
          <div style={{ background: "#1e1e1e", borderRadius: 8, padding: "10px", display: "flex", flexDirection: "column" }}>
             <div style={{ display: "flex", alignItems: "center", gap: 6, color: "#a0a0a0", marginBottom: 6 }}>
               <LayoutTemplate size={13} />
               <span style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>Components</span>
             </div>
             <span style={{ fontSize: 18, fontWeight: 700, color: processing ? "#888" : "#fff" }}>
               {processing ? "--" : data.totalComponents}
             </span>
             {!processing && <span style={{ fontSize: 10, color: "#666", marginTop: 2 }}>found</span>}
          </div>
        </div>
      ) : (
        <div style={{ background: "rgba(239,68,68,0.05)", borderRadius: 8, padding: "12px", border: "1px dashed rgba(239,68,68,0.2)", marginBottom: 20, flex: 1, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 8 }}>
           <AlertCircle size={20} color="#ef4444" />
           <span style={{ fontSize: 13, color: "#ffaaaa", fontWeight: 500, textAlign: "center" }}>Analysis failed to complete.</span>
        </div>
      )}

      {/* Footer / Status */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", borderTop: "1px solid #2a2a2a", paddingTop: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, color: "#666", fontSize: 11 }}>
          <Clock size={12} />
          <span>{timeStr}</span>
        </div>
        
        {/* Status Indicator */}
        <div style={{ padding: "4px 10px", borderRadius: 20, background: processing || error ? "#1e1e1e" : "transparent" }}>
          {error ? (
             <div style={{ display: "flex", alignItems: "center", gap: 6, color: "#ef4444" }}>
                <AlertCircle size={14} />
                <span style={{ fontSize: 12, fontWeight: 600 }}>Failed</span>
             </div>
          ) : processing ? (
             <div style={{ display: "flex", alignItems: "center", gap: 6, color: "#ff8a50" }}>
                <Loader2 size={13} className="animate-spin" />
                <span style={{ fontSize: 12, fontWeight: 600 }}>{data.status.toLowerCase()}...</span>
             </div>
          ) : (
             <div style={{ display: "flex", alignItems: "center", gap: 4, color: "#ff4500", fontSize: 13, fontWeight: 600 }}>
                Open Workspace <ChevronRight size={14} />
             </div>
          )}
        </div>
      </div>
    </div>
  );
}
