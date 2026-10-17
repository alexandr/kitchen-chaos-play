// Online room transport. One phone hosts (peer id derived from a 4-letter room code); up to 3 others
// join with the code. Star topology: clients talk only to the host.
//
// Two transports, used together:
//  1. WebRTC data channels (PeerJS): direct and fast; the default.
//  2. A relay through public MQTT brokers over secure websockets, used when WebRTC can't connect
//     (strict cellular NATs, no working free TURN servers). The host listens on two brokers; a client
//     falls back to whichever it reaches first. Messages are JSON on room-scoped topics.
/* global Peer, mqtt */

const PREFIX = 'kchaos-v1-';
const ALPHA = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
export const MAX_PLAYERS = 4;
const BROKERS = ['wss://broker.emqx.io:8084/mqtt', 'wss://broker.hivemq.com:8884/mqtt'];
const TOPIC = code => `kchaos-v1/${code}`;
const RTC_TIMEOUT = Number(new URLSearchParams(location.search).get('rtcwait') ?? 7000);

// STUN for direct connections (the public TURN relays that used to work are gone; MQTT covers that case)
const ICE = [
  { urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302', 'stun:stun.cloudflare.com:3478'] },
];

export function randomCode() { let s = ''; for (let i = 0; i < 4; i++) s += ALPHA[Math.floor(Math.random() * ALPHA.length)]; return s; }
const rid = () => Math.random().toString(36).slice(2, 10);

function connectBroker(url, timeout = 8000) {
  return new Promise((resolve, reject) => {
    if (!window.mqtt) { reject(new Error('relay library missing')); return; }
    const c = mqtt.connect(url, { connectTimeout: timeout, reconnectPeriod: 2000, clean: true, clientId: 'kc_' + rid() });
    const t = setTimeout(() => { c.end(true); reject(new Error('relay timeout')); }, timeout);
    c.once('connect', () => { clearTimeout(t); resolve(c); });
  });
}
const enc = o => JSON.stringify(o);
const dec = b => { try { return JSON.parse(typeof b === 'string' ? b : new TextDecoder().decode(b)); } catch { return null; } };

export class Room {
  constructor() {
    this.peer = null; this.conns = new Map(); this.host = null; this.isHost = false;
    this.code = null; this.handlers = {}; this.closed = false; this.myId = null;
    this.relays = [];            // host: connected brokers
    this.mq = new Map();         // host: relay clients  id -> { broker, seen }
    this.relay = null;           // client: broker used to reach the host
    this.via = 'rtc';
  }
  on(ev, fn) { this.handlers[ev] = fn; return this; }
  emit(ev, ...a) { this.handlers[ev]?.(...a); }
  makePeer(id) {
    if (!window.Peer) throw new Error('PeerJS failed to load (no network?)');
    return new Peer(id, { config: { iceServers: ICE }, debug: 0 });
  }
  get count() { return this.conns.size + this.mq.size; }

  // host a new room; resolves with the code
  create(tries = 0) {
    return new Promise((resolve, reject) => {
      const code = randomCode();
      let peer;
      try { peer = this.makePeer(PREFIX + code); } catch (e) { reject(e); return; }
      peer.on('open', () => {
        this.peer = peer; this.code = code; this.isHost = true; this.myId = 'host';
        peer.on('connection', conn => this.accept(conn));
        peer.on('disconnected', () => { if (!this.closed) peer.reconnect(); });
        this.hostRelays(code);
        resolve(code);
      });
      peer.on('error', e => {
        if (e.type === 'unavailable-id' && tries < 5) { peer.destroy(); this.create(tries + 1).then(resolve, reject); }
        else if (!this.peer) reject(e); else this.emit('error', e);
      });
    });
  }
  accept(conn) {
    conn.on('open', () => {
      if (this.count >= MAX_PLAYERS - 1) { conn.send({ t: 'full' }); setTimeout(() => conn.close(), 500); return; }
      this.conns.set(conn.peer, conn);
      this.emit('join', conn.peer);
    });
    conn.on('data', msg => this.emit('message', conn.peer, msg));
    const gone = () => { if (this.conns.delete(conn.peer)) this.emit('leave', conn.peer); };
    conn.on('close', gone); conn.on('error', gone);
  }
  // host: listen for relay clients on every broker we can reach
  hostRelays(code) {
    for (const url of BROKERS) {
      connectBroker(url).then(b => {
        if (this.closed) { b.end(true); return; }
        this.relays.push(b);
        b.subscribe(TOPIC(code) + '/h');
        b.on('message', (topic, payload) => {
          const m = dec(payload); if (!m?.from) return;
          const id = 'm:' + m.from;
          let e = this.mq.get(id);
          if (!e) {
            if (m.msg?.t === 'bye') return;
            if (this.count >= MAX_PLAYERS - 1) { b.publish(`${TOPIC(code)}/c/${m.from}`, enc({ t: 'full' })); return; }
            e = { broker: b, seen: Date.now() }; this.mq.set(id, e);
            this.emit('join', id);
          }
          e.seen = Date.now();
          if (m.msg?.t === 'bye') { this.mq.delete(id); this.emit('leave', id); return; }
          if (m.msg?.t !== 'ping') this.emit('message', id, m.msg);
        });
      }).catch(() => {});
    }
    // relay clients that go quiet have left; keep them alive with a ping
    this.hb = setInterval(() => {
      const now = Date.now();
      for (const [id, e] of this.mq) if (now - e.seen > 12000) { this.mq.delete(id); this.emit('leave', id); }
      for (const [id, e] of this.mq) e.broker.publish(`${TOPIC(this.code)}/c/${id.slice(2)}`, enc({ t: 'ping' }));
    }, 2000);
  }

  // join an existing room by code: WebRTC first, relay if that doesn't connect in time
  async join(code) {
    code = code.toUpperCase().trim(); this.code = code;
    const q = new URLSearchParams(location.search);
    if (!q.has('relay')) {
      try { await this.joinRtc(code); return this.myId; }
      catch (e) { if (/not found|full/i.test(e.message) && !q.has('rtcfail')) throw e; }
      try { this.peer?.destroy(); } catch {}
      this.peer = null;
    }
    await this.joinRelay(code);
    return this.myId;
  }
  joinRtc(code) {
    return new Promise((resolve, reject) => {
      const peer = this.makePeer(undefined);
      let done = false;
      const fail = e => { if (!done) { done = true; reject(e); } else this.emit('error', e); };
      const timer = setTimeout(() => fail(new Error('direct connection timed out')), RTC_TIMEOUT);
      peer.on('error', e => fail(e.type === 'peer-unavailable' ? new Error('Room ' + code + ' not found') : e));
      peer.on('open', id => {
        this.peer = peer; this.myId = id;
        if (new URLSearchParams(location.search).has('rtcfail')) return; // test hook: pretend WebRTC is blocked
        const conn = peer.connect(PREFIX + code, { reliable: true, serialization: 'json' });
        conn.on('open', () => { clearTimeout(timer); done = true; this.host = conn; this.via = 'rtc'; resolve(id); });
        conn.on('data', msg => { if (msg?.t === 'full') fail(new Error('Room is full')); else this.emit('message', 'host', msg); });
        conn.on('close', () => { if (!this.closed && done) this.emit('hostLeft'); });
        conn.on('error', e => fail(e));
      });
    });
  }
  async joinRelay(code) {
    const id = rid();
    this.myId = id; this.via = 'relay';
    const b = await Promise.any(BROKERS.map(u => connectBroker(u))).catch(() => { throw new Error('Could not reach room ' + code + ' (no network?)'); });
    this.relay = b;
    let lastHeard = Date.now();
    await new Promise((resolve, reject) => {
      let ok = false;
      const t = setTimeout(() => { if (!ok) { b.end(true); reject(new Error('Room ' + code + ' not found')); } }, 9000);
      b.subscribe(`${TOPIC(code)}/c/${id}`, () => b.publish(`${TOPIC(code)}/h`, enc({ from: id, msg: { t: 'ping' } })));
      b.on('message', (topic, payload) => {
        const m = dec(payload); if (!m) return;
        lastHeard = Date.now();
        if (!ok) { ok = true; clearTimeout(t); resolve(); }
        if (m.t === 'full') { this.emit('error', new Error('Room is full')); return; }
        if (m.t === 'ping') return;
        this.emit('message', 'host', m);
      });
    });
    this.hb = setInterval(() => {
      b.publish(`${TOPIC(code)}/h`, enc({ from: id, msg: { t: 'ping' } }));
      if (Date.now() - lastHeard > 12000 && !this.closed) { clearInterval(this.hb); this.emit('hostLeft'); }
    }, 2000);
  }

  send(to, msg) {
    if (to === 'host') {
      if (this.relay) this.relay.publish(`${TOPIC(this.code)}/h`, enc({ from: this.myId, msg }));
      else if (this.host?.open) this.host.send(msg);
      return;
    }
    if (to.startsWith('m:')) { const e = this.mq.get(to); e?.broker.publish(`${TOPIC(this.code)}/c/${to.slice(2)}`, enc(msg)); return; }
    const c = this.conns.get(to); if (c?.open) c.send(msg);
  }
  broadcast(msg) {
    for (const c of this.conns.values()) if (c.open) c.send(msg);
    if (this.mq.size) { const s = enc(msg); for (const [id, e] of this.mq) e.broker.publish(`${TOPIC(this.code)}/c/${id.slice(2)}`, s); }
  }
  toHost(msg) { if (this.isHost) this.emit('message', 'host', msg); else this.send('host', msg); }
  close() {
    if (this.relay && !this.isHost) try { this.send('host', { t: 'bye' }); } catch {}
    this.closed = true; clearInterval(this.hb);
    try { this.peer?.destroy(); } catch {}
    setTimeout(() => { for (const b of this.relays) b.end(true); this.relay?.end(true); }, 300);
    this.conns.clear(); this.mq.clear();
  }
}
