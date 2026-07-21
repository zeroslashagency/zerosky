import { describe, it, expect } from "vitest";
import {
  discoverUsbPrinters,
  discoverNetworkPrinters,
  discoverAll,
} from "../src/discovery.js";
import type { NetworkProbe, UsbLister } from "../src/discovery.js";

const usbLister: UsbLister = () => [
  { deviceDescriptor: { idVendor: 0x04b8, idProduct: 0x0e15, bDeviceClass: 0x07 } }, // printer
  { deviceDescriptor: { idVendor: 0x1234, idProduct: 0x5678, bDeviceClass: 0x08 } }, // mass storage
];

describe("discoverUsbPrinters", () => {
  it("returns only devices with the USB printer class", async () => {
    const found = await discoverUsbPrinters(usbLister);
    expect(found).toHaveLength(1);
    expect(found[0]?.kind).toBe("usb");
    expect(found[0]?.vendorId).toBe(0x04b8);
    expect(found[0]?.productId).toBe(0x0e15);
    expect(found[0]?.address).toBe("04b8:0e15");
  });

  it("returns [] when the usb module is unavailable (no lister)", async () => {
    // 'usb' is not installed in CI → import fails → [].
    const found = await discoverUsbPrinters();
    expect(found).toEqual([]);
  });

  it("returns [] when no printer-class devices exist", async () => {
    const found = await discoverUsbPrinters(() => [
      { deviceDescriptor: { idVendor: 1, idProduct: 2, bDeviceClass: 0x03 } },
    ]);
    expect(found).toEqual([]);
  });
});

describe("discoverNetworkPrinters", () => {
  it("returns hosts whose raw-print port is open", async () => {
    const probe: NetworkProbe = async (host) => host === "10.0.0.5";
    const found = await discoverNetworkPrinters({
      hosts: ["10.0.0.5", "10.0.0.6"],
      probe,
    });
    expect(found).toHaveLength(1);
    expect(found[0]?.host).toBe("10.0.0.5");
    expect(found[0]?.port).toBe(9100);
    expect(found[0]?.address).toBe("10.0.0.5:9100");
    expect(found[0]?.kind).toBe("network");
  });

  it("honors a custom port", async () => {
    const probe: NetworkProbe = async () => true;
    const found = await discoverNetworkPrinters({ hosts: ["h"], port: 9200, probe });
    expect(found[0]?.port).toBe(9200);
    expect(found[0]?.address).toBe("h:9200");
  });

  it("returns [] when no host responds", async () => {
    const probe: NetworkProbe = async () => false;
    const found = await discoverNetworkPrinters({ hosts: ["a", "b"], probe });
    expect(found).toEqual([]);
  });
});

describe("discoverAll", () => {
  it("combines USB and network results", async () => {
    const probe: NetworkProbe = async () => true;
    const all = await discoverAll({ hosts: ["10.0.0.9"], probe }, usbLister);
    expect(all.some((p) => p.kind === "usb")).toBe(true);
    expect(all.some((p) => p.kind === "network")).toBe(true);
    expect(all).toHaveLength(2);
  });

  it("works with only USB when no network options given", async () => {
    const all = await discoverAll(undefined, usbLister);
    expect(all).toHaveLength(1);
    expect(all[0]?.kind).toBe("usb");
  });
});
