/* 세계 배치(코어 소유). 단위 1 = 1m = 블록 1칸. +x 동쪽, +y 위, +z 남쪽(마당 쪽). 땅·1층 바닥 윗면 y=0, 옥상 바닥 y=5.
   시설 앵커 좌표는 ARCHITECTURE.md 표와 같다. 시설 파일은 이 파일을 수정하지 않는다. */
(function () {
  'use strict';
  var EXP = window.EXP = window.EXP || {};
  var H = 4; // 1층 벽 높이(천장 y=4, 옥상 슬래브 y 4~5)

  var facilities = {
    rainbarrel: { name: '빗물통', place: '마당', category: 'resource',
      stand: [7.6, 0, 7.0], lookAt: [8.2, 0.6, 2.4], interact: [7.2, 0, 2.6], marker: [6.0, 3.0, 1.2],
      cam: { pos: [8.6, 4.0, 8.2], target: [8.1, 0.6, 2.3] } },
    chair: { name: '나무 의자', place: '방', category: 'resource',
      stand: [-4.2, 0, -7.0], lookAt: [-5.2, 0.5, -9.2], interact: [-5, 0, -9], marker: [-5, 2.4, -9],
      cam: { pos: [-3.6, 2.3, -6.6], target: [-5.1, 0.55, -9.2] } },
    can: { name: '알루미늄 캔', place: '주방', category: 'resource',
      stand: [0, 0, -7.6], lookAt: [0, 0.9, -10.6], interact: [0, 0, -9.6], marker: [0, 2.6, -10.4],
      cam: { pos: [0.9, 2.2, -7.3], target: [-0.1, 0.9, -10.3] } },
    lighting: { name: '조명과 멀티탭', place: '거실', category: 'energy',
      stand: [0.8, 0, -4.4], lookAt: [-1.6, 1.0, -4.6], interact: [-1.2, 0, -4.6], marker: [-1.4, 2.8, -4.6],
      cam: { pos: [1.6, 2.3, -2.4], target: [-1.3, 1.1, -4.7] } },
    insulation: { name: '벽과 창(단열)', place: '겨울 거실', category: 'energy',
      stand: [4.6, 0, -3.5], lookAt: [7, 1.5, -3.5], interact: [6.3, 0, -3.5], marker: [6.5, 3.0, -3.5],
      cam: { pos: [4.2, 2.3, -1.6], target: [7.0, 1.4, -3.8] } },
    shade: { name: '차양', place: '여름 방', category: 'energy',
      stand: [-4.4, 0, -4.2], lookAt: [-5, 1.0, -1.2], interact: [-5, 0, -2.2], marker: [-5, 3.2, -1.6],
      cam: { pos: [-3.6, 2.9, -4.6], target: [-5.2, 0.5, -1.8] } },
    roofgarden: { name: '옥상 정원', place: '옥상', category: 'energy',
      stand: [-4, 5, -7.2], lookAt: [-4, 5.2, -3], interact: [-4, 5, -3.5], marker: [-4, 7.4, -3],
      cam: { pos: [-4, 9.8, -9.2], target: [-4, 5, -3.0] } },
    heatexchanger: { name: '열 교환기', place: '설비실', category: 'energy',
      stand: [5, 0, -7.6], lookAt: [5, 1.2, -10.6], interact: [5, 0, -10], marker: [5, 3.2, -10.3],
      cam: { pos: [5.9, 2.4, -7.3], target: [5, 1.1, -10.4] } },
    solar: { name: '태양광 패널', place: '지붕', category: 'energy',
      stand: [4.5, 5, -7.2], lookAt: [4.5, 5.8, -2.8], interact: [4.5, 5, -4], marker: [4.5, 8.2, -2.8],
      cam: { pos: [4.5, 9.5, 7.5], target: [4.5, 6.0, -2.5] } },
    geothermal: { name: '지열 설비', place: '마당 아래', category: 'energy',
      stand: [-4.5, 0, 9.6], lookAt: [-4.5, 0.3, 5.5], interact: [-4.5, 0, 5.5], marker: [-4.5, 2.6, 5.5],
      cam: { pos: [-1.2, 6.5, 12.2], target: [-4.5, -2.8, 5.4] } }
  };

  var places = {
    yard: { name: '마당', stand: [1, 0, 10], lookAt: [1, 2.2, 0] },
    living: { name: '거실', stand: [1.5, 0, -2.6], lookAt: [5, 1.2, -4.5] },
    roof: { name: '옥상', stand: [-6.2, 5, -8.6], lookAt: [0, 5.8, -3] },
    utility: { name: '설비실', stand: [5, 0, -7.8], lookAt: [5, 1.2, -10.5] }
  };

  // 벽 하나를 구멍(문·창) 기준으로 상자들로 나눈다. axis 'x' = x방향으로 뻗은 벽(z는 c0~c1 두께)
  function wall(axis, a0, a1, c0, c1, holes, m) {
    var out = [], cur = a0;
    function mk(s0, s1, y0, y1, mm) {
      return axis === 'x' ? { min: [s0, y0, c0], max: [s1, y1, c1], mat: mm } : { min: [c0, y0, s0], max: [c1, y1, s1], mat: mm };
    }
    (holes || []).slice().sort(function (p, q) { return p[0] - q[0]; }).forEach(function (h) {
      // h = [a0, a1, y0, y1, glass?]
      if (h[0] > cur) out.push(mk(cur, h[0], 0, H, m));
      if (h[2] > 0) out.push(mk(h[0], h[1], 0, h[2], m));
      if (h[3] < H) out.push(mk(h[0], h[1], h[3], H, m));
      if (h[4]) out.push(mk(h[0], h[1], h[2], h[3], 'glass'));
      cur = h[1];
    });
    if (cur < a1) out.push(mk(cur, a1, 0, H, m));
    return out;
  }

  function buildWorld() {
    var vis = [], col = [], labels = [];
    function both(list) { list.forEach(function (b) { vis.push(b); col.push(b); }); }
    var GT = { top: 'grass', side: 'grassSide', bottom: 'dirt' }, E = 40;

    // 땅: 집 바닥(x-8~8, z-12~0)과 지열 단면 자리(x-7~-2, z3~8, 시설 소유) 제외
    [[-E, E, 8, E], [-E, -7, 3, 8], [-2, E, 3, 8], [-E, E, 0, 3], [-E, -8, -12, 0], [8, E, -12, 0], [-E, E, -E, -12]].forEach(function (r) {
      both([{ min: [r[0], -1, r[2]], max: [r[1], 0, r[3]], mat: GT }, { min: [r[0], -6, r[2]], max: [r[1], -1, r[3]], mat: 'dirt' }]);
    });
    col.push({ min: [-7, -6, 3], max: [-2, 0, 8] }); // 지열 자리: 보이는 흙은 geothermal 시설이 그림, 발판은 코어가 보장
    vis.push({ min: [0, -0.5, 0], max: [2, 0.02, 9], mat: 'stone' }); // 현관까지 돌길

    // 1층 바닥(방마다 재질)
    both([
      { min: [-8, -1, -7], max: [8, 0, 0], mat: 'plank' }, { min: [-8, -1, -12], max: [-2, 0, -7], mat: 'plank' },
      { min: [-2, -1, -12], max: [2, 0, -7], mat: 'tile' }, { min: [2, -1, -12], max: [3, 0, -7], mat: 'plank' },
      { min: [3, -1, -12], max: [8, 0, -7], mat: 'concrete' }
    ]);

    var P = 'plaster';
    both(wall('x', -8, 8, -1, 0, [[0, 2, 0, 2.6], [-6.5, -3.5, 0.8, 2.8, 1], [4, 6, 1, 2.6, 1]], P));      // 앞벽: 현관문, 여름 방 창, 거실 창
    both(wall('x', -8, 8, -12, -11, [[-6, -4, 1.2, 2.6, 1], [-1, 1, 1.4, 2.6, 1]], P));                   // 뒷벽: 의자 방 창, 주방 창
    both(wall('z', -11, -1, -8, -7, [], P));                                                              // 서쪽 벽
    both(wall('z', -11, -1, 7, 8, [[-4.5, -2.5, 1, 2.6, 1]], P));                                         // 동쪽 벽: 겨울 거실 창(단열)
    both(wall('z', -11, -1, -3, -2, [[-3, -1, 0, 2.6], [-10, -8, 0, 2.6]], P));                           // 벽A: 여름 방 문, 의자 방↔주방 문
    both(wall('x', -7, -3, -6, -5, [[-6, -4, 0, 2.6]], P));                                               // 벽B: 여름 방↔의자 방 문
    both(wall('x', -2, 7, -7, -6, [[-1, 1, 0, 2.6], [4, 6, 0, 2.6]], P));                                 // 벽C: 주방 문, 설비실 문
    both(wall('z', -11, -7, 2, 3, [], P));                                                                // 벽D: 주방|설비실

    // 옥상 슬래브 + 난간(보이는 기둥·손잡이, 충돌은 투명 벽)
    both([{ min: [-8, H, -12], max: [8, H + 1, 0], mat: { top: 'concrete', side: 'stone', bottom: 'plaster' } }]);
    var R = 5, rail = 'darkwood';
    for (var x = -7.9; x <= 7.9; x += 2) { vis.push({ min: [x - 0.1, R, -0.3], max: [x + 0.1, R + 1, -0.1], mat: rail }); vis.push({ min: [x - 0.1, R, -11.9], max: [x + 0.1, R + 1, -11.7], mat: rail }); }
    for (var z = -10.9; z <= -0.9; z += 2) { vis.push({ min: [7.7, R, z - 0.1], max: [7.9, R + 1, z + 0.1], mat: rail }); if (z > -8 || z < -10) vis.push({ min: [-7.9, R, z - 0.1], max: [-7.7, R + 1, z + 0.1], mat: rail }); }
    vis.push({ min: [-8, R + 0.9, -0.3], max: [8, R + 1.02, -0.1], mat: rail }, { min: [-8, R + 0.9, -11.9], max: [8, R + 1.02, -11.7], mat: rail },
      { min: [7.7, R + 0.9, -12], max: [7.9, R + 1.02, 0], mat: rail }, { min: [-7.9, R + 0.9, -8], max: [-7.7, R + 1.02, 0], mat: rail },
      { min: [-7.9, R + 0.9, -12], max: [-7.7, R + 1.02, -10], mat: rail });
    col.push({ min: [-8, R, -0.3], max: [8, R + 1.5, 0] }, { min: [-8, R, -12], max: [8, R + 1.5, -11.7] },
      { min: [7.7, R, -12], max: [8, R + 1.5, 0] }, { min: [-8, R, -8], max: [-7.7, R + 1.5, 0] }, { min: [-8, R, -12], max: [-7.7, R + 1.5, -10] });

    // 서쪽 바깥 계단: 마당(z=1)에서 북쪽으로 0.5m씩 10칸 → 옥상 높이 5, 꼭대기 층계참 z-10~-8 에서 동쪽으로 옥상 진입
    for (var i = 0; i < 10; i++) {
      var top = 0.5 * (i + 1), z0 = i === 9 ? -10 : -i, z1 = 1 - i;
      both([{ min: [-10, 0, z0], max: [-8, top, z1], mat: { top: 'plank', side: 'stone', bottom: 'stone' } }]);
      vis.push({ min: [-10.2, top, z0], max: [-10, top + 1, z0 + 0.15], mat: rail }, { min: [-10.2, top + 0.9, z0], max: [-10, top + 1.02, z1], mat: rail });
    }
    vis.push({ min: [-10.2, 5, -10.2], max: [-8, 6.02, -10], mat: rail });
    col.push({ min: [-10.25, 0, -10.2], max: [-10, 6.5, 1] }, { min: [-10.25, 5, -10.25], max: [-8, 6.5, -10] });

    // 가구(코어): 거실 소파, 주방 조리대(윗면 y=0.9), 거실 깔개
    both([{ min: [2.5, 0, -2.0], max: [5.5, 0.5, -1.0], mat: '#c0504d' }, { min: [2.5, 0.5, -1.35], max: [5.5, 1.1, -1.0], mat: '#a8423f' },
      { min: [-2, 0, -11], max: [2, 0.9, -10.2], mat: { top: 'stone', side: 'plank', bottom: 'plank' } }]);
    vis.push({ min: [1, 0, -5], max: [4, 0.03, -3], mat: '#4a7bd0' });

    // 마당 울타리(울타리 밖은 못 나감)
    var F = 14.5;
    for (var k = -F; k <= F; k += 1.5) {
      vis.push({ min: [k - 0.12, 0, F - 0.12], max: [k + 0.12, 1.1, F + 0.12], mat: 'plank' }, { min: [k - 0.12, 0, -15.12], max: [k + 0.12, 1.1, -14.88], mat: 'plank' });
      if (k > -15 && k < 14.6) vis.push({ min: [-F - 0.12, 0, k - 0.12], max: [-F + 0.12, 1.1, k + 0.12], mat: 'plank' }, { min: [F - 0.12, 0, k - 0.12], max: [F + 0.12, 1.1, k + 0.12], mat: 'plank' });
    }
    vis.push({ min: [-F, 0.7, F - 0.06], max: [F, 0.85, F + 0.06], mat: 'plank' }, { min: [-F, 0.7, -15.06], max: [F, 0.85, -14.94], mat: 'plank' },
      { min: [-F - 0.06, 0.7, -15], max: [-F + 0.06, 0.85, F], mat: 'plank' }, { min: [F - 0.06, 0.7, -15], max: [F + 0.06, 0.85, F], mat: 'plank' });
    col.push({ min: [-F - 1, -6, F], max: [F + 1, 3, F + 1] }, { min: [-F - 1, -6, -16], max: [F + 1, 3, -15] },
      { min: [-F - 1, -6, -16], max: [-F, 3, F + 1] }, { min: [F, -6, -16], max: [F + 1, 3, F + 1] });

    // 나무 장식
    [[-12, 11], [12.5, 11.5], [-12.5, -13], [12, -13]].forEach(function (t) {
      vis.push({ min: [t[0] - 0.5, 0, t[1] - 0.5], max: [t[0] + 0.5, 3, t[1] + 0.5], mat: 'log' },
        { min: [t[0] - 1.5, 3, t[1] - 1.5], max: [t[0] + 1.5, 5, t[1] + 1.5], mat: 'leaves' }, { min: [t[0] - 0.5, 5, t[1] - 0.5], max: [t[0] + 0.5, 6, t[1] + 0.5], mat: 'leaves' });
      col.push({ min: [t[0] - 0.5, 0, t[1] - 0.5], max: [t[0] + 0.5, 3, t[1] + 0.5] });
    });

    labels.push({ text: '현관', pos: [1, 3.2, 0.3] }, { text: '옥상 가는 계단', pos: [-9, 2.0, 2.0] }, { text: '주방', pos: [0, 3.1, -5.8] },
      { text: '설비실', pos: [5, 3.1, -5.8] }, { text: '여름 방', pos: [-1.8, 3.1, -2] }, { text: '나무 의자 방', pos: [-1.8, 3.1, -9] }, { text: '거실', pos: [3, 3.3, -0.6] });
    return { boxes: vis, colliders: col, labels: labels };
  }

  EXP.LAYOUT = {
    unit: '1 = 1m', floorY: 0, roofY: 5, wallHeight: H,
    sunDir: [-0.35, 0.8, 0.5], // 해 쪽을 가리키는 방향(남서쪽 높이). 그림자 맵은 없음 — 햇빛·그늘은 시설이 직접 그린다
    facilities: facilities, places: places,
    order: ['rainbarrel', 'chair', 'can', 'lighting', 'insulation', 'shade', 'roofgarden', 'heatexchanger', 'solar', 'geothermal'],
    placeOrder: ['yard', 'living', 'roof', 'utility'],
    buildWorld: buildWorld
  };
})();
