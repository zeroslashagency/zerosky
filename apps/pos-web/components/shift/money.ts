/**
 * Rupee formatting for the shift screens.
 *
 * The shift router converts Prisma Decimals to plain numbers at the API
 * boundary, so everything here is a `number` — never call `.toNumber()` on a
 * value that crossed the wire.
 */
export function formatMoney(amount: number): string {
  return `₹${amount.toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

/** Short "2h 15m ago"-style duration, used for how long the till has been open. */
export function formatElapsed(since: Date | string): string {
  const start = typeof since === 'string' ? new Date(since) : since;
  const minutes = Math.max(0, Math.floor((Date.now() - start.getTime()) / 60_000));
  const hours = Math.floor(minutes / 60);
  if (hours === 0) {
    return `${minutes}m`;
  }
  return `${hours}h ${minutes % 60}m`;
}
