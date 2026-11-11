/* 마당 아래 · 지열 설비.
   조작: ‘땅속 보기’(또는 잔디 덮개 탭) → 덮개가 옆으로 밀려나며 땅 단면이 열린다 → 깊이 내려가는 U자 배관과 그 속을 도는 물이 보인다.
   ‘겨울/여름’(또는 연결 장치 탭)으로 계절을 바꾸면 열 화살표의 방향이 뒤집힌다: 겨울 땅→배관→집(난방), 여름 집→배관→땅(냉방).
   땅과 열을 주고받는 장치이므로 전기 표시(노랑)는 쓰지 않는다. 수치는 표시하지 않는다. */
(function () {
  'use strict';
  var T = THREE, B = EXP.blocks, V = EXP.viz;

  // 단면 자리(ARCHITECTURE.md §7): x −7~−2, z 3~8, y −6~0. 배관은 북쪽 벽(z=3) 단면에 붙는다.
  var X0 = -7, X1 = -2, Z0 = 3, Z1 = 8, LX = -5.6, RX = -3.4, PW = 0.11, PZ0 = 3.04, PZ1 = 3.26, PBOT = -5.2;
  var FZ = 3.36, SY = 0.3;            // 흐름 입자가 지나는 면(배관 앞) · 땅 위 배관 위
  var LAYERS = [[-0.3, 0, '#6aa84a'], [-1.3, -0.3, '#8a5a35'], [-2.8, -1.3, '#6b4426'], [-4.4, -2.8, '#4f3a2c'], [-6, -4.4, '#77736c']];
  var LINE = '#3b2a1e', COPPER = '#c9773a', HEAT = '#ffa726', WARM = '#ff9d85', COOL = '#8fb8ff';
  var LID_DX = -5.3, LID_UP = 0.5;
  var HEAT_YS = [-2.1, -3.9, -4.7], PER_ROW = 4, HEAT_SPD = 0.3;
  // 한 줄 = [땅 쪽 x, 배관 쪽 x]. 겨울에는 땅→배관, 여름에는 배관→땅으로 흐른다.
  var HEAT_SEGS = [[-6.85, -5.8], [-4.5, -5.4], [-4.5, -3.6], [-2.15, -3.2]];
  // 첫 안내: ‘땅과 열을 주고받아 냉난방’(요청원문의 지열 표현)을 여기 둔다 — 고정 힌트 줄을 지워 패널 글 양을 줄였다
  var INTRO = '지열 설비는 땅과 열을 주고받아 냉난방을 해요. ‘땅속 보기’를 눌러 보세요.';

  // 상자 여러 개를 정점 색 하나의 메시로 묶는다(재질 1개 = 드로콜 1). 16px 노이즈 텍스처를 곱해 블록 느낌을 낸다.
  var noiseTex = null;
  function noise() {
    if (noiseTex) return noiseTex;
    var c = document.createElement('canvas'); c.width = c.height = 16;
    var g = c.getContext('2d');
    for (var y = 0; y < 16; y++) for (var x = 0; x < 16; x++) { var v = 222 + Math.floor(Math.random() * 34); g.fillStyle = 'rgb(' + v + ',' + v + ',' + v + ')'; g.fillRect(x, y, 1, 1); }
    noiseTex = new T.CanvasTexture(c); noiseTex.magFilter = noiseTex.minFilter = T.NearestFilter;
    noiseTex.wrapS = noiseTex.wrapT = T.RepeatWrapping; noiseTex.colorSpace = T.SRGBColorSpace; noiseTex.generateMipmaps = false;
    return noiseTex;
  }
  function vmesh(boxes, mat) {
    var pos = [], nor = [], uv = [], col = [], idx = [], c = new T.Color();
    boxes.forEach(function (b) {
      var d = [b.max[0] - b.min[0], b.max[1] - b.min[1], b.max[2] - b.min[2]];
      var g = new T.BoxGeometry(d[0], d[1], d[2]), base = pos.length / 3;
      var P = g.attributes.position, N = g.attributes.normal, U = g.attributes.uv;
      c.set(b.c);
      for (var i = 0; i < P.count; i++) {
        pos.push(P.getX(i) + (b.min[0] + b.max[0]) / 2, P.getY(i) + (b.min[1] + b.max[1]) / 2, P.getZ(i) + (b.min[2] + b.max[2]) / 2);
        nor.push(N.getX(i), N.getY(i), N.getZ(i));
        var f = Math.floor(i / 4), su = f < 2 ? d[2] : d[0], sv = f < 2 ? d[1] : (f < 4 ? d[2] : d[1]);
        uv.push(U.getX(i) * su, U.getY(i) * sv);
        col.push(c.r, c.g, c.b);
      }
      for (var k = 0; k < g.index.count; k++) idx.push(g.index.getX(k) + base);
      g.dispose();
    });
    var geo = new T.BufferGeometry();
    geo.setAttribute('position', new T.Float32BufferAttribute(pos, 3));
    geo.setAttribute('normal', new T.Float32BufferAttribute(nor, 3));
    geo.setAttribute('uv', new T.Float32BufferAttribute(uv, 2));
    geo.setAttribute('color', new T.Float32BufferAttribute(col, 3));
    geo.setIndex(idx);
    return new T.Mesh(geo, mat);
  }

  // 축 하나를 따라가는 블록 화살표(a→b). wide = 머리가 넓어지는 축(화면에서 보이는 쪽). 계단식 머리 3칸.
  function arrowBoxes(a, b, wide, w, list) {
    var ax = a[0] !== b[0] ? 0 : (a[1] !== b[1] ? 1 : 2), s = b[ax] > a[ax] ? 1 : -1, len = Math.abs(b[ax] - a[ax]), head = Math.min(0.42, len * 0.5);
    function box(from, to, hw, hd) {
      var mn = [0, 0, 0], mx = [0, 0, 0];
      for (var i = 0; i < 3; i++) {
        if (i === ax) { mn[i] = Math.min(from, to); mx[i] = Math.max(from, to); }
        else { var h = i === wide ? hw : hd; mn[i] = a[i] - h; mx[i] = a[i] + h; }
      }
      list.push({ min: mn, max: mx, c: HEAT });
    }
    var hs = a[ax] + s * (len - head);
    box(a[ax], hs, w / 2, w / 2);
    for (var k = 0; k < 3; k++) box(hs + s * head * k / 3, hs + s * head * (k + 1) / 3, w * (1.6 - k * 0.5), w / 2);
  }

  EXP.registerFacility({
    id: 'geothermal',
    cam: { pos: [-2.0, 5.0, 10.6], target: [-4.4, -2.2, 2.6] },

    build: function (ctx) {
      var s = this.s = { open: false, openK: 0, season: 'winter', operated: false, markT: -1, pulse: 0, plateK: 1, heatT: 0, callsAt: 0 };
      var root = ctx.root, self = this, ui = ctx.ui;
      var vmat = new T.MeshLambertMaterial({ vertexColors: true, map: noise() });

      // 1) 늘 있는 것: 단면 벽 안감(지층), 바닥 암반, U자 배관, 땅 위 배관, 집 쪽 연결 장치
      var st = [];
      // 단면 벽 안감 하나: 지층 띠 + 층 경계선(안쪽으로 0.02m 튀어나온 수평선). ax/sg = 벽이 바라보는 축·방향
      function lining(mn, mx, ax, sg) {
        LAYERS.forEach(function (L, i) {
          st.push({ min: [mn[0], L[0], mn[2]], max: [mx[0], L[1], mx[2]], c: L[2] });
          if (!i) return;
          var a = [mn[0], L[1] - 0.025, mn[2]], b = [mx[0], L[1] + 0.025, mx[2]];
          if (sg > 0) b[ax] += 0.02; else a[ax] -= 0.02;
          st.push({ min: a, max: b, c: LINE });
        });
      }
      lining([X0, 0, Z0], [X1, 0, Z0 + 0.04], 2, 1);        // 북쪽 단면(배관이 붙는 면)
      lining([X0, 0, Z0], [X0 + 0.04, 0, Z1], 0, 1);        // 서쪽
      lining([X1 - 0.04, 0, Z0], [X1, 0, Z1], 0, -1);       // 동쪽
      lining([X0, 0, Z1 - 0.04], [X1, 0, Z1], 2, -1);       // 남쪽
      st.push({ min: [X0, -6.04, Z0], max: [X1, -6, Z1], c: '#5f5b55' });
      // U자 배관(구리): 두 다리 + 바닥 굽이
      st.push({ min: [LX - PW, PBOT, PZ0], max: [LX + PW, 0.22, PZ1], c: COPPER },
        { min: [RX - PW, PBOT, PZ0], max: [RX + PW, 0.22, PZ1], c: COPPER },
        { min: [LX - PW, PBOT, PZ0], max: [RX + PW, PBOT + 0.22, PZ1], c: '#9c5626' });
      // 땅 위로 올라온 배관 → 연결 장치(x −3.9~−2.7, z 1.2~2.2)
      st.push({ min: [LX - PW, 0, 1.6], max: [LX + PW, 0.22, PZ1], c: COPPER }, { min: [LX - PW, 0, 1.6], max: [-3.9, 0.22, 1.82], c: COPPER },
        { min: [RX - PW, 0, 2.2], max: [RX + PW, 0.22, PZ1], c: COPPER });
      st.push({ min: [-3.9, 0, 1.2], max: [-2.7, 0.9, 2.2], c: '#c4cad0' }, { min: [-3.95, 0.9, 1.15], max: [-2.65, 1.0, 2.25], c: '#9aa1a8' },
        { min: [-3.7, 0.3, 2.2], max: [-2.9, 0.7, 2.24], c: '#4a5560' }, { min: [-3.55, 0.42, 2.24], max: [-3.05, 0.58, 2.26], c: '#b9d8b0' });
      // 연결 장치 → 집(앞벽 z=0)으로 들어가는 관
      st.push({ min: [-3.1, 0.3, 0], max: [-2.9, 0.5, 1.2], c: '#9aa1a8' });
      root.add(vmesh(st, vmat));

      // 2) 덮개(잔디 블록): 닫혀 있으면 단면 자리를 막고, 열면 들렸다가 서쪽으로 밀려난다
      var lid = new T.Group(); root.add(lid);
      // 윗면은 콘크리트 + 먹색 손잡이 홈: 잔디와 구분돼 ‘열 수 있는 덮개’로 읽히게
      lid.add(B.mesh([{ min: [X0, -0.5, Z0], max: [X1, 0, Z1], mat: { top: 'concrete', side: 'grass', bottom: 'grass' } },
        { min: [X1 - 0.6, 0, (Z0 + Z1) / 2 - 0.2], max: [X1 - 0.5, 0.03, (Z0 + Z1) / 2 + 0.2], mat: '#2b2b2b' }]));
      s.lid = lid;

      // 3) 단면이 열렸을 때만 보이는 것
      var inside = new T.Group(); inside.visible = false; root.add(inside); s.inside = inside;
      // 계절별 열 화살표(둘 중 하나만 보임). 겨울: 땅→배관 다리 → 다리를 따라 위로 → 땅 위 배관을 따라 장치로 → 장치에서 집 판 쪽으로.
      // 여름은 같은 길을 거꾸로. 땅 위 구간은 화면과 나란한 x축이라 방향이 한눈에 뒤집혀 보인다.
      // 아트 디렉션 예외: 열 화살표 width 0.07 대신 0.1 — 1000×600 태블릿에서 머리 모양이 읽히도록. 길이는 규칙대로 0.5m 짧은 화살표 여러 개.
      var W = [], S = [], AW = 0.1, LEGX = LX + 0.25;
      var ROUTE = [ // [겨울 꼬리, 겨울 머리, 머리가 넓어지는 축]
        [[-6.85, -3.0, 3.45], [-6.35, -3.0, 3.45], 1], [[-6.3, -3.0, 3.45], [-5.8, -3.0, 3.45], 1],
        [[-2.15, -3.0, 3.45], [-2.65, -3.0, 3.45], 1], [[-2.7, -3.0, 3.45], [-3.2, -3.0, 3.45], 1],
        [[LEGX, -1.9, 3.45], [LEGX, -1.4, 3.45], 0], [[LEGX, -1.0, 3.45], [LEGX, -0.5, 3.45], 0],   // 배관 다리 옆
        [[-5.4, 0.5, 1.7], [-4.9, 0.5, 1.7], 1], [[-4.7, 0.5, 1.7], [-4.2, 0.5, 1.7], 1],           // 땅 위 배관 위
        [[-3.2, 1.85, 1.7], [-2.7, 1.85, 1.7], 1], [[-2.6, 1.85, 1.7], [-2.1, 1.85, 1.7], 1]];      // 장치 → 집 판
      ROUTE.forEach(function (r) { arrowBoxes(r[0], r[1], r[2], AW, W); arrowBoxes(r[1], r[0], r[2], AW, S); });
      var amat = new T.MeshBasicMaterial({ color: HEAT });
      s.arrW = vmesh(W.map(function (b) { return { min: b.min, max: b.max, c: '#ffffff' }; }), amat);
      s.arrS = vmesh(S.map(function (b) { return { min: b.min, max: b.max, c: '#ffffff' }; }), amat);
      // 점검용: 집 쪽·배관 다리 구간의 [꼬리, 머리]
      s.arrW.userData = { dir: 'ground>pipe>house', house: [ROUTE[8][0], ROUTE[9][1]], leg: [ROUTE[4][0], ROUTE[5][1]] };
      s.arrS.userData = { dir: 'house>pipe>ground', house: [ROUTE[9][1], ROUTE[8][0]], leg: [ROUTE[5][1], ROUTE[4][0]] };
      inside.add(s.arrW, s.arrS);
      // 열 알갱이(작은 주황): 땅과 배관 사이를 가로지르는 줄들. InstancedMesh 1개
      var nHeat = HEAT_YS.length * HEAT_SEGS.length * PER_ROW;
      s.heat = new T.InstancedMesh(new T.BoxGeometry(0.08, 0.08, 0.08), new T.MeshBasicMaterial({ color: HEAT }), nHeat);
      s.heat.frustumCulled = false; inside.add(s.heat);
      s.mtx = new T.Matrix4();
      // 집 앞벽의 따뜻함/시원함 판 + 이름표
      // 판에는 집 모양 선을 얹어(색에 곱해짐) 파란 물 알갱이와 모양으로 구분된다. 드로콜 그대로
      var pc = document.createElement('canvas'); pc.width = 112; pc.height = 80;
      var pg = pc.getContext('2d'); pg.fillStyle = '#fff'; pg.fillRect(0, 0, 112, 80);
      pg.strokeStyle = 'rgba(70,60,60,0.55)'; pg.lineWidth = 4; pg.lineJoin = 'round';
      pg.strokeRect(3, 3, 106, 74);
      pg.beginPath(); pg.moveTo(30, 40); pg.lineTo(56, 18); pg.lineTo(82, 40); pg.lineTo(82, 64); pg.lineTo(30, 64); pg.closePath(); pg.stroke();
      pg.strokeRect(50, 48, 12, 16);
      var ptex = new T.CanvasTexture(pc); ptex.colorSpace = T.SRGBColorSpace;
      s.plateMat = new T.MeshBasicMaterial({ color: WARM, map: ptex });
      s.plate = new T.Mesh(new T.BoxGeometry(2.8, 2.0, 0.04), s.plateMat); s.plate.position.set(-1.9, 1.25, 0.02); inside.add(s.plate);
      s.cWarm = new T.Color(WARM); s.cCool = new T.Color(COOL); s.cFrom = new T.Color(WARM);
      s.tagW = V.textSprite('겨울: 집이 따뜻해요', { height: 0.5, color: '#8a2a12', bg: '#fff1ea' }); s.tagW.position.set(-0.85, 0.85, 0.5);
      s.tagS = V.textSprite('여름: 집이 시원해요', { height: 0.5, color: '#123f8a', bg: '#eef4ff' }); s.tagS.position.set(-0.85, 0.85, 0.5); // 왼쪽 끝이 연결 장치 뒤로 가려지지 않게 오른쪽으로
      var tagG = V.textSprite('땅속', { height: 0.5, color: '#4a2f1a' }); tagG.position.set(-6.35, -1.0, 3.5);
      var tagP = V.textSprite('파이프', { height: 0.5, color: '#7a3d12' }); tagP.position.set(-2.75, -1.0, 3.5);
      var tagD = V.textSprite('연결 장치', { height: 0.45, color: '#3a434c' }); tagD.position.set(-4.45, 1.3, 2.3); // 장치 왼쪽 위: 집 판 이름표(여름/겨울)와 겹치지 않게
      inside.add(s.tagW, s.tagS, tagG, tagP, tagD);

      // 4) 배관 속을 도는 물(늘 보임: 덮개를 닫아도 땅 위 배관에서 돌고 있다)
      s.fluid = V.flow([[-3.9, SY, 1.71], [LX, SY, 1.71], [LX, SY, FZ], [LX, PBOT + 0.11, FZ], [RX, PBOT + 0.11, FZ], [RX, SY, FZ], [RX, SY, 2.2]],
        { color: '#6fc3ff', count: 52, size: 0.09, speed: -0.9 });
      root.add(s.fluid.object3d);

      ctx.addCollider([-3.95, 0, 1.15], [-2.65, 1.0, 2.25]);

      // 패널
      s.info = '';
      this.say(ctx, INTRO);
      s.btnOpen = ui.button('땅속 보기', function () { self.setOpen(ctx, !s.open); }, { primary: true });
      var row = ui.row();
      s.btnW = ui.button('겨울', function () { self.setSeason(ctx, 'winter'); }, { parent: row });
      s.btnS = ui.button('여름', function () { self.setSeason(ctx, 'summer'); }, { parent: row });
      ui.legend([{ color: HEAT, text: '열이 가는 길' }, { color: '#6fc3ff', text: '파이프 속을 도는 물' }]);
      ui.button('처음 상태로', function () { self.reset(ctx); }, { small: true });
      this.sync(ctx);

      // 3D 직접 누르기: 덮개 = 땅속 보기, 연결 장치·집 판 = 계절 바꾸기
      var dev = new T.Mesh(new T.BoxGeometry(1.3, 1.0, 1.1), new T.MeshBasicMaterial({ visible: false }));
      dev.position.set(-3.3, 0.5, 1.7); root.add(dev);
      ctx.onTap(lid, function () { self.setOpen(ctx, true); });
      ctx.onTap(dev, function () { self.setSeason(ctx, s.season === 'winter' ? 'summer' : 'winter'); });
      ctx.onTap(s.plate, function () { self.setSeason(ctx, s.season === 'winter' ? 'summer' : 'winter'); });
    },

    enter: function (ctx) {
      ctx.showModelLabel(this.s.open); // 탐험 안내 칩은 코어가 시설 모드 동안 숨긴다(app.js enter·toExplore)
    },

    say: function (ctx, t) { this.s.info = t; ctx.ui.setInfo(t); },

    seasonInfo: function (ctx) {
      var s = this.s, w = s.season === 'winter';
      var t = w ? '겨울에는 땅속의 열을 파이프 속 물이 받아 집으로 옮겨요. 이 열로 난방을 해요.'
        : '여름에는 집 안의 열을 파이프 속 물이 땅으로 보내요. 땅과 열을 주고받아 냉난방을 해요.';
      if (!s.operated) t = w ? '겨울에는 땅속의 열이 파이프를 타고 집으로 가요. ‘여름’도 눌러 보세요.' : t;
      this.say(ctx, t);
    },

    setOpen: function (ctx, on) {
      var s = this.s; s.open = on;
      ctx.showModelLabel(on);
      if (on) this.seasonInfo(ctx);
      else this.say(ctx, '덮개를 닫았어요. ‘땅속 보기’를 누르면 다시 열려요.');
      this.sync(ctx);
    },

    setSeason: function (ctx, season) {
      var s = this.s, changed = season !== s.season;
      if (!s.open) this.setOpen(ctx, true);
      if (changed) {
        s.season = season; s.plateK = 0; s.cFrom.copy(s.plateMat.color);
        s.markT = 0.8; // 화살표가 뒤집히고 판 색이 바뀐 뒤 기록·썸네일
      }
      this.seasonInfo(ctx);
      this.sync(ctx);
    },

    reset: function (ctx) {
      var s = this.s;
      s.season = 'winter'; s.plateK = 1; s.markT = -1;
      this.setOpen(ctx, false);
      this.say(ctx, INTRO);
    },

    // 버튼 상태: 먼저 누를 것 하나만 노랑, 고른 것은 초록 ✓
    sync: function (ctx) {
      var s = this.s, w = s.season === 'winter';
      function set(b, label, on, primary) { b.textContent = (on ? '✓ ' : '') + label; b.classList.toggle('on', on); b.classList.toggle('primary', !!primary && !on); }
      set(s.btnOpen, '땅속 보기', s.open, !s.open);
      set(s.btnW, '겨울', s.open && w, s.open && !s.operated && !w);
      set(s.btnS, '여름', s.open && !w, s.open && !s.operated && w);
      var d = ctx.ui.body.dataset;
      d.open = s.open ? 1 : 0; d.season = s.season;
    },

    update: function (dt, ctx) {
      var s = this.s, i;
      // 덮개: 들렸다가(0~0.3) 서쪽으로 밀려난다(0.3~1). 0.8초
      s.openK += Math.sign((s.open ? 1 : 0) - s.openK) * Math.min(Math.abs((s.open ? 1 : 0) - s.openK), dt / 0.8);
      var k = s.openK, up = Math.min(1, k / 0.3), sl = Math.max(0, (k - 0.3) / 0.7);
      sl = sl * sl * (3 - 2 * sl);
      s.lid.position.set(LID_DX * sl, LID_UP * up, 0);
      if (k === 0 && ctx.active) { s.pulse += dt; s.lid.position.y = 0.16 * (0.5 - 0.5 * Math.cos(s.pulse * Math.PI * 2 / 1.4)); }
      else s.pulse = 0;
      s.inside.visible = k > 0.55;

      if (!s.inside.visible) { this.debug(dt, ctx); return; }
      var w = s.season === 'winter';
      s.arrW.visible = w; s.arrS.visible = !w;
      s.fluid.speed = w ? -0.9 : 0.9; // 겨울: 물이 다리를 올라와 땅 위 배관으로 장치에 들어옴 · 여름: 반대
      s.tagW.visible = w; s.tagS.visible = !w;
      if (s.plateK < 1) { s.plateK = Math.min(1, s.plateK + dt / 0.6); }
      s.plateMat.color.copy(s.cFrom).lerp(w ? s.cWarm : s.cCool, s.plateK);

      // 열 알갱이: 겨울 땅→배관, 여름 배관→땅. 멈추지 않고 천천히
      s.heatT += dt * HEAT_SPD;
      var n = 0;
      for (var r = 0; r < HEAT_YS.length; r++) for (var g = 0; g < HEAT_SEGS.length; g++) {
        var a = HEAT_SEGS[g][w ? 0 : 1], b = HEAT_SEGS[g][w ? 1 : 0], len = Math.abs(b - a);
        for (i = 0; i < PER_ROW; i++) {
          var f = ((i / PER_ROW) + s.heatT / len + r * 0.17) % 1;
          s.mtx.makeTranslation(a + (b - a) * f, HEAT_YS[r] + (g % 2 ? 0.1 : -0.1), FZ + 0.05);
          s.heat.setMatrixAt(n++, s.mtx);
        }
      }
      s.heat.instanceMatrix.needsUpdate = true;

      if (s.markT >= 0) {
        s.markT -= dt;
        if (s.markT < 0 && s.open) { s.operated = true; ctx.markOperated({ delay: 200 }); this.seasonInfo(ctx); this.sync(ctx); }
      }
      this.debug(dt, ctx);
    },

    // 점검용 상태(DOM dataset): 화면에 실제로 보이는 화살표 방향·집 표시·이 시설의 드로콜
    debug: function (dt, ctx) {
      var s = this.s;
      if ((s.callsAt -= dt) > 0) return;
      s.callsAt = 0.12;
      var d = ctx.ui.body.dataset, vis = s.inside.visible, arr = vis ? (s.arrW.visible ? s.arrW : s.arrS) : null;
      d.shown = vis ? 1 : 0;
      d.lidX = s.lid.position.x.toFixed(2); d.lidY = s.lid.position.y.toFixed(3);
      d.arrow = arr ? arr.userData.dir : '';
      d.houseArrow = arr ? JSON.stringify(arr.userData.house) : '';
      d.legArrow = arr ? JSON.stringify(arr.userData.leg) : '';
      d.water = s.fluid.speed > 0 ? 'down' : 'up';
      d.heatIn = vis ? (s.season === 'winter' ? 1 : 0) : '';
      d.house = vis ? '#' + s.plateMat.color.getHexString() : '';
      d.operated = s.operated ? 1 : 0;
      var calls = 0, tris = 0;
      ctx.root.traverseVisible(function (ob) {
        if (!(ob.isMesh || ob.isSprite) || !ob.material.visible) return;
        var g = ob.geometry, c = g.index ? g.index.count : g.attributes.position.count;
        calls++; tris += c / 3 * (ob.isInstancedMesh ? ob.count : 1);
      });
      d.calls = calls; d.tris = Math.round(tris);
    }
  });
})();
