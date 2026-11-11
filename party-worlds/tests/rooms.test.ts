/**
 * Room server tests. Most drive the Lobby directly through in-memory connections with a fake
 * clock; the last one runs two real WebSocket clients against a real listening server.
 */
import { afterEach, describe, expect, it } from 'vitest';
import WebSocket from 'ws';
import { BuddyBot } from '../src/attractions/courier/bot';
import type { CourierState } from '../src/attractions/courier/sim';
import { PROTOCOL_VERSION, encode, packInput, parseClientMsg } from '../src/net/protocol';
import type { ClientMsg, RoomInfo, ServerMsg } from '../src/net/protocol';
import { Lobby } from '../server/rooms';
import type { Conn } from '../server/rooms';
import { startServer } from '../server/main';
import type { RunningServer } from '../server/main';

class FakeClient implements Conn {
  inbox: ServerMsg[] = [];
  room: RoomInfo | null = null;
  state: CourierState | null = null;
  errors: string[] = [];
  closed = false;
  started = 0;
  paused: number[] = [];
  resumed: boolean[] = [];
  n = 0;
  constructor(private lobby: Lobby, readonly name: string) {
    lobby.connect(this);
  }
  send(data: string): void {
    const msg = JSON.parse(data) as ServerMsg;
    this.inbox.push(msg);
    if (msg.t === 'room') this.room = msg.room;
    else if (msg.t === 'snap') this.state = { ...msg.s, events: msg.ev } as CourierState;
    else if (msg.t === 'error') this.errors.push(msg.code);
    else if (msg.t === 'start') this.started++;
    else if (msg.t === 'paused') this.paused.push(msg.secondsLeft);
    else if (msg.t === 'resumed') this.resumed.push(msg.bot);
  }
  close(): void {
    this.closed = true;
  }
  say(msg: ClientMsg): void {
    this.lobby.receive(this, encode(msg));
  }
  hello(v = PROTOCOL_VERSION): this {
    this.say({ t: 'hello', v, name: this.name, spec: { species: 'dog' } });
    return this;
  }
  drop(): void {
    this.lobby.disconnect(this);
  }
}

function setup(opts = {}): { lobby: Lobby; clock: { t: number }; a: FakeClient; b: FakeClient } {
  const clock = { t: 1_000_000 };
  const lobby = new Lobby(opts, () => clock.t);
  const a = new FakeClient(lobby, 'Rosa').hello();
  const b = new FakeClient(lobby, 'Theo').hello();
  return { lobby, clock, a, b };
}

function seatBoth(a: FakeClient, b: FakeClient): string {
  a.say({ t: 'create' });
  const code = a.room!.code;
  b.say({ t: 'join', code });
  return code;
}

/** Run the lobby with bots standing in for both humans' thumbs. */
function playOut(lobby: Lobby, clock: { t: number }, clients: FakeClient[], maxTicks = 60 * 240): void {
  const bots = clients.map((_, i) => new BuddyBot({ seed: 17 + i * 5, skill: 0.8 }));
  for (let t = 0; t < maxTicks; t++) {
    clients.forEach((c, i) => {
      if (c.closed || !c.room || !c.state || c.room.phase !== 'playing') return;
      const inp = bots[i]!.think(c.state, c.room.you);
      c.say({ t: 'input', n: c.n++, i: packInput(inp) });
    });
    clock.t += 1000 / 60;
    lobby.tick();
    if (clients.every((c) => c.room?.phase === 'results')) return;
  }
}

describe('protocol', () => {
  it('rejects malformed messages without throwing', () => {
    for (const raw of ['', '{', 'null', '[]', '{"t":"nope"}', '{"t":"join","code":"abc"}', '{"t":"join","code":"AEIO"}',
      '{"t":"input","n":1,"i":[1,2,3]}', '{"t":"input","n":"x","i":[0,0,0,0,0,0]}', '{"t":"hello"}', 'x'.repeat(5000)]) {
      expect(parseClientMsg(raw)).toBeNull();
    }
  });
  it('cleans names that will be shown to other players', () => {
    const m = parseClientMsg(JSON.stringify({ t: 'hello', v: 1, name: '  <img src=x onerror=1>Bob\u0000  ', spec: null }));
    const cleaned = m && m.t === 'hello' ? m.name : '';
    expect(cleaned).toBe('img src=x onerror=');
    expect(cleaned).not.toMatch(/[<>\u0000]/);
    const long = parseClientMsg(JSON.stringify({ t: 'hello', v: 1, name: 'x'.repeat(200), spec: null }));
    expect(long && long.t === 'hello' && long.name.length).toBe(18);
    const empty = parseClientMsg(JSON.stringify({ t: 'hello', v: 1, name: 5, spec: null }));
    expect(empty && empty.t === 'hello' && empty.name).toBe('Guest');
  });
  it('accepts lower-case room codes typed by a person', () => {
    const m = parseClientMsg('{"t":"join","code":" bcdf "}');
    expect(m).toEqual({ t: 'join', code: 'BCDF' });
  });
});

describe('joining', () => {
  it('creates a room, a friend joins with the code, both see each other', () => {
    const { a, b } = setup();
    const code = seatBoth(a, b);
    expect(code).toMatch(/^[BCDFGHJKLMNPQRSTVWXZ]{4}$/);
    expect(a.room!.you).toBe(0);
    expect(b.room!.you).toBe(1);
    expect(a.room!.seats[1]!.name).toBe('Theo');
    expect(b.room!.seats[0]!.name).toBe('Rosa');
    expect(a.room!.token).not.toBe(b.room!.token);
    expect(a.room!.token.length).toBeGreaterThanOrEqual(32);
  });

  it('explains an expired or mistyped invitation', () => {
    const { b } = setup();
    b.say({ t: 'join', code: 'ZZZZ' });
    expect(b.errors).toEqual(['not_found']);
  });

  it('refuses a third player', () => {
    const { lobby, a, b } = setup();
    const code = seatBoth(a, b);
    const c = new FakeClient(lobby, 'Imani').hello();
    c.say({ t: 'join', code });
    expect(c.errors).toEqual(['full']);
    expect(c.room).toBeNull();
  });

  it('refuses a mismatched protocol version with a human-readable reason', () => {
    const clock = { t: 0 };
    const lobby = new Lobby({}, () => clock.t);
    const old = new FakeClient(lobby, 'Old').hello(PROTOCOL_VERSION + 1);
    expect(old.errors).toEqual(['version']);
    old.say({ t: 'create' });
    expect(old.room).toBeNull();
  });

  it('a lobby leaver frees the seat for someone else', () => {
    const { lobby, a, b } = setup();
    const code = seatBoth(a, b);
    b.say({ t: 'leave' });
    expect(a.room!.seats[1]).toBeNull();
    const c = new FakeClient(lobby, 'Jun').hello();
    c.say({ t: 'join', code });
    expect(c.room!.you).toBe(1);
  });

  it('rate-limits a flooding client and survives garbage', () => {
    const { lobby, a } = setup({ maxMessagesPerSecond: 20 });
    for (let i = 0; i < 200; i++) a.say({ t: 'ping', c: i });
    expect(a.errors).toEqual(['rate']);
    lobby.receive(a, '{not json');
    lobby.receive(a, 'x'.repeat(100000));
    expect(lobby.stats.rejected).toBeGreaterThan(100);
  });
});

describe('a round', () => {
  it('starts only when both are ready, runs to completion, and both see the same result', () => {
    const { lobby, clock, a, b } = setup();
    seatBoth(a, b);
    a.say({ t: 'ready', ready: true });
    expect(a.started).toBe(0);
    b.say({ t: 'ready', ready: true });
    expect(a.started).toBe(1);
    expect(b.started).toBe(1);
    expect(a.room!.phase).toBe('playing');
    playOut(lobby, clock, [a, b]);
    expect(a.room!.phase).toBe('results');
    expect(a.state!.phase).toBe('done');
    expect(a.state!.results.length).toBe(6);
    expect(a.state!.total).toBe(b.state!.total);
    expect(a.state!.results).toEqual(b.state!.results);
    expect(lobby.stats.roundsFinished).toBe(1);
    // two capable bots through the real input path should catch most deliveries
    expect(a.state!.results.filter((r) => r.caught).length).toBeGreaterThanOrEqual(3);
  });

  it('ignores inputs from the wrong role and stale packets', () => {
    const { lobby, clock, a, b } = setup();
    seatBoth(a, b);
    a.say({ t: 'ready', ready: true });
    b.say({ t: 'ready', ready: true });
    for (let t = 0; t < 80; t++) { clock.t += 16.7; lobby.tick(); }
    expect(a.state!.phase).toBe('aim');
    // seat 1 is the catcher: its "pull" must not launch anything
    b.say({ t: 'input', n: 5, i: [1, 500, 220, 0, 0, 0] });
    for (let t = 0; t < 10; t++) { clock.t += 16.7; lobby.tick(); }
    b.say({ t: 'input', n: 6, i: [0, 500, 220, 0, 0, 0] });
    for (let t = 0; t < 10; t++) { clock.t += 16.7; lobby.tick(); }
    expect(a.state!.phase).toBe('aim');
    // a replayed older packet is dropped
    a.say({ t: 'input', n: 10, i: [1, 500, 220, 0, 0, 0] });
    a.say({ t: 'input', n: 3, i: [0, 0, 0, 0, 0, 0] });
    for (let t = 0; t < 4; t++) { clock.t += 16.7; lobby.tick(); }
    expect(a.state!.aim.pulling).toBe(true);
  });

  it('rematch keeps the group together and alternates who flies first', () => {
    const { lobby, clock, a, b } = setup({ launches: 2 });
    seatBoth(a, b);
    a.say({ t: 'ready', ready: true });
    b.say({ t: 'ready', ready: true });
    const first = a.inbox.find((m) => m.t === 'start');
    playOut(lobby, clock, [a, b]);
    expect(a.room!.phase).toBe('results');
    expect(a.room!.seats[0]!.ready).toBe(false);
    a.say({ t: 'ready', ready: true });
    b.say({ t: 'ready', ready: true });
    expect(a.started).toBe(2);
    const starts = a.inbox.filter((m) => m.t === 'start');
    expect(first && first.t === 'start' && first.firstLauncher).toBe(0);
    const second = starts[1]!;
    expect(second.t === 'start' && second.firstLauncher).toBe(1);
    expect(a.room!.rounds).toBe(1);
  });
});

describe('when things go wrong', () => {
  it('pauses for a dropped player and resumes when they rejoin with their token', () => {
    const { lobby, clock, a, b } = setup({ rejoinGraceSeconds: 10 });
    const code = seatBoth(a, b);
    a.say({ t: 'ready', ready: true });
    b.say({ t: 'ready', ready: true });
    for (let t = 0; t < 30; t++) { clock.t += 16.7; lobby.tick(); }
    const token = b.room!.token;
    const tickBefore = a.state!.tick;
    b.drop();
    for (let t = 0; t < 120; t++) { clock.t += 16.7; lobby.tick(); }
    expect(a.paused.length).toBeGreaterThan(0);
    expect(a.state!.tick).toBe(tickBefore); // frozen, nothing lost
    expect(a.room!.seats[1]!.connected).toBe(false);

    const b2 = new FakeClient(lobby, 'Theo').hello();
    b2.say({ t: 'rejoin', code, token });
    expect(b2.room!.you).toBe(1);
    expect(b2.started).toBe(1);
    expect(b2.state).not.toBeNull();
    expect(a.resumed).toEqual([false]);
    for (let t = 0; t < 10; t++) { clock.t += 16.7; lobby.tick(); }
    expect(a.state!.tick).toBeGreaterThan(tickBefore);
    expect(lobby.stats.rejoins).toBe(1);
  });

  it('a wrong token cannot take someone else\'s seat', () => {
    const { lobby, a, b } = setup();
    const code = seatBoth(a, b);
    const thief = new FakeClient(lobby, 'Mallory').hello();
    thief.say({ t: 'rejoin', code, token: 'f'.repeat(32) });
    expect(thief.errors).toEqual(['not_found']);
    expect(thief.room).toBeNull();
    expect(b.room!.seats[1]!.name).toBe('Theo');
  });

  it('hands the seat to a labelled bot after the grace period so the stayer can finish', () => {
    const { lobby, clock, a, b } = setup({ rejoinGraceSeconds: 2, launches: 2 });
    seatBoth(a, b);
    a.say({ t: 'ready', ready: true });
    b.say({ t: 'ready', ready: true });
    for (let t = 0; t < 30; t++) { clock.t += 16.7; lobby.tick(); }
    b.drop();
    for (let t = 0; t < 60 * 3; t++) { clock.t += 16.7; lobby.tick(); }
    expect(a.resumed).toEqual([true]);
    expect(a.room!.seats[1]!.bot).toBe(true);
    expect(lobby.stats.botTakeovers).toBe(1);
    playOut(lobby, clock, [a]);
    expect(a.room!.phase).toBe('results');
    expect(a.state!.results.length).toBe(2);
    expect(a.room!.seats[1]).toBeNull(); // the absent player's seat is freed for a friend
  });

  it('leaving on purpose mid-round does not make the other player wait', () => {
    const { lobby, clock, a, b } = setup({ launches: 2 });
    seatBoth(a, b);
    a.say({ t: 'ready', ready: true });
    b.say({ t: 'ready', ready: true });
    for (let t = 0; t < 30; t++) { clock.t += 16.7; lobby.tick(); }
    a.say({ t: 'leave' });
    expect(b.room!.seats[0]!.bot).toBe(true);
    expect(b.paused.length).toBe(0);
    playOut(lobby, clock, [b]);
    expect(b.room!.phase).toBe('results');
  });

  it('closes rooms nobody is in', () => {
    const { lobby, clock, a, b } = setup({ emptyRoomSeconds: 5 });
    const code = seatBoth(a, b);
    a.drop();
    b.drop();
    expect(lobby.rooms.has(code)).toBe(true);
    clock.t += 6000;
    lobby.tick();
    expect(lobby.rooms.has(code)).toBe(false);
  });

  it('both players dropping mid-round still ends the round and frees the room', () => {
    const { lobby, clock, a, b } = setup({ rejoinGraceSeconds: 1, emptyRoomSeconds: 600, launches: 2 });
    const code = seatBoth(a, b);
    a.say({ t: 'ready', ready: true });
    b.say({ t: 'ready', ready: true });
    for (let t = 0; t < 30; t++) { clock.t += 16.7; lobby.tick(); }
    a.drop();
    b.drop();
    for (let t = 0; t < 60 * 120 && lobby.stats.roundsFinished === 0; t++) { clock.t += 16.7; lobby.tick(); }
    expect(lobby.stats.roundsFinished).toBe(1);
    expect(lobby.rooms.get(code)?.phase).toBe('results');
  });
});

describe('over real WebSockets', () => {
  let server: RunningServer | null = null;
  afterEach(async () => {
    await server?.close();
    server = null;
  });

  it('two separate socket clients complete a full round and agree on the score', async () => {
    server = await startServer(0, { launches: 2 });
    const url = `ws://127.0.0.1:${server.port}`;

    interface Client { ws: WebSocket; room: RoomInfo | null; state: CourierState | null; bot: BuddyBot; n: number; bytes: number; snaps: number }
    const open = (name: string, seed: number): Promise<Client> =>
      new Promise((resolve, reject) => {
        const ws = new WebSocket(url);
        const c: Client = { ws, room: null, state: null, bot: new BuddyBot({ seed, skill: 0.85 }), n: 0, bytes: 0, snaps: 0 };
        ws.on('open', () => {
          ws.send(encode({ t: 'hello', v: PROTOCOL_VERSION, name, spec: null }));
          resolve(c);
        });
        ws.on('error', reject);
        ws.on('message', (data) => {
          const text = data.toString();
          c.bytes += text.length;
          const msg = JSON.parse(text) as ServerMsg;
          if (msg.t === 'room') c.room = msg.room;
          if (msg.t === 'snap') {
            c.snaps++;
            c.state = { ...msg.s, events: msg.ev } as CourierState;
            // answer every snapshot with fresh input, like a client would each frame
            if (c.room && msg.s.phase !== 'done') {
              ws.send(encode({ t: 'input', n: c.n++, i: packInput(c.bot.think(c.state, c.room.you)) }));
            }
          }
        });
      });

    const wait = async (cond: () => boolean, ms: number): Promise<void> => {
      const end = Date.now() + ms;
      while (!cond()) {
        if (Date.now() > end) throw new Error('timed out');
        await new Promise((r) => setTimeout(r, 15));
      }
    };

    const a = await open('Rosa', 3);
    const b = await open('Theo', 4);
    a.ws.send(encode({ t: 'create' }));
    await wait(() => !!a.room, 2000);
    b.ws.send(encode({ t: 'join', code: a.room!.code }));
    await wait(() => !!b.room && !!a.room!.seats[1], 2000);
    a.ws.send(encode({ t: 'ready', ready: true }));
    b.ws.send(encode({ t: 'ready', ready: true }));
    const started = Date.now();
    await wait(() => a.room?.phase === 'results' && b.room?.phase === 'results', 60_000);
    const seconds = (Date.now() - started) / 1000;

    expect(a.state!.phase).toBe('done');
    expect(a.state!.results.length).toBe(2);
    expect(a.state!.total).toBe(b.state!.total);
    expect(a.state!.results).toEqual(b.state!.results);
    // traffic budget evidence (v1 JSON): printed so it lands in the test log
    const kbps = (a.bytes * 8) / 1000 / seconds;
    console.log(`[net] round ${seconds.toFixed(1)} s, ${a.snaps} snapshots, ${(a.bytes / a.snaps).toFixed(0)} bytes/snapshot, ${kbps.toFixed(0)} kbit/s down per client`);
    expect(a.bytes / a.snaps).toBeLessThan(2500);

    const health = await fetch(`http://127.0.0.1:${server.port}/health`).then((r) => r.json()) as { ok: boolean; rooms: number };
    expect(health.ok).toBe(true);
    a.ws.close();
    b.ws.close();
  }, 90_000);
});
