/* ==========================================================================
   Talleres Juma — scene.js  (v4 · tren a la derecha, chispas, anillo orbital)
   Fondo 3D: tren de engranajes de precisión que engranan de verdad.

   - Engranajes con aro dentado, alma rebajada con agujeros de aligeramiento,
     cubo torneado y tornillo hexagonal de latón (sin cilindros lisos).
   - Los dientes encajan: velocidades y fases calculadas por relación de
     dientes, cada rueda gira en sentido contrario a su vecina.
   - Segundo plano con otro tren más grande y oscuro (profundidad/parallax).
   - Decoración técnica: diales graduados tipo bisel, círculos primitivos
     y líneas de centros (estética de plano de ingeniería), polvo de metal.
   - Materiales PBR con mapa de entorno procedural (tiras de luz de estudio).
   - Animación: entrada ensamblándose, parallax con el puntero, el scroll
     orbita la cámara Y acelera/invierte el giro, luz de brillo que barre.
   - Respeta prefers-reduced-motion. Fallback CSS si no hay WebGL.

   Compatible con Three.js r128. Mismos IDs que antes:
   #scene-canvas y #sceneFallback.
   ========================================================================== */

(function () {
  "use strict";

  var canvas = document.getElementById("scene-canvas");
  var fallback = document.getElementById("sceneFallback");

  if (!canvas || typeof THREE === "undefined") {
    if (fallback) fallback.classList.add("active");
    return;
  }

  var isMobile = window.innerWidth < 900;
  var reduceMotion = !!(window.matchMedia &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  var hasFinePointer = !!(window.matchMedia &&
    window.matchMedia("(pointer: fine)").matches);

  var renderer;
  try {
    renderer = new THREE.WebGLRenderer({
      canvas: canvas,
      antialias: !isMobile,
      alpha: true,
      powerPreference: "high-performance"
    });
  } catch (e) {
    if (fallback) fallback.classList.add("active");
    return;
  }

  var dpr = Math.min(window.devicePixelRatio || 1, isMobile ? 1.25 : 1.75);
  renderer.setPixelRatio(dpr);
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.outputEncoding = THREE.sRGBEncoding;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = reduceMotion ? 1.1 : 0.2;
  renderer.shadowMap.enabled = !isMobile;
  if (renderer.shadowMap.enabled) {
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  }

  var running = true;
  canvas.addEventListener("webglcontextlost", function (ev) {
    ev.preventDefault();
    running = false;
    if (fallback) fallback.classList.add("active");
  }, false);

  // ---------------------------------------------------------------------
  // Utilidades
  // ---------------------------------------------------------------------

  function clamp01(v) { return Math.max(0, Math.min(1, v)); }
  function clampRange(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function easeOutCubic(x) { return 1 - Math.pow(1 - x, 3); }

  var scene = new THREE.Scene();
  var NAVY = 0x060c2b;
  scene.fog = new THREE.FogExp2(NAVY, isMobile ? 0.044 : 0.038);

  var camera = new THREE.PerspectiveCamera(
    42,
    window.innerWidth / window.innerHeight,
    0.1,
    120
  );
  camera.position.set(0, 2.2, 14);

  // ---------------------------------------------------------------------
  // Textura procedural de imperfecciones (metal cepillado / uso real)
  // ---------------------------------------------------------------------

  function buildImperfectionTexture() {
    var size = 256;
    var c = document.createElement("canvas");
    c.width = c.height = size;
    var ctx = c.getContext("2d");
    var img = ctx.createImageData(size, size);
    for (var y = 0; y < size; y++) {
      for (var x = 0; x < size; x++) {
        var i = (y * size + x) * 4;
        var streak = Math.sin(x * 0.14 + Math.sin(y * 0.05) * 2.0) * 10;
        var grain = (Math.random() - 0.5) * 26;
        var v = 168 + streak + grain;
        v = Math.max(90, Math.min(235, v));
        img.data[i] = v;
        img.data[i + 1] = v;
        img.data[i + 2] = v;
        img.data[i + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
    var tex = new THREE.CanvasTexture(c);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(1.4, 1.4);
    return tex;
  }

  var imperfectionTex = buildImperfectionTexture();

  // ---------------------------------------------------------------------
  // Mapa de entorno procedural: estudio con softboxes y tiras de luz
  // ---------------------------------------------------------------------

  function buildEnvTexture(rendererRef) {
    if (typeof THREE.PMREMGenerator === "undefined") return null;
    try {
      var envScene = new THREE.Scene();

      var skyGeo = new THREE.SphereGeometry(60, 32, 16);
      var pos = skyGeo.attributes.position;
      var colors = new Float32Array(pos.count * 3);
      var top = new THREE.Color(0x263766);
      var bottom = new THREE.Color(0x05060f);
      var tmp = new THREE.Color();
      for (var i = 0; i < pos.count; i++) {
        var t = THREE.MathUtils.clamp((pos.getY(i) + 60) / 120, 0, 1);
        tmp.copy(bottom).lerp(top, t);
        colors[i * 3] = tmp.r;
        colors[i * 3 + 1] = tmp.g;
        colors[i * 3 + 2] = tmp.b;
      }
      skyGeo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
      var skyMat = new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide });
      envScene.add(new THREE.Mesh(skyGeo, skyMat));

      function panel(x, y, z, rx, ry, rz, w, h, intensity, color) {
        var mat = new THREE.MeshBasicMaterial({ color: color, side: THREE.DoubleSide });
        mat.color.multiplyScalar(intensity);
        var mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
        mesh.position.set(x, y, z);
        mesh.rotation.set(rx, ry, rz);
        envScene.add(mesh);
      }
      // Softbox principal (cálido)
      panel(11, 9, 5, 0, -0.55, 0, 16, 11, 3.0, 0xfff2df);
      // Relleno frío (azul de marca)
      panel(-15, 1, 3, 0, 0.55, 0, 13, 17, 1.5, 0x3b63ec);
      // Contraluz (rojo de marca)
      panel(1, -5, -15, 0, 3.35, 0, 11, 11, 2.0, 0xef2430);
      // Techo suave de estudio
      panel(0, 22, 0, Math.PI / 2, 0, 0, 30, 30, 0.8, 0xaeb8d8);
      // Referencia tenue de "suelo" (solo para reflejos, no se ve)
      panel(0, -20, 0, -Math.PI / 2, 0, 0, 40, 40, 0.12, 0x0a0d1c);
      // Tiras de luz: dan brillos largos y nítidos que recorren los dientes
      panel(-3, 7, 9, 0.5, 0.15, 0, 2.2, 18, 5.0, 0xffffff);
      panel(14, -1, -4, 0, -1.2, 0, 1.8, 16, 3.5, 0xcfe0ff);

      var pmrem = new THREE.PMREMGenerator(rendererRef);
      var target = pmrem.fromScene(envScene, 0.035);
      pmrem.dispose();
      return target.texture;
    } catch (e) {
      return null;
    }
  }

  var envTexture = buildEnvTexture(renderer);

  // ---------------------------------------------------------------------
  // Materiales metálicos PBR
  // ---------------------------------------------------------------------

  function metalMaterial(color, roughness, envIntensity) {
    var mat = new THREE.MeshPhysicalMaterial({
      color: color,
      metalness: 1.0,
      roughness: roughness,
      roughnessMap: imperfectionTex,
      envMapIntensity: envIntensity
    });
    if (envTexture) mat.envMap = envTexture;
    return mat;
  }

  var steelDark = metalMaterial(0x767e97, 0.4, 1.25);
  var steelLight = metalMaterial(0xc7cde2, 0.3, 1.35);
  var gunmetal = metalMaterial(0x434a66, 0.55, 0.62);
  var brass = metalMaterial(0xc19a5b, 0.32, 1.3);

  var redAccent = metalMaterial(0xb4131f, 0.38, 1.2);
  redAccent.emissive = new THREE.Color(0x220305);
  redAccent.emissiveIntensity = 0.35;
  redAccent.clearcoat = 0.5;
  redAccent.clearcoatRoughness = 0.25;

  var blueAnodized = metalMaterial(0x2f52d6, 0.34, 1.3);
  blueAnodized.emissive = new THREE.Color(0x050c26);
  blueAnodized.emissiveIntensity = 0.4;
  blueAnodized.clearcoat = 0.35;
  blueAnodized.clearcoatRoughness = 0.3;

  // ---------------------------------------------------------------------
  // Geometría de engranaje procedural
  //   - Dientes trapezoidales con módulo común -> engranan entre sí.
  //   - Aro grueso + alma más delgada con agujeros de aligeramiento.
  //   - Cubo torneado (LatheGeometry) con hueco central y tornillo hex.
  // ---------------------------------------------------------------------

  var MODULE = 0.22;
  function pitchR(n) { return n * MODULE * 0.5; }

  function polar(r, a) { return { x: Math.cos(a) * r, y: Math.sin(a) * r }; }

  // El diente 0 queda centrado en el ángulo 0 (necesario para la fase).
  function buildRimShape(teeth, rootR, tipR, innerR) {
    var shape = new THREE.Shape();
    var pa = (Math.PI * 2) / teeth;
    var rootHalf = pa * 0.30;
    var tipHalf = pa * 0.13;

    for (var i = 0; i < teeth; i++) {
      var c = i * pa;
      var pts = [
        polar(rootR, c - rootHalf),
        polar(tipR, c - tipHalf),
        polar(tipR, c + tipHalf),
        polar(rootR, c + rootHalf)
      ];
      for (var k = 0; k < 4; k++) {
        if (i === 0 && k === 0) shape.moveTo(pts[k].x, pts[k].y);
        else shape.lineTo(pts[k].x, pts[k].y);
      }
    }
    shape.closePath();

    var hole = new THREE.Path();
    hole.absarc(0, 0, innerR, 0, Math.PI * 2, true);
    shape.holes.push(hole);
    return shape;
  }

  function buildWebShape(outerR, boreR, holes, holeR, ringR, phase) {
    var shape = new THREE.Shape();
    shape.absarc(0, 0, outerR, 0, Math.PI * 2, false);

    var bore = new THREE.Path();
    bore.absarc(0, 0, boreR, 0, Math.PI * 2, true);
    shape.holes.push(bore);

    for (var i = 0; i < holes; i++) {
      var a = phase + (i * Math.PI * 2) / holes;
      var h = new THREE.Path();
      h.absarc(Math.cos(a) * ringR, Math.sin(a) * ringR, holeR, 0, Math.PI * 2, true);
      shape.holes.push(h);
    }
    return shape;
  }

  function buildHexShape(r, socketR) {
    var s = new THREE.Shape();
    var i, a;
    for (i = 0; i < 6; i++) {
      a = (i * Math.PI) / 3 + Math.PI / 6;
      if (i === 0) s.moveTo(Math.cos(a) * r, Math.sin(a) * r);
      else s.lineTo(Math.cos(a) * r, Math.sin(a) * r);
    }
    s.closePath();
    var h = new THREE.Path();
    for (i = 0; i < 6; i++) {
      a = (i * Math.PI) / 3;
      if (i === 0) h.moveTo(Math.cos(a) * socketR, Math.sin(a) * socketR);
      else h.lineTo(Math.cos(a) * socketR, Math.sin(a) * socketR);
    }
    h.closePath();
    s.holes.push(h);
    return s;
  }

  function makeGear(teeth, thick, mat, hubMat, holes, shadows) {
    var rp = pitchR(teeth);
    var rootR = rp - 1.25 * MODULE;
    var tipR = rp + 0.9 * MODULE;
    var rimInner = rootR * 0.84;
    var collarR = rp * 0.3;
    var bevT = thick * 0.1;
    var spin = new THREE.Group();

    // Aro dentado
    var rimGeo = new THREE.ExtrudeGeometry(
      buildRimShape(teeth, rootR, tipR, rimInner),
      {
        depth: thick,
        bevelEnabled: true,
        bevelThickness: bevT,
        bevelSize: MODULE * 0.09,
        bevelSegments: isMobile ? 2 : 3,
        curveSegments: 36
      }
    );
    rimGeo.translate(0, 0, -thick / 2);
    var rim = new THREE.Mesh(rimGeo, mat);
    rim.castShadow = shadows;
    rim.receiveShadow = shadows;
    spin.add(rim);

    // Alma rebajada con agujeros de aligeramiento
    var webT = thick * 0.5;
    var hr = 0, ringR = 0;
    if (holes > 0) {
      var rIn = collarR * 1.22;
      var rOut = rimInner * 0.94;
      ringR = (rIn + rOut) / 2;
      hr = Math.min(
        ((rOut - rIn) / 2) * 0.92,
        ringR * Math.sin(Math.PI / holes) * 0.72
      );
    }
    var webOuter = rimInner + (rootR - rimInner) * 0.6;
    var webGeo = new THREE.ExtrudeGeometry(
      buildWebShape(webOuter, collarR * 0.8, holes, hr, ringR, Math.PI / holes),
      {
        depth: webT,
        bevelEnabled: true,
        bevelThickness: webT * 0.12,
        bevelSize: 0.02,
        bevelSegments: 2,
        curveSegments: 40
      }
    );
    webGeo.translate(0, 0, -webT / 2);
    var web = new THREE.Mesh(webGeo, mat);
    web.receiveShadow = shadows;
    spin.add(web);

    // Cubo torneado con brida y hueco central
    var hh = thick * 0.5 + bevT + 0.09;
    var rc = collarR;
    var prof = [
      [0, -hh * 0.8], [rc * 0.52, -hh * 0.8], [rc * 0.6, -hh], [rc * 0.9, -hh],
      [rc, -hh * 0.86], [rc, hh * 0.86], [rc * 0.9, hh], [rc * 0.6, hh],
      [rc * 0.52, hh * 0.8], [0, hh * 0.8]
    ].map(function (p) { return new THREE.Vector2(p[0], p[1]); });
    var hubGeo = new THREE.LatheGeometry(prof, isMobile ? 28 : 44);
    hubGeo.rotateX(Math.PI / 2);
    var hub = new THREE.Mesh(hubGeo, hubMat);
    hub.castShadow = shadows;
    spin.add(hub);

    // Tornillos hexagonales de latón (con hueco Allen) a ambos lados
    var hexR = rc * 0.34;
    var hexD = 0.1;
    var hexGeo = new THREE.ExtrudeGeometry(buildHexShape(hexR, hexR * 0.45), {
      depth: hexD,
      bevelEnabled: true,
      bevelThickness: 0.02,
      bevelSize: 0.015,
      bevelSegments: 2,
      curveSegments: 6
    });
    hexGeo.translate(0, 0, -hexD / 2);
    var zFloor = hh * 0.8 + hexD * 0.35;
    var hexF = new THREE.Mesh(hexGeo, brass);
    hexF.position.z = zFloor;
    var hexB = new THREE.Mesh(hexGeo, brass);
    hexB.position.z = -zFloor;
    spin.add(hexF);
    spin.add(hexB);

    spin.userData.rp = rp;
    spin.userData.faceZ = thick * 0.5 + bevT;
    return spin;
  }

  // ---------------------------------------------------------------------
  // Trenes de engranajes: cada rueda se coloca a la distancia de paso de
  // su "padre" y su fase se calcula para que los dientes encajen.
  // ---------------------------------------------------------------------

  function buildChain(defs, z, shadows) {
    var items = [];
    defs.forEach(function (d) {
      var spin = makeGear(d.teeth, d.thick, d.mat, d.hubMat, d.holes, shadows);
      var holder = new THREE.Group();
      holder.add(spin);

      var parent = d.parent == null ? null : items[d.parent];
      var theta = ((d.theta || 0) * Math.PI) / 180;
      var x = d.x || 0;
      var y = d.y || 0;
      if (parent) {
        var dist = (pitchR(parent.teeth) + pitchR(d.teeth)) * 1.014;
        x = parent.x + Math.cos(theta) * dist;
        y = parent.y + Math.sin(theta) * dist;
      }
      holder.position.set(x, y, z);

      items.push({
        holder: holder,
        spin: spin,
        teeth: d.teeth,
        parent: parent,
        theta: theta,
        x: x,
        y: y,
        rest: new THREE.Vector3(x, y, z),
        angle: 0
      });
    });
    return items;
  }

  // Rueda conducida: gira en sentido contrario, con relación de dientes
  // y fase tal que un diente de la vecina cae en el hueco de ésta.
  function updateChain(items, driverAngle) {
    for (var i = 0; i < items.length; i++) {
      var g = items[i];
      if (!g.parent) {
        g.angle = driverAngle;
      } else {
        g.angle = g.theta + Math.PI +
          (g.parent.teeth * (g.theta - g.parent.angle) - Math.PI) / g.teeth;
      }
      g.spin.rotation.z = g.angle;
    }
  }

  var rig = new THREE.Group();
  rig.position.set(0.25, 0.55, 0);
  scene.add(rig);

  var bgRig = new THREE.Group();
  scene.add(bgRig);

  // Tren principal (plano z = 0): héroe + 4 ruedas engranadas
  var fg = buildChain([
    { teeth: 22, thick: 0.56, mat: steelLight,   hubMat: steelDark,  holes: 6, x: 0, y: 0 },
    { teeth: 14, thick: 0.5,  mat: steelDark,    hubMat: steelLight, holes: 5, parent: 0, theta: 38 },
    { teeth: 10, thick: 0.46, mat: redAccent,    hubMat: steelLight, holes: 0, parent: 0, theta: 203 },
    { teeth: 16, thick: 0.5,  mat: steelDark,    hubMat: steelLight, holes: 5, parent: 0, theta: -48 },
    { teeth: 12, thick: 0.46, mat: blueAnodized, hubMat: steelLight, holes: 3, parent: 2, theta: -105 }
  ], 0, !isMobile);
  fg.forEach(function (g) { rig.add(g.holder); });


  // ---------------------------------------------------------------------
  // Decoración técnica (estética de plano de ingeniería)
  // ---------------------------------------------------------------------

  // Dial graduado tipo bisel, dibujado en un canvas (sin imágenes externas)
  function buildDialTexture() {
    var S = 1024;
    var c = document.createElement("canvas");
    c.width = c.height = S;
    var g = c.getContext("2d");
    g.translate(S / 2, S / 2);
    var d, a;

    function ring(r, w, style) {
      g.beginPath();
      g.arc(0, 0, r, 0, Math.PI * 2);
      g.lineWidth = w;
      g.strokeStyle = style;
      g.stroke();
    }
    function arc(r, a0, a1, w, style) {
      g.beginPath();
      g.arc(0, 0, r, (a0 * Math.PI) / 180, (a1 * Math.PI) / 180);
      g.lineWidth = w;
      g.strokeStyle = style;
      g.stroke();
    }

    // Solo dos anillos: borde exterior y una guía interior muy tenue
    ring(506, 3, "rgba(170,190,255,0.85)");
    ring(430, 1.5, "rgba(170,190,255,0.28)");

    // Marcas cada 10°, con una más larga cada 30° (sin numeración)
    for (d = 0; d < 360; d += 10) {
      a = (d * Math.PI) / 180;
      var major = d % 30 === 0;
      var r2 = major ? 462 : 486;
      g.beginPath();
      g.moveTo(Math.cos(a) * 506, Math.sin(a) * 506);
      g.lineTo(Math.cos(a) * r2, Math.sin(a) * r2);
      g.lineWidth = major ? 3 : 1.5;
      g.strokeStyle = major ? "rgba(225,233,255,0.9)" : "rgba(170,190,255,0.5)";
      g.stroke();
    }

    // Dos sectores de color de marca
    arc(400, -20, 70, 6, "rgba(239,36,48,0.85)");
    arc(400, 160, 200, 6, "rgba(88,120,255,0.85)");

    var tex = new THREE.CanvasTexture(c);
    tex.encoding = THREE.sRGBEncoding;
    tex.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
    return tex;
  }

  var dialTex = buildDialTexture();

  function makeDial(size, z, maxOpacity) {
    var mat = new THREE.MeshBasicMaterial({
      map: dialTex,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      fog: false
    });
    var mesh = new THREE.Mesh(new THREE.PlaneGeometry(size, size), mat);
    mesh.position.z = z;
    mesh.userData.maxOpacity = maxOpacity;
    return mesh;
  }

  var dialNear = makeDial(9.6, -0.9, 0.2);
  rig.add(dialNear);

  // Círculos primitivos (paso) y líneas de centros entre ruedas engranadas
  var guideMat = new THREE.LineBasicMaterial({
    color: 0x7f9bff,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    blending: THREE.AdditiveBlending
  });

  function circlePoints(r, segs, z) {
    var pts = [];
    for (var i = 0; i < segs; i++) {
      var a = (i / segs) * Math.PI * 2;
      pts.push(new THREE.Vector3(Math.cos(a) * r, Math.sin(a) * r, z));
    }
    return pts;
  }

  fg.forEach(function (g) {
    var faceZ = g.spin.userData.faceZ + 0.01;
    var pitchCircle = new THREE.LineLoop(
      new THREE.BufferGeometry().setFromPoints(circlePoints(g.spin.userData.rp, 120, faceZ)),
      guideMat
    );
    g.holder.add(pitchCircle);
  });

  var linkPts = [];
  fg.forEach(function (g) {
    if (g.parent) {
      linkPts.push(new THREE.Vector3(g.parent.x, g.parent.y, 0.45));
      linkPts.push(new THREE.Vector3(g.x, g.y, 0.45));
    }
  });
  var links = new THREE.LineSegments(
    new THREE.BufferGeometry().setFromPoints(linkPts),
    guideMat
  );
  rig.add(links);


  // ---------------------------------------------------------------------
  // v4: halo de luz, anillo orbital, chispas en el engrane, tuercas flotantes
  // ---------------------------------------------------------------------
  var glowTex = buildSpriteTexture();
  function addHalo(color, size, x, y, z, op) {
    var m = new THREE.Mesh(
      new THREE.PlaneGeometry(size, size),
      new THREE.MeshBasicMaterial({ map: glowTex, color: color, transparent: true, opacity: 0,
        blending: THREE.AdditiveBlending, depthWrite: false, fog: false })
    );
    m.position.set(x, y, z); m.userData.op = op; rig.add(m); return m;
  }
  var halos = [addHalo(0x3b63ec, 17, 0, 0, -2.4, 0.34), addHalo(0xef2430, 8, 3, -3, -2.2, 0.2)];

  var orbit = new THREE.Group();
  orbit.rotation.set(1.18, 0.25, 0);
  rig.add(orbit);
  var ringMat = new THREE.MeshBasicMaterial({ color: 0x7f9bff, transparent: true, opacity: 0,
    blending: THREE.AdditiveBlending, depthWrite: false, fog: false });
  orbit.add(new THREE.Mesh(new THREE.TorusGeometry(6.4, 0.014, 6, 180), ringMat));
  var comets = [[0xef2430, 0], [0xdbe4ff, 2.1], [0x6f8cff, 4.2]].map(function (c) {
    var s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: c[0], transparent: true, opacity: 0,
      blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
    s.scale.setScalar(0.65); s.userData.off = c[1]; orbit.add(s); return s;
  });

  // Chispas que saltan donde los dientes engranan
  var meshPts = fg.filter(function (g) { return g.parent; });
  var SN = isMobile ? 28 : 64;
  var sPos = new Float32Array(SN * 3), sCol = new Float32Array(SN * 3), sVel = new Float32Array(SN * 3);
  var sLife = new Float32Array(SN), sMax = new Float32Array(SN);
  for (var si = 0; si < SN; si++) sLife[si] = -Math.random() * 2;
  var sGeo = new THREE.BufferGeometry();
  sGeo.setAttribute("position", new THREE.BufferAttribute(sPos, 3));
  sGeo.setAttribute("color", new THREE.BufferAttribute(sCol, 3));
  var sMat = new THREE.PointsMaterial({ size: 0.09, map: glowTex, vertexColors: true, transparent: true,
    opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, fog: false });
  var sparks = new THREE.Points(sGeo, sMat);
  sparks.frustumCulled = false;
  rig.add(sparks);
  var rev = 0;

  function updateSparks(dt) {
    for (var i = 0; i < SN; i++) {
      var o = i * 3;
      if (sLife[i] > 0) {
        sLife[i] -= dt;
        sVel[o + 1] -= 4.2 * dt;
        sPos[o] += sVel[o] * dt; sPos[o + 1] += sVel[o + 1] * dt; sPos[o + 2] += sVel[o + 2] * dt;
        var k = Math.max(0, sLife[i] / sMax[i]);
        sCol[o] = k; sCol[o + 1] = k * 0.55; sCol[o + 2] = k * 0.18;
      } else {
        sCol[o] = sCol[o + 1] = sCol[o + 2] = 0;
        sLife[i] -= dt;
        if (sLife[i] < -(0.15 + Math.random() * 1.4) / (1 + rev * 5)) {
          var g = meshPts[(Math.random() * meshPts.length) | 0], p = g.parent;
          var cx = Math.cos(g.theta), cy = Math.sin(g.theta), dir = Math.random() < 0.5 ? -1 : 1;
          var sp = 1.4 + Math.random() * 2.6;
          sPos[o] = p.x + cx * pitchR(p.teeth); sPos[o + 1] = p.y + cy * pitchR(p.teeth); sPos[o + 2] = (Math.random() - 0.5) * 0.4;
          sVel[o] = -cy * dir * sp + cx * (Math.random() - 0.5) * 0.8;
          sVel[o + 1] = cx * dir * sp + cy * (Math.random() - 0.5) * 0.8;
          sVel[o + 2] = (Math.random() - 0.3) * 0.8;
          sMax[i] = sLife[i] = 0.5 + Math.random() * 0.7;
        }
      }
    }
    sGeo.attributes.position.needsUpdate = true;
    sGeo.attributes.color.needsUpdate = true;
  }

  // Tuercas hexagonales flotando alrededor (profundidad, nada queda vacío)
  var nutGeo = new THREE.ExtrudeGeometry(buildHexShape(0.3, 0.12), {
    depth: 0.14, bevelEnabled: true, bevelThickness: 0.025, bevelSize: 0.02, bevelSegments: 2, curveSegments: 6 });
  nutGeo.translate(0, 0, -0.07);
  var nutMats = [steelLight, brass, steelDark, blueAnodized, redAccent];
  var nuts = [];
  for (var ni = 0; ni < (isMobile ? 6 : 14); ni++) {
    var nm = new THREE.Mesh(nutGeo, nutMats[ni % nutMats.length]);
    var ns = 0.6 + Math.random() * 0.9;
    nm.userData = { s: ns, by: (Math.random() - 0.5) * 12, ph: Math.random() * 6.28,
      rx: (Math.random() - 0.5) * 0.7, ry: (Math.random() - 0.5) * 0.7 };
    nm.position.set((Math.random() - 0.5) * 18, nm.userData.by, Math.random() < 0.75 ? -2 - Math.random() * 4 : 2 + Math.random() * 2.5);
    nm.rotation.set(Math.random() * 3, Math.random() * 3, 0);
    nm.scale.setScalar(0.001);
    rig.add(nm); nuts.push(nm);
  }

  // Polvo de metal / destellos flotando
  function buildSpriteTexture() {
    var c = document.createElement("canvas");
    c.width = c.height = 64;
    var g = c.getContext("2d");
    var grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    grad.addColorStop(0, "rgba(255,255,255,1)");
    grad.addColorStop(0.25, "rgba(255,255,255,0.55)");
    grad.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = grad;
    g.fillRect(0, 0, 64, 64);
    var tex = new THREE.CanvasTexture(c);
    tex.encoding = THREE.sRGBEncoding;
    return tex;
  }

  var PCOUNT = isMobile ? 36 : 80;
  var pPos = new Float32Array(PCOUNT * 3);
  var pCol = new Float32Array(PCOUNT * 3);
  var pX0 = new Float32Array(PCOUNT);
  var pY = new Float32Array(PCOUNT);
  var pVy = new Float32Array(PCOUNT);
  var pSA = new Float32Array(PCOUNT);
  var pSF = new Float32Array(PCOUNT);
  var pPh = new Float32Array(PCOUNT);
  var palette = [
    new THREE.Color(0x9fb4ff), new THREE.Color(0xdbe4ff),
    new THREE.Color(0x6f8cff), new THREE.Color(0xff7a6b)
  ];
  for (var pi = 0; pi < PCOUNT; pi++) {
    pX0[pi] = (Math.random() - 0.5) * 30;
    pY[pi] = (Math.random() - 0.5) * 20;
    pPos[pi * 3 + 2] = -9 + Math.random() * 17;
    pVy[pi] = 0.05 + Math.random() * 0.2;
    pSA[pi] = 0.15 + Math.random() * 0.5;
    pSF[pi] = 0.15 + Math.random() * 0.4;
    pPh[pi] = Math.random() * Math.PI * 2;
    var pc = palette[Math.random() < 0.08 ? 3 : Math.floor(Math.random() * 3)];
    pCol[pi * 3] = pc.r;
    pCol[pi * 3 + 1] = pc.g;
    pCol[pi * 3 + 2] = pc.b;
  }
  var pGeo = new THREE.BufferGeometry();
  pGeo.setAttribute("position", new THREE.BufferAttribute(pPos, 3));
  pGeo.setAttribute("color", new THREE.BufferAttribute(pCol, 3));
  var pMat = new THREE.PointsMaterial({
    size: isMobile ? 0.14 : 0.11,
    map: buildSpriteTexture(),
    vertexColors: true,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    sizeAttenuation: true
  });
  var dust = new THREE.Points(pGeo, pMat);
  dust.frustumCulled = false;
  scene.add(dust);

  // ---------------------------------------------------------------------
  // Iluminación: 3 puntos cinematográficos + luz de brillo que barre
  // ---------------------------------------------------------------------

  var key = new THREE.DirectionalLight(0xfff2df, 1.35);
  key.position.set(6, 8, 6);
  key.castShadow = !isMobile;
  if (key.castShadow) {
    key.shadow.mapSize.set(2048, 2048);
    key.shadow.camera.near = 1;
    key.shadow.camera.far = 40;
    key.shadow.camera.left = -9;
    key.shadow.camera.right = 9;
    key.shadow.camera.top = 9;
    key.shadow.camera.bottom = -9;
    key.shadow.radius = 3;
    key.shadow.bias = -0.001;
    key.shadow.normalBias = 0.03;
  }
  scene.add(key);

  var fill = new THREE.PointLight(0x3b63ec, 3.8, 32, 2);
  fill.position.set(-8, 2, 4);
  scene.add(fill);

  var rim = new THREE.PointLight(0xef2430, 3.2, 32, 2);
  rim.position.set(4, -3, -6);
  scene.add(rim);

  var glint = new THREE.PointLight(0xffe2bd, 2.2, 24, 2);
  glint.position.set(0, 1, 6);
  scene.add(glint);

  scene.add(new THREE.AmbientLight(0x1b2450, 0.4));

  // ---------------------------------------------------------------------
  // Entrada del usuario: scroll (con velocidad) y puntero (parallax)
  // ---------------------------------------------------------------------

  var targetScrollT = 0;
  var currentScrollT = 0;
  var lastTarget = 0;
  var scrollVel = 0;

  function onScroll() {
    var max = document.documentElement.scrollHeight - window.innerHeight;
    targetScrollT = max > 0 ? window.scrollY / max : 0;
  }
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();
  lastTarget = targetScrollT;
  currentScrollT = targetScrollT;

  window.addEventListener("pointerdown", function (e) {
    if (reduceMotion) return;
    if (e.target.closest && e.target.closest("a,button,input,.lb")) return;
    rev = hasFinePointer ? 0.6 : 0.3;
  }, { passive: true });

  var mouseX = 0, mouseY = 0, px = 0, py = 0;
  if (isMobile && !reduceMotion && window.DeviceOrientationEvent &&
      typeof DeviceOrientationEvent.requestPermission !== "function") {
    window.addEventListener("deviceorientation", function (e) {
      if (e.gamma == null || e.beta == null) return;
      mouseX = Math.max(-1, Math.min(1, e.gamma / 25));
      mouseY = Math.max(-1, Math.min(1, (e.beta - 55) / 25));
    }, { passive: true });
  }
  if (hasFinePointer && !reduceMotion) {
    window.addEventListener("pointermove", function (ev) {
      mouseX = (ev.clientX / window.innerWidth - 0.5) * 2;
      mouseY = (ev.clientY / window.innerHeight - 0.5) * 2;
    }, { passive: true });
  }

  // ---------------------------------------------------------------------
  // Bucle de animación
  // ---------------------------------------------------------------------

  var clock = new THREE.Clock();
  var t = 0;
  var driverFg = 0;
  var driverB = 2.1;
  var INTRO = reduceMotion ? 0.001 : 3.2;
  var motion = reduceMotion ? 0.25 : 1;

  function applyIntro(items, delay, stagger, dur, spread) {
    for (var i = 0; i < items.length; i++) {
      var it = items[i];
      var p = reduceMotion ? 1 : clamp01((t - delay - i * stagger) / dur);
      var k = 1 - easeOutCubic(p);
      it.holder.position.set(
        it.rest.x + it.rest.x * 0.8 * k,
        it.rest.y + it.rest.y * 0.8 * k,
        it.rest.z - spread * k
      );
      it.holder.scale.setScalar(0.6 + 0.4 * (1 - k));
    }
  }

  function frame() {
    var dt = Math.min(clock.getDelta(), 0.05);
    t += dt;

    var eIntro = easeOutCubic(clamp01(t / INTRO));
    var decoIn = reduceMotion ? 1 : clamp01((t - 1.6) / 1.4);

    currentScrollT += (targetScrollT - currentScrollT) * (1 - Math.exp(-dt * 3.6));

    // Fuera del hero la escena baja de intensidad (hasta ~58%) para que
    // las secciones de texto se lean limpias sobre el fondo.
    var calm = clamp01(window.scrollY / (window.innerHeight * 1.1));
    canvas.style.opacity = (1 - 0.42 * easeOutCubic(calm)).toFixed(3);

    // Velocidad de scroll -> acelera / invierte el giro de los engranajes
    var rawVel = dt > 0 ? (targetScrollT - lastTarget) / dt : 0;
    lastTarget = targetScrollT;
    scrollVel += (rawVel - scrollVel) * 0.12;
    rev *= Math.exp(-dt * 1.1);
    var boost = reduceMotion ? 0 : clampRange(scrollVel * 3, -1.2, 1.2) + rev * 1.0;

    driverFg += (0.14 * motion + boost) * dt;

    updateChain(fg, driverFg);

    // Entrada: las piezas se ensamblan desde fuera y desde atrás
    applyIntro(fg, 0.0, 0.16, 1.7, 6);
    renderer.toneMappingExposure = reduceMotion
      ? 1.1
      : 0.2 + 0.9 * easeOutCubic(clamp01(t / 2.0));

    // Decoración: aparece tras el ensamblado
    guideMat.opacity = 0.13 * decoIn;
    dialNear.material.opacity = dialNear.userData.maxOpacity * decoIn;
    pMat.opacity = (0.36 + 0.06 * Math.sin(t * 0.8)) * decoIn;
    dialNear.rotation.z = -t * 0.04 * motion;

    halos.forEach(function (h) { h.material.opacity = h.userData.op * decoIn; });
    ringMat.opacity = 0.22 * decoIn;
    sMat.opacity = decoIn;
    orbit.rotation.z = t * 0.05 * motion;
    comets.forEach(function (c) {
      var a = t * 0.35 * motion + c.userData.off;
      c.position.set(Math.cos(a) * 6.4, Math.sin(a) * 6.4, 0);
      c.material.opacity = 0.9 * decoIn;
    });
    if (!reduceMotion) updateSparks(dt);
    nuts.forEach(function (m) {
      var u = m.userData;
      m.scale.setScalar(u.s * decoIn);
      if (!reduceMotion) {
        m.rotation.x += u.rx * dt; m.rotation.y += u.ry * dt;
        m.position.y = u.by + Math.sin(t * 0.3 + u.ph) * 0.35;
      }
    });

    // Polvo a la deriva
    if (!reduceMotion) {
      for (var i = 0; i < PCOUNT; i++) {
        pY[i] += pVy[i] * dt;
        if (pY[i] > 10) pY[i] = -10;
        pPos[i * 3] = pX0[i] + Math.sin(t * pSF[i] + pPh[i]) * pSA[i];
        pPos[i * 3 + 1] = pY[i];
      }
      pGeo.attributes.position.needsUpdate = true;
    }
    dust.position.y = currentScrollT * 1.5;

    // Parallax con el puntero (suavizado)
    var kp = 1 - Math.exp(-dt * 3.1);
    px += (mouseX - px) * kp;
    py += (mouseY - py) * kp;

    // Cámara: órbita por scroll + dolly de entrada + parallax
    var aspect = camera.aspect;
    var fit = 1 + Math.max(0, 1.25 - aspect) * 0.8;
    var angle = -0.55 + currentScrollT * 1.0 - (1 - eIntro) * 0.5;
    var radius = (13.4 - currentScrollT * 3.2) * fit * (1 + (1 - eIntro) * 0.35);
    var height = 2.2 - currentScrollT * 3.2;

    camera.position.x = Math.sin(angle) * radius + px * 0.9;
    camera.position.z = Math.cos(angle) * radius;
    camera.position.y = height + Math.sin(t * 0.12) * 0.15 - py * 0.55;
    camera.lookAt(0.25, 0.4 - currentScrollT * 0.5, 0);

    // Balanceo suave de los grupos (a distinta velocidad => profundidad)
    rig.rotation.y = Math.sin(t * 0.08) * 0.06 * motion;
    rig.rotation.x = Math.sin(t * 0.06) * 0.03 * motion;
    var wide = clamp01((aspect - 1.15) / 0.5);
    var lead = 1 - easeOutCubic(clamp01(window.scrollY / (window.innerHeight * 0.9)));
    rig.position.x = 0.25 + wide * 3.1 * lead;
    rig.scale.setScalar(1 - wide * 0.14 * lead);
    rig.position.y = 0.55 + Math.sin(t * 0.4) * 0.08 * motion;

    // Luces vivas
    fill.position.x = Math.sin(t * 0.16) * 8;
    rim.position.z = Math.cos(t * 0.14) * -6;
    glint.position.set(
      Math.sin(t * 0.35) * 7,
      1 + Math.cos(t * 0.27) * 4,
      5 + Math.sin(t * 0.21) * 1.5
    );

    renderer.render(scene, camera);
  }

  var lastAct = performance.now(), lastDraw = 0, lastT = 0, nF = 0, accD = 0, degraded = 0;
  ["scroll", "pointermove", "pointerdown", "touchstart", "touchmove"].forEach(function (ev) {
    window.addEventListener(ev, function () { lastAct = performance.now(); }, { passive: true });
  });
  function degrade() {
    degraded++;
    if (dpr > 1) {
      dpr = Math.max(1, dpr - 0.5);
      renderer.setPixelRatio(dpr);
      renderer.setSize(window.innerWidth, window.innerHeight);
    } else if (renderer.shadowMap.enabled) {
      renderer.shadowMap.enabled = false;
      key.castShadow = false;
      scene.traverse(function (o) {
        if (o.material) [].concat(o.material).forEach(function (m) { m.needsUpdate = true; });
      });
    }
  }
  function animate() {
    if (!running) return;
    requestAnimationFrame(animate);
    if (window.__sceneHold || document.hidden) { lastT = 0; clock.getDelta(); return; }
    var now = performance.now(), idle = isMobile && (now - lastAct) > 2500;
    if (idle && now - lastDraw < 28) return;
    lastDraw = now;
    if (lastT && !idle) {
      accD += now - lastT;
      if (++nF % 90 === 0) {
        if (nF > 120 && accD / 90 > 34 && degraded < 3) degrade();
        accD = 0;
      }
    }
    lastT = idle ? 0 : now;
    try {
      frame();
    } catch (e) {
      running = false;
      if (window.console) console.error("scene.js:", e);
      if (fallback) fallback.classList.add("active");
    }
  }
  animate();

  // ---------------------------------------------------------------------
  // Resize
  // ---------------------------------------------------------------------

  var resizeTimer, lastW = window.innerWidth, lastH = window.innerHeight;
  window.addEventListener("resize", function () {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(function () {
      var nw = window.innerWidth, nh = window.innerHeight;
      if (nw === lastW && Math.abs(nh - lastH) < 120) return;
      lastW = nw; lastH = nh;
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    }, 120);
  });
})();
