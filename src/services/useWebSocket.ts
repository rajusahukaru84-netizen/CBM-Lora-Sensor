import { useEffect, useRef, useState, useCallback } from 'react';

export interface WebSocketMessage {
  event: string;
  type?: string;
  payload: any;
  data?: any;
  timestamp: string;
}

export type ConnectionMode = 'CONNECTING' | 'CONNECTED' | 'POLLING' | 'DISCONNECTED';

export function useWebSocket(onEvent?: (msg: WebSocketMessage) => void) {
  const [status, setStatus] = useState<ConnectionMode>('CONNECTING');
  const [lastMessage, setLastMessage] = useState<WebSocketMessage | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const sseRef = useRef<EventSource | null>(null);
  const isMountedRef = useRef(true);
  const onEventRef = useRef(onEvent);

  useEffect(() => {
    onEventRef.current = onEvent;
  }, [onEvent]);

  const handleIncomingMessage = useCallback((rawString: string) => {
    try {
      const parsed = JSON.parse(rawString);
      const normalized: WebSocketMessage = {
        event: parsed.event || parsed.type || 'UNKNOWN',
        type: parsed.type || parsed.event,
        payload: parsed.payload !== undefined ? parsed.payload : parsed.data,
        data: parsed.data !== undefined ? parsed.data : parsed.payload,
        timestamp: parsed.timestamp || new Date().toISOString(),
      };

      if (normalized.event !== 'CONNECTED') {
        setLastMessage(normalized);
        if (onEventRef.current) {
          onEventRef.current(normalized);
        }
      }
    } catch {
      // Ignore non-JSON pings
    }
  }, []);

  const connectSSE = useCallback(() => {
    if (!isMountedRef.current || sseRef.current) return;

    try {
      const sse = new EventSource('/api/telemetry/events');
      sseRef.current = sse;

      sse.onopen = () => {
        if (isMountedRef.current) {
          setStatus('CONNECTED');
        }
      };

      sse.onmessage = (event) => {
        if (isMountedRef.current) {
          handleIncomingMessage(event.data);
        }
      };

      sse.onerror = () => {
        if (isMountedRef.current) {
          setStatus('POLLING');
        }
      };
    } catch {
      if (isMountedRef.current) {
        setStatus('POLLING');
      }
    }
  }, [handleIncomingMessage]);

  const connectWS = useCallback(() => {
    if (typeof window === 'undefined' || !isMountedRef.current) return;

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws/telemetry`;

    try {
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        if (isMountedRef.current) {
          setStatus('CONNECTED');
        }
      };

      ws.onmessage = (event) => {
        if (isMountedRef.current) {
          handleIncomingMessage(event.data);
        }
      };

      ws.onerror = () => {
        // WebSocket upgrades are often blocked by reverse proxies or sandbox iframes.
        // Silently close without noisy console.error and activate standard HTTP SSE.
        try {
          ws.close();
        } catch {
          // ignore
        }
        if (isMountedRef.current) {
          connectSSE();
        }
      };

      ws.onclose = () => {
        if (isMountedRef.current && status !== 'CONNECTED') {
          connectSSE();
        }
      };
    } catch {
      connectSSE();
    }
  }, [connectSSE, handleIncomingMessage, status]);

  useEffect(() => {
    isMountedRef.current = true;
    connectWS();

    return () => {
      isMountedRef.current = false;
      if (wsRef.current) {
        try {
          wsRef.current.close();
        } catch {
          // ignore
        }
        wsRef.current = null;
      }
      if (sseRef.current) {
        try {
          sseRef.current.close();
        } catch {
          // ignore
        }
        sseRef.current = null;
      }
    };
  }, [connectWS]);

  return { status, lastMessage };
}
