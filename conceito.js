/* Ateliê de conceito — transforma o estudo do Laboratório numa ILUSTRAÇÃO no estilo
   das pranchas do livro "Cidade Interativa": o terreno vira uma ilha-diorama com borda
   de terra, cada núcleo ganha a sua arquitetura, e um passe de aquarela (contorno a
   nanquim, pigmento granulado, papel) dá o acabamento. Depois monta a PRANCHA: título,
   ilustração, planta, legenda, números, norte e o aviso de estudo conceitual.
   Tudo no navegador, sem IA paga: Three.js + canvas 2D.

   Dois estilos: 'real' (padrão — maquete realista de conceito-real.js, com quadro de detalhe
   da praça do CONVIVA) e 'aquarela' (a ilha-diorama pintada, como nas pranchas do livro).

   Uso: CIConceito.gerar(estudo, ctx, { vista: 0..3, luz: 'dia'|'tarde', estilo }) -> Promise<{ ilustracao, prancha }>
        (ctx = { NUC, USO, corDe, nomeDe, H, fmt, fmtHa, pct }) — dataURLs PNG. */
(function () {
  'use strict';
  const W = 1600, Hh = 1100;               // resolução da ilustração
  const PW = 2400, PH = 1600;              // prancha (paisagem)
  let ren = null;

  // aleatório determinístico: a mesma maquete toda vez para o mesmo terreno
  const sr = i => { const x = Math.sin(i * 12.9898 + 78.233) * 43758.5453; return x - Math.floor(x); };

  function renderer() {
    if (ren) return ren;
    const cv = document.createElement('canvas'); cv.width = W; cv.height = Hh;
    ren = new THREE.WebGLRenderer({ canvas: cv, antialias: true, alpha: true, preserveDrawingBuffer: true });
    ren.setPixelRatio(1); ren.setSize(W, Hh, false);
    ren.shadowMap.enabled = true; ren.shadowMap.type = THREE.PCFSoftShadowMap;
    return ren;
  }

  // ── a maquete ─────────────────────────────────────────────────────────────
  function montarCena(e, C, luz) {
    const cena = new THREE.Scene();
    const s = e.s, R = Math.sqrt(e.A / Math.PI);
    const mat = (c, extra) => new THREE.MeshLambertMaterial(Object.assign({ color: new THREE.Color(c) }, extra || {}));

    // ilha: o polígono extrudado, topo em y=0, borda de terra em camadas
    const prof = Math.max(18, R * 0.07);
    const forma = new THREE.Shape(e.polyXY.map(p => new THREE.Vector2(p[0], p[1])));
    const camadas = [['#9b6a43', 0.45], ['#7d5232', 0.35], ['#5e3d24', 0.2]];
    let y0 = 0;
    camadas.forEach(([cor, f], k) => {
      const g = new THREE.ExtrudeGeometry(forma, { depth: prof * f, bevelEnabled: false });
      const m = new THREE.Mesh(g, [mat(k === 0 ? '#d8cba8' : cor), mat(cor)]);
      m.rotation.x = -Math.PI / 2; m.position.y = -(y0 + prof * f); m.receiveShadow = true; m.castShadow = k === 0;
      cena.add(m); y0 += prof * f;
    });

    const caixa = new THREE.BoxGeometry(1, 1, 1); caixa.translate(0, 0.5, 0);
    const cil = new THREE.CylinderGeometry(1, 1, 1, 20); cil.translate(0, 0.5, 0);
    const hex = new THREE.CylinderGeometry(1, 1, 1, 6); hex.translate(0, 0.5, 0);
    const copa = new THREE.IcosahedronGeometry(1, 1);
    const tronco = new THREE.CylinderGeometry(0.12, 0.16, 1, 5); tronco.translate(0, 0.5, 0);
    const cone = new THREE.ConeGeometry(1, 1, 8); cone.translate(0, 0.5, 0);
    const disco = new THREE.CylinderGeometry(1, 1, 0.6, 28);

    // coletores de instâncias (uma InstancedMesh por geometria, com cor por instância)
    const lotes = {};
    const add = (chave, geo, x, y, z, sx, sy, sz, cor, rot = 0, sombra = true) => {
      (lotes[chave] = lotes[chave] || { geo, itens: [], sombra }).itens.push({ x, y, z, sx, sy, sz, cor, rot });
    };
    const arvore = (x, z, i, esc = 1) => {
      const h = (5 + sr(i) * 6) * esc * Math.max(1, s / 30), rc = (3.2 + sr(i + 1) * 2.6) * esc * Math.max(1, s / 30);
      add('tronco', tronco, x, 0, z, 1, h * 0.55, 1, '#6b4a30');
      const verdes = ['#5f8f45', '#6d9b4f', '#4f7d3c', '#7aa65a', '#8fb36b'];
      add('copa', copa, x, h * 0.55 + rc * 0.7, z, rc, rc * 0.9, rc, verdes[Math.floor(sr(i + 2) * verdes.length)]);
    };
    const chao = { PARQUE: '#8fb365', HABITACAO: '#d9c7a2', MISTO: '#d3b892', CONVIVA: '#e6c9a8', CONECTA: '#c3cfd2', INTEGRA: '#c7b780',
                   PRODUZA: '#c4b8a2', ENCONTRA: '#e2cba5', CONTEMPLA: '#7fa85e', DIVIRTA: '#a5c37a' };

    e.cel.forEach((c, i) => {
      const x = c.x, z = -c.y, u = c.uso;
      // lote: hexágono levemente mais baixo que o vizinho — as frestas viram ruas
      add('lote', hex, x, 0, z, s * 0.965, 0.6, s * 0.965, chao[u] || '#e2d6bb', Math.PI / 6, false);
      const r = sr(i), r2 = sr(i + 11), r3 = sr(i + 23);
      if (u === 'HABITACAO') {
        const n = r < 0.55 ? 1 : 2;
        for (let k = 0; k < n; k++) {
          const ox = n === 1 ? 0 : (k ? 0.28 : -0.28) * s, h = 16 + Math.pow(sr(i * 3 + k), 1.5) * 38;
          const cor = ['#f4efe4', '#efe6d3', '#e8dcc4', '#f7f3ea'][Math.floor(sr(i + k) * 4)];
          add('predio', caixa, x + ox, 0.6, z + (k ? 0.12 : -0.12) * s, s * 0.34, h, s * 0.34, cor, r2 * 0.4);
          add('teto', caixa, x + ox, 0.6 + h, z + (k ? 0.12 : -0.12) * s, s * 0.36, 1.2, s * 0.36, '#b9a88c', r2 * 0.4);
        }
        if (r3 > 0.5) arvore(x + s * 0.45, z + s * 0.3, i);
      } else if (u === 'MISTO') {
        add('base', caixa, x, 0.6, z, s * 0.8, 7, s * 0.8, '#c9875a', r * 0.3);
        const h = 10 + r2 * 16;
        add('predio', caixa, x, 7.6, z, s * 0.46, h, s * 0.46, r3 > 0.5 ? '#f1e8d6' : '#e9dcc3', r * 0.3);
        add('teto', caixa, x, 7.6 + h, z, s * 0.48, 1, s * 0.48, '#a9876a', r * 0.3);
      } else if (u === 'PARQUE') {
        const n = 2 + Math.floor(r * 3);
        for (let k = 0; k < n; k++) { const a = sr(i * 7 + k) * 6.283, d = sr(i * 5 + k) * s * 0.55; arvore(x + Math.cos(a) * d, z + Math.sin(a) * d, i * 9 + k); }
      } else if (u === 'CONTEMPLA') {
        const dc = Math.hypot(c.x - e.sem.CONTEMPLA.x, c.y - e.sem.CONTEMPLA.y);
        if (dc < s * 2.2) add('agua', hex, x, 0.2, z, s * 0.95, 0.8, s * 0.95, '#79aab4', Math.PI / 6, false);
        else for (let k = 0; k < 4; k++) { const a = sr(i * 7 + k) * 6.283, d = sr(i * 5 + k) * s * 0.6; arvore(x + Math.cos(a) * d, z + Math.sin(a) * d, i * 13 + k, 1.15); }
      } else if (u === 'CONVIVA') {
        const sd = e.sem.CONVIVA, centro = Math.hypot(c.x - sd.x, c.y - sd.y) < s * 0.5;
        if (centro) {
          add('praca', disco, x, 0.9, z, s * 0.85, 1, s * 0.85, '#f0e6d2', 0, false);
          add('pav', cil, x, 1.2, z, s * 0.45, 9, s * 0.45, '#f6efe2');
          add('telhado', cone, x, 10.2, z, s * 0.55, 7, s * 0.55, '#9c2f4f');
        } else if (r < 0.5) {
          add('predio', caixa, x, 0.6, z, s * 0.6, 9 + r2 * 6, s * 0.4, '#f2e4d6', r3);
          add('teto', caixa, x, 0.6 + 9 + r2 * 6, z, s * 0.62, 1, s * 0.42, '#b56a5c', r3);
        } else { arvore(x, z, i); arvore(x + s * 0.3, z - s * 0.25, i + 5); }
      } else if (u === 'CONECTA') {
        if (r < 0.7) { add('vidro', caixa, x, 0.6, z, s * 0.7, 12 + r2 * 14, s * 0.5, '#9fbfd4', r3 * 0.5);
                       add('teto', caixa, x, 0.6 + 12 + r2 * 14, z, s * 0.72, 1.2, s * 0.52, '#e9eef0', r3 * 0.5); }
        else arvore(x, z, i);
      } else if (u === 'PRODUZA') {
        add('galpao', caixa, x, 0.6, z, s * 0.88, 10, s * 0.48, '#cdc3b3', 0);
        for (let k = -1; k <= 1; k++) add('serra', cone, x + k * s * 0.28, 10.6, z, s * 0.16, 4, s * 0.24, '#7b8a94', Math.PI / 4);
      } else if (u === 'ENCONTRA') {
        add('praca', disco, x, 0.9, z, s * 0.75, 1, s * 0.75, '#efe0c5', 0, false);
        if (r < 0.6) { add('loja', caixa, x - s * 0.3, 0.6, z, s * 0.3, 6, s * 0.6, ['#7d5ba6', '#c9875a', '#e3a913'][Math.floor(r2 * 3)], 0);
                       add('loja', caixa, x + s * 0.32, 0.6, z, s * 0.28, 5, s * 0.5, '#f1e8d6', 0); }
        else for (let k = 0; k < 5; k++) add('guarda', cone, x + (sr(i + k) - 0.5) * s, 1.2, z + (sr(i + k + 3) - 0.5) * s, 2.2, 3.2, 2.2, ['#e3a913', '#b5486b', '#f4efe4'][k % 3]);
      } else if (u === 'DIVIRTA') {
        if (r < 0.65) { add('campo', caixa, x, 0.6, z, s * 1.0, 0.5, s * 0.6, '#5f9a4a', r2 > 0.5 ? Math.PI / 3 : 0, false);
                        add('faixa', caixa, x, 1.15, z, s * 0.02 + 0.6, 0.1, s * 0.6, '#ffffff', r2 > 0.5 ? Math.PI / 3 : 0, false); }
        else { add('arena', cil, x, 0.6, z, s * 0.42, 6, s * 0.42, '#f1e8d6'); add('cupula', copa, x, 6.6, z, s * 0.42, s * 0.18, s * 0.42, '#d39a1c'); }
      } else if (u === 'INTEGRA') {
        for (let k = 0; k < 6; k++) { const px = x + (sr(i + k * 3) - 0.5) * s * 1.1, pz = z + (sr(i + k * 5) - 0.5) * s * 1.1;
          add('guarda', cone, px, 2.6, pz, 2.6, 2.4, 2.6, ['#c9822e', '#f4efe4', '#9c2f4f', '#e3a913'][k % 4]);
          add('poste', tronco, px, 0, pz, 0.6, 2.6, 0.6, '#5a4a3a'); }
        if (r > 0.4) arvore(x, z, i, 0.9);
      }
    });

    const cor = new THREE.Color(), d = new THREE.Object3D();
    Object.values(lotes).forEach(L => {
      const agua = L.itens[0] && L.itens[0].cor === '#79aab4';
      const m = new THREE.InstancedMesh(L.geo, agua ? new THREE.MeshPhongMaterial({ shininess: 80, specular: 0x99bbcc }) : new THREE.MeshLambertMaterial(), L.itens.length);
      L.itens.forEach((it, k) => { d.position.set(it.x, it.y, it.z); d.rotation.set(0, it.rot, 0); d.scale.set(it.sx, it.sy, it.sz); d.updateMatrix(); m.setMatrixAt(k, d.matrix); m.setColorAt(k, cor.set(it.cor)); });
      m.castShadow = L.sombra; m.receiveShadow = true; cena.add(m);
    });

    // luz: manhã clara ou fim de tarde dourado
    const tarde = luz === 'tarde';
    cena.add(new THREE.HemisphereLight(tarde ? 0xffe2b8 : 0xfff6e8, tarde ? 0x6a4a3a : 0x8a7a6a, tarde ? 0.62 : 0.75));
    const sol = new THREE.DirectionalLight(tarde ? 0xffc27a : 0xfff4e0, tarde ? 0.95 : 0.85);
    sol.position.set(-R * (tarde ? 1.6 : 0.9), R * (tarde ? 0.75 : 1.5), R * 0.9);
    sol.castShadow = true; sol.shadow.mapSize.set(2048, 2048);
    const sc = sol.shadow.camera; sc.left = -R * 1.4; sc.right = R * 1.4; sc.top = R * 1.4; sc.bottom = -R * 1.4; sc.near = 1; sc.far = R * 6;
    sol.shadow.bias = -0.0008; cena.add(sol);
    return { cena, R };
  }

  // ── aquarela: contorno a nanquim + granulação + leve deslocamento do pigmento ──
  const AQUARELA = {
    uniforms: { tDiffuse: { value: null }, res: { value: new THREE.Vector2(W, Hh) }, seed: { value: 0 } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv=uv; gl_Position=vec4(position.xy,0.,1.); }',
    fragmentShader: `
      uniform sampler2D tDiffuse; uniform vec2 res; uniform float seed; varying vec2 vUv;
      float h(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7))+seed)*43758.5453); }
      float n(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.-2.*f);
        return mix(mix(h(i),h(i+vec2(1,0)),f.x), mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x), f.y); }
      float lum(vec4 c){ return dot(c.rgb, vec3(.299,.587,.114)); }
      void main(){
        vec2 px = 1./res;
        // o pigmento escorre: desloca a amostra com ruído de baixa frequência
        vec2 w = vec2(n(vUv*res/38.), n(vUv*res/38.+17.)) - .5;
        vec2 uv = vUv + w*px*3.2;
        vec4 c = texture2D(tDiffuse, uv);
        // borrão leve (mistura de tinta)
        vec4 b = (texture2D(tDiffuse, uv+vec2(px.x,0.))+texture2D(tDiffuse, uv-vec2(px.x,0.))+texture2D(tDiffuse, uv+vec2(0.,px.y))+texture2D(tDiffuse, uv-vec2(0.,px.y)))*.25;
        c = mix(c, b, .45);
        // contorno a nanquim (Sobel na luminância), com espessura que varia
        float tl=lum(texture2D(tDiffuse,uv+px*vec2(-1,1))), t=lum(texture2D(tDiffuse,uv+px*vec2(0,1))), tr=lum(texture2D(tDiffuse,uv+px*vec2(1,1)));
        float l=lum(texture2D(tDiffuse,uv+px*vec2(-1,0))), r=lum(texture2D(tDiffuse,uv+px*vec2(1,0)));
        float bl=lum(texture2D(tDiffuse,uv+px*vec2(-1,-1))), bo=lum(texture2D(tDiffuse,uv+px*vec2(0,-1))), br=lum(texture2D(tDiffuse,uv+px*vec2(1,-1)));
        float gx=-tl-2.*l-bl+tr+2.*r+br, gy=-tl-2.*t-tr+bl+2.*bo+br;
        float aresta = smoothstep(.08, .38, sqrt(gx*gx+gy*gy)) * (.55+.45*n(vUv*res/6.));
        // alfa também tem borda: a silhueta da ilha ganha traço
        float a = c.a; float ab = abs(texture2D(tDiffuse,uv+vec2(px.x*1.5,0.)).a - texture2D(tDiffuse,uv-vec2(px.x*1.5,0.)).a) + abs(texture2D(tDiffuse,uv+vec2(0.,px.y*1.5)).a - texture2D(tDiffuse,uv-vec2(0.,px.y*1.5)).a);
        aresta = max(aresta, clamp(ab,0.,1.)*.9);
        vec3 col = c.rgb;
        // paleta quente de aquarela: um pouco menos saturada, sombras puxando para o sépia
        float L = lum(vec4(col,1.));
        col = mix(vec3(L), col, 1.12);
        col = mix(col, col*vec3(1.05,.97,.86), smoothstep(.55,.1,L)*.5);
        // granulação do pigmento + acúmulo nas bordas das manchas
        float g = n(vUv*res/2.3)*.6 + n(vUv*res/9.)*.4;
        col *= .9 + .16*g;
        col = mix(col, vec3(.23,.15,.08), aresta*.5);
        // o papel "aparece" nas áreas muito claras
        col = mix(col, vec3(.96,.93,.87), smoothstep(.9,.99,L)*.3);
        gl_FragColor = vec4(col, max(a, aresta*a*1.0));
      }`
  };

  function renderizar(e, C, opts) {
    const r = renderer();
    const { cena, R } = montarCena(e, C, opts.luz);
    const az = [-0.72, 0.85, 2.4, -2.3][opts.vista % 4];      // quatro esquinas da ilha
    const dist = R * 3.25, alt = R * 2.05;
    const cam = new THREE.PerspectiveCamera(27, W / Hh, R * 0.1, R * 14);
    cam.position.set(Math.sin(az) * dist, alt, Math.cos(az) * dist);
    cam.lookAt(0, -R * 0.12, 0);
    // 1) cena num alvo de textura (fundo transparente)
    const alvo = new THREE.WebGLRenderTarget(W, Hh, { format: THREE.RGBAFormat });
    r.setRenderTarget(alvo); r.setClearColor(0x000000, 0); r.clear(); r.render(cena, cam);
    // 2) passe de aquarela na tela
    const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.ShaderMaterial(Object.assign({}, AQUARELA, {
      uniforms: { tDiffuse: { value: alvo.texture }, res: { value: new THREE.Vector2(W, Hh) }, seed: { value: opts.vista * 3.1 } }, transparent: true })));
    const pos = new THREE.Scene(); pos.add(quad);
    r.setRenderTarget(null); r.setClearColor(0x000000, 0); r.clear(); r.render(pos, new THREE.Camera());
    const url = r.domElement.toDataURL('image/png');
    // planta (vista de cima, sem aquarela pesada) para o inset da prancha
    const ortho = new THREE.OrthographicCamera(-R * 1.25, R * 1.25, R * 1.25 * Hh / W, -R * 1.25 * Hh / W, 1, R * 10);
    ortho.position.set(0, R * 4, 0.001); ortho.lookAt(0, 0, 0);
    r.setRenderTarget(alvo); r.setClearColor(0x000000, 0); r.clear(); r.render(cena, ortho);
    r.setRenderTarget(null); r.clear(); r.render(pos, new THREE.Camera());
    const planta = r.domElement.toDataURL('image/png');
    alvo.dispose(); cena.traverse(o => { if (o.geometry) o.geometry.dispose(); if (o.material) [].concat(o.material).forEach(m => m.dispose()); });
    return { url, planta, az };
  }

  // ── estilo realista: render direto em sRGB com tone mapping de cinema ─────────
  function renderizarReal(e, C, opts) {
    const r = renderer();
    const enc = r.outputEncoding, tm = r.toneMapping, ex = r.toneMappingExposure;
    r.outputEncoding = THREE.sRGBEncoding; r.toneMapping = THREE.ACESFilmicToneMapping; r.toneMappingExposure = opts.luz === 'tarde' ? 0.8 : 0.78;
    const { cena, R, sol, foco } = CIReal.montar(e, C, opts.luz, r);
    const az = [-0.72, 0.85, 2.4, -2.3][opts.vista % 4];
    const tiro = (cam) => { r.setRenderTarget(null); r.setClearColor(0x000000, 0); r.clear(); r.render(cena, cam); return r.domElement.toDataURL('image/png'); };
    // 1) a maquete inteira
    const dist = R * 3.05, alt = R * 1.72;
    const cam = new THREE.PerspectiveCamera(27, W / Hh, R * 0.8, R * 9);
    cam.position.set(Math.sin(az) * dist, alt, Math.cos(az) * dist); cam.lookAt(0, -R * 0.1, 0);
    const url = tiro(cam);
    // 2) planta (de cima)
    const ortho = new THREE.OrthographicCamera(-R * 1.25, R * 1.25, R * 1.25 * Hh / W, -R * 1.25 * Hh / W, 1, R * 10);
    ortho.position.set(0, R * 4, 0.001); ortho.lookAt(0, 0, 0);
    const planta = tiro(ortho);
    // 3) detalhe: o coração CONVIVA de perto, com a sombra concentrada nele
    const dd = Math.max(150, R * 0.3), sc = sol.shadow.camera, dir = sol.position.clone().normalize();
    const camD = new THREE.PerspectiveCamera(32, W / Hh, 4, dd * 12);
    camD.position.set(foco.x + Math.sin(az + 0.35) * dd, dd * 0.5, foco.z + Math.cos(az + 0.35) * dd); camD.lookAt(foco.x, 0, foco.z);
    sol.target.position.copy(foco); sol.target.updateMatrixWorld(); sol.position.copy(foco).addScaledVector(dir, R * 3);
    sc.left = sc.bottom = -dd * 1.4; sc.right = sc.top = dd * 1.4; sc.far = R * 8; sc.updateProjectionMatrix();
    const detalhe = tiro(camD);
    cena.traverse(o => { if (o.geometry) o.geometry.dispose(); if (o.material) [].concat(o.material).forEach(m => { if (m.map) m.map.dispose(); m.dispose(); }); });
    r.outputEncoding = enc; r.toneMapping = tm; r.toneMappingExposure = ex;
    return { url, planta, detalhe, az };
  }

  // ── a prancha (canvas 2D, papel e tipografia do livro) ─────────────────────
  const img = src => new Promise((ok, falha) => { const i = new Image(); i.onload = () => ok(i); i.onerror = () => falha(new Error('imagem ' + src)); i.src = src; });

  async function prancha(e, C, il, opts) {
    if (document.fonts && document.fonts.load) { try { await Promise.all(['600 60px Cinzel', '400 30px "Cormorant Garamond"', 'italic 400 30px "Cormorant Garamond"', '500 20px Inter'].map(f => document.fonts.load(f))); } catch (x) {} }
    const cv = document.createElement('canvas'); cv.width = PW; cv.height = PH; const g = cv.getContext('2d');
    // papel
    g.fillStyle = '#f4ecdd'; g.fillRect(0, 0, PW, PH);
    try { const papel = await img('img/papel.webp'); g.globalAlpha = 0.55; g.globalCompositeOperation = 'multiply'; g.drawImage(papel, 0, 0, PW, PH); g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1; } catch (x) {}
    // manchas de aquarela atrás da ilha
    const mancha = (x, y, r, cor, a) => { const gr = g.createRadialGradient(x, y, r * 0.1, x, y, r); gr.addColorStop(0, cor.replace('A', a)); gr.addColorStop(1, cor.replace('A', 0)); g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, 6.283); g.fill(); };
    mancha(1560, 860, 760, 'rgba(143,179,194,A)', 0.30); mancha(1300, 1020, 520, 'rgba(227,169,19,A)', 0.12); mancha(1820, 640, 420, 'rgba(93,122,74,A)', 0.12);
    // skyline do livro no rodapé
    try { const sky = await img('img/papel-skyline.webp'); g.globalAlpha = 0.45; g.globalCompositeOperation = 'multiply'; g.drawImage(sky, 0, PH - 520, PW, 520); g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1; } catch (x) {}
    // ilustração com sombra suave
    const ilu = await img(il.url);
    if (il.detalhe) {
      // realista: o entorno se dissolve no papel por uma máscara oval (sem borda reta)
      const m = document.createElement('canvas'); m.width = W; m.height = Hh; const mg = m.getContext('2d');
      mg.drawImage(ilu, 0, 0); mg.globalCompositeOperation = 'destination-in';
      mg.setTransform(1, 0, 0, Hh / W, 0, 0);
      const gr = mg.createRadialGradient(W / 2, W / 2, W * 0.36, W / 2, W / 2, W * 0.53); gr.addColorStop(0, 'rgba(0,0,0,1)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
      mg.fillStyle = gr; mg.fillRect(0, 0, W, W);
      g.drawImage(m, 760, 140, 1600, 1100);
    } else {
      g.save(); g.shadowColor = 'rgba(59,38,21,.28)'; g.shadowBlur = 50; g.shadowOffsetY = 26;
      g.drawImage(ilu, 760, 210, 1600, 1100); g.restore();
    }
    // ramo de ipê no canto, como na capa
    try { const ipe = await img('img/ipe.webp'); g.drawImage(ipe, PW - 640, -30, 640, 640 * ipe.height / ipe.width); } catch (x) {}

    // cabeçalho
    g.fillStyle = '#8a4320'; g.textBaseline = 'alphabetic';
    g.font = '500 22px Inter'; espacado(g, 'CIDADE INTERATIVA  ·  LABORATÓRIO DO PARQUE', 110, 150, 6);
    g.font = '600 82px Cinzel'; g.fillText('Centralidade', 104, 260); g.fillText('Planejada', 104, 352);
    g.fillStyle = '#6b4a30'; g.font = 'italic 400 34px "Cormorant Garamond"';
    quebra(g, `${e.nucs.length} núcleo(s) vocacional(is) num terreno de ${C.fmtHa(e.A)}, com o CONVIVA no coração e o parque linear no eixo principal.`, 110, 420, 600, 42);

    // números
    const kpi = [[C.fmtHa(e.A), 'área do terreno'], [C.pct(e.em5), 'a 5 min a pé do CONVIVA'], ['~' + C.fmt(e.pop), 'moradores (ordem de grandeza)'], ['~' + C.fmt(e.constr), 'm² construíveis (ordem de grandeza)']];
    kpi.forEach((k, i) => { const x = 110 + (i % 2) * 300, y = 600 + Math.floor(i / 2) * 130;
      g.strokeStyle = 'rgba(59,38,21,.18)'; g.lineWidth = 2; g.beginPath(); g.moveTo(x, y - 52); g.lineTo(x + 260, y - 52); g.stroke();
      g.fillStyle = '#8a4320'; g.font = '600 46px Cinzel'; g.fillText(k[0], x, y);
      g.fillStyle = '#8c6d52'; g.font = '400 19px Inter'; g.fillText(k[1], x, y + 32); });

    // legenda dos núcleos
    g.fillStyle = '#8a4320'; g.font = '500 20px Inter'; espacado(g, 'NÚCLEOS VOCACIONAIS', 110, 900, 5);
    e.nucs.forEach((n, i) => { const y = 950 + i * 50;
      g.fillStyle = C.NUC[n].cor; aquarelaPonto(g, 124, y - 10, 15);
      g.fillStyle = '#3b2615'; g.font = '600 26px Cinzel'; g.fillText(n, 152, y);
      g.fillStyle = '#8c6d52'; g.font = 'italic 400 24px "Cormorant Garamond"'; g.fillText(C.NUC[n].parque, 372, y); });
    // legenda dos usos
    const yU = 950 + e.nucs.length * 50 + 30;
    ['PARQUE', 'MISTO', 'HABITACAO'].forEach((u, i) => { const x = 110, y = yU + i * 34;
      g.fillStyle = C.USO[u].cor; aquarelaPonto(g, x + 12, y - 7, 11);
      g.fillStyle = '#6b4a30'; g.font = '400 20px Inter'; g.fillText(C.USO[u].nome, x + 34, y); });

    // planta (inset) + norte
    const pl = await img(il.planta);
    const iw = 470, ih = iw * Hh / W, ix = PW - 110 - iw, iy = PH - 150 - ih;
    {
      g.save(); g.fillStyle = 'rgba(255,255,255,.35)'; g.strokeStyle = 'rgba(59,38,21,.25)'; g.lineWidth = 2; g.fillRect(ix, iy, iw, ih); g.strokeRect(ix, iy, iw, ih);
      g.drawImage(pl, ix, iy, iw, ih); g.restore();
      g.fillStyle = '#8c6d52'; g.font = '500 16px Inter'; espacado(g, 'PLANTA · 5 MIN A PÉ', ix, iy - 14, 3);
      norte(g, ix + iw - 34, iy + 46, 0);
    }
    // detalhe da praça do CONVIVA (estilo realista)
    if (il.detalhe) {
      const dt = await img(il.detalhe), dw = 480, dh = dw * Hh / W, dx = ix - 40 - dw, dy = PH - 150 - dh;
      g.save(); g.shadowColor = 'rgba(59,38,21,.25)'; g.shadowBlur = 24; g.shadowOffsetY = 10; g.fillStyle = '#fbf7ef'; g.fillRect(dx - 8, dy - 8, dw + 16, dh + 16); g.restore();
      g.drawImage(dt, 0, 0, W, Hh, dx, dy, dw, dh);
      g.fillStyle = '#8c6d52'; g.font = '500 16px Inter'; espacado(g, 'DETALHE · PRAÇA DO CONVIVA', dx, dy - 22, 3);
    }
    // rodapé
    g.fillStyle = '#8c6d52'; g.font = '400 18px Inter';
    g.fillText('Estudo conceitual gerado pelo Laboratório do Parque — não é projeto. Zoneamento, APPs, topografia e legislação municipal não foram considerados.', 110, PH - 70);
    g.textAlign = 'right'; g.fillText(`programacidadeinterativa.com.br  ·  ${new Date().toLocaleDateString('pt-BR')}${opts.protocolo ? '  ·  ' + opts.protocolo : ''}`, PW - 110, PH - 70); g.textAlign = 'left';
    return { png: cv.toDataURL('image/png'), jpg: cv.toDataURL('image/jpeg', 0.9) };
  }
  function espacado(g, t, x, y, esp) { for (const ch of t) { g.fillText(ch, x, y); x += g.measureText(ch).width + esp; } }
  function quebra(g, t, x, y, larg, lh) { let linha = ''; for (const p of t.split(' ')) { const tst = linha ? linha + ' ' + p : p; if (g.measureText(tst).width > larg && linha) { g.fillText(linha, x, y); y += lh; linha = p; } else linha = tst; } if (linha) g.fillText(linha, x, y); }
  function aquarelaPonto(g, x, y, r) { g.save(); g.globalAlpha = 0.85; g.beginPath(); for (let k = 0; k <= 16; k++) { const a = k / 16 * 6.283, rr = r * (0.86 + 0.22 * sr(x + y + k)); g.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); } g.fill(); g.restore(); }
  function norte(g, x, y, ang) {
    g.save(); g.translate(x, y); g.rotate(ang);
    g.fillStyle = '#8a4320'; g.beginPath(); g.moveTo(0, -34); g.lineTo(12, 14); g.lineTo(0, 6); g.lineTo(-12, 14); g.closePath(); g.fill();
    g.rotate(-ang); g.font = '600 20px Cinzel'; g.textAlign = 'center'; g.fillText('N', -Math.sin(ang) * 54, -Math.cos(ang) * 54 + 7); g.restore();
  }

  async function gerar(e, C, opts) {
    opts = Object.assign({ vista: 0, luz: 'dia', estilo: 'real' }, opts || {});
    const il = opts.estilo === 'aquarela' || !window.CIReal ? renderizar(e, C, opts) : renderizarReal(e, C, opts);
    const p = await prancha(e, C, il, opts);
    return { ilustracao: il.url, prancha: p.png, pranchaJpg: p.jpg };
  }
  window.CIConceito = { gerar };
})();
