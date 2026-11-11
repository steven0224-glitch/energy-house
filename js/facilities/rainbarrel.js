/* 마당 · 빗물통 — 완성 구현이자 시설 작성자용 참조 예시(ARCHITECTURE.md §6).
   조작: 빗물통 뚜껑이 열린다 → ‘수돗물로 주기’ / ‘빗물로 주기’ → 물뿌리개가 채워져 같은 화단에 10L를 준다 → 꽃이 살아난다.
   막대 두 개: 전체 물 사용(매번 +10L) / 수돗물 사용(수돗물로 줄 때만 +10L). 그 밖의 수치는 표시하지 않는다. */
(function () {
  'use strict';
  var T = THREE, B = EXP.blocks, V = EXP.viz;
  var DOSE = 10; // 화단에 한 번 주는 물(L) — 요구사항이 정한 유일한 수치
  var LOCK = 1.5; // 물 주는 동안 다른 버튼을 잠그는 최대 시간(s)

  EXP.registerFacility({
    id: 'rainbarrel',

    build: function (ctx) {
      var s = this.s = { lid: 0, lidTarget: 0, level: 1, alive: 0, aliveTarget: 0, anim: null, autoOpen: -1, total: 0, tap: 0 };
      var root = ctx.root;

      // 드로콜 예산(ARCHITECTURE §2, 12개 이하): 움직이지 않는 상자는 B.mesh 한 번(재질당 1개),
      // 단색 블록(꽃·수도꼭지 손잡이·물뿌리개·뚜껑 손잡이)은 InstancedMesh 하나로 묶는다.
      var BX = 6.0, BY = 0.4, BZ = 1.2; // 빗물통 자리
      var off = function (b) { return { min: [b.min[0] + BX, b.min[1] + BY, b.min[2] + BZ], max: [b.max[0] + BX, b.max[1] + BY, b.max[2] + BZ], mat: b.mat }; };
      var statics = [
        // 받침대 + 홈통(지붕 빗물이 통으로 들어오는 길)
        { min: [5.45, 0, 0.65], max: [6.55, 0.4, 1.75], mat: 'stone' },
        { min: [3.0, 4.6, 0.0], max: [7.8, 4.78, 0.32], mat: 'metal' },
        { min: [5.92, 1.4, 0.1], max: [6.08, 4.6, 0.26], mat: 'metal' },
        { min: [5.92, 1.4, 0.1], max: [6.08, 1.56, 0.72], mat: 'metal' },
        // 화단
        { min: [7.6, 0, 2.2], max: [10.6, 0.35, 2.4], mat: 'plank' }, { min: [7.6, 0, 4.0], max: [10.6, 0.35, 4.2], mat: 'plank' },
        { min: [7.6, 0, 2.4], max: [7.8, 0.35, 4.0], mat: 'plank' }, { min: [10.4, 0, 2.4], max: [10.6, 0.35, 4.0], mat: 'plank' },
        { min: [7.8, 0, 2.4], max: [10.4, 0.3, 4.0], mat: 'soil' },
        // 수도꼭지
        { min: [10.95, 0, 3.05], max: [11.25, 1.1, 3.35], mat: 'stone' },
        { min: [10.72, 0.94, 3.15], max: [10.95, 1.04, 3.25], mat: 'metal' }
      ];
      // 빗물통(속이 빈 통: 뚜껑을 열면 안의 물이 보인다)
      var parts = [{ min: [-0.5, 0, -0.5], max: [0.5, 0.1, 0.5], mat: 'darkwood' },
        { min: [-0.5, 0, 0.4], max: [0.5, 1.2, 0.5], mat: 'plank' }, { min: [-0.5, 0, -0.5], max: [0.5, 1.2, -0.4], mat: 'plank' },
        { min: [-0.5, 0, -0.4], max: [-0.4, 1.2, 0.4], mat: 'plank' }, { min: [0.4, 0, -0.4], max: [0.5, 1.2, 0.4], mat: 'plank' },
        { min: [-0.06, 0.15, 0.5], max: [0.06, 0.25, 0.68], mat: 'metal' }];
      [0.25, 0.85].forEach(function (y) {
        parts.push({ min: [-0.53, y, 0.5], max: [0.53, y + 0.08, 0.53], mat: 'metal' }, { min: [-0.53, y, -0.53], max: [0.53, y + 0.08, -0.5], mat: 'metal' },
          { min: [-0.53, y, -0.5], max: [-0.5, y + 0.08, 0.5], mat: 'metal' }, { min: [0.5, y, -0.5], max: [0.53, y + 0.08, 0.5], mat: 'metal' });
      });
      root.add(B.mesh(statics.concat(parts.map(off))));

      // 누르기 판정용 투명 상자(그리지 않으므로 드로콜 0)
      var hitMat = new T.MeshBasicMaterial({ visible: false });
      var hit = function (min, max) {
        var m = new T.Mesh(new T.BoxGeometry(max[0] - min[0], max[1] - min[1], max[2] - min[2]), hitMat);
        m.position.set((min[0] + max[0]) / 2, (min[1] + max[1]) / 2, (min[2] + max[2]) / 2); return m;
      };
      var barrel = new T.Group(); barrel.position.set(BX, BY, BZ); root.add(barrel);
      barrel.add(hit([-0.55, 0, -0.55], [0.55, 1.3, 0.55]));
      var water = B.mesh([{ min: [-0.4, 0, -0.4], max: [0.4, 1, 0.4], mat: 'water' }]);
      water.position.y = 0.1; barrel.add(water);
      var hinge = new T.Group(); hinge.position.set(0, 1.2, -0.52); barrel.add(hinge);
      hinge.add(B.mesh([{ min: [-0.55, 0, 0], max: [0.55, 0.1, 1.08], mat: 'darkwood' }]));
      // 통이 수도꼭지보다 멀어 같은 높이면 화면에서 작다 → 0.5. 물뿌리개 ‘10L’(통 앞 y≈0.65)과 겹치지 않게 통 위쪽에 붙인다
      var tagRain = V.textSprite('빗물', { height: 0.5, color: '#1a5fa8' }); tagRain.position.set(0, 0.8, 0.62); barrel.add(tagRain);
      var faucet = hit([10.7, 0, 3.0], [11.3, 1.25, 3.4]); root.add(faucet);
      var tagTap = V.textSprite('수돗물', { height: 0.42, color: '#444' }); tagTap.position.set(11.1, 1.55, 3.2); root.add(tagTap);

      // 단색 블록 목록: 기준 오브젝트(anchor)의 좌표계 안 상자. 매 프레임 anchor 위치로 인스턴스 행렬을 맞춘다.
      var cells = s.cells = [];
      var cell = function (anchor, min, max, color) { cells.push({ a: anchor, min: min, max: max, c: new T.Color(color) }); return cells[cells.length - 1]; };
      var WILT = new T.Color('#8a7a5a'), COLORS = ['#ff4f6d', '#ffb21f', '#c056ff', '#ff6fb0', '#4f8dff'];
      // 화단 꽃(처음엔 시들어 있음)
      s.flowers = [8.15, 8.65, 9.15, 9.65, 10.1].map(function (x, i) {
        var g = new T.Group(); g.position.set(x, 0.3, i % 2 ? 3.55 : 2.85); root.add(g);
        var head = new T.Group(); head.position.y = 0.55; g.add(head);
        cell(g, [-0.03, 0, -0.03], [0.03, 0.55, 0.03], '#3d8b2f'); cell(g, [0, 0.2, -0.02], [0.15, 0.25, 0.02], '#3d8b2f');
        var petal = cell(head, [-0.14, -0.04, -0.14], [0.14, 0.04, 0.14], WILT);
        cell(head, [-0.06, 0, -0.06], [0.06, 0.07, 0.06], '#f7d23a');
        return { g: g, head: head, petal: petal.c, color: new T.Color(COLORS[i]), sign: i % 2 ? 1 : -1 };
      });
      s.wilt = WILT;
      cell(root, [11.04, 1.1, 3.14], [11.16, 1.18, 3.26], '#d23c3c'); // 수도꼭지 손잡이
      cell(hinge, [-0.1, 0.1, 0.8], [0.1, 0.18, 0.95], '#a9b1b8');      // 뚜껑 손잡이
      // 물뿌리개(물 주는 동안만 보임) + 물줄기 입자
      var can = new T.Group(); can.visible = false; root.add(can);
      cell(can, [-0.18, 0, -0.12], [0.18, 0.3, 0.12], '#3aa56b');
      cell(can, [0.18, 0.14, -0.035], [0.44, 0.2, 0.035], '#2e8a57'); cell(can, [-0.14, 0.3, -0.025], [0.08, 0.37, 0.025], '#2e8a57');
      var tag10 = V.textSprite(DOSE + 'L', { height: 0.36 }); tag10.position.set(0, 0.65, 0); can.add(tag10);
      var im = s.im = new T.InstancedMesh(new T.BoxGeometry(1, 1, 1), new T.MeshLambertMaterial({ map: B.tex('tint') }), cells.length);
      im.frustumCulled = false; root.add(im);
      s.root = root; s.m4 = new T.Matrix4(); s.inv = new T.Matrix4(); s.v1 = new T.Vector3(); s.v2 = new T.Vector3(); s.q = new T.Quaternion();
      this.syncCells();
      var stream = V.flow([[0, 0, 0], [0, -0.1, 0]], { color: '#6fc3ff', count: 14, size: 0.07, speed: 1.6 });
      stream.object3d.visible = false; root.add(stream.object3d);

      ctx.addCollider([5.45, 0, 0.65], [6.55, 1.7, 1.75]);
      ctx.addCollider([10.95, 0, 3.05], [11.25, 1.2, 3.35]);
      s.barrel = barrel; s.water = water; s.hinge = hinge; s.can = can; s.stream = stream;

      // 패널: 안내 한두 문장 + 큰 버튼 두 개 + 막대 두 개
      var ui = ctx.ui, self = this;
      ui.setInfo('빗물통에는 지붕에서 모은 빗물이 담겨 있어요. 무엇으로 화단에 물을 줄까요?');
      var row = ui.row();
      s.btnTap = ui.button('수돗물로 주기', function () { self.water(ctx, 'tap'); }, { parent: row });
      s.btnRain = ui.button('빗물로 주기', function () { self.water(ctx, 'rain'); }, { parent: row, primary: true });
      ui.el('div', 'plegend', '한 번 줄 때마다 같은 화단에 ' + DOSE + 'L를 줘요.');
      var fmt = function (v) { return v + 'L'; };
      s.barTotal = ui.bar('전체 물 사용', { max: 40, color: '#3d8fe0', format: fmt });
      s.barTap = ui.bar('수돗물 사용', { max: 40, color: '#8a96a3', format: fmt });
      ui.button('처음 상태로', function () { self.reset(ctx); }, { small: true });

      // 3D 오브젝트 직접 누르기: 통 = 뚜껑 열기/빗물로 주기, 수도꼭지 = 수돗물로 주기
      ctx.onTap(barrel, function () { if (s.lidTarget === 0) s.lidTarget = 1.75; else self.water(ctx, 'rain'); });
      ctx.onTap(faucet, function () { self.water(ctx, 'tap'); });
    },

    enter: function () {
      var s = this.s;
      if (s.lidTarget === 0) s.autoOpen = 0.45; // 카메라가 도착할 즈음 뚜껑이 먼저 열린다(화면 변화가 먼저)
    },

    exit: function () { this.s.autoOpen = -1; },

    water: function (ctx, src) {
      var s = this.s;
      // 붓는 중 다른 쪽을 누르면 끝난 뒤 이어서 준다(그 버튼이 ‘다음 차례’로 바뀌어 받았음을 보인다). 붓고 있는 쪽은 다시 눌러도 그대로
      if (s.anim) { if (s.anim.t > LOCK && src !== s.anim.src) { s.next = src; this.mark(s.anim.src, src); } return; }
      s.lidTarget = 1.75;
      s.anim = { src: src, t: 0, barsDone: false };
      (src === 'rain' ? s.btnTap : s.btnRain).disabled = true; // 방금 누른 버튼은 잠그지 않는다(art-direction §4)
      this.mark(src);
      ctx.ui.setInfo(src === 'rain' ? '빗물통의 빗물을 받아요.' : '수도꼭지에서 수돗물을 받아요.');
    },

    // 버튼 상태(art-direction §4 ‘켜진 것’ = .on): 붓는 쪽 ‘물 주는 중…’, 이어서 줄 쪽 ‘다음 차례’, 다 부으면 원래 이름.
    // ‘✓ 수돗물로 주기’는 1000×600 에서 두 줄로 꺾여 패널이 들썩여서 짧은 글자로 바꾼다
    mark: function (pour, next) {
      var s = this.s;
      [[s.btnTap, 'tap', '수돗물로 주기'], [s.btnRain, 'rain', '빗물로 주기']].forEach(function (x) {
        var t = x[1] === pour ? '물 주는 중…' : x[1] === next ? '다음 차례' : x[2];
        x[0].textContent = t; x[0].classList.toggle('on', t !== x[2]);
      });
    },

    reset: function (ctx) {
      var s = this.s; if (s.anim) return;
      s.total = s.tap = 0; s.level = 1; s.aliveTarget = 0;
      s.barTotal.setMax(40); s.barTap.setMax(40); s.barTotal.set(0); s.barTap.set(0);
      ctx.ui.setInfo('꽃이 다시 목말라요. 무엇으로 물을 줄까요?');
    },

    update: function (dt, ctx) {
      var s = this.s, i;
      if (s.autoOpen >= 0) { s.autoOpen -= dt; if (s.autoOpen < 0) s.lidTarget = 1.75; }
      s.lid += (s.lidTarget - s.lid) * Math.min(1, dt * 5);
      s.hinge.rotation.x = -s.lid;
      s.water.scale.y += (0.9 * s.level - s.water.scale.y) * Math.min(1, dt * 3);
      s.alive += Math.sign(s.aliveTarget - s.alive) * Math.min(Math.abs(s.aliveTarget - s.alive), dt / 1.2);
      for (i = 0; i < s.flowers.length; i++) {
        var fl = s.flowers[i];
        fl.g.rotation.z = (1 - s.alive) * 1.05 * fl.sign;
        fl.head.scale.setScalar(0.75 + 0.25 * s.alive);
        fl.petal.copy(fl.color).lerp(s.wilt, 1 - s.alive);
      }
      if (s.anim) this.animate(dt, ctx);
      this.syncCells();
    },

    // 단색 블록 인스턴스 = (root 기준 anchor 행렬) × (상자 이동·크기). 숨은 anchor 의 블록은 크기 0.
    syncCells: function () {
      var s = this.s, im = s.im, m4 = s.m4, i, c, o, vis;
      s.root.updateMatrixWorld(true); s.inv.copy(s.root.matrixWorld).invert();
      for (i = 0; i < s.cells.length; i++) {
        c = s.cells[i]; vis = true;
        for (o = c.a; o && o !== s.root; o = o.parent) if (!o.visible) { vis = false; break; }
        s.v1.set((c.min[0] + c.max[0]) / 2, (c.min[1] + c.max[1]) / 2, (c.min[2] + c.max[2]) / 2);
        if (vis) s.v2.set(c.max[0] - c.min[0], c.max[1] - c.min[1], c.max[2] - c.min[2]); else s.v2.set(0, 0, 0);
        m4.compose(s.v1, s.q, s.v2).premultiply(c.a.matrixWorld).premultiply(s.inv);
        im.setMatrixAt(i, m4); im.setColorAt(i, c.c);
      }
      im.instanceMatrix.needsUpdate = true; im.instanceColor.needsUpdate = true;
    },

    animate: function (dt, ctx) {
      var s = this.s, a = s.anim, can = s.can, st = s.stream.object3d;
      a.t += dt;
      if (a.t > LOCK) s.btnTap.disabled = s.btnRain.disabled = false; // 잠금은 1.5초 이내
      var t = a.t, rain = a.src === 'rain';
      var fill = rain ? new T.Vector3(6.0, 0, 2.0) : new T.Vector3(10.72, 0.35, 3.2);
      var pour0 = new T.Vector3(7.9, 0.85, 3.2), pour1 = new T.Vector3(10.0, 0.85, 3.2);
      can.visible = true; st.visible = false;
      if (t < 0.35) { can.position.copy(fill); can.rotation.z = 0; can.scale.setScalar(Math.max(0.01, t / 0.35)); }
      else if (t < 1.35) {
        can.scale.setScalar(1); can.position.copy(fill); st.visible = true;
        s.stream.setPoints(rain ? [[6.0, 0.6, 1.88], [6.0, 0.5, 1.97], [6.0, 0.3, 2.0]] : [[10.74, 0.94, 3.2], [10.72, 0.66, 3.2]]);
        if (rain) s.level = Math.max(0.25, s.level - dt * 0.15);
      } else if (t < 2.0) {
        var k = (t - 1.35) / 0.65; can.position.lerpVectors(fill, pour0, k); can.position.y += Math.sin(k * Math.PI) * 0.6;
      } else if (t < 3.8) {
        var tilt = Math.min(1, (t - 2.0) / 0.3);
        can.rotation.z = -0.7 * tilt;
        can.position.lerpVectors(pour0, pour1, Math.max(0, (t - 2.3) / 1.5));
        if (t > 2.3) {
          var tip = can.localToWorld(new T.Vector3(0.44, 0.17, 0));
          st.visible = true; s.stream.setPoints([[tip.x, tip.y, tip.z], [tip.x + 0.05, 0.32, tip.z]]);
          s.aliveTarget = 1;
        }
      } else if (t < 4.4) {
        can.rotation.z = -0.7 * Math.max(0, 1 - (t - 3.8) / 0.3);
        if (!a.barsDone) {
          a.barsDone = true;
          s.total += DOSE; if (!rain) s.tap += DOSE;
          var m = Math.max(40, Math.ceil(s.total / 20) * 20);
          s.barTotal.setMax(m); s.barTap.setMax(m); s.barTotal.set(s.total); s.barTap.set(s.tap);
          ctx.ui.setInfo(rain ? '꽃에 준 물은 ' + DOSE + 'L로 같아요. 빗물을 쓰니 수돗물 사용은 늘지 않았어요.'
            : '꽃에 준 물은 ' + DOSE + 'L로 같아요. 수돗물로 주니 수돗물 사용이 ' + DOSE + 'L 늘었어요.');
        }
        if (t > 4.1) can.scale.setScalar(Math.max(0.01, 1 - (t - 4.1) / 0.3));
      } else {
        can.visible = false; s.anim = null; s.btnTap.disabled = s.btnRain.disabled = false; this.mark(null);
        ctx.markOperated({ delay: 200 }); // 핵심 조작 완료 → 기록 + 꽃이 살아난 장면을 썸네일로
        if (s.next) { var nx = s.next; s.next = null; this.water(ctx, nx); }
      }
    }
  });
})();
