"use client";

import {
  useEffect,
  useCallback,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ReactFlow,
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  useReactFlow,
  ReactFlowProvider,
  Panel,
  type Node,
  type Edge,
  type NodeTypes,
  type EdgeTypes,
  type NodeMouseHandler,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import dagre from "@dagrejs/dagre";
import { AlertCircle, GitBranch, RotateCcw } from "lucide-react";
import FileNode, {
  getFileTypeColor,
  type FileNodeData,
} from "./FileNode";
import SupabaseEdge from "./SupabaseEdge";
import GraphLegend from "./GraphLegend";
import GraphControls from "./GraphControls";

// ── Layout ────────────────────────────────────────────────────────────────────

const NODE_W = 220;
const NODE_H = 90;

function getLayoutedElements(nodes: Node[], edges: Edge[]) {
  const g = new dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({
    rankdir: "LR",
    nodesep: 60,
    ranksep: 120,
    marginx: 60,
    marginy: 60,
  });

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

// ── Find the "root" node ──────────────────────────────────────────────────────
// Root = node with 0 incoming deps (importedByCount = 0) and max outgoing deps.
// Falls back to node with most outgoing deps if none have 0 incoming.

function findRootNodeId(nodes: Node[], edges: Edge[]): string | null {
  if (nodes.length === 0) return null;

  // Count outgoing edges per node
  const outgoing = new Map<string, number>();
  const incoming = new Map<string, number>();
  nodes.forEach((n) => { outgoing.set(n.id, 0); incoming.set(n.id, 0); });
  edges.forEach((e) => {
    outgoing.set(e.source, (outgoing.get(e.source) ?? 0) + 1);
    incoming.set(e.target, (incoming.get(e.target) ?? 0) + 1);
  });

  // Prefer entry points (0 incoming) sorted by most outgoing
  const entryPoints = nodes
    .filter((n) => (incoming.get(n.id) ?? 0) === 0)
    .sort((a, b) => (outgoing.get(b.id) ?? 0) - (outgoing.get(a.id) ?? 0));

  if (entryPoints.length > 0) return entryPoints[0].id;

  // Fallback: node with most outgoing edges
  return nodes.sort(
    (a, b) => (outgoing.get(b.id) ?? 0) - (outgoing.get(a.id) ?? 0)
  )[0].id;
}

// ── Node / edge types ─────────────────────────────────────────────────────────

const NODE_TYPES: NodeTypes = { fileNode: FileNode };
const EDGE_TYPES: EdgeTypes = { supabaseEdge: SupabaseEdge };

const DEFAULT_EDGE_OPTIONS = {
  type: "supabaseEdge" as const,
  animated: false,
  data: { highlighted: false, dimmed: false },
};

// ── API types ─────────────────────────────────────────────────────────────────

interface GraphApiResponse {
  success: boolean;
  nodes: Node<FileNodeData>[];
  edges: Edge[];
}

// ── Smooth focus helper ───────────────────────────────────────────────────────
// Smoothly pans + zooms React Flow viewport to center on a specific node.

function useFocusNode() {
  const { setCenter } = useReactFlow();

  return useCallback(
    (node: Node, zoom = 1.1, duration = 700) => {
      const cx = node.position.x + NODE_W / 2;
      const cy = node.position.y + NODE_H / 2;
      setCenter(cx, cy, { zoom, duration });
    },
    [setCenter]
  );
}

// ── Inner graph ───────────────────────────────────────────────────────────────

interface InnerGraphProps {
  repoId: string;
  selectedFileId: string | null;
  onNodeClick: (id: string) => void;
}

function InnerGraph({ repoId, selectedFileId, onNodeClick }: InnerGraphProps) {
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const rawEdgesRef = useRef<Edge[]>([]);
  const rawNodesRef = useRef<Node[]>([]);
  const initialFocusDone = useRef(false);
  const prevSelectedId = useRef<string | null>(null);

  const { fitView, zoomIn, zoomOut } = useReactFlow();
  const focusNode = useFocusNode();

  // ── Keyboard shortcuts ──────────────────────────────────────────────────
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement)?.tagName?.toLowerCase();
      if (tag === "input" || tag === "textarea") return;

      if (e.key === "f" || e.key === "F") {
        e.preventDefault();
        fitView({ padding: 0.15, duration: 600 });
      }
      if (e.key === "Escape") onNodeClick("");
      if (e.key === "+" || e.key === "=") zoomIn({ duration: 200 });
      if (e.key === "-") zoomOut({ duration: 200 });
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [fitView, zoomIn, zoomOut, onNodeClick]);

  // ── Fetch graph ─────────────────────────────────────────────────────────
  const loadGraph = useCallback(() => {
    setLoading(true);
    setError(null);
    initialFocusDone.current = false;

    fetch(`/api/repos/${repoId}/graph`)
      .then((r) => r.json())
      .then((data: GraphApiResponse) => {
        if (!data.success) throw new Error("Failed to load graph");

        const nodeLabels = new Map(data.nodes.map(n => [n.id, n.data.label]));
        const nodePaths  = new Map(data.nodes.map(n => [n.id, n.data.filePath]));

        const { nodes: ln, edges: le } = getLayoutedElements(
          data.nodes.map((n) => ({
            ...n,
            type: "fileNode",
            data: { ...n.data, dimmed: false, highlighted: false },
          })),
          data.edges.map(e => ({
            ...e,
            data: {
              ...(e.data as object || {}),
              repoId,
              sourceLabel: nodeLabels.get(e.source) || "unknown",
              targetLabel: nodeLabels.get(e.target) || "unknown",
              sourcePath:  nodePaths.get(e.source) || "",
              targetPath:  nodePaths.get(e.target) || "",
            }
          }))
        );

        rawEdgesRef.current = le;
        rawNodesRef.current = ln;
        setNodes(ln);
        setEdges(le);
      })
      .catch((e) => setError(e.message ?? "Failed to load graph"))
      .finally(() => setLoading(false));
  }, [repoId, setNodes, setEdges]);

  useEffect(() => { loadGraph(); }, [loadGraph]);

  // ── Initial focus on root node ──────────────────────────────────────────
  // Runs once after nodes are loaded — centers on the root file at zoom 1.1
  useEffect(() => {
    if (loading || initialFocusDone.current || rawNodesRef.current.length === 0) return;
    initialFocusDone.current = true;

    const rootId = findRootNodeId(rawNodesRef.current, rawEdgesRef.current);
    if (!rootId) return;

    const rootNode = rawNodesRef.current.find((n) => n.id === rootId);
    if (!rootNode) return;

    // Small delay to let React Flow mount and measure
    setTimeout(() => {
      focusNode(rootNode, 1.1, 800);
    }, 150);
  }, [loading, focusNode]);

  // ── Pan to selected node when selectedFileId changes ───────────────────
  useEffect(() => {
    const allEdges = rawEdgesRef.current;
    const allNodes = rawNodesRef.current;

    if (!selectedFileId) {
      // Reset all state
      prevSelectedId.current = null;
      setNodes((nds) =>
        nds.map((n) => ({
          ...n,
          selected: false,
          data: { ...n.data, dimmed: false, highlighted: false },
        }))
      );
      // Reset edges — clear highlighted/dimmed flags
      setEdges(
        allEdges.map((e) => ({
          ...e,
          data: { ...((e.data as object) ?? {}), highlighted: false, dimmed: false },
        }))
      );
      return;
    }

    // Skip if same node re-selected
    if (prevSelectedId.current === selectedFileId) return;
    prevSelectedId.current = selectedFileId;

    // ── Smooth pan to the selected node ──
    const targetNode = allNodes.find((n) => n.id === selectedFileId);
    if (targetNode) {
      // Slight delay so state updates don't fight the animation
      setTimeout(() => focusNode(targetNode, 1.2, 650), 50);
    }

    // ── Highlight graph ──
    const connectedEdgeIds = new Set(
      allEdges
        .filter((e) => e.source === selectedFileId || e.target === selectedFileId)
        .map((e) => e.id)
    );
    const connectedNodeIds = new Set<string>([selectedFileId]);
    allEdges.forEach((e) => {
      if (e.source === selectedFileId) connectedNodeIds.add(e.target);
      if (e.target === selectedFileId) connectedNodeIds.add(e.source);
    });

    setNodes((nds) =>
      nds.map((n) => ({
        ...n,
        selected: n.id === selectedFileId,
        data: {
          ...n.data,
          dimmed: !connectedNodeIds.has(n.id),
          highlighted: n.id === selectedFileId,
        },
      }))
    );

    // Update edges — highlighted connected ones, dim everything else
    setEdges(
      allEdges.map((e) => ({
        ...e,
        data: {
          ...((e.data as object) ?? {}),
          highlighted: connectedEdgeIds.has(e.id),
          dimmed: !connectedEdgeIds.has(e.id),
        },
      }))
    );
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedFileId]);

  const handleNodeClick: NodeMouseHandler = useCallback(
    (_evt, node) => { onNodeClick(node.id); },
    [onNodeClick]
  );

  const handlePaneClick = useCallback(() => { onNodeClick(""); }, [onNodeClick]);
  const handleNodeDoubleClick = useCallback(() => {}, []);

  const presentFileTypes = useMemo(() => {
    const types = new Set<string>();
    nodes.forEach((n) => {
      const ft = (n.data as FileNodeData)?.fileType;
      if (ft) types.add(ft);
    });
    return Array.from(types).sort();
  }, [nodes]);

  const miniMapNodeColor = useCallback(
    (node: Node) => getFileTypeColor((node.data as FileNodeData)?.fileType ?? "UNKNOWN"),
    []
  );

  const nodeCount = nodes.length;
  const edgeCount = rawEdgesRef.current.length;
  const selectedNode = nodes.find((n) => n.id === selectedFileId);
  const selectedLabel = (selectedNode?.data as FileNodeData | undefined)?.label;

  // ── Loading ──────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div style={{
        width: "100%", height: "100%", background: "#252525",
        display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center", gap: 16,
      }}>
        <div style={{ position: "relative", width: 52, height: 52 }}>
          <div style={{
            position: "absolute", inset: 0, borderRadius: "50%",
            border: "2px solid #323232",
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
            <GitBranch size={20} color="#ff4500" />
          </div>
        </div>
        <div style={{ textAlign: "center" }}>
          <p style={{ margin: 0, fontSize: 15, fontWeight: 600, color: "#ffffff" }}>
            Building dependency graph
          </p>
          <p style={{ margin: "4px 0 0", fontSize: 13, color: "#909090" }}>
            Mapping file relationships...
          </p>
        </div>
      </div>
    );
  }

  // ── Error ────────────────────────────────────────────────────────────────

  if (error) {
    return (
      <div style={{
        width: "100%", height: "100%", background: "#252525",
        display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center", gap: 12,
      }}>
        <div style={{
          width: 44, height: 44, borderRadius: "50%",
          background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.15)",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <AlertCircle size={20} color="#ef4444" />
        </div>
        <p style={{ margin: 0, fontSize: 15, fontWeight: 600, color: "#f87171" }}>{error}</p>
        <button
          onClick={loadGraph}
          style={{
            display: "flex", alignItems: "center", gap: 6,
            background: "#4a4a4a", border: "1px solid #4a4a4a",
            borderRadius: 6, color: "#cccccc", fontSize: 13,
            padding: "6px 14px", cursor: "pointer",
          }}
        >
          <RotateCcw size={12} /> Retry
        </button>
      </div>
    );
  }

  if (nodeCount === 0) {
    return (
      <div style={{
        width: "100%", height: "100%", background: "#252525",
        display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center", gap: 10,
      }}>
        <GitBranch size={28} color="#4a4a4a" />
        <p style={{ margin: 0, fontSize: 15, fontWeight: 500, color: "#4a4a4a" }}>
          No dependency relationships found
        </p>
        <p style={{ margin: 0, fontSize: 13, color: "#4a4a4a", maxWidth: 280, textAlign: "center" }}>
          This may be a config-only or very small repository
        </p>
      </div>
    );
  }

  // ── Graph ────────────────────────────────────────────────────────────────

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      nodeTypes={NODE_TYPES}
      edgeTypes={EDGE_TYPES}
      onNodeClick={handleNodeClick}
      onPaneClick={handlePaneClick}
      onNodeDoubleClick={handleNodeDoubleClick}
      /* No fitView — we manually focus the root node after load */
      fitView={false}
      defaultViewport={{ x: 0, y: 0, zoom: 0.5 }}
      minZoom={0.05}
      maxZoom={3}
      defaultEdgeOptions={DEFAULT_EDGE_OPTIONS}
      proOptions={{ hideAttribution: true }}
      nodesDraggable
      nodesConnectable={false}
      elementsSelectable
      selectNodesOnDrag={false}
      panOnScroll={false}
      zoomOnScroll
      zoomOnPinch
      panOnDrag
      preventScrolling
      deleteKeyCode={null}
      selectionKeyCode={null}
      multiSelectionKeyCode={null}
      onlyRenderVisibleElements={nodeCount > 150}
    >
      <Background
        variant={BackgroundVariant.Dots}
        gap={24}
        size={1}
        color="#303030"
        style={{ background: "#252525" }}
      />

      {/* Stats — top left */}
      <Panel position="top-left">
        <div style={{
          background: "rgba(17,17,17,0.95)",
          border: "1px solid #4a4a4a",
          borderRadius: 8,
          padding: "8px 12px",
          backdropFilter: "blur(10px)",
          display: "flex",
          flexDirection: "column",
          gap: 4,
          minWidth: 140,
          boxShadow: "0 4px 20px rgba(0,0,0,0.6)",
        }}>
          <div style={{ display: "flex", gap: 12 }}>
            <span style={{ fontSize: 11, color: "#909090" }}>
              <span style={{ color: "#aaa", fontWeight: 600 }}>{nodeCount}</span> files
            </span>
            <span style={{ fontSize: 11, color: "#909090" }}>
              <span style={{ color: "#aaa", fontWeight: 600 }}>{edgeCount}</span> edges
            </span>
          </div>
          {selectedLabel && (
            <div style={{
              fontSize: 11, color: "#ff4500", fontWeight: 500,
              overflow: "hidden", textOverflow: "ellipsis",
              whiteSpace: "nowrap", maxWidth: 160, fontFamily: "monospace",
            }}>
              ◈ {selectedLabel}
            </div>
          )}
        </div>
      </Panel>

      {/* Legend — top right */}
      <Panel position="top-right">
        <GraphLegend fileTypes={presentFileTypes} />
      </Panel>

      {/* Hint bar — bottom center */}
      <Panel position="bottom-center">
        <GraphControls />
      </Panel>

      <Controls
        position="bottom-left"
        style={{
          background: "#303030",
          border: "1px solid #4a4a4a",
          borderRadius: 8,
          overflow: "hidden",
          boxShadow: "0 4px 16px rgba(0,0,0,0.6)",
        }}
        showInteractive={false}
      />

      <MiniMap
        position="bottom-right"
        style={{ background: "#303030", border: "1px solid #4a4a4a", borderRadius: 8 }}
        nodeColor={miniMapNodeColor}
        maskColor="rgba(0,0,0,0.7)"
        pannable
        zoomable
      />
    </ReactFlow>
  );
}

// ── Main export ───────────────────────────────────────────────────────────────

interface DependencyGraphProps {
  repoId: string;
  selectedFileId: string | null;
  onNodeClick: (fileId: string) => void;
}

export default function DependencyGraph({
  repoId,
  selectedFileId,
  onNodeClick,
}: DependencyGraphProps) {
  const normalizedId = selectedFileId || null;

  const handleNodeClick = useCallback(
    (id: string) => { onNodeClick(id || ""); },
    [onNodeClick]
  );

  return (
    <div
      style={{
        position: "relative",
        width: "100%",
        height: "100%",
        overflow: "hidden",
        background: "#252525",
        touchAction: "none",
      }}
      onWheel={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
    >
      <ReactFlowProvider>
        <InnerGraph
          repoId={repoId}
          selectedFileId={normalizedId}
          onNodeClick={handleNodeClick}
        />
      </ReactFlowProvider>
    </div>
  );
}
