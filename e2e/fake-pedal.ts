// A simulated GE150 Pro for the browser tests: replaces navigator.hid in the page before the editor loads, so the
// editor runs its real WebHID code (device.ts, store.svelte.ts) against a pedal that answers like the hardware does:
// 64-byte reports, AA 55 framing with CRC-16/GSM, the connect sequence, live module state, the preset load 100-150 ms
// after a selection, store with acknowledgement, footswitch and bank-menu reports. Its framing is written
// independently of src/lib/protocol, so a bug there does not cancel out here. Adapted from ge150pro-game's
// scripts/e2e/fake_pedal.js. Nothing here ships with the editor.
//   window.__pedal.log            host commands received: [{ cmd, payload }]
//   window.__pedal.state          current preset, live modules and EXP, the stored presets (as preset bodies)
//   window.__pedal.press(i)       a footswitch selecting preset i (report 16)
//   window.__pedal.bankMenu()     A+B / C+D opening the bank menu (report 34 1B)
//   window.__pedal.unplug()/plug() the USB cable
import type { Page } from "@playwright/test";

export interface PedalOptions {
  /** No pedal plugged in. */
  absent?: boolean;
  /** Opening fails, as when another program has the pedal (or, on Linux, without permission). */
  busy?: boolean;
  /** The pedal's current preset at connect (1-based). */
  current?: number;
}

export interface PedalMessage {
  cmd: number;
  payload: number[];
}

const KINDS = ["Clean", "Crunch", "Drive", "Lead"];

/**
 * The pedal's 200 presets as preset bodies, named like the demo (01A "Clean 1", 01B "Crunch 1", ...): every module the
 * first model with all values 0 (a valid raw value of every parameter), even slots on, and EXP on AMP GAIN.
 */
function presetBodies(): number[][] {
  const u16 = (...v: number[]) => v.flatMap((x) => [x & 0xff, (x >> 8) & 0xff]);
  return Array.from({ length: 200 }, (_, k) => {
    const name = [...`${KINDS[k % 4]} ${Math.floor(k / 4) + 1}`].map((c) =>
      c.charCodeAt(0),
    );
    const modules = Array.from({ length: 9 }, (_, s) =>
      u16(s % 2 === 0 ? 1 : 0, 0, ...Array(10).fill(0)),
    );
    return [
      k + 1,
      ...name,
      ...Array(16 - name.length).fill(0),
      ...modules.flat(),
      ...u16(2, 13, 0, 0, 0, 100),
    ];
  });
}

/** Install the simulated pedal (before the page loads). */
export async function fakePedal(page: Page, opts: PedalOptions = {}) {
  await page.addInitScript(simulate, { bodies: presetBodies(), ...opts });
}

/** Host commands the pedal received, optionally only those with code `cmd`. */
export const received = (page: Page, cmd?: number): Promise<PedalMessage[]> =>
  page.evaluate(
    (c) =>
      (
        window as unknown as { __pedal: { log: PedalMessage[] } }
      ).__pedal.log.filter((m) => c === undefined || m.cmd === c),
    cmd,
  );

/** Runs in the page (serialized by Playwright): self-contained. */
function simulate({
  bodies,
  absent = false,
  busy = false,
  current = 1,
}: PedalOptions & { bodies: number[][] }) {
  const crcTable = Array.from({ length: 256 }, (_, i) => {
    let c = i << 8;
    for (let k = 0; k < 8; k++)
      c = c & 0x8000 ? ((c << 1) ^ 0x1021) & 0xffff : (c << 1) & 0xffff;
    return c;
  });
  const crc16 = (b: number[]) => {
    let c = 0;
    for (const x of b)
      c = ((c << 8) ^ crcTable[((c >> 8) ^ x) & 0xff]) & 0xffff;
    return c ^ 0xffff;
  };
  const frame = (cmd: number, payload: number[] = []) => {
    const len = payload.length + 1;
    const body = [len & 0xff, len >> 8, cmd, ...payload];
    const c = crc16(body);
    return [0xaa, 0x55, ...body, c >> 8, c & 0xff];
  };
  const u16 = (...v: number[]) => v.flatMap((x) => [x & 0xff, (x >> 8) & 0xff]);
  const word = (b: number[], o: number) => b[o] | (b[o + 1] << 8);

  // A preset body: index, 16 name bytes, 9 modules of 24 bytes (on, type, 10 values; u16 LE), 6 EXP values.
  const MOD = 17;
  const EXP = 17 + 9 * 24;
  const presets = bodies.map((b) => [...b]);
  const modulesOf = (b: number[]) =>
    Array.from({ length: 9 }, (_, s) =>
      b.slice(MOD + 24 * s, MOD + 24 * (s + 1)),
    );
  const expOf = (b: number[]) => b.slice(EXP, EXP + 12);
  const LOAD_MS = 120; // measured 100-150 ms on V2.1.2
  let loading: ReturnType<typeof setTimeout> | undefined;
  const state = {
    current,
    live: modulesOf(presets[current - 1]),
    exp: expOf(presets[current - 1]),
    presets,
  };
  const load = (i: number) => {
    state.live = modulesOf(presets[i - 1]);
    state.exp = expOf(presets[i - 1]);
  };

  type Listener = (e: {
    data: DataView;
    device: unknown;
    reportId: number;
  }) => void;
  const listeners = new Set<Listener>();
  const outbox: Uint8Array[] = [];
  function flush() {
    const r = outbox.shift();
    if (!r) return;
    const ev = { data: new DataView(r.buffer), device, reportId: 0 };
    for (const fn of listeners) fn(ev);
    setTimeout(flush, 0);
  }
  /** One message, in 64-byte reports: [n][n bytes][padding], each message starting a new report. */
  function reply(cmd: number, payload: number[] = []) {
    const stream = frame(cmd, payload);
    for (let o = 0; o < stream.length; o += 63) {
      const chunk = stream.slice(o, o + 63);
      const report = new Uint8Array(64);
      report[0] = chunk.length;
      report.set(chunk, 1);
      outbox.push(report);
    }
    setTimeout(flush, 2);
  }
  const sendLive = () => {
    reply(0x30, [
      state.current,
      0x0e,
      ...presets[state.current - 1].slice(MOD),
    ]);
    reply(0x33, state.exp.slice(6, 12));
    reply(0x18, state.exp.slice(0, 6));
    state.live.forEach((m, s) => reply(0x02 + s, m));
  };

  const log: { cmd: number; payload: number[] }[] = [];
  function onMessage(cmd: number, p: number[]) {
    log.push({ cmd, payload: p });
    if (cmd === 0x31) {
      reply(0x32, u16(9, 12, 1, 1, 9, 1)); // input level, brightness, CAB L/R, OTG level, English
      reply(0x12, u16(0));
      reply(0x11, u16(0, 0x27dd, 32, 0, 32, 0, 32, 0, 0));
    } else if (cmd === 0xa0) {
      for (const b of presets) reply(0x20, b);
    } else if (cmd === 0xc1) {
      reply(0x4d, Array(40).fill(0));
      reply(
        0x41,
        Array.from({ length: 40 }, () =>
          [..."EMPTY"].map((c) => c.charCodeAt(0)).concat(Array(11).fill(0)),
        ).flat(),
      );
    } else if (cmd === 0x8c) {
      reply(0x0c, [0, 0, 3, 8, 120, 0]);
    } else if (cmd === 0xb0) {
      sendLive();
    } else if (cmd >= 0x82 && cmd <= 0x8a) {
      state.live[cmd - 0x82] = p.slice(0, 24);
    } else if (cmd === 0x96) {
      // the number switches at once, the modules load later, and a module set in between is overwritten by the load
      state.current = p[0];
      clearTimeout(loading);
      loading = setTimeout(() => load(p[0]), LOAD_MS);
    } else if (cmd === 0xc3) {
      // store into the slot in the message (the editor stores only to the current one) and load it into the sound
      presets[p[0] - 1] = p.slice(0, EXP + 12);
      if (p[0] === state.current) load(p[0]);
      reply(0x43, [p[0]]);
    } else if (cmd === 0x97) {
      for (let k = 0; k < 16; k++) presets[p[0] - 1][1 + k] = p[1 + k] ?? 0;
    } else if (cmd === 0x98) {
      state.exp.splice(0, 6, ...p.slice(0, 6));
    } else if (cmd === 0xb3) {
      state.exp.splice(6, 6, ...p.slice(0, 6));
    }
    // anything else (system settings): accepted silently, like the hardware
  }

  let rx: number[] = [];
  function receive(report: Uint8Array) {
    rx.push(...report.slice(1, 1 + report[0]));
    while (rx.length >= 6) {
      if (rx[0] !== 0xaa || rx[1] !== 0x55)
        throw new Error("fake pedal: a message without the AA 55 header");
      const len = word(rx, 2);
      if (rx.length < len + 6) return;
      const msg = rx.splice(0, len + 6);
      if (crc16(msg.slice(2, 4 + len)) !== ((msg[4 + len] << 8) | msg[5 + len]))
        throw new Error("fake pedal: bad CRC from the host");
      onMessage(msg[4], msg.slice(5, 4 + len));
    }
    if (rx.length && (rx[0] !== 0xaa || (rx.length > 1 && rx[1] !== 0x55)))
      rx = [];
  }

  const device = {
    vendorId: 0x0483,
    productId: 0x5703,
    productName: "GE150Pro",
    opened: false,
    collections: [],
    async open() {
      if (busy)
        throw new DOMException("Failed to open the device.", "NotAllowedError");
      this.opened = true;
    },
    async close() {
      this.opened = false;
    },
    async sendReport(_id: number, data: BufferSource) {
      if (!this.opened)
        throw new DOMException(
          "The device must be opened first.",
          "InvalidStateError",
        );
      const b =
        data instanceof Uint8Array
          ? data
          : new Uint8Array(ArrayBuffer.isView(data) ? data.buffer : data);
      if (b.length !== 64)
        throw new Error(`fake pedal: a report of ${b.length} bytes`);
      receive(b);
    },
    addEventListener(type: string, fn: Listener) {
      if (type === "inputreport") listeners.add(fn);
    },
    removeEventListener(type: string, fn: Listener) {
      if (type === "inputreport") listeners.delete(fn);
    },
  };

  let plugged = !absent;
  const hidListeners: Record<string, Set<(e: { device: unknown }) => void>> = {
    connect: new Set(),
    disconnect: new Set(),
  };
  const hid = {
    async getDevices() {
      return plugged ? [device] : [];
    },
    async requestDevice() {
      return plugged ? [device] : [];
    },
    addEventListener(type: string, fn: (e: { device: unknown }) => void) {
      hidListeners[type]?.add(fn);
    },
    removeEventListener(type: string, fn: (e: { device: unknown }) => void) {
      hidListeners[type]?.delete(fn);
    },
  };
  const hidEvent = (type: string) =>
    hidListeners[type].forEach((fn) => fn({ device }));
  Object.defineProperty(Navigator.prototype, "hid", {
    configurable: true,
    get: () => hid,
  });

  (window as unknown as Record<string, unknown>).__pedal = {
    log,
    state,
    press(i: number) {
      state.current = i;
      load(i);
      reply(0x16, [i]);
    },
    bankMenu() {
      reply(0x34, [0x1b]);
    },
    unplug() {
      plugged = false;
      device.opened = false;
      hidEvent("disconnect");
    },
    plug() {
      plugged = true;
      hidEvent("connect");
    },
  };
}
