// @zerosky/print — ESC/POS driver
// Low-level command builder + pluggable transports (serial / USB / network / mock).
// The builder emits raw bytes; transports own delivery to a physical device.

// ─────────────────────────────────────────────────────────────
// ESC/POS control bytes
// ─────────────────────────────────────────────────────────────

const ESC = 0x1b;
const GS = 0x1d;
const LF = 0x0a;

/** Text alignment for a printed line/block. */
export type Alignment = "left" | "center" | "right";

/** Supported thermal paper widths (mm). Character columns differ per width. */
export type PaperWidth = 58 | 80;

/** Column count for the common Font A (12x24) on each supported width. */
export const COLUMNS_FOR_WIDTH: Record<PaperWidth, number> = {
  58: 32,
  80: 48,
};

/** How the driver reaches a physical printer. */
export type TransportKind = "serial" | "usb" | "network" | "mock";

/** A sink that accepts raw ESC/POS bytes and delivers them to a device. */
export interface PrinterTransport {
  readonly kind: TransportKind;
  open(): Promise<void>;
  write(data: Uint8Array): Promise<void>;
  close(): Promise<void>;
}

const encoder = new TextEncoder();

function concat(chunks: Uint8Array[]): Uint8Array {
  const total = chunks.reduce((sum, c) => sum + c.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.length;
  }
  return out;
}

const ALIGN_CODE: Record<Alignment, number> = {
  left: 0,
  center: 1,
  right: 2,
};

/**
 * Fluent builder that accumulates ESC/POS byte sequences.
 * Call {@link EscPosBuilder.build} to get the final payload.
 */
export class EscPosBuilder {
  private readonly chunks: Uint8Array[] = [];

  /** Push raw bytes directly. */
  raw(bytes: number[] | Uint8Array): this {
    this.chunks.push(bytes instanceof Uint8Array ? bytes : Uint8Array.from(bytes));
    return this;
  }

  /** ESC @ — reset printer to power-on defaults. */
  initialize(): this {
    return this.raw([ESC, 0x40]);
  }

  /** Append UTF-8 text (no trailing newline). */
  text(value: string): this {
    this.chunks.push(encoder.encode(value));
    return this;
  }

  /** Append text followed by a line feed. */
  line(value = ""): this {
    return this.text(value).raw([LF]);
  }

  /** Feed N blank lines. */
  feed(lines = 1): this {
    for (let i = 0; i < lines; i += 1) this.raw([LF]);
    return this;
  }

  /** ESC a n — set justification. */
  align(alignment: Alignment): this {
    return this.raw([ESC, 0x61, ALIGN_CODE[alignment]]);
  }

  /** ESC E n — emphasized (bold) on/off. */
  bold(on: boolean): this {
    return this.raw([ESC, 0x45, on ? 1 : 0]);
  }

  /** ESC - n — underline off/1-dot/2-dot. */
  underline(weight: 0 | 1 | 2): this {
    return this.raw([ESC, 0x2d, weight]);
  }

  /**
   * GS ! n — set character size multiplier (1..8 in each axis).
   * Width/height are encoded in the high/low nibble respectively.
   */
  size(width: number, height: number): this {
    const w = Math.min(Math.max(width, 1), 8) - 1;
    const h = Math.min(Math.max(height, 1), 8) - 1;
    return this.raw([GS, 0x21, (w << 4) | h]);
  }

  /** Reset size to 1x1. */
  normalSize(): this {
    return this.size(1, 1);
  }

  /** GS V — full cut (with small feed). */
  cut(): this {
    return this.raw([GS, 0x56, 0x41, 0x03]);
  }

  /** ESC p — pulse the cash drawer kick-out on the given pin. */
  cashDrawer(pin: 0 | 1 = 0): this {
    return this.raw([ESC, 0x70, pin, 0x19, 0xfa]);
  }

  /** Concatenate all accumulated bytes into a single payload. */
  build(): Uint8Array {
    return concat(this.chunks);
  }
}

// ─────────────────────────────────────────────────────────────
// Transports
// ─────────────────────────────────────────────────────────────

/**
 * In-memory transport used for tests and dry runs. Records every write
 * and its own open/close lifecycle so assertions can inspect behaviour.
 */
export class MockPrinter implements PrinterTransport {
  readonly kind: TransportKind = "mock";
  readonly writes: Uint8Array[] = [];
  opened = false;
  closed = false;
  openCount = 0;

  /** When set, the next write rejects with this error (single-shot). */
  failNextWrite: Error | null = null;

  async open(): Promise<void> {
    this.opened = true;
    this.openCount += 1;
  }

  async write(data: Uint8Array): Promise<void> {
    if (!this.opened) throw new Error("MockPrinter: write before open");
    if (this.failNextWrite) {
      const err = this.failNextWrite;
      this.failNextWrite = null;
      throw err;
    }
    this.writes.push(Uint8Array.from(data));
  }

  async close(): Promise<void> {
    this.closed = true;
    this.opened = false;
  }

  /** All writes concatenated — convenient for byte-level assertions. */
  buffer(): Uint8Array {
    return concat(this.writes);
  }

  /** Decode all writes as UTF-8 text (control bytes included). */
  toText(): string {
    return new TextDecoder().decode(this.buffer());
  }
}

/** Options for a TCP/IP (network) thermal printer, e.g. Epson TM-T series. */
export interface NetworkTransportOptions {
  host: string;
  port?: number;
  timeoutMs?: number;
}

/**
 * Network transport over raw TCP (default port 9100).
 * The `net` module is imported lazily so the package works in environments
 * where sockets are unavailable (e.g. browser bundles, CI without hardware).
 */
export class NetworkPrinter implements PrinterTransport {
  readonly kind: TransportKind = "network";
  private readonly host: string;
  private readonly port: number;
  private readonly timeoutMs: number;
  // Typed loosely to avoid a hard dependency on node:net types at call sites.
  private socket: import("node:net").Socket | null = null;

  constructor(options: NetworkTransportOptions) {
    this.host = options.host;
    this.port = options.port ?? 9100;
    this.timeoutMs = options.timeoutMs ?? 5000;
  }

  async open(): Promise<void> {
    const { Socket } = await import("node:net");
    const socket = new Socket();
    this.socket = socket;
    await new Promise<void>((resolve, reject) => {
      const onError = (err: Error): void => {
        socket.destroy();
        reject(err);
      };
      socket.setTimeout(this.timeoutMs, () => onError(new Error("connect timeout")));
      socket.once("error", onError);
      socket.connect(this.port, this.host, () => {
        socket.setTimeout(0);
        socket.off("error", onError);
        resolve();
      });
    });
  }

  async write(data: Uint8Array): Promise<void> {
    const socket = this.socket;
    if (!socket) throw new Error("NetworkPrinter: write before open");
    await new Promise<void>((resolve, reject) => {
      socket.write(data, (err) => (err ? reject(err) : resolve()));
    });
  }

  async close(): Promise<void> {
    const socket = this.socket;
    if (!socket) return;
    await new Promise<void>((resolve) => socket.end(() => resolve()));
    socket.destroy();
    this.socket = null;
  }
}

/** Minimal subset of the `serialport` SerialPort instance that we rely on. */
export interface SerialPortLike {
  write(data: Uint8Array, cb: (err?: Error | null) => void): void;
  close(cb: (err?: Error | null) => void): void;
  once(event: "open" | "error", cb: (err?: Error) => void): void;
}

/** Factory that constructs a serial port for a given path/baud rate. */
export type SerialPortFactory = (opts: { path: string; baudRate: number }) => SerialPortLike;

/** Options for a serial (RS-232 / USB-serial) thermal printer. */
export interface SerialTransportOptions {
  path: string;
  baudRate?: number;
  /**
   * Injectable port factory (primarily for tests). When omitted, the optional
   * `serialport` dependency is imported lazily at {@link SerialPrinter.open}.
   */
  factory?: SerialPortFactory;
}

interface SerialPortModule {
  SerialPort: new (opts: { path: string; baudRate: number }) => SerialPortLike;
}

/**
 * Serial transport backed by the optional `serialport` dependency (imported
 * lazily) or an injected factory. `open()` resolves once the port emits
 * "open" and rejects if it emits "error".
 */
export class SerialPrinter implements PrinterTransport {
  readonly kind: TransportKind = "serial";
  private readonly path: string;
  private readonly baudRate: number;
  private readonly factory?: SerialPortFactory;
  private port: SerialPortLike | null = null;

  constructor(options: SerialTransportOptions) {
    this.path = options.path;
    this.baudRate = options.baudRate ?? 9600;
    this.factory = options.factory;
  }

  async open(): Promise<void> {
    let factory = this.factory;
    if (!factory) {
      let mod: SerialPortModule;
      try {
        mod = (await import("serialport")) as unknown as SerialPortModule;
      } catch {
        throw new Error("SerialPrinter requires the optional 'serialport' dependency");
      }
      factory = (opts) => new mod.SerialPort(opts);
    }
    const port = factory({ path: this.path, baudRate: this.baudRate });
    await new Promise<void>((resolve, reject) => {
      port.once("error", (err) => reject(err ?? new Error("serial open failed")));
      port.once("open", () => resolve());
    });
    this.port = port;
  }

  async write(data: Uint8Array): Promise<void> {
    const port = this.port;
    if (!port) throw new Error("SerialPrinter: write before open");
    await new Promise<void>((resolve, reject) => {
      port.write(data, (err) => (err ? reject(err) : resolve()));
    });
  }

  async close(): Promise<void> {
    const port = this.port;
    if (!port) return;
    await new Promise<void>((resolve, reject) => {
      port.close((err) => (err ? reject(err) : resolve()));
    });
    this.port = null;
  }
}

/**
 * Send a prepared payload through a transport, managing open/close.
 * Always attempts to close, even if the write fails.
 */
export async function sendToPrinter(transport: PrinterTransport, payload: Uint8Array): Promise<void> {
  await transport.open();
  try {
    await transport.write(payload);
  } finally {
    await transport.close();
  }
}
