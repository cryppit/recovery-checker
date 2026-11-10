// The flow picture: four real addresses run into the check and land on the recovery answer each one really gets. It
// plays a demo on its own; people can take over by picking an address and any chain it may have landed on, and a real
// recovery check runs. Ported from Safe to Send's wheel, EVM-only: the two counter-rotating rings are the 32 chains we
// read, split in half. Plain DOM and SVG; wires are drawn from where the pieces actually sit, so the same picture works
// on a wide screen and on a phone. Nothing here signs or deploys — reading a chain needs no key.
import { SCENES, GATES } from "./scenes.js";

const NS = "http://www.w3.org/2000/svg";
const HOLD = 3600, IN = 800, READ = 950, OUT = 750;
const ease = (p) => (p < 0.5 ? 2 * p * p : 1 - (-2 * p + 2) ** 2 / 2);
const make = (tag, className, text) => { const e = document.createElement(tag); if (className) e.className = className; if (text != null) e.textContent = text; return e; };
const svg = (tag, attrs = {}) => { const e = document.createElementNS(NS, tag); for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v); return e; };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const shorten = (a) => (a.length > 16 ? `${a.slice(0, 6)}…${a.slice(-4)}` : a);

export function mountFlow({ rig, dests, readout, toggle, chains, targetById, check, onOpen, onPlay, still }) {
  const coinImg = (c) => { const i = make("img"); i.src = `logos/${c.logo}.svg`; i.alt = ""; i.width = 24; i.height = 24; return i; };
  const items = SCENES.map((s) => ({ ...s }));
  // EVM-only: both rings are the 32 chains we read, split into two disjoint halves so each chain is one coin.
  const ringOuter = chains.filter((_, i) => i % 2 === 0);
  const ringInner = chains.filter((_, i) => i % 2 === 1);

  // The pieces.
  // Two layers with the same geometry: the faint wires run under the ring, the lit thread runs over it into the hub.
  const wires = svg("svg"), threads = svg("svg");
  wires.classList.add("wires"); threads.classList.add("wires", "over");
  wires.setAttribute("aria-hidden", "true"); threads.setAttribute("aria-hidden", "true");
  const base = svg("g"), lit = svg("g"), comet = svg("circle", { r: 5, class: "comet", opacity: 0 });
  wires.append(base); threads.append(lit, comet);

  const sources = make("ol", "sources");
  const chips = [];
  function addChip(s) {
    const i = chips.length, li = make("li"), b = make("button", "src"), t = targetById(s.target);
    b.type = "button";
    const text = make("span", "src-t");
    const name = make("b", null, s.label), shown = make("code", null, s.shown);
    text.append(name, shown);
    const to = make("span", "src-to"), toName = make("small", null, t.name), toLogo = coinImg(t);
    to.append(toName, toLogo);
    b.append(coinImg({ logo: s.icon }), text, to);
    b.addEventListener("click", () => takeOver(i, items[i].target));
    li.append(b); sources.append(li);
    b.update = (x) => { const y = targetById(x.target); shown.textContent = x.shown; toName.textContent = y.name; toLogo.src = `logos/${y.logo}.svg`; b.setAttribute("aria-label", `${x.label}, ${x.shown}, landed on ${y.name}`); };
    b.update(s);
    chips.push(b);
  }
  items.forEach(addChip);

  const core = make("div", "core");
  const spins = [];
  const coinOf = new Map();
  const ring = (list, cls, ms, dir) => {
    const r = make("div", `ring ${cls}`);
    list.forEach((c, i) => {
      const coin = make("button", "coin"); coin.type = "button"; coin.title = c.name;
      coin.setAttribute("aria-label", `Check ${c.name}`);
      coin.style.setProperty("--a", `${(360 / list.length) * i}deg`);
      const face = make("span", "face"); face.append(make("span", "tag", c.name), coinImg(c)); coin.append(face); r.append(coin);
      coin.addEventListener("click", () => takeOver(current, c.id));
      coinOf.set(c.id, coin);
      if (!still) spins.push(face.animate([{ transform: "rotate(0deg)" }, { transform: `rotate(${-dir * 360}deg)` }], { duration: ms, iterations: Infinity }));
    });
    if (!still) spins.push(r.animate([{ transform: "rotate(0deg)" }, { transform: `rotate(${dir * 360}deg)` }], { duration: ms, iterations: Infinity }));
    return r;
  };
  const hub = make("div", "hub");
  const hubName = make("b", null, "Recovery");
  const hubLogo = make("img", "hub-logo"); hubLogo.alt = ""; hubLogo.src = "logos/ethereum.svg";
  const hubState = make("small", null, `${chains.length} EVM chains read`);
  hub.append(hubName, hubLogo, hubState);
  core.append(ring(ringOuter, "outer", 120000, 1), ring(ringInner, "inner", 90000, -1), hub);

  const gates = make("ul", "gates");
  const gateOf = new Map(GATES.map((g) => {
    const li = make("li", `gate lv-${g.level}`);
    const text = make("span", "gate-t");
    text.append(make("b", null, g.name), make("small", null, g.note));
    li.append(make("span", "gate-m", g.mark), text);
    gates.append(li);
    return [g.level, li];
  }));
  rig.append(wires, sources, core, gates, threads);

  // Every chain by name, so nobody has to know a logo.
  const row = make("div", "dest-row");
  const tileOf = new Map();
  const section = (label, list) => {
    row.append(make("span", "dest-label", label));
    for (const c of list) {
      const b = make("button", "dest"); b.type = "button";
      b.append(make("span", null, c.name), coinImg(c));
      b.addEventListener("click", () => takeOver(current, c.id));
      row.append(b); tileOf.set(c.id, b);
    }
  };
  section("Read live", chains);
  const nudge = (dir, text) => { const b = make("button", "dest-nudge", text); b.type = "button"; b.setAttribute("aria-label", dir < 0 ? "Earlier chains" : "More chains"); b.addEventListener("click", () => row.scrollBy({ left: dir * 340, behavior: still ? "auto" : "smooth" })); return b; };
  dests.append(make("p", "dest-h", "The chain it landed on"), nudge(-1, "‹"), row, nudge(1, "›"));

  const pill = make("span", "pill"), route = make("p", "ro-route"), title = make("p", "ro-title"), detail = make("p", "ro-detail");
  const go = make("button", "ro-go", "See the full answer →"); go.type = "button";
  const bar = make("span", "ro-bar");
  const text = make("div", "ro-text"); text.append(route, title, detail);
  readout.append(pill, text, go, bar);
  go.addEventListener("click", () => onOpen(items[current].address, target));

  // Wires, from the pieces' real positions.
  const box = (el) => { const r = el.getBoundingClientRect(), o = rig.getBoundingClientRect(); return { l: r.left - o.left, r: r.right - o.left, t: r.top - o.top, b: r.bottom - o.top, x: r.left - o.left + r.width / 2, y: r.top - o.top + r.height / 2 }; };
  const narrow = () => matchMedia("(max-width: 980px)").matches;
  let inPaths = [], outPaths = new Map();
  let threadsNow = []; // each lit thread and how to find its wire, so a change of layout carries it along
  function layout() {
    const w = rig.clientWidth, h = rig.clientHeight;
    if (!w) return; // the Explained tab is open, or the flow is hidden
    for (const layer of [wires, threads]) { layer.setAttribute("width", w); layer.setAttribute("height", h); layer.setAttribute("viewBox", `0 0 ${w} ${h}`); }
    base.replaceChildren();
    const c = box(hub), hr = (c.r - c.l) / 2, ringB = box(core), rr = (ringB.r - ringB.l) / 2, small = narrow();
    const wire = (d) => { const p = svg("path", { d, class: "wire" }); base.append(p); return p; };
    const clamp = (a, lo, hi) => Math.min(Math.max(a, lo), hi);
    // A point on the hub's rim, and a control point straight out from it, so a wire arrives head-on.
    const rim = (a) => ({ x: c.x + Math.cos(a) * hr, y: c.y + Math.sin(a) * hr, cx: c.x + Math.cos(a) * (rr + 24), cy: c.y + Math.sin(a) * (rr + 24) });
    inPaths = chips.map((b) => {
      const s = box(b);
      if (small) { const x = clamp(s.x, 20, w - 20), e = rim(-Math.PI / 2 + clamp((x - c.x) / c.x, -0.5, 0.5)); return wire(`M${x} ${s.b} C${x} ${s.b + 22} ${e.cx} ${e.cy} ${e.x} ${e.y}`); }
      const e = rim(Math.PI - clamp(Math.atan2(s.y - c.y, c.x - s.r), -0.9, 0.9));
      return wire(`M${s.r} ${s.y} C${(s.r + e.cx) / 2} ${s.y} ${e.cx} ${e.cy} ${e.x} ${e.y}`);
    });
    outPaths = new Map([...gateOf].map(([level, g]) => {
      const t = box(g);
      if (small) { const e = rim(Math.PI / 2 - clamp((t.x - c.x) / c.x, -0.5, 0.5)); return [level, wire(`M${e.x} ${e.y} C${e.cx} ${e.cy} ${t.x} ${t.t - 22} ${t.x} ${t.t}`)]; }
      const e = rim(clamp(Math.atan2(t.y - c.y, t.l - c.x), -0.9, 0.9));
      return [level, wire(`M${e.x} ${e.y} C${e.cx} ${e.cy} ${(e.cx + t.l) / 2} ${t.y} ${t.l} ${t.y}`)];
    }));
    for (const t of threadsNow) t.el.setAttribute("d", t.wire().getAttribute("d"));
  }

  const colour = (level) => getComputedStyle(gateOf.get(level)).getPropertyValue("--v").trim() || "#c7f23a";
  const glow = (find, stroke) => { const el = find().cloneNode(); el.setAttribute("class", "wire-lit"); el.style.stroke = stroke; lit.append(el); threadsNow.push({ el, wire: find }); return el; };
  // `find` is read on every frame: if the layout moves mid-flight, the thread and the comet move with it.
  function draw(find, stroke, ms, token) {
    const l = glow(find, stroke);
    if (still) return Promise.resolve();
    comet.style.fill = stroke; comet.style.color = stroke; comet.setAttribute("opacity", 1);
    return new Promise((done) => {
      const t0 = performance.now();
      const tick = (now) => {
        if (token !== run) return done();
        const p = Math.min(1, (now - t0) / ms), e = ease(p), path = find(), len = path.getTotalLength();
        l.style.strokeDasharray = `${len}`; l.style.strokeDashoffset = `${len * (1 - e)}`;
        const pt = path.getPointAtLength(len * e);
        comet.setAttribute("cx", pt.x); comet.setAttribute("cy", pt.y);
        if (p < 1) return requestAnimationFrame(tick);
        comet.setAttribute("opacity", 0); l.style.strokeDasharray = ""; l.style.strokeDashoffset = ""; done();
      };
      requestAnimationFrame(tick);
    });
  }

  let held = false, speed = 1;
  const applyRate = () => { for (const s of spins) s.updatePlaybackRate(held ? 0 : speed); };
  const rate = (r) => { speed = r; applyRate(); };
  // The ring stops under the pointer, so a chain can be clicked.
  core.addEventListener("pointerenter", (e) => { if (e.pointerType === "mouse") { held = true; applyRate(); } });
  core.addEventListener("pointerleave", () => { held = false; applyRate(); });

  let current = 0, target = SCENES[0].target, run = 0, landed = null, visible = false, timer = 0, auto = !still;

  function mark(id) {
    for (const c of coinOf.values()) c.classList.remove("hit");
    for (const b of tileOf.values()) { b.classList.remove("on"); b.removeAttribute("aria-current"); }
    coinOf.get(id)?.classList.add("hit");
    const tile = tileOf.get(id);
    if (tile) { tile.classList.add("on"); tile.setAttribute("aria-current", "true"); row.scrollTo({ left: tile.offsetLeft - row.clientWidth / 2 + tile.offsetWidth / 2, behavior: still ? "auto" : "smooth" }); }
  }

  function clear() {
    landed = null;
    lit.replaceChildren(); threadsNow = []; comet.setAttribute("opacity", 0);
    for (const b of chips) { b.classList.remove("on"); b.removeAttribute("aria-current"); }
    for (const g of gateOf.values()) g.classList.remove("on");
    core.classList.remove("reading", "landed");
    core.removeAttribute("data-level");
  }

  function land(level, words) {
    const g = gateOf.get(level), name = GATES.find((x) => x.level === level);
    landed = level;
    core.classList.remove("reading"); core.classList.add("landed"); core.dataset.level = level;
    g.classList.add("on");
    for (const t of threadsNow) t.el.style.stroke = colour(level); // the whole thread takes the answer's colour
    hubState.textContent = name.name;
    pill.className = `pill l-${level}`; pill.textContent = name.name;
    readout.className = `readout lv-${level}`;
    title.textContent = words.title; detail.textContent = words.detail;
    // Occupied is the one that can lose funds to whoever got there first: give it a small shake.
    if (!still && level === "danger") g.animate([{ transform: "translateX(0)" }, { transform: "translateX(-6px)" }, { transform: "translateX(6px)" }, { transform: "translateX(-3px)" }, { transform: "translateX(0)" }], { duration: 340 });
  }

  /** What a real recovery check said, in the readout's words. */
  function answer(r) {
    if (!r || r.error) return { level: "unknown", title: "Can't tell", detail: r?.message ?? "The check didn't finish. Try again." };
    const v = r.verdict;
    return { level: v.recoverable, title: v.title, detail: v.headline };
  }

  // A scene plays its recorded answer; `real` is a promise of a real check.
  async function play(i, to, real) {
    const token = ++run, s = items[i], t = targetById(to);
    clearTimeout(timer); clear();
    current = i; target = to;
    chips[i].classList.add("on"); chips[i].setAttribute("aria-current", "true");
    if (narrow()) sources.scrollTo({ left: chips[i].offsetLeft - sources.clientWidth / 2 + chips[i].offsetWidth / 2, behavior: still ? "auto" : "smooth" });
    hubLogo.src = `logos/${t.logo}.svg`; hubName.textContent = t.name;
    mark(to);
    route.textContent = `${s.shown} → ${t.name}`;
    pill.className = "pill l-unknown"; pill.textContent = "Checking";
    readout.className = "readout";
    title.textContent = "Reading the address…"; detail.textContent = `${s.label}, landed on ${t.name}.`;
    const final = async () => (real ? answer(await real.catch(() => null)) : { level: s.level, title: s.title, detail: s.detail });
    if (still) { const a = await final(); if (token !== run) return; glow(() => inPaths[i], colour(a.level)); glow(() => outPaths.get(a.level), colour(a.level)); land(a.level, a); return; }
    if (narrow()) { await wait(320); if (token !== run) return; layout(); }
    hubState.textContent = "Landed on this chain";
    await draw(() => inPaths[i], "#8fb4ff", IN, token);
    if (token !== run) return;
    core.classList.add("reading");
    hubState.textContent = `Reading ${chains.length} chains…`;
    rate(14);
    const [a] = await Promise.all([final(), wait(READ)]);
    rate(1);
    if (token !== run) return;
    await draw(() => outPaths.get(a.level), colour(a.level), OUT, token);
    if (token !== run) return;
    land(a.level, a);
    if (!auto) return;
    bar.getAnimations().forEach((x) => x.cancel());
    bar.animate([{ transform: "scaleX(0)" }, { transform: "scaleX(1)" }], { duration: HOLD, easing: "linear" });
    timer = setTimeout(next, HOLD);
  }

  const next = () => { if (auto && visible) { const i = (current + 1) % SCENES.length; play(i, SCENES[i].target); } };
  function setAuto(on) {
    auto = on; clearTimeout(timer);
    toggle.textContent = on ? "Pause demo" : "Play demo";
    toggle.setAttribute("aria-pressed", String(on));
    bar.getAnimations().forEach((x) => x.cancel());
  }
  toggle.addEventListener("click", () => { setAuto(!auto); if (auto) next(); });

  function takeOver(i, to) {
    setAuto(false);
    onPlay();
    items[i] = { ...items[i], target: to };
    chips[i].update(items[i]);
    play(i, to, check(items[i].address, to));
  }

  /** Someone ran a check from the form: show it here too, and let them try it on other chains. */
  function show(address, to, result) {
    setAuto(false);
    let i = items.findIndex((x) => x.address === address);
    if (i < 0) {
      i = items.findIndex((x) => x.yours);
      const yours = { yours: true, label: "Your address", address, shown: shorten(address), icon: "ethereum", target: to };
      if (i < 0) { items.push(yours); addChip(yours); i = items.length - 1; layout(); } else items[i] = yours;
    }
    items[i] = { ...items[i], target: to };
    chips[i].update(items[i]);
    play(i, to, result);
  }

  // Anything that moves a piece redraws the wires: the rig, the pieces inside it, late fonts and logos.
  const watch = new ResizeObserver(layout);
  for (const el of [rig, sources, core, gates]) watch.observe(el);
  document.fonts?.ready.then(layout);
  addEventListener("load", layout);
  sources.addEventListener("scroll", () => { if (narrow()) requestAnimationFrame(layout); }, { passive: true });
  // It plays only while it can be seen.
  new IntersectionObserver((entries) => {
    visible = entries.some((e) => e.isIntersecting);
    if (!auto) return;
    if (visible && !run) play(0, SCENES[0].target);
    else if (visible && landed) timer = setTimeout(next, 900);
    else if (!visible) clearTimeout(timer);
  }, { threshold: 0.2 }).observe(rig);

  layout();
  setAuto(auto);
  if (still) play(1, SCENES[1].target);
  else { pill.className = "pill l-unknown"; pill.textContent = "Ready"; route.textContent = `${SCENES[0].shown} → ${targetById(SCENES[0].target).name}`; title.textContent = "Every address gets an honest answer"; detail.textContent = "Pick an address, then pick the chain it landed on. Each click runs a real recovery check."; }
  return { show, layout };
}
