// Tap-to-reveal walk pins. Each walk is a small circle with no visible name.
// Tapping or clicking a circle opens a small popup with the title and an
// "Open walk" button. Tapping anywhere else, or pressing Escape, hides it.
//
// The circle is a real <button> (keyboard focusable, aria-label = the name)
// with a hit area of at least 44 px on phones. When circles sit closer
// together than one hit area (for example the café and trolley street walks,
// or any pins on the globe), a tap lists every walk within reach, each with its
// own Open walk button, so a close pin is never hard to pick.
import { Marker, Popup } from "maplibre-gl";

const MIN_HIT = 44;

function walkHref(pin) {
  return "walk.html?id=" + encodeURIComponent(pin.id);
}

function metaLine(pin) {
  return [pin.city, pin.durationLabel].filter(Boolean).join(" · ");
}

export function createPinReveal(map, { onOpen } = {}) {
  const entries = [];
  let popup = null;
  let openFor = null;

  function dotVisible(entry) {
    const el = entry.el;
    return el.style.display !== "none" && el.dataset.filtered !== "1";
  }

  function setExpanded(el) {
    for (const entry of entries) {
      entry.el.setAttribute("aria-expanded", entry.el === el ? "true" : "false");
    }
  }

  function close({ restoreFocus = false } = {}) {
    const wasOpen = Boolean(popup);
    const target = openFor;
    if (popup) {
      const p = popup;
      popup = null;
      p.remove();
    }
    openFor = null;
    setExpanded(null);
    if (wasOpen && restoreFocus && target) target.focus();
  }

  // Walks within one hit area of the tapped circle, nearest first.
  function walksNear(entry) {
    const origin = map.project([entry.pin.lng, entry.pin.lat]);
    const reach = Math.max(MIN_HIT, entry.el.offsetWidth || MIN_HIT);
    const near = [];
    for (const other of entries) {
      if (!dotVisible(other)) continue;
      if (other === entry) continue;
      const p = map.project([other.pin.lng, other.pin.lat]);
      const d = Math.hypot(p.x - origin.x, p.y - origin.y);
      if (d < reach) near.push({ entry: other, d });
    }
    near.sort((a, b) => a.d - b.d);
    return [entry, ...near.map((n) => n.entry)];
  }

  function buildContent(group) {
    const root = document.createElement("div");
    root.className = "pin-reveal";
    root.setAttribute("role", "group");
    if (group.length > 1) {
      root.setAttribute("aria-label", group.length + " walks near here");
      const head = document.createElement("p");
      head.className = "pin-reveal-head";
      head.textContent = group.length + " walks near here";
      root.appendChild(head);
    } else {
      root.setAttribute("aria-label", "Walk details");
    }
    const list = document.createElement("ul");
    list.className = "pin-reveal-list";
    for (const entry of group) {
      const li = document.createElement("li");
      const title = document.createElement("strong");
      title.className = "pin-reveal-title";
      title.textContent = entry.pin.name;
      li.appendChild(title);
      const meta = metaLine(entry.pin);
      if (meta) {
        const m = document.createElement("span");
        m.className = "pin-reveal-meta";
        m.textContent = meta;
        li.appendChild(m);
      }
      const open = document.createElement("a");
      open.className = "primary pin-reveal-open";
      open.href = walkHref(entry.pin);
      open.textContent = "Open walk";
      open.setAttribute("aria-label", "Open walk: " + entry.pin.name);
      open.addEventListener("click", () => {
        if (onOpen) onOpen(entry.pin);
      });
      li.appendChild(open);
      list.appendChild(li);
    }
    root.appendChild(list);
    return root;
  }

  function show(entry, viaKeyboard) {
    if (popup && openFor === entry.el) {
      close();
      return;
    }
    close();
    const group = viaKeyboard ? [entry] : walksNear(entry);
    const pt = map.project([entry.pin.lng, entry.pin.lat]);
    // Open on the side with room: above the circle by default, below it when
    // the circle sits near the top of the map or under the page header. The
    // list scrolls inside whatever space is left so the card is never clipped.
    const container = map.getContainer();
    const mapTop = container.getBoundingClientRect().top;
    const header = document.querySelector("header.top");
    const headerInset = header ? Math.max(0, header.getBoundingClientRect().bottom - mapTop) : 0;
    const gap = 18 + 8;
    const roomAbove = pt.y - headerInset - gap;
    const roomBelow = container.clientHeight - pt.y - gap;
    const wanted = 64 + 104 * group.length;
    const anchor = roomAbove >= wanted || roomAbove >= roomBelow ? "bottom" : "top";
    const room = anchor === "bottom" ? roomAbove : roomBelow;
    const content = buildContent(group);
    const listEl = content.querySelector(".pin-reveal-list");
    if (listEl) listEl.style.maxHeight = Math.max(112, Math.min(room - 64, window.innerHeight * 0.5)) + "px";
    popup = new Popup({
      closeButton: false,
      closeOnClick: true,
      closeOnMove: false,
      focusAfterOpen: false,
      maxWidth: "272px",
      offset: 18,
      anchor,
      className: "pin-reveal-popup",
    })
      .setLngLat([entry.pin.lng, entry.pin.lat])
      .setDOMContent(content)
      .addTo(map);
    openFor = entry.el;
    const mine = popup;
    popup.on("close", () => {
      if (popup === mine) {
        popup = null;
        openFor = null;
        setExpanded(null);
      }
    });
    setExpanded(entry.el);
    if (viaKeyboard) {
      const link = popup.getElement().querySelector("a.pin-reveal-open");
      if (link) link.focus();
    }
  }

  function addPin(pin) {
    const el = document.createElement("button");
    el.type = "button";
    el.className = "map-dot";
    el.dataset.pinId = pin.id;
    el.setAttribute("aria-label", pin.name);
    el.setAttribute("aria-haspopup", "true");
    el.setAttribute("aria-expanded", "false");
    const core = document.createElement("i");
    core.setAttribute("aria-hidden", "true");
    el.appendChild(core);
    const entry = { pin, el, marker: null };
    el.addEventListener("click", (e) => {
      e.stopPropagation();
      // detail is 0 for a keyboard "click" (Enter or Space).
      show(entry, e.detail === 0);
    });
    entry.marker = new Marker({ element: el, anchor: "center" }).setLngLat([pin.lng, pin.lat]).addTo(map);
    entries.push(entry);
    return entry.marker;
  }

  function clear() {
    close();
    for (const entry of entries) entry.marker.remove();
    entries.length = 0;
  }

  // Tapping elsewhere hides the popup (the map's own click handles map taps;
  // this also covers the header, the list sheet, and the page around the map).
  document.addEventListener("pointerdown", (e) => {
    if (!popup) return;
    const t = e.target;
    if (t && t.closest && (t.closest(".pin-reveal-popup") || t.closest(".map-dot"))) return;
    close();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && popup) {
      e.stopPropagation();
      close({ restoreFocus: true });
    }
  });
  return { addPin, clear, close, entries };
}
