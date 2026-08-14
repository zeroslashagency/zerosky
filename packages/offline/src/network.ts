// @zerosky/offline — network reachability detection.
//
// POS terminals run in mixed connectivity. The sync worker needs a simple,
// testable signal for "can I reach the server right now?". This module wraps
// that behind a small interface so callers can plug in a real probe (fetch,
// TCP ping, navigator.onLine) or a deterministic fake in tests.

export type NetworkListener = (online: boolean) => void;

/** Something that can report and observe connectivity. */
export interface NetworkMonitor {
  /** Current best-known connectivity state. */
  isOnline(): boolean;
  /** Actively (re)check connectivity, updating and returning the state. */
  check(): Promise<boolean>;
  /** Subscribe to state transitions. Returns an unsubscribe function. */
  subscribe(listener: NetworkListener): () => void;
  /** Force a state (used by real adapters wiring OS/browser events, and tests). */
  setOnline(online: boolean): void;
}

export interface ConnectivityMonitorOptions {
  /**
   * Probe returning `true` when the server is reachable. Defaults to always
   * online, which suits environments where connectivity is signalled via
   * {@link NetworkMonitor.setOnline} instead of polling.
   */
  probe?: () => Promise<boolean>;
  /** Initial connectivity assumption before the first probe. Defaults to `true`. */
  initialOnline?: boolean;
}

/**
 * Default {@link NetworkMonitor}. Connectivity can be driven either by calling
 * {@link check} (which runs the injected probe) or by pushing state through
 * {@link setOnline}. Listeners fire only on actual transitions.
 */
export class ConnectivityMonitor implements NetworkMonitor {
  private online: boolean;
  private readonly probe: () => Promise<boolean>;
  private readonly listeners = new Set<NetworkListener>();

  constructor(options: ConnectivityMonitorOptions = {}) {
    this.online = options.initialOnline ?? true;
    this.probe =
      options.probe ??
      (async () => {
        // No injected probe: use navigator.onLine when available (browser/POS),
        // otherwise conservatively report offline so sync does not drain while
        // disconnected. Callers that drive state via setOnline should pass
        // explicit probe: () => true to restore the old always-online default.
        if (
          typeof navigator !== "undefined" &&
          typeof (navigator as unknown as { onLine?: boolean }).onLine === "boolean"
        ) {
          return (navigator as unknown as { onLine: boolean }).onLine;
        }
        return false;
      });
  }

  isOnline(): boolean {
    return this.online;
  }

  async check(): Promise<boolean> {
    let result: boolean;
    try {
      result = await this.probe();
    } catch {
      // A throwing probe means the server is unreachable.
      result = false;
    }
    this.setOnline(result);
    return result;
  }

  subscribe(listener: NetworkListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  setOnline(online: boolean): void {
    if (online === this.online) return;
    this.online = online;
    for (const listener of this.listeners) {
      listener(online);
    }
  }
}
