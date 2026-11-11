/* 설비실 · 열 교환기 — 대표 장면(교사와 함께 보는 장면). 계약: ARCHITECTURE.md, 색·모양: _ref/art-direction.md
   ① 장치 열기: 앞 덮개가 앞으로 젖혀지며 얇은 칸막이 판이 겹겹이 쌓인 코어가 보인다.
   ② 공기의 길: 덕트 앞면이 벗겨지고, 나가는 실내 공기(빨강)와 들어오는 바깥 공기(파랑)가 서로 다른 통로로 흐른다.
      코어 안 통로는 나감·들어옴·나감·들어옴 순서로 번갈아 있고, 두 흐름의 입자는 한 통로를 같이 쓰지 않는다.
   ③ 열의 길: 작은 주황 입자가 칸막이를 건너 나가는 공기 → 들어오는 공기로 간다. 공기 입자 색이 코어를 지나며 연해진다.
      → ctx.markOperated
   통로(덕트·코어)를 누르면 그 길만 강조된다. ‘열 교환기 없이’를 켜면 들어오는 공기가 찬 채로 들어온다. 숫자는 쓰지 않는다.
   점검용 상태는 내 패널 본문(ctx.ui.body)의 data-hx-* 속성에 적는다(_check/fac_heatexchanger.py). */
(function () {
  'use strict';
  var T = THREE, B = EXP.blocks, V = EXP.viz;

  // ---------- 색(아트 디렉션 §2·§3) ----------
  // outMid·inMid: 코어 가운데 색. 빨강↔파랑을 곧장 섞으면 보라(열화상 램프 색)가 되어, 흐름 쪽 기운이 남은 옅은 색을 거친다
  // (살구는 초록 성분을, 하늘은 파랑을 덜어 둬야 뒤 반쪽 섞임도 연보라를 지나지 않는다 — _check 가 램프 전체를 본다)
  // 중간색은 중간 밝기(카키·청록): 크림·연하늘처럼 밝으면 어두운 코어 통로에서 빈 흰 사각형으로 보이고 열 화살표를 가린다
  var HEX = { warm: '#ff5a3c', cold: '#3c8dff', warmOut: '#8fb8ff', coldIn: '#ff9d85', outMid: '#b39a78', inMid: '#5fa3a0',
    heat: '#ffa726', dim: '#c8ccd0', off: '#8a96a3' };
  var COL = {};
  Object.keys(HEX).forEach(function (k) { COL[k] = new T.Color(HEX[k]); });
  var METAL = 'metal', DARK = '#4a5560', PLATE = '#e8d9b0', HANDLE = '#ffd34d';

  // ---------- 좌표(세계 m). 설비실 x3~7, z-11~-7, 뒷벽 안쪽 면 z=-11 ----------
  var ZD = -10.8;                 // 덕트 가운데 깊이(덕트는 벽에 붙음: z -11 ~ -10.6)
  var ZP = -10.5;                 // 코어 통로 안 공기 입자 깊이
  var ZS = -10.93;                // 길 표시 띠 깊이(덕트 뒤판 바로 앞)
  var DR = 0.2, WT = 0.04;        // 덕트 반폭, 벽 두께
  var CX0 = 4.62, CX1 = 5.93;      // 코어 통로 왼쪽·오른쪽 끝
  var XL = 4.435, XR = 6.115;       // 왼쪽·오른쪽 머리(덮인 분배 상자) 안 세로 줄
  var PASS = { out: [1.51, 0.97], in: [1.24, 0.70] };   // 통로 가운데 높이(위에서부터 나감·들어옴·나감·들어옴)
  var PLATE_Y = [0.54, 0.81, 1.08, 1.35, 1.62];         // 칸막이 판 아래 면(두께 0.05)
  var EYE_ROOM = [3.35, 2.35];    // 실내 공기가 출발하는 곳(흡입구 아래)

  var SPEED = 0.6, HEAT_SPEED = 0.3, AIR_SIZE = 0.16, HEAT_SIZE = 0.07, PER_M = 1.2;

  function pathOut(y) {
    return [[EYE_ROOM[0], EYE_ROOM[1], ZD], [3.35, 3.6, ZD], [XL, 3.6, ZD], [XL, 1.9, ZD], [XL, y, ZP],
      [CX0, y, ZP], [CX1, y, ZP], [XR, y, ZP], [XR, 0.8, ZD], [6.75, 0.8, ZD], [6.75, 3.4, ZD], [6.75, 3.4, -11.6]];
  }
  function pathIn(y) {
    return [[XR, 3.05, -11.6], [XR, 3.05, ZD], [XR, 1.9, ZD], [XR, y, ZP], [CX1, y, ZP], [CX0, y, ZP], [XL, y, ZP],
      [XL, 0.8, ZD], [3.35, 0.8, ZD], [3.35, 0.8, -10.5], [3.35, 0.55, -9.7]];
  }
  // 탭 판정용(앞에서 본 x-y 선분). 덮인 머리 안은 뺀다
  var TAP_LINES = {
    out: [[3.35, 2.2, 3.35, 3.6], [3.35, 3.6, XL, 3.6], [XL, 3.6, XL, 1.9], [CX0, 1.51, CX1, 1.51], [CX0, 0.97, CX1, 0.97],
      [6.4, 0.8, 6.75, 0.8], [6.75, 0.8, 6.75, 3.6]],
    in: [[XR, 3.25, XR, 1.9], [CX1, 1.24, CX0, 1.24], [CX1, 0.70, CX0, 0.70], [4.1, 0.8, 3.35, 0.8], [3.35, 0.8, 3.35, 0.4]]
  };

  // ---------- 작은 도우미 ----------
  function clamp01(v) { return v < 0 ? 0 : v > 1 ? 1 : v; }
  function approach(cur, target, dt, dur) { var st = dt / dur; return cur < target ? Math.min(target, cur + st) : Math.max(target, cur - st); }
  function ease(k) { return k * k * (3 - 2 * k); }

  // 축 정렬 꺾인 덕트(x-y 평면, 벽에 붙음). 앞이 열리는 단면: 뒤판(어두움)·옆벽(금속) + 떼어 낼 앞 덮개(fronts)
  // opt: {capA, capB: 끝 막음, frontSkipB: 끝 쪽 앞 덮개를 이만큼 비움(그 자리에 송풍구)}
  function duct(pts, out, fronts, opt) {
    opt = opt || {};
    var z0 = -11, z1 = -10.6, n = pts.length;
    function box(x0, y0, x1, y1, za, zb, m, list) { list.push({ min: [Math.min(x0, x1), Math.min(y0, y1), za], max: [Math.max(x0, x1), Math.max(y0, y1), zb], mat: m }); }
    for (var i = 0; i < n - 1; i++) {
      var a = pts[i], b = pts[i + 1], hor = a[1] === b[1], sg = hor ? Math.sign(b[0] - a[0]) : Math.sign(b[1] - a[1]);
      var ta = i > 0 ? DR : 0, tb = i < n - 2 ? DR : 0;            // 꺾인 곳은 모서리 칸이 따로 맡는다
      var p0 = (hor ? a[0] : a[1]) + sg * ta, p1 = (hor ? b[0] : b[1]) - sg * tb;
      if ((p1 - p0) * sg <= 0.001) continue;
      var fs = (i === n - 2 && opt.frontSkipB) ? opt.frontSkipB : 0;
      if (hor) {
        var y = a[1];
        box(p0, y - DR, p1, y + DR, z0, z0 + WT, DARK, out);
        box(p0, y + DR - WT, p1, y + DR, z0, z1, METAL, out);
        box(p0, y - DR, p1, y - DR + WT, z0, z1, METAL, out);
        box(p0, y - DR, p1 - sg * fs, y + DR, z1 - WT, z1, METAL, fronts);
      } else {
        var x = a[0];
        box(x - DR, p0, x + DR, p1, z0, z0 + WT, DARK, out);
        box(x - DR, p0, x - DR + WT, p1, z0, z1, METAL, out);
        box(x + DR - WT, p0, x + DR, p1, z0, z1, METAL, out);
        box(x - DR, p0, x + DR, p1 - sg * fs, z1 - WT, z1, METAL, fronts);
      }
    }
    for (var j = 1; j < n - 1; j++) {                               // 모서리 칸: 이어지지 않은 두 면에만 벽
      var P = pts[j], pa = pts[j - 1], pb = pts[j + 1];
      var cx = P[0], cy = P[1], open = {};
      open[pa[0] < cx ? 'l' : pa[0] > cx ? 'r' : pa[1] < cy ? 'd' : 'u'] = 1;
      open[pb[0] < cx ? 'l' : pb[0] > cx ? 'r' : pb[1] < cy ? 'd' : 'u'] = 1;
      box(cx - DR, cy - DR, cx + DR, cy + DR, z0, z0 + WT, DARK, out);
      if (!open.l) box(cx - DR, cy - DR, cx - DR + WT, cy + DR, z0, z1, METAL, out);
      if (!open.r) box(cx + DR - WT, cy - DR, cx + DR, cy + DR, z0, z1, METAL, out);
      if (!open.d) box(cx - DR, cy - DR, cx + DR, cy - DR + WT, z0, z1, METAL, out);
      if (!open.u) box(cx - DR, cy + DR - WT, cx + DR, cy + DR, z0, z1, METAL, out);
      box(cx - DR, cy - DR, cx + DR, cy + DR, z1 - WT, z1, METAL, fronts);
    }
    [['capA', pts[0], pts[1]], ['capB', pts[n - 1], pts[n - 2]]].forEach(function (c) {
      if (!opt[c[0]]) return;
      var e = c[1], o = c[2];
      if (e[1] === o[1]) { var ex = e[0] + (e[0] < o[0] ? 0 : -WT); box(ex, e[1] - DR, ex + WT, e[1] + DR, z0, z1, METAL, out); }
      else { var ey = e[1] + (e[1] < o[1] ? 0 : -WT); box(e[0] - DR, ey, e[0] + DR, ey + WT, z0, z1, METAL, out); }
    });
  }

  // 정점 색 상자 묶음(드로콜 1): 길 표시 띠·화살표. 상자마다 흐름(out/in)과 열 진행도 h(0~1)를 기억해 색을 다시 칠한다
  function ColorBoxes() { this.p = []; this.c = []; this.idx = []; this.meta = []; }
  ColorBoxes.prototype.add = function (min, max, stream, h) {
    var base = this.p.length / 3, p = this.p;
    var x0 = min[0], y0 = min[1], z0 = min[2], x1 = max[0], y1 = max[1], z1 = max[2];
    var F = [ // 면별 네 꼭짓점 + 밝기(앞·윗면 밝게, 나머지 어둡게: 그림자 없이 입체감)
      [[x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1], 1], [[x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0], 0.7],
      [[x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [x0, y1, z0], 1], [[x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1], 0.7],
      [[x1, y0, z1], [x1, y0, z0], [x1, y1, z0], [x1, y1, z1], 0.82], [[x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0], 0.82]];
    for (var f = 0; f < 6; f++) {
      var q = base + f * 4;
      for (var v = 0; v < 4; v++) { p.push(F[f][v][0], F[f][v][1], F[f][v][2]); this.c.push(1, 1, 1); }
      this.idx.push(q, q + 1, q + 2, q, q + 2, q + 3);
      this.meta.push({ v0: q, shade: F[f][4], stream: stream, h: h });
    }
  };
  ColorBoxes.prototype.build = function () {
    var g = new T.BufferGeometry();
    g.setAttribute('position', new T.Float32BufferAttribute(this.p, 3));
    this.colAttr = new T.Float32BufferAttribute(this.c, 3);
    g.setAttribute('color', this.colAttr);
    g.setIndex(this.idx);
    g.computeBoundingSphere();
    return new T.Mesh(g, new T.MeshBasicMaterial({ vertexColors: true }));
  };
  // 띠: 축 정렬 선분 a→b(앞에서 본 평면), 굵기 w, 깊이 z. 모서리가 이어지게 양 끝을 w/2 늘린다
  function stripe(cb, a, b, z, w, stream, h) {
    var hw = w / 2;
    cb.add([Math.min(a[0], b[0]) - hw, Math.min(a[1], b[1]) - hw, z - 0.01], [Math.max(a[0], b[0]) + hw, Math.max(a[1], b[1]) + hw, z + 0.01], stream, h);
  }
  // 픽셀 삼각형 화살촉: tip 위치, 방향 축(ax 0/1/2, sg ±1), 폭 축 cx, 두께 축 dx
  function head(cb, tip, ax, sg, cx, dxs, w, len, th, stream, h) {
    for (var i = 0; i < 4; i++) {
      var mn = tip.slice(), mx = tip.slice(), a0 = -sg * len * (1 - i / 4), a1 = -sg * len * (1 - (i + 1) / 4), hw = w * (1 - i / 4) / 2;
      mn[ax] = tip[ax] + Math.min(a0, a1); mx[ax] = tip[ax] + Math.max(a0, a1);
      mn[cx] = tip[cx] - hw; mx[cx] = tip[cx] + hw;
      mn[dxs] = tip[dxs] - th / 2; mx[dxs] = tip[dxs] + th / 2;
      cb.add(mn, mx, stream, h);
    }
  }

  // 창밖 겨울 풍경(64px 캔버스, 픽셀 보간) + 떨어지는 눈 층(알파 컷아웃)
  function winterTex() {
    var c = document.createElement('canvas'); c.width = c.height = 64;
    var g = c.getContext('2d'), y, i;
    for (y = 0; y < 64; y++) { var k = y / 40; g.fillStyle = 'rgb(' + Math.round(176 + 60 * k) + ',' + Math.round(196 + 44 * k) + ',' + Math.round(214 + 32 * k) + ')'; g.fillRect(0, y, 64, 1); }
    g.fillStyle = '#c9d3dc'; for (i = 0; i < 64; i++) g.fillRect(i, 34 + Math.round(4 * Math.sin(i / 9)), 1, 30);
    g.fillStyle = '#f4f8fb'; for (i = 0; i < 64; i++) g.fillRect(i, 37 + Math.round(3 * Math.sin(i / 7 + 1)), 1, 27);
    g.fillStyle = '#dfe7ee'; [[6, 50, 14], [30, 56, 18], [44, 47, 10]].forEach(function (r) { g.fillRect(r[0], r[1], r[2], 1); });
    [[14, 22, 7], [50, 26, 6]].forEach(function (t) {                              // 눈 덮인 침엽수
      for (var r = 0; r < t[2] * 2; r++) {
        var hw = Math.floor(r / 2) + 1;
        g.fillStyle = r % 4 === 0 ? '#f4f8fb' : '#3f6b4a'; g.fillRect(t[0] - hw, t[1] + r, hw * 2, 1);
      }
      g.fillStyle = '#5b3a1e'; g.fillRect(t[0] - 1, t[1] + t[2] * 2, 2, 3);
    });
    var tx = new T.CanvasTexture(c); tx.magFilter = T.NearestFilter; tx.minFilter = T.NearestFilter; tx.colorSpace = T.SRGBColorSpace;
    return tx;
  }
  function snowTex() {
    var c = document.createElement('canvas'); c.width = 32; c.height = 64;
    var g = c.getContext('2d'), seed = 7;
    function rnd() { seed = (seed * 16807) % 2147483647; return seed / 2147483647; }
    g.fillStyle = '#ffffff';
    for (var i = 0; i < 26; i++) g.fillRect((rnd() * 31) | 0, (rnd() * 63) | 0, 2, 2);
    var tx = new T.CanvasTexture(c); tx.magFilter = T.NearestFilter; tx.minFilter = T.NearestFilter;
    tx.wrapS = tx.wrapT = T.RepeatWrapping; tx.colorSpace = T.SRGBColorSpace;
    return tx;
  }

  var TXT = {
    s0: '겨울에 집 안 공기를 바꿔 주는 장치예요. 덮개를 눌러 속을 열어 보세요.',
    s1: '얇은 칸막이 판이 겹겹이 쌓여 있어요. 이제 공기의 길을 켜 보세요.',
    s2: '나가는 공기와 들어오는 공기가 서로 다른 길로 지나가요. 한 길을 눌러 따라가 보세요.',
    s3: '공기는 섞이지 않고, 열만 칸막이를 건너가요. 열을 주고받아 색이 연해져요.',
    by: '열 교환기가 없으면 찬 바깥 공기가 그대로 들어와요. 실내의 열은 밖으로 나가 버려요.',
    out2: '빨간 길을 따라가 보세요. 따뜻한 실내 공기가 칸막이 사이를 지나 밖으로 나가요.',
    in2: '파란 길을 따라가 보세요. 찬 바깥 공기가 칸막이 사이를 지나 방으로 들어와요.',
    out3: '나가는 공기는 칸막이에 열을 건네고, 덜 따뜻해져서 밖으로 나가요.',
    in3: '들어오는 공기는 칸막이에서 열을 받아, 덜 차가워져서 방으로 들어와요.',
    outBy: '열 교환기가 없으면 따뜻한 공기의 열이 그대로 밖으로 나가요.',
    inBy: '열 교환기가 없으면 들어오는 공기가 차가운 채로 방에 들어와요.'
  };
  var STEP_NAME = ['장치 열기', '공기의 길', '열의 길'];

  EXP.registerFacility({
    id: 'heatexchanger',
    cam: { pos: [5.25, 2.1, -6.75], target: [5.05, 2.1, -10.8] },   // 수평으로 봐서 덕트 세로선이 기울지 않게

    build: function (ctx) {
      var self = this, root = ctx.root, ui = ctx.ui;
      var s = this.s = {
        stage: 0, goal: 0, focus: '', bypass: false,
        cover: 0, ducts: 0, air: 0, heat: 0, mix: 0, dimOut: 0, dimIn: 0, lab: 0,
        peekWait: -1, peekT: -1, tOut: 0, tIn: 0, tHeat: 0, clock: 0, dbgT: 0,
        lastMix: -1, lastDimOut: -1, lastDimIn: -1, by: 0, lastBy: -1
      };
      var inner = new T.Group(); root.add(inner); s.inner = inner;               // 집 안에서만 보이는 것
      var outside = new T.Group(); root.add(outside); s.outside = outside;       // 뒷벽 바깥(북쪽)에서만 보이는 것

      // --- 몸체(재질 3개 = 드로콜 3) ---
      var st = [], fr = [];
      st.push(
        { min: [4.1, 0.3, -11], max: [6.4, 1.9, -10.97], mat: DARK },                 // 속 뒤판
        { min: [4.1, 0.3, -10.97], max: [4.16, 1.9, -10.25], mat: METAL }, { min: [6.34, 0.3, -10.97], max: [6.4, 1.9, -10.25], mat: METAL },
        { min: [4.1, 1.84, -10.97], max: [6.4, 1.9, -10.25], mat: METAL }, { min: [4.1, 0.3, -10.97], max: [6.4, 0.36, -10.25], mat: METAL },
        { min: [4.25, 0, -10.95], max: [4.45, 0.3, -10.6], mat: METAL }, { min: [6.05, 0, -10.95], max: [6.25, 0.3, -10.6], mat: METAL },   // 다리
        { min: [4.25, 0.48, -10.95], max: [CX0, 1.73, -10.35], mat: METAL },          // 왼쪽 머리(분배 상자)
        { min: [CX1, 0.48, -10.95], max: [6.3, 1.73, -10.35], mat: METAL },           // 오른쪽 머리
        { min: [XL - 0.22, 1.9, -11], max: [XL + 0.22, 2.0, -10.56], mat: METAL }, { min: [XR - 0.22, 1.9, -11], max: [XR + 0.22, 2.0, -10.56], mat: METAL },   // 위 이음 고리
        { min: [4.0, 0.58, -11], max: [4.1, 1.02, -10.56], mat: METAL }, { min: [6.4, 0.58, -11], max: [6.5, 1.02, -10.56], mat: METAL }   // 옆 이음 고리
      );
      // 머리 앞면 이음매(덮인 상자임을 보이는 선)
      st.push({ min: [4.25, 1.08, -10.35], max: [CX0, 1.13, -10.33], mat: DARK }, { min: [CX1, 1.08, -10.35], max: [6.3, 1.13, -10.33], mat: DARK });
      // 덕트 넷: 나감(실내 → 장치 → 바깥), 들어옴(바깥 → 장치 → 실내)
      duct([[3.35, 3.4], [3.35, 3.6], [XL, 3.6], [XL, 1.9]], st, fr, {});
      duct([[6.4, 0.8], [6.75, 0.8], [6.75, 3.6]], st, fr, { capB: true });
      duct([[XR, 3.25], [XR, 1.9]], st, fr, { capA: true });
      duct([[4.1, 0.8], [3.15, 0.8]], st, fr, { capB: true, frontSkipB: 0.4 });
      // 실내 흡입구(천장 아래, 아래를 향함)와 실내 송풍구(앞을 향함): 금속 살
      for (var i = 0; i < 5; i++) {
        st.push({ min: [3.17 + i * 0.08, 3.37, -10.98], max: [3.21 + i * 0.08, 3.41, -10.62], mat: METAL });
        st.push({ min: [3.15, 0.62 + i * 0.08, -10.62], max: [3.55, 0.66 + i * 0.08, -10.58], mat: METAL });
      }
      st.push({ min: [3.15, 0.6, -10.64], max: [3.55, 1.0, -10.62], mat: DARK });
      // 덕트가 벽을 지나는 곳의 테(바깥으로 이어짐)
      [[XR, 3.05], [6.75, 3.4]].forEach(function (p) {
        st.push({ min: [p[0] - 0.29, p[1] - 0.29, -11], max: [p[0] + 0.29, p[1] + 0.29, -10.985], mat: METAL });
      });
      // 창틀(창밖은 겨울)
      st.push({ min: [4.79, 2.24, -11], max: [4.85, 3.06, -10.93], mat: METAL }, { min: [5.7, 2.24, -11], max: [5.76, 3.06, -10.93], mat: METAL },
        { min: [4.79, 3.0, -11], max: [5.76, 3.06, -10.93], mat: METAL }, { min: [4.73, 2.2, -11], max: [5.82, 2.27, -10.82], mat: METAL },
        { min: [5.255, 2.27, -11], max: [5.295, 3.0, -10.96], mat: METAL }, { min: [4.85, 2.62, -11], max: [5.7, 2.66, -10.96], mat: METAL });
      var body = B.mesh(st); inner.add(body);
      // 칸막이 판(얇음) ↔ '열 교환기 없이'일 때 두꺼운 회색 벽(통로마다 따로 된 관: 건너갈 얇은 판이 없음)
      var plates = B.mesh(PLATE_Y.map(function (y) { return { min: [CX0, y, -10.9], max: [CX1, y + 0.05, -10.4], mat: PLATE }; }));
      inner.add(plates); s.plates = plates;
      var walls = B.mesh([[0.54, 0.62], [0.78, 0.89], [1.05, 1.16], [1.32, 1.43], [1.59, 1.67]].map(function (r) {
        return { min: [CX0, r[0], -10.9], max: [CX1, r[1], -10.38], mat: HEX.off };
      }));
      inner.add(walls); s.walls = walls; walls.visible = false;
      var fronts = B.mesh(fr); inner.add(fronts); s.fronts = fronts;

      var winMat = new T.MeshBasicMaterial({ map: winterTex() });
      var win = new T.Mesh(new T.PlaneGeometry(0.85, 0.73), winMat); win.position.set(5.275, 2.635, -10.995); inner.add(win);
      s.snowTex = snowTex(); s.snowTex.repeat.set(1.2, 1.05);
      var snow = new T.Mesh(new T.PlaneGeometry(0.85, 0.73), new T.MeshBasicMaterial({ map: s.snowTex, alphaTest: 0.5 }));
      snow.position.set(5.275, 2.635, -10.99); inner.add(snow);

      // --- 앞 덮개(아래 경첩, 앞으로 젖혀짐) ---
      var hinge = new T.Group(); hinge.position.set(0, 0.3, -10.25); inner.add(hinge); s.hinge = hinge;
      hinge.add(B.mesh([
        { min: [4.1, 0, 0], max: [6.4, 1.6, 0.06], mat: METAL },
        { min: [4.2, 0.12, 0.06], max: [6.3, 0.18, 0.09], mat: METAL }, { min: [4.2, 1.42, 0.06], max: [6.3, 1.48, 0.09], mat: METAL }
      ]));
      var handle = B.mesh([{ min: [-0.32, -0.06, 0], max: [0.32, 0.06, 0.1], mat: HANDLE }]);
      handle.position.set(5.25, 1.3, 0.06); hinge.add(handle); s.handle = handle;

      // --- 길 표시(띠·화살촉, 정점 색 드로콜 1) ---
      var cb = new ColorBoxes(), W = 0.06, zc = ZS;
      function line(stream, h, pts) { for (var q = 0; q < pts.length - 1; q++) stripe(cb, pts[q], pts[q + 1], zc, W, stream, h); }
      function chev(stream, h, x, y, ax, sg, w) { head(cb, [x, y, ZS + 0.01], ax, sg, ax === 0 ? 1 : 0, 2, w || 0.3, 0.2, 0.02, stream, h); }   // 덕트 안 폭(0.32)에 가깝게: 입자(0.16) 양옆으로 화살촉이 보여 방향을 읽는다
      line('out', 0, [[3.35, 3.6], [XL, 3.6], [XL, 1.9]]);
      line('out', 1, [[6.4, 0.8], [6.75, 0.8], [6.75, 3.4]]);
      line('in', 0, [[XR, 3.05], [XR, 1.9]]);
      line('in', 1, [[4.1, 0.8], [3.55, 0.8]]);
      // 코어 통로 띠: 흐름 고유색(빨강·파랑)으로 고정(h=-1). 색이 바뀌는 것은 입자뿐이라 같은 높이에서도 두 길이 갈린다
      [[PASS.out, 'out'], [PASS.in, 'in']].forEach(function (pp) {
        pp[0].forEach(function (y) {
          cb.add([CX0, y - 0.02, -10.9], [CX1, y + 0.02, -10.88], pp[1], -1);
          head(cb, [pp[1] === 'out' ? 5.4 : 5.15, y, -10.88], 0, pp[1] === 'out' ? 1 : -1, 1, 2, 0.18, 0.16, 0.02, pp[1], -1);
        });
      });
      chev('out', 0, 3.85, 3.6, 0, 1); chev('out', 0, XL, 2.95, 1, -1); chev('out', 0, XL, 2.25, 1, -1);
      chev('out', 1, 6.75, 1.15, 1, 1); chev('out', 1, 6.75, 1.6, 1, 1); chev('out', 1, 6.75, 2.45, 1, 1); chev('out', 1, 6.75, 3.05, 1, 1);   // 들어오는 덕트 바로 옆이라 ‘위로’를 촘촘히
      chev('in', 0, XR, 2.3, 1, -1);
      chev('in', 1, 3.85, 0.8, 0, -1);
      // 출발·도착 굵은 화살표
      cb.add([3.305, 2.2, -10.84], [3.395, 2.95, -10.76], 'out', 0); head(cb, [3.35, 3.2, ZD], 1, 1, 0, 2, 0.32, 0.25, 0.08, 'out', 0);
      head(cb, [6.75, 3.5, -10.9], 1, 1, 0, 2, 0.34, 0.26, 0.04, 'out', 1);
      head(cb, [XR, 2.8, -10.9], 1, -1, 0, 2, 0.34, 0.26, 0.04, 'in', 0);
      cb.add([3.305, 0.43, -10.45], [3.395, 0.47, -9.85], 'in', 1); head(cb, [3.35, 0.45, -9.6], 2, 1, 0, 1, 0.32, 0.25, 0.04, 'in', 1);
      s.cb = cb; var arrows = cb.build(); inner.add(arrows); s.arrows = arrows; arrows.visible = false;

      // 열의 길: 칸막이를 건너는 가는 주황 화살표(드로콜 1)
      var hmat = new T.MeshBasicMaterial({ color: HEX.heat }), hboxes = [];
      s.heatPaths = [];
      [4.92, 5.275, 5.63].forEach(function (x) {
        [[1.51, 1.24], [0.97, 1.24], [0.97, 0.70]].forEach(function (pr) {   // [나감 통로 → 들어옴 통로]
          s.heatPaths.push([x, pr[0], pr[1]]);
          var sg = pr[1] > pr[0] ? 1 : -1, xa = x + 0.07, tip = pr[1] - sg * 0.02, base = tip - sg * 0.06;
          hboxes.push({ min: [xa - 0.0125, Math.min(pr[0], base), -10.39], max: [xa + 0.0125, Math.max(pr[0], base), -10.37], mat: hmat });
          for (var q = 0; q < 3; q++) {
            var hw = 0.04 * (1 - q / 3), ya = tip - sg * 0.06 * (1 - q / 3), yb = tip - sg * 0.06 * (1 - (q + 1) / 3);
            hboxes.push({ min: [xa - hw, Math.min(ya, yb), -10.39], max: [xa + hw, Math.max(ya, yb), -10.37], mat: hmat });
          }
        });
      });
      var heatArrows = B.mesh(hboxes); inner.add(heatArrows); s.heatArrows = heatArrows; heatArrows.visible = false;

      // --- 입자(InstancedMesh 하나 = 드로콜 1): 나가는 공기 · 들어오는 공기 · 열 ---
      s.paths = [];
      function addPath(stream, pts, phase) {
        var v = pts.map(function (p) { return new T.Vector3(p[0], p[1], p[2]); }), cum = [0], L = 0;
        for (var q = 1; q < v.length; q++) { L += v[q].distanceTo(v[q - 1]); cum.push(L); }
        var ia = stream === 'out' ? 5 : 4;                         // 코어 통로가 시작하는 점 번호
        var n = Math.max(2, Math.round(L * PER_M));
        s.paths.push({ stream: stream, v: v, cum: cum, L: L, dA: cum[ia], dB: cum[ia + 1], n: n, phase: phase });
      }
      addPath('out', pathOut(PASS.out[0]), 0); addPath('out', pathOut(PASS.out[1]), 0.5);
      addPath('in', pathIn(PASS.in[0]), 0); addPath('in', pathIn(PASS.in[1]), 0.5);
      var nAir = 0; s.paths.forEach(function (p) { nAir += p.n; });
      s.nAir = nAir; s.nHeat = s.heatPaths.length * 2;
      var pm = new T.InstancedMesh(new T.BoxGeometry(1, 1, 1), new T.MeshBasicMaterial({ color: '#ffffff' }), nAir + s.nHeat);
      pm.frustumCulled = false;
      for (var q2 = 0; q2 < nAir + s.nHeat; q2++) pm.setColorAt(q2, COL.warm);
      pm.visible = false; inner.add(pm); s.parts = pm;
      s.mtx = new T.Matrix4(); s.tmpV = new T.Vector3(); s.tmpC = new T.Color(); s.tmpC2 = new T.Color();

      // --- 이름표(글자 판 4개) ---
      function tag(text, color, x, y, z, stream) {
        var sp = V.textSprite(text, { height: 0.24, color: color }); sp.position.set(x, y, z); sp.userData.stream = stream;
        sp.userData.base = sp.scale.clone(); sp.visible = false; inner.add(sp); return sp;
      }
      s.tags = [
        tag('실내 공기 나감', '#b8321c', 3.62, 1.95, -10.1, 'out'),
        tag('밖으로', '#2b2b2b', 6.72, 3.78, -10.45, 'out'),
        tag('바깥 공기 들어옴', '#1a5fa8', 5.45, 3.36, -10.4, 'in'),   // 창틀을 가리지 않게 덕트 입구 높이로
        tag('실내로', '#2b2b2b', 3.85, 0.62, -9.75, 'in')
      ];

      // --- 바깥(북쪽 벽 바깥 면 z=-12): 통풍구 두 개와 창 ---
      outside.add(B.mesh([
        { min: [XR - 0.26, 2.79, -12.36], max: [XR + 0.26, 3.31, -12], mat: METAL }, { min: [6.49, 3.14, -12.36], max: [7.01, 3.66, -12], mat: METAL },
        { min: [XR - 0.2, 2.79, -12.37], max: [XR + 0.2, 2.95, -12.36], mat: DARK }, { min: [6.55, 3.14, -12.37], max: [6.95, 3.3, -12.36], mat: DARK },
        { min: [4.85, 2.27, -12.02], max: [5.7, 3.0, -12], mat: DARK },
        { min: [4.79, 2.2, -12.05], max: [5.76, 2.27, -12], mat: METAL }, { min: [4.79, 3.0, -12.05], max: [5.76, 3.06, -12], mat: METAL }
      ]));

      // 충돌: 장치 몸체와 낮게 지나는 덕트
      ctx.addCollider([4.1, 0, -11], [6.4, 1.9, -10.25]);
      ctx.addCollider([3.15, 0.6, -11], [4.1, 1.0, -10.6]);
      ctx.addCollider([6.4, 0.6, -11], [6.95, 3.6, -10.6]);

      // --- 패널 ---
      ui.setInfo(TXT.s0);
      var season = s.season = ui.el('div', null, '겨울 · 바깥에는 눈이 와요');
      season.style.cssText = 'align-self:flex-start;display:inline-block;padding:2px 10px;border:2px solid #2b2b2b;border-radius:999px;font-size:16px;font-weight:700;background:#dcecff';
      var row = ui.row();
      s.btnStep = [1, 2, 3].map(function (k) {
        var b = ui.button('', function () { self.go(ctx, k); }, { parent: row });
        b.style.cssText = 'font-size:clamp(16px,1.6vw,18px);padding:4px 4px;line-height:1.25;white-space:nowrap';   // 1000×600에서도 한 줄
        return b;
      });
      var row2 = ui.row();
      s.btnOut = ui.button('나가는 공기만', function () { self.setFocus(ctx, s.focus === 'out' ? '' : 'out'); }, { parent: row2 });
      s.btnIn = ui.button('들어오는 공기만', function () { self.setFocus(ctx, s.focus === 'in' ? '' : 'in'); }, { parent: row2 });
      var row3 = ui.row();   // 토글과 ‘처음 상태로’를 한 줄에: 1000×600에서 범례까지 스크롤 없이 보이게
      s.tgBypass = ui.toggle('열 교환기 없이', false, function (on) { self.setBypass(ctx, on); }, { parent: row3 });
      s.tgBypass.el.style.flex = '1.6';
      ui.button('처음 상태로', function () { self.reset(ctx); }, { small: true, parent: row3 });
      s.legend = ui.legend([
        { color: HEX.warm, text: '굵은 빨강 — 따뜻한 공기' },
        { color: HEX.cold, text: '굵은 파랑 — 찬 공기' },
        { color: HEX.heat, text: '작은 주황 — 칸막이를 건너는 열' }
      ], '색이 뜻하는 것');
      s.legendHeat = s.legend.lastChild;
      s.legendRows = [s.legend.children[1], s.legend.children[2]];

      // 3D 누르기: 덮개·몸체 = 다음 단계, 길이 보이면 가장 가까운 통로를 강조
      var tapFn = function (hit) { self.tap(ctx, hit); };
      // 통로 탭 판: 그리지 않고(드로콜 0) 누르기만 받는다. 덕트 사이 빈 벽을 눌러도 가장 가까운 통로를 고른다
      var tapPad = new T.Mesh(new T.PlaneGeometry(4, 3.6), new T.MeshBasicMaterial({ visible: false }));
      tapPad.position.set(5.0, 2.1, -10.58); tapPad.visible = false; inner.add(tapPad); s.tapPad = tapPad;
      ctx.onTap(tapPad, tapFn); ctx.onTap(body, tapFn); ctx.onTap(plates, tapFn); ctx.onTap(walls, tapFn); ctx.onTap(fronts, tapFn); ctx.onTap(hinge, tapFn); ctx.onTap(arrows, tapFn);
      this.syncUI(ctx);
    },

    enter: function (ctx) {
      var s = this.s;
      if (s.stage === 0) { s.peekWait = 0.3; s.peekT = -1; }      // 카메라가 날아오는 동안 덮개가 들썩인다(화면 변화가 먼저)
      var hint = document.getElementById('chipHint');             // 코어 첫 안내 칩이 위쪽 덕트를 가리므로 시설 모드 동안 숨김(solar·lighting 과 같은 방식)
      s.hintWas = !!hint && !hint.hidden; if (hint) hint.hidden = true;
      this.syncUI(ctx);
    },

    exit: function () {
      var s = this.s, hint = document.getElementById('chipHint');
      s.peekWait = -1;
      if (hint && s.hintWas) hint.hidden = false;
      s.hintWas = false;
    },

    // 단계 k(1~3)로 간다. 앞 단계가 안 되어 있으면 차례로 지나간다. 이미 지난 단계를 누르면 그 장면으로 되돌아가 본다
    go: function (ctx, k) {
      var s = this.s;
      if (k < s.stage) { s.goal = s.stage = k; if (k < 3) s.bypass = false; }
      else if (k === s.stage) { s.focus = ''; if (k === 3) s.bypass = false; }
      else s.goal = k;
      if (s.stage < s.goal) this.advance(ctx);
      this.syncUI(ctx);
    },

    advance: function (ctx) {   // goal 쪽으로 한 단계. 이어지는 단계는 update 에서 앞 장면이 거의 끝난 뒤 넘어간다
      var s = this.s; if (s.stage >= s.goal) return;
      s.stage++; s.peekWait = -1;
      if (s.stage === 3) {
        ctx.markOperated({ delay: 1400 });   // 칸막이를 건너는 열과 바뀐 색이 보일 때 썸네일
      }
      this.syncUI(ctx);
    },

    setFocus: function (ctx, f) {
      var s = this.s; s.focus = f;
      if (f && s.stage < 2) { s.goal = Math.max(s.goal, 2); this.advance(ctx); }
      this.syncUI(ctx);
    },

    setBypass: function (ctx, on) { this.s.bypass = on; this.syncUI(ctx); },

    reset: function (ctx) {
      var s = this.s;
      s.stage = s.goal = 0; s.focus = ''; s.bypass = false;
      this.syncUI(ctx);
    },

    tap: function (ctx, hit) {
      var s = this.s;
      if (s.stage < 2) { this.go(ctx, s.stage + 1); return; }
      var p = hit.point, best = '', bd = 0.45;   // 손가락 굵기(1000×600에서도). 가장 가까운 통로를 고르므로 넓혀도 섞이지 않음
      ['out', 'in'].forEach(function (k) {
        TAP_LINES[k].forEach(function (l) {
          var dx = l[2] - l[0], dy = l[3] - l[1], L2 = dx * dx + dy * dy || 1e-6;
          var u = clamp01(((p.x - l[0]) * dx + (p.y - l[1]) * dy) / L2), ex = l[0] + u * dx - p.x, ey = l[1] + u * dy - p.y;
          var d = Math.sqrt(ex * ex + ey * ey); if (d < bd) { bd = d; best = k; }
        });
      });
      this.setFocus(ctx, best && best !== s.focus ? best : '');
    },

    syncUI: function (ctx) {
      var s = this.s;
      s.btnStep.forEach(function (b, i) {
        var k = i + 1, done = s.stage >= k;
        b.textContent = (done ? '✓ ' : ['①', '②', '③'][i] + ' ') + STEP_NAME[i];
        b.classList.toggle('primary', k === s.stage + 1);
        b.style.background = done ? '#dff7e5' : '';
      });
      [[s.btnOut, 'out', '나가는 공기만'], [s.btnIn, 'in', '들어오는 공기만']].forEach(function (x) {   // ‘한 길만 따라가기’ 이름표 대신 ‘만’
        var on = s.focus === x[1]; x[0].classList.toggle('on', on); x[0].textContent = (on ? '✓ ' : '') + x[2];
      });
      s.season.hidden = s.stage >= 2;   // 1000×600에서 범례·‘처음 상태로’ 자리를 내준다(창밖 눈은 장면에 계속 보임)
      s.tgBypass.set(s.bypass); s.tgBypass.el.hidden = s.stage < 3;
      s.legend.hidden = s.stage < 2; s.legendHeat.hidden = s.stage < 3 || s.bypass;
      var lc = s.stage === 3 && !s.bypass;   // 열의 길: 연한 색이 '덜 따뜻함·덜 차가움'임을 범례에서 짚는다
      // 열의 길에서는 두 공기 행을 ‘연한 색’ 한 행으로 합쳐 범례를 2행으로 둔다
      [['warm', 'warmOut', '굵은 빨강 — 따뜻한 공기', '연한 색 — 덜 따뜻해진·덜 차가워진 공기'],
        ['cold', 'coldIn', '굵은 파랑 — 찬 공기', '']].forEach(function (x, i) {
        var r = s.legendRows[i];
        r.firstChild.style.background = lc ? 'linear-gradient(90deg,' + HEX.warmOut + ' 50%,' + HEX.coldIn + ' 50%)' : HEX[x[0]];
        r.lastChild.textContent = lc ? x[3] : x[2];
        if (i === 1) r.hidden = lc;
      });
      var t;
      if (s.stage < 2) t = s.stage === 0 ? TXT.s0 : TXT.s1;
      else if (s.focus) t = TXT[s.focus + (s.stage === 3 ? (s.bypass ? 'By' : '3') : '2')];
      else t = s.stage === 3 ? (s.bypass ? TXT.by : TXT.s3) : TXT.s2;
      ctx.ui.setInfo(t);
      ctx.showModelLabel(s.stage >= 2);
      var d = ctx.ui.body.dataset;
      d.hxStage = s.stage; d.hxFocus = s.focus; d.hxBypass = s.bypass ? 1 : 0;
    },

    // h(0~1, 코어를 지난 정도)와 지금 상태로 흐름 색을 c 에 담는다
    color: function (stream, h, c) {
      var s = this.s, k = h < 0 ? 0 : h * s.mix, o = stream === 'out';
      var c0 = o ? COL.warm : COL.cold, cm = o ? COL.outMid : COL.inMid, c1 = o ? COL.warmOut : COL.coldIn;
      if (k < 0.5) c.copy(c0).lerp(cm, k * 2); else c.copy(cm).lerp(c1, k * 2 - 1);
      if (h < 0 && s.by > 0) c.lerp(COL.off, 0.75 * s.by);        // 코어 띠: 장치가 없으면 회색
      var dm = o ? s.dimOut : s.dimIn;
      if (dm > 0) c.lerp(COL.dim, dm);
      return c;
    },

    update: function (dt, ctx) {
      var s = this.s, cp = ctx.camera.position, i, j;
      // 집 안(1층)에 있을 때만 장치 안쪽을 그린다(다른 곳에서 드로콜을 쓰지 않게)
      var inHouse = ctx.active || (cp.x > -8 && cp.x < 8 && cp.z > -12 && cp.z < 0 && cp.y < 4.2);
      s.inner.visible = inHouse; s.outside.visible = cp.z < -12;
      if (!inHouse) return;
      s.clock += dt;

      // 단계 목표값 → 부드럽게 따라가기
      if (s.stage < s.goal) {
        var ready = s.stage === 0 || (s.stage === 1 && s.cover > 0.85) || (s.stage === 2 && s.air > 0.85);
        if (ready) this.advance(ctx);
      }
      s.cover = approach(s.cover, s.stage >= 1 ? 1 : 0, dt, 0.6);
      s.ducts = approach(s.ducts, s.stage >= 2 && s.cover > 0.6 ? 1 : 0, dt, 0.35);
      s.air = approach(s.air, s.stage >= 2 && s.ducts > 0.5 ? 1 : 0, dt, 0.35);
      s.lab = approach(s.lab, s.stage >= 2 ? 1 : 0, dt, 0.3);
      var heatOn = s.stage === 3 && !s.bypass;
      s.by = approach(s.by, s.stage === 3 && s.bypass ? 1 : 0, dt, 0.4);
      s.walls.visible = s.by > 0.5; s.plates.visible = !s.walls.visible;
      s.heat = approach(s.heat, heatOn && s.air > 0.9 ? 1 : 0, dt, 0.4);
      s.mix = approach(s.mix, heatOn && s.air > 0.9 ? 1 : 0, dt, 0.6);
      s.dimOut = approach(s.dimOut, s.focus === 'in' ? 1 : 0, dt, 0.3);
      s.dimIn = approach(s.dimIn, s.focus === 'out' ? 1 : 0, dt, 0.3);

      // 덮개: 들썩임(들어올 때) 또는 열림
      var ang = ease(s.cover) * 1.72;
      if (s.peekWait >= 0) { s.peekWait -= dt; if (s.peekWait < 0) s.peekT = 0; }
      if (s.peekT >= 0) {
        s.peekT += dt; var pk = s.peekT / 1.3;           // 두 번 들썩(카메라가 도착한 뒤까지)
        if (pk >= 1) { s.peekT = -1; s.peeked = true; } else if (s.stage === 0) ang = Math.max(ang, Math.abs(Math.sin(pk * Math.PI * 2)) * 0.3);
      }
      s.hinge.rotation.x = ang;
      var pulse = 1 + 0.06 * (1 - Math.cos(s.clock * Math.PI * 2 / 1.4));
      s.handle.scale.setScalar(s.stage === 0 ? pulse : 1);
      s.fronts.position.z = ease(s.ducts) * 0.35; s.fronts.visible = s.ducts < 0.98;
      s.snowTex.offset.y += dt * 0.09;

      s.arrows.visible = s.air > 0.02; s.tapPad.visible = s.stage >= 2 && s.air > 0.5;
      s.heatArrows.visible = s.heat > 0.5;
      for (i = 0; i < s.tags.length; i++) {
        var lb = s.tags[i], dimL = lb.userData.stream === 'out' ? s.dimOut : s.dimIn;
        lb.visible = s.lab > 0.02;
        lb.scale.copy(lb.userData.base).multiplyScalar(0.6 + 0.4 * ease(s.lab));
        lb.material.color.setRGB(1 - 0.25 * dimL, 1 - 0.25 * dimL, 1 - 0.25 * dimL);
      }
      // 길 표시 색: 상태가 바뀔 때만 다시 칠한다
      if (Math.abs(s.mix - s.lastMix) > 1e-3 || Math.abs(s.dimOut - s.lastDimOut) > 1e-3 || Math.abs(s.dimIn - s.lastDimIn) > 1e-3 || Math.abs(s.by - s.lastBy) > 1e-3) {
        s.lastMix = s.mix; s.lastDimOut = s.dimOut; s.lastDimIn = s.dimIn; s.lastBy = s.by;
        var arr = s.cb.colAttr.array, c = s.tmpC;
        for (i = 0; i < s.cb.meta.length; i++) {
          var m = s.cb.meta[i]; this.color(m.stream, m.h, c);
          for (j = 0; j < 4; j++) { var o = (m.v0 + j) * 3; arr[o] = c.r * m.shade; arr[o + 1] = c.g * m.shade; arr[o + 2] = c.b * m.shade; }
        }
        s.cb.colAttr.needsUpdate = true;
      }

      // 입자
      var pm = s.parts;
      pm.visible = s.air > 0.02;
      if (pm.visible) {
        s.tOut += dt * SPEED * (1 - 0.5 * s.dimOut); s.tIn += dt * SPEED * (1 - 0.5 * s.dimIn); s.tHeat += dt * HEAT_SPEED;
        var n = 0, mtx = s.mtx, v = s.tmpV, col = s.tmpC2;
        for (i = 0; i < s.paths.length; i++) {
          var P = s.paths[i], tt = P.stream === 'out' ? s.tOut : s.tIn;
          var foc = s.focus === P.stream ? pulse : 1;
          for (j = 0; j < P.n; j++) {
            var d = ((j + P.phase) / P.n * P.L + tt) % P.L;
            var seg = 1; while (seg < P.cum.length - 1 && P.cum[seg] < d) seg++;
            var a = P.v[seg - 1], b = P.v[seg], kk = (d - P.cum[seg - 1]) / Math.max(1e-6, P.cum[seg] - P.cum[seg - 1]);
            v.lerpVectors(a, b, kk);
            var sc = AIR_SIZE * ease(s.air) * foc * Math.min(1, d / 0.3, (P.L - d) / 0.3);
            mtx.makeScale(sc, sc, sc); mtx.setPosition(v); pm.setMatrixAt(n, mtx);
            pm.setColorAt(n, this.color(P.stream, clamp01((d - P.dA) / (P.dB - P.dA)), col));
            n++;
          }
        }
        var hs = HEAT_SIZE * ease(s.heat);
        for (i = 0; i < s.heatPaths.length; i++) {
          var H = s.heatPaths[i], len = Math.abs(H[2] - H[1]);
          for (j = 0; j < 2; j++) {
            var dh = ((j / 2) * len + s.tHeat + i * 0.071) % len;
            var y = H[1] + (H[2] > H[1] ? dh : -dh), hsc = hs * Math.min(1, dh / 0.05, (len - dh) / 0.05);
            mtx.makeScale(hsc, hsc, hsc); mtx.setPosition(H[0], y, -10.4); pm.setMatrixAt(n, mtx);
            pm.setColorAt(n, COL.heat); n++;
          }
        }
        pm.count = s.heat > 0.01 ? n : s.nAir;
        pm.instanceMatrix.needsUpdate = true; pm.instanceColor.needsUpdate = true;
      }

      if (ctx.active) { s.dbgT -= dt; if (s.dbgT <= 0) { s.dbgT = 0.25; this.debug(ctx); } }
    },

    // 점검용: 지금 상태·화면 좌표를 내 패널 data-hx-* 에 적는다(_check/fac_heatexchanger.py 가 읽음)
    debug: function (ctx) {
      var s = this.s, d = ctx.ui.body.dataset, cam = ctx.camera, v = s.tmpV, c = s.tmpC;
      function scr(x, y, z) { v.set(x, y, z).project(cam); return Math.round((v.x + 1) / 2 * innerWidth) + ',' + Math.round((1 - v.y) / 2 * innerHeight); }
      d.hxStage = s.stage; d.hxCover = s.cover.toFixed(2); d.hxDucts = s.ducts.toFixed(2); d.hxAir = s.air.toFixed(2);
      d.hxBy = s.by.toFixed(2); d.hxWalls = s.walls.visible ? 1 : 0; d.hxCoreOut = '#' + this.color('out', -1, c).getHexString();
      d.hxMidOut = '#' + this.color('out', 0.5, c).getHexString(); d.hxMidIn = '#' + this.color('in', 0.5, c).getHexString();
      d.hxProbeCoreOut = scr(4.75, PASS.out[0], -10.87); d.hxProbeCoreIn = scr(4.75, PASS.in[0], -10.87);
      d.hxHeat = s.heat.toFixed(2); d.hxMix = s.mix.toFixed(2); d.hxFocus = s.focus; d.hxBypass = s.bypass ? 1 : 0;
      d.hxPeeked = s.peeked ? 1 : 0;
      var ramp = [];
      for (var q = 0; q <= 20; q++) ramp.push('#' + this.color('out', q / 20, c).getHexString(), '#' + this.color('in', q / 20, c).getHexString());
      d.hxRamp = ramp.join(' ');
      d.hxInEnd = '#' + this.color('in', 1, c).getHexString(); d.hxOutEnd = '#' + this.color('out', 1, c).getHexString();
      d.hxInStart = '#' + this.color('in', 0, c).getHexString(); d.hxOutStart = '#' + this.color('out', 0, c).getHexString();
      d.hxTapCover = scr(5.25, 1.2, -10.2); d.hxTapOut = scr(XL, 2.75, -10.9); d.hxTapIn = scr(XR, 2.75, -10.9);
      d.hxProbeIn = scr(3.82, 0.8, ZS + 0.01); d.hxProbeOut = scr(6.75, 1.9, ZS + 0.01); d.hxProbeInStart = scr(XR, 2.62, ZS + 0.01);
      var calls = 0, tris = 0;
      ctx.root.traverseVisible(function (o) {
        if (o.isSprite) { calls++; tris += 2; }
        else if (o.isMesh && o.material.visible !== false) {
          var g = o.geometry, t = (g.index ? g.index.count : g.attributes.position.count) / 3;
          calls++; tris += o.isInstancedMesh ? t * o.count : t;
        }
      });
      d.hxCalls = calls; d.hxTris = Math.round(tris);
    }
  });
})();
