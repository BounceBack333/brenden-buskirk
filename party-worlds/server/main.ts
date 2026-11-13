/**
 * Room server entry point.   npm run server   (PORT=8787 by default)
 *
 * One process, in-memory rooms, WebSocket transport, 60 Hz authoritative simulation.
 * This is the right size for private rooms with friends; it is not yet a production
 * deployment (no TLS termination, no horizontal scaling, no persistence, no accounts).
 */
import { createServer } from 'node:http';
import { WebSocketServer } from 'ws';
import type { WebSocket } from 'ws';
import { MAX_MESSAGE_BYTES, PROTOCOL_VERSION } from '../src/net/protocol';
import { Lobby } from './rooms';
import type { Conn, LobbyOptions } from './rooms';

export interface RunningServer {
  port: number;
  lobby: Lobby;
  close(): Promise<void>;
}

export function startServer(port: number, opts: Partial<LobbyOptions> = {}, allowedOrigins: string[] | null = null): Promise<RunningServer> {
  const lobby = new Lobby(opts);
  const http = createServer((req, res) => {
    if (req.url === '/health') {
      res.writeHead(200, { 'content-type': 'application/json', 'cache-control': 'no-store' });
      res.end(JSON.stringify({ ok: true, protocol: PROTOCOL_VERSION, rooms: lobby.rooms.size, stats: lobby.stats }));
      return;
    }
    res.writeHead(404, { 'content-type': 'text/plain' });
    res.end('BounceBack Party Worlds room server');
  });
  const wss = new WebSocketServer({ server: http, maxPayload: MAX_MESSAGE_BYTES, perMessageDeflate: false });

  wss.on('connection', (ws: WebSocket, req) => {
    if (allowedOrigins && !allowedOrigins.includes(String(req.headers.origin ?? ''))) {
      ws.close(1008, 'origin not allowed');
      return;
    }
    const conn: Conn = {
      send: (data) => {
        if (ws.readyState === ws.OPEN) ws.send(data);
      },
      close: () => ws.close(),
    };
    lobby.connect(conn);
    ws.on('message', (data, isBinary) => {
      if (isBinary) return;
      lobby.receive(conn, data.toString());
    });
    ws.on('close', () => lobby.disconnect(conn));
    ws.on('error', () => ws.terminate());
  });

  // Fixed 60 Hz simulation with drift correction; never more than a few catch-up steps.
  const stepMs = 1000 / 60;
  let last = performance.now();
  let acc = 0;
  const timer = setInterval(() => {
    const now = performance.now();
    acc += Math.min(250, now - last);
    last = now;
    let steps = 0;
    while (acc >= stepMs && steps < 8) {
      lobby.tick();
      acc -= stepMs;
      steps++;
    }
    if (steps === 8) acc = 0;
  }, 8);

  return new Promise((resolve) => {
    http.listen(port, () => {
      const address = http.address();
      const actual = typeof address === 'object' && address ? address.port : port;
      resolve({
        port: actual,
        lobby,
        close: () =>
          new Promise<void>((done) => {
            clearInterval(timer);
            for (const client of wss.clients) client.terminate();
            wss.close(() => http.close(() => done()));
          }),
      });
    });
  });
}

const isMain = process.argv[1] !== undefined && import.meta.url === new URL(`file://${process.argv[1]}`).href;
if (isMain) {
  const port = Number(process.env.PORT ?? 8787);
  const origins = process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',').map((s) => s.trim()) : null;
  // LAUNCHES=2 shortens rounds for automated tests; the default is the real six
  const launches = Number(process.env.LAUNCHES);
  const opts = Number.isFinite(launches) && launches >= 1 ? { launches: Math.min(6, Math.floor(launches)) } : {};
  void startServer(port, opts, origins).then((s) => {
    console.log(`room server listening on :${s.port} (protocol v${PROTOCOL_VERSION})`);
  });
}
