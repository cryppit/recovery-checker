// recover() reads the facts that check() produces and says whether funds sent to a smart-wallet address on the WRONG
// chain can be recovered. Replayed from the RPC answers recorded for Safe to Send (26 Oct 2026). No network.
//
// The harness mirrors safe-to-send/test/check.test.js exactly: build `facts` by running check() over the recorded
// store, then assert on recover(facts).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { check } from "../src/check.js";
import { replaying } from "../src/rpc.js";
import { buildShards } from "../src/archive.js";
import { recover } from "../src/recover.js";

const AGW = "0xd8b17dbd34391993ee11b501e6275bbc715e2529";
const load = (name) => JSON.parse(readFileSync(new URL(`../fixtures/${name}.json`, import.meta.url)));
// A one-wallet archive, so the tests do not depend on a full AGW scan (same trick as check.test.js).
const archive = buildShards([AGW]);
const loadShard = async (key) => archive[key] ?? new Uint8Array(0);

async function factsFor(name) {
  const fx = load(name);
  const r = await check(fx.address, fx.target, { clients: (c) => replaying(fx.store[c.id] ?? {}), loadShard });
  assert.ok(!r.error, `check() errored for ${name}: ${r.error}`);
  return r.facts;
}

test("a Safe deployed on Ethereum only, sending on BNB (dest code 0x): yes-with-risk, safe-redeploy", async () => {
  const f = await factsFor("safe-eth-only-on-bnb");
  const r = recover(f);
  assert.equal(r.class, "safe-redeploy");
  assert.equal(r.recoverable, "yes-with-risk");
  assert.ok(r.steps.length > 0, "a recoverable case must give steps");
  assert.ok(r.warnings.some((w) => /race/i.test(w)), "must carry the deploy-race warning");
  assert.ok(r.sources.includes(56) && r.sources.includes(1), "sources list the chains read");
});

test("an Abstract Global Wallet, sending on BNB: likely-no, agw-not-recoverable, NO recovery steps", async () => {
  const f = await factsFor("agw-on-bnb");
  const r = recover(f);
  assert.equal(r.class, "agw-not-recoverable");
  assert.equal(r.recoverable, "likely-no");
  assert.equal(r.steps.length, 0, "must not offer false recovery steps for an AGW");
});

test("the same AGW, sending on ZKsync Era (still no code there): likely-no, agw-not-recoverable", async () => {
  const f = await factsFor("agw-on-zksync");
  const r = recover(f);
  assert.equal(r.class, "agw-not-recoverable");
  assert.equal(r.recoverable, "likely-no");
  assert.equal(r.steps.length, 0);
});

test("the destination chain itself already has contract code (USDC on Ethereum): danger, occupied", async () => {
  const f = await factsFor("usdc-contract-on-ethereum");
  const r = recover(f);
  assert.equal(r.class, "occupied");
  assert.equal(r.recoverable, "danger");
  assert.equal(r.steps.length, 0, "never hand steps for an already-occupied destination");
  assert.ok(r.warnings.length > 0, "the occupied case must warn");
});

test("a key wallet that has transacted (Binance hot wallet), sending on BNB: not-applicable, not-smart-wallet", async () => {
  const f = await factsFor("key-wallet-on-bnb");
  const r = recover(f);
  assert.equal(r.class, "not-smart-wallet");
  assert.equal(r.recoverable, "not-applicable");
});

test("an address never used anywhere: unknown, unused", async () => {
  const f = await factsFor("unused-on-bnb");
  const r = recover(f);
  assert.equal(r.class, "unused");
  assert.equal(r.recoverable, "unknown");
});

test("recover() is pure: the same facts give a deeply-equal result every call", async () => {
  const f = await factsFor("safe-eth-only-on-bnb");
  assert.deepEqual(recover(f), recover(f));
});

test("every verdict carries the required shape", async () => {
  for (const name of ["safe-eth-only-on-bnb", "agw-on-bnb", "usdc-contract-on-ethereum", "key-wallet-on-bnb", "unused-on-bnb"]) {
    const r = recover(await factsFor(name));
    for (const k of ["class", "recoverable", "title", "headline", "steps", "warnings", "sources"]) {
      assert.ok(k in r, `${name}: missing ${k}`);
    }
    assert.ok(["yes-with-risk", "likely-no", "danger", "unknown", "not-applicable"].includes(r.recoverable), `${name}: bad recoverable ${r.recoverable}`);
    assert.ok(Array.isArray(r.steps) && Array.isArray(r.warnings) && Array.isArray(r.sources));
    assert.ok(typeof r.title === "string" && typeof r.headline === "string");
  }
});
