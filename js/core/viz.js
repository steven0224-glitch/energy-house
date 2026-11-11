/* 공용 시각화 헬퍼: 블록 화살표, 흐름 입자(InstancedMesh 1개 = 드로콜 1), 글자 스프라이트. */
(function () {
  'use strict';
  var EXP = window.EXP = window.EXP || {};
  var T = THREE;
  var flows = [];

  function v3(p) { return p && p.isVector3 ? p.clone() : new T.Vector3(p[0], p[1], p[2]); }
  function shown(o) { while (o) { if (!o.visible) return false; o = o.parent; } return true; }

  /* from→to 블록 화살표(조명 무시하는 밝은 색). opts: {color, width(0.15), head(0.4)} → THREE.Group */
  function arrow(from, to, opts) {
    opts = opts || {};
    var a = v3(from), b = v3(to), dir = b.clone().sub(a), len = dir.length();
    var w = opts.width || 0.15, head = Math.min(opts.head || 0.4, len * 0.6);
    var m = new T.MeshBasicMaterial({ color: opts.color || '#ff5a3c' });
    var g = new T.Group();
    var shaft = new T.Mesh(new T.BoxGeometry(w, Math.max(0.001, len - head), w), m);
    shaft.position.y = (len - head) / 2;
    var tip = new T.Mesh(new T.ConeGeometry(w * 2.2, head, 4), m);
    tip.position.y = len - head / 2; tip.rotation.y = Math.PI / 4;
    g.add(shaft, tip);
    g.position.copy(a);
    g.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), dir.normalize());
    g.userData.material = m;
    return g;
  }

  /* 폴리라인을 따라 흐르는 작은 정육면체들. opts: {color, count(20), size(0.12), speed(m/s, 1.5)}
     반환 ctl: {object3d, speed, setPoints(pts), setColor(c)}. ctl.object3d 를 ctx.root 에 add.
     보이는 동안(object3d 와 부모가 visible) 코어가 매 프레임 자동으로 움직인다. */
  function flow(points, opts) {
    opts = opts || {};
    var n = opts.count || 20, size = opts.size || 0.12;
    var mat = new T.MeshBasicMaterial({ color: opts.color || '#ffffff' });
    var im = new T.InstancedMesh(new T.BoxGeometry(size, size, size), mat, n);
    im.frustumCulled = false;
    var pts = [], cum = [], total = 0, mtx = new T.Matrix4(), tmp = new T.Vector3();
    var ctl = {
      object3d: im, speed: opts.speed == null ? 1.5 : opts.speed, t: 0,
      setPoints: function (ps) {
        pts = ps.map(v3); cum = [0]; total = 0;
        for (var i = 1; i < pts.length; i++) { total += pts[i].distanceTo(pts[i - 1]); cum.push(total); }
      },
      setColor: function (c) { mat.color.set(c); },
      pointAt: function (d) {
        if (pts.length < 2 || total <= 0) return tmp.copy(pts[0] || tmp.set(0, 0, 0));
        for (var i = 1; i < pts.length; i++) if (d <= cum[i]) {
          var k = (d - cum[i - 1]) / Math.max(1e-6, cum[i] - cum[i - 1]);
          return tmp.lerpVectors(pts[i - 1], pts[i], k);
        }
        return tmp.copy(pts[pts.length - 1]);
      },
      update: function (dt) {
        if (!total) return;
        this.t += dt * this.speed;
        for (var i = 0; i < n; i++) {
          var d = ((i / n) * total + this.t) % total; if (d < 0) d += total;
          mtx.makeTranslation(this.pointAt(d)); im.setMatrixAt(i, mtx);
        }
        im.instanceMatrix.needsUpdate = true;
      },
      dispose: function () { var i = flows.indexOf(ctl); if (i >= 0) flows.splice(i, 1); }
    };
    ctl.setPoints(points);
    ctl.update(0);
    flows.push(ctl);
    return ctl;
  }

  /* 카메라를 향하는 글자 판. opts: {height(m, 0.4, 최소 0.3), color, bg, depthTest(true)} → THREE.Sprite */
  function textSprite(text, opts) {
    opts = opts || {};
    var c = document.createElement('canvas'), g = c.getContext('2d'), fs = 48;
    var font = 'bold ' + fs + 'px "Apple SD Gothic Neo","Malgun Gothic","Noto Sans KR",sans-serif';
    g.font = font;
    var w = Math.ceil(g.measureText(text).width) + 40, h = fs + 28;
    c.width = w; c.height = h; g.font = font;
    // 지침 §1-4: 종이색 바탕 + 먹색 6px 테두리 + 둥근 모서리 12px (roundRect 미지원 브라우저 대비 arcTo)
    var x0 = 3, y0 = 3, x1 = w - 3, y1 = h - 3, r = 12;
    g.beginPath(); g.moveTo(x0 + r, y0);
    g.arcTo(x1, y0, x1, y1, r); g.arcTo(x1, y1, x0, y1, r); g.arcTo(x0, y1, x0, y0, r); g.arcTo(x0, y0, x1, y0, r); g.closePath();
    g.fillStyle = opts.bg || '#fffdf5'; g.fill();
    g.strokeStyle = '#2b2b2b'; g.lineWidth = 6; g.stroke();
    g.fillStyle = opts.color || '#2b2b2b'; g.textBaseline = 'middle'; g.fillText(text, 20, h / 2 + 2);
    var t = new T.CanvasTexture(c); t.colorSpace = T.SRGBColorSpace;
    var s = new T.Sprite(new T.SpriteMaterial({ map: t, depthTest: opts.depthTest !== false, fog: false }));
    var H = Math.max(0.3, opts.height || 0.4); s.scale.set(H * w / h, H, 1); // 지침 최소 높이 0.3m — 시설마다 크기가 벌어지지 않게
    return s;
  }

  EXP.viz = {
    arrow: arrow, flow: flow, textSprite: textSprite,
    _update: function (dt) { for (var i = 0; i < flows.length; i++) if (shown(flows[i].object3d)) flows[i].update(dt); }
  };
})();
