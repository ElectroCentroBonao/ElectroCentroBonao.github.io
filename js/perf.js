/* ============================================================
   PERF.JS — decide el nivel de efectos y carga el 3D solo si conviene
   ------------------------------------------------------------
   full = fondo 3D (Three.js + scene.js)
   lite = fondo CSS/SVG sin 3D (js/fx.js + css/fx.css)

   Cargar en <head>, SIN defer, antes de los CSS (así el nivel queda
   puesto en <html data-fx data-scene> antes del primer pintado).

   Cómo decide:
   1. Señales instantáneas: ahorro de datos, red lenta, poca RAM,
      pocos núcleos.
   2. Tras cargar la página (en un momento libre): prueba de GPU
      (¿hay WebGL acelerado?) y mini prueba de CPU.
   3. Ya con el 3D andando, scene.js vigila los FPS, baja calidad
      por pasos y, si aun así va lento, llama a ECB_FX.fallback().
   Si baja a "lite" por lag, se recuerda 7 días para no volver a
   intentar el 3D en ese dispositivo.

   Pruebas (en la URL):
     ?fx=lite     fuerza el modo ligero
     ?fx=full     fuerza el 3D (sin vigilante de lag)
     ?fx=auto     borra lo recordado
     ?fxdebug=1   muestra el nivel elegido y el motivo
   ============================================================ */
(function(){
  'use strict';
  var d = document, root = d.documentElement, W = window, N = navigator;
  var KEY = 'ecb-fx2', LOWKEY = 'ecb-fxlow', TTL = 3 * 864e5;   // KEY nueva: ignora marcas viejas
  var THREE_URL = 'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js';
  var SCENE_URL = 'js/scene.js';
  /* umbrales ajustables */
  var LIMITS = { cpuMs: 45, minTex: 4096, strikes: 2 };

  function mq(q){ try{ return W.matchMedia(q).matches; }catch(e){ return false; } }
  function lsGet(k){ try{ return W.localStorage.getItem(k); }catch(e){ return null; } }
  function lsSet(k,v){ try{ W.localStorage.setItem(k,v); }catch(e){} }
  function lsDel(k){ try{ W.localStorage.removeItem(k); }catch(e){} }
  function fresh(k){ var n = +lsGet(k); return n > 0 && Date.now() - n < TTL; }
  /* "strikes": veces que el 3D se rindió por lag. Hacen falta 2 (en visitas distintas) para recordar el modo ligero */
  function strikes(){
    try{ var o = JSON.parse(lsGet(KEY) || 'null'); if(o && o.n && Date.now() - o.t < TTL) return o.n; }catch(e){}
    return 0;
  }

  var qs = { get: function(){ return null; } };
  try{ qs = new URLSearchParams(W.location.search); }catch(e){}
  var force = qs.get('fx');
  if(force === 'auto'){ lsDel(KEY); lsDel(LOWKEY); force = null; }
  if(force !== 'lite' && force !== 'full') force = null;

  /* ---------- señales instantáneas ---------- */
  var conn = N.connection || N.mozConnection || N.webkitConnection || {};
  var mobile = mq('(pointer:coarse)') || W.innerWidth < 900;
  function staticReason(){
    if(conn.saveData) return 'ahorro-de-datos';
    if(mq('(prefers-reduced-data:reduce)')) return 'ahorro-de-datos';
    if(/^(slow-2g|2g)$/.test(conn.effectiveType || '')) return 'red-lenta';
    if(N.deviceMemory && N.deviceMemory <= 2) return 'poca-ram';
    if(N.hardwareConcurrency && N.hardwareConcurrency <= 2) return 'pocos-nucleos';
    if(mobile && N.deviceMemory && N.deviceMemory <= 3 && N.hardwareConcurrency && N.hardwareConcurrency <= 4) return 'gama-baja';
    return '';
  }

  var tier = 'full', reason = '', forced = false;
  if(force){ tier = force; reason = 'manual'; forced = true; }
  else{
    var why = staticReason();
    if(why){ tier = 'lite'; reason = why; }
    else if(strikes() >= LIMITS.strikes){ tier = 'lite'; reason = 'recordado'; }
  }

  var FX = W.ECB_FX = {
    tier: tier, scene: tier === 'full' ? 'loading' : 'off',
    reason: reason, forced: forced, low: false, info: {}
  };

  /* ---------- aplicar al <html> ---------- */
  function hud(){
    if(!qs.get('fxdebug')) return;
    if(!d.body){ d.addEventListener('DOMContentLoaded', hud); return; }
    var h = d.getElementById('fx-hud');
    if(!h){
      h = d.createElement('div'); h.id = 'fx-hud';
      h.style.cssText = 'position:fixed;left:8px;bottom:8px;z-index:99999;font:11px/1.35 monospace;background:rgba(0,0,0,.8);color:#9f9;padding:6px 9px;border-radius:6px;pointer-events:none;max-width:76vw;text-shadow:none';
      d.body.appendChild(h);
    }
    h.textContent = 'fx:' + FX.tier + (FX.low ? '+low' : '') + ' · 3d:' + FX.scene + (FX.reason ? ' · ' + FX.reason : '') +
      (FX.info.cpu ? ' · cpu ' + FX.info.cpu + 'ms' : '') + ' · strikes ' + strikes() + (FX.info.fps ? ' · ' + FX.info.fps + 'fps' : '') + (FX.info.gpu ? ' · ' + FX.info.gpu : '');
  }
  function apply(){
    root.setAttribute('data-fx', FX.tier);
    root.setAttribute('data-scene', FX.scene);
    hud();
    try{ d.dispatchEvent(new CustomEvent('ecb:fx', { detail: { tier: FX.tier, scene: FX.scene, reason: FX.reason } })); }catch(e){}
  }

  FX.ready = function(){ if(FX.tier !== 'full') return; FX.scene = 'on'; apply(); };
  FX.fallback = function(why){
    if(FX.tier === 'lite') return;
    if(FX.forced && why !== 'error' && why !== 'sin-three') return;
    FX.tier = 'lite'; FX.scene = 'off'; FX.reason = why;
    /* solo el lag real cuenta como strike; fallos de red, contexto perdido, etc. no se recuerdan */
    if(!FX.forced && (why === 'lag' || why === 'muy-lento' || why === 'escena-lenta')){
      lsSet(KEY, JSON.stringify({ n: strikes() + 1, t: Date.now() }));
    }
    apply();
  };
  /* el 3D corrió fluido un buen rato: se perdona cualquier strike anterior */
  FX.stable = function(){ lsDel(KEY); };
  /* modo ligero "bajo": también apaga las animaciones decorativas infinitas */
  FX.lower = function(why){
    if(FX.low) return;
    FX.low = true; root.classList.add('fx-low');
    if(why !== 'inicial') lsSet(LOWKEY, String(Date.now()));
    hud();
  };
  if(!force && ((N.deviceMemory && N.deviceMemory <= 1) || conn.saveData || fresh(LOWKEY))) FX.lower('inicial');

  apply();

  /* ---------- pruebas profundas (después de cargar) ---------- */
  function whenIdle(fn, t){
    if('requestIdleCallback' in W) W.requestIdleCallback(fn, { timeout: t || 1500 });
    else W.setTimeout(fn, 200);
  }
  function onLoad(fn){
    if(d.readyState === 'complete') fn(); else W.addEventListener('load', fn);
  }

  function gpuReason(){
    try{
      var c = d.createElement('canvas');
      var gl = c.getContext('webgl', { failIfMajorPerformanceCaveat: true });
      if(!gl) return 'sin-webgl-acelerado';
      var ext = gl.getExtension('WEBGL_debug_renderer_info');
      var r = ext ? String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) || '') : '';
      var tex = gl.getParameter(gl.MAX_TEXTURE_SIZE) || 0;
      var lose = gl.getExtension('WEBGL_lose_context'); if(lose) lose.loseContext();
      FX.info.gpu = r.replace(/ANGLE \(|\)$/g, '').slice(0, 48);
      if(tex && tex < LIMITS.minTex) return 'gpu-basica';
      if(/swiftshader|llvmpipe|softpipe|software|basic render|mali-4\d\d|mali-t[67]\d\d|adreno \(tm\) ?[23]\d\d|powervr sgx|vivante|videocore/i.test(r)) return 'gpu-basica';
    }catch(e){ return 'sin-webgl'; }
    return '';
  }
  /* 3 tandas cortas y se toma la mejor: la primera suele salir lenta por el JIT */
  function cpuMs(){
    var best = 1e9, s = 0;
    for(var k = 0; k < 3; k++){
      var t = performance.now();
      for(var i = 0; i < 2e5; i++){ s += Math.sqrt(i) * Math.sin(i); }
      best = Math.min(best, performance.now() - t);
    }
    FX.info.sink = s;
    return best;
  }

  function loadScene(){
    if(FX.tier !== 'full') return;
    var s = d.createElement('script');
    s.src = SCENE_URL; s.async = true;
    s.onerror = function(){ FX.fallback('error'); };
    d.body.appendChild(s);
    /* vigilante: si tras 25 s VISIBLES el 3D no arrancó, se queda el modo ligero (no se recuerda) */
    var vis = 0, iv = W.setInterval(function(){
      if(FX.tier !== 'full' || FX.scene === 'on'){ W.clearInterval(iv); return; }
      if(!d.hidden && ++vis >= 25){ W.clearInterval(iv); FX.fallback('timeout'); }
    }, 1000);
  }
  function loadThree(){
    var s = d.createElement('script');
    s.src = THREE_URL; s.async = true;
    s.onload = function(){ whenIdle(loadScene, 1200); };
    s.onerror = function(){ FX.fallback('sin-three'); };
    d.head.appendChild(s);
  }

  function boot(){
    if(FX.tier !== 'full') return;
    onLoad(function(){
      whenIdle(function(){
        if(FX.tier !== 'full') return;
        if(!FX.forced){
          var g = gpuReason();
          if(g){ FX.fallback(g); return; }
          var c = cpuMs(); FX.info.cpu = Math.round(c * 10) / 10;
          if(c > LIMITS.cpuMs){ FX.fallback('cpu-lenta'); return; }
        }
        hud();
        loadThree();
      }, 2000);
    });
  }
  if(d.readyState === 'loading') d.addEventListener('DOMContentLoaded', boot); else boot();
})();
