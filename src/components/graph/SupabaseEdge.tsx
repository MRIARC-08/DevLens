import { memo, useState, useCallback, useEffect, useRef } from "react";
import {
  getBezierPath,
  EdgeLabelRenderer,
  type EdgeProps,
} from "@xyflow/react";
import { Loader2, Sparkles, X, ChevronRight, Info } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

/**
 * SupabaseEdge
 *
 * Dashed bezier edge with marching-ants animation + hover tooltip.
 * Shows a descriptive popup at the midpoint when hovered.
 * Expands on click to show an AI-powered relationship analysis.
 */
function SupabaseEdge({
  id,
  sourceX, sourceY,
  targetX, targetY,
  sourcePosition,
  targetPosition,
  data,
  selected,
}: EdgeProps) {
  const [hovered, setHovered] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [explanation, setExplanation] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const tooltipRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!expanded) return;
    const onMouseDown = (e: MouseEvent) => {
      if (tooltipRef.current && !tooltipRef.current.contains(e.target as Node)) {
        setExpanded(false);
      }
    };
    document.addEventListener("mousedown", onMouseDown);
    return () => document.removeEventListener("mousedown", onMouseDown);
  }, [expanded]);

  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX, sourceY, sourcePosition,
    targetX, targetY, targetPosition,
    curvature: 0.25,
  });

  const d = data as Record<string, unknown> | undefined;
  const isHighlighted = !!d?.highlighted || !!selected;
  const isDimmed      = !!d?.dimmed;
  const importRaw     = (d?.importRaw as string | undefined) ?? "";
  const sourcePath    = (d?.sourcePath as string | undefined) ?? "";
  const targetPath    = (d?.targetPath as string | undefined) ?? "";
  const repoId        = (d?.repoId as string | undefined) ?? "";

  const stroke     = isHighlighted ? "#ff4500"  : isDimmed ? "#2a2a2a" : "#aaaaaa";
  const strokeW    = isHighlighted ? 2          : isDimmed ? 1         : 1;
  const dashArray  = isHighlighted ? "6 3"      : "4 6";
  const opacity    = isDimmed      ? 0.7        : isHighlighted ? 1 : 0.45;
  const marchClass = isHighlighted ? "edge-march-fast" : isDimmed ? undefined : "edge-march";

  // Show tooltip if hovered OR expanded
  const showTooltip = (hovered || expanded) && !isDimmed && !!importRaw;

  const handleExpand = useCallback(async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (expanded) {
      setExpanded(false);
      return;
    }
    
    setExpanded(true);
    if (!explanation && !loading) {
      setLoading(true);
      try {
        const res = await fetch(`/api/repos/${repoId}/explain-relation`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sourcePath, targetPath, importRaw }),
        });
        const data = await res.json();
        if (data.success) {
          setExplanation(data.explanation);
        } else {
          setExplanation("Failed to generate insight. Please try again later.");
        }
      } catch (err) {
        setExplanation("Error connecting to intelligence service.");
      } finally {
        setLoading(false);
      }
    }
  }, [expanded, explanation, loading, repoId, sourcePath, targetPath, importRaw]);

  return (
    <>
      {/* Glow under-path — only when highlighted */}
      {isHighlighted && (
        <path
          d={edgePath}
          fill="none"
          stroke="#ff4500"
          strokeWidth={10}
          opacity={0.08}
          strokeLinecap="round"
        />
      )}

      {/* Invisible wider hit-area for hover & click */}
      <path
        d={edgePath}
        fill="none"
        stroke="transparent"
        strokeWidth={18}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        onClick={handleExpand}
        style={{ cursor: isDimmed ? "default" : "pointer" }}
      />

      {/* Dashed animated path */}
      <path
        id={id}
        d={edgePath}
        fill="none"
        stroke={stroke}
        strokeWidth={strokeW}
        strokeDasharray={dashArray}
        strokeLinecap="round"
        opacity={opacity}
        className={isDimmed ? undefined : marchClass}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        onClick={handleExpand}
      />

      {/* Edge tooltip via EdgeLabelRenderer (renders outside SVG) */}
      {showTooltip && (
        <EdgeLabelRenderer>
          <div
            ref={tooltipRef}
            onClick={(e) => e.stopPropagation()}
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
            style={{
              position: "absolute",
              transform: `translate(-50%, -100%) translate(${labelX}px, ${labelY - 10}px)`,
              pointerEvents: "all",
              zIndex: expanded ? 9999 : 1000,
              cursor: "default",
            }}
          >
            <div
              style={{
                background: "#0d0d0d",
                border: `1px solid ${expanded ? "#ff4500" : "#303030"}`,
                borderRadius: 12,
                padding: 0, // Padding handled by children
                display: "flex",
                flexDirection: "column",
                boxShadow: expanded 
                  ? "0 12px 48px rgba(0,0,0,0.9), 0 0 0 1px rgba(255,69,0,0.2)"
                  : "0 8px 32px rgba(0,0,0,0.8), 0 0 0 1px rgba(255,69,0,0.1)",
                width: expanded ? 400 : 280,
                maxHeight: expanded ? 480 : 120,
                backdropFilter: "blur(12px)",
                transition: "all 300ms cubic-bezier(0.16, 1, 0.3, 1)",
                overflow: "hidden",
                position: "relative",
              }}
            >
              {/* Header — Fixed */}
              <div style={{ 
                padding: expanded ? "16px 16px 12px" : "10px 14px", 
                borderBottom: expanded ? "1px solid #222" : "none",
                display: "flex", flexDirection: "column", gap: 3,
                background: "#0d0d0d", zIndex: 10
              }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "#ffffff", overflow: "hidden", textOverflow: "ellipsis", flex: 1 }}>
                    {(d?.sourceLabel as string) || "Source"}
                  </div>
                  {expanded && (
                    <button 
                      onClick={() => setExpanded(false)}
                      style={{ background: "none", border: "none", color: "#666", cursor: "pointer", display: "flex", padding: 2 }}
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ fontSize: 10, color: "#ff4500", textTransform: "uppercase", fontWeight: 700, letterSpacing: "0.05em" }}>imports</span>
                  <span style={{ fontSize: 12, color: "#e0e0e0", fontWeight: 500 }}>{(d?.targetLabel as string) || "Target"}</span>
                </div>
              </div>

              {/* Scrollable Content Area */}
              <div style={{ 
                flex: expanded ? 1 : "unset",
                overflowY: expanded ? "auto" : "hidden",
                padding: expanded ? "0 16px" : "0 14px 10px",
                display: "flex",
                flexDirection: "column",
                gap: 12,
                minHeight: 0
              }}>
                {!expanded && (
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 4 }}>
                     <div style={{ 
                      padding: "4px 8px", 
                      background: "rgba(0,0,0,0.3)", 
                      borderRadius: 4,
                      fontSize: 10,
                      color: "#7a7a7a",
                      fontFamily: "var(--font-mono, monospace)",
                      border: "1px solid rgba(255,69,0,0.05)",
                      overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1, marginRight: 8
                    }}>
                      {importRaw}
                    </div>
                    <div 
                      onClick={handleExpand}
                      style={{ 
                        display: "flex", alignItems: "center", gap: 4, 
                        color: "#ff4500", fontSize: 10, fontWeight: 600, 
                        cursor: "pointer", opacity: 0.8 
                      }}
                    >
                      AI INSIGHT <ChevronRight size={10} />
                    </div>
                  </div>
                )}

                {expanded && (
                  <>
                    {/* Metadata bit */}
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 16 }}>
                      <Info size={12} color="#555" />
                      <span style={{ fontSize: 11, color: "#666", fontFamily: "var(--font-mono)" }}>
                        {sourcePath.split('/').slice(0, -1).join('/') || 'root'} context
                      </span>
                    </div>

                    {/* AI Explanation Area */}
                    <div style={{ 
                      background: "rgba(255,69,0,0.02)", 
                      borderRadius: 8, 
                      border: "1px solid rgba(255,69,0,0.08)",
                      padding: "16px",
                      position: "relative",
                      marginBottom: 12
                    }}>
                      {loading ? (
                        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 10, padding: "20px 0" }}>
                          <Loader2 size={24} className="animate-spin" color="#ff4500" opacity={0.6} />
                          <span style={{ fontSize: 12, color: "#888", fontWeight: 500 }}>Analyzing architecture impact...</span>
                        </div>
                      ) : (
                        <div className="md-body" style={{ fontSize: 13.5, color: "#d0d0d0", lineHeight: 1.6 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 12, color: "#ff4500" }}>
                             <Sparkles size={14} />
                             <span style={{ fontWeight: 700, fontSize: 10, textTransform: "uppercase", letterSpacing: "0.05em" }}>Intelligence Insight</span>
                          </div>
                          <ReactMarkdown remarkPlugins={[remarkGfm]}>
                            {explanation || ""}
                          </ReactMarkdown>
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>

              {/* Footer — Fixed when expanded */}
              {expanded && (
                <div style={{ 
                  padding: "12px 16px", 
                  background: "#080808", 
                  borderTop: "1px solid #222",
                  fontSize: 11,
                  color: "#888",
                  fontFamily: "var(--font-mono, monospace)"
                }}>
                  <div style={{ fontSize: 9, color: "#444", marginBottom: 4, textTransform: "uppercase", fontWeight: 700, letterSpacing: "0.05em" }}>Import Statement</div>
                  <div style={{ wordBreak: "break-all", opacity: 0.8 }}>{importRaw}</div>
                </div>
              )}
            </div>
            {/* Caret */}
            {!expanded && (
               <div
               style={{
                 width: 0,
                 height: 0,
                 borderLeft: "5px solid transparent",
                 borderRight: "5px solid transparent",
                 borderTop: "5px solid #ff4500",
                 margin: "0 auto",
               }}
             />
            )}
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
}

export default memo(SupabaseEdge);
