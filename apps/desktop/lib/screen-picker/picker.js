"use strict";

// Picker page: shows the offered screens and windows, and sends back the one picked. Built with DOM nodes and
// textContent only, so a window title can never inject markup.
(() => {
  const bridge = window.nexusforgePicker;
  const shareButton = document.getElementById("share");
  const cancelButton = document.getElementById("cancel");
  let selectedId = null;

  function select(id) {
    selectedId = id;
    for (const tile of document.querySelectorAll(".tile")) {
      tile.setAttribute("aria-pressed", String(tile.dataset.id === id));
    }
    shareButton.disabled = !selectedId;
  }

  function share() {
    if (selectedId) bridge.choose(selectedId);
  }

  function tileFor(item) {
    const tile = document.createElement("button");
    tile.type = "button";
    tile.className = "tile";
    tile.dataset.id = item.id;
    tile.setAttribute("aria-pressed", "false");
    tile.setAttribute("aria-label", `${item.kind === "screen" ? "Screen" : "Window"}: ${item.name}`);
    const thumb = document.createElement("div");
    thumb.className = "thumb";
    if (item.thumbnail) {
      const img = document.createElement("img");
      img.src = item.thumbnail;
      img.alt = "";
      thumb.appendChild(img);
    } else {
      thumb.textContent = "No preview";
    }
    const label = document.createElement("span");
    label.className = "label";
    label.textContent = item.name;
    label.title = item.name;
    tile.append(thumb, label);
    tile.addEventListener("click", () => select(item.id));
    tile.addEventListener("dblclick", () => {
      select(item.id);
      share();
    });
    return tile;
  }

  bridge.onSources((items) => {
    const screens = document.getElementById("screens");
    const windows = document.getElementById("windows");
    screens.replaceChildren(...items.filter((item) => item.kind === "screen").map(tileFor));
    const windowTiles = items.filter((item) => item.kind === "window").map(tileFor);
    windows.replaceChildren(...windowTiles);
    document.getElementById("windows-empty").hidden = windowTiles.length > 0;
    // The main screen starts selected, so Share (or Enter) works straight away.
    const first = items.find((item) => item.kind === "screen" && item.primary) || items[0];
    if (first) select(first.id);
    const firstTile = document.querySelector(".tile[aria-pressed='true']");
    if (firstTile) firstTile.focus();
  });

  shareButton.addEventListener("click", share);
  cancelButton.addEventListener("click", () => bridge.cancel());
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      bridge.cancel();
    } else if (event.key === "Enter" && event.target !== cancelButton) {
      // Enter on a tile picks that tile and shares it; Enter anywhere else shares the current choice.
      event.preventDefault();
      const tile = event.target instanceof Element ? event.target.closest(".tile") : null;
      if (tile) select(tile.dataset.id);
      share();
    }
  });
})();
