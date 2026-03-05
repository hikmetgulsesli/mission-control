import { WebSocket } from 'ws';
import type { Server } from 'http';
export declare function setupWsProxy(server: Server): import("ws").Server<typeof WebSocket, typeof import("http").IncomingMessage>;
