/* ==========================================================================
   Talleres Juma — extras.js
   Engranaje de scroll, nav inteligente, contadores, brillo, lightbox, ambiente
   ========================================================================== */
(function () {
  "use strict";
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return [].slice.call((r || document).querySelectorAll(s)); };
  var calm = matchMedia("(prefers-reduced-motion: reduce)").matches;
  var fine = matchMedia("(hover:hover) and (pointer:fine)").matches;

  /* ---- engranaje + nav inteligente (un solo listener, throttled con rAF) ---- */
  var gear = document.createElement("div");
  gear.className = "gear-tip"; gear.setAttribute("aria-hidden", "true");
  gear.innerHTML = '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9.2" fill="none" stroke="currentColor" stroke-width="3" stroke-dasharray="3.6 3.614"/><circle cx="12" cy="12" r="7.4" fill="currentColor"/><circle cx="12" cy="12" r="3" fill="#060c2b"/></svg>';
  document.body.appendChild(gear);
  var nav = $("#nav"), lastY = scrollY, tick = false;
  function onScroll() {
    tick = false;
    var max = document.documentElement.scrollHeight - innerHeight, y = scrollY;
    var pct = max > 0 ? y / max : 0;
    gear.style.transform = "translate3d(" + (pct * innerWidth - 11) + "px,0,0) rotate(" + (y * 0.45) + "deg)";
    if (nav) {
      var dy = y - lastY;
      if (y < 160 || dy < -6) nav.classList.remove("hide");
      else if (dy > 8) nav.classList.add("hide");
    }
    lastY = y;
  }
  addEventListener("scroll", function () { if (!tick) { tick = true; requestAnimationFrame(onScroll); } }, { passive: true });
  onScroll();
  if (nav) nav.addEventListener("focusin", function () { nav.classList.remove("hide"); });

  /* ---- scrollspy ---- */
  var links = $$('.nav-links a[href^="#"]');
  var secs = links.map(function (a) { return $(a.getAttribute("href")); }).filter(Boolean);
  if ("IntersectionObserver" in window && secs.length) {
    var so = new IntersectionObserver(function (es) {
      es.forEach(function (e) {
        if (e.isIntersecting) links.forEach(function (a) { a.classList.toggle("active", a.getAttribute("href") === "#" + e.target.id); });
      });
    }, { rootMargin: "-45% 0px -50% 0px" });
    secs.forEach(function (s) { so.observe(s); });
  }

  /* ---- contadores (36, 20, 100%): empiezan en 0 y suben cuando se ven ---- */
  var nums = $$(".stat-num");
  nums.forEach(function (el) {
    var m = el.textContent.trim().match(/^(\d+)(.*)$/); if (!m) return;
    el._end = +m[1]; el._suf = m[2];
    if (!calm) el.textContent = "0" + m[2];
  });
  if ("IntersectionObserver" in window && !calm) {
    var co = new IntersectionObserver(function (es) {
      es.forEach(function (e) {
        if (!e.isIntersecting) return; co.unobserve(e.target);
        var el = e.target; if (el._end == null) return;
        var t0 = performance.now() + 350 + nums.indexOf(el) * 180;
        (function f(t) {
          var k = Math.min(Math.max((t - t0) / 2200, 0), 1), v = el._end * (1 - Math.pow(1 - k, 4));
          el.textContent = Math.round(v) + el._suf;
          if (k < 1) requestAnimationFrame(f);
        })(performance.now());
      });
    }, { threshold: 0.4 });
    nums.forEach(function (e) { co.observe(e); });
  } else {
    nums.forEach(function (el) { if (el._end != null) el.textContent = el._end + el._suf; });
  }

  /* ---- brillo en tarjetas: cursor en PC, toque en celular ---- */
  $$(".service-card,.testimonial-card").forEach(function (el) {
    function pos(e) { var r = el.getBoundingClientRect(); el.style.setProperty("--mx", (e.clientX - r.left) + "px"); el.style.setProperty("--my", (e.clientY - r.top) + "px"); }
    el.addEventListener("pointermove", pos, { passive: true });
    el.addEventListener("pointerdown", function (e) { pos(e); el.classList.add("lit"); setTimeout(function () { el.classList.remove("lit"); }, 700); }, { passive: true });
  });

  /* ---- botones magnéticos (solo mouse) ---- */
  if (fine && !calm) {
    $$(".btn").forEach(function (b) {
      b.addEventListener("pointermove", function (e) { var r = b.getBoundingClientRect(); b.style.translate = ((e.clientX - r.left - r.width / 2) * 0.1) + "px " + ((e.clientY - r.top - r.height / 2) * 0.18) + "px"; });
      b.addEventListener("pointerleave", function () { b.style.translate = ""; });
    });
  }

  /* ---- lightbox: flechas, teclado y swipe; pausa el 3D mientras está abierto ---- */
  var items = $$(".gallery-item");
  if (items.length) {
    var lb = document.createElement("div");
    lb.className = "lb"; lb.setAttribute("role", "dialog"); lb.setAttribute("aria-modal", "true");
    lb.innerHTML = '<img alt=""><div class="lb-cap"></div><button class="lb-x" aria-label="Cerrar">×</button><button class="lb-prev" aria-label="Anterior">‹</button><button class="lb-next" aria-label="Siguiente">›</button>';
    document.body.appendChild(lb);
    var li = $("img", lb), cap = $(".lb-cap", lb), cur = 0;
    function show(i) {
      cur = (i + items.length) % items.length;
      var im = $("img", items[cur]), st = $("strong", items[cur]), lab = $(".gallery-label", items[cur]);
      li.src = im.currentSrc || im.src; li.alt = im.alt;
      cap.innerHTML = (st ? st.textContent : "") + "<small>" + (cur + 1) + " / " + items.length + (lab ? " · " + lab.textContent.trim() : "") + "</small>";
    }
    function open(i) { show(i); lb.classList.add("open"); window.__sceneHold = true; }
    function close() { lb.classList.remove("open"); window.__sceneHold = false; }
    items.forEach(function (it, i) {
      it.tabIndex = 0; it.setAttribute("role", "button");
      it.addEventListener("click", function () { open(i); });
      it.addEventListener("keydown", function (e) { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); open(i); } });
    });
    $(".lb-x", lb).addEventListener("click", close);
    $(".lb-prev", lb).addEventListener("click", function () { show(cur - 1); });
    $(".lb-next", lb).addEventListener("click", function () { show(cur + 1); });
    lb.addEventListener("click", function (e) { if (e.target === lb) close(); });
    addEventListener("keydown", function (e) {
      if (!lb.classList.contains("open")) return;
      if (e.key === "Escape") close(); if (e.key === "ArrowLeft") show(cur - 1); if (e.key === "ArrowRight") show(cur + 1);
    });
    var sx = 0;
    lb.addEventListener("touchstart", function (e) { sx = e.touches[0].clientX; }, { passive: true });
    lb.addEventListener("touchend", function (e) { var d = e.changedTouches[0].clientX - sx; if (Math.abs(d) > 50) show(cur + (d < 0 ? 1 : -1)); }, { passive: true });
  }

  /* ---- ambiente: luces de faro, brillo de cursor, ripple táctil ---- */
  if (calm) return;
  var st = document.createElement("div"); st.className = "streaks"; st.setAttribute("aria-hidden", "true");
  [["14%", "var(--red-bright)", 23, -2], ["38%", "var(--blue-bright)", 31, -14], ["62%", "var(--red-bright)", 27, -9], ["84%", "var(--blue-bright)", 36, -22]].forEach(function (c) {
    var i = document.createElement("i"); i.style.cssText = "--y:" + c[0] + ";--c:" + c[1] + ";--d:" + c[2] + "s;--dl:" + c[3] + "s"; st.appendChild(i);
  });
  document.body.appendChild(st);
  if (fine) {
    var g = document.createElement("div"); g.className = "cursor-glow"; g.setAttribute("aria-hidden", "true"); document.body.appendChild(g);
    var gx = innerWidth / 2, gy = innerHeight / 2, tx = gx, ty = gy, run = false;
    function loop() {
      gx += (tx - gx) * 0.12; gy += (ty - gy) * 0.12;
      g.style.transform = "translate3d(" + gx + "px," + gy + "px,0)";
      if (Math.abs(tx - gx) + Math.abs(ty - gy) > 0.5 && !document.hidden) requestAnimationFrame(loop); else run = false;
    }
    addEventListener("pointermove", function (e) { tx = e.clientX; ty = e.clientY; g.classList.add("on"); if (!run) { run = true; requestAnimationFrame(loop); } }, { passive: true });
    document.addEventListener("pointerleave", function () { g.classList.remove("on"); });
  } else {
    addEventListener("pointerdown", function (e) {
      var r = document.createElement("span"); r.className = "ripple"; r.style.left = e.clientX + "px"; r.style.top = e.clientY + "px";
      document.body.appendChild(r); r.addEventListener("animationend", function () { r.remove(); });
    }, { passive: true });
  }
})();
