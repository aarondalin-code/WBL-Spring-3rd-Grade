// Tournament-style hamburger behavior (sitewide)
(function(){
  const html = document.documentElement;
  const body = document.body;

  const toggle = document.querySelector(".navToggle");
  const overlay = document.querySelector(".navOverlay");
  const nav = document.getElementById("siteNav");

  if (!toggle || !overlay || !nav) return;

  function openNav(){
    html.classList.add("navOpen");
    body.classList.add("navOpen"); // harmless, extra compatibility
    toggle.setAttribute("aria-expanded", "true");
    overlay.setAttribute("aria-hidden", "false");
  }

  function closeNav(){
    html.classList.remove("navOpen");
    body.classList.remove("navOpen");
    toggle.setAttribute("aria-expanded", "false");
    overlay.setAttribute("aria-hidden", "true");
  }

  function isOpen(){
    return html.classList.contains("navOpen");
  }

  toggle.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    isOpen() ? closeNav() : openNav();
  });

  overlay.addEventListener("click", closeNav);

  // Close when clicking a link
  nav.addEventListener("click", (e) => {
    const a = e.target.closest("a");
    if (a) closeNav();
  });

  // Close on Escape
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeNav();
  });
})();
