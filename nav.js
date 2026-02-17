// nav.js — WBL 3rd Grade 2026
// Purpose: hamburger open/close + overlay behavior
// NOTE: Links are defined in each page's <nav>; this file does not generate navigation markup.

(function () {
  function ready(fn) {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", fn);
    } else {
      fn();
    }
  }

  ready(function () {
    const toggle = document.querySelector(".navToggle");
    const overlay = document.querySelector(".navOverlay");
    const nav = document.getElementById("siteNav");

    if (!toggle || !overlay || !nav) return;

    function openMenu() {
      document.body.classList.add("navOpen");
      toggle.setAttribute("aria-expanded", "true");
      overlay.setAttribute("aria-hidden", "false");
    }

    function closeMenu() {
      document.body.classList.remove("navOpen");
      toggle.setAttribute("aria-expanded", "false");
      overlay.setAttribute("aria-hidden", "true");
    }

    function isOpen() {
      return document.body.classList.contains("navOpen");
    }

    toggle.addEventListener("click", function () {
      if (isOpen()) closeMenu();
      else openMenu();
    });

    overlay.addEventListener("click", function () {
      closeMenu();
    });

    // Close menu after clicking a link (mobile UX)
    nav.addEventListener("click", function (e) {
      const a = e.target && e.target.closest ? e.target.closest("a") : null;
      if (a) closeMenu();
    });

    // Escape key closes menu
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape") closeMenu();
    });

    // Ensure overlay state is consistent on load
    closeMenu();
  });
})();
