// The thin bridge: read the chains with check(), then turn the facts into a recovery verdict with recover(). The only
// place that does I/O (through check); recover() stays pure. In tests, check()'s `clients`/`loadShard` are injected.
import { check } from "./check.js";
import { recover } from "./recover.js";

export async function lookup(address, target, opts = {}) {
  const r = await check(address, target, opts);
  if (r.error) return r;
  return { facts: r.facts, verdict: recover(r.facts) };
}
