// The chain picker: logos, names and what each network gets, with search. The real <select> stays underneath and holds
// the value, so everything else reads it as before.

/** The groups that still have a match for what was typed. */
export function matchGroups(groups, query) {
  const q = query.trim().toLowerCase().replace(/\s+/g, "");
  return groups.map((g) => ({ ...g, items: g.items.filter((c) => !q || c.name.toLowerCase().replace(/\s+/g, "").includes(q)) })).filter((g) => g.items.length);
}

export function mountPicker({ select, button, name, logo, groups, popular, kindOf, onPick }) {
  const make = (tag, className, text) => { const e = document.createElement(tag); if (className) e.className = className; if (text != null) e.textContent = text; return e; };
  const menu = make("div", "pick-menu"); menu.hidden = true;
  const search = make("input", "pick-search");
  search.type = "search"; search.placeholder = "Search chains"; search.autocomplete = "off"; search.spellcheck = false;
  search.setAttribute("aria-label", "Search chains");
  // Both groups sit at the top as tabs, so the second one is never buried under the first.
  const tabs = make("div", "pick-tabs");
  const tabOf = groups.map((g, i) => {
    const b = make("button", "pick-tab"); b.type = "button";
    b.append(make("b", null, `${g.label} (${g.items.length})`), make("small", null, g.note));
    b.addEventListener("click", () => { shown = i; search.value = ""; draw(); search.focus(); });
    tabs.append(b);
    return b;
  });
  const list = make("ul", "pick-list"); list.setAttribute("role", "listbox");
  // The chains most people want, visible whichever tab is open.
  const quick = make("div", "pick-quick");
  const everyone = groups.flatMap((g) => g.items);
  for (const id of popular) {
    const c = everyone.find((x) => x.id === id);
    const b = make("button", "pick-pop"); b.type = "button";
    const img = make("img"); img.src = `logos/${c.logo}.svg`; img.alt = ""; img.width = 20; img.height = 20;
    b.append(make("span", null, c.name), img);
    b.addEventListener("click", () => choose(c));
    quick.append(b);
  }
  menu.append(search, quick, tabs, list);
  button.parentElement.append(menu);

  let rows = [], active = -1, shown = 0;
  const setActive = (i) => {
    active = i;
    rows.forEach((r, k) => r.classList.toggle("active", k === i));
    rows[i]?.scrollIntoView({ block: "nearest" });
  };
  function draw() {
    list.replaceChildren();
    rows = [];
    // Typing searches every group; otherwise only the open tab is listed.
    const searching = search.value.trim() !== "";
    const found = matchGroups(searching ? groups : [groups[shown]], search.value);
    tabOf.forEach((b, i) => { const on = !searching && i === shown; b.classList.toggle("on", on); b.setAttribute("aria-pressed", String(on)); });
    // A group can point elsewhere, so a chain that isn't listed here doesn't look missing.
    const pointer = !searching && groups[shown].pointer;
    if (pointer) {
      const li = make("li", "pick-pointer"); li.setAttribute("role", "presentation");
      const go = make("button", null, pointer.action); go.type = "button";
      go.addEventListener("click", () => { shown = pointer.to; draw(); search.focus(); });
      li.append(make("span", null, pointer.text), go);
      list.append(li);
    }
    for (const g of found) {
      if (searching) {
        const head = make("li", "pick-group"); head.setAttribute("role", "presentation");
        head.append(make("b", null, g.label), make("small", null, g.note));
        list.append(head);
      }
      for (const c of g.items) {
        const li = make("li", "pick-row"); li.setAttribute("role", "option");
        const on = String(c.id) === select.value;
        li.setAttribute("aria-selected", String(on));
        if (on) li.classList.add("on");
        const img = make("img"); img.src = `logos/${c.logo}.svg`; img.alt = ""; img.width = 24; img.height = 24;
        li.append(img, make("span", null, c.name), make("em", null, kindOf(c)));
        li.addEventListener("click", () => choose(c));
        list.append(li); rows.push(li);
        li.dataset.id = String(c.id);
      }
    }
    if (!found.length) list.append(make("li", "pick-none", "No chain with that name"));
    active = -1;
  }
  const choose = (c) => { select.value = String(c.id); close(); button.focus(); onPick(); };
  function open() {
    menu.hidden = false; button.setAttribute("aria-expanded", "true");
    search.value = "";
    shown = Math.max(groups.findIndex((g) => g.items.some((c) => String(c.id) === select.value)), 0);
    draw();
    list.querySelector(".pick-row.on")?.scrollIntoView({ block: "center" });
    search.focus();
  }
  function close() { menu.hidden = true; button.setAttribute("aria-expanded", "false"); }

  button.addEventListener("click", () => (menu.hidden ? open() : close()));
  search.addEventListener("input", () => {
    draw();
    const q = search.value.trim().toLowerCase();
    if (rows.length) setActive(Math.max(rows.findIndex((r) => r.querySelector("span").textContent.toLowerCase().startsWith(q)), 0));
  });
  menu.addEventListener("keydown", (e) => {
    if (e.key === "Escape") { close(); button.focus(); }
    else if (e.key === "ArrowDown") { e.preventDefault(); setActive(Math.min(active + 1, rows.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActive(Math.max(active - 1, 0)); }
    else if (e.key === "Enter") {
      e.preventDefault();
      const id = rows[Math.max(active, 0)]?.dataset.id;
      const c = groups.flatMap((g) => g.items).find((x) => String(x.id) === id);
      if (c) choose(c);
    }
  });
  document.addEventListener("click", (e) => { if (!menu.hidden && !button.parentElement.contains(e.target)) close(); });
  return {
    open,
    sync() {
      const c = groups.flatMap((g) => g.items).find((x) => String(x.id) === select.value);
      name.textContent = c ? c.name : "Pick a chain";
      logo.src = c ? `logos/${c.logo}.svg` : "icons/favicon.svg";
      button.classList.toggle("empty", !c);
    },
  };
}
