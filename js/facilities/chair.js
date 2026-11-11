/* 방 · 나무 의자 — 흔들리는 의자의 헐거운 다리 이음새(오른쪽 앞·뒤 2곳)를 직접 눌러(또는 ‘고치기’) 망치로 고치고, 고친 의자에 다시 앉아 본다.
   새 의자를 만들었다면 쓰였을 나무판 더미는 ‘아꼈어요’ 표시와 함께 그대로 남는다. 수치는 쓰지 않는다(ARCHITECTURE.md §1). */
(function () {
  'use strict';
  var T = THREE, B = EXP.blocks, V = EXP.viz;

  // 의자 바닥 중심과 방향: 로컬 +x 가 앞(나무판 더미 쪽), +z 가 오른쪽(시설 카메라 쪽)
  var CX = -5.4, CZ = -9.5, YAW = 0.5;
  var SEAT = 0.48, HALF = 0.28, LEG = 0.075, LX = HALF - LEG / 2 - 0.005, LEN = SEAT - 0.07;
  var JX = [LX, -LX];                                  // 헐거운 이음새 j=0 오른쪽 앞, j=1 오른쪽 뒤 (둘 다 z=+LX)
  var HIT_T0 = 0.25, HIT_DT = 0.36, HITS = 3, FIX_END = HIT_T0 + HITS * HIT_DT + 0.22; // 망치 타임라인(초)
  var PILE = [-3.85, -10.45];                          // 나무판 더미 바닥 중심(방 북동쪽 구석)
  var CAM = { pos: [-3.8, 1.7, -7.8], target: [-4.7, 0.45, -9.95] };
  var RAW = new T.Color('#6b4426'), GLOW_A = new T.Color('#ffb000'), GLOW_B = new T.Color('#ffe866'),
    NEWWOOD = new T.Color('#e0b877'), LEGC = new T.Color('#5b3a1e');
  var TXT = {
    start: '의자 다리 이음새가 헐거워서 흔들려요. 반짝이는 곳을 눌러 고쳐 보세요.',
    hammer: '망치로 이음새를 단단히 박고 있어요.',
    one: '한 곳이 단단해졌어요. 반짝이는 곳이 한 곳 더 있어요.',
    done: '흔들림이 멈췄어요. 새 의자를 만들지 않아도 되니 나무판이 그대로 남았어요.',
    notYet: '아직 흔들려서 앉기 어려워요. 반짝이는 이음새부터 고쳐요.',
    tapChair: '반짝이는 이음새를 눌러야 고칠 수 있어요.',
    seated: '고친 의자에 다시 앉았어요. 고쳐 쓰면 새 의자에 들 나무를 아껴요.'
  };

  function toWorld(lx, ly, lz) { var c = Math.cos(YAW), s = Math.sin(YAW); return [CX + lx * c + lz * s, ly, CZ - lx * s + lz * c]; }
  function ease(k) { k = Math.max(0, Math.min(1, k)); return k * k * (3 - 2 * k); }
  var SIT_POS = toWorld(-0.2, 1.1, 0), SIT_TGT = toWorld(1.5, 0.12, 0.15);

  // 매 프레임 재사용(할당 금지)
  var _m = new T.Matrix4(), _p = new T.Vector3(), _s = new T.Vector3(), _q = new T.Quaternion(), _e = new T.Euler(),
    _ax = new T.Vector3(1, 0, 0), _c = new T.Color(), _w = new T.Vector3();

  function setInst(im, i, x, y, z, sx, sy, sz, q) {
    _p.set(x, y, z); _s.set(Math.max(sx, 1e-4), Math.max(sy, 1e-4), Math.max(sz, 1e-4));
    _m.compose(_p, q || _q.identity(), _s); im.setMatrixAt(i, _m);
  }
  // 다리: 윗끝(x, top, z)을 축으로 바깥(+z)으로 splay 만큼 벌어진다
  function setLeg(im, i, x, z, top, splay) {
    _q.setFromAxisAngle(_ax, -splay);
    _w.set(0, -LEN / 2, 0).applyQuaternion(_q);
    setInst(im, i, x + _w.x, top + _w.y, z + _w.z, LEG, LEN, LEG, _q);
  }
  var DOT = 'width:30px;height:30px;flex:none;border-radius:50%;border:3px solid #2b2b2b;font-size:15px;font-weight:800;display:flex;align-items:center;justify-content:center;';
  function setDot(d, st, n) { d.style.background = ['#fff', '#ffd34d', '#6fd08c'][st]; d.textContent = st === 2 ? '✓' : n; }

  EXP.registerFacility({
    id: 'chair',
    cam: CAM,

    build: function (ctx) {
      var s = this.s = { t: 0, fixed: [false, false], L: [1, 1], anim: null, queue: [], seated: false, amp: 0, kick: 0, jolt: 0,
        glow: 0, sparkIn: 1, pop: 1, tagIn: 1, spark: { t: 1, x: 0, y: 0 }, dbgT: 0, wob: 0 };
      var root = ctx.root, self = this;

      // 의자: 회전 받침(pivot) → 흔들리는 몸(rock). 깔개도 의자 방향에 맞춘다
      var pivot = new T.Group(); pivot.position.set(CX, 0, CZ); pivot.rotation.y = YAW; root.add(pivot);
      pivot.add(B.mesh([{ min: [-0.85, 0, -0.75], max: [0.85, 0.02, 0.75], mat: '#7f98ab' }]));
      var rock = new T.Group(); pivot.add(rock);
      var body = [{ min: [-HALF, LEN, -HALF], max: [HALF, SEAT, HALF], mat: 'darkwood' },               // 앉는 판(바닥 plank 와 구분되게 짙은 나무)
        { min: [-LX - 0.03, SEAT + 0.42, -HALF], max: [-LX + 0.03, SEAT + 0.6, HALF], mat: 'plank' },    // 등받이 위
        { min: [-LX - 0.03, SEAT + 0.2, -HALF + 0.03], max: [-LX + 0.03, SEAT + 0.28, HALF - 0.03], mat: 'plank' },
        { min: [-LX + 0.02 - 0.02, 0.13, -LX - 0.02], max: [LX, 0.17, -LX + 0.02], mat: 'darkwood' }];  // 왼쪽 가로대
      [-LX, LX].forEach(function (z) { body.push({ min: [-LX - LEG / 2, SEAT, z - LEG / 2], max: [-LX + LEG / 2, SEAT + 0.62, z + LEG / 2], mat: 'darkwood' }); });
      rock.add(B.mesh(body));

      // 다리 4 + 이음새 받침 2 + 새 나무못 2 = InstancedMesh 하나(드로콜 1). 0·1 왼쪽 다리(고정), 2·3 헐거운 다리, 4·5 이음새, 6·7 나무못
      var parts = new T.InstancedMesh(new T.BoxGeometry(1, 1, 1), new T.MeshLambertMaterial({ color: '#ffffff' }), 8);
      parts.frustumCulled = false;
      for (var i = 0; i < 8; i++) parts.setColorAt(i, i < 4 ? LEGC : i < 6 ? RAW : NEWWOOD);
      setLeg(parts, 0, LX, -LX, LEN, 0); setLeg(parts, 1, -LX, -LX, LEN, 0);
      rock.add(parts);

      // 반짝임(이음새마다 5개) + 망치질 불똥 6개 = InstancedMesh 하나
      var sparks = new T.InstancedMesh(new T.BoxGeometry(1, 1, 1), new T.MeshBasicMaterial({ color: '#ffd84a' }), 16);
      sparks.frustumCulled = false; rock.add(sparks);

      // 누르는 영역(보이지 않는 상자, 한 변 0.36m 이상)
      var hitMat = new T.MeshBasicMaterial({ visible: false });
      var hits = JX.map(function (x) {
        var h = new T.Mesh(new T.BoxGeometry(0.36, 0.5, 0.4), hitMat); h.position.set(x, SEAT - 0.18, LX + 0.04); rock.add(h); return h;
      });

      // 망치: 손잡이 끝이 축, 머리(로컬 -x 끝)가 나무못을 내리친다
      var hammer = new T.Group(); hammer.visible = false; rock.add(hammer);
      hammer.add(B.mesh([{ min: [-0.42, -0.022, -0.022], max: [0, 0.022, 0.022], mat: '#d2553a' },
        { min: [-0.47, -0.1, -0.05], max: [-0.36, 0.09, 0.05], mat: 'metal' }]));

      var creak = V.textSprite('삐걱', { height: 0.3, color: '#8a3b12', bg: '#fffdf5' });
      creak.position.set(0.05, SEAT + 0.95, 0.1); creak.visible = false; pivot.add(creak);
      creak.userData.base = creak.scale.clone();

      // 새 의자를 만들었다면 쓰였을 나무판 더미(받침목 위 판 3켜 + 다리가 될 각목 4개)
      var pile = new T.Group(); pile.position.set(PILE[0], 0, PILE[1]); root.add(pile);
      var W = '#e0b877', pb = [];
      [-0.25, 0.25].forEach(function (x) { pb.push({ min: [x - 0.04, 0, -0.36], max: [x + 0.04, 0.06, 0.36], mat: W }); });
      for (var k = 0; k < 3; k++) {
        var y = 0.06 + k * 0.09;
        for (var b = 0; b < 3; b++) pb.push({ min: [-0.4, y, -0.36 + b * 0.25], max: [0.4, y + 0.05, -0.36 + b * 0.25 + 0.22], mat: W });
        if (k < 2) [-0.25, 0.25].forEach(function (x) { pb.push({ min: [x - 0.03, y + 0.05, -0.36], max: [x + 0.03, y + 0.09, 0.36], mat: W }); });
      }
      [-0.27, -0.1, 0.07, 0.24].forEach(function (z) { pb.push({ min: [-0.36, 0.29, z - 0.035], max: [0.36, 0.36, z + 0.035], mat: W }); });
      pile.add(B.mesh(pb));
      var tagNew = V.textSprite('새 의자용 나무', { height: 0.3, bg: '#fffdf5' });
      var tagSaved = V.textSprite('✓ 아꼈어요', { height: 0.36, color: '#135f2a', bg: '#dff7e5' });
      // 벽(x=-3)에 글자 판이 묻히지 않게 방 안쪽으로 비켜 둔다
      tagNew.position.set(-0.35, 0.78, 0.1); tagSaved.position.set(-0.35, 0.8, 0.1); tagSaved.visible = false;
      tagSaved.userData.base = tagSaved.scale.clone();
      pile.add(tagNew, tagSaved);

      var cw = toWorld(0, 0, 0), r = HALF * (Math.cos(YAW) + Math.sin(YAW));
      ctx.addCollider([cw[0] - r, 0, cw[2] - r], [cw[0] + r, 1.1, cw[2] + r]);
      ctx.addCollider([PILE[0] - 0.45, 0, PILE[1] - 0.42], [PILE[0] + 0.45, 0.6, PILE[1] + 0.42]);
      s.pivot = pivot; s.rock = rock; s.parts = parts; s.sparks = sparks; s.hits = hits; s.hammer = hammer; s.creak = creak;
      s.pile = pile; s.tagNew = tagNew; s.tagSaved = tagSaved;

      // 패널: 안내 → 단계 점 → 고치기·앉아 보기 → 처음 상태로
      var ui = ctx.ui;
      ui.setInfo(TXT.start);
      var steps = s.dbgEl = ui.el('div'); steps.dataset.chair = '1';
      steps.style.cssText = 'display:flex;gap:6px;align-items:center;margin-bottom:10px';
      function step(n, label) {
        var d = ui.el('div', null, String(n), steps); d.style.cssText = DOT;
        ui.el('span', null, label, steps).style.cssText = 'font-size:15px;font-weight:700;white-space:nowrap';
        return d;
      }
      s.dot1 = step(1, '고치기');
      ui.el('div', null, null, steps).style.cssText = 'flex:1;min-width:10px;height:3px;background:#d8cfb8';
      s.dot2 = step(2, '앉아 보기');
      var row = ui.row();
      s.btnFix = ui.button('고치기', function () { self.fixAll(ctx); }, { parent: row, primary: true });
      s.btnSit = ui.button('앉아 보기', function () { self.sit(ctx); }, { parent: row });
      s.hint = ui.el('div', 'plegend', '반짝이는 이음새를 직접 눌러도 고칠 수 있어요.');
      ui.button('처음 상태로', function () { self.reset(ctx); }, { small: true });

      ctx.onTap(hits[0], function () { self.fix(ctx, 0); });
      ctx.onTap(hits[1], function () { self.fix(ctx, 1); });
      ctx.onTap(pivot, function () { // 이음새가 아닌 곳: 고치기 전엔 더 흔들리고, 고친 뒤엔 앉기
        if (s.fixed[0] && s.fixed[1]) { if (!s.seated) self.sit(ctx); } else if (!s.anim) { s.kick = 1; ui.setInfo(TXT.tapChair); }
      });
      this.sync();
    },

    enter: function (ctx) {
      var s = this.s;
      if (s.fixed[0] && s.fixed[1]) s.pop = 0; else { s.sparkIn = 0; s.kick = 1; } // 들어오자마자 3D가 먼저 바뀐다
      if (s.seated) ctx.moveCamera(SIT_POS, SIT_TGT, 1.0);                          // 앉아 있던 장면 그대로 다시 보여 준다
    },

    fix: function (ctx, j) {
      var s = this.s;
      if (s.fixed[j] || s.queue.indexOf(j) >= 0 || (s.anim && s.anim.j === j)) return;
      s.queue.push(j);
      if (!s.anim) this.next(ctx);
    },
    fixAll: function (ctx) {
      var s = this.s;
      if (s.fixed[0] && s.fixed[1]) { s.pop = 0; ctx.toast('이미 단단하게 고쳤어요'); return; }
      this.fix(ctx, 0); this.fix(ctx, 1);
    },
    next: function (ctx) {
      var s = this.s, j = s.queue.shift();
      if (j == null) return;
      s.anim = { j: j, t: 0, hits: 0 };
      s.hammer.visible = true;
      ctx.ui.setInfo(TXT.hammer);
    },

    sit: function (ctx) {
      var s = this.s;
      if (!(s.fixed[0] && s.fixed[1])) { s.kick = 1; ctx.ui.setInfo(TXT.notYet); return; }
      s.seated = !s.seated;
      if (s.seated) { ctx.moveCamera(SIT_POS, SIT_TGT, 1.0); ctx.ui.setInfo(TXT.seated); }
      else { ctx.moveCamera(CAM.pos, CAM.target, 0.8); ctx.ui.setInfo(TXT.done); }
      this.sync();
    },

    reset: function (ctx) {
      var s = this.s;
      if (s.seated) ctx.moveCamera(CAM.pos, CAM.target, 0.8);
      s.fixed = [false, false]; s.queue = []; s.anim = null; s.seated = false; s.hammer.visible = false;
      s.tagNew.visible = true; s.tagSaved.visible = false; s.sparkIn = 0; s.kick = 1;
      ctx.ui.setInfo(TXT.start);
      this.sync();
    },

    sync: function () { // 버튼·단계 점·점검용 data 속성을 상태에 맞춘다
      var s = this.s, done = s.fixed[0] && s.fixed[1];
      setDot(s.dot1, done ? 2 : 1, 1); setDot(s.dot2, s.seated ? 2 : done ? 1 : 0, 2);
      s.btnFix.textContent = done ? '✓ 고쳤어요' : '고치기';
      s.btnFix.classList.toggle('primary', !done); s.btnFix.style.background = done ? '#dff7e5' : '';
      s.btnSit.textContent = s.seated ? '일어나기' : '앉아 보기';
      s.btnSit.classList.toggle('primary', done && !s.seated);
      s.hint.hidden = done;
      s.dbgEl.dataset.fixed = (s.fixed[0] ? 1 : 0) + (s.fixed[1] ? 1 : 0);
      s.dbgEl.dataset.seated = s.seated ? '1' : '0';
      s.dbgEl.dataset.saved = s.tagSaved.visible ? '1' : '0';
    },

    finish: function (ctx) { // 두 곳 모두 고침 → 흔들림 멈춤, 나무판 더미에 ‘아꼈어요’
      var s = this.s;
      s.tagNew.visible = false; s.tagSaved.visible = true; s.tagIn = 0; s.pop = 0;
      ctx.ui.setInfo(TXT.done);
      this.sync();
      ctx.markOperated({ delay: 900 }); // 망치가 사라지고 ‘아꼈어요’가 뜬 장면을 썸네일로
    },

    animate: function (dt, ctx) {
      var s = this.s, a = s.anim, t = (a.t += dt), x = JX[a.j], hm = s.hammer;
      var n = 0; for (var k = 0; k < HITS; k++) if (t >= HIT_T0 + k * HIT_DT + 0.3) n++;
      if (n > a.hits) { a.hits = n; s.jolt = 0.014; s.spark.t = 0; s.spark.x = x; s.spark.y = SEAT + 0.03; } // 쾅: 의자가 들썩, 불똥
      var th = -1, sc = 1, c = Math.floor((t - HIT_T0) / HIT_DT), u = (t - HIT_T0) - c * HIT_DT;
      if (t < HIT_T0) sc = 0.6 + 0.4 * ease(t / HIT_T0);
      else if (c >= HITS) { u = t - HIT_T0 - HITS * HIT_DT; th = -0.4 * ease(u / 0.12); sc = 1 - ease(u / 0.22); }
      else if (u < 0.12) th = c === 0 ? -1 : -ease(u / 0.12);
      else if (u < 0.22) th = -1;
      else if (u < 0.3) { var p = (u - 0.22) / 0.08; th = -(1 - p * p); }
      else th = 0;
      var pegTop = SEAT + 0.012 + 0.04 * (1 - a.hits / HITS);
      hm.position.set(x + 0.42, pegTop + 0.1, LX); hm.rotation.z = th; hm.scale.setScalar(Math.max(0.01, sc));
      if (t >= FIX_END) {
        s.fixed[a.j] = true; s.anim = null; hm.visible = false;
        if (s.fixed[0] && s.fixed[1]) this.finish(ctx);
        else { ctx.ui.setInfo(TXT.one); this.sync(); }
        this.next(ctx);
      }
    },

    update: function (dt, ctx) {
      var s = this.s, a, j, i;
      s.t += dt;
      if (s.anim) this.animate(dt, ctx);
      a = s.anim;
      for (j = 0; j < 2; j++) s.L[j] = s.fixed[j] ? 0 : (a && a.j === j ? 1 - a.hits / HITS : 1);
      var loose = (s.L[0] + s.L[1]) / 2, act = ctx.active;

      // 흔들림: 2.3초마다 한 번 삐걱(탐험 중에도). 고칠수록 줄고, 다 고치면 멈춘다
      var ph = s.t % 2.3, env = ph < 1.1 ? Math.sin(Math.PI * ph / 1.1) : 0;
      s.kick = Math.max(0, s.kick - dt); env = Math.max(env, Math.min(1, s.kick * 1.5));
      s.amp += (0.075 * loose * (a ? 0.3 : 1) * (1 + s.kick) - s.amp) * Math.min(1, dt * 4);
      var ang = s.amp * env * Math.sin(s.t * 17);
      s.jolt = Math.max(0, s.jolt - dt * 0.14);
      s.rock.rotation.x = ang; s.rock.position.y = 0.3 * Math.abs(Math.sin(ang)) - s.jolt;
      s.wob = ang;
      var cr = s.creak, on = loose > 0 && s.amp * env > 0.012;
      cr.visible = on;
      if (on) { var ck = 0.8 + 0.2 * env; cr.scale.set(cr.userData.base.x * ck, cr.userData.base.y * ck, 1); }

      // 다리·이음새·나무못
      s.glow += ((act ? 1 : 0) - s.glow) * Math.min(1, dt * 5);
      s.sparkIn = Math.min(1, s.sparkIn + dt / 0.3);
      var pulse = 0.5 + 0.5 * Math.sin(s.t * 4.49), P = s.parts; // 1.4초 박자
      for (j = 0; j < 2; j++) {
        var L = s.L[j], x = JX[j], wig = 0.07 * L * env * Math.sin(s.t * 17 + 1.3 + j);
        setLeg(P, 2 + j, x, LX, LEN - 0.02 * L, 0.16 * L + wig);
        var g = L > 0 ? s.glow : 0, bs = 0.12 * (1 + 0.12 * pulse * g);
        setInst(P, 4 + j, x, LEN - 0.045, LX, bs, bs, bs);
        if (L > 0) { _c.copy(GLOW_A).lerp(GLOW_B, pulse); _c.lerpColors(RAW, _c, g).lerp(NEWWOOD, 1 - L); } else _c.copy(NEWWOOD);
        P.setColorAt(4 + j, _c);
        var peg = s.fixed[j] ? 1 : (a && a.j === j ? ease(a.t / 0.2) : 0);
        setInst(P, 6 + j, x, SEAT + 0.012 + 0.04 * L - 0.025, LX, 0.065 * peg, 0.05 * peg, 0.065 * peg);
      }
      P.instanceMatrix.needsUpdate = true; P.instanceColor.needsUpdate = true;

      // 반짝임(시설 모드에서 헐거운 이음새 둘레) + 불똥
      var S = s.sparks, any = false;
      for (j = 0; j < 2; j++) for (i = 0; i < 5; i++) {
        var show = s.glow * s.sparkIn * (s.L[j] > 0 && !(a && a.j === j) ? 1 : 0);
        var sc = 0.08 * show * (0.3 + 0.7 * Math.max(0, Math.sin(s.t * 4.49 + i * 1.26 + j * 0.6)));
        var an = s.t * 1.1 + i * 1.2566 + j;
        _q.setFromEuler(_e.set(0.785, s.t * 2 + i, 0.785));
        setInst(S, j * 5 + i, JX[j] + Math.cos(an) * 0.17, LEN - 0.03 + (i % 3 - 1) * 0.08, LX + Math.sin(an) * 0.17, sc, sc, sc, _q);
        if (sc > 0.002) any = true;
      }
      var sp = s.spark; sp.t += dt;
      for (i = 0; i < 6; i++) {
        var st = sp.t, ssc = st < 0.3 ? 0.05 * (1 - st / 0.3) : 0, ra = 0.04 + 0.7 * st, aa = i * 1.047;
        setInst(S, 10 + i, sp.x + Math.cos(aa) * ra, sp.y + 0.05 + 0.6 * st - 3 * st * st, LX + Math.sin(aa) * ra, ssc, ssc, ssc);
        if (ssc > 0) any = true;
      }
      S.visible = any; S.instanceMatrix.needsUpdate = true;

      // 나무판 더미: 고친 순간·다시 들어올 때 한 번 통통, ‘아꼈어요’는 커지며 나타난다
      s.pop = Math.min(1, s.pop + dt / 0.45); s.pile.scale.setScalar(1 + 0.1 * Math.sin(Math.PI * s.pop));
      s.tagIn = Math.min(1, s.tagIn + dt / 0.35);
      var tk = 0.6 + 0.4 * ease(s.tagIn), tb = s.tagSaved.userData.base; s.tagSaved.scale.set(tb.x * tk, tb.y * tk, 1);

      // 점검용 data 속성(0.1초마다): 흔들림 각도, 이음새 화면 좌표, 보이는 메시 수
      s.dbgT -= dt;
      if (s.dbgT <= 0) {
        s.dbgT = 0.1;
        var d = s.dbgEl.dataset; d.wob = Math.abs(s.wob).toFixed(4);
        if (act) {
          for (j = 0; j < 2; j++) {
            s.hits[j].getWorldPosition(_w).project(ctx.camera);
            d['j' + j] = Math.round((_w.x + 1) / 2 * innerWidth) + ',' + Math.round((1 - _w.y) / 2 * innerHeight);
          }
          var cnt = 0;
          ctx.root.traverseVisible(function (o) { if ((o.isMesh || o.isSprite) && o.material.visible !== false) cnt++; });
          d.meshes = cnt;
        }
      }
    }
  });
})();
