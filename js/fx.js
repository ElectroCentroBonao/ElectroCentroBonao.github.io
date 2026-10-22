/* ============================================================
   FX.JS — escena ligera (sin 3D), interacciones pulidas,
   vigilante de rendimiento y mapa bajo demanda.
   Cargar con defer, después de interactions.js y extras.js.
   ============================================================ */
(function(){
  'use strict';
  var d = document, root = d.documentElement, W = window;
  var FX = W.ECB_FX || { tier: 'lite', scene: 'off', info: {}, lower: function(){} };
  function $(s, r){ return (r || d).querySelector(s); }
  function $$(s, r){ return [].slice.call((r || d).querySelectorAll(s)); }
  function mq(q){ try{ return W.matchMedia(q).matches; }catch(e){ return false; } }
  var calm = mq('(prefers-reduced-motion:reduce)');
  var fine = mq('(hover:hover) and (pointer:fine)');
  function idle(fn){ if('requestIdleCallback' in W) W.requestIdleCallback(fn, { timeout: 1500 }); else W.setTimeout(fn, 300); }

  /* ---------- 1. entradas escalonadas (el CSS solo actúa en modo ligero) ---------- */
  [['.stats-grid>.stat', 1], ['.rev-grid>.rev-card', 1], ['.gal-grid>.gal-item', 1], ['.why-list>.why-item', 0], ['.loc-card>.loc-row', 0]].forEach(function(g){
    $$(g[0]).forEach(function(el){
      var i = [].indexOf.call(el.parentNode.children, el);
      el.classList.add('sr'); el.style.setProperty('--i', Math.min(i, 6));
      if(g[1]) el.parentNode.classList.add('has-sr');
    });
  });

  /* ---------- 2. escena ligera: la luz pasa de la luna a la lámpara con el scroll ---------- */
  var stage = $('.lite-stage');
  if(stage){
    var room = $('.ls-room', stage), moon = $('.ls-moonlight', stage), lamp = $('.ls-lamplight', stage), hex = $('.ls-hex', stage);
    var cur = 0, tgt = 0, px = 0, py = 0, tpx = 0, tpy = 0, run = false, active = false, last = 0, dustDone = false, hideT = 0;

    function target(){
      var h = root.scrollHeight - W.innerHeight;
      tgt = h > 0 ? Math.min(1, Math.max(0, W.scrollY / h)) : 0;
    }
    function paint(){
      var w = cur * cur * (3 - 2 * cur);
      moon.style.opacity = (1 - 0.6 * w).toFixed(3);
      lamp.style.opacity = (0.3 + 0.7 * w).toFixed(3);
      room.style.transform = 'translate3d(' + (-px * 14).toFixed(1) + 'px,' + (-cur * 44 - py * 8).toFixed(1) + 'px,0)';
      hex.style.transform = 'translate3d(' + (px * 10).toFixed(1) + 'px,' + (-cur * 110).toFixed(1) + 'px,0)';
    }
    /* el bucle solo corre mientras algo se está moviendo: en reposo no gasta nada */
    function loop(t){
      var dt = Math.min((t - last) / 1000 || 0.016, 0.05); last = t;
      var snap = calm || root.classList.contains('fx-low');
      var k = 1 - Math.exp(-dt * (snap ? 30 : 5)), kp = 1 - Math.exp(-dt * 4);
      cur += (tgt - cur) * k; px += (tpx - px) * kp; py += (tpy - py) * kp;
      paint();
      if(active && (Math.abs(tgt - cur) > 0.0006 || Math.abs(tpx - px) > 0.003 || Math.abs(tpy - py) > 0.003)) requestAnimationFrame(loop);
      else run = false;
    }
    function kick(){ if(!run && active){ run = true; last = performance.now(); requestAnimationFrame(loop); } }

    function makeDust(){
      if(dustDone || calm) return; dustDone = true;
      var box = $('.ls-dust', stage); if(!box) return;
      var n = W.innerWidth < 700 ? 9 : 14, f = d.createDocumentFragment();
      for(var i = 0; i < n; i++){
        var m = d.createElement('i'), s = m.style;
        s.setProperty('--x', (Math.random() * 100).toFixed(1) + '%');
        s.setProperty('--y', (35 + Math.random() * 60).toFixed(1) + '%');
        s.setProperty('--s', (2 + Math.random() * 3).toFixed(1) + 'px');
        s.setProperty('--d', (14 + Math.random() * 16).toFixed(1) + 's');
        s.setProperty('--dl', (-Math.random() * 20).toFixed(1) + 's');
        s.setProperty('--dx', ((Math.random() - 0.5) * 60).toFixed(0) + 'px');
        f.appendChild(m);
      }
      box.appendChild(f);
    }

    function sync(){
      var on = root.getAttribute('data-scene') !== 'on';
      clearTimeout(hideT);
      if(on){
        stage.style.display = '';
        if(!active){ active = true; target(); cur = tgt; paint(); idle(makeDust); }
      }else{
        active = false;
        /* cuando el 3D ya cubrió todo, se quita la escena ligera para que no cueste nada */
        hideT = W.setTimeout(function(){ if(root.getAttribute('data-scene') === 'on') stage.style.display = 'none'; }, 1200);
      }
    }
    W.addEventListener('scroll', function(){ if(active){ target(); kick(); } }, { passive: true });
    if(fine && !calm){
      W.addEventListener('pointermove', function(e){
        if(!active || e.pointerType === 'touch') return;
        tpx = (e.clientX / W.innerWidth) * 2 - 1; tpy = (e.clientY / W.innerHeight) * 2 - 1; kick();
      }, { passive: true });
    }
    d.addEventListener('ecb:fx', sync);
    sync();
  }

  /* ---------- 3. barra de navegación ---------- */
  var nav = $('nav'), navTick = false;
  function navState(){ if(nav) nav.classList.toggle('is-scrolled', W.scrollY > 24); }
  W.addEventListener('scroll', function(){
    if(!navTick){ navTick = true; requestAnimationFrame(function(){ navTick = false; navState(); }); }
  }, { passive: true });
  navState();

  /* ---------- 4. onda al tocar botones (solo modo ligero) ---------- */
  d.addEventListener('pointerdown', function(e){
    if(calm || root.getAttribute('data-fx') !== 'lite' || !e.target.closest) return;
    var b = e.target.closest('.btn,.chip'); if(!b) return;
    var r = b.getBoundingClientRect(), s = Math.max(r.width, r.height) * 2.2, el = d.createElement('span');
    el.className = 'btn-rip';
    el.style.width = el.style.height = s + 'px';
    el.style.left = (e.clientX - r.left - s / 2) + 'px';
    el.style.top = (e.clientY - r.top - s / 2) + 'px';
    b.appendChild(el);
    el.addEventListener('animationend', function(){ if(el.parentNode) el.parentNode.removeChild(el); });
  }, { passive: true });

  /* ---------- 5. vigilante: si ni el modo ligero rinde, apaga adornos infinitos ---------- */
  var strikes = 0, checks = 0, sampling = false;
  function median(a){ a = a.slice().sort(function(x, y){ return x - y; }); return a[a.length >> 1] || 0; }
  function check(){
    if(sampling || FX.low || root.getAttribute('data-fx') !== 'lite' || checks >= 5) return;
    sampling = true; checks++;
    var t0 = performance.now(), prev = t0, a = [];
    (function f(t){
      a.push(t - prev); prev = t;
      if(t - t0 < 1400 && !d.hidden){ requestAnimationFrame(f); return; }
      sampling = false;
      if(d.hidden || a.length < 20) { checks--; return; }
      var m = median(a.slice(4));
      FX.info.fps = Math.round(1000 / m);
      if(m > 40 && ++strikes >= 2) FX.lower('fps');
    })(t0);
  }
  W.addEventListener('load', function(){ W.setTimeout(check, 2500); });
  var sT = 0;
  W.addEventListener('scroll', function(){ clearTimeout(sT); sT = W.setTimeout(check, 350); }, { passive: true });

  /* ---------- 6. mapa bajo demanda (todos los niveles) ---------- */
  var box = $('.map-visual'), fr = box && $('iframe', box), btn = box && $('.map-load', box);
  if(fr){
    var loadMap = function(){
      if(fr.getAttribute('src')) return;
      fr.setAttribute('src', fr.getAttribute('data-src')); box.classList.add('is-live');
    };
    if(btn) btn.addEventListener('click', loadMap);
    /* en 3D se carga solo al acercarse; en modo ligero espera el toque */
    if('IntersectionObserver' in W){
      var io = new IntersectionObserver(function(es){
        if(!es[0].isIntersecting) return;
        io.disconnect();
        if(root.getAttribute('data-fx') === 'full') loadMap();
      }, { rootMargin: '300px' });
      io.observe(box);
    }
  }
})();
