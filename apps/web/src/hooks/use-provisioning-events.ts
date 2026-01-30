"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { api } from "@/lib/api";

// ---------------------------------------------------------------------------
// Types (mirrors backend ProvisioningProgress)
// ---------------------------------------------------------------------------

export interface ProvisioningStep {
  id: string;
  name: string;
  status: "pending" | "in_progress" | "completed" | "error" | "skipped";
  message?: string;
  startedAt?: string;
  completedAt?: string;
  error?: string;
}

export interface ProvisioningProgress {
  instanceId: string;
  status: "in_progress" | "completed" | "error" | "timeout";
  currentStep: string;
  steps: ProvisioningStep[];
  startedAt: string;
  completedAt?: string;
  error?: string;
}

interface UseProvisioningEventsResult {
  progress: ProvisioningProgress | null;
  isConnected: boolean;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
const MAX_RECONNECT_ATTEMPTS = 10;
const POLL_INTERVAL_MS = 3000;

export function useProvisioningEvents(
  instanceId: string,
): UseProvisioningEventsResult {
  const [progress, setProgress] = useState<ProvisioningProgress | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const socketRef = useRef<unknown>(null);
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const reconnectAttempts = useRef(0);
  const mountedRef = useRef(true);

  // ---- Polling fallback ----
  const startPolling = useCallback(() => {
    if (pollIntervalRef.current) return;

    const poll = async () => {
      try {
        const res = await api.getProvisioningStatus(instanceId);
        if (!mountedRef.current) return;
        if (res && res.status !== "unknown") {
          setProgress(res as unknown as ProvisioningProgress);
          // Stop polling once terminal
          if (
            res.status === "completed" ||
            res.status === "error" ||
            res.status === "timeout"
          ) {
            if (pollIntervalRef.current) {
              clearInterval(pollIntervalRef.current);
              pollIntervalRef.current = null;
            }
          }
        }
      } catch {
        // Polling error — continue silently
      }
    };

    poll();
    pollIntervalRef.current = setInterval(poll, POLL_INTERVAL_MS);
  }, [instanceId]);

  const stopPolling = useCallback(() => {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
  }, []);

  // ---- WebSocket connection ----
  useEffect(() => {
    mountedRef.current = true;
    let socket: { on: Function; emit: Function; disconnect: Function; connected: boolean } | null = null;

    // Start polling immediately for instant feedback
    startPolling();

    const connectWebSocket = async () => {
      try {
        const { io } = await import("socket.io-client");

        socket = io(`${API_URL}/provisioning`, {
          transports: ["websocket", "polling"],
          reconnection: false, // We handle reconnection manually
        });
        socketRef.current = socket;

        socket.on("connect", () => {
          if (!mountedRef.current) return;
          setIsConnected(true);
          reconnectAttempts.current = 0;
          // Stop polling when WebSocket is connected
          stopPolling();
          // Subscribe to instance events
          socket!.emit("subscribe", { instanceId });
        });

        socket.on("progress", (data: ProvisioningProgress) => {
          if (!mountedRef.current) return;
          setProgress(data);
          // Stop on terminal state
          if (
            data.status === "completed" ||
            data.status === "error" ||
            data.status === "timeout"
          ) {
            setTimeout(() => {
              socket?.disconnect();
            }, 1000);
          }
        });

        socket.on("disconnect", () => {
          if (!mountedRef.current) return;
          setIsConnected(false);
          // Resume polling
          startPolling();
          // Try reconnect with exponential backoff
          if (reconnectAttempts.current < MAX_RECONNECT_ATTEMPTS) {
            const delay = Math.min(
              1000 * Math.pow(2, reconnectAttempts.current),
              30000,
            );
            reconnectAttempts.current++;
            setTimeout(() => {
              if (mountedRef.current) {
                connectWebSocket();
              }
            }, delay);
          }
        });

        socket.on("connect_error", () => {
          if (!mountedRef.current) return;
          setIsConnected(false);
          // Fall back to polling
          startPolling();
        });
      } catch {
        // socket.io-client not available — stay with polling
        startPolling();
      }
    };

    connectWebSocket();

    return () => {
      mountedRef.current = false;
      stopPolling();
      if (socket) {
        socket.emit("unsubscribe", { instanceId });
        socket.disconnect();
      }
      socketRef.current = null;
    };
  }, [instanceId, startPolling, stopPolling]);

  return { progress, isConnected };
}
