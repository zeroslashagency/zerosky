// @zerosky/print — printer discovery (USB + network)
// USB enumeration uses the optional `usb` dependency; network discovery probes
// a list of hosts on the raw-print port. Both are injectable for testing.

import type { TransportKind } from "./escpos.js";

/** A printer found during discovery. */
export interface DiscoveredPrinter {
  kind: Extract<TransportKind, "usb" | "network">;
  /** Human-readable identifier. */
  name: string;
  /** USB: "vendorId:productId". Network: "host:port". */
  address: string;
  vendorId?: number;
  productId?: number;
  host?: string;
  port?: number;
}

/** Shape of a USB device as exposed by the `usb` package (subset). */
interface UsbDeviceLike {
  deviceDescriptor: {
    idVendor: number;
    idProduct: number;
    bDeviceClass: number;
  };
}

/** USB printer class code per the USB spec. */
const USB_PRINTER_CLASS = 0x07;

/** Injectable USB lister so tests don't need real hardware. */
export type UsbLister = () => UsbDeviceLike[];

function toHex(n: number): string {
  return n.toString(16).padStart(4, "0");
}

/**
 * Enumerate connected USB printers. Filters to devices advertising the USB
 * printer interface class. If no lister is supplied, lazily loads the optional
 * `usb` module; returns [] when it is unavailable.
 */
export async function discoverUsbPrinters(lister?: UsbLister): Promise<DiscoveredPrinter[]> {
  let list = lister;
  if (!list) {
    try {
      const mod = (await import("usb")) as { getDeviceList?: () => UsbDeviceLike[] };
      if (typeof mod.getDeviceList !== "function") return [];
      list = mod.getDeviceList.bind(mod);
    } catch {
      return [];
    }
  }

  const devices = list();
  return devices
    .filter((d) => d.deviceDescriptor.bDeviceClass === USB_PRINTER_CLASS)
    .map((d) => {
      const vendorId = d.deviceDescriptor.idVendor;
      const productId = d.deviceDescriptor.idProduct;
      return {
        kind: "usb" as const,
        name: `USB Printer ${toHex(vendorId)}:${toHex(productId)}`,
        address: `${toHex(vendorId)}:${toHex(productId)}`,
        vendorId,
        productId,
      };
    });
}

/** A probe that resolves true if a raw-print port is open on host:port. */
export type NetworkProbe = (host: string, port: number, timeoutMs: number) => Promise<boolean>;

/** Default TCP probe: attempts a socket connection to the raw-print port. */
export const tcpProbe: NetworkProbe = async (host, port, timeoutMs) => {
  const { Socket } = await import("node:net");
  return new Promise<boolean>((resolve) => {
    const socket = new Socket();
    const done = (result: boolean): void => {
      socket.destroy();
      resolve(result);
    };
    socket.setTimeout(timeoutMs, () => done(false));
    socket.once("error", () => done(false));
    socket.connect(port, host, () => done(true));
  });
};

/** Options for scanning a set of hosts for network printers. */
export interface NetworkScanOptions {
  hosts: string[];
  port?: number;
  timeoutMs?: number;
  /** Injectable probe for testing. Defaults to {@link tcpProbe}. */
  probe?: NetworkProbe;
}

/**
 * Probe a list of hosts for an open raw-print port (default 9100) and return
 * the ones that respond. Hosts are probed concurrently.
 */
export async function discoverNetworkPrinters(options: NetworkScanOptions): Promise<DiscoveredPrinter[]> {
  const port = options.port ?? 9100;
  const timeoutMs = options.timeoutMs ?? 1000;
  const probe = options.probe ?? tcpProbe;

  const results = await Promise.all(
    options.hosts.map(async (host): Promise<DiscoveredPrinter | null> => {
      const open = await probe(host, port, timeoutMs);
      if (!open) return null;
      return {
        kind: "network",
        name: `Network Printer ${host}:${port}`,
        address: `${host}:${port}`,
        host,
        port,
      };
    }),
  );

  return results.filter((r): r is DiscoveredPrinter => r !== null);
}

/** Convenience: discover both USB and network printers in one call. */
export async function discoverAll(
  networkOptions?: NetworkScanOptions,
  usbLister?: UsbLister,
): Promise<DiscoveredPrinter[]> {
  const usb = await discoverUsbPrinters(usbLister);
  const network = networkOptions ? await discoverNetworkPrinters(networkOptions) : [];
  return [...usb, ...network];
}
