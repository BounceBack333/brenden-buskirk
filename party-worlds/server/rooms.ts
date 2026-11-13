/**
 * Private rooms for Catapult Courier. Transport-agnostic: a `Conn` is anything that can send a
 * string and be closed, so the same code is driven by real WebSockets (server/main.ts) and by
 * in-memory pairs in tests.
 *
 * The server is the only place the round is simulated for real. It applies each seat's latest
 * input every tick, broadcasts snapshots, and decides every catch and every point.
 */
import { randomBytes, randomInt } from 'node:crypto';
import { BuddyBot } from '../src/attractions/courier/bot';
import { DEFAULT_ARENA } from '../src/attractions/courier/rules';
import { createCourier, noInput, stepCourier } from '../src/attractions/courier/sim';
import type { CourierEvent, CourierState, PlayerInput } from '../src/attractions/courier/sim';
import {
  PROTOCOL_VERSION, ROOM_ALPHABET, ROOM_CODE_LENGTH, encode, packInput, parseClientMsg, snapshotOf, unpackInput,
} from '../src/net/protocol';
import type { ClientMsg, ErrorCode, RoomInfo, SeatPublic, ServerMsg } from '../src/net/protocol';

export interface Conn {
  send(data: string): void;
  close(): void;
}

export interface LobbyOptions {
  /** seconds a dropped player has to come back before a bot finishes the round for them */
  rejoinGraceSeconds: number;
  /** seconds an empty room survives */
  emptyRoomSeconds: number;
  /** seconds an idle lobby/results room survives */
  idleRoomSeconds: number;
  maxRooms: number;
  /** ticks between snapshots (2 = 30 Hz) */
  snapshotEvery: number;
  maxMessagesPerSecond: number;
  launches: number;
  botSkill: number;
}

export const DEFAULT_OPTIONS: LobbyOptions = {
  rejoinGraceSeconds: 10,
  emptyRoomSeconds: 60,
  idleRoomSeconds: 15 * 60,
  maxRooms: 500,
  snapshotEvery: 2,
  maxMessagesPerSecond: 150,
  launches: 6,
  botSkill: 0.62,
};

interface Seat {
  token: string;
  name: string;
  spec: unknown;
  ready: boolean;
  conn: Conn | null;
  /** the input applied on the most recent tick (repeated if the queue runs dry) */
  input: PlayerInput;
  /** inputs received but not yet applied: one is consumed per tick, in order */
  queue: { n: number; input: PlayerInput }[];
  /** sequence number of the newest input received */
  lastQueuedN: number;
  /** sequence number of the newest input actually applied (what clients reconcile against) */
  lastInputN: number;
  bot: BuddyBot | null;
  droppedAtMs: number;
}

interface Session {
  conn: Conn;
  hello: { name: string; spec: unknown } | null;
  room: Room | null;
  seat: 0 | 1;
  windowStart: number;
  windowCount: number;
}

class Room {
  phase: 'lobby' | 'playing' | 'results' = 'lobby';
  seats: [Seat | null, Seat | null] = [null, null];
  state: CourierState | null = null;
  rounds = 0;
  pendingEvents: CourierEvent[] = [];
  /** ms timestamp; while > 0 the sim is frozen waiting for a rejoin */
  pausedSince = 0;
  pausedSeat: 0 | 1 = 0;
  lastActivityMs: number;
  emptySinceMs = 0;
  lastPauseNoticeSec = -1;

  constructor(readonly code: string, nowMs: number) {
    this.lastActivityMs = nowMs;
  }

  occupied(): number {
    return (this.seats[0] ? 1 : 0) + (this.seats[1] ? 1 : 0);
  }
  connected(): number {
    return (this.seats[0]?.conn ? 1 : 0) + (this.seats[1]?.conn ? 1 : 0);
  }
}

export class Lobby {
  readonly rooms = new Map<string, Room>();
  private sessions = new Map<Conn, Session>();
  readonly opts: LobbyOptions;
  /** counters for monitoring and tests */
  stats = { messages: 0, rejected: 0, roundsStarted: 0, roundsFinished: 0, botTakeovers: 0, rejoins: 0 };

  constructor(opts: Partial<LobbyOptions> = {}, private now: () => number = () => Date.now()) {
    this.opts = { ...DEFAULT_OPTIONS, ...opts };
  }

  // ───────────────────────────── connections ─────────────────────────────

  connect(conn: Conn): void {
    this.sessions.set(conn, { conn, hello: null, room: null, seat: 0, windowStart: this.now(), windowCount: 0 });
  }

  disconnect(conn: Conn): void {
    const ses = this.sessions.get(conn);
    if (!ses) return;
    this.sessions.delete(conn);
    const room = ses.room;
    if (!room) return;
    const seat = room.seats[ses.seat];
    if (!seat || seat.conn !== conn) return;
    seat.conn = null;
    seat.ready = false;
    seat.input = noInput();
    seat.queue = [];
    seat.droppedAtMs = this.now();
    if (room.phase === 'playing' && !seat.bot) {
      // hold the round for a moment: a dropped connection is usually a tunnel or a phone call
      if (!room.pausedSince) {
        room.pausedSince = this.now();
        room.pausedSeat = ses.seat;
        room.lastPauseNoticeSec = -1;
      }
    } else if (room.phase !== 'playing') {
      // in the lobby or on the results screen a leaver frees the seat for someone else
      room.seats[ses.seat] = null;
    }
    if (room.connected() === 0) room.emptySinceMs = this.now();
    this.broadcastRoom(room);
  }

  receive(conn: Conn, raw: string): void {
    const ses = this.sessions.get(conn);
    if (!ses) return;
    this.stats.messages++;
    const t = this.now();
    if (t - ses.windowStart >= 1000) {
      ses.windowStart = t;
      ses.windowCount = 0;
    }
    if (++ses.windowCount > this.opts.maxMessagesPerSecond) {
      this.stats.rejected++;
      if (ses.windowCount === this.opts.maxMessagesPerSecond + 1) this.error(conn, 'rate', 'Too many messages.');
      return;
    }
    const msg = parseClientMsg(raw);
    if (!msg) {
      this.stats.rejected++;
      this.error(conn, 'bad_message', 'Message not understood.');
      return;
    }
    this.handle(ses, msg);
  }

  private send(conn: Conn | null | undefined, msg: ServerMsg): void {
    if (!conn) return;
    try {
      conn.send(encode(msg));
    } catch {
      /* a dying socket; its close handler will clean up */
    }
  }

  private error(conn: Conn, code: ErrorCode, message: string): void {
    this.send(conn, { t: 'error', code, message });
  }

  // ───────────────────────────── messages ─────────────────────────────

  private handle(ses: Session, msg: ClientMsg): void {
    switch (msg.t) {
      case 'hello':
        if (msg.v !== PROTOCOL_VERSION) {
          this.error(ses.conn, 'version', 'This game needs an update to play online with this server.');
          return;
        }
        ses.hello = { name: msg.name, spec: msg.spec };
        this.send(ses.conn, { t: 'welcome', v: PROTOCOL_VERSION });
        return;
      case 'ping':
        this.send(ses.conn, { t: 'pong', c: msg.c, s: this.now() });
        return;
      case 'create':
        if (!this.requireHello(ses)) return;
        this.leaveRoom(ses);
        this.createRoom(ses);
        return;
      case 'join':
        if (!this.requireHello(ses)) return;
        this.joinRoom(ses, msg.code);
        return;
      case 'rejoin':
        if (!this.requireHello(ses)) return;
        this.rejoinRoom(ses, msg.code, msg.token);
        return;
      case 'ready': {
        const room = ses.room;
        const seat = room?.seats[ses.seat];
        if (!room || !seat) return this.error(ses.conn, 'not_in_room', 'Join a room first.');
        if (room.phase === 'playing') return;
        seat.ready = msg.ready;
        room.lastActivityMs = this.now();
        this.maybeStart(room);
        this.broadcastRoom(room);
        return;
      }
      case 'input': {
        const room = ses.room;
        const seat = room?.seats[ses.seat];
        if (!room || !seat || room.phase !== 'playing' || seat.bot) return;
        if (msg.n <= seat.lastQueuedN) return; // stale or duplicated packet
        seat.lastQueuedN = msg.n;
        seat.queue.push({ n: msg.n, input: unpackInput(msg.i, noInput()) });
        // a burst after a stall: keep only the freshest few so the seat catches up instead of lagging
        if (seat.queue.length > 6) seat.queue.splice(0, seat.queue.length - 2);
        return;
      }
      case 'leave':
        this.leaveRoom(ses);
        return;
    }
  }

  private requireHello(ses: Session): boolean {
    if (ses.hello) return true;
    this.error(ses.conn, 'bad_message', 'Say hello first.');
    return false;
  }

  private newCode(): string | null {
    for (let attempt = 0; attempt < 50; attempt++) {
      let code = '';
      for (let i = 0; i < ROOM_CODE_LENGTH; i++) code += ROOM_ALPHABET[randomInt(ROOM_ALPHABET.length)];
      if (!this.rooms.has(code)) return code;
    }
    return null;
  }

  private makeSeat(ses: Session): Seat {
    return {
      token: randomBytes(16).toString('hex'),
      name: ses.hello!.name,
      spec: ses.hello!.spec,
      ready: false,
      conn: ses.conn,
      input: noInput(),
      queue: [],
      lastQueuedN: -1,
      lastInputN: -1,
      bot: null,
      droppedAtMs: 0,
    };
  }

  private createRoom(ses: Session): void {
    if (this.rooms.size >= this.opts.maxRooms) return this.error(ses.conn, 'server_full', 'The party server is full right now.');
    const code = this.newCode();
    if (!code) return this.error(ses.conn, 'server_full', 'Could not make a room code. Try again.');
    const room = new Room(code, this.now());
    room.seats[0] = this.makeSeat(ses);
    this.rooms.set(code, room);
    ses.room = room;
    ses.seat = 0;
    this.broadcastRoom(room);
  }

  private joinRoom(ses: Session, code: string): void {
    const room = this.rooms.get(code);
    if (!room) return this.error(ses.conn, 'not_found', 'That room has closed or the code is wrong.');
    if (ses.room === room) return this.broadcastRoom(room);
    if (room.phase === 'playing') return this.error(ses.conn, 'in_progress', 'They are mid-round. Try again in a minute.');
    if (room.seats[0] && room.seats[1]) return this.error(ses.conn, 'full', 'That room already has two players.');
    const free: 0 | 1 = room.seats[0] ? 1 : 0;
    this.leaveRoom(ses);
    room.seats[free] = this.makeSeat(ses);
    ses.room = room;
    ses.seat = free;
    room.emptySinceMs = 0;
    room.lastActivityMs = this.now();
    this.broadcastRoom(room);
  }

  private rejoinRoom(ses: Session, code: string, token: string): void {
    const room = this.rooms.get(code);
    if (!room) return this.error(ses.conn, 'not_found', 'That room has closed.');
    const idx = room.seats.findIndex((s) => s !== null && s.token === token);
    if (idx < 0) return this.error(ses.conn, 'not_found', 'Your seat in that room is gone.');
    const seat = room.seats[idx]!;
    if (seat.conn && seat.conn !== ses.conn) {
      // the old socket is a zombie; the newest connection wins
      const old = seat.conn;
      const oldSes = this.sessions.get(old);
      if (oldSes) oldSes.room = null;
      try { old.close(); } catch { /* already gone */ }
    }
    this.leaveRoom(ses);
    seat.conn = ses.conn;
    seat.name = ses.hello!.name;
    seat.input = noInput();
    seat.queue = [];
    seat.lastQueuedN = -1;
    seat.lastInputN = -1;
    ses.room = room;
    ses.seat = idx as 0 | 1;
    room.emptySinceMs = 0;
    room.lastActivityMs = this.now();
    this.stats.rejoins++;
    if (room.phase === 'playing') {
      if (seat.bot) seat.bot = null; // the human takes the seat back from the bot
      if (room.pausedSince && room.pausedSeat === idx) {
        room.pausedSince = 0;
        this.broadcast(room, { t: 'resumed', bot: false });
      }
      this.send(ses.conn, { t: 'start', arenaId: room.state!.arenaId, launches: room.state!.launches, firstLauncher: 0 });
    }
    this.broadcastRoom(room);
    if (room.phase === 'playing') this.sendSnapshot(room, true);
  }

  private leaveRoom(ses: Session): void {
    const room = ses.room;
    if (!room) return;
    ses.room = null;
    const seat = room.seats[ses.seat];
    if (!seat || seat.conn !== ses.conn) return;
    if (room.phase === 'playing') {
      // leaving on purpose: no waiting, a bot finishes the round so the other player is not robbed of it
      seat.conn = null;
      this.botTakeover(room, ses.seat);
    } else {
      room.seats[ses.seat] = null;
    }
    if (room.connected() === 0) room.emptySinceMs = this.now();
    this.broadcastRoom(room);
  }

  // ───────────────────────────── rounds ─────────────────────────────

  private maybeStart(room: Room): void {
    const [a, b] = room.seats;
    if (room.phase === 'playing' || !a || !b || !a.ready || !b.ready || !a.conn || !b.conn) return;
    const firstLauncher: 0 | 1 = room.rounds % 2 === 0 ? 0 : 1; // rematches alternate who flies first
    room.state = createCourier({ arenaId: DEFAULT_ARENA, launches: this.opts.launches, firstLauncher });
    room.phase = 'playing';
    room.pendingEvents = [];
    room.pausedSince = 0;
    for (const s of room.seats) {
      if (!s) continue;
      s.input = noInput();
      s.queue = [];
      s.lastQueuedN = -1;
      s.lastInputN = -1;
      s.bot = null;
      s.ready = false;
    }
    this.stats.roundsStarted++;
    this.broadcast(room, { t: 'start', arenaId: room.state.arenaId, launches: room.state.launches, firstLauncher });
    this.sendSnapshot(room, true);
  }

  private botTakeover(room: Room, seatIdx: 0 | 1): void {
    const seat = room.seats[seatIdx];
    if (!seat || seat.bot) return;
    seat.bot = new BuddyBot({ seed: randomInt(1, 1 << 30), skill: this.opts.botSkill });
    this.stats.botTakeovers++;
    if (room.pausedSince) {
      room.pausedSince = 0;
      this.broadcast(room, { t: 'resumed', bot: true });
    }
  }

  /** Advance every room by one simulation tick. Call at 60 Hz. */
  tick(): void {
    const nowMs = this.now();
    for (const room of this.rooms.values()) {
      if (room.phase === 'playing' && room.state) this.tickRoom(room, nowMs);
      this.reap(room, nowMs);
    }
  }

  private readonly stepInputs: [PlayerInput, PlayerInput] = [noInput(), noInput()];

  private tickRoom(room: Room, nowMs: number): void {
    const s = room.state!;
    if (room.pausedSince) {
      const waited = (nowMs - room.pausedSince) / 1000;
      const left = Math.max(0, Math.ceil(this.opts.rejoinGraceSeconds - waited));
      if (left !== room.lastPauseNoticeSec) {
        room.lastPauseNoticeSec = left;
        this.broadcast(room, { t: 'paused', seat: room.pausedSeat, secondsLeft: left });
      }
      if (waited < this.opts.rejoinGraceSeconds) return;
      this.botTakeover(room, room.pausedSeat);
      // if the other seat also dropped during the pause, hand it to a bot too so the round can end
      const other = room.pausedSeat === 0 ? 1 : 0;
      if (room.seats[other] && !room.seats[other]!.conn) this.botTakeover(room, other);
      this.broadcastRoom(room);
    }
    for (const i of [0, 1] as const) {
      const seat = room.seats[i];
      if (seat && !seat.bot) {
        const next = seat.queue.shift();
        if (next) {
          seat.input = next.input;
          seat.lastInputN = next.n;
        }
      }
      this.stepInputs[i] = seat ? (seat.bot ? seat.bot.think(s, i) : seat.input) : noInput();
    }
    stepCourier(s, this.stepInputs);
    for (const e of s.events) room.pendingEvents.push(e);
    const finished = s.phase === 'done';
    if (finished || s.tick % this.opts.snapshotEvery === 0) this.sendSnapshot(room, false);
    if (finished) {
      room.phase = 'results';
      room.rounds++;
      room.lastActivityMs = nowMs;
      this.stats.roundsFinished++;
      // a seat whose player never came back is freed now that the round is over
      for (const i of [0, 1] as const) {
        const seat = room.seats[i];
        if (seat && !seat.conn) room.seats[i] = null;
        else if (seat) seat.bot = null;
      }
      if (room.connected() === 0) room.emptySinceMs = nowMs;
      this.broadcastRoom(room);
    }
  }

  private sendSnapshot(room: Room, force: boolean): void {
    const s = room.state;
    if (!s) return;
    const ev = room.pendingEvents;
    if (!force && ev.length === 0 && s.phase === 'done') return;
    const snap = snapshotOf(s);
    for (const i of [0, 1] as const) {
      const seat = room.seats[i];
      if (!seat?.conn) continue;
      const other = room.seats[i === 0 ? 1 : 0];
      this.send(seat.conn, { t: 'snap', s: snap, ev, ack: seat.lastInputN, other: packInput(other ? other.input : noInput()) });
    }
    room.pendingEvents = [];
  }

  private reap(room: Room, nowMs: number): void {
    const empty = room.connected() === 0;
    if (empty && !room.emptySinceMs) room.emptySinceMs = nowMs;
    const emptyTooLong = empty && nowMs - room.emptySinceMs > this.opts.emptyRoomSeconds * 1000;
    const idleTooLong = room.phase !== 'playing' && nowMs - room.lastActivityMs > this.opts.idleRoomSeconds * 1000;
    // a round with nobody watching still finishes quickly thanks to the bots, but do not keep it forever
    if (emptyTooLong || idleTooLong) {
      for (const seat of room.seats) {
        if (seat?.conn) {
          const ses = this.sessions.get(seat.conn);
          if (ses) ses.room = null;
          this.error(seat.conn, 'not_found', 'The room closed because nobody was playing.');
        }
      }
      this.rooms.delete(room.code);
    }
  }

  // ───────────────────────────── room info ─────────────────────────────

  private publicSeat(seat: Seat | null): SeatPublic | null {
    if (!seat) return null;
    return { name: seat.name, spec: seat.spec, ready: seat.ready, connected: !!seat.conn, bot: !!seat.bot };
  }

  private broadcastRoom(room: Room): void {
    const seats: RoomInfo['seats'] = [this.publicSeat(room.seats[0]), this.publicSeat(room.seats[1])];
    for (const i of [0, 1] as const) {
      const seat = room.seats[i];
      if (!seat?.conn) continue;
      this.send(seat.conn, { t: 'room', room: { code: room.code, phase: room.phase, seats, you: i, token: seat.token, rounds: room.rounds } });
    }
  }

  private broadcast(room: Room, msg: ServerMsg): void {
    for (const seat of room.seats) this.send(seat?.conn, msg);
  }
}
