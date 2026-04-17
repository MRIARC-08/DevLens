// src/types/chat.ts
// Chat message TypeScript types

export type MessageRole = "USER" | "ASSISTANT";

export interface ChatMessage {
  id: string;
  repositoryId: string;
  role: MessageRole;
  content: string;
  referencedFiles?: string[];
  model?: string;
  promptTokens?: number;
  completionTokens?: number;
  createdAt: string;
}
