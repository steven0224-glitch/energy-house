/* 코어: 렌더러·이동·충돌·입력·근접 상호작용·시설 모드·바로 가기·기록. 시설은 EXP.registerFacility 로만 붙는다. */
(function () {
  'use strict';
  var EXP = window.EXP = window.EXP || {};
  var T = THREE, L = EXP.LAYOUT;
  var EYE = 1.5, RADIUS = 0.3, HEIGHT = 1.6, STEP = 0.55, SPEED = 3.6, GRAV = 22, NEAR = 3, TAP_NEAR = 6;
  var SKY_TOP = '#8ecbff', SKY = '#dff1ff'; // 위 → 지평선. 안개·배경은 지평선 색

  var defs = {};
  EXP.registerFacility = function (def) {
    if (!def || !def.id) { console.warn('[EXP] registerFacility: id 가 없어요'); return; }
    if (!L.facilities[def.id]) console.warn('[EXP] 레이아웃에 없는 시설 id:', def.id);
    defs[def.id] = def;
  };

  var $ = function (id) { return document.getElementById(id); };
  function el(tag, cls, text, parent) {
    var e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text;
    if (parent) parent.appendChild(e); return e;
  }
  function v3(p) { return p && p.isVector3 ? p.clone() : new T.Vector3(p[0], p[1], p[2]); }
  function shown(o) { while (o) { if (!o.visible) return false; o = o.parent; } return true; }
  function within(anc, o) { while (o) { if (o === anc) return true; o = o.parent; } return false; }

  var store = {
    get: function (k, d) { try { var v = sessionStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } },
    set: function (k, v) { try { sessionStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* 저장 실패해도 앱은 계속 */ } }
  };

  var renderer, scene, camera, world;
  var colliders = [];
  var player = { pos: new T.Vector3(), yaw: 0, pitch: 0, vy: 0, eyeY: EYE };
  var mode = 'start', active = null, tw = null, viewOff = 0, nearId = null, modalOpen = false, hintOn = false;
  var facs = {}, keys = {}, caps = [];
  var records = store.get('exp.records', []).filter(function (id) { return L.facilities[id]; });
  var thumbs = store.get('exp.thumbs', {});
  var chipPhase = store.get('exp.chip', 0); // 0 아직, 1 보임, 2 끝
  var ray = new T.Raycaster(), ndc = new T.Vector2(), dummyCam = new T.PerspectiveCamera();

  function panelW() { return Math.round(Math.min(380, Math.max(290, innerWidth * 0.32))); }
  function safe(f, fn, a, b) {
    if (!fn) return;
    try { return fn.call(f ? f.def : null, a, b); } catch (e) { console.error('[시설 ' + (f ? f.id : '?') + '] 오류', e); }
  }

  /* ---------- 충돌·이동 ---------- */
  function blocked(x, z, y) {
    for (var i = 0; i < colliders.length; i++) {
      var c = colliders[i];
      if (x + RADIUS > c.min[0] && x - RADIUS < c.max[0] && z + RADIUS > c.min[2] && z - RADIUS < c.max[2] &&
        c.max[1] > y + STEP && c.min[1] < y + HEIGHT) return true;
    }
    return false;
  }
  function groundAt(x, z, y) {
    var g = -100, r = RADIUS * 0.9;
    for (var i = 0; i < colliders.length; i++) {
      var c = colliders[i];
      if (x + r > c.min[0] && x - r < c.max[0] && z + r > c.min[2] && z - r < c.max[2] && c.max[1] <= y + STEP + 0.01 && c.max[1] > g) g = c.max[1];
    }
    return g;
  }
  var joy = { id: null, vx: 0, vy: 0 };
  function updatePlayer(dt) {
    var f = 0, r = 0;
    if (keys.KeyW || keys.ArrowUp) f += 1; if (keys.KeyS || keys.ArrowDown) f -= 1;
    if (keys.KeyD || keys.ArrowRight) r += 1; if (keys.KeyA || keys.ArrowLeft) r -= 1;
    f += -joy.vy; r += joy.vx;
    var len = Math.hypot(f, r); if (len > 1) { f /= len; r /= len; }
    var p = player.pos, sy = Math.sin(player.yaw), cy = Math.cos(player.yaw);
    var dx = (-sy * f + cy * r) * SPEED * dt, dz = (-cy * f - sy * r) * SPEED * dt;
    if (dx && !blocked(p.x + dx, p.z, p.y)) p.x += dx;
    if (dz && !blocked(p.x, p.z + dz, p.y)) p.z += dz;
    var g = groundAt(p.x, p.z, p.y);
    if (g >= p.y) { p.y = g; player.vy = 0; } // 계단 한 칸(≤0.55m)은 그대로 올라선다
    else { player.vy -= GRAV * dt; p.y = Math.max(g, p.y + player.vy * dt); if (p.y === g) player.vy = 0; }
    if (p.y < -20) setPlayer(L.places.yard.stand, L.places.yard.lookAt);
    player.eyeY += (p.y + EYE - player.eyeY) * Math.min(1, dt * 14);
  }
  function setPlayer(stand, lookAt) {
    player.pos.set(stand[0], stand[1], stand[2]); player.vy = 0; player.eyeY = stand[1] + EYE;
    if (lookAt) {
      var dx = lookAt[0] - stand[0], dz = lookAt[2] - stand[2];
      player.yaw = Math.atan2(-dx, -dz);
      player.pitch = Math.max(-1.2, Math.min(1.2, Math.atan2(lookAt[1] - (stand[1] + EYE), Math.hypot(dx, dz))));
    }
  }
  function eyePos() { return new T.Vector3(player.pos.x, player.eyeY, player.pos.z); }
  function eyeQuat() { return new T.Quaternion().setFromEuler(new T.Euler(player.pitch, player.yaw, 0, 'YXZ')); }
  function applyEye() { camera.position.copy(eyePos()); camera.quaternion.copy(eyeQuat()); }
  function poseQuat(pos, target) { dummyCam.position.copy(pos); dummyCam.lookAt(target); return dummyCam.quaternion.clone(); }

  /* ---------- 카메라 트윈 + 패널 쪽 화면 중심 이동 ---------- */
  function setOff(o) {
    viewOff = o;
    if (o > 0.5) camera.setViewOffset(innerWidth, innerHeight, o, 0, innerWidth, innerHeight); else camera.clearViewOffset();
  }
  function tweenTo(p1, q1, dur, off1, done) {
    tw = { p0: camera.position.clone(), q0: camera.quaternion.clone(), p1: p1, q1: q1, off0: viewOff, off1: off1, t: 0, dur: dur, done: done };
  }
  function stepTween(dt) {
    tw.t += dt;
    var k = Math.min(1, tw.t / tw.dur), e = k * k * (3 - 2 * k);
    camera.position.lerpVectors(tw.p0, tw.p1, e);
    camera.quaternion.slerpQuaternions(tw.q0, tw.q1, e);
    setOff(tw.off0 + (tw.off1 - tw.off0) * e);
    if (k >= 1) { var d = tw.done; tw = null; if (d) d(); }
  }

  /* ---------- 레이캐스트 ---------- */
  function rayAt(x, y) { ndc.set(x / innerWidth * 2 - 1, -(y / innerHeight) * 2 + 1); ray.setFromCamera(ndc, camera); return ray; }
  function pick(x, y, objs) {
    rayAt(x, y);
    var hits = ray.intersectObjects(objs, true);
    for (var i = 0; i < hits.length; i++) if (shown(hits[i].object)) return hits[i];
    return null;
  }

  /* ---------- 시설 ---------- */
  var markerGeo = {}, markerMat;
  /* 표식: 색 도형 + 뒤집은 흰 껍질(윤곽)을 한 지오메트리에 묶어 드로콜 1개. 자원=모서리로 선 정육면체, 에너지=뾰족한 팔면체 */
  function rimGeo(src, color) {
    var a = src.toNonIndexed().getAttribute('position').array, p = [], c = [], col = new T.Color(color), i, k = 1.24;
    for (i = 0; i < a.length; i += 3) { p.push(a[i], a[i + 1], a[i + 2]); c.push(col.r, col.g, col.b); }
    for (i = 0; i < a.length; i += 9) for (var j = 2; j >= 0; j--) { p.push(a[i + j * 3] * k, a[i + j * 3 + 1] * k, a[i + j * 3 + 2] * k); c.push(1, 1, 1); }
    var g = new T.BufferGeometry();
    g.setAttribute('position', new T.Float32BufferAttribute(p, 3)); g.setAttribute('color', new T.Float32BufferAttribute(c, 3));
    g.computeBoundingSphere(); return g;
  }
  /* 하늘(세로 그러데이션 통) + 해 + 구름 덩어리를 정점 색 메시 하나로 */
  function buildSky(sunDir) {
    var p = [], c = [], top = new T.Color(SKY_TOP), hor = new T.Color(SKY), R = 150, N = 12, i;
    function v(x, y, z, col) { p.push(x, y, z); c.push(col.r, col.g, col.b); }
    function quad(a, b, d, e, c0, c1) { v(a[0], a[1], a[2], c0); v(b[0], b[1], b[2], c0); v(d[0], d[1], d[2], c1); v(a[0], a[1], a[2], c0); v(d[0], d[1], d[2], c1); v(e[0], e[1], e[2], c1); }
    for (i = 0; i < N; i++) {
      var a0 = i / N * Math.PI * 2, a1 = (i + 1) / N * Math.PI * 2, x0 = Math.cos(a0) * R, z0 = Math.sin(a0) * R, x1 = Math.cos(a1) * R, z1 = Math.sin(a1) * R;
      quad([x0, -30, z0], [x1, -30, z1], [x1, 4, z1], [x0, 4, z0], hor, hor);
      quad([x0, 4, z0], [x1, 4, z1], [x1, 70, z1], [x0, 70, z0], hor, top);
      v(x0, 70, z0, top); v(x1, 70, z1, top); v(0, 100, 0, top);
    }
    function box(x, y, z, w, h, d, up, side, down) {
      var X = x + w, Y = y + h, Z = z + d;
      quad([x, Y, Z], [X, Y, Z], [X, Y, z], [x, Y, z], up, up); quad([x, y, z], [X, y, z], [X, y, Z], [x, y, Z], down, down);
      quad([x, y, Z], [X, y, Z], [X, Y, Z], [x, Y, Z], side, up); quad([X, y, z], [x, y, z], [x, Y, z], [X, Y, z], side, up);
      quad([X, y, Z], [X, y, z], [X, Y, z], [X, Y, Z], side, up); quad([x, y, z], [x, y, Z], [x, Y, Z], [x, Y, z], side, up);
    }
    var sunC = new T.Color('#fff3a0'), sunE = new T.Color('#ffe27a');
    box(sunDir[0] * 110 - 4, sunDir[1] * 110 - 4, sunDir[2] * 110 - 4, 8, 8, 8, sunC, sunE, sunE);
    var w = new T.Color('#ffffff'), wl = new T.Color('#eef4f8'), u = new T.Color('#c9d3dc');
    // 구름: 납작한 판 대신 블록 2~3개를 겹친 덩어리 [x, y, z, 크기]
    [[-52, 22, -70, 18], [14, 27, -84, 24], [70, 20, -30, 16], [-80, 25, 6, 20], [36, 30, 66, 22], [-30, 19, 78, 15]].forEach(function (q) {
      var s = q[3];
      box(q[0], q[1], q[2], s, s * 0.22, s * 0.5, w, wl, u);
      box(q[0] + s * 0.2, q[1] + s * 0.22, q[2] + s * 0.08, s * 0.5, s * 0.2, s * 0.34, w, wl, w);
      box(q[0] - s * 0.3, q[1] + s * 0.04, q[2] + s * 0.14, s * 0.5, s * 0.14, s * 0.3, w, wl, u);
    });
    var g = new T.BufferGeometry();
    g.setAttribute('position', new T.Float32BufferAttribute(p, 3)); g.setAttribute('color', new T.Float32BufferAttribute(c, 3));
    var m = new T.Mesh(g, new T.MeshBasicMaterial({ vertexColors: true, fog: false, side: T.DoubleSide }));
    m.frustumCulled = false; m.name = 'sky';
    return m;
  }
  function makeUI(f) {
    function add(n, parent) { (parent || f.ctrls).appendChild(n); return n; }
    function button(label, fn, o) {
      o = o || {};
      var b = el('button', 'pbtn' + (o.primary ? ' primary' : '') + (o.small ? ' small' : '')); b.type = 'button'; b.textContent = label;
      if (fn) b.addEventListener('click', function () { safe(f, fn, b); });
      return add(b, o.parent);
    }
    function toggle(label, initial, fn, o) {
      var on = !!initial, b = button(label, null, o);
      function sync() { b.classList.toggle('on', on); b.setAttribute('aria-pressed', on ? 'true' : 'false'); }
      sync();
      b.addEventListener('click', function () { on = !on; sync(); safe(f, fn, on); });
      return { el: b, get on() { return on; }, set: function (v) { on = !!v; sync(); } };
    }
    function bar(label, o) {
      o = o || {};
      var max = o.max || 1, val = 0, wrap = add(el('div', 'pbar'), o.parent);
      var head = el('div', 'pbar-head', null, wrap); el('span', null, label, head); var ve = el('span', 'pbar-val', '', head);
      var track = el('div', 'pbar-track', null, wrap), fill = el('div', 'pbar-fill', null, track);
      fill.style.background = o.color || '#3d8fe0';
      var api = {
        el: wrap,
        set: function (v) { val = v; fill.style.width = Math.max(0, Math.min(100, v / max * 100)) + '%'; ve.textContent = o.format ? o.format(v) : (v + (o.unit || '')); },
        setMax: function (m) { max = m || 1; api.set(val); },
        get value() { return val; }
      };
      api.set(o.value || 0);
      return api;
    }
    function legend(items, title, o) {
      var w = add(el('div', 'plegend'), (o || {}).parent); if (title) el('div', 'plegend-title', title, w);
      items.forEach(function (it) { var r = el('div', 'plegend-row', null, w); el('i', null, null, r).style.background = it.color; el('span', null, it.text, r); });
      return w;
    }
    return {
      body: f.ctrls, button: button, toggle: toggle, bar: bar, legend: legend,
      setInfo: function (t) { f.info.textContent = t; },
      row: function (parent) { return add(el('div', 'prow'), parent); },
      el: function (tag, cls, text, parent) { return add(el(tag, cls, text), parent); }
    };
  }
  function makeCtx(f) {
    return {
      id: f.id, meta: f.meta, THREE: T, root: f.root, scene: scene, sunDir: L.sunDir.slice(),
      get camera() { return camera; },
      get active() { return active === f; },
      ui: makeUI(f),
      onTap: function (obj, fn) { f.taps.push({ obj: obj, fn: fn }); },
      draggable: function (obj, opt) { f.drags.push({ obj: obj, opt: opt || {} }); },
      raycast: function (x, y, objs) { return pick(x, y, objs); },
      markOperated: function (opt) { markOperated(f.id, opt || {}); },
      showModelLabel: function (on) { f.modelLabel = !!on; if (active === f) $('modelLabel').hidden = !on; },
      addCollider: function (min, max) { colliders.push({ min: min.slice(), max: max.slice() }); },
      moveCamera: function (pos, target, dur) { if (active === f) { var p = v3(pos); tweenTo(p, poseQuat(p, v3(target)), dur || 0.8, panelW() / 2); } },
      toast: function (msg) { toast(msg); }
    };
  }
  function createFacility(id) {
    var meta = L.facilities[id];
    var def = defs[id] || { id: id, build: function (ctx) { ctx.ui.setInfo('이 시설은 준비 중이에요.'); } };
    var root = new T.Group(); root.name = 'fac:' + id; root.userData.facId = id; scene.add(root);
    var body = el('div', 'p-body', null, $('pBodies')); body.hidden = true;
    var f = { id: id, meta: meta, def: def, root: root, body: body, info: el('div', 'p-info', '', body), ctrls: el('div', 'p-ctrls', null, body), taps: [], drags: [], modelLabel: false };
    var mk = new T.Mesh(markerGeo[meta.category], markerMat);
    mk.position.set(meta.marker[0], meta.marker[1], meta.marker[2]); mk.userData.facId = id; scene.add(mk);
    f.marker = mk;
    f.ctx = makeCtx(f);
    facs[id] = f;
    try { if (def.build) def.build(f.ctx); } catch (e) { console.error('[시설 ' + id + '] build 실패', e); f.info.textContent = '이 시설을 불러오지 못했어요.'; }
  }
  function ownerOf(o) { while (o) { if (o.userData && o.userData.facId) return o.userData.facId; o = o.parent; } return null; }

  function enterFacility(id) {
    var f = facs[id]; if (!f || mode === 'start') return;
    closeModal();
    if (active === f) return;
    if (active) leaveActive();
    setPlayer(f.meta.stand, f.meta.lookAt);
    mode = 'facility'; active = f; resetPointers();
    document.body.classList.add('fac-mode');
    $('panel').hidden = false; f.body.hidden = false;
    $('pName').textContent = f.meta.name; $('pPlace').textContent = f.meta.place;
    $('pPlace').className = 'p-place ' + f.meta.category;
    $('modelLabel').hidden = !f.modelLabel; f.marker.visible = false; setPrompt(null);
    var cam = f.def.cam || f.meta.cam, p = v3(cam.pos);
    tweenTo(p, poseQuat(p, v3(cam.target)), Math.min(1.3, 0.6 + camera.position.distanceTo(p) * 0.02), panelW() / 2);
    if (id === 'rainbarrel') setHint(false);
    safe(f, f.def.enter, f.ctx);
  }
  function leaveActive() {
    var f = active; if (!f) return;
    safe(f, f.def.exit, f.ctx);
    f.body.hidden = true; f.marker.visible = true; active = null; $('modelLabel').hidden = true; resetPointers();
  }
  function toExplore(stand, lookAt) {
    leaveActive(); closeModal();
    $('panel').hidden = true; document.body.classList.remove('fac-mode');
    mode = 'explore';
    if (stand) setPlayer(stand, lookAt);
    tweenTo(eyePos(), eyeQuat(), 0.7, 0);
  }

  /* ---------- 기록·썸네일·자유 탐색 칩 ---------- */
  function markOperated(id, opt) {
    var f = facs[id]; if (!f) return;
    var first = records.indexOf(id) < 0;
    if (first) { records.push(id); store.set('exp.records', records); toast('‘내가 살펴본 곳’에 담았어요'); }
    caps.push({ id: id, at: performance.now() + (opt.delay == null ? 600 : opt.delay) });
    var done = function (x) { return records.indexOf(x) >= 0; };
    if (chipPhase === 0 && done('heatexchanger') && done('solar')) chipPhase = 1;
    else if (chipPhase === 1 && f.meta.category === 'resource') chipPhase = 2; // 칩이 뜬 뒤 자원 시설을 조작하면 사라짐
    store.set('exp.chip', chipPhase);
    $('chipFree').hidden = chipPhase !== 1;
    updateRecCount();
  }
  function runCaptures(now) {
    if (!caps.length) return;
    var keep = [];
    caps.forEach(function (c) {
      if (now < c.at) { keep.push(c); return; }
      if (!active || active.id !== c.id) return;           // 이미 나갔으면 이전 썸네일 유지
      if (tw) { c.at = now + 200; keep.push(c); return; }   // 카메라 이동이 끝난 뒤 찍는다
      capture(c.id);
    });
    caps = keep;
  }
  function capture(id) {
    try {
      var cv = renderer.domElement, pr = renderer.getPixelRatio();
      var vw = (innerWidth - panelW() - 12) * pr, vh = innerHeight * pr, sw = vw, sh = vw / 1.6;
      if (sh > vh) { sh = vh; sw = vh * 1.6; }
      var out = document.createElement('canvas'); out.width = 240; out.height = 150;
      out.getContext('2d').drawImage(cv, (vw - sw) / 2, (vh - sh) / 2, sw, sh, 0, 0, 240, 150);
      thumbs[id] = out.toDataURL('image/jpeg', 0.72);
      store.set('exp.thumbs', thumbs);
    } catch (e) { /* 썸네일 실패 → 목록에서 아이콘으로 대체 */ }
  }
  function updateRecCount() { $('recCount').textContent = records.length; }

  /* ---------- 화면 UI ---------- */
  var toastTimer = 0;
  function toast(msg, ms) {
    var t = $('toast'); t.textContent = msg; t.hidden = false;
    clearTimeout(toastTimer); toastTimer = setTimeout(function () { t.hidden = true; }, ms || 2200);
  }
  function setHint(on) { hintOn = on; $('chipHint').hidden = !on; if (!on && facs.rainbarrel) facs.rainbarrel.marker.scale.setScalar(1); }
  function setPrompt(id) {
    if (id === nearId) return; nearId = id;
    var p = $('prompt');
    if (!id) { p.hidden = true; return; }
    $('promptName').textContent = facs[id].meta.name; $('promptName').className = facs[id].meta.category; p.hidden = false;
  }
  function updatePrompt() {
    var best = null, bd = NEAR, p = player.pos;
    for (var id in facs) {
      var a = facs[id].meta.interact, d = Math.hypot(a[0] - p.x, a[2] - p.z);
      if (d <= bd && Math.abs(a[1] - p.y) < 2) { bd = d; best = id; }
    }
    setPrompt(best);
  }
  function openModal(title, fill) {
    modalOpen = true; resetPointers();
    $('mTitle').textContent = title; var b = $('mBody'); b.innerHTML = ''; fill(b); $('modal').hidden = false;
  }
  function closeModal() { modalOpen = false; $('modal').hidden = true; }
  function tile(parent, name, sub, cls, fn, img) {
    var b = el('button', 'tile ' + cls, null, parent); b.type = 'button';
    if (img !== undefined) {
      if (img) { var im = el('img', null, null, b); im.src = img; im.alt = ''; } else el('span', 'tile-icon', name.charAt(0), b);
    }
    el('span', 'tile-name', name, b); if (sub) el('span', 'tile-sub', sub, b);
    b.addEventListener('click', fn);
  }
  function openGo() {
    openModal('바로 가기', function (b) {
      el('div', 'm-sec', '장소', b); var g = el('div', 'grid', null, b);
      L.placeOrder.forEach(function (k) { var pl = L.places[k]; tile(g, pl.name, null, 'place', function () { toExplore(pl.stand, pl.lookAt); }); });
      [['resource', '자원을 아끼는 곳'], ['energy', '에너지를 아끼거나 얻는 곳']].forEach(function (s) {
        el('div', 'm-sec ' + s[0], s[1], b); var gg = el('div', 'grid', null, b);
        L.order.forEach(function (id) { var m = L.facilities[id]; if (m.category === s[0]) tile(gg, m.name, m.place, s[0], function () { enterFacility(id); }); });
      });
    });
  }
  function openRecords() {
    openModal('내가 살펴본 곳', function (b) {
      if (!records.length) { el('p', 'm-empty', '아직 없어요. 시설에서 직접 조작하면 여기에 담겨요.', b); return; }
      var g = el('div', 'grid rec', null, b);
      records.forEach(function (id) { var m = L.facilities[id]; tile(g, m.name, m.place, m.category, function () { enterFacility(id); }, thumbs[id] || null); });
    });
  }

  /* ---------- 입력 ---------- */
  var ptrs = {};
  function resetPointers() { ptrs = {}; joy.id = null; joy.vx = joy.vy = 0; placeJoy(null); }
  var JR = 60;
  function placeJoy(p) {
    var j = $('joy'), k = $('joyKnob');
    if (!p) { j.style.left = ''; j.style.top = ''; j.classList.remove('live'); k.style.transform = ''; return; }
    j.style.left = (p.x0 - 70) + 'px'; j.style.top = (p.y0 - 70) + 'px'; j.classList.add('live');
    k.style.transform = 'translate(' + (joy.vx * JR) + 'px,' + (joy.vy * JR) + 'px)';
  }
  function facHit(x, y) {
    var f = active; if (!f || (!f.taps.length && !f.drags.length)) return null;
    var objs = f.drags.map(function (d) { return d.obj; }).concat(f.taps.map(function (t) { return t.obj; }));
    var h = pick(x, y, objs); if (!h) return null;
    var d = null, t = null, i;
    for (i = 0; i < f.drags.length; i++) if (within(f.drags[i].obj, h.object)) { d = f.drags[i]; break; }
    for (i = 0; i < f.taps.length; i++) if (within(f.taps[i].obj, h.object)) { t = f.taps[i]; break; }
    return { hit: h, drag: d, tap: t };
  }
  function onDown(e) {
    if (modalOpen || tw && mode !== 'facility') return;
    e.preventDefault();
    var p = { kind: 'look', x0: e.clientX, y0: e.clientY, x: e.clientX, y: e.clientY, t0: performance.now(), moved: false, mouse: e.pointerType === 'mouse' };
    if (mode === 'explore') {
      if (!p.mouse && e.clientX < innerWidth * 0.45 && joy.id === null) { p.kind = 'joy'; joy.id = e.pointerId; placeJoy(p); }
    } else if (mode === 'facility') {
      p.kind = 'fac'; var r = facHit(e.clientX, e.clientY); p.r = r;
      if (r && r.drag) {
        var o = r.drag.opt, n = o.normal ? v3(o.normal).normalize() : camera.getWorldDirection(new T.Vector3()).negate();
        p.plane = new T.Plane().setFromNormalAndCoplanarPoint(n, r.hit.point); p.last = r.hit.point.clone();
        safe(active, o.onStart, r.hit.point.clone(), r.hit);
      }
    } else return;
    ptrs[e.pointerId] = p;
  }
  function onMove(e) {
    var p = ptrs[e.pointerId]; if (!p) return;
    var dx = e.clientX - p.x, dy = e.clientY - p.y; p.x = e.clientX; p.y = e.clientY;
    if (Math.hypot(p.x - p.x0, p.y - p.y0) > 10) p.moved = true;
    if (p.kind === 'joy') {
      var vx = (p.x - p.x0) / JR, vy = (p.y - p.y0) / JR, l = Math.hypot(vx, vy);
      if (l > 1) { vx /= l; vy /= l; }
      joy.vx = Math.abs(vx) < 0.12 ? 0 : vx; joy.vy = Math.abs(vy) < 0.12 ? 0 : vy; placeJoy(p);
    } else if (p.kind === 'look' && mode === 'explore' && !tw) {
      var s = p.mouse ? 0.0045 : 0.006;
      player.yaw -= dx * s; player.pitch = Math.max(-1.2, Math.min(1.2, player.pitch - dy * s));
    } else if (p.kind === 'fac' && p.plane && active) {
      var hit = rayAt(p.x, p.y).ray.intersectPlane(p.plane, new T.Vector3());
      if (hit) { var delta = hit.clone().sub(p.last); p.last.copy(hit); safe(active, p.r.drag.opt.onMove, hit.clone(), delta); }
    }
  }
  function onUp(e) {
    var p = ptrs[e.pointerId]; if (!p) return; delete ptrs[e.pointerId];
    var quick = !p.moved && performance.now() - p.t0 < 500;
    if (p.kind === 'joy') { joy.id = null; joy.vx = joy.vy = 0; placeJoy(null); }
    else if (p.kind === 'look' && quick && mode === 'explore') exploreTap(p.x, p.y);
    else if (p.kind === 'fac' && active) {
      if (p.plane) safe(active, p.r.drag.opt.onEnd, p.last.clone());
      if (!p.moved) { var r = facHit(p.x, p.y); if (r && r.tap) safe(active, r.tap.fn, r.hit); }
    }
  }
  function exploreTap(x, y) {
    var objs = [world];
    for (var id in facs) objs.push(facs[id].root, facs[id].marker);
    var h = pick(x, y, objs), fid = h && ownerOf(h.object);
    if (!fid) return;
    var a = facs[fid].meta.interact;
    if (player.pos.distanceTo(v3(a)) <= TAP_NEAR) enterFacility(fid);
    else toast('조금 더 가까이 가 보세요. ‘바로 가기’로 한 번에 갈 수도 있어요.');
  }

  function resize() {
    var w = innerWidth, h = innerHeight;
    renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix();
    document.documentElement.style.setProperty('--pw', panelW() + 'px');
    if (mode === 'facility' && !tw) setOff(panelW() / 2); else setOff(viewOff);
  }

  /* ---------- 부팅·루프 ---------- */
  EXP.boot = function () {
    renderer = new T.WebGLRenderer({ canvas: $('c'), antialias: false });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5)); // 보급형 태블릿 기준 상한
    scene = new T.Scene(); scene.background = new T.Color(SKY); scene.fog = new T.Fog(SKY, 28, 70);
    camera = new T.PerspectiveCamera(65, innerWidth / innerHeight, 0.05, 250);
    scene.add(new T.HemisphereLight('#e8f4ff', '#8a7a5a', 1.5));
    var sun = new T.DirectionalLight('#fff6e0', 1.6); sun.position.set(L.sunDir[0], L.sunDir[1], L.sunDir[2]); scene.add(sun);
    scene.add(buildSky(L.sunDir));

    var W = L.buildWorld();
    // 시각 전용 재배정(레이아웃의 모양·충돌은 그대로): 지붕 띠는 기와색, 콘크리트 바닥은 밝은 옥상 바닥색.
    // 세계의 concrete 를 통째로 바꾸므로 재질 수(드로콜)는 기와 하나만 늘어난다.
    function deck(n) { return n === 'concrete' ? 'roofdeck' : n; }
    var boxes = W.boxes.map(function (b) {
      var m = b.mat, r = m;
      if (typeof m === 'string') r = deck(m);
      else if (m && !m.isMaterial) r = { top: deck(m.top), side: m.top === 'concrete' && m.side === 'stone' ? 'rooftile' : deck(m.side), bottom: deck(m.bottom) };
      return r === m ? b : { min: b.min, max: b.max, mat: r, uv: b.uv };
    });
    world = EXP.blocks.mesh(boxes); world.name = 'world'; scene.add(world);
    W.labels.forEach(function (l) { var s = EXP.viz.textSprite(l.text, { height: 0.46, bg: '#fffdf5', color: '#2b2b2b' }); s.position.set(l.pos[0], l.pos[1], l.pos[2]); world.add(s); });
    colliders = W.colliders.slice();

    markerGeo.resource = rimGeo(new T.BoxGeometry(0.4, 0.4, 0.4).rotateZ(Math.PI / 4).rotateX(Math.atan(Math.SQRT1_2)), '#1f9e45');
    markerGeo.energy = rimGeo(new T.OctahedronGeometry(0.27, 0).scale(1, 1.55, 1), '#e67a00');
    markerMat = new T.MeshBasicMaterial({ vertexColors: true });
    L.order.forEach(createFacility);
    Object.keys(defs).forEach(function (id) { if (!facs[id]) console.warn('[EXP] 쓰이지 않은 시설 등록:', id); });

    setPlayer(L.places.yard.stand, L.places.yard.lookAt); applyEye();
    updateRecCount(); $('chipFree').hidden = chipPhase !== 1;

    var c = $('c');
    c.addEventListener('pointerdown', onDown);
    addEventListener('pointermove', onMove); addEventListener('pointerup', onUp); addEventListener('pointercancel', onUp);
    c.addEventListener('contextmenu', function (e) { e.preventDefault(); });
    addEventListener('keydown', function (e) { keys[e.code] = true; if (e.code === 'Escape' && mode === 'facility') toExplore(); });
    addEventListener('keyup', function (e) { keys[e.code] = false; });
    addEventListener('blur', function () { keys = {}; });
    $('startBtn').addEventListener('click', function () {
      $('start').hidden = true; document.body.classList.add('started'); mode = 'explore'; setHint(true);
    });
    $('promptBtn').addEventListener('click', function () { if (nearId && mode === 'explore') enterFacility(nearId); });
    $('pBack').addEventListener('click', function () { toExplore(); });
    $('btnGo').addEventListener('click', openGo);
    $('btnRec').addEventListener('click', openRecords);
    $('mClose').addEventListener('click', closeModal);
    $('modal').addEventListener('click', function (e) { if (e.target === $('modal')) closeModal(); });
    resize(); addEventListener('resize', resize);

    var last = performance.now();
    (function loop(now) {
      requestAnimationFrame(loop);
      var dt = Math.min(0.05, Math.max(0, (now - last) / 1000)); last = now;
      var t = now / 1000;
      if (mode === 'explore' && !tw && !modalOpen) updatePlayer(dt);
      if (tw) stepTween(dt); else if (mode !== 'facility') { applyEye(); if (mode === 'start') camera.rotateY(Math.sin(t * 0.35) * 0.07); } // 시작 화면: 집을 천천히 둘러보는 연출
      for (var id in facs) {
        var m = facs[id].marker, en = facs[id].meta.category === 'energy', ph = t * (en ? 3.2 : 1.6) + m.position.x;
        // 자원 표식은 천천히 돌며 떠 있고, 에너지 표식은 통통 튄다(색 말고 움직임으로도 구분)
        m.position.y = facs[id].meta.marker[1] + (en ? Math.abs(Math.sin(ph)) * 0.3 - 0.15 : Math.sin(ph) * 0.15); m.rotation.y = t * (en ? 0.6 : 1.1);
        var f = facs[id];
        if (f.def.update) { try { f.def.update(dt, f.ctx); } catch (e) { if (!f.updErr) { f.updErr = true; console.error('[시설 ' + id + '] update 오류', e); } } }
      }
      if (hintOn) facs.rainbarrel.marker.scale.setScalar(1.6 + Math.sin(t * 6) * 0.3);
      EXP.viz._update(dt);
      if (mode === 'explore' && !tw && !modalOpen) updatePrompt();
      renderer.render(scene, camera);
      runCaptures(now);
    })(last);
  };

  // 점검·디버그용(시설 코드는 ctx 를 쓸 것)
  EXP.app = {
    player: function () { return { x: +player.pos.x.toFixed(2), y: +player.pos.y.toFixed(2), z: +player.pos.z.toFixed(2), yaw: +player.yaw.toFixed(3) }; },
    mode: function () { return mode; }, active: function () { return active ? active.id : null; },
    records: function () { return records.slice(); }, chipPhase: function () { return chipPhase; },
    enter: enterFacility, exit: function () { toExplore(); },
    teleport: function (stand, lookAt) { setPlayer(stand, lookAt); },
    markOperated: function (id) { markOperated(id, {}); },
    drawCalls: function () { return renderer.info.render.calls; }, triangles: function () { return renderer.info.render.triangles; }
  };
})();
