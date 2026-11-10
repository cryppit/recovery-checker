// recover() turns the facts check()/lookup() assemble into a recovery verdict. Two kinds of test here:
//   - Pure unit tests on recover() with hand-built facts (the Safe version branches need safeVersion/destFactoryPresent,
//     which recover() only reads — it never does I/O, so no fixtures are needed for them).
//   - Fixture integration for the non-Safe cases (AGW, occupied, EOA, unused), replayed from recorded RPC answers.
// The Safe end-to-end wiring (slot-0 read -> version, factory probe -> destFactoryPresent) is tested in safe.test.js.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { check } from "../src/check.js";
import { replaying } from "../src/rpc.js";
import { buildShards } from "../src/archive.js";
import { recover } from "../src/recover.js";

const AGW = "0xd8b17dbd34391993ee11b501e6275bbc715e2529";
const load = (name) => JSON.parse(readFileSync(new URL(`../fixtures/${name}.json`, import.meta.url)));
const archive = buildShards([AGW]);
const loadShard = async (key) => archive[key] ?? new Uint8Array(0);

async function factsFor(name) {
  const fx = load(name);
  const r = await check(fx.address, fx.target, { clients: (c) => replaying(fx.store[c.id] ?? {}), loadShard });
  assert.ok(!r.error, `check() errored for ${name}: ${r.error}`);
  return r.facts;
}

// A Safe-elsewhere facts object, as lookup() would hand it to recover() after enrichment.
const safeFacts = (safeVersion, destFactoryPresent) => ({
  address: "0x" + "ab".repeat(20),
  target: 56,
  chains: {
    1: { code: "0x6080", nonce: 1, safe: { threshold: 3, owners: 5, signers: [] } },
    56: { code: "0x", nonce: 0 },
  },
  abstractWallet: false,
  safeVersion,
  destFactoryPresent,
});

// ---- Safe version branches (pure) ----

test("v1.4.1 Safe, factory present on destination: yes-with-risk, safe-redeploy, with the deploy-race warning", () => {
  const r = recover(safeFacts("v1.4.1", true));
  assert.equal(r.class, "safe-redeploy");
  assert.equal(r.recoverable, "yes-with-risk");
  assert.ok(r.steps.length > 0, "a recoverable case must give steps");
  assert.ok(r.steps.some((s) => /createProxyWithNonce/.test(s)), "steps must name the real redeploy call");
  assert.ok(r.warnings.some((w) => /DEPLOY RACE/.test(w)), "must carry the deploy-race warning");
});

test("v1.4.1 Safe, factory ABSENT on destination: unknown, safe-no-factory, no false steps", () => {
  const r = recover(safeFacts("v1.4.1", false));
  assert.equal(r.class, "safe-no-factory");
  assert.equal(r.recoverable, "unknown");
  assert.equal(r.steps.length, 0, "must not hand recovery steps when the factory isn't on the destination");
});

test("v1.3.0 Safe, factory present: yes-with-risk, safe-redeploy", () => {
  const r = recover(safeFacts("v1.3.0", true));
  assert.equal(r.class, "safe-redeploy");
  assert.equal(r.recoverable, "yes-with-risk");
});

test("CREATE2 Safe but factory presence could not be read (null): conservative unknown, safe-no-factory", () => {
  const r = recover(safeFacts("v1.4.1", null));
  assert.equal(r.class, "safe-no-factory");
  assert.equal(r.recoverable, "unknown");
});

test("legacy v1.1.1 Safe (create opcode): likely-no, safe-legacy-create, not owner-recoverable", () => {
  const r = recover(safeFacts("v1.1.1", undefined));
  assert.equal(r.class, "safe-legacy-create");
  assert.equal(r.recoverable, "likely-no");
  assert.equal(r.steps.length, 0, "a legacy create-opcode Safe must not get recovery steps");
  assert.ok(r.warnings.some((w) => /Wintermute/.test(w)));
});

test("legacy v1.0.0 Safe: likely-no, safe-legacy-create", () => {
  const r = recover(safeFacts("v1.0.0", undefined));
  assert.equal(r.class, "safe-legacy-create");
  assert.equal(r.recoverable, "likely-no");
});

test("unreadable Safe version: conservative unknown, safe-unknown-version", () => {
  const r = recover(safeFacts("unknown", undefined));
  assert.equal(r.class, "safe-unknown-version");
  assert.equal(r.recoverable, "unknown");
});

test("recover() on raw check() facts (no safeVersion) never claims a Safe is recoverable", () => {
  const raw = safeFacts(undefined, undefined); // as if enrichment never ran
  const r = recover(raw);
  assert.equal(r.recoverable, "unknown");
  assert.equal(r.class, "safe-unknown-version");
});

// ---- Non-Safe cases (fixture integration) ----

test("an Abstract Global Wallet, sending on BNB: likely-no, agw-not-recoverable, NO recovery steps", async () => {
  const r = recover(await factsFor("agw-on-bnb"));
  assert.equal(r.class, "agw-not-recoverable");
  assert.equal(r.recoverable, "likely-no");
  assert.equal(r.steps.length, 0);
});

test("the same AGW, sending on ZKsync Era: likely-no, agw-not-recoverable", async () => {
  const r = recover(await factsFor("agw-on-zksync"));
  assert.equal(r.class, "agw-not-recoverable");
  assert.equal(r.recoverable, "likely-no");
});

test("the destination chain itself already has contract code (USDC on Ethereum): danger, occupied", async () => {
  const r = recover(await factsFor("usdc-contract-on-ethereum"));
  assert.equal(r.class, "occupied");
  assert.equal(r.recoverable, "danger");
  assert.equal(r.steps.length, 0);
  assert.ok(r.warnings.length > 0);
});

test("a key wallet that has transacted (Binance hot wallet): not-applicable, not-smart-wallet", async () => {
  const r = recover(await factsFor("key-wallet-on-bnb"));
  assert.equal(r.class, "not-smart-wallet");
  assert.equal(r.recoverable, "not-applicable");
});

test("an address never used anywhere: unknown, unused", async () => {
  const r = recover(await factsFor("unused-on-bnb"));
  assert.equal(r.class, "unused");
  assert.equal(r.recoverable, "unknown");
});

// ---- Shape + purity ----

test("recover() is pure: the same facts give a deeply-equal result every call", () => {
  const f = safeFacts("v1.4.1", true);
  assert.deepEqual(recover(f), recover(f));
});

test("every verdict carries the required shape and a valid recoverable value", async () => {
  const cases = [safeFacts("v1.4.1", true), safeFacts("v1.1.1"), await factsFor("agw-on-bnb"), await factsFor("usdc-contract-on-ethereum"), await factsFor("unused-on-bnb")];
  for (const f of cases) {
    const r = recover(f);
    for (const k of ["class", "recoverable", "title", "headline", "steps", "warnings", "sources"]) assert.ok(k in r, `missing ${k}`);
    assert.ok(["yes-with-risk", "likely-no", "danger", "unknown", "not-applicable"].includes(r.recoverable), `bad recoverable ${r.recoverable}`);
    assert.ok(Array.isArray(r.steps) && Array.isArray(r.warnings) && Array.isArray(r.sources));
    assert.ok(typeof r.title === "string" && typeof r.headline === "string");
  }
});
