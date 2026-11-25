/* Maquete REALISTA do Ateliê de conceito (conceito.js escolhe o estilo).
   Lê o mesmo estudo do Laboratório — células, núcleos, eixo do parque —, mas no lugar
   do mosaico de hexágonos monta uma cidade em escala real, em metros:
   - malha de quadras alinhada ao eixo do parque, com o CONVIVA no centro de uma quadra;
   - ruas com calçada, asfalto, faixa, travessia, carros andando e estacionados;
   - prédios com janela por andar (shader procedural: o andar mede 3 m em qualquer prédio),
     térreo comercial no uso misto, pele de vidro no CONECTA, galpão com shed no PRODUZA;
   - árvores de copa, coníferas, palmeiras e ipês (amarelo e roxo), em bosques e clareiras;
   - lago com margem de areia, campos com marcação, piscinas, playgrounds, praça do CONVIVA
     com cobertura circular, anfiteatro e gente na escala do detalhe.
   Tudo determinístico (mesmo terreno → mesma maquete), no navegador, sem custo. */
(function () {
  'use strict';
  const sr = i => { const x = Math.sin(i * 12.9898 + 78.233) * 43758.5453; return x - Math.floor(x); };
  const lin = h => new THREE.Color(h).convertSRGBToLinear();
  const VERDE = new Set(['PARQUE', 'CONTEMPLA', 'DIVIRTA']);
  const vn = (x, y) => {           // ruído de valor 2D (bosques x clareiras)
    const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi, h = (a, b) => sr(a * 157.1 + b * 311.7);
    const sx = xf * xf * (3 - 2 * xf), sy = yf * yf * (3 - 2 * yf);
    return (h(xi, yi) * (1 - sx) + h(xi + 1, yi) * sx) * (1 - sy) + (h(xi, yi + 1) * (1 - sx) + h(xi + 1, yi + 1) * sx) * sy;
  };
  const pick = (arr, r) => arr[Math.min(arr.length - 1, Math.floor(r * arr.length))];

  function dentro(p, poly) {
    let c = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const a = poly[i], b = poly[j];
      if ((a[1] > p[1]) !== (b[1] > p[1]) && p[0] < (b[0] - a[0]) * (p[1] - a[1]) / (b[1] - a[1]) + a[0]) c = !c;
    }
    return c;
  }
  function indice(cel, s) {        // célula mais próxima de um ponto (para saber o uso)
    const k = s * 2, m = new Map();
    cel.forEach(c => { const key = Math.floor(c.x / k) + ',' + Math.floor(c.y / k); if (!m.has(key)) m.set(key, []); m.get(key).push(c); });
    return (x, y) => {
      let best = null, bd = Infinity; const gx = Math.floor(x / k), gy = Math.floor(y / k);
      for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) {
        const a = m.get((gx + i) + ',' + (gy + j)); if (a) for (const c of a) { const d = (c.x - x) ** 2 + (c.y - y) ** 2; if (d < bd) { bd = d; best = c; } }
      }
      return best;
    };
  }

  // ── fachada procedural: janelas por andar, em metros reais ──────────────────
  function fachada(p, tarde) {
    const m = new THREE.MeshStandardMaterial({ roughness: p.rough || 0.86, metalness: 0, envMapIntensity: 0.5 });
    m.onBeforeCompile = sh => {
      Object.assign(sh.uniforms, {
        uPiso: { value: p.piso }, uVao: { value: p.vao }, uJ: { value: new THREE.Vector3(p.y0, p.y1, p.x0) },
        uV1: { value: lin(p.vidro[0]) }, uV2: { value: lin(p.vidro[1]) }, uTeto: { value: lin(p.teto || '#9a968e') },
        uTarde: { value: tarde ? 1 : 0 }, uNerv: { value: p.nervura || 0 }, uTerreo: { value: p.terreo || 0 }, uLaje: { value: p.laje == null ? 0.18 : p.laje }
      });
      sh.vertexShader = sh.vertexShader
        .replace('#include <common>', '#include <common>\nvarying vec3 vWP; varying vec3 vNW;')
        .replace('#include <begin_vertex>', `#include <begin_vertex>
          vec4 wpX = vec4(transformed, 1.0);
          #ifdef USE_INSTANCING
            wpX = instanceMatrix * wpX; vNW = mat3(modelMatrix) * mat3(instanceMatrix) * objectNormal;
          #else
            vNW = mat3(modelMatrix) * objectNormal;
          #endif
          vWP = (modelMatrix * wpX).xyz;`);
      sh.fragmentShader = sh.fragmentShader
        .replace('#include <common>', `#include <common>
          uniform float uPiso, uVao, uTarde, uNerv, uTerreo, uLaje; uniform vec3 uJ, uV1, uV2, uTeto; varying vec3 vWP; varying vec3 vNW;
          float hh(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }`)
        .replace('#include <color_fragment>', `#include <color_fragment>
          float jan = 0.0, acesa = 0.0;
          vec3 nW = normalize(vNW);
          if (abs(nW.y) < 0.4) {
            vec2 tg = normalize(vec2(-nW.z, nW.x));
            float al = dot(vWP.xz, tg), yy = vWP.y, fy, fl;
            bool terreo = uTerreo > 0.5 && yy < 4.8;
            if (terreo) { fy = yy / 4.8; fl = -1.0; } else { fy = fract(yy / uPiso); fl = floor(yy / uPiso); }
            float cx = fract(al / uVao), ci = floor(al / uVao);
            vec3 J = terreo ? vec3(0.06, 0.8, 0.04) : uJ;
            jan = step(J.x, fy) * step(fy, J.y) * step(J.z, cx) * step(cx, 1.0 - J.z);
            float rnd = hh(vec2(ci, fl) + floor(vWP.xz / 40.0) * 3.1);
            vec3 vid = mix(uV1, uV2, clamp(rnd * 0.65 + fy * 0.45, 0.0, 1.0));
            vid = mix(vid, vec3(0.62, 0.74, 0.86), 0.35 * smoothstep(0.0, 60.0, yy) * rnd);
            if (terreo) vid = mix(vec3(0.20, 0.15, 0.10), vec3(0.55, 0.42, 0.26), rnd);
            if (uTarde > 0.5 && rnd > 0.74) acesa = jan;
            diffuseColor.rgb = mix(diffuseColor.rgb, vid, jan);
            if (!terreo) diffuseColor.rgb *= 1.0 - uLaje * (1.0 - smoothstep(0.0, 0.08, fy)) * (1.0 - jan);
            if (uNerv > 0.0) diffuseColor.rgb *= 0.88 + 0.12 * step(0.5, fract(al / uNerv));
            diffuseColor.rgb *= mix(0.78, 1.0, smoothstep(0.0, 2.2, yy));
          } else if (nW.y > 0.5) {
            float n = hh(floor(vWP.xz * 0.5));
            diffuseColor.rgb = uTeto * (0.9 + 0.12 * n);
          }`)
        .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\n roughnessFactor = mix(roughnessFactor, 0.08, jan);')
        .replace('#include <metalnessmap_fragment>', '#include <metalnessmap_fragment>\n metalnessFactor = mix(metalnessFactor, 0.55, jan);')
        .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n totalEmissiveRadiance += acesa * vec3(1.0, 0.62, 0.28) * 0.9;');
    };
    return m;
  }

  // ── geometrias base ──────────────────────────────────────────────────────────
  let GEO = null;
  function geos() {
    if (GEO) return GEO;
    const caixa = new THREE.BoxGeometry(1, 1, 1); caixa.translate(0, 0.5, 0);
    const tronco = new THREE.CylinderGeometry(0.75, 1, 1, 6); tronco.translate(0, 0.5, 0);
    const cil = new THREE.CylinderGeometry(1, 1, 1, 40); cil.translate(0, 0.5, 0);
    const cone = new THREE.ConeGeometry(1, 1, 9); cone.translate(0, 0.5, 0);
    const esfera = new THREE.SphereGeometry(1, 10, 8);
    // copa: icosaedro com relevo (deslocamento por posição, para não abrir frestas)
    const copa = new THREE.IcosahedronGeometry(1, 2), pa = copa.attributes.position;
    for (let i = 0; i < pa.count; i++) {
      const x = pa.getX(i), y = pa.getY(i), z = pa.getZ(i);
      const f = 0.82 + 0.32 * sr(Math.round(x * 1e3) * 7 + Math.round(y * 1e3) * 13 + Math.round(z * 1e3) * 17);
      pa.setXYZ(i, x * f, (y < -0.2 ? y * 0.55 : y) * f, z * f);
    }
    // normal radial: copa lisa, sem facetas (o icosaedro do three é não indexado)
    const pn = copa.attributes.normal, v3 = new THREE.Vector3();
    for (let i = 0; i < pa.count; i++) { v3.set(pa.getX(i), pa.getY(i) * 1.4, pa.getZ(i)).normalize(); pn.setXYZ(i, v3.x, v3.y, v3.z); }
    // volume: a copa escurece por baixo (luz que não atravessa a folhagem)
    const cc = new Float32Array(pa.count * 3);
    for (let i = 0; i < pa.count; i++) { const y = pa.getY(i), f = 0.55 + 0.5 * Math.min(1, Math.max(0, (y + 0.7) / 1.6)) + 0.08 * (sr(i * 1.7) - 0.5); cc[i * 3] = cc[i * 3 + 1] = cc[i * 3 + 2] = f; }
    copa.setAttribute('color', new THREE.BufferAttribute(cc, 3));
    // telhado de duas águas (cumeeira ao longo de X) e dente de shed
    const tri = new THREE.Shape([new THREE.Vector2(-0.5, 0), new THREE.Vector2(0.5, 0), new THREE.Vector2(0, 1)]);
    const duasAguas = new THREE.ExtrudeGeometry(tri, { depth: 1, bevelEnabled: false }); duasAguas.translate(0, 0, -0.5); duasAguas.rotateY(Math.PI / 2);
    const dente = new THREE.ExtrudeGeometry(new THREE.Shape([new THREE.Vector2(-0.5, 0), new THREE.Vector2(0.5, 0), new THREE.Vector2(-0.5, 1)]), { depth: 1, bevelEnabled: false }); dente.translate(0, 0, -0.5);
    const abobada = new THREE.CylinderGeometry(1, 1, 1, 28, 1, false, 0, Math.PI); abobada.rotateZ(Math.PI / 2);
    return (GEO = { caixa, tronco, cil, cone, esfera, copa, duasAguas, dente, abobada });
  }

  function montar(e, C, luz, ren) {
    const tarde = luz === 'tarde', G = geos();
    const cena = new THREE.Scene();
    const s = e.s, R = Math.sqrt(e.A / Math.PI), poly = e.polyXY;

    // eixo do parque (o mesmo PCA do estudo) e a malha de quadras alinhada a ele
    let sxx = 0, syy = 0, sxy = 0; e.cel.forEach(c => { sxx += c.x * c.x; syy += c.y * c.y; sxy += c.x * c.y; });
    const ang = 0.5 * Math.atan2(2 * sxy, sxx - syy), ux = Math.cos(ang), uy = Math.sin(ang);
    const paraXY = (u, v) => [u * ux - v * uy, u * uy + v * ux];
    const paraUV = (x, y) => [x * ux + y * uy, -x * uy + y * ux];
    const dentroUV = (u, v) => dentro(paraXY(u, v), poly);
    const usoEm = indice(e.cel, s);
    const cv = e.sem.CONVIVA || { x: 0, y: 0 };
    const [cu, cvv] = paraUV(cv.x, cv.y);
    const B = Math.min(140, Math.max(72, s * 2.7));

    // lago do CONTEMPLA: margem orgânica
    let lago = null;
    if (e.sem.CONTEMPLA) {
      const ct = e.sem.CONTEMPLA, Rl = Math.max(28, s * 1.9), f1 = sr(ct.x) * 6.28, f2 = sr(ct.y) * 6.28;
      lago = { x: ct.x, y: ct.y, r: a => Rl * (1 + 0.22 * Math.sin(3 * a + f1) + 0.12 * Math.sin(5 * a + f2)) };
    }
    const noLago = (x, y, folga = 0) => !!lago && Math.hypot(x - lago.x, y - lago.y) < lago.r(Math.atan2(y - lago.y, x - lago.x)) + folga;

    // quadras
    const uvs = poly.map(p => paraUV(p[0], p[1]));
    const umin = Math.min(...uvs.map(p => p[0])), umax = Math.max(...uvs.map(p => p[0]));
    const vmin = Math.min(...uvs.map(p => p[1])), vmax = Math.max(...uvs.map(p => p[1]));
    const i0 = Math.floor((umin - cu) / B) - 1, i1 = Math.ceil((umax - cu) / B) + 1;
    const j0 = Math.floor((vmin - cvv) / B) - 1, j1 = Math.ceil((vmax - cvv) / B) + 1;
    const quadras = new Map(), K = (i, j) => i + ',' + j;
    for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) {
      const bu = cu + i * B, bv = cvv + j * B;
      if (!dentroUV(bu, bv)) continue;
      const [x, y] = paraXY(bu, bv), c = usoEm(x, y); if (!c) continue;
      const m = B / 2 - 7;
      const cheia = [[1, 1], [1, -1], [-1, 1], [-1, -1]].every(([a, b]) => dentroUV(bu + a * m, bv + b * m));
      let uso = c.uso;
      if (i === 0 && j === 0) uso = 'CONVIVA';
      if (uso !== 'CONVIVA' && uso !== 'CONTEMPLA' && noLago(x, y, B * 0.3)) uso = 'CONTEMPLA';
      quadras.set(K(i, j), { i, j, bu, bv, x, y, uso, cheia, seed: (i * 131 + j * 977) * 1.37, d: Math.hypot(x - cv.x, y - cv.y) });
    }

    // ruas: uma linha da malha vira rua quando ao menos um lado é construído; entre dois verdes, caminho
    const ruas = [], segs = new Map();
    const verdeQ = q => !q || VERDE.has(q.uso);
    const tipoEntre = (a, b) => (!a && !b) ? null : (verdeQ(a) && verdeQ(b) ? 'caminho' : 'rua');
    for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) {
      [[i + 1, j, 'V'], [i, j + 1, 'H']].forEach(([i2, j2, dir]) => {
        const a = quadras.get(K(i, j)), b = quadras.get(K(i2, j2)), t = tipoEntre(a, b); if (!t) return;
        const lu = dir === 'V' ? cu + (i + 0.5) * B : cu + i * B, lv = dir === 'V' ? cvv + j * B : cvv + (j + 0.5) * B;
        if (!dentroUV(lu, lv)) return;
        const [mx, my] = paraXY(lu, lv); if (noLago(mx, my, 3)) return;
        const parque = a && b && (verdeQ(a) !== verdeQ(b));
        const larg = t === 'caminho' ? 4 : parque ? 17 : 12;
        const sg = dir === 'V' ? { u0: lu, v0: lv - B / 2, u1: lu, v1: lv + B / 2 } : { u0: lu - B / 2, v0: lv, u1: lu + B / 2, v1: lv };
        Object.assign(sg, { dir, larg, t, parque, i, j });
        ruas.push(sg); segs.set(dir + K(i, j), sg);
      });
    }
    // ponto (x,y) cai em cima de uma rua?
    const naRua = (x, y, folga = 1.5) => {
      const [u, v] = paraUV(x, y);
      const iL = Math.round((u - cu) / B - 0.5);
      const jH = Math.round((v - cvv) / B - 0.5), jV = Math.round((v - cvv) / B);
      const sV = segs.get('V' + K(iL, jV)); if (sV && sV.t === 'rua' && Math.abs(u - sV.u0) < sV.larg / 2 + folga) return true;
      const sH = segs.get('H' + K(Math.round((u - cu) / B), jH)); if (sH && sH.t === 'rua' && Math.abs(v - sH.v0) < sH.larg / 2 + folga) return true;
      return false;
    };

    // ── materiais ──
    const MT = {
      res: fachada({ piso: 3.0, vao: 3.3, y0: 0.3, y1: 0.8, x0: 0.18, vidro: ['#2a3a46', '#7e98aa'], teto: '#8f8b84' }, tarde),
      resT: fachada({ piso: 3.0, vao: 3.3, y0: 0.3, y1: 0.8, x0: 0.18, vidro: ['#2a3a46', '#7e98aa'], teto: '#8f8b84', terreo: 1 }, tarde),
      vidro: fachada({ piso: 3.8, vao: 1.6, y0: 0.07, y1: 0.95, x0: 0.035, vidro: ['#1f3443', '#8fb0c6'], teto: '#b9bcbd', laje: 0.35, rough: 0.6 }, tarde),
      loja: fachada({ piso: 4.8, vao: 4.2, y0: 0.1, y1: 0.85, x0: 0.06, vidro: ['#3b2d1f', '#9c8160'], teto: '#8f8a80', terreo: 1 }, tarde),
      galpao: fachada({ piso: 11, vao: 6, y0: 0.74, y1: 0.9, x0: 0.04, vidro: ['#34414a', '#7a8f9b'], teto: '#a9adb0', nervura: 0.9, laje: 0 }, tarde),
      casa: fachada({ piso: 3.0, vao: 3.6, y0: 0.3, y1: 0.75, x0: 0.28, vidro: ['#2c3236', '#68737a'], teto: '#9a968e' }, tarde),
      liso: new THREE.MeshStandardMaterial({ roughness: 0.8, envMapIntensity: 0.5 }),
      metal: new THREE.MeshStandardMaterial({ roughness: 0.45, metalness: 0.35, envMapIntensity: 0.9 }),
      copa: new THREE.MeshStandardMaterial({ roughness: 0.95, envMapIntensity: 0.3, vertexColors: true }),
      folha: new THREE.MeshStandardMaterial({ roughness: 0.95, envMapIntensity: 0.3 }),
      tronco: new THREE.MeshStandardMaterial({ roughness: 1, envMapIntensity: 0.2 }),
      carro: new THREE.MeshStandardMaterial({ roughness: 0.32, metalness: 0.25, envMapIntensity: 1.1 }),
      cabine: new THREE.MeshStandardMaterial({ color: lin('#ffffff'), roughness: 0.1, metalness: 0.5, envMapIntensity: 1.2 }),
      pessoa: new THREE.MeshStandardMaterial({ roughness: 0.9, envMapIntensity: 0.3 })
    };

    // coletores de instâncias
    const lotes = {};
    const put = (chave, geo, mat, x, y, z, sx, sy, sz, cor, rot = 0, sombra = true) => {
      (lotes[chave] = lotes[chave] || { geo, mat, itens: [], sombra }).itens.push([x, y, z, sx, sy, sz, cor, rot]);
    };
    const W = (u, v) => { const [x, y] = paraXY(u, v); return [x, -y]; };
    const pegadas = [], copasAO = [], desenhos = [];

    const predio = (tipo, u, v, w, d, h, y0, cor, rotExtra = 0) => {
      const [x, z] = W(u, v);
      put('p_' + tipo, G.caixa, MT[tipo], x, y0, z, w, h, d, cor, ang + rotExtra);
      if (y0 < 0.5) pegadas.push([u, v, w, d, rotExtra]);
      // casa de máquinas, caixa d'água, teto verde
      if (h > 18 && tipo !== 'galpao') {
        const r = sr(u * 3.1 + v * 7.7);
        put('p_liso', G.caixa, MT.liso, x, y0 + h, z, w * 0.32, 3.2, d * 0.28, '#b8b3a9', ang + rotExtra);
        if (r > 0.6) { const [x2, z2] = W(u + w * 0.25, v - d * 0.22); put('verde', G.caixa, MT.folha, x2, y0 + h, z2, w * 0.3, 0.5, d * 0.35, '#6f8f4a', ang); }
      }
    };
    const VERDES = ['#3f6a2c', '#4a7633', '#365f28', '#58823b', '#46702f', '#62893f', '#3a6430', '#52773a'];
    const arvore = (x, y, i, esc = 1, tipo = 'copa', y0 = 0) => {
      const wx = x, wz = -y;
      if (tipo === 'palmeira') {
        const h = (11 + sr(i) * 5) * esc;
        put('tronco', G.tronco, MT.tronco, wx, y0, wz, 0.32, h, 0.32, '#9a8b74');
        put('copa', G.copa, MT.copa, wx, y0 + h, wz, 3.4 * esc, 1.2 * esc, 3.4 * esc, '#4d7a34', sr(i) * 6.28);
        copasAO.push([x, y, 2]); return;
      }
      const h = (6 + sr(i) * 7) * esc, rc = (2.4 + sr(i + 1) * 2.6) * esc;
      if (tipo === 'conifera') {
        put('tronco', G.tronco, MT.tronco, wx, y0, wz, 0.3, h * 0.3, 0.3, '#5a4330');
        put('cone', G.cone, MT.folha, wx, y0 + h * 0.18, wz, rc * 0.75, h * 1.15, rc * 0.75, pick(['#2f5230', '#36593a', '#2a4a2b'], sr(i + 2)));
        copasAO.push([x, y, rc * 0.7]); return;
      }
      put('tronco', G.tronco, MT.tronco, wx, y0, wz, 0.32 * esc, h * 0.62, 0.32 * esc, '#5b4634');
      let cor = pick(VERDES, sr(i + 2));
      if (tipo === 'ipe') cor = sr(i + 3) > 0.45 ? '#e8b720' : '#c4689c';
      const cy = y0 + h * 0.62 + rc * 0.45;
      put('copa', G.copa, MT.copa, wx, cy, wz, rc, rc * 0.82, rc, cor, sr(i + 4) * 6.28);
      if (sr(i + 5) > 0.4) {
        const a = sr(i + 6) * 6.28, o = rc * 0.6;
        put('copa', G.copa, MT.copa, wx + Math.cos(a) * o, cy - rc * 0.2, wz + Math.sin(a) * o, rc * 0.68, rc * 0.6, rc * 0.68, tipo === 'ipe' ? cor : pick(VERDES, sr(i + 7)), sr(i + 8) * 6.28);
      }
      copasAO.push([x, y, rc]);
    };
    const CORES_CARRO = ['#f2f2f0', '#f2f2f0', '#c9ccce', '#9aa0a5', '#2b2e31', '#1c1d1f', '#8e1f22', '#264d7a', '#5f6b72', '#e8e4d8', '#7a2f3d', '#3f5a3a'];
    const carro = (x, y, rot, i, parado = false) => {
      const wx = x, wz = -y, cor = pick(CORES_CARRO, sr(i));
      if (!parado && sr(i + 9) > 0.93) {           // ônibus de vez em quando
        put('carro', G.caixa, MT.carro, wx, 0.35, wz, 12, 2.9, 2.5, sr(i + 3) > 0.5 ? '#d8a21e' : '#2f6fa8', rot); return;
      }
      put('carro', G.caixa, MT.carro, wx, 0.28, wz, 4.4, 0.85, 1.82, cor, rot);
      put('cabine', G.caixa, MT.cabine, wx, 1.13, wz, 2.35, 0.62, 1.6, '#20262b', rot);
    };
    const PELE = ['#f1c9a5', '#d8a77f', '#a8714c', '#7a4a2e', '#5a3622'], ROUPA = ['#2f4a6b', '#b23a48', '#f0e9dc', '#3d6b4a', '#e3a913', '#5b3f74', '#1e1e1e', '#c9822e', '#7aa0c4'];
    const pessoa = (x, y, i, y0 = 0) => {
      const wx = x, wz = -y, a = 0.85 + sr(i) * 0.2;
      put('pessoa', G.cil, MT.pessoa, wx, y0, wz, 0.24, 1.32 * a, 0.24, pick(ROUPA, sr(i + 1)), 0, false);
      put('cabeca', G.esfera, MT.pessoa, wx, y0 + 1.32 * a + 0.13, wz, 0.13, 0.14, 0.13, pick(PELE, sr(i + 2)), 0, false);
    };
    const gente = (u, v, raio, n, seed, y0 = 0) => {
      for (let k = 0; k < n; k++) {
        const a = sr(seed + k * 3.3) * 6.283, d = Math.sqrt(sr(seed + k * 5.7)) * raio;
        const [x, y] = paraXY(u + Math.cos(a) * d, v + Math.sin(a) * d); pessoa(x, y, seed + k, y0);
      }
    };
    const arvUV = (u, v, i, esc, tipo, y0) => { const [x, y] = paraXY(u, v); arvore(x, y, i, esc, tipo, y0); };

    // ── o conteúdo de cada quadra, por uso ──
    const PAREDES = ['#efe9df', '#e6dccb', '#d9cdb8', '#f3efe7', '#cfc5b5', '#e2d2bd', '#c9b49a', '#ece2d0', '#b9b2a7', '#d6c2a8'];
    quadras.forEach(q => {
      const { bu, bv, seed } = q, m = B / 2 - 9, r = sr(seed), r2 = sr(seed + 1.7), r3 = sr(seed + 3.9);
      const dens = Math.min(1, Math.max(0.3, 1.15 - q.d / (R * 1.05)));
      const ret = (cor, du, dv, w, d) => desenhos.push(g => { g.fillStyle = cor; g.fillRect(bu + du - w / 2, bv + dv - d / 2, w, d); });
      if (!q.cheia) {                                // quadra cortada pela divisa: vira verde com árvores
        if (!VERDE.has(q.uso)) {
          ret('#6f8a46', 0, 0, B - 12, B - 12);
          for (let k = 0; k < 8; k++) { const du = (sr(seed + k) - 0.5) * 2 * m, dv = (sr(seed + k * 2.3) - 0.5) * 2 * m; if (dentroUV(bu + du, bv + dv)) arvUV(bu + du, bv + dv, seed * 10 + k, 1); }
        }
        return;
      }
      switch (q.uso) {
        case 'HABITACAO': {
          if (q.d > R * 0.62 && r < 0.55) {          // sobrados com quintal
            ret('#748f4a', 0, 0, 2 * m, 2 * m);
            const lw = 7.5, n = Math.floor(2 * m / lw);
            [[-m + 6, 0], [-m + 22, Math.PI], [m - 22, 0], [m - 6, Math.PI]].forEach(([dv, rr], f) => {
              for (let k = 0; k < n; k++) {
                const du = -m + lw * (k + 0.5), id = seed * 7 + f * 31 + k;
                if (sr(id) > 0.92) { arvUV(bu + du, bv + dv, id, 0.8); continue; }
                const hh = sr(id + 1) > 0.65 ? 6.2 : 3.4;
                predio('casa', bu + du, bv + dv, lw - 0.6, 10, hh, 0, pick(['#efe3cf', '#e8d6bd', '#f1ead9', '#dcc6a6', '#e9d2c4', '#d7dfe0', '#f0dcc0'], sr(id + 2)));
                const [x, z] = W(bu + du, bv + dv);
                put('telha', G.duasAguas, MT.liso, x, hh, z, 10.6, 2.6, lw - 0.2, pick(['#a3553a', '#9a4b32', '#b0623f', '#8c4a35', '#6f6b66'], sr(id + 3)), ang);
                if (sr(id + 4) > 0.55) { const [cx, cy] = paraXY(bu + du, bv + dv + (rr ? 9 : -9)); carro(cx, cy, ang + Math.PI / 2, id, true); }
              }
            });
            desenhos.push(g => { g.fillStyle = '#c8c1b2'; [-m + 6, m - 6].forEach(dv => g.fillRect(bu - m, bv + dv + (dv < 0 ? -9.5 : 5.5), 2 * m, 4)); });
            for (let k = 0; k < 6; k++) arvUV(bu + (sr(seed + k) - 0.5) * 1.8 * m, bv + (sr(seed + k * 1.9) - 0.5) * 6, seed * 3 + k, 0.8);
          } else if (r < 0.42) {                       // quadra-pátio (edifícios no perímetro)
            const fl = Math.round(4 + dens * 4 + r2 * 2), dp = 13;
            ret('#6f8b47', 0, 0, 2 * m - 2 * dp, 2 * m - 2 * dp);
            const barra = (du, dv, w, d, k) => {
              const partes = 2 + Math.floor(sr(seed + k) * 2), L = w > d ? w : d;
              for (let p = 0; p < partes; p++) {
                const off = -L / 2 + L * (p + 0.5) / partes, h = (fl + Math.round((sr(seed + k * 9 + p) - 0.5) * 3)) * 3.05;
                predio(p === 0 && dens > 0.7 ? 'resT' : 'res', bu + du + (w > d ? off : 0), bv + dv + (w > d ? 0 : off), w > d ? L / partes - 0.4 : w, w > d ? d : L / partes - 0.4, h, 0, pick(PAREDES, sr(seed + k * 5 + p)));
              }
            };
            barra(0, m - dp / 2, 2 * m, dp, 1); barra(0, -m + dp / 2, 2 * m, dp, 2);
            barra(m - dp / 2, 0, dp, 2 * m - 2 * dp - 1, 3); barra(-m + dp / 2, 0, dp, 2 * m - 2 * dp - 1, 4);
            const ni = 3 + Math.floor(r3 * 5);
            for (let k = 0; k < ni; k++) arvUV(bu + (sr(seed + k * 1.3) - 0.5) * (2 * m - 2 * dp - 8), bv + (sr(seed + k * 2.9) - 0.5) * (2 * m - 2 * dp - 8), seed * 5 + k, 0.9, sr(seed + k) > 0.9 ? 'ipe' : 'copa');
            if (r3 > 0.6) desenhos.push(g => { g.fillStyle = '#d9c9a0'; g.beginPath(); g.arc(bu, bv, 6, 0, 6.283); g.fill(); ['#c0392b', '#2e86c1', '#f1c40f'].forEach((c, k) => { g.fillStyle = c; g.fillRect(bu - 3 + k * 2.2, bv - 1, 1.4, 1.4); }); });
          } else if (r < 0.78) {                       // torres com piscina e jardim
            ret('#6d8a45', 0, 0, 2 * m, 2 * m);
            const quatro = dens > 0.55, pos = quatro ? [[-1, -1], [1, 1], [-1, 1], [1, -1]] : [[-1, -1], [1, 1]];
            pos.forEach(([a, b], k) => {
              const fl = Math.round(9 + dens * 15 + sr(seed + k) * 6), du = a * m * 0.5, dv = b * m * 0.5;
              ret('#cfc8b8', du, dv, 26, 26);
              predio(sr(seed + k * 3) > 0.8 ? 'vidro' : 'res', bu + du, bv + dv, 19 + sr(seed + k * 7) * 4, 19 + sr(seed + k * 11) * 5, fl * 3.0, 0, pick(PAREDES, sr(seed + k * 13)), (sr(seed + k * 17) - 0.5) * 0.1);
            });
            if (r2 > 0.35) desenhos.push(g => { g.fillStyle = '#e8e2d4'; g.fillRect(bu - 9, bv - 5, 18, 10); g.fillStyle = '#3fa7c4'; g.fillRect(bu - 7.5, bv - 3.5, 15, 7); g.fillStyle = 'rgba(255,255,255,.35)'; g.fillRect(bu - 7.5, bv - 3.5, 15, 1.2); });
            for (let k = 0; k < 7; k++) { const du = (sr(seed + k * 1.1) - 0.5) * 2 * m * 0.95, dv = (sr(seed + k * 3.7) - 0.5) * 2 * m * 0.95; if (Math.abs(du) > 14 || Math.abs(dv) > 14) arvUV(bu + du, bv + dv, seed * 9 + k, 0.9, sr(seed + k * 2) > 0.85 ? 'palmeira' : 'copa'); }
          } else {                                     // lâminas paralelas
            ret('#718c49', 0, 0, 2 * m, 2 * m);
            [-m + 8, 0, m - 8].forEach((dv, k) => predio('res', bu, bv + dv, 2 * m * 0.86, 12, Math.round(4 + dens * 3 + sr(seed + k) * 2) * 3.05, 0, pick(PAREDES, sr(seed + k * 7))));
            for (let k = 0; k < 8; k++) arvUV(bu + (sr(seed + k) - 0.5) * 1.8 * m, bv + (k % 2 ? -m / 2 + 1 : m / 2 - 1), seed * 4 + k, 0.8);
          }
          break;
        }
        case 'MISTO': {
          ret('#cbc3b2', 0, 0, 2 * m + 4, 2 * m + 4);
          const pw = 2 * m - 2;
          predio('loja', bu, bv, pw, pw, 5, 0, pick(['#d8cbb5', '#cdbba0', '#e2d7c4', '#c2b29b'], r));
          const nt = dens > 0.55 ? 2 : 1;
          for (let k = 0; k < nt; k++) {
            const du = nt === 1 ? 0 : (k ? m * 0.42 : -m * 0.42), dv = nt === 1 ? 0 : (k ? -m * 0.3 : m * 0.3);
            const fl = Math.round(7 + dens * 13 + sr(seed + k) * 5);
            predio(sr(seed + k * 5) > 0.6 ? 'vidro' : 'res', bu + du, bv + dv, 22, 20, fl * 3.0, 5, pick(PAREDES, sr(seed + k * 7)));
          }
          for (let k = 0; k < 5; k++) arvUV(bu + (sr(seed + k) - 0.5) * m * 1.3, bv + (k % 2 ? 1 : -1) * m * 0.75, seed * 6 + k, 0.55, 'copa', 5);
          gente(bu, bv + m + 2, m, 6, seed);
          break;
        }
        case 'CONECTA': {
          ret('#d6d1c6', 0, 0, 2 * m + 4, 2 * m + 4);
          predio('vidro', bu - m * 0.3, bv - m * 0.35, 2 * m * 0.62, 26, Math.round(4 + r * 5) * 3.8, 0, '#55636c');
          predio('vidro', bu + m * 0.45, bv + m * 0.25, 30, 2 * m * 0.55, Math.round(3 + r2 * 4) * 3.8, 0, '#6b7880');
          const [gx, gz] = W(bu + m * 0.45, bv + m * 0.25); put('verde', G.caixa, MT.folha, gx, Math.round(3 + r2 * 4) * 3.8, gz, 24, 0.6, 2 * m * 0.45, '#6e8f48', ang);
          for (let k = 0; k < 9; k++) arvUV(bu - m * 0.8 + (k % 3) * 9, bv + m * 0.35 + Math.floor(k / 3) * 9, seed * 2 + k, 0.7);
          gente(bu - m * 0.5, bv + m * 0.5, 14, 10, seed);
          break;
        }
        case 'PRODUZA': {
          ret('#a9a8a3', 0, 0, 2 * m + 4, 2 * m + 4);
          const gw = 2 * m * 0.86, gd = 2 * m * 0.48, dv = m * 0.38, hg = 10.5;
          predio('galpao', bu, bv + dv, gw, gd, hg, 0, pick(['#c9c5bd', '#b7bcbf', '#d3cbbb'], r));
          const n = Math.floor(gw / 11);
          for (let k = 0; k < n; k++) { const [x, z] = W(bu - gw / 2 + gw * (k + 0.5) / n, bv + dv); put('shed', G.dente, MT.metal, x, hg, z, gw / n, 3.2, gd, '#9aa3a8', ang); }
          // pátio: vagas, caminhões, painéis solares no galpão menor
          desenhos.push(g => {
            g.strokeStyle = 'rgba(255,255,255,.75)'; g.lineWidth = 0.18;
            for (let k = 0; k <= Math.floor(2 * m / 2.6); k++) { const u = bu - m + k * 2.6; g.beginPath(); g.moveTo(u, bv - m + 2); g.lineTo(u, bv - m + 7); g.moveTo(u, bv - m * 0.2 - 5); g.lineTo(u, bv - m * 0.2); g.stroke(); }
          });
          for (let k = 0; k < Math.floor(2 * m / 2.6); k++) {
            if (sr(seed + k) > 0.45) { const [x, y] = paraXY(bu - m + 1.3 + k * 2.6, bv - m + 4.5); carro(x, y, ang + Math.PI / 2, seed * 3 + k, true); }
            if (sr(seed + k * 2.2) > 0.55) { const [x, y] = paraXY(bu - m + 1.3 + k * 2.6, bv - m * 0.2 - 2.5); carro(x, y, ang + Math.PI / 2, seed * 5 + k, true); }
          }
          for (let k = 0; k < 3; k++) { const [x, z] = W(bu - m * 0.6 + k * 8, bv + dv - gd / 2 - 9); put('carro', G.caixa, MT.carro, x, 0.9, z, 3, 3.3, 13, '#eceae4', ang); }
          const [px, pz] = W(bu + m * 0.55, bv - m * 0.55); put('p_galpao', G.caixa, MT.galpao, px, 0, pz, 2 * m * 0.3, 7, 2 * m * 0.3, '#cfd2d3', ang);
          put('solar', G.caixa, MT.metal, px, 7, pz, 2 * m * 0.26, 0.3, 2 * m * 0.26, '#22344c', ang);
          break;
        }
        case 'ENCONTRA': {
          ret('#d9ccb4', 0, 0, 2 * m + 4, 2 * m + 4);
          const L = 2 * m * 0.72;
          predio('loja', bu, bv + m * 0.3, L, 24, 5.5, 0, '#e3d6bf');
          const [x, z] = W(bu, bv + m * 0.3); put('abobada', G.abobada, MT.metal, x, 5.5, z, L, 6.5, 12.5, pick(['#b9c0c4', '#a65a3c'], r), ang);
          for (let k = 0; k < 8; k++) { const du = -m * 0.8 + k * (m * 1.6 / 7), [kx, kz] = W(bu + du, bv - m * 0.45); put('p_liso', G.caixa, MT.liso, kx, 0, kz, 3.4, 2.8, 3.4, pick(['#c9822e', '#7d5ba6', '#e3a913', '#3f6e3a', '#b5486b'], sr(seed + k)), ang); put('telha', G.duasAguas, MT.liso, kx, 2.8, kz, 3.8, 1.2, 4, '#f3efe7', ang); }
          for (let k = 0; k < 10; k++) { const [ex, ez] = W(bu + (sr(seed + k) - 0.5) * m * 1.6, bv - m * 0.15 + (sr(seed + k * 2) - 0.5) * 10); put('guarda', G.cone, MT.liso, ex, 2.2, ez, 2.2, 0.8, 2.2, pick(['#e3a913', '#b5486b', '#f4efe4', '#2f6fa8'], sr(seed + k * 3))); put('poste', G.tronco, MT.tronco, ex, 0, ez, 0.06, 2.2, 0.06, '#4a4038', 0, false); }
          gente(bu, bv - m * 0.2, m * 0.8, 40, seed);
          break;
        }
        case 'INTEGRA': {
          ret('#d8c7a6', 0, 0, 2 * m + 4, 2 * m + 4);
          desenhos.push(g => { g.strokeStyle = 'rgba(160,120,80,.35)'; g.lineWidth = 0.4; for (let k = -m; k <= m; k += 4) { g.beginPath(); g.moveTo(bu + k, bv - m); g.lineTo(bu + k, bv + m); g.stroke(); } });
          for (let k = 0; k < 3; k++) {
            const du = -m * 0.55 + k * m * 0.55, [x, z] = W(bu + du, bv + m * 0.35);
            put('p_liso', G.caixa, MT.liso, x, 4.6, z, 16, 0.5, 9, pick(['#c9822e', '#f4efe4', '#9c2f4f'], sr(seed + k)), ang);
            [[-7, -4], [7, -4], [-7, 4], [7, 4]].forEach(([a, b]) => { const [cx, cz] = W(bu + du + a, bv + m * 0.35 + b); put('poste', G.tronco, MT.metal, cx, 0, cz, 0.18, 4.6, 0.18, '#3a3a3a'); });
          }
          for (let k = 0; k < 4; k++) { const [x, z] = W(bu - m * 0.6 + k * 10, bv - m * 0.7); put('carro', G.caixa, MT.carro, x, 0.5, z, 6, 2.6, 2.4, pick(['#e3a913', '#b5486b', '#2f6fa8', '#3f6e3a'], sr(seed + k)), ang); }
          for (let k = 0; k < 12; k++) { const du = (sr(seed + k) - 0.5) * m * 1.6, dv = -m * 0.15 + (sr(seed + k * 2) - 0.5) * 12, [ex, ez] = W(bu + du, bv + dv); put('guarda', G.cone, MT.liso, ex, 2.2, ez, 1.9, 0.7, 1.9, pick(['#c9822e', '#f4efe4', '#9c2f4f', '#e3a913'], sr(seed + k * 5))); put('poste', G.tronco, MT.tronco, ex, 0, ez, 0.06, 2.2, 0.06, '#4a4038', 0, false); }
          for (let k = 0; k < 6; k++) arvUV(bu + (k % 3 - 1) * m * 0.7, bv + (k < 3 ? -m * 0.92 : m * 0.95), seed + k, 0.8, k === 1 ? 'ipe' : 'copa');
          gente(bu, bv, m * 0.85, 45, seed);
          break;
        }
        case 'CONVIVA': {
          if (q.i === 0 && q.j === 0) {                // o coração: praça circular, cobertura, anfiteatro, palmeiras
            const rp = m + 2;
            desenhos.push(g => {
              g.fillStyle = '#e4d9c6'; g.fillRect(bu - rp, bv - rp, 2 * rp, 2 * rp);
              for (let k = 12; k >= 1; k--) { g.fillStyle = k % 2 ? '#dccfb8' : '#e9e0cf'; g.beginPath(); g.arc(bu, bv, rp * k / 12, 0, 6.283); g.fill(); }
              g.fillStyle = '#9c2f4f'; g.beginPath(); g.arc(bu, bv, rp * 0.36, 0, 6.283); g.fill();
              g.fillStyle = '#e9e0cf'; g.beginPath(); g.arc(bu, bv, rp * 0.33, 0, 6.283); g.fill();
              g.fillStyle = '#3d7f93'; g.beginPath(); g.arc(bu, bv, 5.5, 0, 6.283); g.fill();
              g.fillStyle = 'rgba(255,255,255,.5)'; g.beginPath(); g.arc(bu, bv, 2.2, 0, 6.283); g.fill();
              // anfiteatro (degraus em arco)
              for (let k = 0; k < 7; k++) { g.strokeStyle = k % 2 ? '#c9bba1' : '#b9aa8f'; g.lineWidth = 1.6; g.beginPath(); g.arc(bu, bv - rp * 0.62, 6 + k * 1.7, Math.PI * 0.15, Math.PI * 0.85); g.stroke(); }
              // canteiros
              for (let k = 0; k < 8; k++) { const a = k / 8 * 6.283 + 0.39; g.fillStyle = '#7f9e55'; g.beginPath(); g.arc(bu + Math.cos(a) * rp * 0.72, bv + Math.sin(a) * rp * 0.72, 4.5, 0, 6.283); g.fill(); }
            });
            const [x, z] = W(bu, bv), rc = Math.min(24, rp * 0.5);
            put('cobertura', G.cil, MT.liso, x, 8, z, rc, 0.9, rc, '#f2ece2', 0);
            put('cobertura', G.cil, MT.liso, x, 7.6, z, rc + 0.4, 0.45, rc + 0.4, '#9c2f4f', 0);
            for (let k = 0; k < 12; k++) { const a = k / 12 * 6.283; put('poste', G.tronco, MT.liso, x + Math.cos(a) * rc * 0.78, 0, z + Math.sin(a) * rc * 0.78, 0.45, 7.6, 0.45, '#efe8dc'); }
            const np = Math.floor(2 * Math.PI * rp * 0.9 / 11);
            for (let k = 0; k < np; k++) { const a = k / np * 6.283; arvUV(bu + Math.cos(a) * rp * 0.9, bv + Math.sin(a) * rp * 0.9, seed + k, 0.95, 'palmeira'); }
            for (let k = 0; k < 8; k++) { const a = k / 8 * 6.283 + 0.39; arvUV(bu + Math.cos(a) * rp * 0.72, bv + Math.sin(a) * rp * 0.72, seed * 2 + k, 1, 'ipe'); }
            gente(bu, bv, rp * 0.85, 110, seed);
            gente(bu, bv - rp * 0.62, 12, 30, seed + 99);
          } else {                                     // centro comunitário, creche, ateliês
            ret('#ddd0b9', 0, 0, 2 * m + 4, 2 * m + 4);
            ret('#83a05a', m * 0.35, -m * 0.3, m * 1.1, m * 1.1);
            predio('resT', bu - m * 0.45, bv + m * 0.35, 2 * m * 0.45, 2 * m * 0.4, 9, 0, pick(['#f2e4d6', '#e8c9b4', '#f0d9c0'], r));
            predio('casa', bu + m * 0.45, bv + m * 0.55, 2 * m * 0.4, 16, 6, 0, '#f4ebe0');
            for (let k = 0; k < 7; k++) arvUV(bu + m * 0.35 + (sr(seed + k) - 0.5) * m, bv - m * 0.3 + (sr(seed + k * 2) - 0.5) * m, seed * 3 + k, 1, sr(seed + k * 4) > 0.7 ? 'ipe' : 'copa');
            desenhos.push(g => { g.fillStyle = '#d9b97a'; g.beginPath(); g.arc(bu - m * 0.4, bv - m * 0.45, 8, 0, 6.283); g.fill(); });
            gente(bu, bv, m * 0.8, 22, seed);
          }
          break;
        }
        case 'DIVIRTA': {
          const fw = Math.min(100, 2 * m * 0.9), fd = Math.min(64, 2 * m * 0.62), tipo = r < 0.5 ? 'campo' : r < 0.78 ? 'pista' : 'quadras';
          desenhos.push(g => {
            if (tipo === 'quadras') {
              for (let a = 0; a < 2; a++) for (let b = 0; b < 2; b++) {
                const cx = bu + (a ? 1 : -1) * m * 0.45, cy = bv + (b ? 1 : -1) * m * 0.4;
                g.fillStyle = a === b ? '#3e7f6a' : '#3a6aa1'; g.fillRect(cx - 15, cy - 8.5, 30, 17);
                g.strokeStyle = '#fff'; g.lineWidth = 0.15; g.strokeRect(cx - 14, cy - 7.5, 28, 15); g.beginPath(); g.moveTo(cx, cy - 7.5); g.lineTo(cx, cy + 7.5); g.stroke();
              }
              return;
            }
            if (tipo === 'pista') {
              g.fillStyle = '#b4573c'; rr(g, bu - fw / 2 - 6, bv - fd / 2 - 6, fw + 12, fd + 12, fd / 2 + 6); g.fill();
              g.strokeStyle = 'rgba(255,255,255,.7)'; g.lineWidth = 0.12; for (let k = 1; k < 6; k++) { rr(g, bu - fw / 2 - 6 + k, bv - fd / 2 - 6 + k, fw + 12 - 2 * k, fd + 12 - 2 * k, fd / 2 + 6 - k); g.stroke(); }
            }
            for (let k = 0; k < 10; k++) { g.fillStyle = k % 2 ? '#5f9b45' : '#6aa64e'; g.fillRect(bu - fw / 2 + k * fw / 10, bv - fd / 2, fw / 10, fd); }
            g.strokeStyle = '#fff'; g.lineWidth = 0.2; g.strokeRect(bu - fw / 2 + 1, bv - fd / 2 + 1, fw - 2, fd - 2);
            g.beginPath(); g.moveTo(bu, bv - fd / 2 + 1); g.lineTo(bu, bv + fd / 2 - 1); g.stroke();
            g.beginPath(); g.arc(bu, bv, 9.15, 0, 6.283); g.stroke();
            [-1, 1].forEach(s1 => { g.strokeRect(bu + s1 * (fw / 2 - 1) - (s1 > 0 ? 16.5 : 0), bv - 20, 16.5, 40); });
          });
          if (tipo !== 'quadras') { const [x, z] = W(bu, bv - fd / 2 - (tipo === 'pista' ? 14 : 8)); put('p_liso', G.caixa, MT.liso, x, 0, z, fw * 0.5, 4, 6, '#e8e2d6', ang); put('telha', G.caixa, MT.metal, x, 4, z, fw * 0.52, 0.4, 8, '#9c2f4f', ang); }
          gente(bu, bv, Math.min(fw, fd) * 0.4, 22, seed);
          for (let k = 0; k < 10; k++) { const du = (k % 5 - 2) * fw / 4.5, dv = (k < 5 ? -1 : 1) * (m - 2); if (dentroUV(bu + du, bv + dv)) arvUV(bu + du, bv + dv, seed + k, 1); }
          break;
        }
        case 'PARQUE': {
          if (r < 0.22) {                              // playground
            desenhos.push(g => { g.fillStyle = '#e1cf9f'; g.beginPath(); g.arc(bu, bv, 11, 0, 6.283); g.fill(); });
            for (let k = 0; k < 5; k++) { const a = k / 5 * 6.28, [x, z] = W(bu + Math.cos(a) * 6, bv + Math.sin(a) * 6); put('p_liso', G.caixa, MT.liso, x, 0, z, 1.6, 1.8 + sr(seed + k) * 1.5, 1.6, pick(['#d33f3f', '#2e86c1', '#f1c40f', '#27ae60'], sr(seed + k * 2)), ang + a); }
            gente(bu, bv, 10, 18, seed);
          } else if (r < 0.34) {                       // quiosque/café do parque
            const [x, z] = W(bu, bv); put('p_casa', G.caixa, MT.casa, x, 0, z, 9, 3.6, 7, '#efe6d6', ang); put('telha', G.duasAguas, MT.liso, x, 3.6, z, 7.6, 2, 9.6, '#7a3a1c', ang);
            desenhos.push(g => { g.fillStyle = '#ddd0b2'; g.beginPath(); g.arc(bu, bv, 12, 0, 6.283); g.fill(); });
            gente(bu, bv - 4, 9, 14, seed);
          }
          break;
        }
        default: break;
      }
    });

    // ── árvores dos parques: bosques e clareiras pelo ruído, nunca na água nem na rua ──
    e.cel.forEach((c, idx) => {
      if (c.uso !== 'PARQUE' && c.uso !== 'CONTEMPLA') return;
      const cont = c.uso === 'CONTEMPLA', n = Math.round(2.598 * s * s / (cont ? 110 : 190));
      for (let k = 0; k < n; k++) {
        const px = c.x + (sr(idx * 31.7 + k) - 0.5) * 1.75 * s, py = c.y + (sr(idx * 57.3 + k * 1.31) - 0.5) * 1.75 * s;
        const nz = vn(px / 48, py / 48);
        if (!cont && nz < 0.48) continue;
        if (cont && nz < 0.3) continue;
        if (!dentro([px, py], poly) || noLago(px, py, 5) || naRua(px, py, 2)) continue;
        const [qu, qv] = paraUV(px, py), qi = Math.round((qu - cu) / B), qj = Math.round((qv - cvv) / B), q = quadras.get(K(qi, qj));
        if (q && (q.uso === 'DIVIRTA' || (q.uso === 'PARQUE' && sr(q.seed) < 0.34 && Math.hypot(qu - q.bu, qv - q.bv) < 14))) continue;
        const rt = sr(idx * 7 + k * 3);
        arvore(px, py, idx * 100 + k, 0.85 + sr(idx + k * 1.7) * 0.55, cont ? (rt > 0.55 ? 'conifera' : 'copa') : (rt > 0.94 ? 'ipe' : 'copa'));
      }
    });
    // passeio pelo parque linear (eixo) e caminhos entre quadras verdes
    const passeio = [];
    for (let u = umin; u <= umax; u += 6) {
      const v = 7 * Math.sin(u / 70), [x, y] = paraXY(u, v), c = usoEm(x, y);
      passeio.push(c && VERDE.has(c.uso) && dentro([x, y], poly) && !noLago(x, y, 2) ? [u, v] : null);
    }
    passeio.forEach((p, k) => { if (p && k % 9 === 0) gente(p[0], p[1], 3, 3, k * 17); });

    // ── carros, árvores de rua e gente na calçada ──
    ruas.forEach((sg, n) => {
      if (sg.t !== 'rua') return;
      const vert = sg.dir === 'V', L = B, rot = vert ? ang + Math.PI / 2 : ang, aw = sg.larg - 5;
      const em = (t, off) => vert ? paraXY(sg.u0 + off, sg.v0 + t) : paraXY(sg.u0 + t, sg.v0 + off);
      for (let t = 10; t < L - 10; t += 12) {
        const id = n * 97 + t;
        [-1, 1].forEach(lado => {
          const [x, y] = em(t + (sr(id + lado) - 0.5) * 6, lado * aw / 4);
          if (sr(id * 3 + lado) > 0.55 && dentro([x, y], poly)) carro(x, y, rot + (lado > 0 ? Math.PI : 0), id + lado);
          if (!sg.parque && sr(id * 5 + lado) > 0.72) { const [px, py] = em(t + 3, lado * (aw / 2 - 1.1)); if (dentro([px, py], poly)) carro(px, py, rot, id * 7 + lado, true); }
        });
      }
      for (let t = 9; t < L - 8; t += 10) {
        [-1, 1].forEach(lado => {
          const [x, y] = em(t, lado * (sg.larg / 2 - 1.1)), c = usoEm(x, y);
          if (!dentro([x, y], poly) || noLago(x, y, 2)) return;
          if (sg.parque && c && VERDE.has(c.uso)) { if ((t / 10) % 2 < 1) arvore(x, y, n * 50 + t + lado, 0.9, 'palmeira'); return; }
          if (c && !VERDE.has(c.uso)) arvore(x, y, n * 50 + t + lado, 0.62, sr(n + t) > 0.93 ? 'ipe' : 'copa');
          if (sr(n * 13 + t + lado) > 0.6) { const [px, py] = em(t + 4, lado * (sg.larg / 2 - 1.6)); pessoa(px, py, n * 31 + t + lado); }
        });
      }
    });

    // ── chão: uma textura pintada em metros (ruas, calçadas, gramados, lago, sombras de contato) ──
    let minx = Infinity, miny = Infinity, maxx = -Infinity, maxy = -Infinity;
    poly.forEach(p => { minx = Math.min(minx, p[0]); maxx = Math.max(maxx, p[0]); miny = Math.min(miny, p[1]); maxy = Math.max(maxy, p[1]); });
    const Lt = Math.max(maxx - minx, maxy - miny) * 1.02, ox = (minx + maxx) / 2 - Lt / 2, oy = (miny + maxy) / 2 - Lt / 2;
    const T = Math.min(4096, ren.capabilities.maxTextureSize || 4096), k = T / Lt;
    const cvT = document.createElement('canvas'); cvT.width = cvT.height = T; const g = cvT.getContext('2d');
    const XY = () => g.setTransform(k, 0, 0, -k, -k * ox, k * (oy + Lt));
    const UV = () => g.setTransform(k * ux, -k * uy, -k * uy, -k * ux, -k * ox, k * (oy + Lt));
    const px1 = 1 / k;                                   // 1 pixel em metros
    XY(); g.beginPath(); poly.forEach((p, i) => i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1])); g.closePath(); g.clip();
    g.fillStyle = '#5e7a3b'; g.fillRect(minx - 10, miny - 10, maxx - minx + 20, maxy - miny + 20);
    // manchas de gramado (variação natural)
    for (let i = 0; i < 260; i++) {
      const x = minx + sr(i * 3.1) * (maxx - minx), y = miny + sr(i * 5.3) * (maxy - miny), rr0 = 15 + sr(i * 7.7) * 50;
      const gr = g.createRadialGradient(x, y, 0, x, y, rr0), c0 = pick(['rgba(120,140,80,', 'rgba(78,104,50,', 'rgba(142,140,88,', 'rgba(92,118,60,'], sr(i * 9.1));
      gr.addColorStop(0, c0 + '0.35)'); gr.addColorStop(1, c0 + '0)'); g.fillStyle = gr; g.fillRect(x - rr0, y - rr0, 2 * rr0, 2 * rr0);
    }
    // quadras construídas: piso
    UV();
    const PISO = { HABITACAO: '#b9b2a2', MISTO: '#b8b0a0', CONECTA: '#c2bdb2', PRODUZA: '#9c9b96', ENCONTRA: '#c6bba6', INTEGRA: '#c4b69b', CONVIVA: '#cbbfaa' };
    quadras.forEach(q => { if (q.cheia && PISO[q.uso]) { g.fillStyle = PISO[q.uso]; g.fillRect(q.bu - B / 2, q.bv - B / 2, B, B); } });
    desenhos.forEach(f => { UV(); f(g); });
    // lago
    if (lago) {
      XY();
      const blob = (folga) => { g.beginPath(); for (let a = 0; a <= 64; a++) { const t = a / 64 * 6.2832, r = lago.r(t) + folga; g.lineTo(lago.x + Math.cos(t) * r, lago.y + Math.sin(t) * r); } g.closePath(); };
      blob(6); g.fillStyle = '#cdbb8f'; g.fill();
      blob(2.5); g.fillStyle = '#9db57a'; g.fill();
      blob(0); const gr = g.createRadialGradient(lago.x, lago.y, 0, lago.x, lago.y, lago.r(0)); gr.addColorStop(0, '#24505e'); gr.addColorStop(1, '#4f8a8f'); g.fillStyle = gr; g.fill();
    }
    // caminhos (saibro) entre verdes e o passeio do eixo
    UV(); g.lineCap = 'round'; g.strokeStyle = '#c9bc98';
    ruas.forEach((sg, n) => {
      if (sg.t !== 'caminho' || sr(n * 1.9) < 0.45) return;
      const mu = (sg.u0 + sg.u1) / 2, mv = (sg.v0 + sg.v1) / 2, o = (sr(n * 3.3) - 0.5) * B * 0.35;
      g.lineWidth = 2.6; g.beginPath(); g.moveTo(sg.u0, sg.v0); g.quadraticCurveTo(mu + (sg.dir === 'V' ? o : 0), mv + (sg.dir === 'H' ? o : 0), sg.u1, sg.v1); g.stroke();
    });
    g.lineWidth = 5; g.strokeStyle = '#d3c6a4'; g.beginPath(); let aberto = false;
    passeio.forEach(p => { if (p) { aberto ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1]); aberto = true; } else aberto = false; }); g.stroke();
    // ruas: calçada → asfalto → sinalização
    g.lineCap = 'square';
    const linha = sg => { g.beginPath(); g.moveTo(sg.u0, sg.v0); g.lineTo(sg.u1, sg.v1); g.stroke(); };
    ruas.forEach(sg => { if (sg.t === 'rua') { g.strokeStyle = '#d5cfc3'; g.lineWidth = sg.larg; linha(sg); } });
    ruas.forEach(sg => { if (sg.t === 'rua') { g.strokeStyle = '#505255'; g.lineWidth = sg.larg - 5; linha(sg); } });
    g.lineCap = 'butt';
    ruas.forEach(sg => {
      if (sg.t !== 'rua') return;
      const vert = sg.dir === 'V', aw = sg.larg - 5, a = 8, Lr = B;
      const P = (t, off) => vert ? [sg.u0 + off, sg.v0 + t] : [sg.u0 + t, sg.v0 + off];
      g.lineWidth = Math.max(0.16, px1); g.setLineDash(sg.parque ? [] : [3, 4]); g.strokeStyle = sg.parque ? '#e3b23c' : 'rgba(255,255,255,.85)';
      [sg.parque ? -0.15 : 0, sg.parque ? 0.15 : null].forEach(off => { if (off === null) return; g.beginPath(); g.moveTo(...P(a + 3, off)); g.lineTo(...P(Lr - a - 3, off)); g.stroke(); });
      g.setLineDash([]); g.fillStyle = 'rgba(255,255,255,.88)';
      [a - 2, Lr - a + 2].forEach(t => { for (let q = -aw / 2 + 0.5; q < aw / 2 - 0.3; q += 1) { const [x, y] = P(t, q); vert ? g.fillRect(x, y - 1.5, 0.5, 3) : g.fillRect(x - 1.5, y, 3, 0.5); } });
    });
    // sombras de contato (prédios e copas), borradas
    const ao = document.createElement('canvas'); ao.width = ao.height = T; const ga = ao.getContext('2d');
    ga.setTransform(k * ux, -k * uy, -k * uy, -k * ux, -k * ox, k * (oy + Lt)); ga.fillStyle = 'rgba(0,0,0,.55)';
    pegadas.forEach(([u, v, w, d]) => ga.fillRect(u - w / 2 - 1, v - d / 2 - 1, w + 2, d + 2));
    ga.setTransform(k, 0, 0, -k, -k * ox, k * (oy + Lt)); ga.fillStyle = 'rgba(0,0,0,.3)';
    copasAO.forEach(([x, y, r]) => { ga.beginPath(); ga.arc(x, y, r * 0.75, 0, 6.283); ga.fill(); });
    g.setTransform(1, 0, 0, 1, 0, 0); g.globalCompositeOperation = 'multiply'; g.globalAlpha = 0.45;
    g.filter = `blur(${Math.max(2, 2.2 * k)}px)`; g.drawImage(ao, 0, 0); g.filter = 'none';
    g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1;
    // granulado fino (asfalto e grama não são lisos)
    const gr0 = document.createElement('canvas'); gr0.width = gr0.height = 256; const gg = gr0.getContext('2d'), id0 = gg.createImageData(256, 256);
    for (let i = 0; i < id0.data.length; i += 4) { const v = 128 + (sr(i * 0.37) - 0.5) * 70; id0.data[i] = id0.data[i + 1] = id0.data[i + 2] = v; id0.data[i + 3] = 255; }
    gg.putImageData(id0, 0, 0);
    g.globalCompositeOperation = 'overlay'; g.globalAlpha = 0.18; g.fillStyle = g.createPattern(gr0, 'repeat'); g.fillRect(0, 0, T, T);
    g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1;

    const texChao = new THREE.CanvasTexture(cvT); texChao.encoding = THREE.sRGBEncoding; texChao.anisotropy = ren.capabilities.getMaxAnisotropy();
    const forma = new THREE.Shape(poly.map(p => new THREE.Vector2(p[0], p[1])));
    const gChao = new THREE.ShapeGeometry(forma), pc = gChao.attributes.position, uvA = new Float32Array(pc.count * 2);
    for (let i = 0; i < pc.count; i++) { uvA[i * 2] = (pc.getX(i) - ox) / Lt; uvA[i * 2 + 1] = (pc.getY(i) - oy) / Lt; }
    gChao.setAttribute('uv', new THREE.BufferAttribute(uvA, 2)); gChao.rotateX(-Math.PI / 2);
    const chao = new THREE.Mesh(gChao, new THREE.MeshStandardMaterial({ map: texChao, roughness: 0.95, envMapIntensity: 0.35 }));
    chao.position.y = 0.02; chao.receiveShadow = true; cena.add(chao);

    // base da maquete: terra em camadas
    const prof = Math.max(8, R * 0.035);
    let y0 = 0;
    [['#7a5638', 0.5], ['#634329', 0.3], ['#4a301d', 0.2]].forEach(([cor, f]) => {
      const gx = new THREE.ExtrudeGeometry(forma, { depth: prof * f, bevelEnabled: false });
      const mm = new THREE.Mesh(gx, new THREE.MeshStandardMaterial({ color: lin(cor), roughness: 1, envMapIntensity: 0.3 }));
      mm.rotation.x = -Math.PI / 2; mm.position.y = -(y0 + prof * f) - 0.6; mm.castShadow = true; mm.receiveShadow = true; cena.add(mm); y0 += prof * f;
    });
    // água do lago (reflete o céu)
    if (lago) {
      const pts = []; for (let a = 0; a < 64; a++) { const t = a / 64 * 6.2832, r = lago.r(t); pts.push(new THREE.Vector2(lago.x + Math.cos(t) * r, lago.y + Math.sin(t) * r)); }
      const ga2 = new THREE.ShapeGeometry(new THREE.Shape(pts)); ga2.rotateX(-Math.PI / 2);
      const agua = new THREE.Mesh(ga2, new THREE.MeshStandardMaterial({ color: lin('#2b5866'), roughness: 0.06, metalness: 0.25, envMapIntensity: 1.3, transparent: true, opacity: 0.92 }));
      agua.position.y = 0.25; agua.receiveShadow = true; cena.add(agua);
    }
    // entorno: campos e estradas que se dissolvem no papel
    cena.add(entorno(R, ang, prof, e.A));

    // instâncias
    const cor = new THREE.Color(), d = new THREE.Object3D();
    Object.keys(lotes).forEach(ch => {
      const L = lotes[ch]; if (!L.itens.length || !L.itens[0][3]) return;
      const m = new THREE.InstancedMesh(L.geo, L.mat, L.itens.length);
      L.itens.forEach((it, i) => { d.position.set(it[0], it[1], it[2]); d.rotation.set(0, it[7], 0); d.scale.set(it[3], it[4], it[5]); d.updateMatrix(); m.setMatrixAt(i, d.matrix); m.setColorAt(i, cor.set(it[6]).convertSRGBToLinear()); });
      m.castShadow = L.sombra; m.receiveShadow = true; cena.add(m);
    });

    // luz
    cena.add(new THREE.HemisphereLight(tarde ? 0xffd2a8 : 0xdde8ff, 0x4d4336, tarde ? 0.42 : 0.48));
    const sol = new THREE.DirectionalLight(tarde ? 0xffb066 : 0xfff0da, tarde ? 1.25 : 1.35);
    sol.position.set(-R * (tarde ? 1.6 : 0.8), R * (tarde ? 0.55 : 1.35), R * 0.9);
    sol.castShadow = true; sol.shadow.mapSize.set(4096, 4096);
    const sc = sol.shadow.camera; sc.left = -R * 1.5; sc.right = R * 1.5; sc.top = R * 1.5; sc.bottom = -R * 1.5; sc.near = 1; sc.far = R * 8;
    sol.shadow.bias = -0.0004; sol.shadow.normalBias = 0.6; cena.add(sol); cena.add(sol.target);

    return { cena, R, sol, foco: new THREE.Vector3(cv.x, 0, -cv.y), B, ang };
  }

  function rr(g, x, y, w, h, r) { r = Math.min(r, w / 2, h / 2); g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }

  // campos, cerrado e estradas em volta — some num degradê para o papel da prancha
  function entorno(R, ang, prof, A) {
    const T = 2048, Lc = R * 9, k = T / Lc, cv = document.createElement('canvas'); cv.width = cv.height = T; const g = cv.getContext('2d');
    g.translate(T / 2, T / 2); g.rotate(-ang); g.scale(k, k);
    const cel = Math.max(120, R * 0.35);
    for (let i = -16; i <= 16; i++) for (let j = -16; j <= 16; j++) {
      const r = sr(i * 31.7 + j * 7.3 + A % 97);
      g.fillStyle = pick(['#b3b08f', '#a8ab86', '#bdb497', '#a2a683', '#c4baa0', '#9aa07f', '#b5ad8f', '#929b78'], r);
      const w = cel * (r > 0.5 ? 1 : 0.5), x = i * cel, y = j * cel;
      g.fillRect(x + 2, y + 2, w - 4, cel - 4); if (r <= 0.5) { g.fillStyle = pick(['#a9ad80', '#c2b28c', '#93a06e'], sr(r * 9)); g.fillRect(x + w + 2, y + 2, w - 4, cel - 4); }
      if (r > 0.86) { g.fillStyle = 'rgba(90,110,70,.25)'; g.beginPath(); g.arc(x + cel / 2, y + cel / 2, cel * 0.35, 0, 6.283); g.fill(); }
    }
    g.strokeStyle = '#c9bfa6'; g.lineWidth = 6; for (let i = -16; i <= 16; i += 4) { g.beginPath(); g.moveTo(i * cel, -Lc); g.lineTo(i * cel, Lc); g.stroke(); g.beginPath(); g.moveTo(-Lc, i * cel); g.lineTo(Lc, i * cel); g.stroke(); }
    g.strokeStyle = '#8d8c88'; g.lineWidth = 16; g.beginPath(); g.moveTo(-Lc, -R * 1.25); g.lineTo(Lc, -R * 1.25); g.stroke();
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.globalCompositeOperation = 'destination-in';
    const gr = g.createRadialGradient(T / 2, T / 2, T * 0.08, T / 2, T / 2, T * 0.27); gr.addColorStop(0, 'rgba(0,0,0,.8)'); gr.addColorStop(0.5, 'rgba(0,0,0,.4)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = gr; g.fillRect(0, 0, T, T);
    const t = new THREE.CanvasTexture(cv); t.encoding = THREE.sRGBEncoding;
    const m = new THREE.Mesh(new THREE.PlaneGeometry(Lc, Lc), new THREE.MeshStandardMaterial({ map: t, transparent: true, roughness: 1, envMapIntensity: 0.3, depthWrite: false }));
    m.rotation.x = -Math.PI / 2; m.position.y = -prof - 0.3; m.receiveShadow = true; m.renderOrder = -1;
    return m;
  }

  window.CIReal = { montar };
})();
