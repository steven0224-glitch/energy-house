/* 블록(복셀) 그래픽: 캔버스 픽셀 텍스처 + 상자 목록을 재질별로 병합한 메시.
   EXP.blocks.mesh(boxes) 하나로 세계와 시설 오브젝트를 모두 만든다. */
(function () {
  'use strict';
  var EXP = window.EXP = window.EXP || {};
  var T = THREE;

  var seed = 20261112;
  function rnd() { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; }
  function clamp(v) { return Math.max(0, Math.min(255, Math.round(v))); }
  function hex(c) { return [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16)]; }
  function px(g, x, y, col, j) {
    var rgb = hex(col), k = 1 + (rnd() * 2 - 1) * j;
    g.fillStyle = 'rgb(' + clamp(rgb[0] * k) + ',' + clamp(rgb[1] * k) + ',' + clamp(rgb[2] * k) + ')';
    g.fillRect(x, y, 1, 1);
  }
  function noise(g, col, j, x0, y0, w, h) {
    x0 = x0 || 0; y0 = y0 || 0; w = w || 16; h = h || 16;
    for (var y = y0; y < y0 + h; y++) for (var x = x0; x < x0 + w; x++) px(g, x, y, col, j);
  }
  function specks(g, col, n) { for (var i = 0; i < n; i++) px(g, (rnd() * 16) | 0, (rnd() * 16) | 0, col, 0.08); }
  function edge(g, col) { g.fillStyle = col; g.fillRect(0, 0, 16, 1); g.fillRect(0, 0, 1, 16); }

  function canvasTex(draw) {
    var c = document.createElement('canvas'); c.width = c.height = 16;
    var g = c.getContext('2d'); draw(g);
    var t = new T.CanvasTexture(c);
    t.magFilter = T.NearestFilter; t.minFilter = T.NearestMipmapLinearFilter;
    t.wrapS = t.wrapT = T.RepeatWrapping; t.colorSpace = T.SRGBColorSpace;
    return t;
  }

  var PAINT = {
    grass: function (g) { noise(g, '#6aa84a', 0.07); specks(g, '#5c9a40', 9); specks(g, '#7cb85a', 5); },
    grassSide: function (g) {
      noise(g, '#8a5a35', 0.13); specks(g, '#6b4426', 14);
      for (var x = 0; x < 16; x++) { var h = 3 + (rnd() < 0.45 ? 1 : 0) + (rnd() < 0.2 ? 1 : 0); noise(g, '#6aa84a', 0.07, x, 0, 1, h); }
    },
    dirt: function (g) { noise(g, '#8a5a35', 0.15); specks(g, '#6b4426', 22); specks(g, '#a06d44', 10); },
    soil: function (g) { noise(g, '#5a3b22', 0.15); specks(g, '#3f2817', 20); },
    stone: function (g) {
      noise(g, '#9a958c', 0.05); specks(g, '#847f76', 10); specks(g, '#aeaa9f', 6); edge(g, '#817c73');
    },
    // 세계 전용(코어가 지붕 띠·옥상 바닥에 배정): 회색 한 덩어리로 보이지 않게 나눈 색
    rooftile: function (g) {
      for (var b = 0; b < 2; b++) {
        noise(g, b ? '#ad4f37' : '#b5553c', 0.05, 0, b * 8, 16, 8);
        g.fillStyle = '#8c3f2b'; g.fillRect(0, b * 8 + 7, 16, 1); g.fillRect((b * 4 + 3) % 8, b * 8, 1, 7); g.fillRect((b * 4 + 3) % 8 + 8, b * 8, 1, 7);
        g.fillStyle = '#c96a50'; g.fillRect(0, b * 8, 16, 1);
      }
    },
    roofdeck: function (g) { noise(g, '#cfc9bb', 0.03); specks(g, '#c2bcad', 6); edge(g, '#b9b3a4'); },
    plaster: function (g) { noise(g, '#efe6d2', 0.035); edge(g, '#d4c8ae'); },
    plank: function (g) {
      for (var b = 0; b < 4; b++) {
        var base = ['#b8864f', '#ae7c46', '#c08f58', '#b08049'][b];
        noise(g, base, 0.06, 0, b * 4, 16, 4);
        g.fillStyle = '#7d5530'; g.fillRect(0, b * 4, 16, 1);
        g.fillRect(((b * 7 + 3) % 16), b * 4, 1, 4);
      }
    },
    darkwood: function (g) {
      for (var b = 0; b < 4; b++) {
        noise(g, b % 2 ? '#5b3a1e' : '#653f21', 0.08, 0, b * 4, 16, 4);
        g.fillStyle = '#3e2712'; g.fillRect(0, b * 4, 16, 1);
      }
    },
    log: function (g) {
      for (var x = 0; x < 16; x++) noise(g, x % 4 === 0 ? '#5a3c20' : '#6e4b2a', 0.12, x, 0, 1, 16);
    },
    concrete: function (g) { noise(g, '#b9b9b4', 0.06); specks(g, '#a5a5a0', 10); edge(g, '#a0a09b'); },
    tile: function (g) {
      for (var y = 0; y < 2; y++) for (var x = 0; x < 2; x++) noise(g, (x + y) % 2 ? '#dfe8ee' : '#f4f4f0', 0.03, x * 8, y * 8, 8, 8);
      g.fillStyle = '#c3c3be'; g.fillRect(0, 0, 16, 1); g.fillRect(0, 8, 16, 1); g.fillRect(0, 0, 1, 16); g.fillRect(8, 0, 1, 16);
    },
    glass: function (g) {
      g.clearRect(0, 0, 16, 16);
      g.fillStyle = 'rgba(200,235,255,0.28)'; g.fillRect(0, 0, 16, 16);
      g.fillStyle = 'rgba(255,255,255,0.9)'; g.fillRect(0, 0, 16, 1); g.fillRect(0, 15, 16, 1); g.fillRect(0, 0, 1, 16); g.fillRect(15, 0, 1, 16);
      g.fillStyle = 'rgba(255,255,255,0.7)'; for (var i = 0; i < 4; i++) g.fillRect(3 + i, 6 - i, 1, 1);
    },
    leaves: function (g) { noise(g, '#3f8a2e', 0.2); specks(g, '#2e6b20', 30); specks(g, '#5aa83f', 12); },
    water: function (g) { noise(g, '#3d8fe0', 0.08); specks(g, '#7ab8f0', 14); },
    metal: function (g) { noise(g, '#c4cad0', 0.05); g.fillStyle = '#e6eaee'; g.fillRect(0, 2, 16, 1); edge(g, '#9aa1a8'); },
    tint: function (g) { noise(g, '#ffffff', 0.06); }
  };

  var texCache = {}, matCache = {};
  function tex(name) { return texCache[name] || (texCache[name] = canvasTex(PAINT[name])); }

  /* 재질 이름(PAINT 키) 또는 '#rrggbb'(픽셀 노이즈 입힌 단색) → 공유 재질. 공유이므로 색을 바꾸지 말 것. */
  function mat(name) {
    if (name && name.isMaterial) return name;
    if (matCache[name]) return matCache[name];
    var m;
    if (typeof name === 'string' && name.charAt(0) === '#') m = new T.MeshLambertMaterial({ color: name, map: tex('tint') });
    else if (name === 'glass') m = new T.MeshLambertMaterial({ map: tex('glass'), transparent: true, depthWrite: false, side: T.DoubleSide });
    else if (name === 'water') m = new T.MeshLambertMaterial({ map: tex('water'), transparent: true, opacity: 0.85 });
    else if (PAINT[name]) m = new T.MeshLambertMaterial({ map: tex(name) });
    else { console.warn('[blocks] 알 수 없는 재질', name); m = new T.MeshLambertMaterial({ color: '#ff00ff' }); }
    return (matCache[name] = m);
  }

  // 면: 법선, U·V 방향(U×V=법선), 시작 꼭짓점, 크기. UV = 좌표·U, 좌표·V (1m = 텍스처 1장)
  var FACES = [
    { k: 'side', n: [1, 0, 0], u: [0, 0, -1], v: [0, 1, 0], o: function (a, b) { return [b[0], a[1], b[2]]; }, du: function (a, b) { return b[2] - a[2]; }, dv: function (a, b) { return b[1] - a[1]; } },
    { k: 'side', n: [-1, 0, 0], u: [0, 0, 1], v: [0, 1, 0], o: function (a) { return [a[0], a[1], a[2]]; }, du: function (a, b) { return b[2] - a[2]; }, dv: function (a, b) { return b[1] - a[1]; } },
    { k: 'side', n: [0, 0, 1], u: [1, 0, 0], v: [0, 1, 0], o: function (a, b) { return [a[0], a[1], b[2]]; }, du: function (a, b) { return b[0] - a[0]; }, dv: function (a, b) { return b[1] - a[1]; } },
    { k: 'side', n: [0, 0, -1], u: [-1, 0, 0], v: [0, 1, 0], o: function (a, b) { return [b[0], a[1], a[2]]; }, du: function (a, b) { return b[0] - a[0]; }, dv: function (a, b) { return b[1] - a[1]; } },
    { k: 'top', n: [0, 1, 0], u: [1, 0, 0], v: [0, 0, -1], o: function (a, b) { return [a[0], b[1], b[2]]; }, du: function (a, b) { return b[0] - a[0]; }, dv: function (a, b) { return b[2] - a[2]; } },
    { k: 'bottom', n: [0, -1, 0], u: [1, 0, 0], v: [0, 0, 1], o: function (a) { return [a[0], a[1], a[2]]; }, du: function (a, b) { return b[0] - a[0]; }, dv: function (a, b) { return b[2] - a[2]; } }
  ];
  function dot(p, d) { return p[0] * d[0] + p[1] * d[1] + p[2] * d[2]; }

  /* boxes: [{min:[x,y,z], max:[x,y,z], mat: 이름|'#hex'|THREE.Material|{top,side,bottom}, uv?: 1m당 텍스처 반복(기본 1)}]
     반환: THREE.Group (재질 하나당 메시 하나 → 드로콜 최소). */
  function mesh(boxes) {
    var buckets = {}, order = [];
    boxes.forEach(function (b) {
      var a = b.min, c = b.max, s = b.uv || 1, spec = b.mat || 'stone';
      FACES.forEach(function (f) {
        var mname = (spec && !spec.isMaterial && typeof spec === 'object') ? (spec[f.k] || spec.side || 'stone') : spec;
        var m = mat(mname), key = m.uuid;
        var bk = buckets[key];
        if (!bk) { bk = buckets[key] = { m: m, p: [], n: [], t: [] }; order.push(key); }
        var o = f.o(a, c), du = f.du(a, c), dv = f.dv(a, c);
        if (du <= 0 || dv <= 0) return;
        var p0 = o,
          p1 = [o[0] + f.u[0] * du, o[1] + f.u[1] * du, o[2] + f.u[2] * du],
          p2 = [p1[0] + f.v[0] * dv, p1[1] + f.v[1] * dv, p1[2] + f.v[2] * dv],
          p3 = [o[0] + f.v[0] * dv, o[1] + f.v[1] * dv, o[2] + f.v[2] * dv];
        [p0, p1, p2, p0, p2, p3].forEach(function (p) {
          bk.p.push(p[0], p[1], p[2]); bk.n.push(f.n[0], f.n[1], f.n[2]);
          bk.t.push(dot(p, f.u) * s, dot(p, f.v) * s);
        });
      });
    });
    var g = new T.Group();
    order.forEach(function (key) {
      var bk = buckets[key], geo = new T.BufferGeometry();
      geo.setAttribute('position', new T.Float32BufferAttribute(bk.p, 3));
      geo.setAttribute('normal', new T.Float32BufferAttribute(bk.n, 3));
      geo.setAttribute('uv', new T.Float32BufferAttribute(bk.t, 2));
      geo.computeBoundingSphere();
      var me = new T.Mesh(geo, bk.m);
      if (bk.m.transparent) me.renderOrder = 2;
      g.add(me);
    });
    return g;
  }

  /* 바닥 중심이 원점인 상자 하나(Group). 놓을 때 .position.set(x, 바닥y, z). */
  function box(w, h, d, m, uv) { return mesh([{ min: [-w / 2, 0, -d / 2], max: [w / 2, h, d / 2], mat: m, uv: uv }]); }

  EXP.blocks = { mesh: mesh, box: box, mat: mat, tex: tex, names: Object.keys(PAINT) };
})();
