"use client";

import { CheckCircle2, Circle, Loader2, ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";

interface ProcessingStatusProps {
  status: string;
  progress: {
    totalFiles: number;
    parsedFiles: number;
    failedFiles: number;
    percentage: number;
  } | null;
  repoName?: string;
}

interface Step {
  key: string;
  label: string;
  getSubtitle: (progress: ProcessingStatusProps["progress"], status: string) => string;
}

const STEPS: Step[] = [
  {
    key: "CLONING",
    label: "Cloning Repository",
    getSubtitle: (_, status) =>
      status === "CLONING" ? "Fetching source code from GitHub..." : "Repository cloned successfully",
  },
  {
    key: "READING",
    label: "Reading Files",
    getSubtitle: (progress, status) =>
      status === "READING"
        ? "Scanning file tree..."
        : progress?.totalFiles
        ? `Discovered ${progress.totalFiles} supported files`
        : "Scanning file tree...",
  },
  {
    key: "PARSING",
    label: "Parsing Files",
    getSubtitle: (progress, status) =>
      status === "PARSING" && progress
        ? `Parsing ${progress.parsedFiles} of ${progress.totalFiles} files...`
        : "Extracting imports, exports and functions",
  },
  {
    key: "GRAPHING",
    label: "Building Graph",
    getSubtitle: () => "Pending structural analysis",
  },
];

const ORDER = ["CLONING", "READING", "PARSING", "GRAPHING"];

type StepState = "done" | "active" | "pending";

function getState(stepKey: string, currentStatus: string): StepState {
  const si = ORDER.indexOf(stepKey);
  const ci = ORDER.indexOf(currentStatus);
  if (ci === -1) return "pending";
  if (si < ci) return "done";
  if (si === ci) return "active";
  return "pending";
}

export default function ProcessingStatus({ status, progress, repoName }: ProcessingStatusProps) {
  const router = useRouter();

  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(6,6,12,0.92)",
      display: "flex", alignItems: "center", justifyContent: "center",
      zIndex: 50,
    }}>
      <div style={{
        background: "#111118",
        border: "1px solid #1e1e2e",
        borderRadius: 16,
        padding: "40px 48px",
        width: "100%",
        maxWidth: 480,
        boxShadow: "0 24px 80px rgba(0,0,0,0.6), 0 0 0 1px rgba(124,107,240,0.08)",
      }}>
        {/* Title */}
        <div style={{ textAlign: "center", marginBottom: 36 }}>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: "#7c6bf0" }}>
            Analyzing Repository
          </h2>
          {repoName && (
            <p style={{ margin: "6px 0 0", fontSize: 14, color: "#6b6b80" }}>{repoName}</p>
          )}
        </div>

        {/* Steps */}
        <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
          {STEPS.map((step, idx) => {
            const state = getState(step.key, status);
            const isLast = idx === STEPS.length - 1;
            const subtitle = step.getSubtitle(progress, status);

            return (
              <div key={step.key}>
                <div style={{ display: "flex", gap: 16, alignItems: "flex-start" }}>
                  {/* Icon + connector line */}
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", flexShrink: 0 }}>
                    <div style={{
                      width: 32, height: 32, borderRadius: "50%",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      background: state === "done"
                        ? "rgba(124,107,240,0.2)"
                        : state === "active"
                        ? "rgba(124,107,240,0.12)"
                        : "rgba(30,30,46,0.5)",
                      border: `2px solid ${state === "done" ? "#7c6bf0" : state === "active" ? "#7c6bf0" : "#2a2a3e"}`,
                      transition: "all 0.3s",
                    }}>
                      {state === "done" ? (
                        <CheckCircle2 size={16} color="#7c6bf0" />
                      ) : state === "active" ? (
                        <div style={{
                          width: 10, height: 10, borderRadius: "50%",
                          background: "#7c6bf0",
                          boxShadow: "0 0 8px rgba(124,107,240,0.6)",
                        }} className="pulse-ring" />
                      ) : (
                        <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#2a2a3e" }} />
                      )}
                    </div>
                    {!isLast && (
                      <div style={{
                        width: 2, height: 28,
                        background: state === "done" ? "#7c6bf0" : "#1e1e2e",
                        marginTop: 2,
                        transition: "background 0.3s",
                      }} />
                    )}
                  </div>

                  {/* Content */}
                  <div style={{ paddingTop: 4, paddingBottom: isLast ? 0 : 28, flex: 1 }}>
                    <p style={{
                      margin: 0, fontSize: 14, fontWeight: 600,
                      color: state === "pending" ? "#3a3a5a" : "#e2e2e8",
                    }}>
                      {step.label}
                    </p>
                    <p style={{
                      margin: "3px 0 0", fontSize: 13,
                      color: state === "active" ? "#7c6bf0" : state === "done" ? "#6b6b80" : "#2e2e4e",
                    }}>
                      {subtitle}
                    </p>

                    {/* Progress bar — only on active PARSING step */}
                    {state === "active" && step.key === "PARSING" && progress && progress.totalFiles > 0 && (
                      <div style={{ marginTop: 10 }}>
                        <div style={{
                          height: 4, background: "#1e1e2e", borderRadius: 2, overflow: "hidden",
                        }}>
                          <div style={{
                            height: "100%", borderRadius: 2,
                            background: "linear-gradient(90deg, #7c6bf0, #a78bfa)",
                            width: `${progress.percentage}%`,
                            transition: "width 0.4s ease",
                          }} />
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Cancel */}
        <div style={{ textAlign: "center", marginTop: 32, borderTop: "1px solid #1a1a2a", paddingTop: 24 }}>
          <button
            onClick={() => router.push("/")}
            style={{
              background: "none", border: "none", cursor: "pointer",
              fontSize: 14, color: "#4a4a5a", transition: "color 0.15s",
            }}
            onMouseEnter={e => (e.currentTarget.style.color = "#e2e2e8")}
            onMouseLeave={e => (e.currentTarget.style.color = "#4a4a5a")}
          >
            Cancel Analysis
          </button>
        </div>
      </div>
    </div>
  );
}
