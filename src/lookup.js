// The thin bridge and the ONLY place that does I/O. It reads the chains with check(), then — for a Safe found on
// another chain with no code on the destination — reads the two extra facts recover() needs: the Safe's version
// (from the proxy's storage slot 0 on a chain where it is deployed) and whether the matching SafeProxyFactory is
// deployed on the destination chain. recover() stays pure and branches on those pre-read values.
import { check, clientsFor } from "./check.js";
import { recover } from "./recover.js";
import { kindOfCode } from "./classify.js";
import { CHAINS } from "./chains.js";
import { singletonFromSlot0, versionOfSingleton, safeModel, SAFE_FACTORIES } from "./safe.js";

export async function lookup(address, target, opts = {}) {
  const r = await check(address, target, opts);
  if (r.error) return r;
  await enrichSafe(r.facts, opts);
  return { facts: r.facts, verdict: recover(r.facts) };
}

/**
 * When the address is a Safe deployed elsewhere and the destination has no code, read:
 *   1. slot 0 on a chain where the Safe is deployed  -> singleton -> safeVersion
 *   2. for a CREATE2 version, eth_getCode at that version's factory on the destination -> destFactoryPresent
 * Mutates `facts` in place. Any read failure is left as "unknown" / null (conservative), never as recoverable.
 */
export async function enrichSafe(facts, { clients = clientsFor, chains = CHAINS } = {}) {
  const target = facts.target;
  const dest = facts.chains[target];
  if (!dest || kindOfCode(dest.code) === "contract") return; // occupied — recover() handles it
  if (facts.abstractWallet) return; // AGW — recover() handles it

  const safeChainId = Object.keys(facts.chains).map(Number).find((id) => id !== target && facts.chains[id].safe);
  if (safeChainId == null) return; // no Safe elsewhere — nothing to enrich

  const safeChain = chains.find((c) => c.id === safeChainId);
  if (!safeChain) return;

  let version = "unknown";
  try {
    const slot0 = await clients(safeChain)("eth_getStorageAt", [facts.address, "0x0", "latest"]);
    version = versionOfSingleton(singletonFromSlot0(slot0));
  } catch {
    version = "unknown";
  }
  facts.safeVersion = version;
  facts.safeChain = safeChainId;

  if (safeModel(version) !== "create2") return; // legacy / unknown need no factory probe

  const destChain = chains.find((c) => c.id === target);
  if (!destChain) {
    facts.destFactoryPresent = null;
    return;
  }
  try {
    const rpc = clients(destChain);
    let present = false;
    for (const factory of SAFE_FACTORIES[version] ?? []) {
      const code = await rpc("eth_getCode", [factory, "latest"]);
      if (kindOfCode(code) === "contract") {
        present = true;
        break;
      }
    }
    facts.destFactoryPresent = present;
  } catch {
    facts.destFactoryPresent = null; // couldn't verify — recover() treats this as unproven
  }
}
