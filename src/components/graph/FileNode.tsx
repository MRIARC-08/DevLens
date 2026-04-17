"use client";

import { memo } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";

export const FILE_TYPE_COLORS: Record<string, string> = {
  COMPONENT: "#6366f1",
  PAGE: "#f59e0b",
  SERVICE: "#10b981",
  UTILITY: "#71717a",
  HOOK: "#a855f7",
  CONTEXT: "#f97316",
  CONFIG: "#94a3b8",
  TYPE: "#ec4899",
  UNKNOWN: "#3f3f46",
};

export interface FileNodeData {
  label: string;
  filePath: string;
  fileType: string;
  functionCount: number;
  importCount: number;
  importedByCount: number;
  parseStatus: string;
  [key: string]: unknown;
}

function FileNode({ data, selected }: NodeProps) {
  const nodeData = data as FileNodeData;
  const color = FILE_TYPE_COLORS[nodeData.fileType] ?? FILE_TYPE_COLORS.UNKNOWN;

  return (
    <div
      style={{
        width: 180,
        background: "#111111",
        border: `1px solid ${selected ? "#6366f1" : "#222222"}`,
        borderRadius: 8,
        padding: "10px 12px 10px 16px",
        cursor: "pointer",
        position: "relative",
        boxShadow: selected ? "0 0 0 2px #6366f1" : "none",
        transition: "border-color 0.15s, box-shadow 0.15s",
      }}
    >
      {/* Left color bar */}
      <div
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          bottom: 0,
          width: 4,
          borderRadius: "8px 0 0 8px",
          background: color,
        }}
      />

      {/* Handles */}
      <Handle type="target" position={Position.Top} style={{ background: "#3f3f46", border: "none", width: 6, height: 6 }} />
      <Handle type="source" position={Position.Bottom} style={{ background: "#3f3f46", border: "none", width: 6, height: 6 }} />

      {/* File name */}
      <p
        style={{
          fontSize: 11,
          fontWeight: 600,
          color: "#f4f4f5",
          margin: 0,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
          maxWidth: 148,
        }}
        title={nodeData.label}
      >
        {nodeData.label}
      </p>

      {/* File type badge */}
      <span
        style={{
          display: "inline-block",
          marginTop: 4,
          fontSize: 9,
          fontWeight: 500,
          color: color,
          background: `${color}18`,
          borderRadius: 3,
          padding: "1px 5px",
          letterSpacing: "0.04em",
        }}
      >
        {nodeData.fileType}
      </span>

      {/* Stats row */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          marginTop: 8,
        }}
      >
        <span style={{ fontSize: 10, color: "#71717a" }}>
          ↓ {nodeData.importedByCount}
        </span>
        <span style={{ fontSize: 10, color: "#71717a" }}>
          ↑ {nodeData.importCount}
        </span>
      </div>
    </div>
  );
}

export default memo(FileNode);
