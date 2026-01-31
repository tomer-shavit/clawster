'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useWebSocketContext, type ConnectionState } from '@/lib/websocket-context';

interface GatewayWebSocketResult {
  status: ConnectionState;
  lastEvent: unknown;
  subscribe: (event: string, callback: (data: unknown) => void) => () => void;
  send: (event: string, data: unknown) => void;
}

export function useGatewayWebSocket(instanceId: string): GatewayWebSocketResult {
  const { subscribe: ctxSubscribe, send: ctxSend, connectionStatus } = useWebSocketContext();
  const [lastEvent, setLastEvent] = useState<unknown>(null);
  const status: ConnectionState = connectionStatus[instanceId] || 'disconnected';

  useEffect(() => {
    if (!instanceId) return;
    return ctxSubscribe(instanceId, 'message', (data) => setLastEvent(data));
  }, [instanceId, ctxSubscribe]);

  const subscribe = useCallback(
    (event: string, callback: (data: unknown) => void) => ctxSubscribe(instanceId, event, callback),
    [instanceId, ctxSubscribe],
  );

  const send = useCallback(
    (event: string, data: unknown) => ctxSend(instanceId, event, data),
    [instanceId, ctxSend],
  );

  return { status, lastEvent, subscribe, send };
}
