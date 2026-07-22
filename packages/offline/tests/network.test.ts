import { describe, expect, it, vi } from "vitest";
import { ConnectivityMonitor } from "../src/network";

describe("ConnectivityMonitor", () => {
  it("defaults to online", () => {
    expect(new ConnectivityMonitor().isOnline()).toBe(true);
  });

  it("respects the initial state", () => {
    expect(new ConnectivityMonitor({ initialOnline: false }).isOnline()).toBe(false);
  });

  it("check() runs the probe and updates state", async () => {
    let up = false;
    const monitor = new ConnectivityMonitor({
      initialOnline: false,
      probe: async () => up,
    });
    expect(await monitor.check()).toBe(false);
    up = true;
    expect(await monitor.check()).toBe(true);
    expect(monitor.isOnline()).toBe(true);
  });

  it("treats a throwing probe as offline", async () => {
    const monitor = new ConnectivityMonitor({
      initialOnline: true,
      probe: async () => {
        throw new Error("network down");
      },
    });
    expect(await monitor.check()).toBe(false);
  });

  it("notifies subscribers only on transitions", () => {
    const monitor = new ConnectivityMonitor({ initialOnline: true });
    const listener = vi.fn();
    monitor.subscribe(listener);

    monitor.setOnline(true); // no transition
    expect(listener).not.toHaveBeenCalled();

    monitor.setOnline(false); // transition
    monitor.setOnline(true); // transition
    expect(listener).toHaveBeenCalledTimes(2);
    expect(listener).toHaveBeenNthCalledWith(1, false);
    expect(listener).toHaveBeenNthCalledWith(2, true);
  });

  it("unsubscribe stops notifications", () => {
    const monitor = new ConnectivityMonitor();
    const listener = vi.fn();
    const off = monitor.subscribe(listener);
    off();
    monitor.setOnline(false);
    expect(listener).not.toHaveBeenCalled();
  });
});
