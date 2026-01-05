(() => {
  const prefersReduced = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function qs(sel, el=document){ return el.querySelector(sel); }
  function qsa(sel, el=document){ return Array.from(el.querySelectorAll(sel)); }

  function initYear(){
    const y = qs("#year");
    if (y) y.textContent = new Date().getFullYear();
  }

  function initMobileNav(){
    const toggle = qs(".nav__toggle");
    const menu = qs("#navMenu");
    if (!toggle || !menu) return;

    const close = () => {
      menu.classList.remove("is-open");
      toggle.setAttribute("aria-expanded", "false");
    };

    toggle.addEventListener("click", () => {
      const open = menu.classList.toggle("is-open");
      toggle.setAttribute("aria-expanded", open ? "true" : "false");
    });

    // Close on outside click
    document.addEventListener("click", (e) => {
      if (!menu.classList.contains("is-open")) return;
      const within = menu.contains(e.target) || toggle.contains(e.target);
      if (!within) close();
    });

    // Close on escape
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") close();
    });

    // Close when a link is selected (better UX)
    qsa("#navMenu a").forEach(a => a.addEventListener("click", close));
  }

  function initReveal(){
    const nodes = qsa(".reveal");
    if (!nodes.length) return;
    if (prefersReduced || !("IntersectionObserver" in window)) {
      nodes.forEach(n => n.classList.add("is-visible"));
      return;
    }
    const io = new IntersectionObserver((entries) => {
      entries.forEach(e => {
        if (e.isIntersecting) {
          e.target.classList.add("is-visible");
          io.unobserve(e.target);
        }
      });
    }, { threshold: 0.18, rootMargin: "0px 0px -10% 0px" });

    nodes.forEach(n => io.observe(n));
  }

  function initSmoothAnchors(){
    // Keep the site vertical-first; smooth in-page jumps but respect reduced-motion.
    if (prefersReduced) return;
    qsa('a[href^="#"]').forEach(a => {
      a.addEventListener("click", (e) => {
        const id = a.getAttribute("href");
        if (!id || id === "#") return;
        const target = document.getElementById(id.slice(1));
        if (!target) return;
        e.preventDefault();
        target.scrollIntoView({ behavior: "smooth", block: "start" });
        history.replaceState(null, "", id);
      });
    });
  }

  function initBookForm(){
    const form = qs("#bookForm");
    const notice = qs("#formNotice");
    if (!form) return;

    form.addEventListener("submit", (e) => {
      e.preventDefault();

      const fd = new FormData(form);
      const required = ["name", "email", "company"];
      const missing = required.filter(k => !String(fd.get(k) || "").trim());

      if (missing.length) {
        if (notice) {
          notice.textContent = "Please fill in your name, email, and company.";
          notice.classList.remove("is-ok");
          notice.classList.add("is-bad");
        }
        return;
      }

      // Static site: no backend. Provide a clean confirmation.
      if (notice) {
        notice.textContent = "Request received. We'll follow up within 1 business day to confirm a time.";
        notice.classList.remove("is-bad");
        notice.classList.add("is-ok");
      }
      form.reset();
      // Keep focus for keyboard users
      if (notice) notice.focus?.();
    });
  }

  // Add minimal notice styles via JS (no extra color additions; uses existing palette)
  function injectNoticeStyles(){
    const css = `
      .form-notice{ margin-top: .8rem; padding: .85rem 1rem; border-radius: 16px; border: 1px solid rgba(12,15,20,.14);
        background: rgba(255,255,255,.85); box-shadow: 0 10px 18px rgba(12,15,20,.05); }
      .form-notice.is-ok{ border-color: rgba(11,164,166,.30); box-shadow: 0 0 0 4px rgba(11,164,166,.10), 0 10px 18px rgba(12,15,20,.05); }
      .form-notice.is-bad{ border-color: rgba(255,176,32,.35); box-shadow: 0 0 0 4px rgba(255,176,32,.12), 0 10px 18px rgba(12,15,20,.05); }
    `;
    const style = document.createElement("style");
    style.textContent = css;
    document.head.appendChild(style);
  }

  document.addEventListener("DOMContentLoaded", () => {
    initYear();
    initMobileNav();
    initReveal();
    initSmoothAnchors();
    initBookForm();
    injectNoticeStyles();
  });
})();
