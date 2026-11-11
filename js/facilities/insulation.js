/* 겨울 거실 · 벽과 창(단열) — 완성 구현.
   장면: 창밖에 눈이 내리고, 창 아래 난방기가 거실을 데운다(굵은 빨강 = 따뜻한 공기).
   ‘벽 단면 열기’ → 창 왼쪽 벽 한 조각이 방 안으로 밀려 나와 잘린 면을 보인다: 창 아래·위 띠는 바깥 벽 | 단열재 | 실내 마감,
   가운데 띠는 창의 유리와 사이 공기층. 작은 주황 점(열이 이동하는 모습을 나타내는 기호)이 실내에서 벽과 창을 가로질러 바깥으로 간다.
   단열재 넣기·두껍게, 이중창·삼중창 → 열 알갱이의 줄 수와 빠르기가 줄어든다(0은 아님: 단열은 열의 이동을 늦춘다).
   ‘난방 끄고 비교’ → 따뜻함 상대 막대 두 개(단열 안 한 집 / 우리 집)가 다른 빠르기로 준다. 숫자는 쓰지 않는다. */
(function () {
  'use strict';
  var T = THREE, B = EXP.blocks, V = EXP.viz;

  // 단면 모형: 동쪽 벽 안쪽 면(x=7) 창 왼쪽에 덧댄다. 잘린 면은 z=ZC 에서 카메라 쪽(+z)을 본다
  var XO = 7, ZC = -4.65, ZB = -5.75, ZH = ZC + 0.05;      // ZH = 열 알갱이가 지나는 면(잘린 면 바로 앞)
  var OUT_T = 0.42, FIN_T = 0.12, INS = [0, 0.3, 0.55];     // 바깥 벽층 · 실내 마감 · 단열재(없음/넣기/두껍게) 두께
  var BANDS = [[0, 1], [2.6, 2.95]];                         // 벽 띠: 창 아래, 창 위. 창 띠는 y 1~2.6
  var WALL_ROWS = [[0.3, 0.7, 2.78], [0.5, 2.78], [0.5]];   // 열 알갱이 줄(최소 1줄은 남긴다)
  var WIN_ROWS = [[1.4, 1.8, 2.2], [1.6, 2.05], [1.82]];
  var WALL_SPD = [0.28, 0.18, 0.12], WIN_SPD = [0.4, 0.22, 0.13];  // m/s, 아트 디렉션 §5(열 0.25~0.4, 보강 뒤 0.12까지). 홑창이 벽보다 한 단계 빠르다(열이 잘 빠져나가는 곳)
  var WALL_LOSS = [0.6, 0.32, 0.2], WIN_LOSS = [0.4, 0.22, 0.14]; // 따뜻함이 주는 상대 빠르기(단열 안 한 집 = 1), 측정값 아님
  var COOL = 0.15, CMP_T = 5, HN = 64, SN = 48;
  var INK = '#2b2b2b', CONC = '#b9b9b4', INSC = '#f3dc9a', DOT = '#d9bb62', FIN = '#efe6d2',
    PANE = '#cfeaf7', AIR = '#f4fbff', FRAME = '#8a8178', SNOW = '#f4f8fb', SNOW2 = '#c9d3dc';
  var SASH = [[7.5], [7.38, 7.62], [7.26, 7.5, 7.74]];    // 진짜 창 구멍(x 7~8) 안의 창틀 위치
  var DOTS = [[0.2, 0.12], [0.7, 0.2], [0.4, 0.38], [0.8, 0.5], [0.25, 0.62], [0.6, 0.78], [0.15, 0.9], [0.75, 0.93],
    [0.45, 2.67], [0.8, 2.72], [0.2, 2.86], [0.6, 2.9]];
  var TXT = {
    start: '창밖에는 눈이 내리고, 거실은 난방기로 따뜻해요. 벽 속은 어떻게 생겼을까요?',
    open: '벽 속이 보여요. 작은 주황 점은 열이 실내에서 바깥으로 이동하는 모습을 나타내요.',
    ins: ['단열재가 없으면 열이 벽을 빠르게, 많이 지나가요.',
      '단열재가 열의 이동을 늦춰요. 벽을 지나는 열이 느려지고 줄었어요.',
      '두꺼우면 열이 더 천천히 빠져나가요. 단열재가 열을 ‘막는다’는 건 이렇게 아주 느리게 한다는 뜻이에요.'],
    win: ['홑창은 유리가 한 장이라 열이 쉽게 빠져나가요.',
      '이중창은 유리 두 장 사이에 공기층이 있어서 열의 이동이 느려져요.',
      '삼중창은 유리 석 장과 공기층 두 개가 열의 이동을 더 늦춰요.'],
    cmpRun: '난방을 껐어요. 두 집의 따뜻함이 줄어드는 빠르기를 지켜봐요.',
    cmpBetter: '우리 집이 더 천천히 식었어요. 집 모형 실험에서 단열한 집의 온도 변화가 더 작았던 것과 같아요.',
    cmpSame: '두 집이 똑같이 빨리 식었어요. 단열재를 넣거나 창을 바꾸고 다시 비교해 보세요.'
  };
  var MTX = new T.Matrix4(), RAD_OFF = new T.Color('#b5aea2'), RAD_ON = new T.Color('#ff7a4d');

  function approach(v, to, step) { return v < to ? Math.min(to, v + step) : Math.max(to, v - step); }
  function ease(k) { return 1 - (1 - k) * (1 - k) * (1 - k); }
  function word(v) { return v > 0.66 ? '많음' : v > 0.4 ? '보통' : '적음'; }

  /* 색이 다른 상자 여럿을 메시 하나(드로콜 1)로 쓴다: 정점 색 × 블록 노이즈 텍스처. 상태가 바뀔 때만 버퍼를 다시 채운다. */
  function boxWriter(max) {
    var n = max * 36, P = new Float32Array(n * 3), N = new Float32Array(n * 3), C = new Float32Array(n * 3), U = new Float32Array(n * 2);
    var g = new T.BufferGeometry(), attrs = [['position', P, 3], ['normal', N, 3], ['color', C, 3], ['uv', U, 2]].map(function (a) {
      var at = new T.BufferAttribute(a[1], a[2]); at.setUsage(T.DynamicDrawUsage); g.setAttribute(a[0], at); return at;
    });
    g.boundingSphere = new T.Sphere(new T.Vector3(9, 2, -5), 14);
    var mesh = new T.Mesh(g, new T.MeshLambertMaterial({ vertexColors: true, map: B.tex('tint') }));
    var k = 0, col = new T.Color(), lo = [0, 0, 0], hi = [0, 0, 0], v = [0, 0, 0];
    var QUAD = [[0, 0], [1, 0], [1, 1], [0, 0], [1, 1], [0, 1]];
    return {
      mesh: mesh,
      begin: function () { k = 0; },
      box: function (x0, y0, z0, x1, y1, z1, c) {
        if (k + 36 > n) return;
        col.set(c); lo[0] = x0; lo[1] = y0; lo[2] = z0; hi[0] = x1; hi[1] = y1; hi[2] = z1;
        for (var a = 0; a < 3; a++) for (var s = -1; s <= 1; s += 2) {
          var b = (a + 1) % 3, cc = (a + 2) % 3;
          for (var q = 0; q < 6; q++) {
            var qq = QUAD[s > 0 ? q : 5 - q], i3 = k * 3;
            v[a] = s > 0 ? hi[a] : lo[a]; v[b] = qq[0] ? hi[b] : lo[b]; v[cc] = qq[1] ? hi[cc] : lo[cc];
            P[i3] = v[0]; P[i3 + 1] = v[1]; P[i3 + 2] = v[2];
            N[i3] = a === 0 ? s : 0; N[i3 + 1] = a === 1 ? s : 0; N[i3 + 2] = a === 2 ? s : 0;
            C[i3] = col.r; C[i3 + 1] = col.g; C[i3 + 2] = col.b;
            U[k * 2] = v[b]; U[k * 2 + 1] = v[cc]; k++;
          }
        }
      },
      end: function () { g.setDrawRange(0, k); attrs.forEach(function (a) { a.needsUpdate = true; }); }
    };
  }

  EXP.registerFacility({
    id: 'insulation',
    cam: { pos: [5.0, 2.05, -1.35], target: [6.6, 1.85, -4.45] },

    build: function (ctx) {
      var self = this, root = ctx.root, ui = ctx.ui, i;
      var s = this.s = { open: false, openK: 0, ins: 0, insD: 0, win: 1, winF: 1, glow: 0, heating: true, winter: false,
        dirty: true, cmp: null, compared: false, t: 0, info: '', infoAt: 0, callsAt: 0, rowT: [0, 0, 0, 0, 0, 0], glowC: new T.Color() };

      s.M = boxWriter(220); root.add(s.M.mesh);

      // 자를 자리 점선(닫혀 있을 때만, 맥박). 모형 높이 0~2.95 에 맞춘다
      var dash = [], dy, dz;
      for (dy = -1.4; dy < 1.4; dy += 0.3) dash.push({ min: [-0.01, dy, -0.575], max: [0.01, dy + 0.18, -0.525] }, { min: [-0.01, dy, 0.525], max: [0.01, dy + 0.18, 0.575] });
      for (dz = -0.55; dz < 0.5; dz += 0.3) dash.push({ min: [-0.01, -1.45, dz], max: [0.01, -1.4, dz + 0.18] }, { min: [-0.01, 1.4, dz], max: [0.01, 1.45, dz + 0.18] });
      var dm = new T.MeshBasicMaterial({ color: '#ffb21f' });
      dash.forEach(function (d) { d.mat = dm; });
      s.cut = new T.Group(); s.cut.position.set(6.985, 1.5, (ZB + ZC) / 2); s.cut.add(B.mesh(dash)); s.cut.visible = false; root.add(s.cut);

      // 열 알갱이(작은 주황, 여러 줄) · 눈송이: 각각 InstancedMesh 하나
      s.heat = new T.InstancedMesh(new T.BoxGeometry(0.07, 0.07, 0.07), new T.MeshBasicMaterial({ color: '#ffa726' }), HN);
      s.heat.frustumCulled = false; s.heat.visible = false; s.heat.count = 0; root.add(s.heat);
      s.snow = new T.InstancedMesh(new T.BoxGeometry(0.1, 0.1, 0.1), new T.MeshBasicMaterial({ color: '#ffffff' }), SN);
      s.snow.frustumCulled = false; s.snow.visible = false; root.add(s.snow);
      s.flakes = [];
      for (i = 0; i < SN; i++) s.flakes.push({ x: 8.4 + Math.random() * 5.4, y: Math.random() * 4.6, z: -11 + Math.random() * 8, v: 0.45 + Math.random() * 0.35, p: Math.random() * 6.3 });

      // 따뜻한 공기: 난방기에서 창을 타고 올라가 방 안으로
      s.air = V.flow([[6.78, 0.74, -3.45], [6.86, 1.5, -3.45], [6.86, 2.2, -3.55], [6.78, 2.75, -3.75]],
        { color: '#ff5a3c', count: 4, size: 0.16, speed: 0.6 });
      s.air.object3d.visible = false; root.add(s.air.object3d);

      // 층 이름표(3개): 실내 마감·단열재는 위 띠 왼쪽에 두 줄로 쌓고 지시선으로 층에 잇는다(위쪽은 코어 안내 알약 자리)
      function tag(t, h) { var sp = V.textSprite(t, { height: h, color: INK, bg: '#fffdf5', depthTest: false }); sp.visible = false; root.add(sp); return sp; }
      s.tags = { fin: tag('실내 마감', 0.15), ins: tag('단열재', 0.15), out: tag('바깥 벽', 0.16) };

      // 3D 누르기: 벽 자리 = 열기/단열재 바꾸기, 창 = 유리 장수 바꾸기 (보이지 않는 판, 그리지 않음)
      var hide = new T.MeshBasicMaterial({ visible: false });
      var tapWall = new T.Mesh(new T.BoxGeometry(1.25, 3, 1.1), hide); tapWall.position.set(6.37, 1.5, (ZB + ZC) / 2); root.add(tapWall);
      var tapWin = new T.Mesh(new T.BoxGeometry(0.12, 1.6, 2), hide); tapWin.position.set(7, 1.8, -3.5); root.add(tapWin);
      ctx.onTap(tapWall, function () { if (!s.open) self.setOpen(ctx); else self.setIns(ctx, (s.ins + 1) % 3); });
      ctx.onTap(tapWin, function () { self.setWin(ctx, s.win % 3 + 1); });

      ctx.addCollider([5.85, 0, ZB], [7, 2.95, ZC]);          // 단면 모형(열면 방 안으로 나온다)
      ctx.addCollider([6.45, 0, -4.1], [7, 0.75, -2.9]);     // 난방기

      // 패널
      function group(title) {
        var box = ui.el('div'); box.style.cssText = 'display:flex;flex-direction:column;gap:6px';
        ui.el('div', 'plegend plegend-title', title, box);
        return { box: box, row: ui.row(box) };
      }
      ui.setInfo(TXT.start);
      s.btnOpen = ui.button('벽 단면 열기', function () { self.setOpen(ctx); }, { primary: true });
      var gi = group('벽 속 단열재'); s.insBox = gi.box;
      s.btnIns = ['없음', '넣기', '두껍게'].map(function (t, n) { return ui.button(t, function () { self.setIns(ctx, n); }, { parent: gi.row }); });
      var gw = group('창의 유리');
      s.btnWin = ['홑창', '이중창', '삼중창'].map(function (t, n) { return ui.button(t, function () { self.setWin(ctx, n + 1); }, { parent: gw.row }); });
      s.btnIns.concat(s.btnWin).forEach(function (b) { b.style.cssText = 'padding:6px 2px;white-space:nowrap'; }); // 세 칸 버튼: ‘✓ 이중창’이 1000px 폭에서도 한 줄
      s.btnCmp = ui.button('난방 끄고 비교', function () { self.compare(ctx); });
      s.barBase = ui.bar('단열 안 한 집의 따뜻함', { max: 1, value: 1, color: '#8a96a3', format: word });
      s.barOurs = ui.bar('우리 집의 따뜻함', { max: 1, value: 1, color: '#ffa726', format: word });
      ui.legend([{ color: '#ff5a3c', text: '굵은 빨강 — 따뜻한 공기' }, { color: '#ffa726', text: '작은 주황 — 열의 이동' }]);
      ui.button('처음 상태로', function () { self.reset(ctx); }, { small: true });

      ctx.showModelLabel(true); // 공기·열의 흐름을 그린 모형 장면
      this.refresh(ctx);
    },

    say: function (text, delay) { this.s.info = text; this.s.infoAt = delay; }, // 3D 변화가 끝난 뒤 문장을 바꾼다

    setOpen: function (ctx) {
      var s = this.s; if (s.open) return;
      s.open = true; this.say(TXT.open, 0.75); this.refresh(ctx);
    },
    setIns: function (ctx, n) {
      var s = this.s, was = s.ins, wasOpen = s.open;
      s.open = true; s.ins = n;
      this.changed(ctx, TXT.ins[n], n > 0 && n !== was, wasOpen ? 0.5 : 1.1);
    },
    setWin: function (ctx, n) {
      var s = this.s, was = s.win, wasOpen = s.open;
      s.open = true; s.win = n; if (n !== was) s.winF = 0.6; // 창 띠가 0.6→1 로 자라며 바뀐다
      this.changed(ctx, TXT.win[n - 1], n > 1 && n !== was, wasOpen ? 0.45 : 1.1);
    },
    changed: function (ctx, text, operated, delay) {
      var s = this.s;
      if (s.cmp) { s.cmp = null; s.heating = true; s.btnCmp.textContent = '난방 끄고 비교'; } // 조건이 바뀌면 비교를 새로 한다
      s.compared = false; s.barBase.set(1); s.barOurs.set(1);
      this.say(text, delay); this.refresh(ctx);
      if (operated) ctx.markOperated({ delay: Math.round(delay * 1000) + 300 }); // 단열재를 넣었거나 창을 바꿨을 때만 기록
    },
    compare: function (ctx) {
      var s = this.s; if (s.cmp) return;
      s.cmp = { t: 0 }; s.heating = false; s.barBase.set(1); s.barOurs.set(1);
      s.btnCmp.textContent = '지켜보는 중…';
      // 작은 화면(패널이 넘침): 비교 버튼·막대를 안내 바로 아래로 올려 안내와 막대가 한 화면에 보이게 한다(한 번 올리면 그 자리 유지)
      var sc = s.barOurs.el.closest('.p-bodies');
      if (sc && !s.cmpTop && sc.scrollHeight > sc.clientHeight + 1) {
        s.cmpTop = true; [s.btnCmp, s.barBase.el, s.barOurs.el].forEach(function (e) { s.insBox.parentNode.insertBefore(e, s.insBox); });
      }
      if (sc && s.cmpTop) sc.scrollTop = 0;
      this.say(TXT.cmpRun, 0.3); this.refresh(ctx);
    },
    reset: function (ctx) {
      var s = this.s;
      s.open = false; s.ins = 0; s.win = 1; s.heating = true; s.cmp = null; s.compared = false;
      s.barBase.set(1); s.barOurs.set(1); s.btnCmp.textContent = '난방 끄고 비교';
      this.say(TXT.start, 0.7); this.refresh(ctx);
    },

    refresh: function (ctx) {
      var s = this.s;
      s.btnOpen.hidden = s.open; s.insBox.hidden = !s.open;
      function mark(btns, labels, sel) { btns.forEach(function (b, i) { b.classList.toggle('on', i === sel); b.textContent = (i === sel ? '✓ ' : '') + labels[i]; }); }
      mark(s.btnIns, ['없음', '넣기', '두껍게'], s.ins);
      mark(s.btnWin, ['홑창', '이중창', '삼중창'], s.win - 1);
      var next = !s.open ? s.btnOpen : s.ins === 0 ? s.btnIns[1] : s.win === 1 ? s.btnWin[1] : !s.compared && !s.cmp ? s.btnCmp : null;
      [s.btnOpen, s.btnCmp].concat(s.btnIns, s.btnWin).forEach(function (b) { b.classList.toggle('primary', b === next); });
      s.dirty = true;
      // 점검용 상태(패널 DOM 안): 열기, 단열재, 창, 난방, 열 알갱이 줄 수·빠르기
      var d = ctx.ui.body.dataset;
      d.open = s.open ? 1 : 0; d.ins = s.ins; d.win = s.win; d.heating = s.heating ? 1 : 0;
      d.wallRows = WALL_ROWS[s.ins].length; d.winRows = WIN_ROWS[s.win - 1].length;
      d.wallSpeed = WALL_SPD[s.ins]; d.winSpeed = WIN_SPD[s.win - 1];
    },

    draw: function () {
      var s = this.s, M = s.M, insD = s.insD, D = OUT_T + insD + FIN_T, x = XO + (1 - ease(s.openK)) * (D + 0.03);
      function vline(lx, y0, y1) { M.box(lx - 0.009, y0, ZC, lx + 0.009, y1, ZC + 0.008, INK); }
      function hline(x0, x1, ly) { M.box(x0, ly - 0.009, ZC, x1, ly + 0.009, ZC + 0.008, INK); }
      M.begin();
      if (s.openK > 0.001) {
        BANDS.forEach(function (bd) { // 벽 띠: 바깥 벽층 | 단열재 | 실내 마감
          var y0 = bd[0], y1 = bd[1];
          M.box(x - OUT_T, y0, ZB, x, y1, ZC, CONC);
          if (insD > 0.004) M.box(x - OUT_T - insD, y0, ZB, x - OUT_T, y1, ZC, INSC);
          M.box(x - D, y0, ZB, x - D + FIN_T, y1, ZC, FIN);
          vline(x - OUT_T, y0, y1); if (insD > 0.02) vline(x - OUT_T - insD, y0, y1);
          vline(x - D + FIN_T, y0, y1); vline(x - D, y0, y1); hline(x - D, x, y1); if (y0 > 0) hline(x - D, x, y0);
        });
        if (insD > 0.06) DOTS.forEach(function (d) { var dx = x - OUT_T - insD * d[0]; M.box(dx - 0.02, d[1] - 0.02, ZC, dx + 0.02, d[1] + 0.02, ZC + 0.006, DOT); });
        // 창 띠: 창틀(아래·위) + 유리(옆에서 본 두께) + 사이 공기층
        var f = s.winF, Dw = (0.16 + (s.win - 1) * 0.3) * f;
        M.box(x - Dw, 1, ZB, x, 1.08, ZC, FRAME); M.box(x - Dw, 2.52, ZB, x, 2.6, ZC, FRAME);
        hline(x - Dw, x, 1.08); hline(x - Dw, x, 2.52); vline(x - Dw, 1, 2.6);
        for (var p = 0; p < s.win; p++) {
          var pc = x - (0.08 + p * 0.3) * f;
          M.box(pc - 0.03, 1.08, ZB, pc + 0.03, 2.52, ZC, PANE); vline(pc - 0.03, 1.08, 2.52); vline(pc + 0.03, 1.08, 2.52);
          if (p > 0) M.box(pc + 0.03, 1.08, ZB, pc + 0.3 * f - 0.03, 2.52, ZC, AIR);
        }
      }
      // 진짜 창 구멍 안의 창틀(유리 장수만큼)
      SASH[s.win - 1].forEach(function (sx) {
        M.box(sx - 0.025, 1, -4.5, sx + 0.025, 1.07, -2.5, FRAME); M.box(sx - 0.025, 2.53, -4.5, sx + 0.025, 2.6, -2.5, FRAME);
        M.box(sx - 0.025, 1.07, -4.5, sx + 0.025, 2.53, -4.43, FRAME); M.box(sx - 0.025, 1.07, -2.57, sx + 0.025, 2.53, -2.5, FRAME);
      });
      // 난방기(창 아래): 켜지면 핀이 주황으로
      var gc = s.glowC.copy(RAD_OFF).lerp(RAD_ON, s.glow);
      M.box(6.56, 0.12, -4.05, 6.93, 0.68, -2.95, '#e7e2d8'); M.box(6.56, 0.68, -4.03, 6.92, 0.71, -2.97, '#6e6a64');
      M.box(6.6, 0, -4.0, 6.9, 0.12, -3.9, '#9a958c'); M.box(6.6, 0, -3.1, 6.9, 0.12, -3.0, '#9a958c');
      for (var i = 0; i < 7; i++) M.box(6.5, 0.18, -4.0 + i * 0.15, 6.56, 0.62, -3.92 + i * 0.15, gc);
      if (s.winter) { // 창밖 겨울(시설 모드에서만): 눈 덮인 땅, 창턱의 눈, 눈 쌓인 나무, 흐린 하늘
        M.box(8, 0, -14, 14.2, 0.08, 1, SNOW); M.box(8, 0.08, -6.2, 8.45, 0.26, -0.9, SNOW);
        M.box(8, 0.9, -4.6, 8.28, 1, -2.4, '#9a958c'); M.box(8, 1, -4.55, 8.26, 1.09, -2.45, SNOW);
        M.box(14.2, 0, -14, 14.4, 7, 1, '#aebccb');
        M.box(13.3, 0.08, -14, 14.2, 0.75, -8.6, SNOW2); M.box(12.6, 0.08, -8.6, 14.2, 0.45, -5, SNOW2);
        [[10.8, -6.4, 2.6], [12.7, -9.4, 3.3], [12.4, -4.4, 2.1]].forEach(function (t) {
          var tx = t[0], tz = t[1], th = (t[2] - 0.5) / 3;
          M.box(tx - 0.12, 0.08, tz - 0.12, tx + 0.12, 0.6, tz + 0.12, '#6b4426');
          for (var k = 0; k < 3; k++) {
            var w = 0.75 - k * 0.22, y0 = 0.5 + k * th;
            M.box(tx - w, y0, tz - w, tx + w, y0 + th, tz + w, '#3f6e3a');
            M.box(tx - w + 0.06, y0 + th, tz - w + 0.06, tx + w - 0.06, y0 + th + 0.08, tz + w - 0.06, SNOW);
          }
        });
      }
      // 이름표: 실내 마감(위)·단열재(아래)는 위 띠 왼쪽에 쌓고 지시선(끝에 점)으로 층에 잇는다. 두 이름표 사이(y 2.78)로 열 점 한 줄이 지나간다
      var tx = x - D - 0.04;
      function lead(x1, ly) { hline(tx, x1, ly); M.box(x1 - 0.025, ly - 0.025, ZC, x1 + 0.025, ly + 0.025, ZC + 0.01, INK); }
      if (s.openK > 0.97) { lead(x - D + FIN_T / 2, 2.885); if (insD > 0.15) lead(x - OUT_T - insD / 2, 2.675); } // 이름표 보임 조건과 같게(update)
      M.end();
      s.tags.fin.position.set(tx - s.tags.fin.scale.x / 2, 2.885, ZC + 0.01);
      s.tags.ins.position.set(tx - s.tags.ins.scale.x / 2, 2.675, ZC + 0.01);
      s.tags.out.position.set(x - OUT_T / 2, 3.05, ZC + 0.1); // 바깥 벽층 바로 위(안내 알약보다 아래)
    },

    update: function (dt, ctx) {
      var s = this.s, act = ctx.active;
      s.t += dt;
      if (s.infoAt > 0) { s.infoAt -= dt; if (s.infoAt <= 0) ctx.ui.setInfo(s.info); }

      var o0 = s.openK, i0 = s.insD, f0 = s.winF, g0 = s.glow;
      s.openK = approach(s.openK, s.open ? 1 : 0, dt / 0.7);
      s.insD = approach(s.insD, INS[s.ins], dt * 1.1);
      s.winF = approach(s.winF, 1, dt * 1.1);
      s.glow = approach(s.glow, act && s.heating ? 1 : 0, dt / 0.6);
      if (s.winter !== act) { s.winter = act; s.dirty = true; ctx.ui.body.dataset.winter = act ? 1 : 0; }
      if (s.dirty || o0 !== s.openK || i0 !== s.insD || f0 !== s.winF || g0 !== s.glow) { s.dirty = false; this.draw(); }

      if (s.cmp) {
        var c = s.cmp, loss = WALL_LOSS[s.ins] + WIN_LOSS[s.win - 1];
        c.t = Math.min(CMP_T, c.t + dt);
        s.barBase.set(1 - COOL * c.t); s.barOurs.set(1 - COOL * loss * c.t);
        if (c.t >= CMP_T) {
          s.cmp = null; s.heating = true; s.compared = true; s.btnCmp.textContent = '난방 끄고 비교';
          this.say(loss < 0.999 ? TXT.cmpBetter : TXT.cmpSame, 0.3); this.refresh(ctx);
        }
      }

      var open = s.openK > 0.97;
      s.heat.visible = act && open; s.snow.visible = act; s.air.object3d.visible = act && s.heating;
      s.cut.visible = act && !s.open && s.openK < 0.01;
      s.tags.fin.visible = s.tags.out.visible = act && open; s.tags.ins.visible = act && open && s.insD > 0.15;
      if (!act) return;

      if (s.cut.visible) s.cut.scale.setScalar(1 + 0.025 * (1 + Math.sin(s.t * Math.PI * 2 / 1.4)));
      for (var i = 0; i < SN; i++) {
        var fl = s.flakes[i];
        fl.y -= fl.v * dt; if (fl.y < 0.1) fl.y += 4.6;
        MTX.makeTranslation(fl.x + Math.sin(s.t * 0.9 + fl.p) * 0.18, fl.y, fl.z + Math.cos(s.t * 0.7 + fl.p) * 0.12);
        s.snow.setMatrixAt(i, MTX);
      }
      s.snow.instanceMatrix.needsUpdate = true;
      if (s.heat.visible) {
        var D = OUT_T + s.insD + FIN_T, Dw = (0.16 + (s.win - 1) * 0.3) * s.winF;
        var k = this.rows(dt, WALL_ROWS[s.ins], WALL_SPD[s.ins], XO - D - 0.35, 0, 0);
        k = this.rows(dt, WIN_ROWS[s.win - 1], WIN_SPD[s.win - 1], XO - Dw - 0.35, 3, k);
        s.heat.count = k; s.heat.instanceMatrix.needsUpdate = true;
      }
      if ((s.callsAt -= dt) < 0) { // 점검용: 이 시설이 지금 그리는 드로콜·삼각형 수
        s.callsAt = 0.5; var calls = 0, tris = 0;
        ctx.root.traverseVisible(function (ob) {
          if (!(ob.isMesh || ob.isSprite) || !ob.material.visible) return;
          var g = ob.geometry, c = Math.min(g.drawRange.count, g.index ? g.index.count : g.attributes.position.count);
          calls++; tris += c / 3 * (ob.isInstancedMesh ? ob.count : 1);
        });
        ctx.ui.body.dataset.calls = calls; ctx.ui.body.dataset.tris = Math.round(tris);
        var tg = []; ['fin', 'ins', 'out'].forEach(function (n) { var t = s.tags[n]; if (t.visible) tg.push([n, t.position.x, t.position.y, t.position.z, t.scale.x, t.scale.y]); });
        ctx.ui.body.dataset.tags = JSON.stringify(tg);
      }
    },

    // 열 알갱이 줄: 실내 공기(x0)에서 나와 벽·창을 가로질러 진짜 벽 속(x>7)으로 사라진다
    rows: function (dt, ys, spd, x0, base, k) {
      var s = this.s, len = XO + 0.12 - x0, n = Math.ceil(len * 6);
      for (var r = 0; r < ys.length; r++) {
        var t = s.rowT[base + r] = (s.rowT[base + r] + dt * spd) % len;
        for (var i = 0; i < n && k < HN; i++) {
          var d = (i / n * len + t + r * 0.07) % len, px = x0 + d;
          var g = Math.max(0, Math.min(1, d / 0.2, (XO + 0.1 - px) / 0.1));
          MTX.makeScale(g, g, g); MTX.setPosition(px, ys[r], ZH);
          s.heat.setMatrixAt(k++, MTX);
        }
      }
      return k;
    }
  });
})();
