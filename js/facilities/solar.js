/* 지붕 · 태양광 설비 — 대표 장면(ARCHITECTURE.md §7 solar, art-direction.md §2·§3·§5).
   조작: 구름 두 개를 손가락으로 끌어 해와 패널 사이를 가린다(큰 버튼 대안: ‘구름으로 가리기’ / ‘구름 치우기’).
   화면: 해 → 패널 햇빛 막대가 구름에 막혀 줄고, 패널에 구름 그늘이 지고 반짝임이 줄며,
         패널 → 전선 → 집 안 전등 길의 전기 점이 드문드문·느려진다. 전등은 꺼지지 않는다(오개념 방지).
   실내는 앞벽과 지붕 끝 일부를 잘라 본 단면으로 보인다(스텐실: 이 시설 모드에서만, 세계 메시는 건드리지 않음).
   수치·kW 없음: 막대 글자는 ‘많음·보통·적음’. */
(function () {
  'use strict';
  var T = THREE, B = EXP.blocks, V = EXP.viz;

  // ---- 배치(세계 좌표) ----
  var TILT = 0.7, LS = 1.8, Y0 = 5.85, Z0 = -0.9;             // 패널: 남쪽으로 40° 기울임, 아래 가장자리 높이·z
  var PANELS = [[2.0, 4.6], [4.8, 7.4]];                       // 패널 두 장의 x 범위(패널 구역 x 1.5~7.5)
  var COLS = 6, ROWS = 4;                                      // 패널 한 장의 셀 격자
  var WY = 5.3;                                                // 옥상 위 전선 높이(받침 위)
  var CUT = { x0: -1.7, x1: 0, door: 2, nz: -1.3 };            // 잘라 보는 자리: 거실 서쪽 앞벽 + 지붕 끝(lighting 구역 앞) + 현관 문 구멍
  var STENCIL = 90;                                            // 다른 시설과 겹치지 않을 스텐실 값
  var DSUN = 5.2;                                              // 모형 해: 패널 가운데에서 햇빛 방향으로 5.2m
  var CLOUD_Z = 0.15;
  var CLOUD0 = [[-2.4, 9.8, CLOUD_Z], [7.6, 10.4, CLOUD_Z]];   // 처음 자리(햇빛 길 밖)
  var COVER = [[2.2, 9.0, CLOUD_Z], [4.8, 9.2, CLOUD_Z]];      // ‘구름으로 가리기’ 자리(발전량 약 0.3: ‘적음’ 경계 0.45에서 넉넉히 아래)
  var CSCALE = [1, 1], CHALF = [[1.9, 1.0], [1.9, 1.0]];                        // 구름 밑면 반폭(x, z): 가림 계산용
  var CLAMP = { x0: -4.2, x1: 9.0, y0: 8.4, y1: 11.0 };
  var GRID = '#c8ccd0';                                        // 발전소 전기 점: art-direction ‘흐림’ 회색(햇빛 막대·태양광 전기 노랑과 밝기로 갈림)
  var NRAY = 42, RLEN = 0.9, RSPEED = 1.2, NGLINT = 18, NPULSE = 32;
  var DIM = 0.8;                                               // 구름이 다 가려도 햇빛이 0이 되지 않음(최저 0.2)
  var INFO = {
    start: '태양광 패널은 햇빛으로 전기를 만들어요. 구름을 손가락으로 끌어 해를 가려 보세요.',
    high: '햇빛이 패널에 가득 닿아요. 햇빛으로 전기를 많이 만들어요.',
    mid: '구름이 햇빛을 조금 가렸어요. 만드는 전기가 조금 줄었어요.',
    low: '구름이 가려 만드는 전기가 줄었어요. 전등은 발전소 전기로 그대로 켜져요.'
  };
  function level(p) { return p >= 0.75 ? '많음' : p >= 0.45 ? '보통' : '적음'; }

  var seed = 1112;
  function rnd() { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; }

  /* 꼭짓점 색 상자 묶음 → 메시 하나(드로콜 1). box: {min, max, color: '#hex' | {top, side, bottom}, m?: Matrix4} */
  var FACE = [
    { k: 'side', n: [1, 0, 0], v: [[1, 0, 1], [1, 0, 0], [1, 1, 0], [1, 1, 1]] },
    { k: 'side', n: [-1, 0, 0], v: [[0, 0, 0], [0, 0, 1], [0, 1, 1], [0, 1, 0]] },
    { k: 'top', n: [0, 1, 0], v: [[0, 1, 1], [1, 1, 1], [1, 1, 0], [0, 1, 0]] },
    { k: 'bottom', n: [0, -1, 0], v: [[0, 0, 0], [1, 0, 0], [1, 0, 1], [0, 0, 1]] },
    { k: 'side', n: [0, 0, 1], v: [[0, 0, 1], [1, 0, 1], [1, 1, 1], [0, 1, 1]] },
    { k: 'side', n: [0, 0, -1], v: [[1, 0, 0], [0, 0, 0], [0, 1, 0], [1, 1, 0]] }
  ];
  function vcMesh(boxes, basic, order) {
    var P = [], N = [], C = [], col = new T.Color(), p = new T.Vector3(), n = new T.Vector3(), nm = new T.Matrix3();
    boxes.forEach(function (b) {
      if (b.m) nm.getNormalMatrix(b.m);
      FACE.forEach(function (f) {
        col.set(typeof b.color === 'string' ? b.color : (b.color[f.k] || b.color.side));
        n.fromArray(f.n); if (b.m) n.applyMatrix3(nm).normalize();
        [0, 1, 2, 0, 2, 3].forEach(function (i) {
          var v = f.v[i];
          p.set(v[0] ? b.max[0] : b.min[0], v[1] ? b.max[1] : b.min[1], v[2] ? b.max[2] : b.min[2]);
          if (b.m) p.applyMatrix4(b.m);
          P.push(p.x, p.y, p.z); N.push(n.x, n.y, n.z); C.push(col.r, col.g, col.b);
        });
      });
    });
    var g = new T.BufferGeometry();
    g.setAttribute('position', new T.Float32BufferAttribute(P, 3));
    g.setAttribute('normal', new T.Float32BufferAttribute(N, 3));
    g.setAttribute('color', new T.Float32BufferAttribute(C, 3));
    g.computeBoundingSphere();
    var me = new T.Mesh(g, basic ? new T.MeshBasicMaterial({ vertexColors: true }) : new T.MeshLambertMaterial({ vertexColors: true }));
    if (order) me.renderOrder = order;
    return me;
  }
  // 축에 나란한 선분 → 상자
  function seg(a, b, w, color) {
    var h = w / 2;
    return { min: [Math.min(a[0], b[0]) - h, Math.min(a[1], b[1]) - h, Math.min(a[2], b[2]) - h],
      max: [Math.max(a[0], b[0]) + h, Math.max(a[1], b[1]) + h, Math.max(a[2], b[2]) + h], color: color };
  }
  function makePath(pts) {
    var P = pts.map(function (q) { return new T.Vector3(q[0], q[1], q[2]); }), cum = [0], tot = 0;
    for (var i = 1; i < P.length; i++) { tot += P[i].distanceTo(P[i - 1]); cum.push(tot); }
    return {
      total: tot,
      at: function (d, out) {
        for (var j = 1; j < P.length; j++) if (d <= cum[j]) return out.lerpVectors(P[j - 1], P[j], (d - cum[j - 1]) / Math.max(1e-6, cum[j] - cum[j - 1]));
        return out.copy(P[P.length - 1]);
      }
    };
  }
  function cloudBoxes(sc) {
    var c = { top: '#ffffff', side: '#eef3f8', bottom: '#d3dce6' };
    return [
      { min: [-1.7, -0.35, -1.0], max: [1.7, 0.25, 1.0] }, { min: [-1.2, 0.25, -0.7], max: [0.2, 0.8, 0.6] },
      { min: [0.1, 0.25, -0.6], max: [1.2, 0.6, 0.7] }, { min: [-0.5, 0.8, -0.4], max: [0.5, 1.05, 0.4] },
      { min: [-2.1, -0.25, -0.6], max: [-1.7, 0.1, 0.6] }, { min: [1.7, -0.2, -0.5], max: [2.0, 0.15, 0.5] },
      { min: [-0.14, -0.55, -0.14], max: [0.14, -0.35, 0.14], color: '#2b2b2b' } // 밑면 손잡이 점(높이를 줘 꼭지로 읽히게)
    ].map(function (b) {
      return { min: [b.min[0] * sc, b.min[1] * sc, b.min[2] * sc], max: [b.max[0] * sc, b.max[1] * sc, b.max[2] * sc], color: b.color || c };
    });
  }

  EXP.registerFacility({
    id: 'solar',
    cam: { pos: [4.8, 6.2, 11.0], target: [2.0, 6.7, -1.5] },

    build: function (ctx) {
      var self = this, root = ctx.root, ui = ctx.ui, i;
      var sd = new T.Vector3().fromArray(ctx.sunDir).normalize();
      var s = this.s = {
        sd: sd, t: 0, p: 1, pS: 1, pStart: 1, barV: -1, barT: 0, dbgT: 0, cutK: 1, anim: null, dragged: false, ops: 0, reached: 0,
        LIT: new T.Color('#1f3a6b'), SHADE: new T.Color('#0b1527'), col: new T.Color(),
        v: new T.Vector3(), v2: new T.Vector3(), m4: new T.Matrix4(), one: new T.Vector3(1, 1, 1)
      };

      // ---- 패널 배열(남쪽으로 기울어진 판 두 장) ----
      var Marr = new T.Matrix4().compose(new T.Vector3(0, Y0, Z0), new T.Quaternion().setFromAxisAngle(new T.Vector3(1, 0, 0), TILT), s.one);
      s.Marr = Marr;
      var sb = [], zb = Z0 - 0.045 - (LS - 0.12) * Math.cos(TILT), yb = Y0 - 0.054 + (LS - 0.12) * Math.sin(TILT);
      PANELS.forEach(function (px) {
        var a = px[0], b = px[1];
        sb.push({ min: [a, -0.07, -LS], max: [b, 0.02, 0], color: '#d9dee3', m: Marr });                               // 틀
        sb.push({ min: [a + 0.08, 0.02, -LS + 0.08], max: [b - 0.08, 0.035, -0.08], color: '#6f8fc0', m: Marr });      // 격자 선
        [a + 0.15, b - 0.15].forEach(function (x) {
          sb.push({ min: [x - 0.06, 5, Z0 - 0.18], max: [x + 0.06, Y0 - 0.03, Z0 - 0.06], color: '#9aa1a8' });       // 앞다리
          sb.push({ min: [x - 0.06, 5, zb - 0.06], max: [x + 0.06, yb, zb + 0.06], color: '#9aa1a8' });               // 뒷다리
        });
        sb.push({ min: [a, 5, Z0 - 0.2], max: [b, 5.07, Z0 - 0.04], color: '#9aa1a8' }, { min: [a, 5, zb - 0.08], max: [b, 5.07, zb + 0.08], color: '#9aa1a8' });
      });
      for (var cx = -0.85; cx < 2.3; cx += 0.8) sb.push({ min: [cx - 0.04, 5, -1.64], max: [cx + 0.04, WY - 0.04, -1.56], color: '#9aa1a8' }); // 전선 받침

      // 셀: 인스턴스 색으로 구름 그늘을 칠한다(드로콜 1)
      var cw = (2.6 - 0.16 - (COLS - 1) * 0.04) / COLS, ch = (LS - 0.16 - (ROWS - 1) * 0.04) / ROWS;
      var NC = PANELS.length * COLS * ROWS;
      var cells = new T.InstancedMesh(new T.BoxGeometry(cw, 0.03, ch), new T.MeshLambertMaterial({ color: '#ffffff' }), NC);
      cells.frustumCulled = false;
      s.cellLocal = []; s.cellPos = []; s.light = new Float32Array(NC); s.occ = new Float32Array(NC); s.dc = new Float32Array(NC);
      var k = 0;
      PANELS.forEach(function (px) {
        for (var r = 0; r < ROWS; r++) for (var c = 0; c < COLS; c++) {
          var lp = new T.Vector3(px[0] + 0.08 + cw / 2 + c * (cw + 0.04), 0.05, -0.08 - ch / 2 - r * (ch + 0.04));
          s.cellLocal.push(lp);
          s.m4.makeTranslation(lp.x, lp.y, lp.z).premultiply(Marr);
          cells.setMatrixAt(k, s.m4); cells.setColorAt(k, s.LIT);
          s.cellPos.push(new T.Vector3().setFromMatrixPosition(s.m4)); k++;
        }
      });
      root.add(cells); s.cells = cells;

      // 반짝임: 햇빛이 닿는 셀에서만 깜빡(초당 2회 이하)
      var glints = new T.InstancedMesh(new T.BoxGeometry(0.22, 0.012, 0.22), new T.MeshBasicMaterial({ color: '#fffbe0' }), NGLINT);
      glints.frustumCulled = false; glints.visible = false; root.add(glints); s.glints = glints;
      s.gl = [];
      for (i = 0; i < NGLINT; i++) {
        var gc = (i * 11 + 5) % NC, gp = s.cellLocal[gc];
        s.gl.push({ cell: gc, ph: rnd() * 6.28, f: 0.6 + rnd() * 0.7, lp: new T.Vector3(gp.x + (rnd() - 0.5) * 0.15, 0.072, gp.z + (rnd() - 0.5) * 0.15) });
      }

      // ---- 모형 해(카메라를 바라보는 블록 해) ----
      var pc = new T.Vector3(4.7, Y0 + LS / 2 * Math.sin(TILT), Z0 - LS / 2 * Math.cos(TILT));
      var sun = new T.Group(); sun.position.copy(pc).addScaledVector(sd, DSUN); sun.visible = false; root.add(sun); s.sun = sun;
      var sunB = [{ min: [-0.75, -0.75, -0.3], max: [0.75, 0.75, 0.3], color: '#ffd75e' }, { min: [-0.45, -0.45, 0.3], max: [0.45, 0.45, 0.38], color: '#ffe68a' }];
      [[0, 1], [1, 0], [0, -1], [-1, 0]].forEach(function (d) {
        var cx2 = d[0] * 1.2, cy2 = d[1] * 1.2, hw = d[0] ? 0.32 : 0.14, hh = d[1] ? 0.32 : 0.14;
        sunB.push({ min: [cx2 - hw, cy2 - hh, -0.12], max: [cx2 + hw, cy2 + hh, 0.12], color: '#fff0a0' });
      });
      [[1, 1], [1, -1], [-1, 1], [-1, -1]].forEach(function (d) {
        sunB.push({ min: [d[0] * 1.0 - 0.13, d[1] * 1.0 - 0.13, -0.1], max: [d[0] * 1.0 + 0.13, d[1] * 1.0 + 0.13, 0.1], color: '#fff0a0' });
      });
      // 하늘 배경처럼 구름·집이 해 앞을 가린다: 매 프레임 카메라 시선을 따라 60m 뒤로 밀고 그만큼 키운다(화면 크기는 같음).
      // 코어 하늘 통(반지름 150) 앞·집과 구름 뒤라 깊이 판정만으로 순서가 맞는다. 안개에 묻히지 않게 fog 끔.
      var sunMesh = vcMesh(sunB, true); sunMesh.material.fog = false; sun.add(sunMesh); s.sunPos = sun.position.clone();

      // ---- 햇빛 막대: 햇빛 방향과 나란히 내려와 패널 면에서 멈춤(구름이 막으면 구름에서 멈춤) ----
      var rays = new T.InstancedMesh(new T.BoxGeometry(0.09, 1, 0.09), new T.MeshBasicMaterial({ color: '#fff0a0' }), NRAY);
      rays.frustumCulled = false; rays.visible = false; root.add(rays); s.rays = rays;
      s.rayQ = new T.Quaternion().setFromUnitVectors(new T.Vector3(0, 1, 0), sd);
      s.ray = [];
      for (i = 0; i < NRAY; i++) {
        var rc = (i * 7 + 3) % NC, rl = s.cellLocal[rc];
        var tgt = new T.Vector3(rl.x + (rnd() - 0.5) * cw * 0.8, 0.07, rl.z + (rnd() - 0.5) * ch * 0.8).applyMatrix4(Marr);
        var L = (sun.position.y - tgt.y) / sd.y;
        s.ray.push({ cell: rc, tgt: tgt, L: L, h: rnd() * L, u: rnd() });
      }

      // ---- 구름 두 개(끌기) ----
      s.clouds = [0, 1].map(function (ci) {
        var g = new T.Group(); g.position.fromArray(CLOUD0[ci]); g.visible = false; root.add(g); // 탐험 중에는 숨김(옥상 머리 위에 큰 덩어리로 보이지 않게)
        g.add(vcMesh(cloudBoxes(CSCALE[ci]), true)); // 조명 없이 흰색 그대로(아래에서 봐도 회색 돌처럼 보이지 않게)
        ctx.draggable(g, {
          normal: [0, 0, 1],
          onStart: function () { s.anim = null; s.pStart = s.p; s.dragging = g; },
          onMove: function (p, d) {
            g.position.x = Math.max(CLAMP.x0, Math.min(CLAMP.x1, g.position.x + d.x));
            g.position.y = Math.max(CLAMP.y0, Math.min(CLAMP.y1, g.position.y + d.y));
          },
          onEnd: function () { s.dragging = null; s.dragged = true; self.showHints(false); self.settle(ctx); }
        });
        return g;
      });
      s.hints = s.clouds.map(function (g) { var h = V.textSprite('끌어 보세요', { height: 0.58 }); h.position.set(0, -0.95, 1.0); h.visible = false; g.add(h); return h; }); // 0.58: 1000×600 먼 구름(맥박 최소)에서도 글자 15px 이상

      // ---- 전선: 패널 → 옥상 → 지붕 끝 단면 → 집 안 전등 ----
      var P = [[2.31, 5.9, -1.09], [2.31, WY, -1.09], [2.31, WY, -1.6], [-0.85, WY, -1.6], [-0.85, WY, -1.24], [-0.85, 4.0, -1.24], [-0.85, 3.47, -1.24]];
      var wb = [];
      // 지붕 장면 예외: 전선 0.07·점 0.16/0.15(art-direction 0.06·0.10) — 먼 지붕 카메라에서도 보이되 탐험 화면에서 굵은 막대로 보이지 않게
      for (i = 0; i < 5; i++) wb.push(seg(P[i], P[i + 1], 0.07, '#2b2b2b'));
      // 발전소에서 오는 전선: 마당 전봇대 → 앞벽 단면 → 전등 줄에서 만난다. 패널 전기가 줄면 이 길의 흐린 점이 늘어난다(전등이 꺼지지 않는 까닭)
      var G = [[-2.3, 4.5, 1.6], [-1.25, 4.5, 1.6], [-1.25, 4.5, -1.24], [-0.85, 4.5, -1.24], [-0.85, 3.47, -1.24]];
      for (i = 0; i < 3; i++) wb.push(seg(G[i], G[i + 1], 0.07, '#2b2b2b'));
      wb.push({ min: [-2.4, 0, 1.5], max: [-2.2, 4.75, 1.7], color: '#8a7f72' }, { min: [-2.8, 4.55, 1.55], max: [-1.8, 4.65, 1.65], color: '#8a7f72' }); // 전봇대(지열 연결 장치 x −3.9~−2.7 과 겹치지 않게 그 동쪽)
      s.gpath = makePath(G);
      root.add(vcMesh(sb.concat(wb), false, 12)); // 패널 틀·다리 + 전선 한 메시. 단면 안쪽 전선도 보이도록 잘라 낸 면(11) 뒤에 그린다
      s.path = makePath(P);
      var pulses = new T.InstancedMesh(new T.BoxGeometry(0.16, 0.16, 0.16), new T.MeshBasicMaterial({ color: '#ffd400' }), NPULSE);
      pulses.frustumCulled = false; pulses.renderOrder = 12; pulses.visible = false; pulses.count = 0; root.add(pulses); s.pulses = pulses;
      s.pd = new Float32Array(NPULSE); s.pn = 0; s.acc = 0;
      var gpulses = new T.InstancedMesh(new T.BoxGeometry(0.15, 0.15, 0.15), new T.MeshBasicMaterial({ color: GRID }), NPULSE);
      gpulses.frustumCulled = false; gpulses.renderOrder = 12; gpulses.visible = false; gpulses.count = 0; root.add(gpulses); s.gpulses = gpulses;
      s.gd = new Float32Array(NPULSE); s.gn = 0; s.gacc = 0;

      // ---- 단면(앞벽 x −1.7~0 + 지붕 끝 z −1.3~0): 스텐실로 그 자리만 집 안 모형을 보인다 ----
      var cut = new T.Group(); cut.visible = false; root.add(cut); s.cut = cut;
      var maskMat = new T.MeshBasicMaterial({ colorWrite: false, depthWrite: false, stencilWrite: true, stencilRef: STENCIL,
        stencilFunc: T.AlwaysStencilFunc, stencilZPass: T.ReplaceStencilOp });
      // 마스크 한 메시(드로콜 1): 지붕 끝 · 앞벽 세로 칸 · 현관 문 구멍 순서. y=5 기준 아래로 scale.y 만큼 열린다.
      // 문 구멍은 다 열린 뒤에만 그린다(drawRange) — 위 ‘현관’ 이름표가 붙은 문 위 벽은 남긴다.
      s.mask = vcMesh([
        { min: [CUT.x0, 0.002, CUT.nz], max: [CUT.x1, 0.0028, 0], color: '#000000' },
        { min: [CUT.x0, -1, 0.01], max: [CUT.x1, 0, 0.014], color: '#000000' },
        { min: [CUT.x1, -1, 0.01], max: [CUT.door, -0.48, 0.014], color: '#000000' }
      ], true, 10);
      s.mask.material = maskMat; s.mask.position.y = 5; s.mask.scale.y = 5;
      cut.add(s.mask);
      function voidMat(name, color) {
        return new T.MeshLambertMaterial({ map: B.tex(name), color: color, side: T.BackSide, depthFunc: T.AlwaysDepth,
          stencilWrite: true, stencilRef: STENCIL, stencilFunc: T.EqualStencilFunc, stencilZPass: T.KeepStencilOp });
      }
      var vWall = voidMat('plaster', '#d9cdb4'), vFloor = voidMat('plank', '#b89470');
      var vd = B.mesh([{ min: [CUT.x0, 0, -6], max: [CUT.door, 5, 0], mat: { top: vWall, side: vWall, bottom: vFloor } }]); // 카메라(x>2)에서 보이는 안쪽 면만 그려진다
      vd.children.forEach(function (c) { c.renderOrder = 11; });
      cut.add(vd);
      cut.add(vcMesh([
        { min: [-1.7, 0, -0.08], max: [-1.64, 4, 0], color: '#efe6d2' }, { min: [-1.7, 0, -0.92], max: [-1.64, 4, -0.08], color: '#b9b9b4' },
        { min: [-1.7, 0, -1], max: [-1.64, 4, -0.92], color: '#efe6d2' },                          // 앞벽 단면
        { min: [-1.7, 4, -1.3], max: [-1.64, 5, 0], color: '#b9b9b4' },                            // 지붕(슬래브) 옆 단면
        { min: [-1.7, 4, -1.5], max: [0, 4.99, -1.3], color: '#b9b9b4' },                          // 지붕 앞 단면(전선이 지나감)
        { min: [-1.7, 4, -1.31], max: [0, 4.07, -1.295], color: '#efe6d2' },                       // 천장 마감
        { min: [-1.7, 2.55, -2.8], max: [-1.3, 3.55, -1.6], color: '#8a5a35' },                    // 벽장
        { min: [-1.31, 2.62, -2.72], max: [-1.29, 3.48, -1.68], color: '#b5824f' },
        { min: [-1.6, 0, -3.6], max: [-0.6, 0.42, -2.7], color: '#c0504d' }, { min: [-1.6, 0.42, -3.6], max: [-0.6, 0.9, -3.35], color: '#a8423f' }, // 의자
        { min: [-1, 0, -6.0], max: [1, 2.6, -5.97], color: '#6b5440' },                            // 주방 쪽 문
        { min: [0.6, 0, -5], max: [2, 0.03, -3], color: '#4a7bd0' },                               // 거실 깔개(코어 깔개와 이어짐)
        seg(P[5], P[6], 0.07, '#2b2b2b')                                                           // 전등 줄
      ], false, 12));
      cut.add(vcMesh([
        { min: [-1.2, 3.1, -1.6], max: [-0.5, 3.47, -0.9], color: '#fff3b0' },                    // 전등 갓(켜짐)
        { min: [-0.97, 2.96, -1.36], max: [-0.73, 3.1, -1.12], color: '#ffffff' },
        { min: [-1.65, 0.035, -2.1], max: [0.0, 0.045, -0.4], color: '#fff3b0' }                  // 바닥에 비친 불빛
      ], true, 12));
      var tagLamp = V.textSprite('전등', { height: 0.65 }); tagLamp.position.set(-0.85, 2.4, -0.9); cut.add(tagLamp);
      var tagGrid = V.textSprite('발전소 전기', { height: 0.56 }); tagGrid.position.set(-2.3, 5.25, 1.6); cut.add(tagGrid); // 전봇대 위: 흐린 점이 어디서 오는지(글자 판 4개째)

      ctx.addCollider([1.95, 5, -2.45], [7.45, 7.1, -0.75]);
      ctx.showModelLabel(true);

      // ---- 패널 UI ----
      ui.setInfo(INFO.start);
      s.bar = ui.bar('태양광으로 만드는 전기', { max: 1, color: '#ffd400', format: level });
      var row = ui.row();
      s.btnCover = ui.button('구름으로 가리기', function () { self.moveClouds(ctx, COVER, false); }, { parent: row, primary: true });
      s.btnClear = ui.button('구름 치우기', function () { self.moveClouds(ctx, CLOUD0, false); }, { parent: row });
      ui.legend([{ color: '#fff0a0', text: '긴 막대 — 햇빛' }, { color: '#ffd400', text: '진한 점 — 태양광 전기' }, { color: GRID, text: '흐린 점 — 발전소 전기' }], '화면에서 보는 것');
      ui.button('처음 상태로', function () { self.moveClouds(ctx, CLOUD0, true); }, { small: true });
      s.dbg = ui.body;

      this.occlusion();
      s.bar.set(Math.round(s.p * 100) / 100); s.barV = s.p;
    },

    enter: function (ctx) {
      var s = this.s;
      s.cut.visible = s.sun.visible = s.rays.visible = s.glints.visible = s.pulses.visible = s.gpulses.visible = s.clouds[0].visible = s.clouds[1].visible = true;
      this.showHints(!s.dragged);
      var hint = document.getElementById('chipHint'); // 코어 첫 안내 칩(빗물통으로…)이 해를 가리므로 시설 모드 동안 숨김(lighting.js 와 같은 방식)
      s.hintWas = !!hint && !hint.hidden; if (hint) hint.hidden = true;
      s.cutT0 = performance.now(); s.cutK = 0; this.openCut(0); // 벽이 위에서부터 열린다(화면 변화가 먼저)
      this.occlusion(); s.pS = s.p; this.prefill();
    },

    exit: function (ctx) {
      var s = this.s;
      if (s.anim) { var a = s.anim; s.anim = null; s.clouds.forEach(function (g, i) { g.position.copy(a.to[i]); }); this.settle(ctx, a.reset); }
      s.cut.visible = s.sun.visible = s.rays.visible = s.glints.visible = s.pulses.visible = s.gpulses.visible = s.clouds[0].visible = s.clouds[1].visible = false;
      this.showHints(false); s.clouds.forEach(function (g) { g.scale.setScalar(1); });
      for (var i = 0; i < s.light.length; i++) s.cells.setColorAt(i, s.LIT); // 탐험 중 패널은 맑은 날 그대로(구름 자리는 다시 들어오면 그대로)
      s.cells.instanceColor.needsUpdate = true;
      var hint = document.getElementById('chipHint');
      if (hint && s.hintWas) hint.hidden = false;
      s.hintWas = false;
    },

    moveClouds: function (ctx, to, reset) {
      var s = this.s;
      s.pStart = s.p; s.dragged = true; this.showHints(false);
      s.anim = { t0: performance.now(), dur: 0.8, reset: reset, from: s.clouds.map(function (g) { return g.position.clone(); }),
        to: to.map(function (q) { return new T.Vector3(q[0], q[1], q[2]); }) };
      if (reset) { s.dragged = false; this.showHints(ctx.active); }
    },

    showHints: function (on) { this.s.hints.forEach(function (h) { h.visible = on; }); },

    // 구름이 멈춘 뒤: 막대·문장·주 버튼 갱신, 발전량이 바뀌었으면 기록
    settle: function (ctx, reset) {
      var s = this.s;
      this.occlusion();
      var p = s.p;
      s.bar.set(Math.round(p * 100) / 100); s.barV = p;
      ctx.ui.setInfo(reset ? INFO.start : p >= 0.75 ? INFO.high : p >= 0.45 ? INFO.mid : INFO.low);
      s.btnCover.classList.toggle('primary', p >= 0.6); s.btnClear.classList.toggle('primary', p < 0.6);
      if (!reset && Math.abs(p - s.pStart) >= 0.12) { s.ops++; ctx.markOperated({ delay: 450 }); }
    },

    // 셀마다 햇빛 방향으로 구름 밑면 높이까지 올라가 구름과 겹치는 정도(부드러운 가장자리) → 셀 햇빛·전체 발전량
    occlusion: function () {
      var s = this.s, sd = s.sd, sum = 0;
      for (var i = 0; i < s.cellPos.length; i++) {
        var c = s.cellPos[i], free = 1, best = 0, dcl = 0;
        for (var j = 0; j < 2; j++) {
          var g = s.clouds[j].position, t = (g.y - c.y) / sd.y;
          var qx = c.x + t * sd.x - g.x, qz = c.z + t * sd.z - g.z;
          var r = Math.sqrt(qx * qx / (CHALF[j][0] * CHALF[j][0]) + qz * qz / (CHALF[j][1] * CHALF[j][1]));
          var o = Math.max(0, Math.min(1, (1.1 - r) / 0.35));
          free *= 1 - o;
          if (o > best) { best = o; dcl = (g.y - 0.35 * CSCALE[j] - c.y) / sd.y; }
        }
        s.occ[i] = 1 - free; s.dc[i] = dcl;
        s.light[i] = 1 - DIM * s.occ[i]; sum += s.light[i];
      }
      s.p = sum / s.cellPos.length;
    },

    // 단면 마스크를 위 가장자리에서 아래로 e(0~1)만큼 연다
    openCut: function (e) {
      var s = this.s;
      s.mask.scale.y = Math.max(0.001, 5 * e);
      s.mask.geometry.setDrawRange(0, e >= 1 ? 108 : 72);
      s.mask.visible = e > 0;
    },

    prefill: function () {
      var s = this.s, v = 0.9 + 1.5 * s.pS, rate = 2.3 * s.pS, gap = v / rate;
      s.pn = 0; s.acc = 0;
      for (var d = 0.2; d < s.path.total && s.pn < NPULSE; d += gap) s.pd[s.pn++] = d;
      var grate = 2.6 * Math.max(0, 1 - s.pS - 0.03);
      s.gn = 0; s.gacc = 0;
      if (grate > 0) for (d = 0.2; d < s.gpath.total && s.gn < NPULSE; d += 1.6 / grate) s.gd[s.gn++] = d;
    },

    update: function (dt, ctx) {
      var s = this.s, i;
      if (!ctx.active) return;
      s.t += dt;

      var now = performance.now(); // 애니메이션 끝은 실제 시간 기준(코어 dt 는 0.05 로 잘려 느린 기기에서 늘어진다)
      if (s.cutK < 1) {
        s.cutK = Math.min(1, (now - s.cutT0) / 600);
        this.openCut(1 - Math.pow(1 - s.cutK, 3));
      }
      if (s.anim) {
        var a = s.anim;
        var k = Math.min(1, (now - a.t0) / 1000 / a.dur), ke = k * k * (3 - 2 * k);
        s.clouds.forEach(function (g, j) { g.position.lerpVectors(a.from[j], a.to[j], ke); });
        if (k >= 1) { s.anim = null; this.settle(ctx, a.reset); }
      }
      var pul = s.dragged ? 1 : 1 + 0.06 * (1 - Math.cos(s.t * Math.PI * 2 / 1.4)); // 끌 것 강조
      var pk = Math.min(1, (now - s.cutT0) / 350), pop = 0.6 + 0.4 * pk * (2 - pk); // 등장: 해·구름이 0.35초 동안 0.6→1(끝에서 감속)
      s.clouds.forEach(function (g) { g.scale.setScalar(pul * pop); });

      this.occlusion();
      s.pS += (s.p - s.pS) * Math.min(1, dt * 4);

      // 셀 색: 구름 그늘
      for (i = 0; i < s.light.length; i++) {
        s.col.copy(s.SHADE).lerp(s.LIT, (s.light[i] - (1 - DIM)) / DIM);
        s.cells.setColorAt(i, s.col);
      }
      s.cells.instanceColor.needsUpdate = true;

      // 햇빛 막대
      var reached = 0, sd = s.sd, v = s.v, sc = s.v2;
      for (i = 0; i < NRAY; i++) {
        var r = s.ray[i];
        r.h -= RSPEED * dt;
        if (r.h + RLEN <= 0) { r.h += r.L + RLEN; r.u = rnd(); }
        var blocked = r.u < DIM * s.occ[r.cell], lo = Math.max(r.h, 0), hi = Math.min(r.h + RLEN, r.L + RLEN);
        var thin = !blocked && s.occ[r.cell] > 0.05;
        if (blocked) lo = Math.max(lo, s.dc[r.cell]); else reached++;
        if (thin) hi = Math.min(hi, s.dc[r.cell]); // 구름을 뚫고 지나는 모습 대신 구름 밑에서 가늘게 새어 나온다
        var len = hi - lo;
        if (len < 0.03) sc.set(0, 0, 0); else if (thin) sc.set(0.5, len, 0.5); else sc.set(1, len, 1);
        v.copy(r.tgt).addScaledVector(sd, (lo + hi) / 2);
        s.m4.compose(v, s.rayQ, sc); s.rays.setMatrixAt(i, s.m4);
      }
      s.rays.instanceMatrix.needsUpdate = true; s.reached = reached;

      // 반짝임
      for (i = 0; i < NGLINT; i++) {
        var gg = s.gl[i], tw = Math.max(0, Math.sin(gg.ph + s.t * gg.f * 6.283)), kk = Math.pow(tw, 3) * Math.max(0, (s.light[gg.cell] - 0.45) / 0.55);
        s.m4.makeScale(kk + 1e-4, 1, kk + 1e-4).setPosition(gg.lp).premultiply(s.Marr); s.glints.setMatrixAt(i, s.m4);
      }
      s.glints.instanceMatrix.needsUpdate = true;

      // 전기 점: 발전량에 따라 간격·속도가 바뀐다(0으로 끊기지 않음)
      var pv = 0.9 + 1.5 * s.pS, rate = 2.3 * s.pS, n = 0;
      for (i = 0; i < s.pn; i++) { var d = s.pd[i] + pv * dt; if (d < s.path.total) s.pd[n++] = d; }
      s.pn = n; s.acc += rate * dt;
      while (s.acc >= 1 && s.pn < NPULSE) { s.acc -= 1; s.pd[s.pn++] = (s.acc / rate) * pv; }
      for (i = 0; i < s.pn; i++) { s.path.at(s.pd[i], v); s.m4.makeTranslation(v.x, v.y, v.z); s.pulses.setMatrixAt(i, s.m4); }
      s.pulses.count = s.pn; s.pulses.instanceMatrix.needsUpdate = true;
      // 발전소 전기 점: 태양광 전기가 줄어든 만큼 늘어난다(같은 속도)
      var grate = 2.6 * Math.max(0, 1 - s.pS - 0.03), gv = 1.6;
      for (i = 0, n = 0; i < s.gn; i++) { var dg = s.gd[i] + gv * dt; if (dg < s.gpath.total) s.gd[n++] = dg; }
      s.gn = n; s.gacc += grate * dt;
      while (s.gacc >= 1 && s.gn < NPULSE) { s.gacc -= 1; s.gd[s.gn++] = (s.gacc / grate) * gv; }
      for (i = 0; i < s.gn; i++) { s.gpath.at(s.gd[i], v); s.m4.makeTranslation(v.x, v.y, v.z); s.gpulses.setMatrixAt(i, s.m4); }
      s.gpulses.count = s.gn; s.gpulses.instanceMatrix.needsUpdate = true;

      v.copy(s.sunPos).sub(ctx.camera.position); var sk = 60 / v.length();
      s.sun.position.copy(ctx.camera.position).addScaledVector(v, sk);
      s.sun.lookAt(ctx.camera.position);
      s.sun.scale.setScalar((1 + 0.04 * Math.sin(s.t * 2.2)) * pop * sk);

      // 끄는 동안 막대는 따라 움직이고, 문장은 손을 뗀 뒤에 바뀐다
      s.barT -= dt;
      if (s.barT <= 0) { s.barT = 0.25; if (Math.abs(s.p - s.barV) > 0.02) { s.bar.set(Math.round(s.p * 100) / 100); s.barV = s.p; } }

      // 점검용 상태(내 패널 DOM 안에만 둔다)
      if (now - s.dbgT >= 200) {
        s.dbgT = now;
        var ds = s.dbg.dataset, cam = ctx.camera, own = 0;
        var px = function (x, y, z) { v.set(x, y, z).project(cam); return Math.round((v.x + 1) / 2 * innerWidth) + ',' + Math.round((1 - v.y) / 2 * innerHeight); };
        ctx.root.traverseVisible(function (o) { if (o.isMesh || o.isSprite) own++; });
        ds.power = s.p.toFixed(2); ds.level = level(s.p); ds.rays = reached; ds.pulses = s.pn;
        ds.grid = s.gn; ds.pulseSpeed = pv.toFixed(2); ds.pulseGap = (pv / Math.max(0.01, rate)).toFixed(2); ds.lamp = s.cut.visible ? 'on' : 'hidden'; ds.cut = s.cutK >= 1 ? 'open' : 'opening'; ds.ops = s.ops;
        ds.cloudA = s.clouds[0].position.toArray().map(function (q) { return q.toFixed(2); }).join(',');
        ds.cloudB = s.clouds[1].position.toArray().map(function (q) { return q.toFixed(2); }).join(',');
        var ca = s.clouds[0].position, cb = s.clouds[1].position;
        ds.cloudAPx = px(ca.x, ca.y, ca.z); ds.cloudBPx = px(cb.x, cb.y, cb.z);
        ds.coverAPx = px(COVER[0][0], COVER[0][1], CLOUD_Z); ds.coverBPx = px(COVER[1][0], COVER[1][1], CLOUD_Z);
        ds.ownMeshes = own;
      }
    }
  });
})();
