/**
 * Browser side of a private room: one WebSocket, typed messages, round-trip timing, and
 * automatic rejoin with the seat token if the connection blips.
 */
import { PROTOCOL_VERSION, encode } from './protocol';
import type { ClientMsg, ErrorCode, RoomInfo, ServerMsg } from './protocol';

export type SnapMsg = Extract<ServerMsg, { t: 'snap' }>;
export type StartMsg = Extract<ServerMsg, { t: 'start' }>;

export const ERROR_TEXT: Record<ErrorCode, string> = {
  version: 'This copy of the game is out of date for online play. Refresh to update.',
  bad_message: 'Something got scrambled on the way. Try again.',
  not_found: 'That room has closed, or the code is not quite right.',
  full: 'That room already has two players.',
  in_progress: 'They are in the middle of a round. Try again in a minute.',
  not_in_room: 'You are not in a room yet.',
  rate: 'Slow down a little.',
  server_full: 'The party server is full right now. Try again soon.',
};

export class RoomClient {
  room: RoomInfo | null = null;
  rttMs = 0;
  connected = false;
  onRoom: ((room: RoomInfo) => void) | null = null;
  onStart: ((msg: StartMsg) => void) | null = null;
  onSnap: ((msg: SnapMsg) => void) | null = null;
  onPaused: ((seat: 0 | 1, secondsLeft: number) => void) | null = null;
  onResumed: ((bot: boolean) => void) | null = null;
  onError: ((code: ErrorCode, text: string) => void) | null = null;
  /** connection lost for good (after rejoin attempts) or closed by us */
  onClosed: ((byUser: boolean) => void) | null = null;
  /** connection dropped and we are trying to get back in */
  onReconnecting: ((attempt: number) => void) | null = null;

  private ws: WebSocket | null = null;
  private closedByUser = false;
  private pingTimer = 0;
  private retry = 0;
  private name = 'Guest';
  private spec: unknown = null;

  constructor(readonly url: string) {}

  /** Opens the socket and completes the hello handshake. Rejects if the server is unreachable. */
  connect(name: string, spec: unknown): Promise<void> {
    this.name = name;
    this.spec = spec;
    this.closedByUser = false;
    return this.open();
  }

  private open(): Promise<void> {
    return new Promise((resolve, reject) => {
      let settled = false;
      let ws: WebSocket;
      try {
        ws = new WebSocket(this.url);
      } catch (err) {
        reject(err instanceof Error ? err : new Error(String(err)));
        return;
      }
      this.ws = ws;
      const timeout = window.setTimeout(() => {
        if (!settled) {
          settled = true;
          ws.close();
          reject(new Error('The room server did not answer.'));
        }
      }, 6000);
      ws.onopen = () => this.send({ t: 'hello', v: PROTOCOL_VERSION, name: this.name, spec: this.spec });
      ws.onmessage = (ev) => {
        let msg: ServerMsg;
        try {
          msg = JSON.parse(String(ev.data)) as ServerMsg;
        } catch {
          return;
        }
        if (msg.t === 'welcome' && !settled) {
          settled = true;
          window.clearTimeout(timeout);
          this.connected = true;
          this.retry = 0;
          this.startPings();
          resolve();
          return;
        }
        if (msg.t === 'error' && !settled && msg.code === 'version') {
          settled = true;
          window.clearTimeout(timeout);
          reject(new Error(ERROR_TEXT.version));
          return;
        }
        this.dispatch(msg);
      };
      ws.onclose = () => {
        window.clearTimeout(timeout);
        window.clearInterval(this.pingTimer);
        this.connected = false;
        if (!settled) {
          settled = true;
          reject(new Error('Could not reach the room server.'));
          return;
        }
        if (this.ws === ws) this.handleDrop();
      };
      ws.onerror = () => {
        /* onclose follows */
      };
    });
  }

  private dispatch(msg: ServerMsg): void {
    switch (msg.t) {
      case 'room':
        this.room = msg.room;
        this.onRoom?.(msg.room);
        break;
      case 'start':
        this.onStart?.(msg);
        break;
      case 'snap':
        this.onSnap?.(msg);
        break;
      case 'paused':
        this.onPaused?.(msg.seat, msg.secondsLeft);
        break;
      case 'resumed':
        this.onResumed?.(msg.bot);
        break;
      case 'error':
        if (msg.code === 'not_found' && this.room) this.room = null;
        this.onError?.(msg.code, ERROR_TEXT[msg.code] ?? msg.message);
        break;
      case 'pong':
        this.rttMs = this.rttMs === 0 ? performance.now() - msg.c : this.rttMs * 0.8 + (performance.now() - msg.c) * 0.2;
        break;
    }
  }

  private startPings(): void {
    window.clearInterval(this.pingTimer);
    this.pingTimer = window.setInterval(() => this.send({ t: 'ping', c: performance.now() }), 2000);
    this.send({ t: 'ping', c: performance.now() });
  }

  /** The socket died without us asking. If we hold a seat, try to get it back. */
  private handleDrop(): void {
    if (this.closedByUser) {
      this.onClosed?.(true);
      return;
    }
    const seat = this.room;
    if (!seat || this.retry >= 8) {
      this.room = null;
      this.onClosed?.(false);
      return;
    }
    this.retry++;
    this.onReconnecting?.(this.retry);
    window.setTimeout(() => {
      if (this.closedByUser) return;
      this.open()
        .then(() => this.send({ t: 'rejoin', code: seat.code, token: seat.token }))
        .catch(() => this.handleDrop());
    }, 900);
  }

  send(msg: ClientMsg): void {
    const ws = this.ws;
    if (ws && ws.readyState === WebSocket.OPEN) ws.send(encode(msg));
  }

  close(): void {
    this.closedByUser = true;
    window.clearInterval(this.pingTimer);
    try {
      this.send({ t: 'leave' });
      this.ws?.close();
    } catch {
      /* already closed */
    }
    this.ws = null;
    this.room = null;
    this.connected = false;
  }
}

/**
 * Where the room server lives. Order: ?server= in the URL, a build-time VITE_ROOM_SERVER,
 * then port 8787 on the same host when developing locally. Returns null when online play has
 * nowhere to connect (for example a static host with no server deployed).
 */
export function roomServerUrl(): string | null {
  try {
    const q = new URLSearchParams(window.location.search).get('server');
    if (q && /^wss?:\/\/[\w.\-:[\]]+(\/[\w\-./]*)?$/.test(q)) return q;
  } catch {
    /* no location */
  }
  const built = (import.meta.env?.VITE_ROOM_SERVER as string | undefined) ?? '';
  if (built) return built;
  const h = window.location.hostname;
  if (h === 'localhost' || h === '127.0.0.1') return `ws://${h}:8787`;
  return null;
}
