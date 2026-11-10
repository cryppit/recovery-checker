// The Recovery Checker page. Keyless, read-only: it reads public chains through check() and renders recover()'s
// verdict. Nothing from a chain is ever set as HTML — textContent only. No keys, no storage, no analytics.
import { CHAINS, chainName } from "./chains.js";
import { lookup } from "./lookup.js";

const $ = (sel, root = document) => root.querySelector(sel);
const el = (tag, props = {}, kids = []) => {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (k === "class") n.className = v;
    else if (k === "text") n.textContent = v; // the only way text ever reaches the DOM here
    else n.setAttribute(k, v);
  }
  for (const kid of [].concat(kids)) if (kid) n.appendChild(kid);
  return n;
};

// How each recoverable value paints and reads. Colour is always paired with a glyph + word (never colour alone).
const VERDICT = {
  "yes-with-risk": { glyph: "⚠", word: "Possibly recoverable", tone: "yes", lede: "There is a real recovery path, but it carries a race risk. Read every step and warning before acting." },
  "likely-no": { glyph: "✗", word: "Very likely unrecoverable", tone: "no", lede: "We tell you the honest answer: these funds are very likely gone. Beware anyone who says otherwise." },
  danger: { glyph: "⚑", word: "Danger — occupied address", tone: "danger", lede: "An address already has code on the destination chain. Do not send more without verifying who controls it." },
  unknown: { glyph: "?", word: "Unknown", tone: "unknown", lede: "We can't confirm recovery from what we can read. Treat it as unproven, not as a yes." },
  "not-applicable": { glyph: "•", word: "Not a smart-wallet case", tone: "unknown", lede: "This isn't the wrong-chain smart-wallet situation this tool is for." },
};

function populateChains(select) {
  for (const c of CHAINS) select.appendChild(el("option", { value: String(c.id), text: `${c.name} (${c.id})` }));
}

function renderResult(root, address, target, res) {
  root.textContent = "";
  if (res.error) {
    root.appendChild(el("div", { class: "card err" }, [el("p", { class: "headline", text: res.message || "Could not check that address." })]));
    return;
  }
  const v = res.verdict;
  const look = VERDICT[v.recoverable] ?? VERDICT.unknown;

  const card = el("div", { class: `card tone-${look.tone}` });

  // Badge + title row
  const badge = el("span", { class: `badge tone-${look.tone}`, title: look.word, "aria-label": look.word }, [
    el("span", { class: "glyph", text: look.glyph, "aria-hidden": "true" }),
    el("span", { text: look.word }),
  ]);
  card.appendChild(el("div", { class: "verdict-row" }, [badge]));
  card.appendChild(el("p", { class: "verdict-lede", text: look.lede }));
  card.appendChild(el("h2", { class: "title", text: v.title }));
  card.appendChild(el("p", { class: "headline", text: v.headline }));

  // Steps — only ever shown for the recoverable case (recover() leaves steps empty otherwise).
  if (v.steps.length) {
    card.appendChild(el("h3", { class: "sec", text: "If you choose to attempt recovery (you act, we never do)" }));
    const ol = el("ol", { class: "steps" });
    for (const s of v.steps) ol.appendChild(el("li", { text: s }));
    card.appendChild(ol);
  }

  // Warnings — shown LOUDLY.
  if (v.warnings.length) {
    card.appendChild(el("h3", { class: "sec warn-head", text: "Warnings" }));
    const ul = el("ul", { class: "warnings" });
    for (const w of v.warnings) ul.appendChild(el("li", { text: w }));
    card.appendChild(ul);
  }

  // What we checked.
  const read = v.sources.map((id) => chainName(id)).join(", ");
  card.appendChild(el("p", { class: "sources", text: `Destination: ${chainName(target)}. Sources — chains read (${v.sources.length}): ${read}.` }));
  card.appendChild(el("p", { class: "addr", text: `Address: ${res.facts.address}` }));

  root.appendChild(card);
}

function init() {
  const form = $("#f");
  const addr = $("#addr");
  const chain = $("#chain");
  const result = $("#result");
  const btn = $("#go");
  populateChains(chain);

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const address = addr.value.trim();
    const target = Number(chain.value);
    if (!address) return;
    btn.disabled = true;
    const prev = btn.textContent;
    btn.textContent = "Reading chains…";
    result.textContent = "";
    result.appendChild(el("p", { class: "loading", text: `Reading ${CHAINS.length} chains for ${address}…` }));
    try {
      const res = await lookup(address, target);
      renderResult(result, address, target, res);
    } catch (err) {
      result.textContent = "";
      result.appendChild(el("div", { class: "card err" }, [el("p", { class: "headline", text: "Something went wrong reading the chains. Try again in a minute." })]));
    } finally {
      btn.disabled = false;
      btn.textContent = prev;
    }
  });
}

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
else init();
