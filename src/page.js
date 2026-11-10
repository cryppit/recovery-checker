// The Recovery Checker page. Keyless, read-only: it reads public chains through check() and renders recover()'s
// verdict. Nothing from a chain is ever set as HTML — textContent only. No keys, no storage, no analytics.
import { CHAINS, chainName, chainById } from "./chains.js";
import { lookup } from "./lookup.js";
import { mountPicker } from "./picker.js";
import { SCENES, GATES, gateFor } from "./scenes.js";

const still = matchMedia("(prefers-reduced-motion: reduce)").matches;
const logoSrc = (name) => `logos/${name}.svg`;

// Abstract Global Wallet archive: one small (~150 KB) shard per address prefix, fetched on demand from Safe to Send's
// already-hosted copy on the SAME origin (cryppit.github.io). This keeps AGW detection working after Abstract shuts
// down on 15 Dec 2026, with no 111 MB copy here. CSP connect-src 'self' already allows it.
const loadShard = async (key) => {
  try {
    const r = await fetch(`/safe-to-send/data/abstract/agw/${key}.bin`);
    return r.ok ? new Uint8Array(await r.arrayBuffer()) : null;
  } catch {
    return null;
  }
};

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
  select.value = "1"; // Ethereum by default; the picker button mirrors this.
}

// The logo "slicer": a custom dropdown over the hidden <select>, which still holds the value page.js reads.
function mountChainPicker(select) {
  const picker = mountPicker({
    select,
    button: $("#pick-btn"),
    name: $("#pick-name"),
    logo: $("#chain-logo"),
    groups: [{ label: "Chains read live", note: "32 EVM chains", items: CHAINS }],
    popular: [1, 8453, 42161, 10, 137, 56], // Ethereum, Base, Arbitrum, OP, Polygon, BNB
    kindOf: () => "EVM",
    onPick: () => picker.sync(),
  });
  picker.sync();
}

// The wheel of blockchains: every chain a check reads, shown as coverage. Logos are same-origin SVGs (img-src 'self').
function renderChainrow(root) {
  for (const c of CHAINS) {
    const li = el("li", { class: still ? "" : "reveal" }, [
      el("img", { src: logoSrc(c.logo), alt: "", width: "30", height: "30" }),
      el("span", { text: c.name }),
    ]);
    if (c.until) {
      const when = new Date(c.until + "T00:00:00Z").toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });
      li.appendChild(el("small", { text: `until ${when}` }));
    }
    root.appendChild(li);
  }
  // A subtle staggered reveal, only when motion is allowed.
  if (!still && "IntersectionObserver" in window) {
    const io = new IntersectionObserver((entries, obs) => {
      for (const e of entries) {
        if (!e.isIntersecting) continue;
        const items = [...root.children];
        items.forEach((li, i) => setTimeout(() => li.classList.add("in"), Math.min(i * 28, 560)));
        obs.disconnect();
      }
    }, { threshold: 0.12 });
    io.observe(root);
  }
}

// The animated example flow: four real addresses, each cross-fading to the recovery answer it really gets.
function mountSceneFlow() {
  const gatesRoot = $("#gates");
  const readout = $("#readout");
  const tabsRoot = $("#scene-tabs");
  const toggle = $("#scene-toggle");
  if (!gatesRoot || !readout || !tabsRoot) return;

  // The four answers, with the active one lit.
  const gateEls = new Map();
  for (const g of GATES) {
    const node = el("li", { class: `gate g-${g.tone}` }, [
      el("span", { class: "gate-m", text: g.mark, "aria-hidden": "true" }),
      el("span", { class: "gate-t" }, [el("b", { text: g.name }), el("small", { text: g.note })]),
    ]);
    gateEls.set(g.level, node);
    gatesRoot.appendChild(node);
  }

  // One tab per scene.
  const tabEls = SCENES.map((s, i) =>
    el("button", { type: "button", class: "scene-tab", role: "tab", text: s.label, "aria-selected": "false" })
  );
  tabEls.forEach((t, i) => { t.addEventListener("click", () => { show(i); hold(); }); tabsRoot.appendChild(t); });

  const paint = (i) => {
    const s = SCENES[i];
    const g = gateFor(s.level);
    const dest = chainById(s.target);
    readout.className = `readout lv-${g.tone}`;
    readout.textContent = "";
    // Route: where it lives -> the chain the money landed on.
    const route = el("p", { class: "ro-route" }, [
      el("img", { src: logoSrc(s.icon), alt: "", width: "22", height: "22" }),
      el("span", { text: s.shown }),
      el("span", { class: "arrow", text: "→", "aria-hidden": "true" }),
      dest ? el("img", { src: logoSrc(dest.logo), alt: "", width: "22", height: "22" }) : null,
      el("span", { text: chainName(s.target) }),
    ]);
    const badge = el("span", { class: `badge tone-${g.tone}`, "aria-label": g.name }, [
      el("span", { class: "glyph", text: g.mark, "aria-hidden": "true" }),
      el("span", { text: g.name }),
    ]);
    readout.append(
      route,
      el("div", { class: "verdict-row" }, [badge]),
      el("h3", { class: "ro-title", text: s.title }),
      el("p", { class: "ro-detail", text: s.detail }),
    );
    gateEls.forEach((node, level) => node.classList.toggle("on", level === s.level));
    tabEls.forEach((t, k) => { t.classList.toggle("on", k === i); t.setAttribute("aria-selected", String(k === i)); });
  };

  let at = 0, timer = null;
  const show = (i) => { at = i; if (still) return paint(i); readout.classList.add("fade"); setTimeout(() => { paint(i); readout.classList.remove("fade"); }, 220); };
  const start = () => { if (still || timer) return; timer = setInterval(() => show((at + 1) % SCENES.length), 4600); };
  const stop = () => { if (timer) { clearInterval(timer); timer = null; } };
  const hold = () => { stop(); setPaused(true); };
  const setPaused = (p) => { toggle.textContent = p ? "Play" : "Pause"; toggle.setAttribute("aria-pressed", String(p)); };

  toggle.addEventListener("click", () => { if (timer) { stop(); setPaused(true); } else { start(); setPaused(false); } });
  if (still) toggle.hidden = true;

  paint(0);
  start();
  setPaused(still);
}

// Two tabs: Check and Explained, driven by the hash. Any link into the guide opens Explained; everything else, Check.
function mountTabs() {
  const vExp = $("#view-explained"), vChk = $("#view-check");
  const tExp = $("#tab-explained"), tChk = $("#tab-check");
  if (!vExp || !vChk || !tExp || !tChk) return;
  const guide = new Set(["explained", ...[...vExp.querySelectorAll("[id]")].map((e) => e.id)]);
  const showTab = () => {
    const hash = location.hash.slice(1);
    const explained = guide.has(hash);
    vExp.hidden = !explained;
    vChk.hidden = explained;
    tExp.toggleAttribute("aria-current", false);
    tChk.toggleAttribute("aria-current", false);
    (explained ? tExp : tChk).setAttribute("aria-current", "page");
    if (explained && hash !== "explained") document.getElementById(hash)?.scrollIntoView();
    else window.scrollTo(0, 0);
  };
  window.addEventListener("hashchange", showTab);
  showTab();
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

  // Who acts next — the result ends naming the party and the one next step (design standards §5).
  if (v.whoActsNext) card.appendChild(el("p", { class: "who", text: v.whoActsNext }));

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
  mountChainPicker(chain);
  renderChainrow($("#chainrow"));
  mountSceneFlow();
  mountTabs();

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
      const res = await lookup(address, target, { loadShard });
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
