"use client";

import { useState, useCallback, useRef } from "react";
import { api } from "@/lib/api";

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  status?: "sending" | "sent" | "error";
}

interface UseBotChatResult {
  messages: ChatMessage[];
  sendMessage: (content: string) => Promise<void>;
  isLoading: boolean;
  error: string | null;
  clearChat: () => void;
}

export function useBotChat(instanceId: string): UseBotChatResult {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const sessionIdRef = useRef<string | undefined>(undefined);

  const sendMessage = useCallback(
    async (content: string) => {
      if (!content.trim() || isLoading) return;

      setError(null);

      const userMessage: ChatMessage = {
        id: crypto.randomUUID(),
        role: "user",
        content: content.trim(),
        timestamp: new Date(),
        status: "sent",
      };

      const placeholderId = crypto.randomUUID();
      const placeholderMessage: ChatMessage = {
        id: placeholderId,
        role: "assistant",
        content: "",
        timestamp: new Date(),
        status: "sending",
      };

      setMessages((prev) => [...prev, userMessage, placeholderMessage]);
      setIsLoading(true);

      try {
        const response = await api.chatWithBot(
          instanceId,
          content.trim(),
          sessionIdRef.current,
        );

        if (response.sessionId) {
          sessionIdRef.current = response.sessionId;
        }

        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === placeholderId
              ? {
                  ...msg,
                  content: response.response,
                  timestamp: new Date(),
                  status: "sent" as const,
                }
              : msg,
          ),
        );
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : "Failed to send message";
        setError(errorMessage);

        setMessages((prev) =>
          prev
            .filter((msg) => msg.id !== placeholderId)
            .map((msg) =>
              msg.id === userMessage.id
                ? { ...msg, status: "error" as const }
                : msg,
            ),
        );
      } finally {
        setIsLoading(false);
      }
    },
    [instanceId, isLoading],
  );

  const clearChat = useCallback(() => {
    setMessages([]);
    setError(null);
    sessionIdRef.current = undefined;
  }, []);

  return { messages, sendMessage, isLoading, error, clearChat };
}
