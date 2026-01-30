"use client";

import { Check, Circle, Loader2, Minus, X } from "lucide-react";
import type { ProvisioningStep } from "@/hooks/use-provisioning-events";

interface StepProgressProps {
  step: ProvisioningStep;
  isLast: boolean;
}

function formatDuration(startedAt?: string, completedAt?: string): string {
  if (!startedAt) return "";
  const start = new Date(startedAt).getTime();
  const end = completedAt ? new Date(completedAt).getTime() : Date.now();
  const ms = end - start;
  if (ms < 1000) return `${ms}ms`;
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}m ${remainingSeconds}s`;
}

function StepIcon({ status }: { status: ProvisioningStep["status"] }) {
  switch (status) {
    case "completed":
      return (
        <div className="flex h-6 w-6 items-center justify-center rounded-full bg-green-100">
          <Check className="h-3.5 w-3.5 text-green-600" />
        </div>
      );
    case "in_progress":
      return (
        <div className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-100">
          <Loader2 className="h-3.5 w-3.5 animate-spin text-blue-600" />
        </div>
      );
    case "error":
      return (
        <div className="flex h-6 w-6 items-center justify-center rounded-full bg-red-100">
          <X className="h-3.5 w-3.5 text-red-600" />
        </div>
      );
    case "skipped":
      return (
        <div className="flex h-6 w-6 items-center justify-center rounded-full bg-gray-100">
          <Minus className="h-3.5 w-3.5 text-gray-400" />
        </div>
      );
    case "pending":
    default:
      return (
        <div className="flex h-6 w-6 items-center justify-center rounded-full bg-gray-100">
          <Circle className="h-3.5 w-3.5 text-gray-400" />
        </div>
      );
  }
}

export function StepProgress({ step, isLast }: StepProgressProps) {
  const duration = formatDuration(step.startedAt, step.completedAt);

  return (
    <div className="flex gap-3">
      {/* Timeline column */}
      <div className="flex flex-col items-center">
        <StepIcon status={step.status} />
        {!isLast && (
          <div
            className={`mt-1 h-full w-0.5 ${
              step.status === "completed" ? "bg-green-300" : "bg-gray-200"
            }`}
          />
        )}
      </div>

      {/* Content column */}
      <div className="flex-1 pb-4">
        <div className="flex items-center gap-2">
          <span
            className={`text-sm font-medium ${
              step.status === "in_progress"
                ? "text-blue-700"
                : step.status === "completed"
                  ? "text-foreground"
                  : step.status === "error"
                    ? "text-red-700"
                    : "text-muted-foreground"
            }`}
          >
            {step.name}
          </span>
          {duration && (
            <span className="text-xs text-muted-foreground">{duration}</span>
          )}
        </div>
        {step.message && (
          <p className="mt-0.5 text-xs text-muted-foreground">{step.message}</p>
        )}
        {step.error && (
          <p className="mt-0.5 text-xs text-red-600">{step.error}</p>
        )}
      </div>
    </div>
  );
}
