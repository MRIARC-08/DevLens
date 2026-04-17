export default function RepoLoading() {
  return (
    <div className="flex h-screen w-full bg-[#0a0a0a] overflow-hidden">
      {/* Left: file tree skeleton */}
      <div className="w-64 shrink-0 bg-[#0f0f0f] border-r border-[#222222] p-3 flex flex-col gap-2">
        <div className="h-4 w-16 rounded bg-[#1a1a1a] animate-pulse mb-3" />
        {Array.from({ length: 12 }).map((_, i) => (
          <div
            key={i}
            className="h-3 rounded bg-[#1a1a1a] animate-pulse"
            style={{ width: `${55 + (i % 4) * 12}%`, opacity: 1 - i * 0.05 }}
          />
        ))}
      </div>

      {/* Center: graph skeleton */}
      <div className="flex-1 bg-[#0a0a0a] flex flex-col">
        {/* Header bar */}
        <div className="h-14 border-b border-[#222222] bg-[#111111] flex items-center px-4 gap-3">
          <div className="h-4 w-32 rounded bg-[#1a1a1a] animate-pulse" />
          <div className="h-4 w-48 rounded bg-[#1a1a1a] animate-pulse" />
        </div>
        {/* Graph area */}
        <div className="flex-1 relative overflow-hidden">
          <div className="absolute inset-6 rounded-xl bg-[#1a1a1a] animate-pulse" />
          <div className="absolute top-12 left-12 w-40 h-16 rounded-lg bg-[#222222] animate-pulse" />
          <div className="absolute top-36 left-64 w-40 h-16 rounded-lg bg-[#222222] animate-pulse" />
          <div className="absolute top-24 right-32 w-40 h-16 rounded-lg bg-[#222222] animate-pulse" />
          <div className="absolute bottom-24 left-32 w-40 h-16 rounded-lg bg-[#222222] animate-pulse" />
          <div className="absolute bottom-16 right-16 w-40 h-16 rounded-lg bg-[#222222] animate-pulse" />
        </div>
        {/* Tab bar */}
        <div className="h-10 border-t border-[#222222] bg-[#111111] flex items-center px-4 gap-3">
          <div className="h-3 w-16 rounded bg-[#1a1a1a] animate-pulse" />
          <div className="h-3 w-12 rounded bg-[#1a1a1a] animate-pulse" />
        </div>
      </div>

      {/* Right: detail panel skeleton */}
      <div className="w-80 shrink-0 bg-[#0f0f0f] border-l border-[#222222] p-4 flex flex-col gap-3">
        <div className="h-5 w-3/4 rounded bg-[#1a1a1a] animate-pulse" />
        <div className="h-3 w-1/2 rounded bg-[#1a1a1a] animate-pulse mt-1" />
        <div className="h-px bg-[#222222] my-2" />
        {Array.from({ length: 8 }).map((_, i) => (
          <div
            key={i}
            className="h-3 rounded bg-[#1a1a1a] animate-pulse"
            style={{ width: `${40 + (i % 5) * 15}%` }}
          />
        ))}
      </div>
    </div>
  );
}
