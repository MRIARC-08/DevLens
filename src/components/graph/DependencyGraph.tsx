"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import {
  ReactFlow,
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  type Node,
  type Edge,
  type NodeTypes,
  type NodeMouseHandler,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import dagre from "@dagrejs/dagre";
import { Loader2, AlertCircle, GitBranch } from "lucide-react";
import FileNode, { FILE_TYPE_COLORS, type FileNodeData } from "./FileNode";

// ── Dagre auto-layout ────────────────────────────────────────────────────────

const NODE_W = 180;
const NODE_H = 80;

function getLayoutedElements(nodes: Node[], edges: Edge[]) {
  const g = new dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({ rankdir: "TB", nodesep: 80, ranksep: 100, marginx: 40, marginy: 40 });

  nodes.forEach((n) => g.setNode(n.id, { width: NODE_W, height: NODE_H }));
  edges.forEach((e) => g.setEdge(e.source, e.target));

  dagre.layout(g);

  return {
    nodes: nodes.map((n) => {
      const pos = g.node(n.id);
      return { ...n, position: { x: pos.x - NODE_W / 2, y: pos.y - NODE_H / 2 } };
    }),
    edges,
  };
}

// ── Type map ─────────────────────────────────────────────────────────────────

const NODE_TYPES: NodeTypes = { fileNode: FileNode };

const DEFAULT_EDGE_OPTIONS = {
  type: "smoothstep" as const,
  style: { stroke: "#3f3f46", strokeWidth: 1 },
  animated: false,
};

// ── Component ────────────────────────────────────────────────────────────────

interface DependencyGraphProps {
  repoId: string;
  selectedFileId: string | null;
  onNodeClick: (fileId: string) => void;
}

interface GraphApiResponse {
  success: boolean;
  nodes: Node<FileNodeData>[];
  edges: Edge[];
}

export default function DependencyGraph({
  repoId,
  selectedFileId,
  onNodeClick,
}: DependencyGraphProps) {
  const [rawNodes, setRawNodes] = useState<Node[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch and layout graph data
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    fetch(`/api/repos/${repoId}/graph`)
      .then((r) => r.json())
      .then((data: GraphApiResponse) => {
        if (cancelled) return;
        if (!data.success) throw new Error("Failed to load graph");

        const { nodes: ln, edges: le } = getLayoutedElements(
          data.nodes.map((n) => ({ ...n, type: "fileNode" })),
          data.edges
        );
        setRawNodes(ln);
        setEdges(le);
      })
      .catch((e) => {
        if (!cancelled) setError(e.message ?? "Failed to load graph");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [repoId]);

  // Sync selection state onto nodes
  const nodes = useMemo(
    () =>
      rawNodes.map((n) => ({
        ...n,
        selected: n.id === selectedFileId,
      })),
    [rawNodes, selectedFileId]
  );

  const handleNodeClick: NodeMouseHandler = useCallback(
    (_evt: React.MouseEvent, node: Node) => {
      onNodeClick(node.id);
    },
    [onNodeClick]
  );

  const miniMapNodeColor = useCallback((node: Node) => {
    const ft = (node.data as FileNodeData)?.fileType ?? "UNKNOWN";
    return FILE_TYPE_COLORS[ft] ?? FILE_TYPE_COLORS.UNKNOWN;
  }, []);

  // ── States ──────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-3 bg-[#0a0a0a]">
        <Loader2 size={28} className="text-indigo-400 animate-spin" />
        <p className="text-sm text-[#71717a]">Loading graph...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-3 bg-[#0a0a0a]">
        <AlertCircle size={28} className="text-red-400" />
        <p className="text-sm text-red-400">{error}</p>
      </div>
    );
  }

  if (nodes.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-3 bg-[#0a0a0a]">
        <GitBranch size={28} className="text-[#3f3f46]" />
        <p className="text-sm text-[#52525b]">No files found in this repository</p>
      </div>
    );
  }

  // ── React Flow ──────────────────────────────────────────────────────────

  return (
    <div className="flex-1 h-full">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={NODE_TYPES}
        onNodeClick={handleNodeClick}
        defaultEdgeOptions={DEFAULT_EDGE_OPTIONS}
        fitView
        fitViewOptions={{ padding: 0.1 }}
        minZoom={0.05}
        maxZoom={2}
        proOptions={{ hideAttribution: true }}
      >
        <Background
          variant={BackgroundVariant.Dots}
          color="#2a2a2a"
          gap={20}
          size={1}
          style={{ background: "#0a0a0a" }}
        />

        <Controls position="bottom-left" />

        <MiniMap
          position="bottom-right"
          nodeColor={miniMapNodeColor}
          maskColor="rgba(0,0,0,0.75)"
          style={{ background: "#111111", border: "1px solid #222222" }}
        />
      </ReactFlow>
    </div>
  );
}
