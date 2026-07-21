// @zerosky/offline — conflict resolution strategies.
//
// When a queued local mutation is pushed and the server already holds a
// divergent record, the sync worker asks a resolver which side wins. Resolvers
// are pure functions of (local, server) so they are trivial to unit test.

import type { ConflictStrategy, Versioned } from "./types";

/** Which side of a conflict the resolver chose. */
export type ConflictWinner = "local" | "server";

export interface ConflictDecision<T extends Versioned = Versioned> {
  winner: ConflictWinner;
  /** The record that should be considered authoritative after resolution. */
  resolved: T;
}

/** A pure resolver: given both versions, decide the winner. */
export type ConflictResolver = <T extends Versioned>(
  local: T,
  server: T,
) => ConflictDecision<T>;

/** Coerce a `Date | string` timestamp to epoch millis. */
function toMillis(value: Date | string): number {
  const time = value instanceof Date ? value.getTime() : new Date(value).getTime();
  return Number.isNaN(time) ? 0 : time;
}

/**
 * Last-write-wins: the record with the newer `updatedAt` wins. Ties resolve to
 * the server to avoid needless overwrites (the server copy is already durable).
 */
export const lastWriteWins: ConflictResolver = (local, server) => {
  const localTime = toMillis(local.updatedAt);
  const serverTime = toMillis(server.updatedAt);
  return localTime > serverTime
    ? { winner: "local", resolved: local }
    : { winner: "server", resolved: server };
};

/** Server-wins: the server copy always prevails; the local change is discarded. */
export const serverWins: ConflictResolver = (_local, server) => ({
  winner: "server",
  resolved: server,
});

/** Client-wins: the local change always prevails and overwrites the server. */
export const clientWins: ConflictResolver = (local) => ({
  winner: "local",
  resolved: local,
});

const RESOLVERS: Record<ConflictStrategy, ConflictResolver> = {
  "last-write-wins": lastWriteWins,
  "server-wins": serverWins,
  "client-wins": clientWins,
};

/** Resolve a {@link ConflictStrategy} name to its resolver implementation. */
export function getResolver(strategy: ConflictStrategy): ConflictResolver {
  return RESOLVERS[strategy];
}

/** Apply a named strategy to a single conflict. */
export function resolveConflict<T extends Versioned>(
  strategy: ConflictStrategy,
  local: T,
  server: T,
): ConflictDecision<T> {
  return getResolver(strategy)(local, server);
}
