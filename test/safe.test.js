// The Safe version/factory layer: the pure mapping helpers, and the end-to-end wiring in lookup() that reads slot 0
// for the version and probes the SafeProxyFactory on the destination. The integration tests replay a real recorded
// store (safe-eth-only-on-bnb) augmented with the extra reads enrichment makes — no network.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { replaying } from "../src/rpc.js";
import { buildShards } from "../src/archive.js";
import { lookup } from "../src/lookup.js";
import { singletonFromSlot0, versionOfSingleton, safeModel } from "../src/safe.js";

const V141_SAFE = "0x41675C099F32341bf84BFc5382aF534df5C7461a";
const V130_L2 = "0x3E5c63644E683549055b9Be8653de26E0B4CD36E";
const V111 = "0x34CfAC646f301356fAa8B21e94227e3583Fe3F5F";
const V141_FACTORY = "0x4e1dcf7ad4e460cfd30791ccc4f9c8a4f820ec67";
const V141_FACTORY_ZK = "0xc329d02fd8cb2fc13aa919005af46320794a8629";

const slot = (addr) => "0x" + addr.toLowerCase().replace(/^0x/, "").padStart(64, "0");
const loadShard = async () => new Uint8Array(0); // no AGW archive needed here

// ---- pure helpers ----

test("singletonFromSlot0 takes the low 20 bytes; empty slot -> null", () => {
  assert.equal(singletonFromSlot0(slot(V141_SAFE)), V141_SAFE.toLowerCase());
  assert.equal(singletonFromSlot0("0x" + "0".repeat(64)), null);
  assert.equal(singletonFromSlot0("0x"), null);
  assert.equal(singletonFromSlot0(null), null);
});

test("versionOfSingleton maps verified singletons; anything else is unknown", () => {
  assert.equal(versionOfSingleton(V141_SAFE), "v1.4.1");
  assert.equal(versionOfSingleton(V130_L2), "v1.3.0");
  assert.equal(versionOfSingleton(V111), "v1.1.1");
  assert.equal(versionOfSingleton("0x" + "de".repeat(20)), "unknown");
  assert.equal(versionOfSingleton(null), "unknown");
});

test("safeModel: v1.3.0/v1.4.1 are create2, v1.0.0/v1.1.1 legacy, else unknown", () => {
  assert.equal(safeModel("v1.4.1"), "create2");
  assert.equal(safeModel("v1.3.0"), "create2");
  assert.equal(safeModel("v1.1.1"), "legacy");
  assert.equal(safeModel("v1.0.0"), "legacy");
  assert.equal(safeModel("unknown"), "unknown");
});

// ---- lookup() end-to-end over an augmented recorded store ----

// safe-eth-only-on-bnb: a Safe on Ethereum (chain 1), sent on BNB (56, no code). We add the slot-0 read on chain 1
// and the factory probe(s) on chain 56 that enrichment performs.
function baseStore() {
  const fx = JSON.parse(readFileSync(new URL("../fixtures/safe-eth-only-on-bnb.json", import.meta.url)));
  return { address: fx.address, target: fx.target, store: structuredClone(fx.store) };
}
const getStorageKey = (addr) => `eth_getStorageAt ${JSON.stringify([addr, "0x0", "latest"])}`;
const getCodeKey = (addr) => `eth_getCode ${JSON.stringify([addr, "latest"])}`;

async function run(store, address, target) {
  return lookup(address, target, { clients: (c) => replaying(store[c.id] ?? {}), loadShard });
}

test("v1.4.1 Safe on Ethereum, factory present on BNB: lookup -> yes-with-risk, safe-redeploy", async () => {
  const { address, target, store } = baseStore();
  store["1"][getStorageKey(address)] = slot(V141_SAFE);
  store["56"][getCodeKey(V141_FACTORY)] = "0x60806040"; // factory has code on the destination
  const r = await run(store, address, target);
  assert.equal(r.facts.safeVersion, "v1.4.1");
  assert.equal(r.facts.destFactoryPresent, true);
  assert.equal(r.verdict.class, "safe-redeploy");
  assert.equal(r.verdict.recoverable, "yes-with-risk");
});

test("v1.4.1 Safe, factory ABSENT on BNB: lookup -> unknown, safe-no-factory", async () => {
  const { address, target, store } = baseStore();
  store["1"][getStorageKey(address)] = slot(V141_SAFE);
  store["56"][getCodeKey(V141_FACTORY)] = "0x"; // neither factory variant has code on the destination
  store["56"][getCodeKey(V141_FACTORY_ZK)] = "0x";
  const r = await run(store, address, target);
  assert.equal(r.facts.safeVersion, "v1.4.1");
  assert.equal(r.facts.destFactoryPresent, false);
  assert.equal(r.verdict.class, "safe-no-factory");
  assert.equal(r.verdict.recoverable, "unknown");
});

test("legacy v1.1.1 Safe: lookup -> likely-no, safe-legacy-create (no factory probe needed)", async () => {
  const { address, target, store } = baseStore();
  store["1"][getStorageKey(address)] = slot(V111);
  const r = await run(store, address, target);
  assert.equal(r.facts.safeVersion, "v1.1.1");
  assert.equal(r.facts.destFactoryPresent, undefined, "a legacy Safe needs no factory probe");
  assert.equal(r.verdict.class, "safe-legacy-create");
  assert.equal(r.verdict.recoverable, "likely-no");
});

test("unknown singleton: lookup -> unknown, safe-unknown-version", async () => {
  const { address, target, store } = baseStore();
  store["1"][getStorageKey(address)] = slot("0x" + "de".repeat(20));
  const r = await run(store, address, target);
  assert.equal(r.facts.safeVersion, "unknown");
  assert.equal(r.verdict.class, "safe-unknown-version");
  assert.equal(r.verdict.recoverable, "unknown");
});

test("slot-0 read failure degrades safely to unknown (never to recoverable)", async () => {
  const { address, target, store } = baseStore();
  // No eth_getStorageAt key in the store -> replaying throws -> enrich catches -> version "unknown".
  const r = await run(store, address, target);
  assert.equal(r.facts.safeVersion, "unknown");
  assert.equal(r.verdict.recoverable, "unknown");
});
