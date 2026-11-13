/**
 * Wire protocol for private rooms. Shared by the browser client and the Node room server.
 *
 * v1 is JSON for debuggability. Messages are tiny; the budget section of docs/NETWORKING.md
 * records measured sizes and the plan to go binary if needed.
 *
 * Trust model: the server owns the simulation. Clients only ever send inputs. Nothing a client
 * says about positions, catches or scores is believed, because nothing of the sort is sent.
 */
import type { CourierEvent, CourierState, PlayerInput } from '../attractions/courier/sim';

export const PROTOCOL_VERSION = 1;
export const MAX_MESSAGE_BYTES = 4096;
export const ROOM_CODE_LENGTH = 4;
/** No vowels (no accidental words), no look-alikes. */
export const ROOM_ALPHABET = 'BCDFGHJKLMNPQRSTVWXZ';

/** [pull, aimQ, powerQ, umbrella, move, dive] */
export type InputTuple = [number, number, number, number, number, number];

export function packInput(i: PlayerInput): InputTuple {
  return [i.pull ? 1 : 0, i.aimQ | 0, i.powerQ | 0, i.umbrella ? 1 : 0, i.move | 0, i.dive ? 1 : 0];
}

export function unpackInput(t: InputTuple, out: PlayerInput): PlayerInput {
  out.pull = t[0] === 1;
  out.aimQ = clampInt(t[1], 0, 1023);
  out.powerQ = clampInt(t[2], 0, 255);
  out.umbrella = t[3] === 1;
  out.move = clampInt(t[4], -127, 127);
  out.dive = t[5] === 1;
  return out;
}

function clampInt(v: unknown, lo: number, hi: number): number {
  const n = typeof v === 'number' && Number.isFinite(v) ? Math.round(v) : 0;
  return n < lo ? lo : n > hi ? hi : n;
}

export type RoomPhase = 'lobby' | 'playing' | 'results';

export interface SeatPublic {
  name: string;
  /** CharacterSpec as data; receivers must run it through sanitizeSpec before building anything. */
  spec: unknown;
  ready: boolean;
  connected: boolean;
  /** true once a bot has taken over this seat for the rest of the round */
  bot: boolean;
}

export interface RoomInfo {
  code: string;
  phase: RoomPhase;
  seats: [SeatPublic | null, SeatPublic | null];
  /** which seat the receiver occupies */
  you: 0 | 1;
  /** secret for rejoining this seat after a dropped connection; only ever sent to its owner */
  token: string;
  /** rounds completed in this room (rematches keep the group together) */
  rounds: number;
}

export type ErrorCode =
  | 'version' // client and server speak different protocol versions
  | 'bad_message'
  | 'not_found' // no such room (expired or mistyped invitation)
  | 'full'
  | 'in_progress' // room is mid-round and this is not a rejoin
  | 'not_in_room'
  | 'rate'
  | 'server_full';

export type ClientMsg =
  | { t: 'hello'; v: number; name: string; spec: unknown }
  | { t: 'create' }
  | { t: 'join'; code: string }
  | { t: 'rejoin'; code: string; token: string }
  | { t: 'ready'; ready: boolean }
  | { t: 'input'; n: number; i: InputTuple }
  | { t: 'leave' }
  | { t: 'ping'; c: number };

/** CourierState without its transient event list. */
export type SnapshotState = Omit<CourierState, 'events'>;

export type ServerMsg =
  | { t: 'welcome'; v: number }
  | { t: 'room'; room: RoomInfo }
  | { t: 'start'; arenaId: string; launches: number; firstLauncher: 0 | 1 }
  | {
      t: 'snap';
      /** authoritative state after `s.tick` ticks */
      s: SnapshotState;
      /** events from every tick since the previous snapshot, in order */
      ev: CourierEvent[];
      /** the highest input sequence number of yours the server had applied */
      ack: number;
      /** the other seat's most recent input, so clients can extrapolate between snapshots */
      other: InputTuple;
    }
  | { t: 'paused'; seat: 0 | 1; secondsLeft: number }
  | { t: 'resumed'; bot: boolean }
  | { t: 'error'; code: ErrorCode; message: string }
  | { t: 'pong'; c: number; s: number };

const NAME_MAX = 18;

export function cleanName(v: unknown): string {
  const s = typeof v === 'string' ? v : '';
  // strip control characters and angle brackets; names are shown to other players
  const out = s.replace(/[\u0000-\u001f\u007f<>]/g, '').trim().slice(0, NAME_MAX);
  return out || 'Guest';
}

export function isRoomCode(v: unknown): v is string {
  if (typeof v !== 'string' || v.length !== ROOM_CODE_LENGTH) return false;
  for (const ch of v) if (!ROOM_ALPHABET.includes(ch)) return false;
  return true;
}

/** Parse and validate a client message. Returns null for anything malformed. Never throws. */
export function parseClientMsg(raw: string): ClientMsg | null {
  if (typeof raw !== 'string' || raw.length > MAX_MESSAGE_BYTES) return null;
  let m: unknown;
  try {
    m = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!m || typeof m !== 'object') return null;
  const o = m as Record<string, unknown>;
  switch (o.t) {
    case 'hello':
      if (typeof o.v !== 'number') return null;
      return { t: 'hello', v: o.v, name: cleanName(o.name), spec: o.spec ?? null };
    case 'create':
      return { t: 'create' };
    case 'join': {
      const code = typeof o.code === 'string' ? o.code.toUpperCase().trim() : '';
      return isRoomCode(code) ? { t: 'join', code } : null;
    }
    case 'rejoin': {
      const code = typeof o.code === 'string' ? o.code.toUpperCase().trim() : '';
      if (!isRoomCode(code) || typeof o.token !== 'string' || o.token.length > 64) return null;
      return { t: 'rejoin', code, token: o.token };
    }
    case 'ready':
      return { t: 'ready', ready: o.ready === true };
    case 'input': {
      const i = o.i;
      if (typeof o.n !== 'number' || !Number.isFinite(o.n) || !Array.isArray(i) || i.length !== 6) return null;
      for (const v of i) if (typeof v !== 'number' || !Number.isFinite(v)) return null;
      return { t: 'input', n: Math.floor(o.n), i: i as InputTuple };
    }
    case 'leave':
      return { t: 'leave' };
    case 'ping':
      return typeof o.c === 'number' ? { t: 'ping', c: o.c } : null;
    default:
      return null;
  }
}

export function encode(msg: ClientMsg | ServerMsg): string {
  return JSON.stringify(msg);
}

export function snapshotOf(s: CourierState): SnapshotState {
  const { events: _events, ...rest } = s;
  return rest;
}
