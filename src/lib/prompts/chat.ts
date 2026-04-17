// Phase 3: System prompt for codebase chat
// Isolated here so it's easy to tune independently

export function buildChatSystemPrompt(repoName: string, relevantFiles: string[]): string {
  // TODO: Phase 3
  return `You are an expert assistant helping understand the ${repoName} codebase.`;
}
