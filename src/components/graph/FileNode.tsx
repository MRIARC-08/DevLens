"use client";

import { memo } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import { ArrowDownToLine, ArrowUpFromLine, Braces } from "lucide-react";

// ── Color map ─────────────────────────────────────────────────────────────────

// Canonical color map — Reddit-inspired OrangeRed palette
export const FILE_TYPE_COLORS: Record<string, string> = {
  COMPONENT: "#ff4500",   // Reddit OrangeRed — primary UI building blocks
  PAGE:      "#ff6534",   // Lighter orange — route-level files
  SERVICE:   "#cc3700",   // Dark burnt orange — business logic
  UTILITY:   "#6b6b6b",   // Neutral grey — helpers
  HOOK:      "#e03d00",   // Deep orange-red — React hooks
  CONTEXT:   "#ff8c42",   // Warm amber-orange — context providers
  CONFIG:    "#555555",   // Dark grey — config files
  TYPE:      "#b33000",   // Dark red — type definitions
  UNKNOWN:   "#424242",   // Near-black — unclassified
};

// Functional helper (used by DependencyGraph & MiniMap)
export function getFileTypeColor(fileType: string): string {
  return FILE_TYPE_COLORS[fileType] ?? "#424242";
}

// ── Types ─────────────────────────────────────────────────────────────────────

export interface FileNodeData {
  label: string;
  filePath: string;
  fileType: string;
  functionCount: number;
  importCount: number;
  importedByCount: number;
  parseStatus: string;
  dimmed?: boolean;
  highlighted?: boolean;
  [key: string]: unknown;
}

// ── Stat cell ─────────────────────────────────────────────────────────────────

function StatCell({
  icon,
  value,
  label,
  hot,
  onClick,
}: {
  icon: React.ReactNode;
  value: number;
  label: string;
  hot?: boolean;
  onClick?: (e: React.MouseEvent) => void;
}) {
  const numColor = hot
    ? "#ff4500"
    : value > 0
    ? "#888888"
    : "#444444";

  return (
    <div
      onClick={onClick}
      onMouseEnter={e => { if (onClick) e.currentTarget.style.background = "rgba(255,255,255,0.05)" }}
      onMouseLeave={e => { if (onClick) e.currentTarget.style.background = "transparent" }}
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 2,
        padding: "4px 8px",
        borderRadius: 6,
        cursor: onClick ? "pointer" : "default",
        transition: "background 150ms ease",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 3,
          color: numColor,
        }}
      >
        {icon}
        <span
          style={{
            fontSize: 13,
            fontWeight: 600,
            lineHeight: 1,
            color: numColor,
          }}
        >
          {value}
        </span>
      </div>
      <span style={{ fontSize: 11, color: "#909090", lineHeight: 1 }}>
        {label}
      </span>
    </div>
  );
}

// ── Node ──────────────────────────────────────────────────────────────────────

function FileNode({ data, id }: NodeProps) {
  const nodeData = data as FileNodeData;
  const color = getFileTypeColor(nodeData.fileType);

  const handleStatClick = (section: string) => (e: React.MouseEvent) => {
    e.stopPropagation();
    window.dispatchEvent(new CustomEvent("DEV_LENS_OPEN_LEFT_CODE", {
      detail: { fileId: id, section }
    }));
  };

  const isHighlighted = !!nodeData.highlighted;
  const isDimmed = !!nodeData.dimmed;

  // Extract directory path from filePath
  const parts = nodeData.filePath.replace(/\\/g, "/").split("/");
  const dirPath =
    parts.length > 1 ? parts.slice(0, -1).join("/") : nodeData.filePath;

  const containerStyle: React.CSSProperties = {
    position: "relative",
    width: 220,
    background: isHighlighted ? "#252525" : isDimmed ? "#1a1a1a" : "#303030",
    border: `1px solid ${isHighlighted ? "#ff4500" : isDimmed ? "#282828" : "#4a4a4a"}`,
    borderRadius: 10,
    cursor: isDimmed ? "default" : "pointer",
    transition: "all 200ms cubic-bezier(0.4, 0, 0.2, 1)",
    overflow: "hidden",
    userSelect: "none",
    opacity: 1,
    filter: isDimmed ? "brightness(0.45)" : "none",
    pointerEvents: isDimmed ? "none" : "all",
    transform: isHighlighted ? "scale(1.03)" : "scale(1)",
    boxShadow: isHighlighted
      ? "0 0 0 2px rgba(255,69,0,0.3), 0 0 28px rgba(255,69,0,0.1), 0 8px 32px rgba(0,0,0,0.6)"
      : "0 2px 8px rgba(0,0,0,0.5)",
    zIndex: isHighlighted ? 10 : 1,
  };

  return (
    <div style={containerStyle}>
      {/* Left handle — incoming deps */}
      <Handle
        type="target"
        position={Position.Left}
        style={{
          background: isHighlighted ? "#ff4500" : "#4a4a4a",
          border: "2px solid #303030",
          width: 8,
          height: 8,
          left: -4,
        }}
      />

      {/* Right handle — outgoing deps */}
      <Handle
        type="source"
        position={Position.Right}
        style={{
          background: isHighlighted ? "#ff4500" : "#4a4a4a",
          border: "2px solid #303030",
          width: 8,
          height: 8,
          right: -4,
        }}
      />

      {/* Top color bar */}
      <div
        style={{
          height: 3,
          width: "100%",
          background: color,
          flexShrink: 0,
        }}
      />

      {/* Header */}
      <div style={{ padding: "10px 12px 8px" }}>
        {/* Row 1: filename + badge */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 6,
          }}
        >
          <span
            style={{
              fontSize: 14,
              fontWeight: 600,
              color: "#ffffff",
              fontFamily: "var(--font-mono, 'JetBrains Mono', monospace)",
              maxWidth: 140,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
              flexShrink: 1,
            }}
            title={nodeData.label}
          >
            {nodeData.label}
          </span>

          <span
            style={{
              fontSize: 10,
              fontWeight: 500,
              padding: "2px 6px",
              borderRadius: 4,
              background: `${color}26`,
              color: color,
              textTransform: "uppercase",
              letterSpacing: "0.05em",
              flexShrink: 0,
              whiteSpace: "nowrap",
            }}
          >
            {nodeData.fileType.toLowerCase()}
          </span>
        </div>

        {/* Row 2: directory path */}
        <div
          style={{
            marginTop: 3,
            fontSize: 12,
            color: "#909090",
            fontFamily: "var(--font-mono, 'JetBrains Mono', monospace)",
            overflow: "hidden",
            whiteSpace: "nowrap",
            textOverflow: "ellipsis",
          }}
          title={dirPath}
        >
          {dirPath}
        </div>
      </div>

      {/* Divider */}
      <div style={{ height: 1, background: "#303030", margin: "0 12px" }} />

      {/* Stats section */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          padding: "7px 12px",
        }}
      >
        <StatCell
          icon={<ArrowDownToLine size={9} />}
          value={nodeData.importedByCount}
          label="imports"
          hot={nodeData.importedByCount > 5}
          onClick={handleStatClick("imports")}
        />
        <StatCell
          icon={<ArrowUpFromLine size={9} />}
          value={nodeData.importCount}
          label="uses"
          onClick={handleStatClick("uses")}
        />
        <StatCell
          icon={<Braces size={9} />}
          value={nodeData.functionCount}
          label="fns"
          onClick={handleStatClick("fns")}
        />
      </div>
    </div>
  );
}

export default memo(FileNode);
