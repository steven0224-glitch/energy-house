/* 주방 · 알루미늄 캔 — 빈 캔을 분리배출하고 재활용 흐름을 본다(ARCHITECTURE.md 계약).
   조작: 조리대의 빈 캔을 끌어 분리배출함 칸 위에 놓는다(칸을 눌러도, ‘캔류에 넣기’ 버튼을 눌러도 같다).
   틀린 칸이면 캔이 부드럽게 되돌아오고 한 문장 힌트. 캔류 칸이면 ① 수거한 캔 → ② 녹여 만든 알루미늄 재료 → ③ 새 금속 제품이
   모형 판 위에 차례로 나타나고, 바닥의 ‘새로 캐낼 광석’ 수레 더미가 줄어든다. 수치는 쓰지 않는다(상대 막대 + 말). */
(function () {
  'use strict';
  var T = THREE, B = EXP.blocks, V = EXP.viz;
  var TOP = 0.9, TRAY = 0.94, LIFT = 1.08;       // 조리대 윗면, 모형 판 윗면, 끌 때 캔 높이
  var BZ0 = -10.15, BZ1 = -9.5, BZC = -9.82, BH = 0.7; // 분리배출함(바닥, 조리대 앞)
  var BINS = [
    { name: '종이', x0: -1.95, x1: -1.35, bg: '#c8902e', icon: 'paper' },
    { name: '캔류', x0: -1.3, x1: -0.7, bg: '#d9483b', icon: 'can', ok: true },
    { name: '플라스틱', x0: -0.65, x1: -0.05, bg: '#2f7fd6', icon: 'bottle' }
  ];
  var OK = 1, REST = [-0.75, TOP, -10.62];      // 캔류 칸 번호, 빈 캔이 놓인 자리
  var SX = [-0.05, 0.74, 1.6], SZ = -10.33;      // 모형 판 ①②③ 가운데 x, 흐름이 지나는 판 앞쪽 z
  var BALE_TOP = TRAY + 0.32, ORE_AFTER = 0.55;
  var INK = '#2b2b2b', ALU = '#d5dbe1', GREEN = '#1f9e45';
  var FONT = 'bold 21px "Apple SD Gothic Neo","Malgun Gothic","Noto Sans KR",sans-serif';
  var CAPS = ['수거한 캔', '녹여 만든 알루미늄 재료', '새 금속 제품'];
  var DOT = 'width:30px;height:30px;border-radius:50%;border:3px solid #2b2b2b;font-size:15px;font-weight:800;display:flex;align-items:center;justify-content:center;flex:none;';
  var INFO0 = '빈 캔을 끌어서 알맞은 분리배출 칸에 넣어 보세요.';

  function mid(b) { return (b.x0 + b.x1) / 2; }
  function clamp01(k) { return Math.max(0, Math.min(1, k)); }
  function ease(k) { k = clamp01(k); return k * k * (3 - 2 * k); }
  function arc(out, a, b, k, h) { out.lerpVectors(a, b, ease(k)); out.y += Math.sin(Math.PI * clamp01(k)) * h; }
  function pop(o, k) { // 등장: 0.35초 동안 크기 0.6→1(끝에서 감속)
    o.visible = k >= 0;
    if (o.visible) { var e = clamp01(k / 0.35); o.scale.setScalar(0.6 + 0.4 * (1 - (1 - e) * (1 - e) * (1 - e))); }
  }

  /* ---------- 16px 텍스처 ---------- */
  function tex16(draw) {
    var c = document.createElement('canvas'); c.width = c.height = 16; draw(c.getContext('2d'));
    var t = new T.CanvasTexture(c);
    t.magFilter = T.NearestFilter; t.minFilter = T.NearestMipmapLinearFilter;
    t.wrapS = t.wrapT = T.RepeatWrapping; t.colorSpace = T.SRGBColorSpace;
    return t;
  }
  function band(g, y0, y1, col) { g.fillStyle = col; g.fillRect(0, y0, 16, y1 - y0); }
  // 캔: 옆면 V 0~1 = 캔 높이(uv 2.5). 가운데 줄만 빨간 띠라서 윗면(V −0.3~0.3)은 은색으로 남는다.
  function canTex() {
    return tex16(function (g) {
      band(g, 0, 16, ALU); band(g, 0, 1, '#eef1f4'); band(g, 15, 16, '#aab3bc');
      band(g, 5, 6, '#8a939c'); band(g, 10, 11, '#8a939c'); band(g, 6, 10, '#d9483b');
      g.fillStyle = '#fff1e6'; for (var x = 0; x < 16; x++) g.fillRect(x, 7 + ((x >> 2) & 1), 1, 1);
      g.fillStyle = '#b9c1c9'; [[2, 2], [9, 3], [13, 1], [4, 12], [11, 13], [7, 14]].forEach(function (p) { g.fillRect(p[0], p[1], 1, 1); });
    });
  }
  function oreTex() {
    return tex16(function (g) {
      band(g, 0, 16, '#9a958c');
      [[1, 2, '#a8673f'], [5, 0, '#6f675d'], [9, 3, '#a8673f'], [13, 2, '#c4bba9'], [3, 6, '#6f675d'], [7, 7, '#a8673f'], [11, 6, '#6f675d'],
        [14, 9, '#a8673f'], [0, 10, '#c4bba9'], [5, 11, '#a8673f'], [9, 12, '#6f675d'], [12, 12, '#a8673f'], [2, 14, '#a8673f'], [7, 15, '#c4bba9']]
        .forEach(function (p) { g.fillStyle = p[2]; g.fillRect(p[0], p[1], 2, 2); });
    });
  }

  /* ---------- 글자·표시 아틀라스: 이름표 7개 + 칸 색 테 + 화로 불빛 + 판의 화살표 = 메시 1개(드로콜 1) ---------- */
  function rr(g, x, y, w, h, r) {
    g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r);
    g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
  }
  function icon(g, k, x, y, fg, bg) {
    g.fillStyle = fg;
    if (k === 'can') { g.fillRect(x + 2, y + 2, 12, 18); g.fillRect(x + 4, y, 8, 2); g.fillStyle = bg; g.fillRect(x + 2, y + 9, 12, 4); }
    else if (k === 'bottle') { g.fillRect(x + 6, y, 4, 3); g.fillRect(x + 5, y + 3, 6, 4); g.fillRect(x + 3, y + 7, 10, 13); }
    else { g.fillRect(x + 1, y + 2, 14, 18); g.fillStyle = bg; g.beginPath(); g.moveTo(x + 9, y + 2); g.lineTo(x + 15, y + 2); g.lineTo(x + 15, y + 8); g.closePath(); g.fill();
      g.fillRect(x + 4, y + 11, 8, 2); g.fillRect(x + 4, y + 15, 6, 2); }
  }
  function uvr(x, y, w, h) { return { u0: x / 256, u1: (x + w) / 256, v0: 1 - (y + h) / 256, v1: 1 - y / 256, aspect: w / h }; }
  function atlas() {
    var c = document.createElement('canvas'); c.width = c.height = 256;
    var g = c.getContext('2d'), RH = 32, rows = [];
    var items = BINS.map(function (b) { return { text: b.name, bg: b.bg, fg: '#fff', icon: b.icon }; })
      .concat([{ text: '① 수거한 캔' }, { text: '② 알루미늄 재료' }, { text: '③ 새 금속 제품' }, { text: '새로 캐낼 광석', bg: '#5b4a3c', fg: '#fff' }]);
    g.font = FONT; g.textBaseline = 'middle';
    items.forEach(function (it, i) {
      var y = i * RH, iw = it.icon ? 22 : 0, w = Math.min(256, Math.ceil(g.measureText(it.text).width) + iw + 24);
      rr(g, 1.5, y + 1.5, w - 3, RH - 3, 9); g.fillStyle = it.bg || '#fffdf5'; g.fill();
      g.lineWidth = 3; g.strokeStyle = INK; g.stroke();
      if (it.icon) icon(g, it.icon, 10, y + 5, it.fg, it.bg);
      g.fillStyle = it.fg || INK; g.fillText(it.text, 12 + iw, y + RH / 2 + 1);
      rows.push({ plate: uvr(0, y, w, RH), fill: uvr(w - 9, y + 14, 2, 2) }); // fill = 글자 오른쪽 바탕색 한 점(칸 테 색)
    });
    var y = 7 * RH; // 화로 불빛(0~64px)
    rr(g, 1.5, y + 1.5, 61, RH - 3, 6); g.fillStyle = '#ff7a2e'; g.fill(); g.lineWidth = 3; g.strokeStyle = INK; g.stroke();
    [[8, 12], [20, 20], [33, 15], [46, 21]].forEach(function (f) {
      g.fillStyle = '#ffd34d'; g.fillRect(f[0], y + 28 - f[1], 8, f[1]); g.fillStyle = '#fff3b0'; g.fillRect(f[0] + 2, y + 28 - f[1] / 2, 4, f[1] / 2);
    });
    g.beginPath(); // 판에 찍은 화살표(64~128px, 바탕 투명 → alphaTest)
    g.moveTo(68, y + 11); g.lineTo(100, y + 11); g.lineTo(100, y + 3); g.lineTo(124, y + 16); g.lineTo(100, y + 29); g.lineTo(100, y + 21); g.lineTo(68, y + 21);
    g.closePath(); g.fillStyle = GREEN; g.fill(); g.lineWidth = 2.5; g.strokeStyle = '#0f5a26'; g.stroke();
    var t = new T.CanvasTexture(c); t.colorSpace = T.SRGBColorSpace;
    return { tex: t, rows: rows, glow: uvr(0, y, 64, RH), arrow: uvr(64, y, 64, RH) };
  }
  // q: {r: uv 사각형, c: 가운데 [x,y,z], h: 높이(m), w?: 너비, up?: 위를 보는 판(+x가 글자 오른쪽)}
  function plates(list) {
    var pos = [], uv = [];
    list.forEach(function (q) {
      var r = q.r, c = q.c, hw = (q.w || q.h * r.aspect) / 2, hh = q.h / 2;
      var p = q.up ? [[c[0] - hw, c[1], c[2] + hh], [c[0] + hw, c[1], c[2] + hh], [c[0] + hw, c[1], c[2] - hh], [c[0] - hw, c[1], c[2] - hh]]
        : [[c[0] - hw, c[1] - hh, c[2]], [c[0] + hw, c[1] - hh, c[2]], [c[0] + hw, c[1] + hh, c[2]], [c[0] - hw, c[1] + hh, c[2]]];
      var t = [[r.u0, r.v0], [r.u1, r.v0], [r.u1, r.v1], [r.u0, r.v1]];
      [0, 1, 2, 0, 2, 3].forEach(function (k) { pos.push(p[k][0], p[k][1], p[k][2]); uv.push(t[k][0], t[k][1]); });
    });
    var geo = new T.BufferGeometry();
    geo.setAttribute('position', new T.Float32BufferAttribute(pos, 3));
    geo.setAttribute('uv', new T.Float32BufferAttribute(uv, 2));
    geo.computeBoundingSphere();
    return geo;
  }
  // 캔 모양(팔각에 가까운 십자 상자 두 개 + 테 + 따개). 가운데 z=0이어야 윗면이 은색으로 남는다.
  function canBoxes(ox, m) {
    return [{ min: [ox - 0.13, 0, -0.09], max: [ox + 0.13, 0.4, 0.09], mat: m, uv: 2.5 }, { min: [ox - 0.09, 0, -0.13], max: [ox + 0.09, 0.4, 0.13], mat: m, uv: 2.5 },
      { min: [ox - 0.1, 0.4, -0.1], max: [ox + 0.1, 0.43, 0.1], mat: m, uv: 2.5 }, { min: [ox - 0.03, 0.43, -0.02], max: [ox + 0.05, 0.445, 0.05], mat: m, uv: 2.5 }];
  }

  EXP.registerFacility({
    id: 'can',
    cam: { pos: [0.75, 2.5, -7.25], target: [-0.05, 0.78, -10.15] }, // 조리대 모형 판과 바닥(분리배출함·광석 수레)을 한 화면에

    build: function (ctx) {
      var s = this.s = { mode: 'idle', t: 0, phase: 0, bin: -1, ore: 1, oreTarget: 1, hop: -1, pulse: 0, replay: false, hint: false,
        from: new T.Vector3(), v1: new T.Vector3(), v2: new T.Vector3(), rest: new T.Vector3(REST[0], REST[1], REST[2]),
        cHot: new T.Color('#6b4a3c'), cAlu: new T.Color(ALU), cGlow: new T.Color('#ff7a1a'), cHl: new T.Color('#ffd34d'), cOk: new T.Color('#6fd08c') };
      var root = ctx.root, self = this, A = atlas();

      // 고정 물체(재질 2개 = 드로콜 2): 분리배출함 · 모형 판 · 팻말 기둥 · 광산 수레(나무) / 개수대 · 화로 · 레일 · 바퀴(금속)
      var S = [];
      BINS.forEach(function (b) {
        var x0 = b.x0, x1 = b.x1, w = 0.05;
        S.push({ min: [x0, 0, BZ0], max: [x1, 0.06, BZ1], mat: 'plank' },
          { min: [x0, 0, BZ1 - w], max: [x1, BH, BZ1], mat: 'plank' }, { min: [x0, 0, BZ0], max: [x1, BH, BZ0 + w], mat: 'plank' },
          { min: [x0, 0, BZ0 + w], max: [x0 + w, BH, BZ1 - w], mat: 'plank' }, { min: [x1 - w, 0, BZ0 + w], max: [x1, BH, BZ1 - w], mat: 'plank' });
      });
      S.push({ min: [-1.95, TOP, -10.95], max: [-1.2, TOP + 0.04, -10.88], mat: 'metal' }, { min: [-1.95, TOP, -10.37], max: [-1.2, TOP + 0.04, -10.3], mat: 'metal' },
        { min: [-1.95, TOP, -10.88], max: [-1.88, TOP + 0.04, -10.37], mat: 'metal' }, { min: [-1.27, TOP, -10.88], max: [-1.2, TOP + 0.04, -10.37], mat: 'metal' },
        { min: [-1.88, TOP, -10.88], max: [-1.27, TOP + 0.005, -10.37], mat: 'metal' },
        { min: [-1.62, TOP, -10.95], max: [-1.54, TOP + 0.34, -10.88], mat: 'metal' }, { min: [-1.62, TOP + 0.28, -10.88], max: [-1.54, TOP + 0.34, -10.66], mat: 'metal' });
      S.push({ min: [-0.4, TOP, -10.98], max: [1.95, TRAY, -10.22], mat: 'plank' });               // 모형 판
      SX.forEach(function (x) { S.push({ min: [x - 0.025, TRAY, -10.95], max: [x + 0.025, 1.44, -10.9], mat: 'plank' }); });
      S.push({ min: [0.42, TRAY, -10.92], max: [0.76, 1.32, -10.6], mat: 'metal' }, { min: [0.45, 1.32, -10.9], max: [0.53, 1.42, -10.82], mat: 'metal' }); // 화로
      [-9.95, -9.54].forEach(function (z) { S.push({ min: [0.25, 0.025, z], max: [1.6, 0.065, z + 0.04], mat: 'metal' }); });       // 레일
      for (var x = 0.3; x < 1.55; x += 0.3) S.push({ min: [x, 0, -10.03], max: [x + 0.09, 0.025, -9.43], mat: 'plank' });       // 침목
      [[0.42, -9.93], [0.8, -9.93], [0.42, -9.52], [0.8, -9.52]].forEach(function (p) {
        S.push({ min: [p[0], 0.04, p[1] - 0.03], max: [p[0] + 0.14, 0.19, p[1] + 0.03], mat: 'metal' });
      });
      S.push({ min: [0.35, 0.16, -10.0], max: [1.0, 0.22, -9.45], mat: 'plank' },                                                   // 광산 수레
        { min: [0.35, 0.22, -9.5], max: [1.0, 0.52, -9.45], mat: 'plank' }, { min: [0.35, 0.22, -10.0], max: [1.0, 0.52, -9.95], mat: 'plank' },
        { min: [0.35, 0.22, -9.95], max: [0.4, 0.52, -9.5], mat: 'plank' }, { min: [0.95, 0.22, -9.95], max: [1.0, 0.52, -9.5], mat: 'plank' },
        { min: [0.34, 0.52, -10.01], max: [1.01, 0.56, -9.96], mat: 'metal' }, { min: [0.34, 0.52, -9.49], max: [1.01, 0.56, -9.44], mat: 'metal' },
        { min: [0.34, 0.52, -9.96], max: [0.39, 0.56, -9.49], mat: 'metal' }, { min: [0.96, 0.52, -9.96], max: [1.01, 0.56, -9.49], mat: 'metal' });
      root.add(B.mesh(S));

      // 이름표·칸 색 테·화로 불빛·화살표(MeshBasic + alphaTest, 드로콜 1)
      var L = [], ph = 1, i;
      BINS.forEach(function (b, k) { ph = Math.min(ph, (b.x1 - b.x0 - 0.06) / A.rows[k].plate.aspect); });
      BINS.forEach(function (b, k) {
        var m = mid(b), f = A.rows[k].fill, w = b.x1 - b.x0;
        L.push({ r: A.rows[k].plate, c: [m, 0.42, BZ1 + 0.006], h: ph });
        L.push({ r: f, c: [m, BH + 0.003, BZ1 - 0.025], w: w, h: 0.05, up: true }, { r: f, c: [m, BH + 0.003, BZ0 + 0.025], w: w, h: 0.05, up: true },
          { r: f, c: [b.x0 + 0.025, BH + 0.003, BZC], w: 0.05, h: 0.55, up: true }, { r: f, c: [b.x1 - 0.025, BH + 0.003, BZC], w: 0.05, h: 0.55, up: true });
      });
      for (i = 0; i < 3; i++) L.push({ r: A.rows[3 + i].plate, c: [SX[i], 1.51, -10.885], h: 0.14 });
      L.push({ r: A.rows[6].plate, c: [0.675, 0.37, -9.444], h: 0.11 });
      L.push({ r: A.glow, c: [0.59, 1.12, -10.594], h: 0.11 });
      L.push({ r: A.arrow, c: [0.3, TRAY + 0.004, SZ - 0.04], h: 0.1, up: true }, { r: A.arrow, c: [1.21, TRAY + 0.004, SZ - 0.04], h: 0.1, up: true });
      root.add(new T.Mesh(plates(L), new T.MeshBasicMaterial({ map: A.tex, alphaTest: 0.5 })));

      // 빈 캔(끌기 대상). 보이지 않는 큰 상자로 누르는 영역을 0.5m로 넓힌다(재질 visible:false → 드로콜 없음, 레이캐스트는 맞음)
      var canMat = new T.MeshLambertMaterial({ map: canTex() }), hitMat = new T.MeshBasicMaterial({ visible: false });
      var can = s.can = new T.Group(); can.name = 'can:can'; can.position.copy(s.rest); root.add(can);
      can.add(B.mesh(canBoxes(0, canMat)));
      var hit = new T.Mesh(new T.BoxGeometry(0.5, 0.6, 0.5), hitMat); hit.position.y = 0.3; can.add(hit);

      // 끌 때 겨누는 칸 테두리(드로콜 1, 끄는 동안만)
      var hlMat = s.hlMat = new T.MeshBasicMaterial({ color: '#ffd34d' }), hw = 0.33, hd = 0.355;
      s.hl = B.mesh([{ min: [-hw, 0, -hd], max: [hw, 0.05, -hd + 0.05], mat: hlMat }, { min: [-hw, 0, hd - 0.05], max: [hw, 0.05, hd], mat: hlMat },
        { min: [-hw, 0, -hd + 0.05], max: [-hw + 0.05, 0.05, hd - 0.05], mat: hlMat }, { min: [hw - 0.05, 0, -hd + 0.05], max: [hw, 0.05, hd - 0.05], mat: hlMat }]);
      s.hl.visible = false; root.add(s.hl);

      // ① 수거한 캔: 납작하게 눌러 묶은 캔 덩어리(캔 재질 그대로 → 줄무늬가 찌그러진 캔처럼 보임)
      var bl = [[-0.21, -0.18, -0.01, 0.15], [0, -0.16, 0.21, 0.18], [-0.2, -0.17, 0.06, 0.19], [0.07, -0.18, 0.19, 0.17], [-0.21, -0.15, -0.04, 0.18],
        [-0.03, -0.19, 0.21, 0.16], [-0.19, -0.19, 0.1, 0.16], [0.11, -0.15, 0.21, 0.19]];
      s.bale = B.mesh(bl.map(function (r, k) { var y = Math.floor(k / 2) * 0.08; return { min: [r[0], y, r[1]], max: [r[2], y + 0.08, r[3]], mat: canMat, uv: 3.3 }; }));
      s.bale.name = 'can:bale'; s.bale.position.set(SX[0], TRAY, -10.65); s.bale.visible = false; root.add(s.bale);

      // ② 녹여 만든 알루미늄 재료: 막대 3개. 뜨거운 주황에서 알루미늄 색으로 식는다(전용 재질, 드로콜 1)
      var im = s.ingotMat = new T.MeshLambertMaterial({ color: '#6b4a3c', emissive: '#ff7a1a', map: B.tex('tint') });
      s.ingots = B.mesh([{ min: [-0.16, 0, -0.16], max: [0.16, 0.1, -0.01], mat: im }, { min: [-0.16, 0, 0.01], max: [0.16, 0.1, 0.16], mat: im },
        { min: [-0.13, 0.1, -0.07], max: [0.13, 0.2, 0.07], mat: im }]);
      s.ingots.name = 'can:ingots'; s.ingots.position.set(0.95, TRAY, -10.47); s.ingots.visible = false; root.add(s.ingots);

      // ③ 새 금속 제품: 새 캔 + 냄비(드로콜 2)
      s.products = B.mesh(canBoxes(0, canMat).concat([
        { min: [0.19, 0, -0.12], max: [0.47, 0.16, 0.18], mat: ALU }, { min: [0.18, 0.16, -0.13], max: [0.48, 0.18, 0.19], mat: ALU },
        { min: [0.3, 0.18, 0.0], max: [0.36, 0.22, 0.06], mat: ALU }, { min: [0.13, 0.1, 0.01], max: [0.19, 0.13, 0.05], mat: ALU }, { min: [0.47, 0.1, 0.01], max: [0.53, 0.13, 0.05], mat: ALU }]));
      s.products.name = 'can:products'; s.products.position.set(1.45, TRAY, -10.66); s.products.visible = false; root.add(s.products);

      // 새로 캐낼 광석: 수레 안 더미 + 옆 바닥 더미(드로콜 1). 재활용하면 납작해진다
      var om = new T.MeshLambertMaterial({ map: oreTex() });
      s.oreG = B.mesh([[-0.27, 0.22, -0.22, 0.27, 0.42, 0.22], [-0.23, 0.42, -0.19, 0.25, 0.58, 0.18], [-0.18, 0.58, -0.14, 0.1, 0.72, 0.12], [0.03, 0.58, -0.08, 0.22, 0.68, 0.15],
        [-0.08, 0.72, -0.08, 0.08, 0.82, 0.05], [0.38, 0, -0.3, 0.82, 0.16, 0.25], [0.44, 0.16, -0.22, 0.76, 0.3, 0.17], [0.52, 0.3, -0.12, 0.7, 0.4, 0.08]]
        .map(function (r) { return { min: [r[0], r[1], r[2]], max: [r[3], r[4], r[5]], mat: om, uv: 4 }; }));
      s.oreG.name = 'can:ore'; s.oreG.position.set(0.675, 0, -9.725); root.add(s.oreG);

      // 재활용의 길: 캔류 칸 → ① → ② → ③ (초록 = 자원)
      var bx = mid(BINS[OK]);
      s.path = [[bx, 0.45, BZC], [bx, 1.1, BZC], [-0.4, 1.1, SZ], [SX[0], 0.98, SZ], [SX[1], 0.98, SZ], [SX[2], 0.98, SZ]];
      s.flow = V.flow(s.path.slice(0, 4), { color: GREEN, count: 18, size: 0.06, speed: 0.55 });
      s.flow.object3d.visible = false; root.add(s.flow.object3d);

      ctx.addCollider([BINS[0].x0, 0, BZ0], [BINS[2].x1, BH, BZ1]);
      ctx.addCollider([0.25, 0, -10.05], [1.6, 0.85, -9.4]);

      // 패널: 안내 + 버튼 + 3단계 표시 + 광석 막대 + 처음 상태로
      var ui = ctx.ui;
      ui.setInfo(INFO0);
      s.btn = ui.button('캔류에 넣기', function () { self.press(ctx); }, { primary: true });
      var strip = s.strip = ui.el('div'); strip.style.cssText = 'display:flex;flex-direction:column;gap:2px';
      var drow = ui.el('div', null, null, strip); drow.style.cssText = 'display:flex;gap:6px;align-items:center';
      s.dots = [];
      for (i = 0; i < 3; i++) {
        if (i) ui.el('div', null, null, drow).style.cssText = 'flex:1;height:3px;background:#d8cfb8';
        var d = ui.el('div', null, String(i + 1), drow); d.style.cssText = DOT + 'background:#fff'; s.dots.push(d);
      }
      var cap = ui.el('div', 'plegend', null, strip); cap.style.cssText = 'display:flex;gap:6px;font-size:14px;line-height:1.2;word-break:keep-all;font-weight:700';
      CAPS.forEach(function (t, k) { ui.el('span', null, t, cap).style.cssText = 'flex:1;text-align:' + ['left', 'center', 'right'][k]; });
      s.bar = ui.bar('새로 캐낼 광석', { max: 1, color: '#a0643c', format: function (v) { return v > 0.99 ? '많음' : '줄었어요'; } });
      s.bar.set(1);
      ui.button('처음 상태로', function () { self.reset(ctx); }, { small: true });
      this.sync();

      // 3D 입력: 캔 끌기 / 캔 누르기(도움말) / 칸 누르기(그 칸에 넣기)
      ctx.draggable(can, {
        normal: [0, 1, 0],
        onMove: function (p, d) {
          if (s.mode === 'idle') { s.mode = 'drag'; s.hop = -1; can.scale.setScalar(1); self.sync(); }
          if (s.mode !== 'drag') return;
          can.position.x = Math.max(-1.95, Math.min(1.9, can.position.x + d.x));
          can.position.z = Math.max(-10.85, Math.min(-9.1, can.position.z + d.z));
          self.aim(self.binAt(can.position.x, can.position.z));
        },
        onEnd: function () {
          if (s.mode !== 'drag') return;
          var k = self.binAt(can.position.x, can.position.z);
          self.aim(-1);
          if (k >= 0) self.choose(ctx, k); else self.goBack('back');
        }
      });
      ctx.onTap(can, function () {
        if (s.mode !== 'idle') return;
        s.hop = 0; s.hopObj = can; ctx.ui.setInfo('캔을 손가락으로 끌어서 알맞은 칸 위에 놓아 보세요.');
      });
      BINS.forEach(function (b, k) {
        var hb = new T.Mesh(new T.BoxGeometry(b.x1 - b.x0, BH + 0.05, BZ1 - BZ0), hitMat);
        hb.name = 'can:bin' + k; hb.position.set(mid(b), (BH + 0.05) / 2, BZC); root.add(hb);
        ctx.onTap(hb, function () { if (s.mode === 'idle') self.choose(ctx, k); });
      });
    },

    enter: function () { // 카메라가 날아오는 동안 먼저 움직인다: 처음엔 빈 캔이, 다 본 뒤엔 새 제품이 통통 뛴다
      var s = this.s;
      if (s.mode === 'idle') { s.hop = -0.15; s.hopObj = s.can; } else if (s.mode === 'done') { s.hop = -0.15; s.hopObj = s.products; }
    },

    exit: function () {
      var s = this.s;
      if (s.hop >= -0.2) { s.hop = -1; this.settle(); }
      if (s.mode === 'idle') s.can.scale.setScalar(1); // 맥박 멈춤
      if (s.mode === 'drag') { this.aim(-1); this.goBack('back'); } // 끄는 중에 나가면 제자리로
    },

    /* ---------- 조작 ---------- */
    press: function (ctx) {
      var s = this.s;
      if (s.mode === 'idle') this.choose(ctx, OK);
      else if (s.mode === 'done') this.replay(ctx);
    },

    binAt: function (x, z) {
      if (z < BZ0 - 0.1 || z > BZ1 + 0.12) return -1;
      for (var k = 0; k < BINS.length; k++) if (x >= BINS[k].x0 - 0.03 && x <= BINS[k].x1 + 0.03) return k;
      return -1;
    },

    aim: function (k) {
      var s = this.s;
      s.hl.visible = k >= 0;
      if (k >= 0) { s.hl.position.set(mid(BINS[k]), BH + 0.005, BZC); s.hlMat.color.copy(s.cHl); }
      s.strip.dataset.canAim = k;
    },

    choose: function (ctx, k) {
      var s = this.s;
      s.from.copy(s.can.position); s.can.scale.setScalar(1); s.can.rotation.set(0, 0, 0);
      s.bin = k; s.t = 0; s.hop = -1; s.hint = false; s.phase = 0;
      s.mode = BINS[k].ok ? 'flow' : 'wrong'; s.replay = false;
      if (BINS[k].ok) s.btn.classList.remove('primary');
      this.sync();
    },

    goBack: function (mode) { var s = this.s; s.mode = mode; s.t = 0; s.from.copy(s.can.position); this.sync(); },

    replay: function (ctx) {
      var s = this.s;
      s.bale.visible = s.ingots.visible = s.products.visible = false;
      s.can.scale.setScalar(1); s.can.position.set(mid(BINS[OK]), 0.12, BZC);
      s.mode = 'flow'; s.replay = true; s.t = 0.85; s.phase = 0; s.hop = -1; s.products.position.y = TRAY;
      ctx.ui.setInfo('모은 캔이 새 제품이 되는 과정을 다시 봐요.');
      this.sync();
    },

    reset: function (ctx) {
      var s = this.s;
      if (s.mode !== 'idle' && s.mode !== 'done') return;
      s.mode = 'idle'; s.bin = -1; s.phase = 0; s.hop = -1; s.oreTarget = 1;
      s.can.position.copy(s.rest); s.can.scale.setScalar(1); s.can.rotation.set(0, 0, 0);
      s.bale.visible = s.ingots.visible = s.products.visible = s.flow.object3d.visible = false;
      s.products.position.y = TRAY;
      this.dots(0); s.bar.set(1);
      s.btn.classList.add('primary'); s.btn.style.background = ''; s.btn.textContent = '캔류에 넣기';
      ctx.showModelLabel(false);
      ctx.ui.setInfo('다시 빈 캔이 생겼어요. ' + INFO0);
      this.sync();
    },

    /* ---------- 화면 갱신 ---------- */
    sync: function () { // 점검용 상태(패널 안 data-*). 화면에는 보이지 않는다
      var s = this.s, d = s.strip.dataset;
      d.canMode = s.mode; d.canPhase = s.phase; d.canOre = s.oreTarget; d.canBin = s.bin >= 0 ? BINS[s.bin].name : '';
    },

    dots: function (ph) { // ph: 0 시작 전, 1~3 그 단계 진행 중, 4 모두 끝
      for (var i = 0; i < 3; i++) {
        var st = i < ph - 1 || ph === 4 ? 'done' : i === ph - 1 ? 'now' : 'todo', d = this.s.dots[i];
        d.style.background = st === 'done' ? '#6fd08c' : st === 'now' ? '#ffd34d' : '#fff';
        d.textContent = st === 'done' ? '✓' : String(i + 1);
      }
    },

    settle: function () { // 통통 뛰기를 멈출 때 제자리 높이로
      var s = this.s;
      if (s.mode === 'idle') s.can.position.y = TOP;
      s.products.position.y = TRAY;
    },

    update: function (dt, ctx) {
      var s = this.s;
      if (s.ore !== s.oreTarget) {
        s.ore += (s.oreTarget - s.ore) * Math.min(1, dt * 4);
        if (Math.abs(s.ore - s.oreTarget) < 0.003) s.ore = s.oreTarget;
        s.oreG.scale.set(0.9 + 0.1 * s.ore, s.ore, 0.9 + 0.1 * s.ore);
      }
      if (s.hop > -0.5) {
        s.hop += dt;
        if (s.hop > 0.7) { s.hop = -1; this.settle(); }
        else if (s.hop >= 0 && s.hopObj) s.hopObj.position.y = (s.hopObj === s.can ? TOP : TRAY) + 0.14 * Math.abs(Math.sin(Math.PI * s.hop / 0.35));
      }
      var m = s.mode, can = s.can;
      if (m === 'idle') {
        if (!ctx.active) return;
        s.pulse += dt; can.scale.setScalar(1 + 0.05 * (1 - Math.cos(2 * Math.PI * s.pulse / 1.4))); // 지금 볼 것: 1.4초 맥박
      } else if (m === 'drag') {
        can.position.y += (LIFT - can.position.y) * Math.min(1, dt * 12);
      } else if (m === 'back' || m === 'wrong') this.stepBack(dt, ctx);
      else if (m === 'flow') this.stepFlow(dt, ctx);
    },

    stepBack: function (dt, ctx) { // 틀린 칸: 칸으로 가서 살짝 흔들리고 → 제자리. 빈 곳에 놓으면 바로 제자리
      var s = this.s, can = s.can, t = (s.t += dt), b = BINS[s.bin];
      var t0 = 0;
      if (s.mode === 'wrong') {
        s.v1.set(mid(b), LIFT, BZC);
        if (t < 0.35) { arc(can.position, s.from, s.v1, t / 0.35, s.from.distanceTo(s.v1) > 0.3 ? 0.35 : 0); return; }
        if (t < 0.75) {
          if (!s.hint) { s.hint = true; this.aim(s.bin); ctx.ui.setInfo('캔은 금속이라서 ' + b.name + ' 칸이 아닌 ‘캔류’ 칸에 모아요.'); }
          var k = (t - 0.35) / 0.4;
          can.position.copy(s.v1); can.position.y -= Math.sin(Math.PI * k) * 0.18;
          can.rotation.z = Math.sin(k * Math.PI * 6) * 0.22 * (1 - k);
          return;
        }
        if (s.hl.visible) { this.aim(-1); can.rotation.z = 0; s.from.copy(s.v1); }
        t0 = 0.75;
      }
      var kk = (t - t0) / 0.5;
      arc(can.position, s.from, s.rest, kk, 0.3);
      if (kk >= 1) { can.position.copy(s.rest); s.mode = 'idle'; s.pulse = 0; this.sync(); }
    },

    stepFlow: function (dt, ctx) {
      var s = this.s, can = s.can, t = (s.t += dt), bx = mid(BINS[OK]);
      // 캔: 칸 위로 → 칸 속으로 → (수거) ① 위로 날아가 납작하게 눌림
      if (t < 0.45) { s.v1.set(bx, LIFT, BZC); arc(can.position, s.from, s.v1, t / 0.45, s.from.distanceTo(s.v1) > 0.3 ? 0.3 : 0); }
      else if (t < 0.7) { var f = (t - 0.45) / 0.25; can.position.set(bx, LIFT + (0.12 - LIFT) * f * f, BZC); }
      else if (t < 0.85) can.position.set(bx, 0.12, BZC);
      else if (t < 1.6) { s.v1.set(bx, 0.12, BZC); s.v2.set(SX[0], BALE_TOP, -10.65); arc(can.position, s.v1, s.v2, (t - 0.85) / 0.75, 0.55); }
      else can.position.set(SX[0], BALE_TOP, -10.65);
      var q = ease((t - 1.62) / 0.25); can.scale.set(1 + 0.18 * q, 1 - 0.7 * q, 1 + 0.18 * q);
      if (t >= 0.45 && t < 0.85) { if (!s.hl.visible) { this.aim(OK); s.hlMat.color.copy(s.cOk); } } else if (s.hl.visible) this.aim(-1);
      // 단계별 등장: ① 캔 덩어리 → ② 녹인 재료(식으며 색이 바뀜) → ③ 새 캔·냄비
      pop(s.bale, t - 1.3); pop(s.ingots, t - 2.3); pop(s.products, t - 4.0);
      var c = clamp01((t - 2.9) / 0.6);
      s.ingotMat.color.copy(s.cHot).lerp(s.cAlu, c); s.ingotMat.emissive.copy(s.cGlow).multiplyScalar(1 - c);
      var ph = t < 0.85 ? 0 : t < 2.1 ? 1 : t < 3.8 ? 2 : t < 4.9 ? 3 : 4;
      if (ph !== s.phase) {
        s.phase = ph; this.dots(ph);
        s.flow.object3d.visible = ph >= 1;
        if (ph >= 1) s.flow.setPoints(s.path.slice(0, Math.min(6, ph + 3)));
        if (ph === 1) { ctx.showModelLabel(true); if (!s.replay) ctx.ui.setInfo('캔류 칸에 잘 넣었어요. 모은 캔이 어떻게 되는지 보세요.'); }
        this.sync();
      }
      if (t >= 5.0) s.oreTarget = ORE_AFTER; // 광석 더미가 줄어든다(다시 보기에서는 이미 줄어 있음)
      if (t >= 5.8) {
        s.mode = 'done';
        s.bar.set(ORE_AFTER);
        s.btn.classList.remove('primary'); s.btn.style.background = '#dff7e5'; s.btn.textContent = '✓ 과정 다시 보기';
        ctx.ui.setInfo('녹인 알루미늄으로 새 캔과 냄비를 만들었어요. 그만큼 광물 자원을 덜 캐내도 돼요.');
        if (!s.replay) ctx.markOperated({ delay: 700 }); // 흐름 재생 완료 → 기록 + 다 바뀐 장면을 썸네일로
        this.sync();
      }
    }
  });
})();
