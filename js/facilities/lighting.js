/* 거실 · 조명과 멀티탭 (energy)
   (a) 조명: 천장의 기존 전등을 LED등으로 바꾼다(되돌릴 수 있음). ‘같은 밝기’(두 전등의 밝기 막대가 같고, 천장에 퍼지는 빛 판도 똑같다)와
       ‘같은 사용 시간’(벽시계와 패널 시계가 한 바퀴)을 고정해서 보여 주고, 그동안 쌓인 ‘전기 사용량’ 상대 막대를 비교한다. LED등 막대가 짧다.
       전선 위 전기 점도 기존 전등은 촘촘하고 빠르게, LED등은 듬성듬성 느리게 흐른다. 숫자·W·요금은 쓰지 않는다(지도서 374·375쪽: 같은 밝기면 전기를 적게 쓰는 전등이 효율이 좋음).
   (b) 멀티탭: ‘컴퓨터 끄기’ → 화면은 꺼지지만 멀티탭 선의 약한 전기 흐름, 깜빡이는 빨간 점, ‘대기 전력’ 이름표가 남는다.
       멀티탭 스위치(3D 탭 또는 버튼)를 끄면 흐름과 표시가 모두 사라진다(지도서 374쪽 대기 전력).
   markOperated: LED등(또는 기존 전등)으로 바꾼 뒤 측정이 끝났을 때, 멀티탭을 껐을 때. 먼저 끝낸 쪽이 ‘내가 살펴본 곳’에 기록된다.
   그리기: 고정 부품은 B.mesh 한 번(재질 4개), 움직이거나 색이 바뀌는 작은 부품은 InstancedMesh 하나(드로콜 1). 누르는 영역은 보이지 않는 상자. */
(function () {
  'use strict';
  var T = THREE, B = EXP.blocks, V = EXP.viz;
  var RUN = 2.6;                        // 시계 긴바늘이 한 바퀴 도는 시간(초) = 두 전등의 ‘같은 사용 시간’
  var USE = { old: 1, led: 0.38 };      // 같은 시간 동안 쌓이는 전기 사용량(상대값). 화면에는 막대 길이와 ‘많음/적음’만 나온다
  var CAM_A = { pos: [2.3, 1.45, -1.9], target: [-0.7, 2.7, -4.7] };    // 천장 전등(위) + 벽시계 + 책상(아래)
  var CAM_B = { pos: [0.7, 1.6, -2.8], target: [-1.6, 1.0, -4.5] };     // 책상 위 컴퓨터·멀티탭
  var PIVOT = [-0.4, 3.93, -4.6];       // 전등이 붙는 천장 판 아래 가운데
  var CLOCK = [-1.953, 2.3, -5.15];    // 벽시계 가운데(서쪽 벽 x=-2, 얼굴은 +x 쪽)
  var SCREEN = [-1.818, 1.28, -4.85];   // 모니터 화면 가운데
  var ROCK_ON = 0.3, ROCK_OFF = -0.3;   // 멀티탭 스위치 기울기(라디안)
  var INK = '#2b2b2b', WHITE = '#f4f1e6', TRIM = '#e9e4d6', ELEC = '#ffd400';
  var NAME = { old: '기존 전등', led: 'LED등' };
  var SAY = {
    a0: '기존 전등을 켰어요. 시계가 한 바퀴 도는 동안 쓰는 전기를 재요.',
    a1: '기존 전등이 쓴 전기를 막대로 쟀어요. 같은 밝기의 LED등으로 바꿔 봐요.',
    a2: 'LED등으로 바꿨어요. 똑같이 시계가 한 바퀴 도는 동안 재요.',
    a3: '밝기와 시간이 같아도 LED등은 전기를 적게 써요. 에너지 효율이 높은 조명이에요.',
    a4: '기존 전등으로 바꿨어요. 똑같이 시계가 한 바퀴 도는 동안 재요.',
    a5: '기존 전등은 이번에도 전기를 많이 썼어요. 같은 밝기라면 LED등이 전기를 적게 써요.',
    b0: '컴퓨터를 다 썼어요. 먼저 컴퓨터를 꺼 봐요.',
    b1: '화면은 꺼졌지만 멀티탭 선에 전기가 조금 흘러요. 이 전기가 대기 전력이에요.',
    b2: '멀티탭을 끄니 대기 전력도 사라졌어요. 다 쓴 기기는 멀티탭까지 꺼요.'
  };

  function approach(v, t, step) { return v < t ? Math.min(t, v + step) : Math.max(t, v - step); }
  function smooth(x) { x = Math.max(0, Math.min(1, x)); return x * x * (3 - 2 * x); }
  function easeOut(x) { x = Math.max(0, Math.min(1, x)); return 1 - (1 - x) * (1 - x); }

  // 다시 쓰는 계산용 객체(매 프레임 new 금지)
  var M = new T.Matrix4(), P = new T.Vector3(), S = new T.Vector3(), Q = new T.Quaternion(), E = new T.Euler();
  var PV = new T.Vector3(PIVOT[0], PIVOT[1], PIVOT[2]), SV = new T.Vector3(SCREEN[0], SCREEN[1], SCREEN[2]);
  var C_GLOW = new T.Color('#fff3b0'), C_OFF = new T.Color('#8c8c86'), C_SCR = new T.Color('#8fd0f0'), C_SCROFF = new T.Color('#1b1f24');
  var C_GREEN = new T.Color('#4cd964'), C_RED = new T.Color('#ff3b30'), C_REDDIM = new T.Color('#6e1f1a');
  var C_ROCKON = new T.Color('#ff8a1f'), C_ROCKOFF = new T.Color('#8c8c86'), C_TMP = new T.Color();

  EXP.registerFacility({
    id: 'lighting',
    cam: CAM_A,

    build: function (ctx) {
      var self = this, root = ctx.root, ui = ctx.ui;
      var s = this.s = {
        part: 'a', time: 0, first: true, timers: [],
        lamp: 'old', glow: 0, glowT: 0, kOld: 1, kLed: 0, anim: null,
        use: { old: 0, led: 0 }, done: { old: false, led: false }, runTime: { old: 0, led: 0 },
        minA: 0, hourA: Math.PI * 5 / 3,      // 시계 바늘 각(12시에서 시계 방향, 라디안). 짧은바늘은 10시에서 시작
        pc: 'on', scr: 1, scrT: 1, rock: ROCK_ON, stbyK: 0, stbyT: 0,
        info: { a: SAY.a0, b: SAY.b0 }
      };

      /* ---------- 고정 부품: B.mesh 한 번(darkwood · 먹색 · 흰색 · metal = 드로콜 4) ---------- */
      var bx = [];
      function add(min, max, mat) { bx.push({ min: min, max: max, mat: mat }); }
      // 책상(서쪽 벽 앞)
      add([-2.0, 0.7, -5.75], [-1.1, 0.76, -3.65], 'darkwood');
      [[-1.97, -1.91], [-1.19, -1.13]].forEach(function (x) {
        [[-5.72, -5.66], [-3.74, -3.68]].forEach(function (z) { add([x[0], 0, z[0]], [x[1], 0.7, z[1]], 'darkwood'); });
      });
      // 모니터: 받침(강철) + 테두리(먹색). 화면은 아래 dyn 부품
      add([-1.95, 0.76, -5.0], [-1.7, 0.785, -4.7], 'metal');
      add([-1.93, 0.785, -4.9], [-1.88, 1.1, -4.8], 'metal');
      add([-1.88, 0.98, -5.3], [-1.82, 1.58, -4.4], INK);
      // 컴퓨터 본체 + 앞면 홈·전원 단추 테
      add([-1.96, 0.76, -5.68], [-1.52, 1.28, -5.43], WHITE);
      add([-1.52, 1.17, -5.63], [-1.514, 1.2, -5.48], INK);
      add([-1.52, 1.05, -5.6], [-1.516, 1.12, -5.52], INK);
      // 키보드 · 마우스
      add([-1.62, 0.76, -5.05], [-1.42, 0.785, -4.55], INK);
      add([-1.52, 0.76, -4.48], [-1.43, 0.79, -4.38], WHITE);
      // 멀티탭: 몸통 + 콘센트 구멍 3 + 꽂힌 플러그 2(본체·모니터)
      add([-1.52, 0.76, -4.32], [-1.26, 0.85, -3.74], WHITE);
      [-4.24, -4.11, -3.98].forEach(function (z) { add([-1.435, 0.85, z - 0.045], [-1.345, 0.856, z + 0.045], INK); });
      [-4.24, -4.11].forEach(function (z) { add([-1.43, 0.856, z - 0.035], [-1.35, 0.91, z + 0.035], INK); });
      // 벽 콘센트 → 멀티탭 선, 멀티탭 → 본체 선, 멀티탭 → 모니터 선
      add([-2.0, 0.98, -4.02], [-1.975, 1.2, -3.78], WHITE);
      add([-1.975, 1.05, -3.94], [-1.935, 1.13, -3.86], INK);
      add([-1.975, 0.76, -3.92], [-1.94, 1.05, -3.88], INK);
      add([-1.975, 0.76, -3.92], [-1.52, 0.78, -3.88], INK);
      add([-1.97, 0.76, -4.26], [-1.52, 0.775, -4.22], INK);
      add([-1.995, 0.76, -5.43], [-1.955, 0.775, -4.22], INK);
      add([-1.93, 0.76, -4.13], [-1.52, 0.775, -4.09], INK);
      add([-1.93, 0.76, -4.8], [-1.89, 0.775, -4.09], INK);
      // 천장 전등 판 + 벽 스위치에서 전등까지 가는 전선
      add([-1.05, 3.93, -5.0], [0.25, 4.0, -4.2], WHITE);
      add([-2.0, 1.2, -3.45], [-1.975, 1.45, -3.25], WHITE);
      add([-1.975, 1.29, -3.38], [-1.96, 1.36, -3.32], INK);
      add([-1.99, 1.45, -3.37], [-1.96, 3.99, -3.33], INK);
      add([-1.99, 3.96, -3.37], [-0.38, 3.99, -3.33], INK);
      add([-0.42, 3.96, -4.2], [-0.38, 3.99, -3.33], INK);
      // 벽시계: 흰 얼굴 + 먹색 테·눈금·가운데 마개(바늘은 dyn)
      // (탐험 중 떠 있는 에너지 표식(-1.4, 2.8, -4.6)과 겹치지 않게 모니터 위 북쪽에 둔다)
      add([-2.0, 2.0, -5.45], [-1.96, 2.6, -4.85], WHITE);
      add([-2.0, 2.57, -5.48], [-1.95, 2.63, -4.82], INK); add([-2.0, 1.97, -5.48], [-1.95, 2.03, -4.82], INK);
      add([-2.0, 1.97, -5.48], [-1.95, 2.63, -5.42], INK); add([-2.0, 1.97, -4.88], [-1.95, 2.63, -4.82], INK);
      add([-1.96, 2.48, -5.17], [-1.955, 2.54, -5.13], INK); add([-1.96, 2.06, -5.17], [-1.955, 2.12, -5.13], INK);
      add([-1.96, 2.28, -5.39], [-1.955, 2.32, -5.33], INK); add([-1.96, 2.28, -4.97], [-1.955, 2.32, -4.91], INK);
      add([-1.95, 2.285, -5.165], [-1.944, 2.315, -5.135], INK);
      root.add(B.mesh(bx));

      /* ---------- 움직이거나 색이 바뀌는 부품: InstancedMesh 하나(드로콜 1) ---------- */
      var I = [], ix = {};
      function inst(name, min, max, col) {
        ix[name] = I.length;
        I.push({ c: new T.Vector3((min[0] + max[0]) / 2, (min[1] + max[1]) / 2, (min[2] + max[2]) / 2),
          s: new T.Vector3(max[0] - min[0], max[1] - min[1], max[2] - min[2]), col: new T.Color(col) });
      }
      // 기존 전등: 받침 두 개 + 빛나는 관 두 개
      inst('oHoldL', [-1.0, 3.78, -4.9], [-0.9, 3.93, -4.3], TRIM);
      inst('oHoldR', [0.1, 3.78, -4.9], [0.2, 3.93, -4.3], TRIM);
      inst('oTube1', [-0.9, 3.79, -4.79], [0.1, 3.91, -4.67], '#fff3b0');
      inst('oTube2', [-0.9, 3.79, -4.53], [0.1, 3.91, -4.41], '#fff3b0');
      // LED등: 얇은 틀 + 빛나는 판
      inst('lFrame', [-1.0, 3.88, -4.95], [0.2, 3.93, -4.25], TRIM);
      inst('lFace', [-0.95, 3.86, -4.9], [0.15, 3.88, -4.3], '#fff3b0');
      // 천장에 퍼지는 빛(두 전등 모두 같은 크기·같은 색 = 같은 밝기)
      inst('glowOut', [-1.85, 3.9935, -5.7], [1.05, 3.9955, -3.5], '#f6e7a8');
      inst('glowIn', [-1.3, 3.9955, -5.3], [0.5, 3.9975, -3.9], '#fff3b0');
      // 시계 바늘(길이는 y, 폭은 z, 두께는 x)
      inst('hMin', [0, 0, 0], [0.006, 0.23, 0.03], INK);
      inst('hHour', [0, 0, 0], [0.006, 0.15, 0.045], INK);
      // 모니터 화면: 바탕 + 언덕 + 창 + 창 머리
      inst('sBg', [-1.821, 1.03, -5.25], [-1.817, 1.53, -4.45], '#8fd0f0');
      inst('sHill', [-1.817, 1.03, -5.25], [-1.814, 1.14, -4.45], '#6aa84a');
      inst('sWin', [-1.817, 1.19, -5.0], [-1.813, 1.43, -4.66], '#fffdf5');
      inst('sTitle', [-1.813, 1.39, -5.0], [-1.81, 1.43, -4.66], '#ffd34d');
      // 전원 표시 점(켜짐 초록 → 대기 전력 빨강 깜빡임 → 사라짐)
      inst('dPc', [-1.516, 1.045, -5.605], [-1.505, 1.125, -5.515], '#4cd964');
      inst('dTap', [-1.262, 0.775, -3.865], [-1.25, 0.835, -3.805], '#4cd964'); // 멀티탭 앞면 표시등
      inst('dMon', [-1.821, 0.99, -5.275], [-1.814, 1.026, -5.239], '#4cd964');
      // 멀티탭 스위치(흔들 스위치)
      inst('rock', [-1.47, 0.85, -3.89], [-1.31, 0.91, -3.77], '#ff8a1f');
      var dyn = new T.InstancedMesh(new T.BoxGeometry(1, 1, 1), new T.MeshBasicMaterial({ color: '#ffffff' }), I.length);
      dyn.name = 'lt-dyn'; dyn.frustumCulled = false; dyn.userData.ix = ix;
      dyn.raycast = function () {}; // 누르기는 보이지 않는 상자가 맡는다
      I.forEach(function (d, i) { dyn.setColorAt(i, d.col); });
      root.add(dyn);
      s.dyn = dyn; s.I = I; s.ix = ix;

      /* ---------- 전기 흐름(노란 점) ---------- */
      var lampPath = [[-1.94, 1.46, -3.35], [-1.94, 3.93, -3.35], [-0.4, 3.93, -3.35], [-0.4, 3.93, -4.25]];
      s.fLampOld = V.flow(lampPath, { color: ELEC, count: 9, size: 0.1, speed: 1.6 });
      s.fLampLed = V.flow(lampPath, { color: ELEC, count: 4, size: 0.1, speed: 0.9 });
      // 콘센트 → 벽 → 책상 → 멀티탭 윗면 → 본체 선(책상 위 전선에 붙어서 흐른다)
      var pcPath = [[-1.955, 1.09, -3.9], [-1.955, 0.795, -3.9], [-1.52, 0.795, -3.9], [-1.49, 0.875, -3.9], [-1.49, 0.875, -4.24],
        [-1.52, 0.79, -4.24], [-1.97, 0.79, -4.24], [-1.975, 0.79, -5.42]];
      s.fPcStrong = V.flow(pcPath, { color: ELEC, count: 10, size: 0.06, speed: 1.5 });
      s.fPcWeak = V.flow(pcPath, { color: ELEC, count: 3, size: 0.05, speed: 0.45 });
      [['lt-flow-lamp-old', s.fLampOld], ['lt-flow-lamp-led', s.fLampLed], ['lt-flow-pc-strong', s.fPcStrong], ['lt-flow-pc-weak', s.fPcWeak]]
        .forEach(function (p) { p[1].object3d.name = p[0]; p[1].object3d.visible = false; root.add(p[1].object3d); });

      /* ---------- 이름표(글자 판 3개, 한 번에 2개까지 보임) ---------- */
      s.tagOld = V.textSprite(NAME.old, { height: 0.26 }); s.tagOld.position.set(-0.4, 3.32, -4.6); s.tagOld.name = 'lt-label-old';
      s.tagLed = V.textSprite(NAME.led, { height: 0.26 }); s.tagLed.position.set(-0.4, 3.32, -4.6); s.tagLed.name = 'lt-label-led';
      s.tagStby = V.textSprite('대기 전력', { height: 0.24, color: '#c0271d' }); s.tagStby.position.set(-1.65, 1.5, -3.85); s.tagStby.name = 'lt-label-standby';
      s.tagStbyScale = s.tagStby.scale.clone();
      s.tagLed.visible = false; s.tagStby.visible = false;
      root.add(s.tagOld, s.tagLed, s.tagStby);

      /* ---------- 누르는 영역(보이지 않는 상자: 그리지 않고 레이캐스트만) ---------- */
      var hitMat = new T.MeshBasicMaterial(); hitMat.visible = false;
      function hit(name, min, max) {
        var m = new T.Mesh(new T.BoxGeometry(max[0] - min[0], max[1] - min[1], max[2] - min[2]), hitMat);
        m.position.set((min[0] + max[0]) / 2, (min[1] + max[1]) / 2, (min[2] + max[2]) / 2); m.name = name; root.add(m); return m;
      }
      var hitLamp = hit('lt-hit-lamp', [-1.15, 3.6, -5.15], [0.35, 4.0, -4.05]);
      var hitPc = hit('lt-hit-pc', [-2.0, 0.76, -5.75], [-1.45, 1.62, -4.4]);
      var hitTap = hit('lt-hit-tap', [-1.6, 0.74, -4.4], [-1.15, 1.0, -3.65]);
      ctx.addCollider([-2.0, 0, -5.75], [-1.1, 0.76, -3.65]);
      ctx.showModelLabel(true); // 전선 위 전기 점은 원리를 보여 주는 모형

      /* ---------- 패널 ---------- */
      var COL = 'display:flex;flex-direction:column;gap:6px';
      var tabs = ui.row();
      s.tabA = ui.button('조명', function () { self.setPart(ctx, 'a'); }, { parent: tabs });
      s.tabB = ui.button('멀티탭', function () { self.setPart(ctx, 'b'); }, { parent: tabs });
      var boxA = s.boxA = ui.el('div'); boxA.style.cssText = COL;
      var boxB = s.boxB = ui.el('div'); boxB.style.cssText = COL; boxB.hidden = true;

      // (a) 조명: 교체 버튼 + 비교 카드(조건 = 같은 밝기·같은 사용 시간, 결과 = 전기 사용량)
      var rowA = ui.row(boxA); // 교체·처음 상태로를 한 줄에(1000×600에서 스크롤 없이 다 보이게)
      s.btnSwap = ui.button('LED등으로 바꾸기', function () { self.swap(ctx); }, { parent: rowA, primary: true });
      var card = ui.el('div', null, null, boxA);
      card.style.cssText = 'border:2px solid #2b2b2b;border-radius:12px;background:#fff;padding:8px 10px;display:grid;' +
        'grid-template-columns:max-content 52px 1fr max-content;gap:6px 8px;align-items:center;font-size:16px;font-weight:700;word-break:keep-all';
      function cell(parent, text, css) { var e = ui.el('span', null, text, parent); if (css) e.style.cssText = css; return e; }
      var HDR = 'font-size:16px;font-weight:800;color:#5c5a55';
      cell(card, ''); cell(card, '밝기', HDR); cell(card, '전기 사용량', HDR + ';grid-column:span 2');
      s.rowName = {}; s.elFill = {}; s.elVal = {}; s.ltFill = {};
      ['old', 'led'].forEach(function (k) {
        s.rowName[k] = cell(card, NAME[k], 'padding:1px 6px;border-radius:6px');
        var lt = cell(card, null, 'display:block;height:14px;border:2px solid #2b2b2b;border-radius:5px;background:#4a4842;overflow:hidden');
        s.ltFill[k] = cell(lt, null, 'display:block;height:100%;width:85%;background:#fff3b0');
        var et = cell(card, null, 'display:block;height:18px;border:3px solid #2b2b2b;border-radius:7px;background:#eee;overflow:hidden');
        s.elFill[k] = cell(et, null, 'display:block;height:100%;width:0;transition:width .2s linear;background:' + (k === 'old' ? '#8a96a3' : ELEC));
        s.elVal[k] = cell(card, '아직', 'min-width:2.2em;text-align:right');
      });
      var chips = cell(card, null, 'grid-column:1/-1;display:flex;flex-wrap:wrap;gap:6px;align-items:center;margin-top:2px');
      var CHIP = 'display:inline-flex;align-items:center;gap:5px;padding:2px 10px;border:2px solid #2b2b2b;border-radius:999px;font-size:16px;font-weight:700;background:#fff';
      cell(chips, '같은 밝기', CHIP);
      s.chipTime = cell(chips, null, CHIP);
      var clk = cell(s.chipTime, null, 'position:relative;display:inline-block;width:20px;height:20px;border:2px solid #2b2b2b;border-radius:50%;background:#fff;flex:none');
      s.clkHand = cell(clk, null, 'position:absolute;left:7px;top:1px;width:2px;height:7px;background:#2b2b2b;transform-origin:50% 100%');
      cell(s.chipTime, '같은 사용 시간');
      ui.button('처음 상태로', function () { self.resetA(ctx); }, { small: true, parent: rowA }).style.flex = 'none';

      // (b) 멀티탭: 버튼 두 개 + 흐르는 전기 막대 + 범례
      var rowB = ui.row(boxB);
      s.btnPc = ui.button('컴퓨터 끄기', function () { if (s.pc === 'on') self.pcOff(ctx); else self.pcOn(ctx); }, { parent: rowB, primary: true });
      s.btnTap = ui.button('멀티탭 끄기', function () { self.tapToggle(ctx); }, { parent: rowB });
      s.barB = ui.bar('멀티탭으로 흐르는 전기', { max: 1, color: ELEC, parent: boxB, value: 1,
        format: function (v) { return v >= 0.9 ? '많음' : v > 0.01 ? '조금' : '없음'; } });
      ui.legend([{ color: ELEC, text: '노란 점 — 선을 따라 흐르는 전기' }, { color: '#ff3b30', text: '깜빡이는 빨간 점 — 대기 전력 표시등' }], null, { parent: boxB });
      ui.button('처음 상태로', function () { self.resetB(ctx); }, { small: true, parent: boxB });

      // 3D 오브젝트 직접 누르기(다른 부분을 보고 있으면 먼저 그쪽으로 전환)
      ctx.onTap(hitLamp, function () { if (s.part !== 'a') self.setPart(ctx, 'a'); else self.swap(ctx); });
      ctx.onTap(hitPc, function () { if (s.part !== 'b') self.setPart(ctx, 'b'); else if (s.pc === 'on') self.pcOff(ctx); else self.pcOn(ctx); });
      ctx.onTap(hitTap, function () { if (s.part !== 'b') self.setPart(ctx, 'b'); else self.tapToggle(ctx); });

      ui.setInfo(s.info.a);
      this.markTabs(); this.refreshA(); this.refreshB(); this.draw(false);
    },

    enter: function (ctx) {
      var s = this.s;
      if (s.first) { // 처음 들어올 때: 천장 전등이 먼저 켜지고 시계가 돌기 시작한다(화면 변화가 먼저)
        s.first = false; s.glowT = 1;
        this.startMeasure('old', 0.35, false);
        this.say(ctx, 'a', SAY.a0);
      }
      ctx.ui.setInfo(s.info[s.part]);
      if (s.part === 'b') ctx.moveCamera(CAM_B.pos, CAM_B.target, 1.0);
      // shortcut: 코어 첫 안내 칩(빗물통으로 가 보세요)을 시설 안에서만 가린다. 코어가 시설 모드에서 칩을 숨기게 되면 지운다
      var hint = document.getElementById('chipHint');
      s.hintWas = !!hint && !hint.hidden; if (hint) hint.hidden = true;
    },
    exit: function () {
      var hint = document.getElementById('chipHint');
      if (hint && this.s.hintWas) hint.hidden = false;
      this.s.hintWas = false;
    },

    /* ---------- 공통 ---------- */
    setPart: function (ctx, p) {
      var s = this.s; if (s.part === p) return;
      s.part = p; s.boxA.hidden = p !== 'a'; s.boxB.hidden = p !== 'b';
      this.markTabs(); ctx.ui.setInfo(s.info[p]);
      var c = p === 'a' ? CAM_A : CAM_B; ctx.moveCamera(c.pos, c.target, 0.8);
    },
    markTabs: function () {
      var s = this.s;
      [[s.tabA, 'a', '조명'], [s.tabB, 'b', '멀티탭']].forEach(function (t) {
        var on = s.part === t[1];
        t[0].classList.toggle('on', on); t[0].textContent = (on ? '✓ ' : '') + t[2]; t[0].setAttribute('aria-pressed', on ? 'true' : 'false');
      });
      // 지금 보는 부분의 전기 점만 노랑, 다른 부분은 회색·절반 속도(아트 디렉션 §5 흐림)
      [[s.fLampOld, 1.6, 'a'], [s.fLampLed, 0.9, 'a'], [s.fPcStrong, 1.5, 'b'], [s.fPcWeak, 0.45, 'b']].forEach(function (f) {
        var on = s.part === f[2]; f[0].setColor(on ? ELEC : '#c8ccd0'); f[0].speed = on ? f[1] : f[1] / 2;
      });
    },
    say: function (ctx, p, text) { this.s.info[p] = text; if (this.s.part === p) ctx.ui.setInfo(text); },
    later: function (sec, fn) { this.s.timers.push({ t: sec, fn: fn }); },

    /* ---------- (a) 조명 ---------- */
    startMeasure: function (which, wait, user) {
      var s = this.s;
      s.anim = { kind: 'measure', lamp: which, t: -(wait || 0), user: user };
      s.use[which] = 0; s.done[which] = false; s.runTime[which] = 0;
      this.refreshA();
    },
    swap: function (ctx) {
      var s = this.s; if (s.anim) return;
      s.anim = { kind: 'swap', to: s.lamp === 'old' ? 'led' : 'old', t: 0 };
      s.glowT = 0; // 누르자마자 전등이 꺼지고 떼어진다(3D가 먼저)
    },
    resetA: function (ctx) {
      var s = this.s; if (s.anim) return;
      s.lamp = 'old'; s.kOld = 1; s.kLed = 0; s.glowT = 1;
      s.use.old = s.use.led = 0; s.done.old = s.done.led = false; s.runTime.old = s.runTime.led = 0;
      this.startMeasure('old', 0.3, false);
      this.say(ctx, 'a', SAY.a0);
    },
    stepAnim: function (dt, ctx) {
      var s = this.s, a = s.anim, t;
      a.t += dt; t = a.t;
      if (a.kind === 'swap') {
        // 0~0.15 꺼짐 → 0.15~0.45 떼기(크기 1→0) → 0.45~0.8 달기(0.6→1) → 0.85 켜짐 → 같은 시간 동안 측정
        var kOut = 1 - smooth((t - 0.15) / 0.3), kIn = t < 0.45 ? 0 : 0.6 + 0.4 * easeOut((t - 0.45) / 0.35);
        if (a.to === 'led') { s.kOld = kOut; s.kLed = kIn; } else { s.kLed = kOut; s.kOld = kIn; }
        if (t >= 0.45 && s.lamp !== a.to) { s.lamp = a.to; this.refreshA(); }
        if (t >= 0.85) {
          s.glowT = 1;
          this.say(ctx, 'a', a.to === 'led' ? SAY.a2 : SAY.a4);
          this.startMeasure(a.to, 0.25, true);
        }
        return;
      }
      if (t < 0) return;
      var k = Math.min(t, RUN), w = a.lamp;
      s.minA = Math.PI * 2 * k / RUN; s.use[w] = USE[w] * k / RUN; s.runTime[w] = k;
      if (t >= RUN) {
        s.minA = 0; s.hourA += Math.PI / 6; s.done[w] = true; s.anim = null;
        this.say(ctx, 'a', w === 'led' ? SAY.a3 : (s.done.led ? SAY.a5 : SAY.a1));
        if (a.user) ctx.markOperated({ delay: 150 }); // 전등을 바꿔 같은 조건에서 비교를 마쳤을 때
      }
      this.refreshA();
    },
    refreshA: function () {
      var s = this.s, a = s.anim, measuring = a && a.kind === 'measure' ? a.lamp : null;
      ['old', 'led'].forEach(function (k) {
        s.elFill[k].style.width = (s.use[k] * 100).toFixed(1) + '%';
        s.elVal[k].textContent = measuring === k ? '…' : s.done[k] ? (k === 'led' ? '적음' : s.done.led ? '많음' : '다 잼') : '아직'; // 비교 전에는 ‘많음’이라 단정하지 않는다
        s.rowName[k].style.background = s.lamp === k ? '#fff3b0' : 'transparent';
      });
      s.btnSwap.textContent = s.lamp === 'old' ? 'LED등으로 바꾸기' : '기존 전등으로 바꾸기';
      s.btnSwap.classList.toggle('primary', !s.done.led);
      s.clkHand.style.transform = 'rotate(' + (s.minA * 180 / Math.PI).toFixed(1) + 'deg)';
      s.chipTime.style.background = measuring ? '#fff3b0' : '#fff';
      s.tagOld.visible = s.lamp === 'old'; s.tagLed.visible = s.lamp === 'led';
    },

    /* ---------- (b) 멀티탭 ---------- */
    pcOff: function (ctx) {
      var s = this.s, self = this; if (s.pc !== 'on') return;
      s.pc = 'standby'; s.scrT = 0; s.stbyT = 1; s.timers.length = 0; this.refreshB();
      this.later(0.5, function () { s.barB.set(0.15); self.say(ctx, 'b', SAY.b1); });
    },
    pcOn: function (ctx) {
      var s = this.s, self = this;
      if (s.pc === 'off') { ctx.toast('멀티탭이 꺼져 있어서 컴퓨터가 켜지지 않아요.'); return; }
      if (s.pc !== 'standby') return;
      s.pc = 'on'; s.scrT = 1; s.stbyT = 0; s.timers.length = 0; this.refreshB();
      this.later(0.4, function () { s.barB.set(1); self.say(ctx, 'b', SAY.b0); });
    },
    tapToggle: function (ctx) {
      var s = this.s, self = this;
      if (s.pc === 'on') { ctx.toast('먼저 컴퓨터를 꺼 주세요.'); return; }
      s.timers.length = 0;
      if (s.pc === 'standby') {
        s.pc = 'off'; s.stbyT = 0; this.refreshB();
        this.later(0.35, function () { s.barB.set(0); self.say(ctx, 'b', SAY.b2); ctx.markOperated({ delay: 250 }); });
      } else {
        s.pc = 'standby'; s.stbyT = 1; this.refreshB();
        this.later(0.4, function () { s.barB.set(0.15); self.say(ctx, 'b', SAY.b1); });
      }
    },
    resetB: function (ctx) {
      var s = this.s;
      s.pc = 'on'; s.scrT = 1; s.stbyT = 0; s.timers.length = 0; s.barB.set(1);
      this.refreshB(); this.say(ctx, 'b', SAY.b0);
    },
    refreshB: function () {
      var s = this.s, on = s.pc === 'on', off = s.pc === 'off';
      s.btnPc.textContent = on ? '컴퓨터 끄기' : '컴퓨터 켜기';
      s.btnTap.textContent = off ? '멀티탭 켜기' : '멀티탭 끄기';
      s.btnPc.classList.toggle('primary', on); s.btnTap.classList.toggle('primary', s.pc === 'standby');
      s.fPcStrong.object3d.visible = on; s.fPcWeak.object3d.visible = s.pc === 'standby';
    },

    /* ---------- 매 프레임 ---------- */
    update: function (dt, ctx) {
      var s = this.s, i;
      s.time += dt;
      for (i = s.timers.length - 1; i >= 0; i--) { var tm = s.timers[i]; tm.t -= dt; if (tm.t <= 0) { s.timers.splice(i, 1); tm.fn(); } }
      if (s.anim) this.stepAnim(dt, ctx);
      s.glow = approach(s.glow, s.glowT, dt / 0.25);
      s.scr = approach(s.scr, s.scrT, dt / 0.3);
      s.stbyK = approach(s.stbyK, s.stbyT, dt / 0.3);
      s.rock += ((s.pc === 'off' ? ROCK_OFF : ROCK_ON) - s.rock) * Math.min(1, dt * 14);
      var lit = s.glow > 0.5;
      s.fLampOld.object3d.visible = lit && s.lamp === 'old';
      s.fLampLed.object3d.visible = lit && s.lamp === 'led';
      s.tagStby.visible = s.stbyK > 0.02;
      if (s.tagStby.visible) s.tagStby.scale.copy(s.tagStbyScale).multiplyScalar(0.6 + 0.4 * easeOut(s.stbyK));
      this.draw(ctx.active);
    },

    // dyn 부품 자리·색을 다시 쓴다(부품 20개 남짓: 가벼움)
    draw: function (active) {
      var s = this.s, I = s.I, ix = s.ix, dyn = s.dyn, i;
      function put(name, k, pivot, rx) {
        var d = I[ix[name]]; k = Math.max(k, 1e-4);
        if (pivot) P.copy(d.c).sub(pivot).multiplyScalar(k).add(pivot); else P.copy(d.c);
        S.copy(d.s).multiplyScalar(k); Q.setFromEuler(E.set(rx || 0, 0, 0));
        dyn.setMatrixAt(ix[name], M.compose(P, Q, S));
      }
      function hand(name, ang) { // 벽(+x를 보는 면)에서 시계 방향 = 위(+y) → 오른쪽(-z)
        var d = I[ix[name]];
        P.set(CLOCK[0], CLOCK[1] + Math.cos(ang) * d.s.y / 2, CLOCK[2] - Math.sin(ang) * d.s.y / 2);
        Q.setFromEuler(E.set(-ang, 0, 0)); dyn.setMatrixAt(ix[name], M.compose(P, Q, d.s));
      }
      function col(name, c) { dyn.setColorAt(ix[name], c); }
      // ‘지금 누를 것’ 맥박(1.4초 주기, 크기 1→1.06 / 스위치 1→1.15)
      var beat = 0.5 - 0.5 * Math.cos(s.time * Math.PI * 2 / 1.4);
      var pulseA = active && s.part === 'a' && !s.anim && !s.done.led ? 1 + 0.06 * beat : 1;
      var pulseB = active && s.part === 'b' && s.pc === 'standby' ? 1 + 0.15 * beat : 1;
      ['oHoldL', 'oHoldR', 'oTube1', 'oTube2'].forEach(function (n) { put(n, s.kOld * pulseA, PV); });
      ['lFrame', 'lFace'].forEach(function (n) { put(n, s.kLed * pulseA, PV); });
      C_TMP.copy(C_OFF).lerp(C_GLOW, s.glow); col('oTube1', C_TMP); col('oTube2', C_TMP); col('lFace', C_TMP);
      var g = smooth(s.glow); put('glowOut', g, PV); put('glowIn', g, PV);
      hand('hMin', s.minA); hand('hHour', s.hourA);
      put('sBg', 1); C_TMP.copy(C_SCROFF).lerp(C_SCR, s.scr); col('sBg', C_TMP);
      for (i = 0; i < 3; i++) put(['sHill', 'sWin', 'sTitle'][i], s.scr, SV);
      var dotK = s.pc === 'off' ? 0 : 1, dotC = s.pc === 'on' ? C_GREEN : (s.time % 1 < 0.5 ? C_RED : C_REDDIM);
      put('dPc', dotK); put('dMon', dotK); put('dTap', dotK); col('dPc', dotC); col('dMon', dotC); col('dTap', dotC);
      put('rock', pulseB, null, s.rock); col('rock', s.pc === 'off' ? C_ROCKOFF : C_ROCKON);
      dyn.instanceMatrix.needsUpdate = true; dyn.instanceColor.needsUpdate = true;
    }
  });
})();
