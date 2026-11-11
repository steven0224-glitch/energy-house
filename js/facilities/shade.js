/* 여름 방 · 차양 — 높이 뜬 여름 해가 앞창(x −6.5~−3.5, y 0.8~2.8)으로 들어와 바닥에 햇빛 자국을 만든다.
   조작: 창 옆 노란 손잡이를 끌어내리거나(3D 드래그) ‘차양 내리기/올리기’ 버튼 → 창 바깥 차양 천이 비스듬히 펼쳐진다.
   차양이 위쪽 햇빛부터 가려서 바닥 햇빛 자국이 창에서 먼 쪽부터 연속으로 줄고, 더운 공기·에어컨 찬 바람·두 상대 막대도 함께 준다.
   기하: 햇빛은 ctx.sunDir 방향. 창은 벽 가운데 면(z −0.5)에 있는 얇은 창으로 본다. 차양 천은 경첩(y 3.6, z 0)에서 기울기 고정으로
   펼쳐지고, 다 내리면 끝이 (y 2.75, z 0.75). 이 모양이면 가려지는 창 높이 경계가 hb = 2.8 − 2.05·f 로 내린 정도 f에 정비례한다. */
(function () {
  'use strict';
  var T = THREE, B = EXP.blocks, V = EXP.viz;
  var WX0 = -6.5, WX1 = -3.5, WY0 = 0.8, WY1 = 2.8, WZ = -0.5;       // 창(얇은 창으로 본 면)
  var HY = 3.6, HZ = 0.0, EDY = -0.85, EDZ = 0.75;                     // 차양 경첩, 다 내렸을 때 끝까지의 변위
  var GRIP_TOP = 2.7, GRIP_TRAVEL = 1.45;                               // 손잡이 중심 높이(f=0)와 이동 거리
  var STRIPS = 8, RAY_X = [-6.2, -5.6, -5.0, -4.4, -3.8], RAY_H = [1.05, 1.55, 2.05, 2.55];
  var AIR_MAX = 10;                                                     // 더운 공기·찬 바람 입자 최대 수(각각)

  function lvl(v) { return v > 0.68 ? '많음' : v > 0.42 ? '보통' : '적음'; }
  function smooth(k) { return k * k * (3 - 2 * k); }

  EXP.registerFacility({
    id: 'shade',
    // 방 안 낮은 눈높이에서 창을 올려다보게: 바닥 햇빛 자국, 창 너머 차양 천, 손잡이, 에어컨이 한 화면에
    cam: { pos: [-3.4, 2.15, -4.85], target: [-5.3, 1.55, -1.5] },

    build: function (ctx) {
      var self = this, root = ctx.root, ui = ctx.ui;
      var s = this.s = { f: 0, target: null, q: 1, intro: 1, t: 0, dragging: false, done: false, pulse: 0, lastInfo: '' };
      var sd = new T.Vector3(ctx.sunDir[0], ctx.sunDir[1], ctx.sunDir[2]);  // 해 쪽(정규화 안 함: 아래 식이 이 값 기준)
      s.sd = sd; s.sdn = sd.clone().normalize();

      // --- 고정 부품: 차양 통(바깥, 창 위), 손잡이 레일(안쪽 창 옆 벽), 벽걸이 에어컨 ---
      root.add(B.mesh([
        { min: [-6.95, 3.45, -0.02], max: [-3.05, 3.8, 0.3], mat: 'metal' },            // 말아 둔 차양이 들어가는 통
        { min: [-6.81, 1.0, -1.06], max: [-6.69, 3.0, -1.0], mat: '#2b2b2b' },           // 손잡이 레일(창 서쪽 옆 벽)
        { min: [-6.85, 2.98, -1.12], max: [-6.65, 3.06, -1.0], mat: '#2b2b2b' },
        // 벽걸이 에어컨: 서쪽 벽(x −7) 안쪽. 창 위에 두면 시설 모드 화면 맨 위(코어 힌트 칩 자리)에 걸려 잘 안 보였다
        { min: [-7.0, 2.25, -3.15], max: [-6.68, 2.75, -1.75], mat: '#eef0ea' },
        { min: [-6.68, 2.28, -3.05], max: [-6.64, 2.36, -1.85], mat: '#2b2b2b' }         // 찬 바람 나오는 틈
      ]));
      var acTag = V.textSprite('에어컨', { height: 0.26, color: '#1a5fa8' }); acTag.position.set(-6.5, 3.0, -2.45); root.add(acTag);

      // --- 차양 천(줄무늬 캔버스 재질 하나: 천 + 앞 드리개) ---
      var c = document.createElement('canvas'); c.width = c.height = 16;
      var g = c.getContext('2d'); g.fillStyle = '#2f6f9f'; g.fillRect(0, 0, 16, 16); g.fillStyle = '#f4f1e6'; g.fillRect(8, 0, 8, 16);
      g.fillStyle = 'rgba(0,0,0,0.08)'; g.fillRect(0, 15, 16, 1);
      var tx = new T.CanvasTexture(c); tx.magFilter = T.NearestFilter; tx.minFilter = T.NearestFilter;
      tx.wrapS = tx.wrapT = T.RepeatWrapping; tx.colorSpace = T.SRGBColorSpace;
      var cloth = new T.MeshLambertMaterial({ map: tx, side: T.DoubleSide });
      var pivot = new T.Group(); pivot.position.set(0, HY, HZ + 0.15); root.add(pivot);
      pivot.rotation.x = Math.atan2(-EDY, EDZ);                                      // +z 를 비스듬히 아래로
      var LEN = Math.hypot(EDY, EDZ);
      var sheet = new T.Group(); pivot.add(sheet);
      sheet.add(B.mesh([{ min: [-6.9, -0.03, 0], max: [-3.1, 0.03, 1], mat: cloth, uv: 2 }]));  // 길이 1 → scale.z 로 펼침
      var flap = B.mesh([{ min: [-6.9, -0.36, -0.03], max: [-3.1, 0, 0.03], mat: cloth, uv: 2 }]);  // 끝의 드리개(세로)
      root.add(flap);
      s.pivot = pivot; s.sheet = sheet; s.flap = flap; s.LEN = LEN;

      // --- 손잡이(끄는 것): 노란 블록, 맥박으로 ‘누를 것’ 표시 ---
      var gripMat = new T.MeshBasicMaterial({ color: '#ffc21f', map: B.tex('tint') });   // 조명 무시: 그늘진 벽 앞에서도 ‘누를 것’이 밝게
      var grip = new T.Group(); root.add(grip);
      grip.add(B.mesh([{ min: [-0.18, -0.18, -0.14], max: [0.18, 0.18, 0.14], mat: gripMat, uv: 4 }]));
      // 누르는 영역은 0.56m 그대로(보이지 않는 판): 보이는 손잡이만 줄여 창·차양보다 먼저 눈에 띄지 않게
      grip.add(new T.Mesh(new T.BoxGeometry(0.56, 0.56, 0.4), new T.MeshBasicMaterial({ visible: false })));
      grip.name = 'shade:grip';
      s.grip = grip;

      // --- 바닥 햇빛 자국: 창 높이 띠(STRIPS개)마다 계단 모양 판 하나(InstancedMesh = 드로콜 1) ---
      var patch = new T.InstancedMesh(new T.BoxGeometry(1, 1, 1), new T.MeshBasicMaterial({ color: '#ffe08a' }), STRIPS);
      patch.frustumCulled = false; patch.name = 'shade:patch'; root.add(patch);
      s.patch = patch;
      // 그늘 판: 차양이 가린 만큼(햇빛 자국이 사라진 자리) 진한 불투명 판으로 채운다(드로콜 1)
      var shadow = new T.InstancedMesh(new T.BoxGeometry(1, 1, 1), new T.MeshBasicMaterial({ color: '#6f5a48' }), STRIPS);
      shadow.frustumCulled = false; shadow.name = 'shade:shadow'; root.add(shadow);
      s.shadow = shadow;

      // --- 햇빛 막대(해 방향과 나란한 곧은 막대, InstancedMesh 1개) ---
      var NR = RAY_X.length * RAY_H.length;
      var rays = new T.InstancedMesh(new T.BoxGeometry(0.05, 0.05, 0.6), new T.MeshBasicMaterial({ color: '#fff0a0' }), NR);
      rays.frustumCulled = false; rays.name = 'shade:rays'; rays.visible = false; root.add(rays);
      s.rays = rays; s.rayQ = new T.Quaternion().setFromUnitVectors(new T.Vector3(0, 0, 1), s.sdn.clone().negate());
      s.ray = [];
      RAY_H.forEach(function (h, j) {
        RAY_X.forEach(function (x, i) { s.ray.push({ x: x, h: h, ph: ((i * 0.37 + j * 0.61) % 1) }); });
      });

      // --- 공기 입자: 더운 공기(햇빛 자국에서 천장으로) + 에어컨 찬 바람, 같은 굵기 → InstancedMesh 1개(색은 인스턴스별) ---
      var air = new T.InstancedMesh(new T.BoxGeometry(0.16, 0.16, 0.16), new T.MeshBasicMaterial({ color: '#ffffff' }), AIR_MAX * 2);
      air.frustumCulled = false; air.name = 'shade:air'; air.visible = false; root.add(air);
      var warm = new T.Color('#ff5a3c'), cold = new T.Color('#3c8dff');
      for (var i = 0; i < AIR_MAX * 2; i++) air.setColorAt(i, i < AIR_MAX ? warm : cold);
      air.instanceColor.needsUpdate = true;
      s.air = air;
      s.paths = [path([[-4.2, 0.15, -1.6], [-4.0, 1.5, -2.2], [-4.2, 3.2, -3.0], [-5.0, 3.7, -3.7]]),
        path([[-6.55, 2.3, -2.45], [-5.9, 1.8, -2.65], [-5.2, 1.15, -3.0], [-4.6, 0.4, -3.3]])];

      // 매 프레임 재사용
      s.m4 = new T.Matrix4(); s.v = new T.Vector3(); s.v2 = new T.Vector3(); s.sc = new T.Vector3(); s.qI = new T.Quaternion();

      // --- 패널 ---
      ctx.showModelLabel(true);  // 더운 공기 입자·상대 막대 = 원리를 보여 주는 모형
      var head = ui.el('div', null, null);
      head.style.cssText = 'display:flex;gap:6px;align-items:center;margin-bottom:6px';
      var tag = ui.el('span', null, '여름 · 해가 높이 떠요', head);
      tag.style.cssText = 'display:inline-block;padding:2px 10px;border:2px solid #2b2b2b;border-radius:999px;font-size:16px;font-weight:700;background:#fff3b0';
      head.setAttribute('data-shade-state', '');
      s.dbg = head;
      var row = ui.row();
      s.btnDown = ui.button('차양 내리기', function () { self.go(ctx, 1); }, { parent: row, primary: true });
      s.btnUp = ui.button('차양 올리기', function () { self.go(ctx, 0); }, { parent: row });
      s.barHeat = ui.bar('방이 더워지는 정도', { max: 1, color: '#ffa726', format: lvl });
      s.barCool = ui.bar('에어컨 냉방 필요', { max: 1, color: '#3c8dff', format: lvl });
      ui.button('처음 상태로', function () { self.go(ctx, 0, true); }, { small: true });   // 범례보다 위: 작은 화면에서 스크롤 없이 보이게
      ui.legend([{ color: '#ff5a3c', text: '굵은 빨강 — 더워진 공기' }, { color: '#3c8dff', text: '굵은 파랑 — 에어컨 찬 바람' }]);

      // --- 3D 입력: 손잡이 끌기(세로), 손잡이 톡 = 반대로 ---
      ctx.draggable(grip, {
        normal: [0, 0, 1],
        onStart: function () { s.dragging = true; s.target = null; },
        onMove: function (p, d) { self.setF(ctx, s.f - d.y / GRIP_TRAVEL); },
        onEnd: function () { s.dragging = false; self.settle(ctx); }
      });
      ctx.onTap(grip, function () { self.go(ctx, s.f < 0.5 ? 1 : 0); });

      this.setF(ctx, 0);
      this.place();
      s.barHeat.set(1); s.barCool.set(1);
      this.say(ctx);

      function path(pts) {
        var p = pts.map(function (a) { return new T.Vector3(a[0], a[1], a[2]); }), cum = [0];
        for (var k = 1; k < p.length; k++) cum.push(cum[k - 1] + p[k].distanceTo(p[k - 1]));
        return { p: p, cum: cum, len: cum[cum.length - 1] };
      }
    },

    enter: function () { this.s.intro = 0; },     // 카메라가 날아오는 동안 햇빛 막대·공기가 먼저 나타난다

    exit: function () { var s = this.s; s.rays.visible = s.air.visible = false; s.dragging = false; },

    go: function (ctx, to, reset) {
      var s = this.s; s.target = to;
      if (reset) { s.done = false; s.pulse = 0; }
    },

    setF: function (ctx, f) {
      var s = this.s; s.f = Math.max(0, Math.min(1, f));
      s.q = Math.max(0, Math.min(1, 1 - 1.025 * s.f));   // 창으로 들어오는 햇빛 몫(위에서부터 가려짐)
      this.layout();
    },

    // 손을 떼거나 버튼 애니메이션이 끝났을 때: 충분히 내렸으면 기록 + 썸네일
    settle: function (ctx) {
      var s = this.s;
      if (s.f >= 0.8) { s.done = true; ctx.markOperated({ delay: 700 }); }
      this.say(ctx);
    },

    say: function (ctx) {
      var s = this.s, t;
      if (s.f >= 0.8) t = '햇빛을 가리면 방이 덜 더워져 냉방에 드는 에너지를 아낄 수 있어요.';
      else if (s.f > 0.15) t = '차양을 내릴수록 바닥의 햇빛이 그늘로 바뀌어요. 끝까지 내려 볼까요?';
      else if (s.done) t = '차양을 올리니 햇빛이 다시 들어와요. 방이 더워지고 에어컨이 더 애써야 해요.';
      else t = '여름 햇빛이 창으로 들어와 바닥이 뜨거워져요. 노란 손잡이를 끌어 차양을 내려 볼까요?';
      if (t !== s.lastInfo) { s.lastInfo = t; ctx.ui.setInfo(t); }
      var down = s.f >= 0.8, up = s.f <= 0.02;
      s.btnDown.classList.toggle('primary', !s.done && !down);
      s.btnDown.classList.toggle('on', down); s.btnUp.classList.toggle('on', up && s.done);
      s.btnDown.textContent = (down ? '✓ ' : '') + '차양 내리기';
      s.btnUp.textContent = (up && s.done ? '✓ ' : '') + '차양 올리기';
    },

    // f(내린 정도) → 차양 천·손잡이·바닥 햇빛 자국 배치(바뀔 때만)
    layout: function () {
      var s = this.s, f = s.f, m4 = s.m4, area = 0;
      s.sheet.scale.z = Math.max(0.001, f * s.LEN);
      s.flap.visible = f > 0.03;
      s.flap.position.set(0, HY + EDY * f + 0.02 * (1 - f), HZ + 0.15 + EDZ * f);
      s.grip.position.set(-6.75, GRIP_TOP - GRIP_TRAVEL * f, -1.21);
      var hb = WY1 - 2.05 * f, dh = (WY1 - WY0) / STRIPS;
      // 창 높이 띠 [h0,h1] 이 바닥에 닿는 자리에 판 k 를 놓고 넓이를 돌려준다(얇으면 숨김)
      function strip(mesh, k, h0, h1, y) {
        if (h1 - h0 < 0.004) { m4.makeScale(0.0001, 0.0001, 0.0001); mesh.setMatrixAt(k, m4); return 0; }
        var sh = 0.4375 * (WY0 + dh * (k + 0.5));                                         // 띠 가운데 높이만큼 x로 밀림
        var x0 = Math.max(-6.98, WX0 + sh), x1 = Math.min(-3.02, WX1 + sh);
        var zn = WZ - 0.625 * h0, zf = WZ - 0.625 * h1;                                  // 창 높이 h → 바닥 z
        m4.makeScale(x1 - x0, 0.012, zn - zf); m4.setPosition((x0 + x1) / 2, y, (zn + zf) / 2);
        mesh.setMatrixAt(k, m4); return (x1 - x0) * (zn - zf);
      }
      for (var k = 0; k < STRIPS; k++) {
        var lo = WY0 + dh * k, hi = WY0 + dh * (k + 1);
        area += strip(s.patch, k, lo, Math.min(hi, hb), 0.008);
        strip(s.shadow, k, Math.max(lo, hb), hi, 0.006);                                 // 가려진 나머지 = 그늘
      }
      s.patch.instanceMatrix.needsUpdate = s.shadow.instanceMatrix.needsUpdate = true;
      s.area = area;
      s.dbg.dataset.shadeF = s.f.toFixed(3); s.dbg.dataset.shadeQ = s.q.toFixed(3); s.dbg.dataset.shadeArea = area.toFixed(3);
    },

    // 햇빛 막대·공기 입자(시설 모드에서만)
    place: function () {
      var s = this.s, m4 = s.m4, v = s.v, v2 = s.v2, sd = s.sd, i, k;
      var hb = WY1 - 2.05 * s.f, grow = 0.6 + 0.4 * smooth(Math.min(1, s.intro / 0.35)), sc = s.sc.set(grow, grow, grow);
      var MK = 1.1333, MB = 0.8 + 0.5 * MK;                                // 차양 선: y = 3.6 − MK·z
      for (i = 0; i < s.ray.length; i++) {
        var r = s.ray[i], sEnd;
        if (r.h >= hb) sEnd = (HY + 0.5 * MK - r.h) / MB;                    // 차양 천에서 멈춤(바깥)
        else sEnd = Math.max(-r.h / sd.y, (r.x + 3.02) / -sd.x);             // 바닥 또는 벽A(x −3)에 먼저 닿는 곳
        var sStart = 3.0, L = sStart - sEnd, p = (r.ph + s.t * 1.0 / L) % 1;  // 1 m/s
        var at = sStart - L * p;
        v.set(r.x + sd.x * at, r.h + sd.y * at, WZ + sd.z * at);
        m4.compose(v, s.rayQ, sc); s.rays.setMatrixAt(i, m4);
      }
      s.rays.instanceMatrix.needsUpdate = true;
      // 공기: 더운 공기 수 ∝ 들어오는 햇빛, 찬 바람 수 ∝ 냉방 필요. 0으로 떨어뜨리지 않음
      // 가장 적을 때도 3개가 0.6m 간격으로 한 줄을 이뤄 ‘흐름’으로 읽히게 한다
      var counts = [Math.round(3 + 7 * s.q), Math.round(3 + 7 * s.q)], speeds = [0.5 + 0.2 * s.q, 0.5 + 0.2 * s.q];
      for (k = 0; k < 2; k++) {
        var P = s.paths[k];
        for (i = 0; i < AIR_MAX; i++) {
          var idx = k * AIR_MAX + i;
          if (i >= counts[k]) { m4.makeScale(0.0001, 0.0001, 0.0001); s.air.setMatrixAt(idx, m4); continue; }
          var d = (i * Math.min(P.len / counts[k], 0.6) + s.t * speeds[k]) % P.len;
          for (var j = 1; j < P.p.length; j++) if (d <= P.cum[j] || j === P.p.length - 1) {
            v2.lerpVectors(P.p[j - 1], P.p[j], Math.min(1, (d - P.cum[j - 1]) / (P.cum[j] - P.cum[j - 1]))); break;
          }
          m4.compose(v2, s.qI, sc); s.air.setMatrixAt(idx, m4);
        }
      }
      s.air.instanceMatrix.needsUpdate = true;
    },

    update: function (dt, ctx) {
      var s = this.s;
      if (s.target !== null && !s.dragging) {                              // 버튼: 0.7초에 끝까지
        var d = s.target - s.f, st = dt / 0.7;
        if (Math.abs(d) <= st) { this.setF(ctx, s.target); s.target = null; this.settle(ctx); }
        else this.setF(ctx, s.f + Math.sign(d) * st);
      }
      if (!ctx.active) return;
      s.t += dt; s.intro += dt;
      s.rays.visible = s.air.visible = true;
      // 아직 끝까지 내려 보지 않았으면 손잡이가 1.4초 주기로 1→1.12 맥박
      s.pulse = s.done ? 0 : (s.pulse + dt) % 1.4;
      s.grip.scale.setScalar(s.done ? 1 : 1 + 0.12 * Math.sin(Math.PI * s.pulse / 1.4));
      s.barHeat.set(0.22 + 0.78 * s.q); s.barCool.set(0.2 + 0.8 * s.q);
      if (s.dragging) this.say(ctx);
      this.place();
    }
  });
})();
