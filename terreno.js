/* Laboratório do Parque Interativo — tudo roda no navegador do visitante.
   Lê a poligonal (KMZ/KML/GeoJSON/DXF ou desenho), mede, e monta um estudo
   CONCEITUAL de Centralidade Planejada com as regras do livro "Cidade Interativa":
   CONVIVA sempre presente, parque linear central, malha de 5 minutos, uso misto e
   moradia universal. Nenhum arquivo sai da máquina, a não ser que o visitante
   clique em "Enviar para a equipe" (aí vai pelo cadastro). */
(function () {
  'use strict';
  const $ = id => document.getElementById(id);

  // ── Os 7 núcleos (texto e metas tirados do livro) ─────────────────────────
  const NUC = {
    CONVIVA:   { cor: '#9c2f4f', parque: 'Parque Intergeracional', ancora: 'Complexo Intergeracional + Moradia Assistida + Educação ao Longo da Vida', metas: '+50% idosos ativos · −20% internações · +30% convivência familiar', fixo: true },
    CONECTA:   { cor: '#5b7fa6', parque: 'Parque Tecnológico',      ancora: 'Campus de Inovação + Hub de Startups + Coworking Aberto', metas: '+50 startups em 5 anos · +2.000 empregos qualificados · +30% retenção de egressos' },
    INTEGRA:   { cor: '#c9822e', parque: 'Parque Interativo',       ancora: 'Food Park + Parque Interativo Urbano', metas: '+30% permanência na rua · −20% deslocamento de carro · +15% faturamento local' },
    PRODUZA:   { cor: '#7a3a1c', parque: 'Parque Indústria',        ancora: 'Hub Produtivo + Centro de Inovação Industrial + Mercado de Fornecedores', metas: '+2.000 empregos formais · +100 empresas · −25% tempo trabalho-casa' },
    ENCONTRA:  { cor: '#7d5ba6', parque: 'Parque Consumo e Diversão', ancora: 'High Street Criativa + Praça de Eventos + Mercado Urbano', metas: '+40% permanência · +25% faturamento · +50 eventos/ano' },
    CONTEMPLA: { cor: '#3f6e3a', parque: 'Parque Ecológico',        ancora: 'Parque Ecológico + Centro de Educação Ambiental', metas: '+20% cobertura vegetal · −10 °C sensação térmica · +30% permeabilidade' },
    DIVIRTA:   { cor: '#d39a1c', parque: 'Parque Lazer e Esporte',  ancora: 'Complexo Esportivo + Parque de Lazer Ativo', metas: '+40% praticando atividade física · −15% internações crônicas · +20% uso do espaço público' },
  };
  const USO = {
    PARQUE:    { nome: 'Parque linear e praças', cor: '#8fb36b' },
    MISTO:     { nome: 'Uso misto (térreo ativo)', cor: '#d59a5c' },
    HABITACAO: { nome: 'Moradia universal', cor: '#e6cfa6' },
  };
  // hipóteses do estudo — declaradas na tela, nunca escondidas
  const H = { viario: 0.18, verde: 0.22, verdeContempla: 0.30, ancora: 0.06, ancoraConviva: 0.08, mistoDoResto: 0.40,
              caHab: 2.0, caMisto: 2.5, caAncora: 1.0, m2Unidade: 70, pessoasUnidade: 2.8, raio5: 400, raio10: 800 };

  // ── estado ─────────────────────────────────────────────────────────────────
  let anel = null;            // [[lon,lat],...] sem repetir o primeiro
  let est = null;             // resultado do estudo
  let original = null;        // o File que o visitante subiu (vai inteiro para o banco, se ele enviar)
  let conceito = null;        // { prancha, ilustracao } — a imagem do Ateliê, se o visitante gerou
  const sel = new Set(['CONVIVA']);

  // ── mapa ───────────────────────────────────────────────────────────────────
  const mapa = L.map('mapa', { preferCanvas: true, zoomControl: true }).setView([-18.918, -48.277], 12); // Uberlândia
  const sat = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', { maxZoom: 19, attribution: 'Imagens © Esri' }).addTo(mapa);
  const osm = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '© OpenStreetMap' });
  // imagem do mapa que falhar (502 passageiro do provedor, medido em 07/10) tenta de novo até 2 vezes,
  // em vez de deixar um buraco no mapa e um erro no console do visitante
  [sat, osm].forEach(camada => camada.on('tileerror', ev => {
    const t = ev.tile, n = +(t.dataset.tentativa || 0); if (n >= 2) return;
    t.dataset.tentativa = n + 1; setTimeout(() => { t.src = t.src.split('#')[0] + '#r' + (n + 1); }, 700 * (n + 1));
  }));
  L.control.layers({ 'Satélite': sat, 'Mapa': osm }, null, { position: 'topleft' }).addTo(mapa);
  const camTerreno = L.layerGroup().addTo(mapa), camEstudo = L.layerGroup().addTo(mapa);
  const desenhados = new L.FeatureGroup().addTo(mapa);
  const draw = new L.Draw.Polygon(mapa, { shapeOptions: { color: '#e3a913', weight: 3 }, showArea: false });
  mapa.on(L.Draw.Event.CREATED, e => { desenhados.clearLayers(); original = null; const ll = e.layer.getLatLngs()[0]; definirAnel(ll.map(p => [p.lng, p.lat]), 'desenho no mapa'); });
  $('desenhar').onclick = e => { e.preventDefault(); draw.enable(); msg('msgArq', 'Clique nos vértices da área e feche no primeiro ponto.', ''); };

  // ── leitura de arquivo ─────────────────────────────────────────────────────
  const drop = $('drop'), arq = $('arq');
  drop.onclick = () => arq.click();
  drop.onkeydown = e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); arq.click(); } };
  ['dragenter', 'dragover'].forEach(t => drop.addEventListener(t, e => { e.preventDefault(); drop.classList.add('over'); }));
  ['dragleave', 'drop'].forEach(t => drop.addEventListener(t, e => { e.preventDefault(); drop.classList.remove('over'); }));
  drop.addEventListener('drop', e => { const f = e.dataTransfer.files[0]; if (f) ler(f); });
  arq.onchange = () => { if (arq.files[0]) ler(arq.files[0]); arq.value = ''; };

  function msg(id, t, cls) { const m = $(id); m.textContent = t; m.className = 'msg ' + (cls || ''); }

  async function ler(f) {
    msg('msgArq', 'Lendo ' + f.name + '…', '');
    try {
      const nome = f.name.toLowerCase(); let pts = null;
      if (nome.endsWith('.kmz')) {
        const zip = await JSZip.loadAsync(f);
        const kml = Object.keys(zip.files).find(n => /\.kml$/i.test(n));
        if (!kml) throw new Error('o KMZ não tem nenhum .kml dentro');
        pts = deKml(await zip.files[kml].async('string'));
      } else if (nome.endsWith('.kml')) pts = deKml(await f.text());
      else if (nome.endsWith('.dxf')) pts = deDxf(await f.text());
      else pts = deGeojson(JSON.parse(await f.text()));
      if (!pts) throw new Error('não achei um polígono fechado no arquivo');
      definirAnel(pts, f.name); original = f;
    } catch (err) { msg('msgArq', 'Não consegui ler: ' + err.message + '.', 'err'); }
  }
  const limpa = pts => { pts = pts.filter(p => isFinite(p[0]) && isFinite(p[1])); if (pts.length > 2) { const a = pts[0], b = pts[pts.length - 1]; if (a[0] === b[0] && a[1] === b[1]) pts = pts.slice(0, -1); } return pts.length >= 3 ? pts : null; };
  const maior = aneis => aneis.filter(Boolean).sort((a, b) => Math.abs(areaLL(b)) - Math.abs(areaLL(a)))[0] || null;
  function deKml(txt) {
    const doc = new DOMParser().parseFromString(txt, 'application/xml');
    const nos = [...doc.getElementsByTagName('coordinates')];
    const aneis = nos.map(n => limpa(n.textContent.trim().split(/\s+/).map(t => t.split(',').map(Number)).map(v => [v[0], v[1]])))
      .filter(a => a && geografico(a));
    return maior(aneis);
  }
  function deGeojson(g) {
    const aneis = [];
    const anda = o => { if (!o) return; if (o.type === 'FeatureCollection') o.features.forEach(anda); else if (o.type === 'Feature') anda(o.geometry);
      else if (o.type === 'Polygon') aneis.push(limpa(o.coordinates[0])); else if (o.type === 'MultiPolygon') o.coordinates.forEach(p => aneis.push(limpa(p[0])));
      else if (o.type === 'GeometryCollection') o.geometries.forEach(anda); };
    anda(g);
    const ok = aneis.filter(Boolean);
    if (ok.length && !geografico(ok[0])) throw new Error('o GeoJSON está em coordenadas projetadas — exporte em WGS84 (graus)');
    return maior(ok);
  }
  function deDxf(txt) {
    const dxf = new DxfParser().parseSync(txt);
    const aneis = (dxf.entities || []).filter(e => (e.type === 'LWPOLYLINE' || e.type === 'POLYLINE') && e.vertices && e.vertices.length >= 3)
      .map(e => { const v = e.vertices.map(p => [p.x, p.y]); const fechado = e.shape || e.closed || (v[0][0] === v[v.length - 1][0] && v[0][1] === v[v.length - 1][1]); return fechado ? limpa(v) : null; })
      .filter(Boolean);
    if (!aneis.length) throw new Error('o DXF não tem polilinha fechada (LWPOLYLINE/POLYLINE)');
    const bruto = aneis.sort((a, b) => Math.abs(areaXY(b)) - Math.abs(areaXY(a)))[0];
    if (geografico(bruto)) return bruto;
    const z = $('fuso').value;
    if (!bruto.every(p => p[0] > 100000 && p[0] < 900000 && p[1] > 1000000 && p[1] < 10000000)) throw new Error('as coordenadas do DXF não parecem UTM (metros) nem graus');
    const utm = `+proj=utm +zone=${z} +south +ellps=GRS80 +towgs84=0,0,0 +units=m +no_defs`;
    return bruto.map(p => proj4(utm, 'WGS84', p));
  }
  const geografico = a => a.every(p => p[0] >= -180 && p[0] <= 180 && p[1] >= -90 && p[1] <= 90);

  // ── geometria em metros (projeção local, suficiente para terrenos urbanos) ─
  function proj(ref) { const k = Math.cos(ref[1] * Math.PI / 180); return { para: p => [(p[0] - ref[0]) * 111320 * k, (p[1] - ref[1]) * 110540], de: q => [ref[0] + q[0] / (111320 * k), ref[1] + q[1] / 110540] }; }
  function areaXY(a) { let s = 0; for (let i = 0, j = a.length - 1; i < a.length; j = i++) s += (a[j][0] + a[i][0]) * (a[j][1] - a[i][1]); return s / 2; }
  function areaLL(a) { const P = proj(a[0]); return areaXY(a.map(P.para)); }
  function perim(a) { let s = 0; for (let i = 0; i < a.length; i++) { const p = a[i], q = a[(i + 1) % a.length]; s += Math.hypot(q[0] - p[0], q[1] - p[1]); } return s; }
  function dentro(p, a) { let c = false; for (let i = 0, j = a.length - 1; i < a.length; j = i++) { const xi = a[i][0], yi = a[i][1], xj = a[j][0], yj = a[j][1]; if (((yi > p[1]) !== (yj > p[1])) && (p[0] < (xj - xi) * (p[1] - yi) / (yj - yi) + xi)) c = !c; } return c; }
  function centroide(a) { let x = 0, y = 0, s = 0; for (let i = 0, j = a.length - 1; i < a.length; j = i++) { const f = a[j][0] * a[i][1] - a[i][0] * a[j][1]; x += (a[j][0] + a[i][0]) * f; y += (a[j][1] + a[i][1]) * f; s += f; } s *= 3; return Math.abs(s) < 1e-9 ? a[0] : [x / s, y / s]; }

  // ── terreno definido ────────────────────────────────────────────────────────
  function definirAnel(pts, fonte) {
    anel = pts; est = null; camEstudo.clearLayers(); camTerreno.clearLayers();
    const P = proj(pts[0]), xy = pts.map(P.para), A = Math.abs(areaXY(xy));
    if (A < 2000) { msg('msgArq', 'Área muito pequena (' + fmt(A) + ' m²) para uma centralidade. Confira o arquivo.', 'err'); return; }
    const poly = L.polygon(pts.map(p => [p[1], p[0]]), { color: '#e3a913', weight: 3, fill: false }).addTo(camTerreno);
    mapa.fitBounds(poly.getBounds(), { padding: [30, 30] });
    $('vazio').style.display = 'none';
    msg('msgArq', `${fonte}: ${fmtHa(A)} · perímetro ${fmt(perim(xy))} m`, 'ok');
    sugerir(A);
    $('gerar').disabled = false;
  }
  // quantos núcleos cabem: a escala manda (um núcleo âncora pede massa crítica)
  const capacidade = A => { const ha = A / 1e4; return ha < 5 ? 1 : ha < 15 ? 2 : ha < 40 ? 3 : ha < 100 ? 4 : ha < 250 ? 5 : 7; };
  function sugerir(A) {
    const cap = capacidade(A), ctx = [...document.querySelectorAll('#contexto input:checked')].map(i => i.value);
    sel.clear(); sel.add('CONVIVA');
    for (const n of [...ctx, 'INTEGRA', 'CONTEMPLA', 'DIVIRTA', 'ENCONTRA']) { if (sel.size >= cap) break; sel.add(n); }
    pintaNucs(cap);
  }
  function pintaNucs(cap) {
    const box = $('nucs'); box.innerHTML = '';
    Object.keys(NUC).forEach(k => {
      const l = document.createElement('label'); l.className = 'nuc' + (NUC[k].fixo ? ' fixo' : '');
      l.innerHTML = `<input type="checkbox" ${sel.has(k) ? 'checked' : ''} ${NUC[k].fixo ? 'disabled' : ''}><i style="background:${NUC[k].cor}"></i>${k}`;
      l.querySelector('input').onchange = e => { e.target.checked ? sel.add(k) : sel.delete(k); avisoCap(cap); };
      box.appendChild(l);
    });
    avisoCap(cap);
  }
  function avisoCap(cap) {
    if (!anel) return msg('msgNuc', '', '');
    const n = sel.size;
    msg('msgNuc', n > cap ? `A área comporta bem ${cap} núcleo(s); com ${n}, cada âncora fica pequena demais.` : `${n} núcleo(s) — a área comporta até ${cap}.`, n > cap ? 'err' : '');
  }
  document.querySelectorAll('#contexto input').forEach(i => i.onchange = () => { if (anel) sugerir(Math.abs(areaLL(anel))); });
  pintaNucs(7);

  // ── o estudo ─────────────────────────────────────────────────────────────
  $('gerar').onclick = () => { if (!anel) return; conceito = null; resetAtelie(); try { est = estudar(anel, [...sel]); } catch (err) { msg('msgNuc', 'Não consegui montar o estudo: ' + err.message + '.', 'err'); return; } desenhar(est); relatorio(est); ['bGeo', 'bKml', 'enviar', 'a3d'].forEach(id => $(id).disabled = false); };

  function estudar(pts, nucs) {
    const P = proj(centroide(pts)), poly = pts.map(P.para), A = Math.abs(areaXY(poly));
    // malha hexagonal (~420 células): a "malha de 5 minutos" vira mosaico de quadras
    const s = Math.max(6, Math.sqrt(A / (420 * 2.598))), w = Math.sqrt(3) * s, hh = 1.5 * s;
    let minx = Infinity, miny = Infinity, maxx = -Infinity, maxy = -Infinity; poly.forEach(p => { minx = Math.min(minx, p[0]); maxx = Math.max(maxx, p[0]); miny = Math.min(miny, p[1]); maxy = Math.max(maxy, p[1]); });
    const cel = [];
    for (let r = 0, y = miny; y <= maxy + hh; r++, y += hh) for (let x = minx + (r % 2 ? w / 2 : 0); x <= maxx + w; x += w) if (dentro([x, y], poly)) cel.push({ x, y, uso: null });
    if (cel.length < 12) throw new Error('área estreita demais para a malha');
    const N = cel.length, ac = A / N;
    // eixo principal (PCA) → parque linear central, como pede o livro
    let sxx = 0, syy = 0, sxy = 0; cel.forEach(c => { sxx += c.x * c.x; syy += c.y * c.y; sxy += c.x * c.y; });
    const ang = 0.5 * Math.atan2(2 * sxy, sxx - syy), ux = Math.cos(ang), uy = Math.sin(ang);
    const verde = nucs.includes('CONTEMPLA') ? H.verdeContempla : H.verde, liq = 1 - H.viario;
    const cota = f => Math.round(N * f / liq);
    const livres = () => cel.filter(c => !c.uso);
    const pega = (alvo, n, uso) => livres().sort((a, b) => alvo(a) - alvo(b)).slice(0, n).forEach(c => c.uso = uso);
    pega(c => Math.abs(-uy * c.x + ux * c.y), cota(verde), 'PARQUE');
    // CONVIVA no coração; os outros em volta, distribuídos no anel interno
    const R = Math.sqrt(A / Math.PI) * 0.55, sem = {};
    const perto = (x, y) => livres().sort((a, b) => Math.hypot(a.x - x, a.y - y) - Math.hypot(b.x - x, b.y - y))[0];
    sem.CONVIVA = perto(0, 0);
    const outros = nucs.filter(n => n !== 'CONVIVA');
    outros.forEach((n, i) => { const a = ang + Math.PI / 2 + i * 2 * Math.PI / Math.max(1, outros.length); sem[n] = perto(R * Math.cos(a), R * Math.sin(a)); });
    nucs.forEach(n => { const sd = sem[n]; if (sd) pega(c => Math.hypot(c.x - sd.x, c.y - sd.y), cota(n === 'CONVIVA' ? H.ancoraConviva : H.ancora), n); });
    // resto: uso misto voltado ao parque (fachada ativa), moradia no miolo
    const resto = livres().length, nMisto = Math.round(resto * H.mistoDoResto);
    const dPark = c => Math.min(...cel.filter(k => k.uso === 'PARQUE').map(k => Math.hypot(k.x - c.x, k.y - c.y)).concat([Infinity]));
    livres().map(c => [c, dPark(c)]).sort((a, b) => a[1] - b[1]).forEach(([c], i) => c.uso = i < nMisto ? 'MISTO' : 'HABITACAO');
    // indicadores
    const cont = {}; cel.forEach(c => cont[c.uso] = (cont[c.uso] || 0) + 1);
    const area = u => (cont[u] || 0) * ac * liq;   // área líquida (sem o viário)
    const cv = sem.CONVIVA || { x: 0, y: 0 };
    const em5 = cel.filter(c => Math.hypot(c.x - cv.x, c.y - cv.y) <= H.raio5).length / N, em10 = cel.filter(c => Math.hypot(c.x - cv.x, c.y - cv.y) <= H.raio10).length / N;
    const constr = area('HABITACAO') * H.caHab + area('MISTO') * H.caMisto + nucs.reduce((s, n) => s + area(n) * H.caAncora, 0);
    const unid = (area('HABITACAO') * H.caHab * 0.9 + area('MISTO') * H.caMisto * 0.5) / H.m2Unidade;
    return { A, P: perim(poly), N, s, cel, cont, area, nucs, sem, cv, em5, em10, constr, unid, pop: unid * H.pessoasUnidade, proj: P, polyXY: poly };
  }

  // ── desenho no mapa ──────────────────────────────────────────────────────
  const corDe = u => (NUC[u] ? NUC[u].cor : USO[u].cor);
  const nomeDe = u => (NUC[u] ? `${u} — ${NUC[u].parque}` : USO[u].nome);
  function hexLL(c, P, s) { const v = []; for (let i = 0; i < 6; i++) { const a = Math.PI / 6 + i * Math.PI / 3; v.push(P.de([c.x + s * Math.cos(a), c.y + s * Math.sin(a)])); } return v; }
  function desenhar(e) {
    camEstudo.clearLayers();
    e.cel.forEach(c => L.polygon(hexLL(c, e.proj, e.s * 0.97).map(p => [p[1], p[0]]), { stroke: false, fillColor: corDe(c.uso), fillOpacity: c.uso === 'PARQUE' ? 0.75 : 0.82 })
      .bindTooltip(nomeDe(c.uso), { sticky: true }).addTo(camEstudo));
    const cv = e.proj.de([e.cv.x, e.cv.y]);
    L.circle([cv[1], cv[0]], { radius: H.raio5, color: '#3b2615', weight: 2, dashArray: '6 6', fill: false }).bindTooltip('5 minutos a pé (400 m) a partir do CONVIVA').addTo(camEstudo);
    L.circle([cv[1], cv[0]], { radius: H.raio10, color: '#3b2615', weight: 1, dashArray: '2 8', fill: false }).bindTooltip('10 minutos a pé (800 m)').addTo(camEstudo);
    e.nucs.forEach(n => { const sd = e.sem[n]; if (!sd) return; const p = e.proj.de([sd.x, sd.y]);
      L.marker([p[1], p[0]], { icon: L.divIcon({ className: '', html: `<div style="transform:translate(-50%,-50%);white-space:nowrap;font:600 11px Inter,sans-serif;letter-spacing:.12em;padding:5px 9px;border-radius:99px;background:${NUC[n].cor};color:#fff;box-shadow:0 4px 12px rgba(0,0,0,.35)">${n}</div>` }) }).addTo(camEstudo); });
    const leg = $('legenda'); leg.innerHTML = '';
    [...e.nucs, 'PARQUE', 'MISTO', 'HABITACAO'].forEach(u => { const d = document.createElement('div'); d.innerHTML = `<i style="background:${corDe(u)}"></i>${nomeDe(u)}`; leg.appendChild(d); });
    leg.classList.add('on');
    if ($('vista').classList.contains('em3d')) tres.montar(e);
  }

  // ── relatório ────────────────────────────────────────────────────────────
  const fmt = n => Math.round(n).toLocaleString('pt-BR');
  const fmtHa = m2 => (m2 / 1e4).toLocaleString('pt-BR', { maximumFractionDigits: 2 }) + ' ha';
  const pct = f => Math.round(f * 100) + '%';
  function relatorio(e) {
    $('resultado').classList.add('on');
    $('rTitulo').textContent = `Centralidade com ${e.nucs.length} núcleo(s): ${e.nucs.join(' · ')}`;
    $('kpis').innerHTML = [
      [fmtHa(e.A), 'área do terreno'], [pct(e.em5), 'da área a 5 min a pé do CONVIVA'],
      ['~' + fmt(e.pop), 'moradores (ordem de grandeza)'], ['~' + fmt(e.constr), 'm² construíveis (ordem de grandeza)']
    ].map(k => `<div class="kpi"><div class="v">${k[0]}</div><div class="l">${k[1]}</div></div>`).join('');
    const linhas = [['VIARIO', 'Sistema viário e mobilidade ativa', '#9b8f80', e.A * H.viario],
      ...['PARQUE', ...e.nucs, 'MISTO', 'HABITACAO'].map(u => [u, nomeDe(u), corDe(u), e.area(u)])];
    $('tab').innerHTML = '<tr><th>Uso</th><th style="text-align:right">Área</th><th style="text-align:right">%</th></tr>' +
      linhas.map(l => `<tr><td><i style="background:${l[2]}"></i>${l[1]}${NUC[l[0]] ? `<div style="font-size:12px;color:var(--tinta-3);margin:3px 0 0 16px">Âncora: ${NUC[l[0]].ancora}</div>` : ''}</td><td class="n">${fmt(l[3])} m²</td><td class="n">${pct(l[3] / e.A)}</td></tr>`).join('');
    $('metas').innerHTML = e.nucs.map(n => `<li><b style="color:${NUC[n].cor}">${n}</b> — ${NUC[n].metas}</li>`).join('');
    $('hipoteses').innerHTML = `<b>Estudo conceitual, não é projeto.</b> Hipóteses: viário ${pct(H.viario)} da área; parque linear ${pct(e.nucs.includes('CONTEMPLA') ? H.verdeContempla : H.verde)} no eixo principal do terreno; âncora de cada núcleo ${pct(H.ancora)} (CONVIVA ${pct(H.ancoraConviva)}); do restante, ${pct(H.mistoDoResto)} uso misto. Coeficientes: moradia ${H.caHab}, misto ${H.caMisto}, âncoras ${H.caAncora}; ${H.m2Unidade} m²/unidade e ${H.pessoasUnidade} pessoas/unidade. As metas à direita são as do livro para cada núcleo, não cálculo deste terreno. Zoneamento, APPs, topografia e legislação municipal não foram considerados — é isso que a equipe do programa analisa quando você envia o terreno.`;
    $('resultado').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  // ── exportações ──────────────────────────────────────────────────────────
  function geojson(e) {
    const feats = [{ type: 'Feature', properties: { tipo: 'terreno', area_m2: Math.round(e.A) }, geometry: { type: 'Polygon', coordinates: [[...anel, anel[0]]] } }];
    e.cel.forEach(c => { const v = hexLL(c, e.proj, e.s); feats.push({ type: 'Feature', properties: { tipo: 'celula', uso: c.uso, nome: nomeDe(c.uso), cor: corDe(c.uso) }, geometry: { type: 'Polygon', coordinates: [[...v, v[0]]] } }); });
    return { type: 'FeatureCollection', name: 'cidade-interativa-estudo', features: feats };
  }
  function baixar(nome, txt, tipo) { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([txt], { type: tipo })); a.download = nome; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000); }
  $('bGeo').onclick = () => est && baixar('cidade-interativa-estudo.geojson', JSON.stringify(geojson(est)), 'application/geo+json');
  $('bKml').onclick = () => {
    if (!est) return;
    const abgr = h => 'cc' + h.slice(5, 7) + h.slice(3, 5) + h.slice(1, 3);
    const usos = [...new Set(est.cel.map(c => c.uso))];
    const coords = v => v.map(p => p[0].toFixed(7) + ',' + p[1].toFixed(7) + ',0').join(' ');
    let k = '<?xml version="1.0" encoding="UTF-8"?><kml xmlns="http://www.opengis.net/kml/2.2"><Document><name>Cidade Interativa — estudo conceitual</name>';
    usos.forEach(u => k += `<Style id="${u}"><LineStyle><width>0</width></LineStyle><PolyStyle><color>${abgr(corDe(u))}</color></PolyStyle></Style>`);
    k += `<Placemark><name>Terreno</name><Style><LineStyle><color>ff13a9e3</color><width>3</width></LineStyle><PolyStyle><fill>0</fill></PolyStyle></Style><Polygon><outerBoundaryIs><LinearRing><coordinates>${coords([...anel, anel[0]])}</coordinates></LinearRing></outerBoundaryIs></Polygon></Placemark>`;
    usos.forEach(u => { k += `<Folder><name>${nomeDe(u)}</name>`; est.cel.filter(c => c.uso === u).forEach(c => { const v = hexLL(c, est.proj, est.s); k += `<Placemark><styleUrl>#${u}</styleUrl><Polygon><outerBoundaryIs><LinearRing><coordinates>${coords([...v, v[0]])}</coordinates></LinearRing></outerBoundaryIs></Polygon></Placemark>`; }); k += '</Folder>'; });
    baixar('cidade-interativa-estudo.kml', k + '</Document></kml>', 'application/vnd.google-earth.kml+xml');
  };
  $('enviar').onclick = () => {
    if (!est) return;
    const passo = Math.max(1, Math.ceil(anel.length / 200)), simpl = anel.filter((_, i) => i % passo === 0).map(p => [+p[0].toFixed(6), +p[1].toFixed(6)]);
    const c = est.proj.de([0, 0]);
    const resumo = `Terreno enviado pelo Laboratório do Parque: ${fmtHa(est.A)}, perímetro ${fmt(est.P)} m, centro ${c[1].toFixed(5)}, ${c[0].toFixed(5)}. ` +
      `Núcleos: ${est.nucs.join(', ')}. ${pct(est.em5)} da área a 5 min do CONVIVA. ~${fmt(est.pop)} moradores, ~${fmt(est.constr)} m² construíveis (estudo conceitual).`;
    const estudo = { area_m2: Math.round(est.A), perimetro_m: Math.round(est.P), centro: [+c[0].toFixed(6), +c[1].toFixed(6)], nucleos: est.nucs,
      a_5min: +est.em5.toFixed(3), moradores_ordem: Math.round(est.pop), m2_construiveis_ordem: Math.round(est.constr), poligono: simpl, hipoteses: H,
      fonte: original ? 'arquivo' : 'desenho no mapa' };
    const geo = geojson(est), arq = original, prancha = conceito && conceito.pranchaJpg;
    CICadastro.abrir({ motivo: 'terreno', mensagem: resumo, terreno: () => new Promise((ok, falha) => {
      const t = { geojson: geo, estudo };
      if (prancha) t.prancha_b64 = prancha.split(',')[1];   // JPEG: ~10x menor que o PNG, cabe no limite do envio
      if (!arq) return ok(t);
      if (arq.size > 8 * 1024 * 1024) { t.estudo.arquivo_omitido = 'maior que 8 MB'; return ok(t); }
      const rd = new FileReader();
      rd.onload = () => ok(Object.assign(t, { arquivo_nome: arq.name, arquivo_b64: String(rd.result).split(',')[1] || '' }));
      rd.onerror = () => falha(new Error('não consegui ler o arquivo de novo'));
      rd.readAsDataURL(arq);
    }) });
  };

  // ── maquete 3D ───────────────────────────────────────────────────────────
  const tres = (function () {
    let ren = null, cena, cam, ctl, grupo, rodando = false;
    function iniciar() {
      const cv = $('tres');
      ren = new THREE.WebGLRenderer({ canvas: cv, antialias: true, alpha: true }); ren.setPixelRatio(Math.min(devicePixelRatio, 2));
      cena = new THREE.Scene(); cena.fog = new THREE.Fog(0xe9dcc2, 2000, 9000);
      cam = new THREE.PerspectiveCamera(40, 1, 1, 20000);
      cena.add(new THREE.HemisphereLight(0xfff6e6, 0x8a6a4a, 0.9));
      const sol = new THREE.DirectionalLight(0xffffff, 0.8); sol.position.set(-800, 1400, 600); cena.add(sol);
      ctl = new THREE.OrbitControls(cam, cv); ctl.enableDamping = true; ctl.autoRotate = true; ctl.autoRotateSpeed = 0.6; ctl.maxPolarAngle = Math.PI * 0.47;
      cv.addEventListener('pointerdown', () => ctl.autoRotate = false);
      addEventListener('resize', ajusta);
    }
    function ajusta() { if (!ren) return; const cv = $('tres'), w = cv.clientWidth, h = cv.clientHeight; ren.setSize(w, h, false); cam.aspect = w / h; cam.updateProjectionMatrix(); }
    // altura por uso, com variação determinística (a mesma maquete toda vez)
    const sorteio = i => { const x = Math.sin(i * 12.9898) * 43758.5453; return x - Math.floor(x); };
    const ALT = { HABITACAO: [14, 40], MISTO: [9, 24], PARQUE: [0.6, 0.6] };
    function montar(e) {
      if (!ren) iniciar();
      if (grupo) cena.remove(grupo);
      grupo = new THREE.Group(); cena.add(grupo);
      const chao = new THREE.Shape(e.polyXY.map(p => new THREE.Vector2(p[0], p[1])));
      const base = new THREE.Mesh(new THREE.ShapeGeometry(chao), new THREE.MeshLambertMaterial({ color: 0xcbbd9f, side: THREE.DoubleSide }));
      base.rotation.x = -Math.PI / 2; base.position.y = -0.5; grupo.add(base);
      const porUso = {}; e.cel.forEach((c, i) => (porUso[c.uso] = porUso[c.uso] || []).push([c, i]));
      const dummy = new THREE.Object3D(), r = e.s * 0.86;
      Object.keys(porUso).forEach(u => {
        const lista = porUso[u], geo = new THREE.CylinderGeometry(r, r, 1, 6); geo.translate(0, 0.5, 0);
        const mesh = new THREE.InstancedMesh(geo, new THREE.MeshLambertMaterial({ color: new THREE.Color(corDe(u)) }), lista.length);
        lista.forEach(([c, i], k) => {
          const [a, b] = ALT[u] || [6, 16], h = u === 'PARQUE' ? a : a + (b - a) * sorteio(i);
          dummy.position.set(c.x, 0, -c.y); dummy.scale.set(1, h, 1); dummy.rotation.y = Math.PI / 6; dummy.updateMatrix(); mesh.setMatrixAt(k, dummy.matrix);
        });
        grupo.add(mesh);
        if (u === 'PARQUE') { // árvores
          const tg = new THREE.ConeGeometry(e.s * 0.32, e.s * 0.9, 7); tg.translate(0, e.s * 0.45 + 0.6, 0);
          const arv = new THREE.InstancedMesh(tg, new THREE.MeshLambertMaterial({ color: 0x4f7a3a }), lista.length);
          lista.forEach(([c, i], k) => { dummy.position.set(c.x + (sorteio(i + 7) - 0.5) * r, 0, -c.y + (sorteio(i + 3) - 0.5) * r); dummy.scale.set(1, 0.7 + sorteio(i) * 0.6, 1); dummy.rotation.y = 0; dummy.updateMatrix(); arv.setMatrixAt(k, dummy.matrix); });
          grupo.add(arv);
        }
      });
      // anel dos 5 minutos
      const anel5 = new THREE.Mesh(new THREE.RingGeometry(H.raio5 - 2, H.raio5 + 2, 128), new THREE.MeshBasicMaterial({ color: 0x8a4320, transparent: true, opacity: 0.7, side: THREE.DoubleSide }));
      anel5.rotation.x = -Math.PI / 2; anel5.position.set(e.cv.x, 0.8, -e.cv.y); grupo.add(anel5);
      const raio = Math.sqrt(e.A / Math.PI);
      cam.position.set(raio * 1.9, raio * 1.7, raio * 2.3); ctl.target.set(0, 0, 0); ctl.update();
      ajusta();
      if (!rodando) { rodando = true; (function loop() { requestAnimationFrame(loop); if ($('vista').classList.contains('em3d')) { ctl.update(); ren.render(cena, cam); } })(); }
    }
    return { montar };
  })();
  $('a3d').onclick = () => { if (!est) return; $('vista').classList.add('em3d'); $('a3d').classList.add('on'); $('aMapa').classList.remove('on'); tres.montar(est); };
  $('aMapa').onclick = () => { $('vista').classList.remove('em3d'); $('aMapa').classList.add('on'); $('a3d').classList.remove('on'); setTimeout(() => mapa.invalidateSize(), 50); };

  // ── Ateliê de conceito (conceito.js) ─────────────────────────────────────
  const CTX = { NUC, USO, corDe, nomeDe, H, fmt, fmtHa, pct };
  let vista = 0, luz = 'dia', estilo = 'real';
  function resetAtelie() { $('atelieF').innerHTML = '<div class="atelie-vazio">A prancha aparece aqui.</div>'; ['cVista', 'cLuz', 'cEstilo', 'cBaixar', 'cIlu'].forEach(id => $(id).disabled = true); msg('msgConc', '', ''); }
  async function pintar() {
    if (!est) return;
    const f = $('atelieF'); f.classList.add('gerando'); f.dataset.estilo = estilo; ['cGerar', 'cVista', 'cLuz', 'cEstilo', 'cBaixar', 'cIlu'].forEach(id => $(id).disabled = true);
    await new Promise(r => setTimeout(r, 60));   // deixa o "pintando…" aparecer antes do trabalho pesado
    try {
      const t0 = performance.now();
      conceito = await CIConceito.gerar(est, CTX, { vista, luz, estilo });
      f.innerHTML = ''; const im = new Image(); im.alt = 'Prancha conceito da centralidade planejada'; im.src = conceito.prancha;
      im.onclick = () => window.open().document.write('<title>Prancha</title><body style="margin:0;background:#222"><img style="width:100%" src="' + conceito.prancha + '">');
      f.appendChild(im);
      msg('msgConc', `Prancha pronta em ${((performance.now() - t0) / 1000).toFixed(1)} s. Ela vai junto se você enviar o terreno para a equipe.`, 'ok');
    } catch (err) { msg('msgConc', 'Não consegui pintar a imagem: ' + err.message, 'err'); }
    f.classList.remove('gerando'); ['cGerar', 'cVista', 'cLuz', 'cEstilo', 'cBaixar', 'cIlu'].forEach(id => $(id).disabled = false);
    $('cEstilo').textContent = estilo === 'real' ? 'Estilo aquarela ✎' : 'Estilo realista ◼';
    $('cLuz').textContent = luz === 'dia' ? 'Entardecer ☀︎' : 'Luz do dia ☀︎';
  }
  $('cGerar').onclick = () => { vista = 0; pintar(); };
  $('cVista').onclick = () => { vista = (vista + 1) % 4; pintar(); };
  $('cLuz').onclick = () => { luz = luz === 'dia' ? 'tarde' : 'dia'; pintar(); };
  $('cEstilo').onclick = () => { estilo = estilo === 'real' ? 'aquarela' : 'real'; pintar(); };
  $('cBaixar').onclick = () => { if (conceito) { const a = document.createElement('a'); a.href = conceito.prancha; a.download = 'cidade-interativa-prancha-conceito.png'; a.click(); } };
  $('cIlu').onclick = () => { if (conceito) { const a = document.createElement('a'); a.href = conceito.ilustracao; a.download = 'cidade-interativa-ilustracao.png'; a.click(); } };

  // teste local: ?demo=1 carrega um terreno de exemplo (Zona Sul de Uberlândia)
  const EXEMPLO = [[-48.2705, -18.9655], [-48.2610, -18.9640], [-48.2585, -18.9715], [-48.2655, -18.9770], [-48.2725, -18.9730]];
  const irPara = el => el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  const exemplo = () => { original = null; definirAnel(EXEMPLO, 'terreno de exemplo (Zona Sul de Uberlândia)'); irPara($('gerar')); $('gerar').classList.add('pisca'); };
  $('exemplo').onclick = exemplo;
  $('hExemplo').onclick = exemplo;
  $('hEnviar').onclick = () => { irPara(drop); drop.classList.remove('pisca'); void drop.offsetWidth; drop.classList.add('pisca'); setTimeout(() => arq.click(), 450); };
  $('desenharB').onclick = () => { irPara($('mapa')); $('desenhar').click(); };
  if (/[?&]demo=1/.test(location.search)) definirAnel(EXEMPLO, 'terreno de exemplo');
})();
