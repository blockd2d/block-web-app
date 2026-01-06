(() => {
  const prefersReduced = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const qs = (s, el=document) => el.querySelector(s);
  const qsa = (s, el=document) => Array.from(el.querySelectorAll(s));

  function initYear(){
    const y = qs("#year");
    if (y) y.textContent = new Date().getFullYear();
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
        if (e.isIntersecting){
          e.target.classList.add("is-visible");
          io.unobserve(e.target);
        }
      });
    }, { threshold: 0.14, rootMargin: "0px 0px -10% 0px" });
    nodes.forEach(n => io.observe(n));
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

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") close();
    });

    document.addEventListener("click", (e) => {
      if (!menu.classList.contains("is-open")) return;
      const within = menu.contains(e.target) || toggle.contains(e.target);
      if (!within) close();
    });

    qsa("#navMenu a").forEach(a => a.addEventListener("click", close));
  }

  function initSmoothAnchors(){
    if (prefersReduced) return;
    qsa('a[href^="#"]').forEach(a => {
      a.addEventListener("click", (e) => {
        const href = a.getAttribute("href");
        if (!href || href === "#") return;
        const target = document.getElementById(href.slice(1));
        if (!target) return;
        e.preventDefault();
        target.scrollIntoView({ behavior: "smooth", block: "start" });
        history.replaceState(null, "", href);
      });
    });
  }

  function initBookForm(){
    const form = qs("#bookForm");
    const notice = qs("#formNotice");
    if (!form) return;

    const setNotice = (text, type) => {
      if (!notice) return;
      notice.textContent = text;
      notice.dataset.type = type || "";
    };

    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const fd = new FormData(form);
      const required = ["name", "email", "company"];
      const missing = required.filter(k => !String(fd.get(k) || "").trim());
      if (missing.length){
        setNotice("Please fill in your name, email, and company.", "bad");
        notice?.focus?.();
        return;
      }
      setNotice("Request received. We'll follow up within 1 business day to confirm a time.", "ok");
      form.reset();
      notice?.focus?.();
    });

    const css = `
      .formNotice{
        margin-top: .8rem;
        padding: .9rem 1rem;
        border-radius: 18px;
        border: 1px solid rgba(11,13,18,.14);
        background: rgba(255,255,255,.9);
        box-shadow: 0 14px 26px rgba(11,13,18,.08);
      }
      .formNotice[data-type="ok"]{ box-shadow: 0 0 0 4px rgba(18,185,129,.14), 0 14px 26px rgba(11,13,18,.08); border-color: rgba(18,185,129,.30); }
      .formNotice[data-type="bad"]{ box-shadow: 0 0 0 4px rgba(255,77,90,.14), 0 14px 26px rgba(11,13,18,.08); border-color: rgba(255,77,90,.30); }
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
  });
})();
