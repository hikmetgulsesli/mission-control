import { WebSocketServer, WebSocket } from 'ws';
import type { Server } from 'http';
import { config } from './config.js';

export function setupWsProxy(server: Server) {
  const wss = new WebSocketServer({ server, path: '/ws' });

  wss.on('connection', (clientWs, req) => {
    console.log('[WS] Client connected from', req.socket.remoteAddress);

    let gatewayWs: WebSocket | null = null;
    let authenticated = false;
    let reqId = 0;

    try {
      gatewayWs = new WebSocket(config.gatewayWs, {
        headers: { Origin: 'https://moltclaw.tail215fa3.ts.net:3080' },
      });
    } catch (err) {
      console.error('[WS] Failed to connect to gateway:', err);
      clientWs.close(1011, 'Gateway connection failed');
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
        minProtocol: 3,
        maxProtocol: 3,
        client: { id: 'webchat', version: '0.5.0', platform: 'web', mode: 'webchat' },
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
    const pingInterval = setInterval(() => {
      if (clientWs.readyState === WebSocket.OPEN) {
        clientWs.ping();
      }
    }, 20000);

    gatewayWs.on('open', () => {
      console.log('[WS] Connected to gateway');
    });

    gatewayWs.on('message', (data) => {
      const raw = data.toString();
      let msg: any;
      try {
        msg = JSON.parse(raw);
      } catch {
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
      console.log('[WS] Gateway closed:', code, reason.toString());
      if (clientWs.readyState === WebSocket.OPEN) {
        clientWs.close(code, reason.toString());
      }
    });

    gatewayWs.on('error', (err) => {
      console.error('[WS] Gateway error:', err.message);
      if (clientWs.readyState === WebSocket.OPEN) {
        clientWs.close(1011, 'Gateway error');
      }
    });

    // Client messages: wrap as gateway requests if needed
    clientWs.on('message', (data) => {
      if (!gatewayWs || gatewayWs.readyState !== WebSocket.OPEN) return;

      const raw = data.toString();
      let msg: any;
      try {
        msg = JSON.parse(raw);
      } catch {
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

      // Otherwise forward raw
      gatewayWs.send(raw);
    });

    clientWs.on('close', () => {
      console.log('[WS] Client disconnected');
      clearInterval(pingInterval);
      if (gatewayWs && gatewayWs.readyState === WebSocket.OPEN) {
        gatewayWs.close();
      }
    });

    clientWs.on('error', (err) => {
      console.error('[WS] Client error:', err.message);
      if (gatewayWs && gatewayWs.readyState === WebSocket.OPEN) {
        gatewayWs.close();
      }
    });
  });

  return wss;
}
