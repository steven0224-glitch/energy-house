/* 옥상 · 정원 — 맨옥상 칸을 눌러 식물을 심고, ‘열화상 보기’로 같은 햇볕을 받는 맨옥상과 정원을 비교한다.
   열화상은 덮개를 씌우지 않고 바닥·식물의 색을 열화상 램프로 바꿔서 만든다(art-direction §2). 온도 숫자는 쓰지 않는다.
   열화상 중에는 격자 밖 옥상(같은 콘크리트)도 뜨거운 색 판으로 덮고, 옥상 밖 바탕은 #1c1730으로 어둡게 한다(판 1개).
   작은 주황 열 알갱이가 옥상 바닥을 지나 건물 안으로 내려간다: 맨옥상 칸마다 빠르게, 정원·심은 칸은 드문드문 느리게(0은 아님 = 단열은 열의 이동을 늦춤).
   드로콜: 바닥 칸 1(정점 색) + 식물 1(InstancedMesh, 인스턴스 색) + 햇빛 막대 1 + 이름표 4 + 덮개 판 1 + 열 알갱이 1. */
(function () {
  'use strict';
  var T = THREE, V = EXP.viz;
  var RAMP = ['#2d1b69', '#8f2a7a', '#dd4a3c', '#f8961e', '#ffe45c'].map(function (h) { return new T.Color(h); }); // 덜 뜨거움 → 뜨거움
  var HEAT_BARE = 0.93, HEAT_GARDEN = 0.24, HEAT_PLANT = 0.06; // 램프 위치(색을 고르는 값, 온도가 아님)
  var BG = new T.Color('#1c1730'), HEATC = '#ffa726';
  var LINK_MSG = '같은 햇볕인데 식물이 있는 쪽이 덜 뜨거워요. 옥상 정원이 단열을 도와 건물이 덜 더워지고, 냉방 에너지를 아껴요.'; // 지도서 373쪽 연결 문장
  var DOT_N = 2, DOT_FAST = 0.9, DOT_SLOW = 0.3, DOT_TOP = 5.5, DOT_BOT = 4.2; // 칸마다 알갱이 수, 속도(m/s), 내려가는 구간 y
  var C = {
    concrete: new T.Color('#cfc9bb'), concreteHi: new T.Color('#ece4cf'), concreteSide: new T.Color('#a8a194'),
    grass: new T.Color('#6aa84a'), dirt: new T.Color('#8a5a35'), soil: new T.Color('#6b4426'),
    sprout: new T.Color('#8fd14f'), leaf: new T.Color('#3f8a2e'), log: new T.Color('#7a5534')
  };
  var FLOWERS = ['#ff4f6d', '#ffb21f', '#c056ff', '#ff6fb0', '#4f8dff'].map(function (h) { return new T.Color(h); });
  var CAM = { pos: [-3.5, 10.0, -7.5], target: [-4, 5.2, -2.9] };
  // 이름표 위치: 코어 토스트(화면 아래 가운데)를 피한다. 맨옥상은 격자 남쪽(화면 위쪽), 열 이름표는 토스트보다 아래
  var TAG_BARE = [-2.5, 5.3, -0.55], TAG_HEAT = [-2.5, 5.1, -5.85];
  var TUFT = [[-0.27, -0.27], [0.27, -0.25], [-0.25, 0.27], [0.26, 0.26]]; // 한 칸 안 풀 덤불 위치
  var tmpC = new T.Color(), tmpH = new T.Color(), top = new T.Color(), side = new T.Color(), hc = new T.Color(), tmpM = new T.Matrix4(), tmpP = new T.Vector3(), tmpQ = new T.Quaternion(), tmpS = new T.Vector3();

  function ramp(v, out) {
    v = Math.max(0, Math.min(1, v)) * 4; var i = Math.min(3, Math.floor(v));
    return out.copy(RAMP[i]).lerp(RAMP[i + 1], v - i);
  }
  function ease(k) { k = Math.max(0, Math.min(1, k)); return 1 - (1 - k) * (1 - k) * (1 - k); }

  // 16px 밝은 노이즈 + 칸 테두리: 정점·인스턴스 색에 곱해져 블록 느낌을 낸다
  function tileTex() {
    var c = document.createElement('canvas'); c.width = c.height = 16; var g = c.getContext('2d'), x, y, seed = 7;
    for (y = 0; y < 16; y++) for (x = 0; x < 16; x++) {
      seed = (seed * 9301 + 49297) % 233280; var v = 236 + Math.floor(seed / 233280 * 20);
      if (x === 0 || y === 0 || x === 15 || y === 15) v = 205;
      g.fillStyle = 'rgb(' + v + ',' + v + ',' + v + ')'; g.fillRect(x, y, 1, 1);
    }
    var t = new T.CanvasTexture(c); t.colorSpace = T.SRGBColorSpace; t.magFilter = T.NearestFilter; t.minFilter = T.NearestFilter; t.generateMipmaps = false;
    return t;
  }

  EXP.registerFacility({
    id: 'roofgarden',
    cam: CAM,

    build: function (ctx) {
      var self = this, root = ctx.root, ui = ctx.ui;
      var s = this.s = { thermal: false, th: 0, thTarget: 0, pulse: 0, cells: [], veg: [], dirty: true, rayT: 0, callsAt: 0, wasActive: false, opQueued: -1 };
      var tex = tileTex();

      // ── 바닥 칸 24개(정원 12 + 맨옥상 12)를 상자 하나씩 이어 붙인 한 메시. 칸마다 윗면·옆면 정점 색을 따로 칠한다.
      var pos = [], nor = [], uv = [], idx = [], ranges = [];
      function addBox(x0, y0, z0, x1, y1, z1) {
        var g = new T.BoxGeometry(x1 - x0, y1 - y0, z1 - z0); g.translate((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
        var base = pos.length / 3, p = g.attributes.position.array, n = g.attributes.normal.array, u = g.attributes.uv.array, ix = g.index.array, k;
        for (k = 0; k < p.length; k++) { pos.push(p[k]); nor.push(n[k]); }
        for (k = 0; k < u.length; k++) uv.push(u[k]);
        for (k = 0; k < ix.length; k++) idx.push(ix[k] + base);
        g.dispose(); return base; // BoxGeometry 정점 순서: +x,−x,+y(윗면 8~11),−y,+z,−z 면마다 4개
      }
      var r, c2, i;
      for (r = 0; r < 4; r++) for (c2 = 0; c2 < 6; c2++) {
        var x0 = -7 + c2, z0 = -5 + r, garden = c2 < 3;
        var cell = { x: x0 + 0.5, z: z0 + 0.5, garden: garden, planted: garden, grow: garden ? 1 : 0, growT: garden ? 1 : 0, born: -1,
          jitter: ((r * 7 + c2 * 13) % 5 - 2) * 0.012 };
        cell.v0 = addBox(x0 + 0.01, 5.005, z0 + 0.01, x0 + 0.99, garden ? 5.4 : 5.06, z0 + 0.99);
        s.cells.push(cell);
      }
      var geo = new T.BufferGeometry();
      geo.setAttribute('position', new T.Float32BufferAttribute(pos, 3));
      geo.setAttribute('normal', new T.Float32BufferAttribute(nor, 3));
      geo.setAttribute('uv', new T.Float32BufferAttribute(uv, 2));
      geo.setAttribute('color', new T.Float32BufferAttribute(new Float32Array(pos.length), 3));
      geo.setIndex(idx);
      s.matLit = new T.MeshLambertMaterial({ map: tex, vertexColors: true });
      s.matHeat = new T.MeshBasicMaterial({ map: tex, vertexColors: true });
      s.ground = new T.Mesh(geo, s.matLit); root.add(s.ground);
      s.bare = s.cells.filter(function (c) { return !c.garden; });

      // ── 식물(정원의 나무·덤불 + 심을 칸의 새싹·꽃)을 InstancedMesh 하나로
      var vg = new T.BoxGeometry(1, 1, 1); vg.translate(0, 0.5, 0);
      function veg(x, y, z, w, h, d, col, cell, kind) {
        s.veg.push({ x: x, y: y, z: z, w: w, h: h, d: d, col: col, cell: cell || null, kind: kind || 'fixed' });
      }
      // 정원: 나무(시작 지점에서도 보이게 높게), 낮은 덤불, 칸마다 풀 덤불
      // 나무는 정원 남서쪽 모서리: 시작 지점(마당)에서 보이고, 북쪽 시설 카메라에서는 정원 칸을 가리지 않는다
      veg(-6.4, 5.4, -1.6, 0.34, 1.0, 0.34, C.log);
      veg(-6.4, 6.3, -1.6, 1.5, 1.0, 1.5, C.leaf);
      veg(-6.4, 7.3, -1.6, 0.8, 0.4, 0.8, C.leaf);
      veg(-4.6, 5.4, -1.5, 0.7, 0.5, 0.7, C.leaf);
      s.cells.forEach(function (cell) {
        if (cell.garden) {
          if (cell.x < -5.9 && cell.z > -2) return; // 나무 밑
          veg(cell.x - 0.2, 5.4, cell.z + 0.15, 0.3, 0.3, 0.3, C.leaf); veg(cell.x + 0.22, 5.4, cell.z - 0.2, 0.24, 0.22, 0.24, C.leaf);
          return;
        }
        TUFT.forEach(function (o, k) { veg(cell.x + o[0], 5.06, cell.z + o[1], 0.2, 0.42 - (k % 2) * 0.1, 0.2, C.leaf, cell, 'tuft'); });
        veg(cell.x, 5.06, cell.z, 0.06, 0.55, 0.06, C.leaf, cell, 'stem');
        veg(cell.x, 5.58, cell.z, 0.2, 0.16, 0.2, FLOWERS[s.bare.indexOf(cell) % FLOWERS.length], cell, 'flower');
      });
      s.vegMatLit = new T.MeshLambertMaterial({ map: tex });
      s.vegMatHeat = new T.MeshBasicMaterial({ map: tex });
      s.vegMesh = new T.InstancedMesh(vg, s.vegMatLit, s.veg.length);
      s.vegMesh.instanceMatrix.setUsage(T.DynamicDrawUsage);
      for (i = 0; i < s.veg.length; i++) s.vegMesh.setColorAt(i, s.veg[i].col);
      s.vegMesh.frustumCulled = false; // 인스턴스가 원점 상자 밖에 있으므로
      root.add(s.vegMesh);

      // ── 햇빛: 해 방향(ctx.sunDir)과 나란한 곧은 막대들이 정원과 맨옥상에 똑같이 내려온다
      var sd = new T.Vector3().fromArray(ctx.sunDir).normalize();
      var rg = new T.BoxGeometry(0.05, 0.05, 0.6);
      s.rays = new T.InstancedMesh(rg, new T.MeshBasicMaterial({ color: '#fff0a0' }), 16);
      s.rays.instanceMatrix.setUsage(T.DynamicDrawUsage); s.rays.frustumCulled = false; s.rays.visible = false;
      s.rayQ = new T.Quaternion().setFromUnitVectors(new T.Vector3(0, 0, 1), sd);
      s.raySd = sd;
      s.rayEnds = [];
      for (i = 0; i < 16; i++) {
        var gx = i < 8 ? -6.6 + (i % 4) * 0.75 : -3.6 + (i % 4) * 0.75, gz = -4.5 + Math.floor((i % 8) / 4) * 2 + (i % 2) * 0.6;
        s.rayEnds.push({ p: new T.Vector3(gx, i < 8 ? 5.4 : 5.06, gz), ph: (i * 0.37) % 1 });
      }
      root.add(s.rays);

      // ── 열화상 덮개(판 1개): 격자 밖 옥상 = 맨옥상과 같은 뜨거운 색, 옥상 밖 바탕 = 어두운 #1c1730(옥상 슬래브 아래 높이라 옥상에는 가려진다)
      var cp = [-8, 5.01, -12, 8, 5.01, -12, 8, 5.01, 0, -8, 5.01, 0, -60, 4.98, -60, 60, 4.98, -60, 60, 4.98, 60, -60, 4.98, 60];
      var cuv = [0, 0, 16, 0, 16, 12, 0, 12, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5], ccol = [], hot = ramp(HEAT_BARE, new T.Color());
      for (i = 0; i < 8; i++) { var cc0 = i < 4 ? hot : BG; ccol.push(cc0.r, cc0.g, cc0.b); }
      var cg = new T.BufferGeometry();
      cg.setAttribute('position', new T.Float32BufferAttribute(cp, 3)); cg.setAttribute('uv', new T.Float32BufferAttribute(cuv, 2));
      cg.setAttribute('color', new T.Float32BufferAttribute(ccol, 3)); cg.setIndex([0, 2, 1, 0, 3, 2, 4, 6, 5, 4, 7, 6]);
      var ctex = tileTex(); ctex.wrapS = ctex.wrapT = T.RepeatWrapping;
      s.cover = new T.Mesh(cg, new T.MeshBasicMaterial({ map: ctex, vertexColors: true, transparent: true, opacity: 0 }));
      s.cover.visible = false; s.cover.frustumCulled = false; root.add(s.cover);

      // ── 열 알갱이: 칸마다 한 줄(DOT_N개). 옥상 바닥 아래로 들어가는 모습이 보이게 깊이 검사 없이 맨 나중에 그린다
      s.dots = new T.InstancedMesh(new T.BoxGeometry(0.13, 0.13, 0.13), new T.MeshBasicMaterial({ color: HEATC, depthTest: false }), s.cells.length * DOT_N);
      s.dots.instanceMatrix.setUsage(T.DynamicDrawUsage); s.dots.frustumCulled = false; s.dots.visible = false; s.dots.renderOrder = 5;
      s.cells.forEach(function (cell, k) { cell.sparse = (Math.floor(k / 6) + k % 6) % 4 === 0; cell.dotT = (k * 0.29) % 1; }); // 정원·심은 칸은 이 칸들만 한 줄 남김
      root.add(s.dots);

      // ── 이름표(3개)
      s.tagGarden = V.textSprite('정원', { height: 0.38, color: '#2e6b1f' }); s.tagGarden.position.set(-5.5, 5.35, -5.45);
      s.tagBare = V.textSprite('빈 옥상', { height: 0.38, color: '#5b5346' }); s.tagBare.position.set(TAG_BARE[0], TAG_BARE[1], TAG_BARE[2]);
      s.tagSun = V.textSprite('같은 햇볕', { height: 0.34, color: '#9a6a00' }); s.tagSun.position.set(-4.0, 7.0, -2.2);
      s.tagHeat = V.textSprite('건물 안으로 들어가는 열', { height: 0.3, color: '#b45309' }); s.tagHeat.position.set(TAG_HEAT[0], TAG_HEAT[1], TAG_HEAT[2]);
      [s.tagGarden, s.tagBare, s.tagSun, s.tagHeat].forEach(function (t) { t.visible = false; root.add(t); });

      ctx.addCollider([-6.57, 5, -1.77], [-6.23, 6.4, -1.43]); // 나무 줄기

      // ── 패널
      ui.setInfo('회색 빈 칸을 눌러 식물을 심어 보세요. 그다음 ‘온도 색으로 보기’를 눌러요.');
      s.btnPlant = ui.button('식물 심기', function () { self.plantNext(ctx); }, { primary: true });
      s.tgl = ui.toggle('온도 색으로 보기', false, function (on) { self.setThermal(ctx, on); });
      s.legend = ui.legend([{ color: '#ffe45c', text: '뜨거움' }, { color: '#dd4a3c', text: '중간' }, { color: '#2d1b69', text: '덜 뜨거움' }], '색이 뜻하는 것');
      s.legend.hidden = true;
      ui.button('처음 상태로', function () { self.reset(ctx); }, { small: true });

      // 3D: 맨옥상 칸을 직접 누르면 그 칸에 심는다
      ctx.onTap(s.ground, function (hit) {
        var p = hit.point, cell = s.bare.filter(function (c) { return Math.abs(p.x - c.x) <= 0.5 && Math.abs(p.z - c.z) <= 0.5; })[0];
        if (cell && !cell.planted) self.plant(ctx, cell); else if (!cell) ctx.toast('회색 빈 칸을 눌러 보세요');
      });
      this.writeVeg();
      this.sync(ctx);
    },

    enter: function (ctx) { this.s.dirty = true; this.sync(ctx); },
    exit: function (ctx) { this.s.dirty = true; },

    plantNext: function (ctx) {
      var c = this.s.bare.filter(function (x) { return !x.planted; });
      if (!c.length) { ctx.toast('빈 칸에 모두 심었어요'); return; }
      // 정원 쪽(서쪽)에 붙은 칸부터 차례로
      c.sort(function (a, b) { return (a.x - b.x) || (a.z - b.z); });
      this.plant(ctx, c[0]);
    },

    plant: function (ctx, cell) {
      var s = this.s;
      cell.planted = true; cell.growT = 0; s.dirty = true;
      var n = s.bare.filter(function (c) { return c.planted; }).length;
      s.btnPlant.classList.remove('primary'); s.tgl.el.classList.toggle('primary', !s.thermal);
      if (n === s.bare.length) s.btnPlant.disabled = true;
      this.sync(ctx);
      ctx.ui.setInfo(s.thermal ? '새싹이 자라면서 그 칸의 색이 어떻게 바뀌는지 보세요.'
        : '새싹이 돋아 풀과 꽃으로 자라요. 이제 ‘온도 색으로 보기’를 눌러 비교해 봐요.');
    },

    setThermal: function (ctx, on) {
      var s = this.s;
      s.thermal = on; s.thTarget = on ? 1 : 0; s.dirty = true;
      ctx.showModelLabel(on);
      s.legend.hidden = !on;
      s.tgl.el.classList.remove('primary');
      var planted = s.bare.some(function (c) { return c.planted; });
      if (on) {
        ctx.ui.setInfo(planted ? LINK_MSG
          : '같은 햇볕을 받아도 빈 옥상은 뜨겁고, 정원은 덜 뜨거워요. 빈 옥상에 식물을 심으면 어떻게 될까요?');
        if (!planted) s.btnPlant.classList.add('primary');
        if (planted) s.opQueued = 0.7; // 색이 바뀐 뒤 기록
      } else {
        ctx.ui.setInfo('식물을 더 심거나 ‘온도 색으로 보기’로 다시 비교해 보세요.');
      }
      this.sync(ctx);
    },

    reset: function (ctx) {
      var s = this.s;
      s.bare.forEach(function (c) { c.planted = false; c.growT = 0; c.grow = 0; });
      s.tgl.set(false); this.setThermal(ctx, false);
      s.btnPlant.disabled = false; s.btnPlant.classList.add('primary'); s.tgl.el.classList.remove('primary');
      this.writeVeg(); s.dirty = true; this.sync(ctx);
      ctx.ui.setInfo('회색 빈 칸을 눌러 식물을 심어 보세요. 그다음 ‘온도 색으로 보기’를 눌러요.');
    },

    // 점검용 상태(코어 패널 dataset)
    sync: function (ctx) {
      var s = this.s, d = ctx.ui.body.dataset;
      var heat = function (c) { return +(c.garden ? HEAT_GARDEN : HEAT_BARE + (HEAT_GARDEN + 0.06 - HEAT_BARE) * c.grow).toFixed(2); };
      d.planted = s.bare.filter(function (c) { return c.planted; }).length;
      d.grown = s.bare.filter(function (c) { return c.grow >= 1; }).length;
      d.thermal = s.thermal ? 1 : 0;
      d.shown = s.th.toFixed(2);
      d.heatBare = JSON.stringify(s.bare.map(heat));
      d.heatGarden = heat(s.cells[0]);
      d.cells = JSON.stringify(s.bare.map(function (c) { return [c.x, c.z]; }));
      // 열 알갱이 줄 수 [맨옥상 쪽, 정원·심은 쪽]
      d.heatLines = JSON.stringify([s.cells.filter(function (c) { return !c.garden && !c.planted; }).length,
        s.cells.filter(function (c) { return (c.garden || c.planted) && c.sparse; }).length]);
    },

    cellHeat: function (c) {
      return c.garden ? HEAT_GARDEN + c.jitter : HEAT_BARE + c.jitter + (HEAT_GARDEN + 0.06 - HEAT_BARE) * c.grow;
    },

    // 식물 인스턴스: 자람(grow 0→1)에 따라 크기, 열화상 정도(th)에 따라 색
    writeVeg: function () {
      var s = this.s, th = s.th, i, v, k, g;
      for (i = 0; i < s.veg.length; i++) {
        v = s.veg[i]; g = v.cell ? v.cell.grow : 1;
        var sx = v.w, sy = v.h, sz = v.d, y = v.y;
        if (v.cell) {
          if (!v.cell.planted && v.cell.growT <= 0) { sx = sy = sz = 0.0001; }
          else if (v.kind === 'tuft') { k = Math.min(1, g * 1.6); sx = sz = v.w * (0.5 + 0.5 * k); sy = v.h * (0.2 + 0.8 * k); }
          else if (v.kind === 'stem') { k = Math.max(0, (g - 0.35) / 0.65); sy = v.h * k + 0.0001; }
          else { k = Math.max(0, (g - 0.7) / 0.3); sx = sz = v.w * k + 0.0001; sy = v.h * k + 0.0001; y = 5.06 + 0.55 * Math.max(0.0001, (g - 0.35) / 0.65); }
        }
        tmpP.set(v.x, y, v.z); tmpS.set(sx, sy, sz); tmpM.compose(tmpP, tmpQ.identity(), tmpS);
        s.vegMesh.setMatrixAt(i, tmpM);
        // 평소 색: 새싹 → 잎(심은 칸), 꽃은 그대로
        if (v.cell && v.kind !== 'flower') tmpC.copy(C.sprout).lerp(C.leaf, Math.max(0, (g - 0.3) / 0.7)); else tmpC.copy(v.col);
        if (th > 0) tmpC.lerp(ramp(HEAT_PLANT + (v.kind === 'flower' ? 0.04 : 0), tmpH), th);
        s.vegMesh.setColorAt(i, tmpC);
      }
      s.vegMesh.instanceMatrix.needsUpdate = true; s.vegMesh.instanceColor.needsUpdate = true;
    },

    // 열 알갱이: 맨옥상 칸은 빠르게 2개, 정원·다 자란 칸은 sparse 칸만 느리게 1개(자라는 동안 서서히 바뀜)
    writeDots: function (dt) {
      var s = this.s, i, j, c, g, sp, n, k, len = DOT_TOP - DOT_BOT;
      for (i = 0; i < s.cells.length; i++) {
        c = s.cells[i]; g = c.garden ? 1 : c.grow;
        sp = DOT_FAST + (DOT_SLOW - DOT_FAST) * g;
        n = c.sparse ? DOT_N - g * (DOT_N - 1) : DOT_N * (1 - g); // 보일 알갱이 수(소수 = 마지막 알갱이 크기)
        c.dotT = (c.dotT + dt * sp / len) % 1;
        for (j = 0; j < DOT_N; j++) {
          k = Math.max(0, Math.min(1, n - j));
          tmpP.set(c.x + 0.34, DOT_TOP - ((c.dotT + j / DOT_N) % 1) * len, c.z); // 칸 가운데를 비켜 둔다(점검 색 샘플 자리)
          tmpS.setScalar(k + 0.0001); tmpM.compose(tmpP, tmpQ.identity(), tmpS);
          s.dots.setMatrixAt(i * DOT_N + j, tmpM);
        }
      }
      s.dots.instanceMatrix.needsUpdate = true;
    },

    writeGround: function () {
      var s = this.s, col = s.ground.geometry.attributes.color, a = col.array, th = s.th, i, j;
      var pulse = 0.5 + 0.5 * Math.sin(s.pulse * Math.PI * 2 / 1.4);
      for (i = 0; i < s.cells.length; i++) {
        var c = s.cells[i];
        if (c.garden) { top.copy(C.grass); side.copy(C.dirt); }
        else if (c.planted) { top.copy(C.soil).lerp(C.grass, Math.max(0, (c.grow - 0.4) / 0.6)); side.copy(C.concreteSide); }
        else { top.copy(C.concrete).lerp(C.concreteHi, s.thermal ? 0 : pulse); side.copy(C.concreteSide); }
        if (th > 0) { ramp(this.cellHeat(c), hc); top.lerp(hc, th); side.lerp(hc.multiplyScalar(0.8), th); }
        for (j = 0; j < 24; j++) {
          var cc = (j >= 8 && j < 12) ? top : side, o = (c.v0 + j) * 3;
          a[o] = cc.r; a[o + 1] = cc.g; a[o + 2] = cc.b;
        }
      }
      col.needsUpdate = true;
    },

    update: function (dt, ctx) {
      var s = this.s, act = ctx.active, i, growing = false;
      // 열화상은 시설 모드 안에서만 보인다(나갔다 들어오면 다시 0.6초 동안 색이 바뀐다)
      var target = act && s.thermal ? 1 : 0;
      if (s.th !== target) { s.th += Math.sign(target - s.th) * Math.min(Math.abs(target - s.th), dt / 0.6); s.dirty = true; }
      var heatOn = s.th > 0.5;
      s.ground.material = heatOn ? s.matHeat : s.matLit; s.vegMesh.material = heatOn ? s.vegMatHeat : s.vegMatLit;
      for (i = 0; i < s.bare.length; i++) {
        var c = s.bare[i];
        if (c.planted && c.growT < 1) {
          c.growT = Math.min(1, c.growT + dt / 1.6); c.grow = ease(c.growT); growing = true;
          if (c.growT >= 1 && s.thermal) { s.opQueued = 0.3; ctx.ui.setInfo(LINK_MSG); } // 열화상 먼저 → 심기 경로에서도 연결 문장을 기록과 함께
        }
      }
      if (growing) { s.dirty = true; this.writeVeg(); }
      if (act && !s.thermal && s.bare.some(function (c) { return !c.planted; })) { s.pulse += dt; s.dirty = true; }
      if (s.dirty) { s.dirty = false; this.writeGround(); if (!growing) this.writeVeg(); this.sync(ctx); }

      if (s.opQueued >= 0) {
        s.opQueued -= dt;
        if (s.opQueued < 0 && s.thermal && act && s.bare.some(function (c) { return c.planted; })) ctx.markOperated({ delay: 300 });
      }

      // 햇빛 막대·이름표는 시설 모드에서만
      s.rays.visible = s.tagGarden.visible = s.tagBare.visible = s.tagSun.visible = act;
      s.cover.visible = s.th > 0; s.cover.material.opacity = s.th;
      s.dots.visible = s.tagHeat.visible = act && heatOn;
      if (s.dots.visible) s.dots.material.color.set(s.thermal ? '#c2410c' : HEATC); // 온도 색 위(노란 빈 옥상)에서도 열 점이 묻히지 않게
      if (s.dots.visible) this.writeDots(dt);
      if (act) {
        s.rayT += dt;
        for (i = 0; i < s.rayEnds.length; i++) {
          var re = s.rayEnds[i], k = (s.rayT * 0.3 + re.ph) % 1; // 1m/s 남짓, 3.2m 위에서 바닥까지
          tmpP.copy(s.raySd).multiplyScalar((1 - k) * 3.2 + 0.3).add(re.p);
          tmpS.set(1, 1, k < 0.08 ? k / 0.08 : 1);
          tmpM.compose(tmpP, s.rayQ, tmpS); s.rays.setMatrixAt(i, tmpM);
        }
        s.rays.instanceMatrix.needsUpdate = true;
        if ((s.callsAt -= dt) < 0) { // 점검용: 이 시설이 그리는 드로콜·삼각형 수
          s.callsAt = 0.5; var calls = 0, tris = 0;
          ctx.root.traverseVisible(function (ob) {
            if (!(ob.isMesh || ob.isSprite) || !ob.material.visible) return;
            var g = ob.geometry, n = g.index ? g.index.count : g.attributes.position.count;
            calls++; tris += n / 3 * (ob.isInstancedMesh ? ob.count : 1);
          });
          ctx.ui.body.dataset.calls = calls; ctx.ui.body.dataset.tris = Math.round(tris);
        }
      }
    }
  });
})();
