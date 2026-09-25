/* ============================================================
   SCENE.JS v2 — sala de estar nocturna que reacciona al scroll
   Three.js r128 (CDN en index.html, antes de este archivo).
   Sin assets externos: todas las texturas se pintan en canvas.

   Qué incluye
   - Sofá mid-century, dos butacas con respaldo de rattan, mesa de
     centro con decoración, pouf, mesa auxiliar, lámpara de arco,
     lámpara colgante, plantas, floreros, libros, cuadros, espejo,
     repisa, ventana nocturna con cortinas y panel de listones.
   - Iluminación cálida + luz de luna, reflejos por entorno (PMREM),
     sombras suaves, sombras de contacto, brillos, polvo y rayos de luz.
   - Cámara guiada por una curva con el scroll, parallax con el
     mouse, respiración sutil e intro de entrada.
   - Rendimiento adaptativo, pausa en pestaña oculta y respeto a
     prefers-reduced-motion.
   ============================================================ */
(function(){
  'use strict';
  try{
    var canvas = document.getElementById('scene-canvas');
    if(!window.THREE || !canvas) return;
    var THREE = window.THREE;

    /* ---------- capacidades del dispositivo ---------- */
    function mq(q){ return window.matchMedia ? window.matchMedia(q).matches : false; }
    var W = window.innerWidth, H = window.innerHeight;
    var isMobile = W < 900 || mq('(pointer: coarse)');
    var reduceMotion = mq('(prefers-reduced-motion: reduce)');
    var MOTION = reduceMotion ? 0.2 : 1;
    var SHADOWS = !isMobile;
    var Q = isMobile ? 0.5 : 1;                 // escala de texturas
    function sz(n){ return Math.max(64, Math.round(n * Q)); }

    /* ---------- renderer ---------- */
    var renderer = new THREE.WebGLRenderer({canvas:canvas, antialias:!isMobile, alpha:true, powerPreference:'high-performance'});
    var dpr = Math.min(window.devicePixelRatio || 1, isMobile ? 1.5 : 2);
    renderer.setPixelRatio(dpr);
    renderer.setSize(W, H);
    renderer.outputEncoding = THREE.sRGBEncoding;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.2;
    renderer.shadowMap.enabled = SHADOWS;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    var maxAniso = isMobile ? 2 : Math.min(8, renderer.capabilities.getMaxAnisotropy());

    var scene = new THREE.Scene();
    var FOG = 0x0a0e18;
    scene.fog = new THREE.FogExp2(FOG, 0.03);

    var camera = new THREE.PerspectiveCamera(42, W / H, 0.1, 100);
    scene.add(camera);

    /* ---------- utilidades ---------- */
    function clamp(v,a,b){ return Math.max(a, Math.min(b, v)); }
    function lerp(a,b,t){ return a + (b - a) * t; }
    function smooth(t){ t = clamp(t,0,1); return t*t*(3-2*t); }
    function easeOut(t){ t = clamp(t,0,1); return 1 - Math.pow(1-t, 3); }
    function rng(seed){
      return function(){
        seed |= 0; seed = seed + 0x6D2B79F5 | 0;
        var t = Math.imul(seed ^ seed >>> 15, 1 | seed);
        t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
        return ((t ^ t >>> 14) >>> 0) / 4294967296;
      };
    }
    /* los hex se escriben en sRGB; los materiales/luces trabajan en lineal */
    function col(hex){ return new THREE.Color(hex).convertSRGBToLinear(); }
    function V3(x,y,z){ return new THREE.Vector3(x,y,z); }
    function cv(w,h){ var c = document.createElement('canvas'); c.width = w; c.height = h || w; return c; }
    function tex(c, srgb, rx, ry){
      var t = new THREE.CanvasTexture(c);
      if(srgb) t.encoding = THREE.sRGBEncoding;
      t.wrapS = t.wrapT = THREE.RepeatWrapping;
      if(rx) t.repeat.set(rx, ry || rx);
      t.anisotropy = maxAniso;
      return t;
    }
    function radial(size, stops){
      var c = cv(size), g = c.getContext('2d');
      var gr = g.createRadialGradient(size/2,size/2,0,size/2,size/2,size/2);
      stops.forEach(function(s){ gr.addColorStop(s[0], s[1]); });
      g.fillStyle = gr; g.fillRect(0,0,size,size);
      return new THREE.CanvasTexture(c);
    }

    /* ============================================================
       TEXTURAS PROCEDURALES
       ============================================================ */
    function woodCanvas(base, dark, light, seed, size){
      var r = rng(seed), c = cv(size), g = c.getContext('2d');
      g.fillStyle = base; g.fillRect(0,0,size,size);
      for(var i=0;i<150;i++){
        var y0 = r()*size, amp = 1 + r()*6, k = 1 + Math.floor(r()*3), ph = r()*6.283;
        g.strokeStyle = r() < 0.55 ? dark : light;
        g.globalAlpha = 0.05 + r()*0.17;
        g.lineWidth = (0.6 + r()*2.6) * (size/512);
        for(var rep=-1; rep<=1; rep++){
          g.beginPath();
          for(var x=0; x<=size; x+=8){
            var y = y0 + rep*size + Math.sin(x/size*6.283*k + ph)*amp;
            if(x===0) g.moveTo(x,y); else g.lineTo(x,y);
          }
          g.stroke();
        }
      }
      g.globalAlpha = 1;
      return c;
    }
    function fabricCanvas(size, seed){
      var r = rng(seed), c = cv(size), g = c.getContext('2d');
      g.fillStyle = '#dcdcdc'; g.fillRect(0,0,size,size);
      var n = Math.round(9000 * (size/512) * (size/512));
      for(var i=0;i<n;i++){
        var x = r()*size, y = r()*size, rad = (0.8 + r()*2.2) * (size/512), a = r()*6.283;
        g.strokeStyle = r() < 0.5 ? 'rgba(255,255,255,'+(0.10+r()*0.22)+')' : 'rgba(70,60,50,'+(0.06+r()*0.16)+')';
        g.lineWidth = 1 * (size/512) + 0.3;
        g.beginPath(); g.arc(x, y, rad, a, a + 2.4 + r()*1.5); g.stroke();
      }
      return c;
    }
    function floorCanvas(size){
      var r = rng(5), c = cv(size), g = c.getContext('2d'), n = 16, pw = size/n;
      function segment(x, y0, y1, l, hue, sat){
        g.fillStyle = 'hsl('+hue+','+sat+'%,'+l+'%)';
        g.fillRect(x, y0, pw, y1 - y0);
        for(var k=0;k<22;k++){
          var gx = x + r()*pw;
          g.strokeStyle = r() < 0.5 ? 'rgba(0,0,0,'+(0.05+r()*0.14)+')' : 'rgba(255,220,170,'+(0.03+r()*0.07)+')';
          g.lineWidth = 0.6 + r()*1.6;
          g.beginPath(); g.moveTo(gx + (r()-0.5)*4, y0); g.lineTo(gx + (r()-0.5)*4, y1); g.stroke();
        }
        g.fillStyle = 'rgba(0,0,0,0.55)'; g.fillRect(x, y0, pw, Math.max(1.5, size/700));
      }
      for(var i=0;i<n;i++){
        var x = i*pw, hue = 22 + r()*9, sat = 30 + r()*14, split = size*(0.25 + r()*0.5);
        segment(x, 0, split, 12 + r()*8, hue, sat);
        segment(x, split, size, 12 + r()*8, hue, sat);
        g.fillStyle = 'rgba(0,0,0,0.6)'; g.fillRect(x, 0, Math.max(1.5, size/600), size);
      }
      return c;
    }
    function rugCanvas(w, h){
      var r = rng(9), c = cv(w, h), g = c.getContext('2d'), i;
      g.fillStyle = '#d9cfba'; g.fillRect(0,0,w,h);
      for(i=0;i<7000*Q;i++){
        g.fillStyle = r() < 0.5 ? 'rgba(255,255,255,0.10)' : 'rgba(90,70,50,0.10)';
        g.fillRect(r()*w, r()*h, 1.5, 1.5);
      }
      var m = w*0.035;
      g.lineWidth = w*0.016; g.strokeStyle = '#243759'; g.strokeRect(m*2, m*2, w - m*4, h - m*4);
      g.lineWidth = w*0.005; g.strokeStyle = '#b5583a'; g.strokeRect(m*3.1, m*3.1, w - m*6.2, h - m*6.2);
      g.lineWidth = w*0.0025; g.strokeStyle = 'rgba(36,55,89,0.55)';
      for(i=-h; i<w; i += w*0.045){
        g.save(); g.beginPath(); g.rect(m*4, m*4, w - m*8, h - m*8); g.clip();
        g.beginPath(); g.moveTo(i,0); g.lineTo(i+h,h); g.moveTo(i+h,0); g.lineTo(i,h); g.stroke(); g.restore();
      }
      g.fillStyle = '#d9cfba'; g.fillRect(w*0.30, h*0.22, w*0.40, h*0.56);
      g.lineWidth = w*0.008; g.strokeStyle = '#b5583a';
      g.beginPath(); g.moveTo(w*0.5, h*0.24); g.lineTo(w*0.68, h*0.5); g.lineTo(w*0.5, h*0.76); g.lineTo(w*0.32, h*0.5); g.closePath(); g.stroke();
      g.strokeStyle = '#243759'; g.lineWidth = w*0.004;
      g.beginPath(); g.moveTo(w*0.5, h*0.33); g.lineTo(w*0.6, h*0.5); g.lineTo(w*0.5, h*0.67); g.lineTo(w*0.4, h*0.5); g.closePath(); g.stroke();
      g.fillStyle = 'rgba(245,238,224,0.9)';
      for(i=0;i<h;i+=5){ g.fillRect(0,i,m*1.3,2); g.fillRect(w - m*1.3,i,m*1.3,2); }
      return c;
    }
    function plasterCanvas(size){
      var r = rng(31), c = cv(size), g = c.getContext('2d');
      g.fillStyle = '#26324d'; g.fillRect(0,0,size,size);
      for(var i=0;i<9000*Q;i++){
        g.fillStyle = r() < 0.5 ? 'rgba(255,255,255,0.035)' : 'rgba(0,0,10,0.05)';
        var s = 1 + r()*3; g.fillRect(r()*size, r()*size, s, s);
      }
      return c;
    }
    function marbleCanvas(size){
      var r = rng(77), c = cv(size), g = c.getContext('2d');
      g.fillStyle = '#efebe3'; g.fillRect(0,0,size,size);
      for(var v=0; v<16; v++){
        var x = r()*size, y = r()*size, a = r()*6.283;
        g.strokeStyle = 'rgba(120,120,130,'+(0.15+r()*0.25)+')'; g.lineWidth = (0.5 + r()*2.2) * (size/256);
        g.beginPath(); g.moveTo(x,y);
        for(var s=0; s<40; s++){ a += (r()-0.5)*0.9; x += Math.cos(a)*size*0.03; y += Math.sin(a)*size*0.03; g.lineTo(x,y); }
        g.stroke();
      }
      return c;
    }
    function caneCanvas(size){
      var c = cv(size), g = c.getContext('2d'), step = size/8, i;
      g.clearRect(0,0,size,size);
      g.lineCap = 'butt';
      g.strokeStyle = '#d2a969'; g.lineWidth = step*0.34;
      for(i=-8;i<=16;i++){
        g.beginPath(); g.moveTo(i*step,0); g.lineTo(i*step + size, size); g.stroke();
        g.beginPath(); g.moveTo(i*step,size); g.lineTo(i*step + size, 0); g.stroke();
      }
      g.strokeStyle = 'rgba(120,80,30,0.45)'; g.lineWidth = step*0.07;
      for(i=-8;i<=16;i++){
        g.beginPath(); g.moveTo(i*step,0); g.lineTo(i*step + size, size); g.stroke();
      }
      return c;
    }
    function leafCanvas(w, h, a, b){
      var c = cv(w, h), g = c.getContext('2d');
      var gr = g.createLinearGradient(0,h,0,0); gr.addColorStop(0,a); gr.addColorStop(1,b);
      g.fillStyle = gr; g.fillRect(0,0,w,h);
      g.strokeStyle = 'rgba(200,225,170,0.55)'; g.lineWidth = w*0.035;
      g.beginPath(); g.moveTo(w/2,h); g.lineTo(w/2,0); g.stroke();
      g.lineWidth = w*0.012; g.strokeStyle = 'rgba(200,225,170,0.30)';
      for(var i=1;i<11;i++){
        var y = h - i*h/11;
        g.beginPath(); g.moveTo(w/2,y); g.lineTo(0, y - h*0.11); g.moveTo(w/2,y); g.lineTo(w, y - h*0.11); g.stroke();
      }
      return c;
    }
    function skyCanvas(w, h){
      var r = rng(404), c = cv(w, h), g = c.getContext('2d'), i;
      var gr = g.createLinearGradient(0,0,0,h);
      gr.addColorStop(0,'#070d21'); gr.addColorStop(0.55,'#14284f'); gr.addColorStop(1,'#2b4a7c');
      g.fillStyle = gr; g.fillRect(0,0,w,h);
      for(i=0;i<170;i++){
        g.fillStyle = 'rgba(255,255,255,'+(0.2 + r()*0.7)+')';
        var s = r() < 0.9 ? 1 : 2; g.fillRect(r()*w, r()*h*0.65, s, s);
      }
      var mg = g.createRadialGradient(w*0.72, h*0.2, 0, w*0.72, h*0.2, w*0.35);
      mg.addColorStop(0,'rgba(220,235,255,0.75)'); mg.addColorStop(0.3,'rgba(150,180,255,0.18)'); mg.addColorStop(1,'rgba(150,180,255,0)');
      g.fillStyle = mg; g.fillRect(0,0,w,h);
      g.fillStyle = '#f2f6ff'; g.beginPath(); g.arc(w*0.72, h*0.2, w*0.05, 0, 6.283); g.fill();
      g.fillStyle = '#12224a'; g.beginPath(); g.arc(w*0.72 + w*0.022, h*0.2 - w*0.008, w*0.045, 0, 6.283); g.fill();
      [['#101c3a',0.72,0.16],['#08122a',0.80,0.2]].forEach(function(L){
        g.fillStyle = L[0];
        var x = 0;
        while(x < w){
          var bw = w*(0.06 + r()*0.09), bh = h*(L[2]*(0.4 + r()*0.9)) ;
          g.fillRect(x, h*L[1] + (h*0.2 - bh) - h*0.02, bw, bh + h*0.3);
          if(L[0] === '#08122a'){
            for(var wy = h*L[1] + (h*0.2 - bh); wy < h; wy += h*0.03){
              for(var wx = x + 4; wx < x + bw - 6; wx += w*0.024){
                if(r() < 0.3){ g.fillStyle = 'rgba(255,205,120,'+(0.5 + r()*0.5)+')'; g.fillRect(wx, wy, w*0.009, h*0.011); }
              }
            }
            g.fillStyle = L[0];
          }
          x += bw;
        }
      });
      return c;
    }
    function artBigCanvas(w, h){
      var r = rng(12), c = cv(w, h), g = c.getContext('2d'), i;
      g.fillStyle = '#ece3d0'; g.fillRect(0,0,w,h);
      g.fillStyle = '#c2603a'; g.beginPath(); g.arc(w*0.68, h*0.42, h*0.27, 0, 6.283); g.fill();
      g.fillStyle = '#24365a'; g.beginPath(); g.arc(w*0.26, h*1.02, h*0.62, Math.PI, 0); g.fill();
      g.fillStyle = '#c9a15a'; g.beginPath(); g.arc(w*0.56, h*1.02, h*0.36, Math.PI, 0); g.fill();
      g.fillStyle = '#8a9a78'; g.beginPath(); g.arc(w*0.84, h*1.02, h*0.24, Math.PI, 0); g.fill();
      g.strokeStyle = 'rgba(20,24,36,0.85)'; g.lineWidth = w*0.004;
      g.beginPath(); g.moveTo(w*0.08, h*0.2); g.lineTo(w*0.42, h*0.2); g.moveTo(w*0.08, h*0.26); g.lineTo(w*0.3, h*0.26); g.stroke();
      for(i=0;i<1400*Q;i++){
        g.fillStyle = r() < 0.5 ? 'rgba(255,255,255,0.08)' : 'rgba(60,40,20,0.07)';
        g.fillRect(r()*w, r()*h, 2, 2);
      }
      return c;
    }
    function artArchesCanvas(w, h, p, seed){
      var r = rng(seed), c = cv(w, h), g = c.getContext('2d'), i;
      g.fillStyle = '#efe7d6'; g.fillRect(0,0,w,h);
      function arch(cx, wd, top, color){
        g.fillStyle = color; g.beginPath(); g.moveTo(cx - wd/2, h);
        g.lineTo(cx - wd/2, top + wd/2); g.arc(cx, top + wd/2, wd/2, Math.PI, 0);
        g.lineTo(cx + wd/2, h); g.closePath(); g.fill();
      }
      arch(w*0.5, w*0.78, h*0.16, p[0]); arch(w*0.5, w*0.52, h*0.34, p[1]); arch(w*0.5, w*0.26, h*0.52, p[2]);
      g.fillStyle = p[1]; g.beginPath(); g.arc(w*0.5, h*0.09, w*0.05, 0, 6.283); g.fill();
      for(i=0;i<900*Q;i++){
        g.fillStyle = r() < 0.5 ? 'rgba(255,255,255,0.09)' : 'rgba(60,40,20,0.07)';
        g.fillRect(r()*w, r()*h, 2, 2);
      }
      return c;
    }
    function beamCanvas(){
      var c = cv(64, 256), g = c.getContext('2d');
      var v = g.createLinearGradient(0,0,0,256);
      v.addColorStop(0,'rgba(255,255,255,1)'); v.addColorStop(0.5,'rgba(255,255,255,0.35)'); v.addColorStop(1,'rgba(255,255,255,0)');
      g.fillStyle = v; g.fillRect(0,0,64,256);
      g.globalCompositeOperation = 'destination-in';
      var h = g.createLinearGradient(0,0,64,0);
      h.addColorStop(0,'rgba(0,0,0,0)'); h.addColorStop(0.5,'rgba(0,0,0,1)'); h.addColorStop(1,'rgba(0,0,0,0)');
      g.fillStyle = h; g.fillRect(0,0,64,256);
      return c;
    }
    function goboCanvas(){
      var c = cv(256, 384), g = c.getContext('2d');
      g.clearRect(0,0,256,384);
      g.filter = 'blur(5px)';
      g.fillStyle = '#ffffff';
      for(var i=0;i<2;i++) for(var j=0;j<3;j++) g.fillRect(24 + i*112, 22 + j*120, 100, 104);
      return c;
    }
    function vignetteCanvas(){
      var c = cv(256), g = c.getContext('2d');
      var gr = g.createRadialGradient(128,128,50,128,128,182);
      gr.addColorStop(0,'rgba(6,9,18,0)'); gr.addColorStop(0.6,'rgba(6,9,18,0.22)'); gr.addColorStop(1,'rgba(6,9,18,0.78)');
      g.fillStyle = gr; g.fillRect(0,0,256,256);
      return c;
    }

    var glowTex   = radial(128, [[0,'rgba(255,255,255,1)'],[0.22,'rgba(255,255,255,0.45)'],[0.6,'rgba(255,255,255,0.08)'],[1,'rgba(255,255,255,0)']]);
    var blobTex   = radial(128, [[0,'rgba(0,0,0,0.85)'],[0.55,'rgba(0,0,0,0.4)'],[1,'rgba(0,0,0,0)']]);
    var steamTex  = radial(64,  [[0,'rgba(255,255,255,0.55)'],[1,'rgba(255,255,255,0)']]);
    var dustTex   = radial(32,  [[0,'rgba(255,255,255,1)'],[1,'rgba(255,255,255,0)']]);
    var beamTex   = new THREE.CanvasTexture(beamCanvas());
    var goboTex   = new THREE.CanvasTexture(goboCanvas());
    var vigTex    = new THREE.CanvasTexture(vignetteCanvas());

    var woodWalnutTex = tex(woodCanvas('#6a4426', '#2f1b0d', '#9a6a3c', 11, sz(512)), true);
    var woodOakTex    = tex(woodCanvas('#b98a55', '#7d5730', '#dcb681', 23, sz(512)), true);
    var fabricTex     = tex(fabricCanvas(sz(512), 3), true);
    var fabricLatheTex = tex(fabricCanvas(sz(512), 4), true, 7, 3);
    var floorTex      = tex(floorCanvas(sz(1024)), true, 15, 10);
    var rugTex        = tex(rugCanvas(sz(1024), sz(704)), true);
    var plasterTex    = tex(plasterCanvas(sz(512)), true, 8, 3);
    var marbleTex     = tex(marbleCanvas(sz(256)), true);
    var caneTex       = tex(caneCanvas(sz(256)), true, 3, 3);
    var leafTex       = tex(leafCanvas(sz(128), sz(256), '#2b5030', '#4f8144'), true);
    var leafDryTex    = tex(leafCanvas(sz(128), sz(256), '#6f8a6c', '#a7b79c'), true);
    var snakeTex      = tex(leafCanvas(sz(128), sz(256), '#1f4630', '#5d8c4a'), true);
    var skyTex        = tex(skyCanvas(sz(512), sz(1024)), true);
    skyTex.wrapS = skyTex.wrapT = THREE.ClampToEdgeWrapping;

    /* ============================================================
       MATERIALES
       ============================================================ */
    var M = {};
    function withUV(m, uv, wood){ m.userData = {uv:uv, wood:!!wood}; return m; }
    M.walnut = withUV(new THREE.MeshPhysicalMaterial({map:woodWalnutTex, bumpMap:woodWalnutTex, bumpScale:0.3, roughness:0.5, metalness:0, clearcoat:0.3, clearcoatRoughness:0.4}), 0.9, true);
    M.oak    = withUV(new THREE.MeshPhysicalMaterial({map:woodOakTex, bumpMap:woodOakTex, bumpScale:0.3, roughness:0.55, metalness:0, clearcoat:0.2, clearcoatRoughness:0.5}), 0.9, true);
    M.brass  = new THREE.MeshStandardMaterial({color:col(0xc9a15a), metalness:1, roughness:0.3});
    M.steel  = new THREE.MeshStandardMaterial({color:col(0x141926), metalness:0.75, roughness:0.4});
    M.marble = new THREE.MeshStandardMaterial({map:marbleTex, roughness:0.16, metalness:0.05});
    M.matte  = new THREE.MeshStandardMaterial({color:col(0xf1eadb), roughness:0.9});
    M.paper  = new THREE.MeshStandardMaterial({color:col(0xeee6d2), roughness:0.95});
    M.wall   = new THREE.MeshStandardMaterial({map:plasterTex, bumpMap:plasterTex, bumpScale:0.25, roughness:0.95, metalness:0});
    M.floor  = new THREE.MeshStandardMaterial({map:floorTex, bumpMap:floorTex, bumpScale:0.4, roughness:0.4, metalness:0.05, envMapIntensity:0.8});
    M.rug    = new THREE.MeshStandardMaterial({map:rugTex, roughness:1, metalness:0, polygonOffset:true, polygonOffsetFactor:-1, polygonOffsetUnits:-1});
    M.cane   = new THREE.MeshStandardMaterial({map:caneTex, transparent:true, alphaTest:0.5, side:THREE.DoubleSide, roughness:0.6, metalness:0});
    M.leaf   = new THREE.MeshStandardMaterial({map:leafTex, side:THREE.DoubleSide, roughness:0.5, metalness:0});
    M.leafDry = new THREE.MeshStandardMaterial({map:leafDryTex, side:THREE.DoubleSide, roughness:0.75, metalness:0});
    M.snake  = new THREE.MeshStandardMaterial({map:snakeTex, side:THREE.DoubleSide, roughness:0.45, metalness:0});
    M.stem   = new THREE.MeshStandardMaterial({color:col(0x5a4630), roughness:0.85});
    M.plume  = new THREE.MeshStandardMaterial({color:col(0xe6d8bd), roughness:1});
    M.soil   = new THREE.MeshStandardMaterial({color:col(0x1c130c), roughness:1});
    M.curtain = new THREE.MeshStandardMaterial({color:col(0xe6dfd0), roughness:1, transparent:true, opacity:0.5, side:THREE.DoubleSide, depthWrite:false});
    M.mirror = new THREE.MeshStandardMaterial({color:col(0xaab6cc), metalness:1, roughness:0.05});
    M.blackFrame = withUV(new THREE.MeshStandardMaterial({color:col(0x14171f), roughness:0.5, metalness:0.2}), 1, false);

    var fabCache = {};
    function fab(hex){
      if(!fabCache[hex]){
        var m = new THREE.MeshStandardMaterial({map:fabricTex, bumpMap:fabricTex, bumpScale:0.5, color:col(hex), roughness:0.95, metalness:0});
        m.userData = {uv:1.2, wood:false}; fabCache[hex] = m;
      }
      return fabCache[hex];
    }
    var ceramCache = {};
    function ceram(hex, rough){
      var k = hex + '_' + rough;
      if(!ceramCache[k]) ceramCache[k] = new THREE.MeshStandardMaterial({color:col(hex), roughness:rough === undefined ? 0.4 : rough, metalness:0.02});
      return ceramCache[k];
    }
    M.creamLathe = new THREE.MeshStandardMaterial({map:fabricLatheTex, bumpMap:fabricLatheTex, bumpScale:0.5, color:col(0xd9cfba), roughness:0.95});

    /* ============================================================
       GEOMETRÍA: cajas redondeadas, patas, lathe, hojas, merge
       ============================================================ */
    function roundedBox(w, h, d, r, seg){
      seg = seg || 2;
      r = Math.min(r, w/2 - 1e-3, h/2 - 1e-3, d/2 - 1e-3);
      var S = seg*2 + 1;
      var g = new THREE.BoxGeometry(1,1,1,S,S,S);
      var p = g.attributes.position, n = g.attributes.normal;
      var hs = 0.5/S, bx = w/2 - r, by = h/2 - r, bz = d/2 - r, v = new THREE.Vector3();
      for(var i=0;i<p.count;i++){
        var x = p.getX(i), y = p.getY(i), z = p.getZ(i);
        var sx = x < 0 ? -1 : 1, sy = y < 0 ? -1 : 1, sz2 = z < 0 ? -1 : 1;
        v.set(x - sx*hs, y - sy*hs, z - sz2*hs).normalize();
        p.setXYZ(i, sx*bx + v.x*r, sy*by + v.y*r, sz2*bz + v.z*r);
        n.setXYZ(i, v.x, v.y, v.z);
      }
      return g;
    }
    function worldUV(g, s, grain){
      var P = g.attributes.position, N = g.attributes.normal, UV = g.attributes.uv;
      for(var i=0;i<P.count;i++){
        var nx = Math.abs(N.getX(i)), ny = Math.abs(N.getY(i)), nz = Math.abs(N.getZ(i));
        var c = {x:P.getX(i), y:P.getY(i), z:P.getZ(i)}, a, b;
        if(nx >= ny && nx >= nz){ a = 'z'; b = 'y'; } else if(ny >= nz){ a = 'x'; b = 'z'; } else { a = 'x'; b = 'y'; }
        if(grain && b === grain){ var t = a; a = b; b = t; }
        UV.setXY(i, c[a]*s, c[b]*s);
      }
    }
    function puff(g, axis, amt, a, b, both){
      var p = g.attributes.position;
      for(var i=0;i<p.count;i++){
        var x = p.getX(i), y = p.getY(i), z = p.getZ(i), u, v, w;
        if(axis === 'y'){ u = x/a; v = z/b; w = y; } else { u = x/a; v = y/b; w = z; }
        var k = amt*Math.max(0, 1 - u*u)*Math.max(0, 1 - v*v);
        if(w > 0) w += k; else if(both) w -= k;
        if(axis === 'y') p.setY(i, w); else p.setZ(i, w);
      }
    }
    function rbm(mat, w, h, d, r, seg, bulge){
      var g = roundedBox(w, h, d, r, seg);
      if(bulge) puff(g, bulge.axis, bulge.amt, bulge.a, bulge.b, bulge.both);
      var ud = mat.userData || {};
      if(ud.uv){ worldUV(g, ud.uv, ud.wood ? ((w >= h && w >= d) ? 'x' : (h >= d ? 'y' : 'z')) : null); }
      var m = new THREE.Mesh(g, mat);
      m.castShadow = SHADOWS; m.receiveShadow = SHADOWS;
      return m;
    }
    function tapered(mat, tw, bw, h, r){
      var g = roundedBox(tw, h, tw, r, 2), p = g.attributes.position, s0 = bw/tw;
      for(var i=0;i<p.count;i++){
        var t = (p.getY(i) + h/2)/h, s = s0 + (1 - s0)*t;
        p.setX(i, p.getX(i)*s); p.setZ(i, p.getZ(i)*s);
      }
      if(mat.userData && mat.userData.uv) worldUV(g, mat.userData.uv, 'y');
      var m = new THREE.Mesh(g, mat); m.castShadow = SHADOWS; m.receiveShadow = SHADOWS;
      return m;
    }
    function place(m, parent, x, y, z){ m.position.set(x, y, z); parent.add(m); return m; }
    function lathe(pts, seg, mat, cast){
      var m = new THREE.Mesh(new THREE.LatheGeometry(pts, seg || 48), mat);
      m.castShadow = SHADOWS && cast !== false; m.receiveShadow = SHADOWS;
      return m;
    }
    function smoothProfile(arr, n){
      return new THREE.SplineCurve(arr.map(function(a){ return new THREE.Vector2(a[0], a[1]); })).getPoints(n || 32);
    }
    function discProfile(r, h, rr, steps){
      var pts = [new THREE.Vector2(0,0), new THREE.Vector2(r - rr, 0)], i, a;
      for(i=1;i<=steps;i++){ a = -Math.PI/2 + (i/steps)*Math.PI/2; pts.push(new THREE.Vector2(r - rr + Math.cos(a)*rr, rr + Math.sin(a)*rr)); }
      pts.push(new THREE.Vector2(r, h - rr));
      for(i=1;i<=steps;i++){ a = (i/steps)*Math.PI/2; pts.push(new THREE.Vector2(r - rr + Math.cos(a)*rr, h - rr + Math.sin(a)*rr)); }
      pts.push(new THREE.Vector2(0, h));
      return pts;
    }
    function leafGeo(len, wid, droop, fold){
      var s = new THREE.Shape();
      s.moveTo(0,0);
      s.bezierCurveTo(wid*0.55, len*0.12, wid*0.6, len*0.62, 0, len);
      s.bezierCurveTo(-wid*0.6, len*0.62, -wid*0.55, len*0.12, 0, 0);
      var g = new THREE.ShapeGeometry(s, 10);
      var p = g.attributes.position, uv = g.attributes.uv;
      for(var i=0;i<p.count;i++){
        var x = p.getX(i), y = p.getY(i), t = y/len;
        p.setZ(i, -Math.abs(x)*fold + t*t*len*droop);
        uv.setXY(i, x/wid*0.5 + 0.5, t);
      }
      g.computeVertexNormals();
      return g;
    }
    function mergeGeos(list){
      var pos = [], nor = [], uv = [];
      list.forEach(function(item){
        var g = item.g.clone();
        if(item.m) g.applyMatrix4(item.m);
        if(g.index) g = g.toNonIndexed();
        var p = g.attributes.position.array, n = g.attributes.normal.array, u = g.attributes.uv ? g.attributes.uv.array : null, i;
        for(i=0;i<p.length;i++){ pos.push(p[i]); nor.push(n[i]); }
        for(i=0;i<p.length/3;i++){ if(u) uv.push(u[i*2], u[i*2+1]); else uv.push(0,0); }
      });
      var out = new THREE.BufferGeometry();
      out.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      out.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
      out.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
      return out;
    }
    function glow(parent, x, y, z, hex, scale, opacity){
      var s = new THREE.Sprite(new THREE.SpriteMaterial({map:glowTex, color:col(hex), transparent:true, opacity:opacity, blending:THREE.AdditiveBlending, depthWrite:false, fog:false}));
      s.position.set(x, y, z); s.scale.set(scale, scale, 1); s.renderOrder = 3; parent.add(s);
      return s;
    }

    /* ============================================================
       ESCENA
       ============================================================ */
    var room = new THREE.Group(); scene.add(room);
    var updaters = [];       // funciones (t, dt, u) que animan cosas
    var UP = V3(0,1,0);

    function blob(x, z, w, d, op, rotY){
      var m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), new THREE.MeshBasicMaterial({map:blobTex, color:0x000000, transparent:true, opacity:op, depthWrite:false, polygonOffset:true, polygonOffsetFactor:-2, polygonOffsetUnits:-2}));
      m.rotation.set(-Math.PI/2, 0, rotY || 0); m.position.set(x, 0.014, z); room.add(m);
    }

    /* ---------- suelo, pared, zócalo ---------- */
    var floor = new THREE.Mesh(new THREE.PlaneGeometry(36, 24), M.floor);
    floor.rotation.x = -Math.PI/2; floor.position.set(0, 0, 4); floor.receiveShadow = SHADOWS;
    room.add(floor);

    var WALL_Z = -3.4;
    plasterTex.repeat.set(9, 3);
    var wall = new THREE.Mesh(new THREE.PlaneGeometry(40, 12), M.wall);
    wall.position.set(0, 6, WALL_Z); wall.receiveShadow = SHADOWS; room.add(wall);
    place(rbm(M.walnut, 40, 0.16, 0.05, 0.01, 1), room, 0, 0.08, WALL_Z + 0.03);

    /* panel de listones de madera detrás del sofá */
    (function(){
      var back = new THREE.Mesh(new THREE.PlaneGeometry(6.6, 3.3), new THREE.MeshStandardMaterial({color:col(0x0d1220), roughness:1}));
      back.position.set(0, 0.16 + 1.65, WALL_Z + 0.012); room.add(back);
      var N = 46, pitch = 6.5/N;
      var g = roundedBox(0.075, 3.3, 0.08, 0.016, 2); worldUV(g, 0.9, 'y');
      var slats = new THREE.InstancedMesh(g, M.walnut, N);
      slats.castShadow = SHADOWS; slats.receiveShadow = SHADOWS;
      var m4 = new THREE.Matrix4(), r = rng(66), c = new THREE.Color();
      for(var i=0;i<N;i++){
        m4.makeTranslation(-3.25 + pitch*(i + 0.5), 0.16 + 1.65, WALL_Z + 0.06);
        slats.setMatrixAt(i, m4);
        var k = 0.78 + r()*0.4; c.setRGB(k, k*0.98, k*0.94); slats.setColorAt(i, c);
      }
      room.add(slats);
      /* tira de luz cálida bajo el remate superior */
      var strip = new THREE.Mesh(new THREE.PlaneGeometry(6.5, 0.05), new THREE.MeshBasicMaterial({color:col(0xffc98a), transparent:true, opacity:0.55, fog:false}));
      strip.position.set(0, 0.16 + 3.3 + 0.01, WALL_Z + 0.105); room.add(strip);
    })();

    /* ---------- alfombra ---------- */
    var rug = new THREE.Mesh(new THREE.PlaneGeometry(5.4, 3.7), M.rug);
    rug.rotation.x = -Math.PI/2; rug.position.set(0, 0.011, -1.1); rug.receiveShadow = SHADOWS; room.add(rug);
    blob(0, -1.1, 5.9, 4.2, 0.35);

    /* ============================================================
       SOFÁ (mid-century, dos plazas)
       ============================================================ */
    (function(){
      var g = new THREE.Group(); g.position.set(0, 0, -2.5);
      [[-1.42,-0.4],[1.42,-0.4],[-1.42,0.4],[1.42,0.4]].forEach(function(p){
        var leg = tapered(M.walnut, 0.075, 0.04, 0.3, 0.02);
        leg.position.set(p[0], 0.15, p[1]);
        leg.rotation.set(p[1] < 0 ? 0.07 : -0.07, 0, p[0] < 0 ? -0.09 : 0.09);
        g.add(leg);
      });
      place(rbm(M.walnut, 3.1, 0.14, 1.05, 0.03, 2), g, 0, 0.35, 0);
      /* laterales de madera */
      [-1.63, 1.63].forEach(function(x){ place(rbm(M.walnut, 0.16, 0.62, 1.05, 0.05, 3), g, x, 0.59, 0); });
      /* respaldo de madera */
      place(rbm(M.walnut, 3.1, 0.7, 0.1, 0.03, 2), g, 0, 0.77, -0.53);
      /* cojines */
      var cream = fab(0xd6ccb8);
      [-0.76, 0.76].forEach(function(x){
        var seat = rbm(cream, 1.5, 0.24, 0.92, 0.08, 4, {axis:'y', amt:0.035, a:0.75, b:0.46});
        place(seat, g, x, 0.54, 0.02);
        var back = rbm(cream, 1.46, 0.56, 0.26, 0.09, 4, {axis:'z', amt:0.03, a:0.73, b:0.28, both:true});
        back.rotation.x = -0.16; place(back, g, x, 0.96, -0.36);
      });
      /* almohadones */
      var pil = [
        {c:0x7f8fa8, x:-1.1, y:0.86, z:-0.13, rx:-0.22, rz:0.3, s:0.5},
        {c:0xb9573a, x: 1.12, y:0.85, z:-0.12, rx:-0.22, rz:-0.28, s:0.48},
        {c:0xc9a15a, x: 0.14, y:0.83, z:-0.08, rx:-0.28, rz:0.05, s:0.4}
      ];
      pil.forEach(function(p, i){
        var m = rbm(fab(p.c), p.s, p.s*(i === 2 ? 0.66 : 1), 0.15, 0.06, 3, {axis:'z', amt:0.05, a:p.s/2, b:p.s/2*(i === 2 ? 0.66 : 1), both:true});
        m.rotation.set(p.rx, 0.12*(i-1), p.rz); place(m, g, p.x, p.y, p.z);
      });
      /* manta doblada */
      var blanket = fab(0x9c6b45);
      [0,1,2].forEach(function(i){
        var b = rbm(blanket, 0.9 - i*0.03, 0.045, 0.5, 0.02, 2);
        b.rotation.y = 0.12 - i*0.06; place(b, g, -0.78, 0.7 + i*0.045, 0.2);
      });
      room.add(g);
      blob(0, -2.5, 3.8, 1.7, 0.6);
    })();

    /* ============================================================
       BUTACAS DE MADERA CON RESPALDO DE RATTAN
       ============================================================ */
    function buildChair(x, z, rotY){
      var g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = rotY;
      [[-0.34,-0.3],[0.34,-0.3],[-0.34,0.3],[0.34,0.3]].forEach(function(p){
        var leg = tapered(M.walnut, 0.065, 0.035, 0.3, 0.018);
        leg.position.set(p[0], 0.15, p[1]);
        leg.rotation.set(p[1] < 0 ? 0.08 : -0.08, 0, p[0] < 0 ? -0.09 : 0.09);
        g.add(leg);
      });
      place(rbm(M.walnut, 0.86, 0.09, 0.8, 0.03, 2), g, 0, 0.34, 0);
      place(rbm(fab(0xd6ccb8), 0.78, 0.15, 0.72, 0.06, 4, {axis:'y', amt:0.03, a:0.39, b:0.36}), g, 0, 0.47, 0.02);
      /* respaldo inclinado */
      var bk = new THREE.Group(); bk.position.set(0, 0.4, -0.36); bk.rotation.x = -0.26; g.add(bk);
      [-0.4, 0.4].forEach(function(px){ place(rbm(M.walnut, 0.06, 0.7, 0.06, 0.02, 2), bk, px, 0.35, 0); });
      place(rbm(M.walnut, 0.86, 0.07, 0.07, 0.02, 2), bk, 0, 0.72, 0);
      place(rbm(M.walnut, 0.86, 0.07, 0.07, 0.02, 2), bk, 0, 0.1, 0);
      var pane = new THREE.Mesh(new THREE.PlaneGeometry(0.74, 0.58), M.cane); pane.position.set(0, 0.41, 0.005); pane.castShadow = SHADOWS; bk.add(pane);
      place(rbm(fab(0x7f8fa8), 0.5, 0.3, 0.1, 0.045, 3, {axis:'z', amt:0.03, a:0.25, b:0.15, both:true}), bk, 0, 0.36, 0.09).rotation.z = 0.05;
      /* brazos */
      [-0.44, 0.44].forEach(function(px){
        place(rbm(M.walnut, 0.075, 0.05, 0.66, 0.02, 2), g, px, 0.7, -0.02);
        place(rbm(M.walnut, 0.05, 0.36, 0.05, 0.015, 2), g, px, 0.51, 0.27);
      });
      room.add(g);
      blob(x, z, 1.5, 1.4, 0.55, rotY);
      return g;
    }
    buildChair(-2.95, -1.05, 0.6);
    buildChair( 2.95, -1.05, -0.6);

    /* ============================================================
       MESA DE CENTRO + DECORACIÓN
       ============================================================ */
    (function(){
      var g = new THREE.Group(); g.position.set(0, 0, -0.9);
      var top = lathe(discProfile(0.5, 0.05, 0.02, 4), 56, M.walnut); top.scale.set(1.4, 1, 0.86); top.position.y = 0.4; g.add(top);
      [[-0.5,-0.22],[0.5,-0.22],[-0.5,0.22],[0.5,0.22]].forEach(function(p){
        var leg = tapered(M.walnut, 0.06, 0.032, 0.4, 0.015);
        leg.position.set(p[0], 0.2, p[1]);
        leg.rotation.set(p[1] < 0 ? 0.1 : -0.1, 0, p[0] < 0 ? -0.1 : 0.1);
        g.add(leg);
      });
      /* bandeja */
      var tray = rbm(M.blackFrame, 0.55, 0.03, 0.32, 0.012, 2); place(tray, g, 0.08, 0.465, 0.02);
      /* vela con llama viva */
      var cand = new THREE.Group(); cand.position.set(0.08, 0.48, 0.02); g.add(cand);
      var holder = lathe(smoothProfile([[0,0],[0.055,0],[0.06,0.015],[0.05,0.045],[0.048,0.07]], 14), 24, M.brass); cand.add(holder);
      var wax = lathe(smoothProfile([[0,0.05],[0.04,0.05],[0.041,0.14],[0.0,0.141]], 8), 20, ceram(0xefe7d4, 0.6)); cand.add(wax);
      var flame = new THREE.Mesh(new THREE.SphereGeometry(0.012, 10, 8), new THREE.MeshBasicMaterial({color:col(0xffd08a), fog:false}));
      flame.scale.set(0.8, 1.9, 0.8); flame.position.y = 0.16; cand.add(flame);
      var flameGlow = glow(cand, 0, 0.16, 0, 0xffa64d, 0.5, 0.75);
      updaters.push(function(t){
        var f = 0.86 + Math.sin(t*11)*0.06 + Math.sin(t*17.3 + 1.2)*0.05 + Math.sin(t*5.1)*0.03;
        flame.scale.set(0.8*f, 1.9*f, 0.8*f); flame.position.x = Math.sin(t*3.7)*0.002;
        flameGlow.material.opacity = 0.62*f;
      });
      /* florero de cerámica con pampas */
      var vase = lathe(smoothProfile([[0,0],[0.06,0],[0.1,0.06],[0.12,0.16],[0.085,0.27],[0.045,0.34],[0.05,0.37],[0.044,0.38]], 22), 40, ceram(0xd9ccb3, 0.38));
      vase.position.set(0.5, 0.45, -0.02); g.add(vase);
      var pr = rng(101), pst = [], ppl = [];
      for(var i=0;i<7;i++){
        var a = pr()*6.283, lean = 0.06 + pr()*0.22, hh = 0.5 + pr()*0.32, dx = Math.cos(a)*lean, dz = Math.sin(a)*lean;
        var curve = new THREE.CatmullRomCurve3([V3(0,0,0), V3(dx*0.3, hh*0.4, dz*0.3), V3(dx*0.75, hh*0.78, dz*0.75), V3(dx, hh, dz)]);
        pst.push({g:new THREE.TubeGeometry(curve, 12, 0.0045, 4, false)});
        var tan = curve.getTangent(1), q = new THREE.Quaternion().setFromUnitVectors(UP, tan);
        var pm = new THREE.Matrix4().compose(V3(dx, hh, dz), q, V3(1,1,1));
        var pl = new THREE.SphereGeometry(0.03, 8, 6); pl.scale(0.8, 3.4, 0.8); pl.translate(0, 0.05, 0);
        ppl.push({g:pl, m:pm});
      }
      var bouquet = new THREE.Group(); bouquet.position.set(0.5, 0.82, -0.02); g.add(bouquet);
      bouquet.add(new THREE.Mesh(mergeGeos(pst), M.stem));
      var plumes = new THREE.Mesh(mergeGeos(ppl), M.plume); bouquet.add(plumes);
      updaters.push(function(t){ bouquet.rotation.z = Math.sin(t*0.7)*0.02*MOTION; bouquet.rotation.x = Math.sin(t*0.5 + 1)*0.015*MOTION; });
      /* libros apilados */
      placeBooks(g, [[0.5,0.055,0.36,0x24365a,0.1],[0.46,0.045,0.33,0xb9573a,-0.08],[0.42,0.05,0.3,0xd9ccb3,0.05]], -0.42, 0.45, 0.1, 0.35);
      room.add(g);
      blob(0, -0.9, 2.1, 1.3, 0.55);
    })();

    function placeBooks(parent, list, x, y, z, rotY){
      var cy = y;
      list.forEach(function(b){
        var bk = new THREE.Group();
        var cover = rbm(new THREE.MeshStandardMaterial({color:col(b[3]), roughness:0.75}), b[0], b[1], b[2], 0.006, 1);
        var pages = rbm(M.paper, b[0]*0.96, b[1]*0.8, b[2]*0.96, 0.003, 1); pages.position.z = 0.012;
        bk.add(cover); bk.add(pages);
        bk.position.set(x, cy + b[1]/2, z); bk.rotation.y = rotY + b[4]; parent.add(bk);
        cy += b[1];
      });
    }

    /* ---------- pouf ---------- */
    (function(){
      var prof = smoothProfile([[0,0],[0.3,0],[0.37,0.06],[0.39,0.18],[0.36,0.3],[0.26,0.36],[0,0.37]], 26);
      var p = lathe(prof, 40, M.creamLathe); p.position.set(1.55, 0, -0.25); room.add(p);
      blob(1.55, -0.25, 1.05, 1.05, 0.5);
    })();

    /* ---------- mesa auxiliar de mármol y latón ---------- */
    (function(){
      var g = new THREE.Group(); g.position.set(2.4, 0, -2.55);
      var top = lathe(discProfile(0.32, 0.03, 0.012, 3), 44, M.marble); top.position.y = 0.55; g.add(top);
      var ring = lathe(discProfile(0.2, 0.012, 0.005, 2), 32, M.brass); ring.position.y = 0.2; g.add(ring);
      for(var i=0;i<3;i++){
        var a = i*2.094 + 0.4;
        var leg = tapered(M.brass, 0.028, 0.018, 0.56, 0.008);
        leg.position.set(Math.cos(a)*0.2, 0.28, Math.sin(a)*0.2);
        leg.rotation.set(Math.sin(a)*0.12, 0, -Math.cos(a)*0.12);
        g.add(leg);
      }
      /* taza con vapor */
      var mug = lathe(smoothProfile([[0,0],[0.05,0],[0.058,0.012],[0.06,0.09],[0.053,0.092],[0.05,0.02],[0,0.016]], 12), 28, ceram(0xe9dfca, 0.35), true);
      mug.material = mug.material.clone(); mug.material.side = THREE.DoubleSide;
      mug.position.set(-0.08, 0.58, 0.05); g.add(mug);
      var handle = new THREE.Mesh(new THREE.TorusGeometry(0.026, 0.008, 8, 14, Math.PI), ceram(0xe9dfca, 0.35));
      handle.position.set(-0.08 + 0.058, 0.63, 0.05); handle.rotation.z = -Math.PI/2; g.add(handle);
      var steam = [];
      for(var s=0;s<4;s++){
        var sp = new THREE.Sprite(new THREE.SpriteMaterial({map:steamTex, transparent:true, opacity:0, depthWrite:false, fog:false}));
        sp.renderOrder = 3; g.add(sp); steam.push(sp);
      }
      updaters.push(function(t){
        steam.forEach(function(sp, i){
          var ph = (t*0.28 + i/4) % 1;
          sp.position.set(-0.08 + Math.sin(t*0.9 + i*1.7)*0.02*ph*3, 0.68 + ph*0.42, 0.05 + Math.cos(t*0.7 + i)*0.015);
          sp.material.opacity = 0.2*Math.sin(ph*Math.PI);
          var sc = 0.05 + ph*0.16; sp.scale.set(sc, sc, 1);
        });
      });
      placeBooks(g, [[0.32,0.04,0.24,0x8a9a78,0.3],[0.28,0.035,0.21,0x14171f,-0.2]], 0.1, 0.58, -0.02, 0.2);
      room.add(g);
      blob(2.4, -2.55, 0.9, 0.9, 0.5);
    })();

    /* ============================================================
       LÁMPARA DE ARCO (luz cálida real)
       ============================================================ */
    var lampLight, lampSpot, lampGlow, lampBase = 1.15;
    (function(){
      var g = new THREE.Group(); g.position.set(-2.75, 0, -2.75);
      place(rbm(M.marble, 0.5, 0.07, 0.34, 0.025, 3), g, 0, 0.035, 0);
      var curve = new THREE.CatmullRomCurve3([V3(0,0.06,0), V3(0,0.9,0), V3(0.02,1.5,0.02), V3(0.24,1.86,0.08), V3(0.62,1.96,0.18), V3(0.86,1.86,0.25)]);
      g.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 60, 0.016, 8, false), M.brass));
      var R = 0.27;
      var shadeProf = smoothProfile([[R,0],[R*0.97,0.05],[R*0.82,0.14],[R*0.52,0.215],[R*0.16,0.245],[0.001,0.25]], 18);
      var shadeMat = new THREE.MeshStandardMaterial({color:col(0xf2e9d6), emissive:col(0xffbf80), emissiveIntensity:0.9, roughness:0.85, side:THREE.DoubleSide});
      var shade = lathe(shadeProf, 40, shadeMat, false); shade.position.set(0.86, 1.62, 0.25); g.add(shade);
      var bulb = new THREE.Mesh(new THREE.SphereGeometry(0.045, 12, 10), new THREE.MeshBasicMaterial({color:col(0xfff0d0), fog:false}));
      bulb.position.set(0.86, 1.66, 0.25); g.add(bulb);
      lampGlow = glow(g, 0.86, 1.6, 0.25, 0xffb066, 1.6, 0.8);
      lampLight = new THREE.PointLight(col(0xffbe80), lampBase, 6.5, 2);
      lampLight.position.set(0.86, 1.5, 0.25); g.add(lampLight);
      if(!isMobile){
        lampSpot = new THREE.SpotLight(col(0xffc890), 1.5, 8, 0.75, 1, 1.6);
        lampSpot.position.set(0.86, 1.55, 0.25); g.add(lampSpot);
        lampSpot.target.position.set(2.75, 0, 1.8); g.add(lampSpot.target);
      }
      room.add(g);
      blob(-2.75, -2.75, 0.9, 0.7, 0.55);
    })();

    /* ---------- lámpara colgante ---------- */
    var pendant = new THREE.Group();
    (function(){
      pendant.position.set(0, 6.2, -1.3);
      var cord = new THREE.Mesh(new THREE.PlaneGeometry(0.012, 3.0), new THREE.MeshBasicMaterial({color:0x0b0d14, side:THREE.DoubleSide}));
      cord.position.y = -1.5; pendant.add(cord);
      var cord2 = cord.clone(); cord2.rotation.y = Math.PI/2; pendant.add(cord2);
      var prof = smoothProfile([[0.46,0],[0.42,0.07],[0.33,0.16],[0.18,0.24],[0.06,0.29],[0.02,0.31]], 16);
      var out = lathe(prof, 48, M.brass, false); out.position.y = -3.3; pendant.add(out);
      var inner = new THREE.Mesh(new THREE.LatheGeometry(prof, 48), new THREE.MeshBasicMaterial({color:col(0xffc78f), side:THREE.BackSide, fog:false}));
      inner.scale.set(0.985, 0.985, 0.985); inner.position.y = -3.3; pendant.add(inner);
      var bulb = new THREE.Mesh(new THREE.SphereGeometry(0.07, 14, 10), new THREE.MeshBasicMaterial({color:col(0xfff2d8), fog:false}));
      bulb.position.y = -3.22; pendant.add(bulb);
      glow(pendant, 0, -3.3, 0, 0xffb066, 1.9, 0.6);
      room.add(pendant);
      updaters.push(function(t){ pendant.rotation.z = Math.sin(t*0.45)*0.010*MOTION; pendant.rotation.x = Math.sin(t*0.37 + 0.8)*0.007*MOTION; });
    })();

    /* ============================================================
       PLANTAS
       ============================================================ */
    var sways = [];
    function addSway(o, ax, az, sp, ph){ sways.push({o:o, ax:ax, az:az, sp:sp, ph:ph, bx:o.rotation.x, bz:o.rotation.z}); }

    /* ficus lira */
    (function(){
      var g = new THREE.Group(); g.position.set(3.75, 0, -2.45);
      var pot = lathe(smoothProfile([[0,0],[0.2,0],[0.27,0.05],[0.31,0.3],[0.32,0.46],[0.29,0.485]], 20), 40, ceram(0xcfc3aa, 0.55)); g.add(pot);
      var soil = new THREE.Mesh(new THREE.CircleGeometry(0.29, 28), M.soil); soil.rotation.x = -Math.PI/2; soil.position.y = 0.47; g.add(soil);
      var trunk = new THREE.CatmullRomCurve3([V3(0,0.4,0), V3(0.03,0.9,0.02), V3(-0.02,1.4,-0.01), V3(0.04,1.9,0), V3(0.02,2.3,0.01)]);
      g.add(new THREE.Mesh(new THREE.TubeGeometry(trunk, 30, 0.026, 8, false), M.stem));
      var r = rng(202), N = 24;
      for(var i=0;i<N;i++){
        var t = 0.18 + 0.82*i/(N-1), p = trunk.getPoint(t), k = i/(N-1);
        var len = lerp(0.6, 0.34, k), wid = len*0.62;
        var pivot = new THREE.Group(); pivot.position.copy(p);
        var leaf = new THREE.Mesh(leafGeo(len, wid, 0.28, 0.32), M.leaf);
        leaf.castShadow = SHADOWS; leaf.receiveShadow = SHADOWS;
        var yaw = i*2.4 + r()*0.4, phi = lerp(1.15, 0.65, k) + (r()-0.5)*0.2;
        leaf.quaternion.setFromEuler(new THREE.Euler(phi, 0, 0)).premultiply(new THREE.Quaternion().setFromAxisAngle(UP, yaw));
        pivot.add(leaf); g.add(pivot);
        addSway(pivot, 0.03, 0.03, 0.6 + r()*0.5, r()*6.28);
      }
      room.add(g);
      blob(3.75, -2.45, 1.1, 1.1, 0.5);
    })();

    /* lengua de suegra */
    (function(){
      var g = new THREE.Group(); g.position.set(4.15, 0, -0.85);
      var pot = lathe(smoothProfile([[0,0],[0.15,0],[0.2,0.04],[0.23,0.24],[0.24,0.34],[0.215,0.36]], 18), 36, ceram(0x1d2233, 0.35)); g.add(pot);
      var soil = new THREE.Mesh(new THREE.CircleGeometry(0.21, 24), M.soil); soil.rotation.x = -Math.PI/2; soil.position.y = 0.35; g.add(soil);
      var r = rng(303);
      for(var i=0;i<12;i++){
        var len = 0.5 + r()*0.55, wid = 0.1 + r()*0.05;
        var leaf = new THREE.Mesh(leafGeo(len, wid, 0.02, 0.05), M.snake);
        leaf.castShadow = SHADOWS;
        var yaw = i*2.4, phi = 0.08 + r()*0.28;
        leaf.quaternion.setFromEuler(new THREE.Euler(phi, 0, 0)).premultiply(new THREE.Quaternion().setFromAxisAngle(UP, yaw));
        var pv = new THREE.Group(); pv.position.set(Math.cos(yaw)*0.07, 0.34, Math.sin(yaw)*0.07); pv.add(leaf); g.add(pv);
        addSway(pv, 0.012, 0.012, 0.5 + r()*0.4, r()*6.28);
      }
      room.add(g);
      blob(4.15, -0.85, 0.8, 0.8, 0.5);
    })();

    /* florero de piso con ramas de eucalipto */
    (function(){
      var g = new THREE.Group(); g.position.set(-4.25, 0, -2.75);
      var vase = lathe(smoothProfile([[0,0],[0.14,0],[0.2,0.1],[0.245,0.4],[0.18,0.76],[0.1,0.9],[0.115,0.96],[0.108,0.97]], 30), 44, ceram(0x2a3550, 0.3)); g.add(vase);
      var r = rng(404), stems = [], leaves = [], lg = leafGeo(0.15, 0.08, 0.15, 0.2);
      for(var i=0;i<9;i++){
        var a = r()*6.283, lean = 0.15 + r()*0.45, hh = 0.9 + r()*0.75, dx = Math.cos(a)*lean, dz = Math.sin(a)*lean;
        var curve = new THREE.CatmullRomCurve3([V3(0,0.9,0), V3(dx*0.25, 0.9 + hh*0.4, dz*0.25), V3(dx*0.7, 0.9 + hh*0.78, dz*0.7), V3(dx, 0.9 + hh, dz)]);
        stems.push({g:new THREE.TubeGeometry(curve, 16, 0.006, 5, false)});
        var axis = V3(Math.cos(a + 1.57), 0, Math.sin(a + 1.57)), n = 13;
        for(var k=0;k<n;k++){
          var t = 0.3 + 0.7*k/(n-1), p = curve.getPoint(t), tan = curve.getTangent(t);
          var dir = tan.clone().applyAxisAngle(axis, (k%2 ? 1 : -1)*(0.75 + r()*0.4)).normalize();
          var q = new THREE.Quaternion().setFromUnitVectors(UP, dir);
          q.premultiply(new THREE.Quaternion().setFromAxisAngle(dir, r()*6.28));
          var sc = 0.75 + r()*0.6;
          leaves.push({g:lg, m:new THREE.Matrix4().compose(p, q, V3(sc, sc, sc))});
        }
      }
      var br = new THREE.Group(); g.add(br);
      br.add(new THREE.Mesh(mergeGeos(stems), M.stem));
      var lm = new THREE.Mesh(mergeGeos(leaves), M.leafDry); lm.castShadow = SHADOWS; br.add(lm);
            updaters.push(function(t){ br.rotation.z = Math.sin(t*0.6)*0.012*MOTION; br.rotation.x = Math.sin(t*0.45 + 2)*0.01*MOTION; });
      room.add(g);
      blob(-4.25, -2.75, 1.0, 1.0, 0.5);
    })();

    /* ============================================================
       PARED: cuadros, espejo, repisa, ventana y cortinas
       ============================================================ */
    function artFrame(w, h, c, fm){
      var g = new THREE.Group();
      g.add(rbm(fm, w + 0.14, h + 0.14, 0.05, 0.008, 1));
      var mt = new THREE.Mesh(new THREE.PlaneGeometry(w + 0.01, h + 0.01), M.matte); mt.position.z = 0.026; g.add(mt);
      var art = new THREE.Mesh(new THREE.PlaneGeometry(w*0.82, h*0.82), new THREE.MeshStandardMaterial({map:tex(c, true), roughness:0.85, metalness:0}));
      art.position.z = 0.028; g.add(art);
      return g;
    }
    var bigArt = artFrame(1.9, 1.2, artBigCanvas(sz(768), sz(486)), M.oak);
    bigArt.position.set(0, 2.05, WALL_Z + 0.115); room.add(bigArt);
    var art2 = artFrame(0.62, 0.86, artArchesCanvas(sz(320), sz(440), ['#c2603a','#24365a','#c9a15a'], 8), M.blackFrame);
    art2.position.set(-2.6, 1.85, WALL_Z + 0.115); room.add(art2);

    /* luz de galería sobre el cuadro principal */
    (function(){
      var g = new THREE.Group(); g.position.set(0, 2.9, WALL_Z + 0.2);
      place(rbm(M.brass, 0.62, 0.028, 0.06, 0.01, 1), g, 0, 0, 0);
      place(rbm(M.brass, 0.02, 0.02, 0.16, 0.006, 1), g, 0, 0, -0.08);
      var em = new THREE.Mesh(new THREE.PlaneGeometry(0.56, 0.02), new THREE.MeshBasicMaterial({color:col(0xffd7a0), fog:false}));
      em.rotation.x = Math.PI/2; em.position.set(0, -0.016, 0); g.add(em);
      glow(g, 0, -0.03, 0.02, 0xffc27a, 1.1, 0.35);
      room.add(g);
      if(!isMobile){
        var pl = new THREE.SpotLight(col(0xffd2a0), 1.1, 5, 0.55, 0.95, 1.4);
        pl.position.set(0, 2.88, WALL_Z + 0.35); pl.target.position.set(0, 1.9, WALL_Z); room.add(pl); room.add(pl.target);
      }
    })();

    /* espejo redondo con marco de latón */
    (function(){
      var g = new THREE.Group(); g.position.set(-4.25, 1.75, WALL_Z + 0.1);
      var mir = new THREE.Mesh(new THREE.CircleGeometry(0.56, 56), M.mirror); mir.position.z = 0.012; g.add(mir);
      var ring = new THREE.Mesh(new THREE.TorusGeometry(0.575, 0.026, 12, 72), M.brass); ring.position.z = 0.02; g.add(ring);
      var hl = new THREE.Mesh(new THREE.PlaneGeometry(0.16, 1.4), new THREE.MeshBasicMaterial({map:beamTex, color:col(0xbfd2ff), transparent:true, opacity:0.10, blending:THREE.AdditiveBlending, depthWrite:false, fog:false}));
      hl.rotation.z = 0.55; hl.position.set(0.12, 0, 0.02); g.add(hl);
      room.add(g);
    })();

    /* repisa flotante con libros, jarrón y enredadera */
    (function(){
      var g = new THREE.Group(); g.position.set(2.45, 1.5, WALL_Z + 0.16);
      var sh = rbm(M.walnut, 1.25, 0.05, 0.24, 0.012, 2); place(sh, g, 0, 0, 0);
      placeBooks(g, [[0.26,0.05,0.2,0x24365a,0.02],[0.24,0.04,0.19,0xb9573a,-0.03],[0.22,0.045,0.18,0xd9ccb3,0.02]], -0.45, 0.025, 0, 0);
      var vs = lathe(smoothProfile([[0,0],[0.045,0],[0.075,0.05],[0.07,0.11],[0.03,0.17],[0.036,0.2]], 14), 28, ceram(0xc2603a, 0.4));
      vs.position.set(0.05, 0.025, 0.01); g.add(vs);
      var ball = new THREE.Mesh(new THREE.SphereGeometry(0.045, 20, 16), M.brass); ball.position.set(0.36, 0.07, 0.02); g.add(ball);
      /* maceta colgante con hiedra */
      var pot = lathe(smoothProfile([[0,0],[0.06,0],[0.085,0.03],[0.09,0.12],[0.08,0.125]], 10), 24, ceram(0xd9ccb3, 0.5)); pot.position.set(-0.15, 0.025, 0.02); g.add(pot);
      var r = rng(515), st = [], lv = [], lgm = leafGeo(0.1, 0.085, 0.12, 0.15);
      for(var s=0;s<3;s++){
        var ox = (s-1)*0.05, len = 0.5 + r()*0.4;
        var c = new THREE.CatmullRomCurve3([V3(ox,0.12,0), V3(ox + (r()-0.5)*0.1, 0.02, 0.06), V3(ox + (r()-0.5)*0.12, -len*0.5, 0.1), V3(ox + (r()-0.5)*0.15, -len, 0.1)]);
        st.push({g:new THREE.TubeGeometry(c, 16, 0.004, 4, false)});
        for(var k=0;k<11;k++){
          var t = 0.1 + 0.9*k/10, p = c.getPoint(t), tan = c.getTangent(t).applyAxisAngle(V3(0,0,1), (k%2 ? 1 : -1)*0.9).normalize();
          var q = new THREE.Quaternion().setFromUnitVectors(UP, tan);
          q.premultiply(new THREE.Quaternion().setFromAxisAngle(tan, r()*6.28));
          lv.push({g:lgm, m:new THREE.Matrix4().compose(p, q, V3(1,1,1))});
        }
      }
      var vine = new THREE.Group(); vine.position.set(-0.15, 0.02, 0.02); g.add(vine);
      vine.add(new THREE.Mesh(mergeGeos(st), M.stem)); vine.add(new THREE.Mesh(mergeGeos(lv), M.leaf));
      updaters.push(function(t){ vine.rotation.z = Math.sin(t*0.8)*0.03*MOTION; vine.rotation.x = Math.sin(t*0.6 + 1.3)*0.025*MOTION; });
      room.add(g);
    })();

    /* ventana nocturna */
    var WIN_X = 5.75, WIN_Y = 1.85;
    (function(){
      var g = new THREE.Group(); g.position.set(WIN_X, WIN_Y, WALL_Z);
      var sky = new THREE.Mesh(new THREE.PlaneGeometry(1.7, 2.9), new THREE.MeshBasicMaterial({map:skyTex, fog:false}));
      sky.position.z = 0.012; g.add(sky);
      var f = M.steel;
      place(rbm(f, 1.92, 0.08, 0.1, 0.012, 1), g, 0, 1.5, 0.06);
      place(rbm(f, 1.92, 0.08, 0.1, 0.012, 1), g, 0, -1.5, 0.06);
      [-0.92, 0.92].forEach(function(x){ place(rbm(f, 0.08, 3.08, 0.1, 0.012, 1), g, x, 0, 0.06); });
      place(rbm(f, 0.035, 2.95, 0.06, 0.008, 1), g, 0, 0, 0.05);
      [-0.5, 0.5].forEach(function(y){ place(rbm(f, 1.8, 0.035, 0.06, 0.008, 1), g, 0, y, 0.05); });
      place(rbm(M.walnut, 2.15, 0.05, 0.24, 0.012, 2), g, 0, -1.56, 0.12);
      room.add(g);

      /* cortinas translúcidas con movimiento */
      var track = rbm(M.brass, 3.5, 0.045, 0.06, 0.012, 1); track.position.set(WIN_X, 3.52, WALL_Z + 0.2); room.add(track);
      function curtain(cx, w, phase){
        var h = 3.2, top = 3.48;
        var geo = new THREE.PlaneGeometry(w, h, 14, 24);
        var base = geo.attributes.position.array.slice();
        var m = new THREE.Mesh(geo, M.curtain); m.position.set(cx, top - h/2, WALL_Z + 0.2); m.renderOrder = 1; room.add(m);
        updaters.push(function(t){
          var p = geo.attributes.position;
          for(var i=0;i<p.count;i++){
            var bx = base[i*3], by = base[i*3+1], v = (by + h/2)/h;
            var z = Math.sin(bx*20 + phase)*0.04 + Math.sin(t*0.6 + by*1.4 + phase)*0.03*(1 - v)*MOTION + Math.sin(t*0.95 + bx*3.1)*0.012*(1 - v)*MOTION;
            p.setZ(i, z);
          }
          p.needsUpdate = true;
          geo.computeVertexNormals();
        });
      }
      curtain(WIN_X - 1.28, 0.85, 0.3);
      curtain(WIN_X + 1.28, 0.85, 1.9);

      /* haz de luna, mancha de ventana en el suelo y luz direccional azul */
      function beamMesh(a, b, c2, d, op, ord){
        var geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.Float32BufferAttribute([a.x,a.y,a.z, b.x,b.y,b.z, c2.x,c2.y,c2.z, d.x,d.y,d.z], 3));
        geo.setAttribute('uv', new THREE.Float32BufferAttribute([0,1, 1,1, 1,0, 0,0], 2));
        geo.setIndex([0,2,1, 0,3,2]);
        var m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({map:beamTex, color:col(0x8fb2ff), transparent:true, opacity:op, blending:THREE.AdditiveBlending, depthWrite:false, side:THREE.DoubleSide, fog:false}));
        m.renderOrder = ord; m.userData.base = op; room.add(m); return m;
      }
      var beams = [
        beamMesh(V3(4.95,3.0,-3.2), V3(6.2,3.0,-3.2), V3(2.0,0.02,-0.9), V3(3.6,0.02,-1.6), 0.11, 2),
        beamMesh(V3(5.0,2.1,-3.2), V3(6.3,2.1,-3.2), V3(2.6,0.02,-0.3), V3(4.2,0.02,-1.0), 0.08, 2),
        beamMesh(V3(4.95,1.2,-3.2), V3(6.2,1.2,-3.2), V3(3.2,0.02,0.4), V3(4.6,0.02,-0.4), 0.06, 2)
      ];
      var patch = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 3.1), new THREE.MeshBasicMaterial({map:goboTex, color:col(0x7ea3ff), transparent:true, opacity:0.16, blending:THREE.AdditiveBlending, depthWrite:false, fog:false}));
      patch.rotation.set(-Math.PI/2, 0, 0.62); patch.position.set(3.2, 0.025, -0.9); patch.renderOrder = 2; room.add(patch);
      updaters.push(function(t){
        beams.forEach(function(b, i){ b.material.opacity = b.userData.base*(0.8 + 0.2*Math.sin(t*0.4 + i*1.7) + 0.06*Math.sin(t*1.3 + i)); });
        patch.material.opacity = 0.14 + 0.03*Math.sin(t*0.4);
      });
    })();

    /* ============================================================
       POLVO EN SUSPENSIÓN
       ============================================================ */
    var DUST = isMobile ? 70 : 230, dpos = new Float32Array(DUST*3), dvel = new Float32Array(DUST), dph = new Float32Array(DUST);
    (function(){
      var r = rng(999), i;
      for(i=0;i<DUST;i++){
        dpos[i*3] = -7 + r()*14; dpos[i*3+1] = 0.2 + r()*4.2; dpos[i*3+2] = -3 + r()*8;
        dvel[i] = 0.01 + r()*0.03; dph[i] = r()*6.28;
      }
      var geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(dpos, 3));
      var pts = new THREE.Points(geo, new THREE.PointsMaterial({map:dustTex, size:0.055, transparent:true, opacity:0.5, depthWrite:false, blending:THREE.AdditiveBlending, color:col(0xffe0b0), fog:false}));
      pts.frustumCulled = false; room.add(pts);
      updaters.push(function(t, dt){
        for(var i=0;i<DUST;i++){
          dpos[i*3] += Math.sin(t*0.25 + dph[i])*0.03*dt*MOTION;
          dpos[i*3+1] += dvel[i]*dt*MOTION;
          dpos[i*3+2] += Math.cos(t*0.2 + dph[i])*0.02*dt*MOTION;
          if(dpos[i*3+1] > 4.6) dpos[i*3+1] = 0.15;
        }
        geo.attributes.position.needsUpdate = true;
      });
    })();

    /* ============================================================
       ENTORNO (reflejos) + LUCES
       ============================================================ */
    try{
      var env = new THREE.Scene();
      env.add(new THREE.Mesh(new THREE.BoxGeometry(24, 12, 24), new THREE.MeshBasicMaterial({color:col(0x0d1322), side:THREE.BackSide})));
      var pnl = function(w, h, x, y, z, rx, ry, hex, k){
        var m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({color:col(hex).multiplyScalar(k), side:THREE.DoubleSide}));
        m.position.set(x, y, z); m.rotation.set(rx, ry, 0); env.add(m);
      };
      pnl(9, 4, 0, 5.9, 0, Math.PI/2, 0, 0xffe6c4, 2.2);        // softbox cálido en el techo
      pnl(3, 6, 11.9, 2.5, -2, 0, -Math.PI/2, 0x86a8ff, 1.8);   // ventana luna (derecha)
      pnl(4, 3, -11.9, 3, 3, 0, Math.PI/2, 0xffb677, 1.0);      // lámpara cálida (izquierda)
      var pm = new THREE.PMREMGenerator(renderer);
      var envRT = pm.fromScene(env, 0.03);
      scene.environment = envRT.texture;
      pm.dispose();
    }catch(e){ console.warn('Entorno PMREM no disponible:', e); }

    var key = new THREE.DirectionalLight(col(0xffd9a8), 1.05);
    key.position.set(4.5, 7.5, 5.5);
    key.castShadow = SHADOWS;
    if(SHADOWS){
      key.shadow.mapSize.set(2048, 2048);
      key.shadow.camera.left = -8; key.shadow.camera.right = 8;
      key.shadow.camera.top = 7; key.shadow.camera.bottom = -4;
      key.shadow.camera.near = 1; key.shadow.camera.far = 24;
      key.shadow.radius = 5; key.shadow.bias = -0.0005; key.shadow.normalBias = 0.03;
    }
    key.target.position.set(0, 0.5, -1.5);
    scene.add(key); scene.add(key.target);

    var moon = new THREE.SpotLight(col(0x6f96ff), 1.3, 14, 0.62, 1, 1.2);
    moon.position.set(WIN_X - 0.4, 2.6, WALL_Z + 0.5);
    moon.target.position.set(2.6, 0, -0.6);
    scene.add(moon); scene.add(moon.target);
    var moonBase = 1.3;

    var fill = new THREE.PointLight(col(0x3c66c9), 0.55, 16, 2); fill.position.set(-5.5, 2.6, 3.5); scene.add(fill);
    var rimL = new THREE.PointLight(col(0xd1533a), 0.35, 12, 2); rimL.position.set(4.6, 1.3, 3.5); scene.add(rimL);
    scene.add(new THREE.HemisphereLight(col(0x3b4c7a), col(0x1a0f08), 0.8));

    /* viñeta pegada a la cámara */
    var vig = new THREE.Mesh(new THREE.PlaneGeometry(1,1), new THREE.MeshBasicMaterial({map:vigTex, transparent:true, depthTest:false, depthWrite:false, fog:false, toneMapped:false}));
    vig.position.z = -0.5; vig.renderOrder = 999; camera.add(vig);

    /* ============================================================
       CÁMARA: curva guiada por el scroll
       ============================================================ */
    var posCurve = new THREE.CatmullRomCurve3([V3(0,1.5,7.5), V3(3.0,1.25,5.9), V3(1.5,1.0,3.8), V3(-2.3,1.15,4.5), V3(-0.2,1.7,7.0)], false, 'centripetal');
    var tgtCurve = new THREE.CatmullRomCurve3([V3(0,0.95,-1.4), V3(0.8,0.9,-1.6), V3(0.2,0.6,-1.2), V3(-1.3,0.95,-1.9), V3(0,1.0,-1.5)], false, 'centripetal');
    var tmpPos = new THREE.Vector3(), tmpTgt = new THREE.Vector3();
    var zoomOut = 1;

    function applyView(){
      var a = W / H;
      camera.aspect = a;
      camera.fov = a < 1 ? 56 : (a < 1.4 ? 48 : 42);
      zoomOut = a < 1 ? 1 + (1 - a)*0.9 : 1;
      camera.updateProjectionMatrix();
      var hgt = 2*0.5*Math.tan(camera.fov*Math.PI/360);
      vig.scale.set(hgt*a*1.02, hgt*1.02, 1);
    }
    applyView();

    var scrollT = 0, targetScrollT = 0, px = 0, py = 0, tpx = 0, tpy = 0;
    function onScroll(){
      var h = document.documentElement.scrollHeight - window.innerHeight;
      targetScrollT = h > 0 ? clamp(window.scrollY / h, 0, 1) : 0;
    }
    window.addEventListener('scroll', onScroll, {passive:true});
    onScroll(); scrollT = targetScrollT;
    window.addEventListener('pointermove', function(e){
      if(e.pointerType === 'touch') return;
      tpx = (e.clientX / W)*2 - 1; tpy = (e.clientY / H)*2 - 1;
    }, {passive:true});

    /* ============================================================
       BUCLE DE ANIMACIÓN
       ============================================================ */
    var clock = new THREE.Clock(), elapsed = 0, raf = 0, frames = 0, accDt = 0, degraded = 0;

    function degrade(){
      degraded++;
      if(dpr > 1){ dpr = Math.max(1, dpr - 0.5); renderer.setPixelRatio(dpr); renderer.setSize(W, H); }
      else if(SHADOWS && renderer.shadowMap.enabled){
        renderer.shadowMap.enabled = false; key.castShadow = false;
        scene.traverse(function(o){ if(o.material){ [].concat(o.material).forEach(function(m){ m.needsUpdate = true; }); } });
      }
    }

    function frame(){
      raf = requestAnimationFrame(frame);
      var rawDt = clock.getDelta();
      var dt = Math.min(rawDt, 0.05);
      elapsed += dt; var t = elapsed;

      scrollT += (targetScrollT - scrollT)*(1 - Math.exp(-dt*3.4));
      var kp = 1 - Math.exp(-dt*2.2);
      px += (tpx - px)*kp; py += (tpy - py)*kp;

      var intro = reduceMotion ? 1 : easeOut(t / 3.0);
      posCurve.getPoint(scrollT, tmpPos); tgtCurve.getPoint(scrollT, tmpTgt);
      tmpPos.sub(tmpTgt).multiplyScalar(zoomOut).add(tmpTgt);
      tmpPos.z += (1 - intro)*2.8; tmpPos.y += (1 - intro)*0.4;
      tmpPos.x += px*0.45*MOTION + Math.sin(t*0.21)*0.12*MOTION;
      tmpPos.y += -py*0.2*MOTION + Math.sin(t*0.17 + 1.3)*0.05*MOTION;
      tmpTgt.x += px*0.25*MOTION; tmpTgt.y += -py*0.12*MOTION;
      camera.position.copy(tmpPos);
      camera.lookAt(tmpTgt);
      camera.rotateZ(Math.sin(t*0.13)*0.004*MOTION);

      /* la luz evoluciona con el scroll: luna → calidez de la lámpara */
      var warm = smooth(scrollT);
      renderer.toneMappingExposure = lerp(0.35, 1.2, intro);
      lampLight.intensity = lampBase*(0.85 + 0.35*warm)*(1 + 0.02*Math.sin(t*1.7) + 0.012*Math.sin(t*4.3));
      if(lampSpot) lampSpot.intensity = 1.5*(0.85 + 0.35*warm);
      lampGlow.material.opacity = 0.7 + 0.1*warm + 0.03*Math.sin(t*1.7);
      moon.intensity = moonBase*(1.1 - 0.35*warm);

      for(var i=0;i<updaters.length;i++) updaters[i](t, dt, scrollT);
      for(var s=0;s<sways.length;s++){
        var w = sways[s];
        w.o.rotation.x = w.bx + Math.sin(t*w.sp + w.ph)*w.ax*MOTION;
        w.o.rotation.z = w.bz + Math.cos(t*w.sp*0.8 + w.ph)*w.az*MOTION;
      }

      renderer.render(scene, camera);

      if(++frames > 120){
        accDt += rawDt;
        if(frames % 90 === 0){
          if(accDt/90 > 0.032 && degraded < 3) degrade();
          accDt = 0;
        }
      }
    }
    try{ renderer.compile(scene, camera); }catch(e){}
    frame();

    document.addEventListener('visibilitychange', function(){
      if(document.hidden){ cancelAnimationFrame(raf); raf = 0; }
      else if(!raf){ clock.getDelta(); frame(); }
    });
    canvas.addEventListener('webglcontextlost', function(e){ e.preventDefault(); cancelAnimationFrame(raf); raf = 0; });
    canvas.addEventListener('webglcontextrestored', function(){ if(!raf){ clock.getDelta(); frame(); } });

    var rz = 0;
    window.addEventListener('resize', function(){
      clearTimeout(rz);
      rz = setTimeout(function(){
        var nw = window.innerWidth, nh = window.innerHeight;
        /* en móvil la barra de direcciones cambia el alto al hacer scroll: se ignora */
        if(nw === W && Math.abs(nh - H) < 120) return;
        W = nw; H = nh;
        renderer.setSize(W, H);
        applyView();
      }, 120);
    });
  }catch(e){
    console.warn('Escena 3D no disponible:', e);
  }
})();
