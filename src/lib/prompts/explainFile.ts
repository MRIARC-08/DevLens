// Phase 3: Prompt template for file explanation
// Isolated here so it's easy to tune independently

export function buildExplainFilePrompt(filePath: string, content: string): string {
  // TODO: Phase 3
  return `Explain this file: ${filePath}`;
}
