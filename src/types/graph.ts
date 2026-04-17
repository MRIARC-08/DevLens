// src/types/graph.ts
// React Flow node and edge types for the dependency graph

import type { Node, Edge } from "@xyflow/react";
import type { FileType } from "./file";

export interface FileNodeData {
  fileId: string;
  filePath: string;
  fileName: string;
  fileType: FileType;
  importCount: number;
  exportCount: number;
  functionCount: number;
  [key: string]: unknown;
}

export type FileNode = Node<FileNodeData, "file">;
export type DependencyEdge = Edge;

export interface GraphData {
  nodes: FileNode[];
  edges: DependencyEdge[];
}
