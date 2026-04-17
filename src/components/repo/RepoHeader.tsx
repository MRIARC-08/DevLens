"use client";

import { Code2, ExternalLink, FileCode, Zap, GitMerge, Puzzle } from "lucide-react";

interface RepoHeaderProps {
  owner: string;
  name: string;
  url: string;
  stats: {
    totalFiles: number;
    totalComponents: number;
    totalFunctions: number;
    totalEdges: number;
  };
}

export default function RepoHeader({ owner, name, url, stats }: RepoHeaderProps) {
  return (
    <div className="h-14 flex items-center justify-between px-4 bg-[#111111] border-b border-[#222222] shrink-0">
      {/* Left: brand + repo name */}
      <div className="flex items-center gap-2 min-w-0">
        <Code2 size={16} className="text-indigo-400 shrink-0" />
        <span className="text-xs text-[#52525b]">DevLens</span>
        <span className="text-[#333333] mx-1">/</span>
        <span className="text-sm font-medium text-white truncate">
          {owner}/{name}
        </span>
      </div>

      {/* Right: stat chips + link */}
      <div className="flex items-center gap-3 shrink-0 ml-4">
        <StatChip icon={<FileCode size={11} />} value={stats.totalFiles} label="files" />
        <StatChip icon={<Zap size={11} />} value={stats.totalFunctions} label="functions" />
        <StatChip icon={<GitMerge size={11} />} value={stats.totalEdges} label="edges" />
        {stats.totalComponents > 0 && (
          <StatChip icon={<Puzzle size={11} />} value={stats.totalComponents} label="components" />
        )}

        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1 text-xs text-[#52525b] hover:text-white
            transition-colors ml-1 border border-[#222222] rounded-md px-2 py-1"
        >
          <ExternalLink size={11} />
          GitHub
        </a>
      </div>
    </div>
  );
}

function StatChip({
  icon,
  value,
  label,
}: {
  icon: React.ReactNode;
  value: number;
  label: string;
}) {
  return (
    <div className="flex items-center gap-1.5 text-xs text-[#71717a] bg-[#1a1a1a] border border-[#222222] rounded-md px-2 py-1">
      <span className="text-[#52525b]">{icon}</span>
      <span className="text-white font-medium">{value.toLocaleString()}</span>
      <span>{label}</span>
    </div>
  );
}
