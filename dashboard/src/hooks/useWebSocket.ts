import { useEffect, useRef, useCallback, useState } from 'react';
import { WsMessage } from '../types';

export type WsStatus = 'CONNECTING' | 'CONNECTED' | 'DISCONNECTED' | 'RECONNECTING';

interface UseWebSocketOptions {
  onMessage: (msg: WsMessage) => void;
  apiKey: string;
  port: number; // used only in local dev (http://)
}

function getWsUrl(apiKey: string, port: number): string {
  const isHttps = window.location.protocol === 'https:';

  if (isHttps) {
    // Railway / production: same host, no port, wss://
    // Railway terminates SSL and proxies to our app
    const host = window.location.hostname;
    return `wss://${host}/ws?apiKey=${encodeURIComponent(apiKey)}`;
  } else {
    // Local dev: http, use specified backend port
    const host = window.location.hostname;
    return `ws://${host}:${port}/ws?apiKey=${encodeURIComponent(apiKey)}`;
  }
}

export function useWebSocket({ onMessage, apiKey, port }: UseWebSocketOptions) {
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectDelay = useRef(1000);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const shouldReconnect = useRef(true);
  const [status, setStatus] = useState<WsStatus>('CONNECTING');
  const optionsRef = useRef({ onMessage, apiKey, port });
  optionsRef.current = { onMessage, apiKey, port };

  const connect = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.onmessage = null;
      wsRef.current.onopen = null;
      wsRef.current.onclose = null;
      wsRef.current.onerror = null;
      try { wsRef.current.close(); } catch {}
    }

    const { apiKey, port } = optionsRef.current;
    const url = getWsUrl(apiKey, port);
    console.log('[WS] Connecting to:', url);

    setStatus('CONNECTING');
    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => {
      setStatus('CONNECTED');
      reconnectDelay.current = 1000;
      console.log('[WS] Connected');
    };

    ws.onmessage = (evt) => {
      try {
        const msg = JSON.parse(evt.data) as WsMessage;
        optionsRef.current.onMessage(msg);
      } catch (e) {
        console.warn('[WS] Failed to parse message', e);
      }
    };

    ws.onclose = (evt) => {
      console.log('[WS] Closed', evt.code, evt.reason);
      setStatus(shouldReconnect.current ? 'RECONNECTING' : 'DISCONNECTED');
      if (shouldReconnect.current) {
        reconnectTimer.current = setTimeout(() => {
          connect();
        }, reconnectDelay.current);
        reconnectDelay.current = Math.min(reconnectDelay.current * 2, 30000);
      }
    };

    ws.onerror = (e) => {
      console.error('[WS] Error', e);
      ws.close();
    };
  }, []); // eslint-disable-line

  useEffect(() => {
    shouldReconnect.current = true;
    connect();
    return () => {
      shouldReconnect.current = false;
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
      if (wsRef.current) {
        wsRef.current.onclose = null;
        wsRef.current.close();
      }
    };
  }, [connect]);

  const send = useCallback((msg: WsMessage) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(msg));
    }
  }, []);

  return { status, send };
}
