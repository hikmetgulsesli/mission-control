import { WebSocketServer, WebSocket } from 'ws';
import type { Server } from 'http';
import { config } from './config.js';
import { assertFreshMissionControlRuntimeV1 } from './services/fresh-installation-runtime.js';

let lastGatewayUnavailableLogAt = 0;

function logGatewayUnavailable(message: string) {
  const now = Date.now();
  if (now - lastGatewayUnavailableLogAt < 60_000) return;
  lastGatewayUnavailableLogAt = now;
  console.warn(`[WS] Gateway unavailable; live chat disabled: ${message}`);
}

export function setupWsProxy(server: Server) {
  assertFreshMissionControlRuntimeV1();
  const disposeOnRefusalV1 = new Set<() => void>();
  function runtimeAvailableV1(): boolean {
    try { assertFreshMissionControlRuntimeV1(); return true; }
    catch {
      for (const dispose of [...disposeOnRefusalV1]) dispose();
      return false;
    }
  }
  const wss = new WebSocketServer({ server, path: '/ws',
    verifyClient: (_info: unknown, done: (accepted: boolean, code?: number, message?: string) => void) => {
      if (runtimeAvailableV1()) done(true);
      else done(false, 503, 'Service unavailable');
    },
  });

  wss.on('connection', (clientWs, req) => {
    if (!runtimeAvailableV1()) { clientWs.terminate(); return; }
    // Auth check for WebSocket connections
    if (config.authToken) {
      const url = new URL(req.url || '', 'http://localhost');
      const token = url.searchParams.get('token');
      if (!token || token !== config.authToken) {
        clientWs.close(1008, 'Unauthorized');
        return;
      }
    }
    console.log('[WS] Client connected from', req.socket.remoteAddress);

    let gatewayWs: WebSocket | null = null;
    let authenticated = false;
    let reqId = 0;
    let gatewaySettled = false;
    let pingInterval: ReturnType<typeof setInterval> | undefined;
    function disposeForRefusalV1(): void {
      clearInterval(pingInterval);
      for (const socket of [clientWs, gatewayWs]) {
        if (socket && socket.readyState !== WebSocket.CLOSED) {
          try { socket.terminate(); } catch { /* Still attempt the other owned socket. */ }
        }
      }
      releaseClosedPairV1();
    }
    function releaseClosedPairV1(): void {
      if (clientWs.readyState === WebSocket.CLOSED && (!gatewayWs || gatewayWs.readyState === WebSocket.CLOSED)) {
        disposeOnRefusalV1.delete(disposeForRefusalV1);
      }
    }
    disposeOnRefusalV1.add(disposeForRefusalV1);

    try {
      gatewayWs = new WebSocket(config.gatewayWs, {
        headers: { Origin: config.wsOrigin || config.publicOrigin || config.internalUrl },
      });
    } catch (err) {
      disposeOnRefusalV1.delete(disposeForRefusalV1);
      logGatewayUnavailable((err as Error)?.message || String(err));
      clientWs.close(1013, 'Gateway unavailable');
      return;
    }

    function sendReq(method: string, params: any) {
      if (!gatewayWs || gatewayWs.readyState !== WebSocket.OPEN) return;
      const id = String(++reqId);
      const frame = { type: 'req', id, method, params };
      console.log('[WS] Sending:', method);
      gatewayWs.send(JSON.stringify(frame));
    }

    function doHandshake() {
      sendReq('connect', {
        minProtocol: 4,
        maxProtocol: 4,
        client: { id: 'webchat-ui', version: '2.0.18', platform: 'web', mode: 'webchat' },
        role: 'operator',
        scopes: ['operator.read', 'operator.write'],
        caps: [],
        commands: [],
        permissions: {},
        auth: { token: config.gatewayToken },
        locale: 'en-US',
        userAgent: 'MissionControl/1.0.0',
      });
    }

    // Keepalive ping to prevent Cloudflare/proxy idle timeout
    pingInterval = setInterval(() => {
      if (!runtimeAvailableV1()) return;
      if (clientWs.readyState === WebSocket.OPEN) {
        clientWs.ping();
      }
    }, 20000);

    gatewayWs.on('open', () => {
      if (!runtimeAvailableV1()) return;
      gatewaySettled = true;
      console.log('[WS] Connected to gateway');
    });

    gatewayWs.on('message', (data) => {
      if (!runtimeAvailableV1()) return;
      const raw = data.toString();
      let msg: any;
      try {
        msg = JSON.parse(raw);
      } catch (e) {
        console.warn('[WS] Failed to parse gateway message:', raw.slice(0, 100));
        return;
      }

      // Handle connect.challenge → do handshake
      if (msg.type === 'event' && msg.event === 'connect.challenge') {
        console.log('[WS] Received challenge, doing handshake...');
        doHandshake();
        return;
      }

      // Handle all responses server-side (don't forward to client)
      if (msg.type === 'res') {
        if (!authenticated && msg.ok) {
          authenticated = true;
          console.log('[WS] Gateway authenticated');
        }
        return;
      }

      // Only forward chat events (delta + final) and agent lifecycle to client
      if (msg.type === 'event' && (msg.event === 'chat' || (msg.event === 'agent' && msg.payload?.stream === 'lifecycle'))) {
        if (clientWs.readyState === WebSocket.OPEN) {
          clientWs.send(raw);
        }
        return;
      }

      // Drop all other events (session, cron, system, etc.)
    });

    gatewayWs.on('close', (code, reason) => {
      if (!gatewaySettled) {
        logGatewayUnavailable(reason.toString() || `closed ${code}`);
      } else {
        console.log('[WS] Gateway closed:', code, reason.toString());
      }
      if (clientWs.readyState === WebSocket.OPEN) {
        clientWs.close(gatewaySettled ? code : 1013, gatewaySettled ? reason.toString() : 'Gateway unavailable');
      }
      releaseClosedPairV1();
    });

    gatewayWs.on('error', (err) => {
      if (!gatewaySettled) {
        logGatewayUnavailable(err.message);
      } else {
        console.error('[WS] Gateway error:', err.message);
      }
      if (clientWs.readyState === WebSocket.OPEN) {
        clientWs.close(gatewaySettled ? 1011 : 1013, gatewaySettled ? 'Gateway error' : 'Gateway unavailable');
      }
    });

    // Client messages: wrap as gateway requests if needed
    clientWs.on('message', (data) => {
      if (!runtimeAvailableV1()) return;
      if (!gatewayWs || gatewayWs.readyState !== WebSocket.OPEN) return;

      const raw = data.toString();
      let msg: any;
      try {
        msg = JSON.parse(raw);
      } catch (e) {
        console.warn('[WS] Failed to parse client message:', raw.slice(0, 100));
        return;
      }

      // If client sends a chat message, wrap it as a gateway request
      if (msg.type === 'message' && msg.to && msg.content) {
        sendReq('chat.send', {
          sessionKey: `agent:${msg.to}:main`,
          message: msg.content,
          idempotencyKey: `mc-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        });
        return;
      }

      // Drop unrecognized client message types
      console.warn('[WS] Dropping unrecognized client message type');
      return;
    });

    clientWs.on('close', () => {
      console.log('[WS] Client disconnected');
      clearInterval(pingInterval);
      if (gatewayWs && gatewayWs.readyState === WebSocket.OPEN) {
        gatewayWs.close();
      }
      releaseClosedPairV1();
    });

    clientWs.on('error', (err) => {
      console.error('[WS] Client error:', err.message);
    clearInterval(pingInterval);
      if (gatewayWs && gatewayWs.readyState === WebSocket.OPEN) {
        gatewayWs.close();
      }
    });
  });

  return wss;
}
