import { describe, it, expect } from "vitest";
import {
  EscPosBuilder,
  MockPrinter,
  SerialPrinter,
  sendToPrinter,
  COLUMNS_FOR_WIDTH,
} from "../src/escpos.js";

const ESC = 0x1b;
const GS = 0x1d;
const LF = 0x0a;

describe("COLUMNS_FOR_WIDTH", () => {
  it("maps paper widths to column counts", () => {
    expect(COLUMNS_FOR_WIDTH[58]).toBe(32);
    expect(COLUMNS_FOR_WIDTH[80]).toBe(48);
  });
});

describe("EscPosBuilder", () => {
  it("initializes with ESC @", () => {
    const bytes = new EscPosBuilder().initialize().build();
    expect(Array.from(bytes)).toEqual([ESC, 0x40]);
  });

  it("encodes text and line feeds", () => {
    const bytes = new EscPosBuilder().line("Hi").build();
    expect(Array.from(bytes)).toEqual([0x48, 0x69, LF]);
  });

  it("appends text without newline", () => {
    const bytes = new EscPosBuilder().text("AB").build();
    expect(Array.from(bytes)).toEqual([0x41, 0x42]);
  });

  it("feeds multiple lines", () => {
    const bytes = new EscPosBuilder().feed(3).build();
    expect(Array.from(bytes)).toEqual([LF, LF, LF]);
  });

  it("emits alignment codes", () => {
    expect(Array.from(new EscPosBuilder().align("center").build())).toEqual([ESC, 0x61, 1]);
    expect(Array.from(new EscPosBuilder().align("right").build())).toEqual([ESC, 0x61, 2]);
    expect(Array.from(new EscPosBuilder().align("left").build())).toEqual([ESC, 0x61, 0]);
  });

  it("toggles bold and underline", () => {
    expect(Array.from(new EscPosBuilder().bold(true).build())).toEqual([ESC, 0x45, 1]);
    expect(Array.from(new EscPosBuilder().bold(false).build())).toEqual([ESC, 0x45, 0]);
    expect(Array.from(new EscPosBuilder().underline(2).build())).toEqual([ESC, 0x2d, 2]);
  });

  it("clamps size multipliers into the valid range", () => {
    // width 3, height 2 -> ((3-1)<<4)|(2-1) = 0x21
    expect(Array.from(new EscPosBuilder().size(3, 2).build())).toEqual([GS, 0x21, 0x21]);
    // over-max clamps to 8; ((8-1)<<4)|(8-1) = 0x77
    expect(Array.from(new EscPosBuilder().size(99, 99).build())).toEqual([GS, 0x21, 0x77]);
    // under-min clamps to 1; 0x00
    expect(Array.from(new EscPosBuilder().size(0, 0).build())).toEqual([GS, 0x21, 0x00]);
  });

  it("resets to normal size", () => {
    expect(Array.from(new EscPosBuilder().normalSize().build())).toEqual([GS, 0x21, 0x00]);
  });

  it("emits cut and cash drawer commands", () => {
    expect(Array.from(new EscPosBuilder().cut().build())).toEqual([GS, 0x56, 0x41, 0x03]);
    expect(Array.from(new EscPosBuilder().cashDrawer().build())).toEqual([ESC, 0x70, 0, 0x19, 0xfa]);
    expect(Array.from(new EscPosBuilder().cashDrawer(1).build())).toEqual([ESC, 0x70, 1, 0x19, 0xfa]);
  });

  it("accepts raw Uint8Array and number[]", () => {
    expect(Array.from(new EscPosBuilder().raw([1, 2]).raw(Uint8Array.from([3])).build())).toEqual([1, 2, 3]);
  });

  it("chains a full document", () => {
    const bytes = new EscPosBuilder()
      .initialize()
      .align("center")
      .bold(true)
      .line("STORE")
      .bold(false)
      .cut()
      .build();
    expect(bytes.length).toBeGreaterThan(0);
    expect(bytes[0]).toBe(ESC);
  });
});

describe("MockPrinter", () => {
  it("records writes after open and reports text", async () => {
    const p = new MockPrinter();
    await p.open();
    await p.write(Uint8Array.from([0x41]));
    await p.write(Uint8Array.from([0x42]));
    await p.close();
    expect(p.openCount).toBe(1);
    expect(p.closed).toBe(true);
    expect(p.writes).toHaveLength(2);
    expect(p.toText()).toBe("AB");
    expect(Array.from(p.buffer())).toEqual([0x41, 0x42]);
  });

  it("throws when writing before open", async () => {
    const p = new MockPrinter();
    await expect(p.write(Uint8Array.from([1]))).rejects.toThrow(/before open/);
  });

  it("fails the next write once when configured", async () => {
    const p = new MockPrinter();
    await p.open();
    p.failNextWrite = new Error("boom");
    await expect(p.write(Uint8Array.from([1]))).rejects.toThrow("boom");
    // Subsequent writes succeed.
    await p.write(Uint8Array.from([2]));
    expect(p.writes).toHaveLength(1);
  });

  it("has kind 'mock'", () => {
    expect(new MockPrinter().kind).toBe("mock");
  });
});

describe("sendToPrinter", () => {
  it("opens, writes, and closes in order", async () => {
    const p = new MockPrinter();
    await sendToPrinter(p, Uint8Array.from([1, 2, 3]));
    expect(p.openCount).toBe(1);
    expect(p.closed).toBe(true);
    expect(Array.from(p.buffer())).toEqual([1, 2, 3]);
  });

  it("closes even when the write fails", async () => {
    const p = new MockPrinter();
    p.failNextWrite = new Error("device offline");
    await expect(sendToPrinter(p, Uint8Array.from([1]))).rejects.toThrow("device offline");
    expect(p.closed).toBe(true);
  });
});

describe("SerialPrinter", () => {
  interface FakePort {
    writes: Uint8Array[];
    closed: boolean;
    write(data: Uint8Array, cb: (err?: Error | null) => void): void;
    close(cb: (err?: Error | null) => void): void;
    once(event: "open" | "error", cb: (err?: Error) => void): void;
  }

  const makeFactory = (opts: { failOpen?: Error } = {}) => {
    const port: FakePort = {
      writes: [],
      closed: false,
      write(data, cb) {
        this.writes.push(data);
        cb(null);
      },
      close(cb) {
        this.closed = true;
        cb(null);
      },
      once(event, cb) {
        if (event === "open" && !opts.failOpen) queueMicrotask(() => cb());
        if (event === "error" && opts.failOpen) queueMicrotask(() => cb(opts.failOpen));
      },
    };
    return { port, factory: () => port };
  };

  it("opens, writes, and closes via an injected factory", async () => {
    const { port, factory } = makeFactory();
    const p = new SerialPrinter({ path: "/dev/null", factory });
    await p.open();
    await p.write(Uint8Array.from([1, 2]));
    await p.close();
    expect(port.writes).toHaveLength(1);
    expect(port.closed).toBe(true);
  });

  it("rejects when the port emits an error on open", async () => {
    const { factory } = makeFactory({ failOpen: new Error("cannot open port") });
    const p = new SerialPrinter({ path: "/dev/null", factory });
    await expect(p.open()).rejects.toThrow(/cannot open port/);
  });

  it("rejects write before open", async () => {
    const p = new SerialPrinter({ path: "/dev/null" });
    await expect(p.write(Uint8Array.from([1]))).rejects.toThrow(/before open/);
  });

  it("close is a no-op before open", async () => {
    const p = new SerialPrinter({ path: "/dev/null" });
    await expect(p.close()).resolves.toBeUndefined();
    expect(p.kind).toBe("serial");
  });
});
