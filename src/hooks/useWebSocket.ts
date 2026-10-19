import { useState, useEffect, useCallback, useRef } from 'react';

const MAX_MESSAGES = 200;

interface WsMessage {
  type: string;
  [key: string]: any;
}

export function useWebSocket(enabled = true) {
  const [messages, setMessages] = useState<WsMessage[]>([]);
  const [connected, setConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  useEffect(() => {
    let disposed = false;
    let ownedSocket: WebSocket | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | undefined;
    setConnected(false);
    if (!enabled) return;

    function connect() {
      if (disposed) return;
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const token = (document.querySelector('meta[name="mc-token"]') as HTMLMetaElement)?.content || '';
      const ws = new WebSocket(`${protocol}//${window.location.host}/ws${token ? '?token=' + encodeURIComponent(token) : ''}`);
      ownedSocket = ws;
      wsRef.current = ws;
      const current = () => !disposed && ownedSocket === ws && wsRef.current === ws;
      ws.onopen = () => { if (current()) setConnected(true); };
      ws.onmessage = (ev) => {
        if (!current()) return;
        try {
          const msg = JSON.parse(ev.data);
          setMessages(prev => [...prev.slice(-MAX_MESSAGES), msg]);
        } catch (e) {
          console.warn('[WS] Failed to parse message:', e);
        }
      };
      ws.onclose = () => {
        if (!current()) return;
        setConnected(false);
        wsRef.current = null;
        reconnectTimer = setTimeout(() => {
          if (disposed || ownedSocket !== ws || wsRef.current !== null) return;
          reconnectTimer = undefined;
          connect();
        }, 3000);
      };
      ws.onerror = () => { if (current()) ws.close(); };
    }

    connect();
    return () => {
      disposed = true;
      clearTimeout(reconnectTimer);
      if (ownedSocket) {
        ownedSocket.onopen = null;
        ownedSocket.onmessage = null;
        ownedSocket.onclose = null;
        ownedSocket.onerror = null;
        if (wsRef.current === ownedSocket) wsRef.current = null;
        ownedSocket.close();
      }
      setConnected(false);
    };
  }, [enabled]);

  const send = useCallback((msg: any) => {
    if (enabled && wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(msg));
    }
  }, [enabled]);

  const clearMessages = useCallback(() => setMessages([]), []);

  return { messages, connected, send, clearMessages };
}
