// The example flow is illustrative, but its data still has to be coherent: every scene must map to a real gate, every
// gate tone must be one the page knows, and the addresses must be well formed. These are pure checks — no I/O.
import { test } from "node:test";
import assert from "node:assert/strict";
import { SCENES, GATES, gateFor } from "../src/scenes.js";
import { CHAINS } from "../src/chains.js";

const TONES = new Set(["yes", "no", "danger", "unknown"]);
const chainIds = new Set(CHAINS.map((c) => c.id));

test("every gate has a known tone and a unique level", () => {
  const levels = new Set();
  for (const g of GATES) {
    assert.ok(TONES.has(g.tone), `gate ${g.level} has unknown tone ${g.tone}`);
    assert.ok(g.mark && g.name && g.note, `gate ${g.level} is missing a field`);
    assert.ok(!levels.has(g.level), `duplicate gate level ${g.level}`);
    levels.add(g.level);
  }
});

test("every scene maps to a gate and a live destination chain", () => {
  for (const s of SCENES) {
    assert.ok(gateFor(s.level), `scene "${s.label}" has no gate for level ${s.level}`);
    assert.ok(chainIds.has(s.target), `scene "${s.label}" targets a chain not read live: ${s.target}`);
    assert.match(s.address, /^0x[0-9a-fA-F]{40}$/, `scene "${s.label}" has a malformed address`);
    assert.ok(s.icon && s.shown && s.title && s.detail, `scene "${s.label}" is missing a field`);
  }
});

test("gateFor returns undefined for an unknown level", () => {
  assert.equal(gateFor("not-a-level"), undefined);
});

test("all four verdict answers are shown at least once in the flow", () => {
  const shown = new Set(SCENES.map((s) => s.level));
  for (const g of GATES) assert.ok(shown.has(g.level), `no scene demonstrates ${g.level}`);
});
