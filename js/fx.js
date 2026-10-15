/* Talleres Juma — fx.js: inclinación de tarjetas y línea de proceso */
(function () {
  "use strict";
  var fine = matchMedia("(hover:hover) and (pointer:fine)").matches;
  var calm = matchMedia("(prefers-reduced-motion: reduce)").matches;

  if (fine && !calm) {
    document.querySelectorAll(".service-card").forEach(function (c) {
      c.classList.add("fx-tilt");
      c.addEventListener("pointermove", function (e) {
        var r = c.getBoundingClientRect();
        c.style.setProperty("--ry", (((e.clientX - r.left) / r.width - 0.5) * 8).toFixed(2) + "deg");
        c.style.setProperty("--rx", (-((e.clientY - r.top) / r.height - 0.5) * 8).toFixed(2) + "deg");
      }, { passive: true });
      c.addEventListener("pointerleave", function () {
        c.style.setProperty("--rx", "0deg"); c.style.setProperty("--ry", "0deg");
      });
    });
  }

  var box = document.querySelector(".process-steps");
  if (!box) return;
  var steps = [].slice.call(box.querySelectorAll(".process-step"));
  function run() {
    box.classList.add("run");
    steps.forEach(function (s, i) { setTimeout(function () { s.classList.add("on"); }, calm ? 0 : i * 520); });
  }
  if ("IntersectionObserver" in window && !calm) {
    var io = new IntersectionObserver(function (es) {
      if (es[0].isIntersecting) { io.disconnect(); run(); }
    }, { threshold: 0.4 });
    io.observe(box);
  } else run();
})();
