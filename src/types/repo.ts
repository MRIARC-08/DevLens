// src/types/repo.ts
// Repository-related TypeScript types

export type RepositoryStatus =
  | "PENDING"
  | "CLONING"
  | "READING"
  | "PARSING"
  | "GRAPHING"
  | "READY"
  | "FAILED";

export interface Repository {
  id: string;
  url: string;
  owner: string;
  name: string;
  fullName: string;
  status: RepositoryStatus;
  statusMessage?: string;
  totalFiles: number;
  parsedFiles: number;
  failedFiles: number;
  totalFunctions: number;
  totalComponents: number;
  totalEdges: number;
  insights?: Record<string, unknown>;
  errorMessage?: string;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
}
