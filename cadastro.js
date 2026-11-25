/* Cadastro do Cidade Interativa — um formulário só, usado pela landing, pelo
   leitor do livro e pelo laboratório de terreno.
   Grava no cidade-interativa-api (api/servidor.py, POST /api/ci/envio): cada envio
   vira uma linha no Postgres com protocolo — e, quando vem do Laboratório, com o
   ARQUIVO ORIGINAL do terreno. A base é só do programa (Humberto/Eidenai): cada envio
   também vira um e-mail para contato@eidenai.com.br, com o arquivo anexado.

   Uso:  CICadastro.abrir({ motivo: 'livro' | 'terreno' | 'contato', mensagem, terreno: async () => ({...}), aoConcluir: fn(resposta) })
         CICadastro.feito()  -> true se este navegador já se cadastrou */
(function () {
  var CHAVE = 'ci-cadastro-v1';
  function ler() { try { return JSON.parse(localStorage.getItem(CHAVE) || 'null'); } catch (e) { return null; } }
  function gravar(v) { try { localStorage.setItem(CHAVE, JSON.stringify(v)); } catch (e) {} }

  var css = `
  .cic-bg{position:fixed;inset:0;z-index:5000;background:rgba(29,20,12,.55);backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);display:grid;place-items:center;padding:16px;opacity:0;transition:opacity .35s}
  .cic-bg.on{opacity:1}
  .cic{width:min(520px,100%);max-height:calc(100vh - 32px);overflow:auto;background:var(--papel,#f4ecdd);color:var(--tinta,#3b2615);border-radius:14px;border:1px solid var(--linha,rgba(59,38,21,.16));box-shadow:0 40px 90px -30px rgba(0,0,0,.6);padding:30px 28px 26px;transform:translateY(24px) scale(.98);transition:transform .45s cubic-bezier(.2,.8,.2,1);font-family:"Cormorant Garamond",Georgia,serif}
  .cic-bg.on .cic{transform:none}
  .cic h3{font-family:"Cinzel",serif;color:var(--corten,#8a4320);letter-spacing:.08em;font-size:24px;margin:6px 0 6px}
  .cic .k{font-family:"Cinzel",serif;letter-spacing:.38em;font-size:11px;color:var(--corten,#8a4320);text-transform:uppercase}
  .cic p.d{font-size:17px;color:var(--tinta-2,#6b4a30);margin-bottom:16px;line-height:1.45}
  .cic label{display:block;font-family:Inter,system-ui,sans-serif;font-size:12px;letter-spacing:.06em;color:var(--tinta-2,#6b4a30);margin:12px 0 6px}
  .cic input,.cic select{width:100%;font:15px Inter,system-ui,sans-serif;padding:11px 12px;border-radius:8px;border:1px solid var(--linha,rgba(59,38,21,.2));background:color-mix(in srgb,var(--papel,#f4ecdd) 70%,#fff);color:var(--tinta,#3b2615)}
  .cic input:focus,.cic select:focus{outline:2px solid color-mix(in srgb,var(--corten,#8a4320) 50%,transparent);outline-offset:1px}
  .cic .row{display:grid;grid-template-columns:1fr 1fr;gap:12px}
  .cic .lgpd{display:flex;gap:10px;align-items:flex-start;font:13px/1.45 Inter,system-ui,sans-serif;color:var(--tinta-2,#6b4a30);margin-top:16px}
  .cic .lgpd input{width:auto;margin-top:3px}
  .cic .acts{display:flex;gap:10px;justify-content:flex-end;margin-top:20px}
  .cic button{font-family:"Cinzel",serif;letter-spacing:.2em;font-size:12px;padding:13px 20px;border-radius:99px;cursor:pointer;border:1px solid var(--corten,#8a4320)}
  .cic button.p{background:var(--corten,#8a4320);color:#fbf1df}
  .cic button.s{background:transparent;color:var(--corten,#8a4320)}
  .cic button[disabled]{opacity:.55;cursor:wait}
  .cic .msg{font:13px Inter,system-ui,sans-serif;margin-top:12px;min-height:18px}
  .cic .msg.err{color:#b3261e}.cic .msg.ok{color:#2f6b3a}
  @media (max-width:520px){.cic .row{grid-template-columns:1fr}}`;
  var st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);

  var TEXTO = {
    livro:   ['Leia o livro completo', 'Cadastre-se e leia as 64 páginas de “Cidade Interativa” aqui mesmo, no navegador.'],
    terreno: ['Envie seu terreno para a equipe', 'A análise do seu terreno vai junto com o cadastro. A equipe do programa retorna com um estudo inicial.'],
    contato: ['Fale com o programa', 'Deixe seus dados e a equipe do Cidade Interativa entra em contato.']
  };

  function abrir(o) {
    o = o || {};
    var t = TEXTO[o.motivo] || TEXTO.contato, ant = ler() || {};
    var bg = document.createElement('div'); bg.className = 'cic-bg';
    bg.innerHTML = '<form class="cic" role="dialog" aria-modal="true" aria-labelledby="cic-t" novalidate>' +
      '<div class="k">Cidade Interativa</div><h3 id="cic-t"></h3><p class="d"></p>' +
      '<label for="cic-n">Nome</label><input id="cic-n" name="name" autocomplete="name" required maxlength="200">' +
      '<div class="row"><div><label for="cic-e">E-mail</label><input id="cic-e" name="email" type="email" autocomplete="email" maxlength="200"></div>' +
      '<div><label for="cic-f">WhatsApp / telefone</label><input id="cic-f" name="phone" type="tel" autocomplete="tel" maxlength="50"></div></div>' +
      '<div class="row"><div><label for="cic-p">Você é</label><select id="cic-p" name="perfil">' +
      ['Proprietário de terra','Investidor / incorporador','Poder público','Urbanista / arquiteto','Estudante / pesquisador','Outro'].map(function (x) { return '<option>' + x + '</option>'; }).join('') +
      '</select></div><div><label for="cic-c">Cidade / UF</label><input id="cic-c" name="cidade" autocomplete="address-level2" maxlength="120"></div></div>' +
      '<label class="lgpd"><input type="checkbox" id="cic-l" required><span>Autorizo o uso dos meus dados para contato sobre o programa Cidade Interativa, conforme a LGPD. Posso pedir a exclusão a qualquer momento.</span></label>' +
      '<div class="msg" aria-live="polite"></div>' +
      '<div class="acts"><button type="button" class="s">Agora não</button><button type="submit" class="p">Enviar</button></div></form>';
    document.body.appendChild(bg);
    var f = bg.querySelector('form'), msg = bg.querySelector('.msg'), env = bg.querySelector('button.p');
    bg.querySelector('#cic-t').textContent = t[0]; bg.querySelector('.d').textContent = t[1];
    ['name', 'email', 'phone', 'cidade'].forEach(function (k) { if (ant[k]) f.elements[k].value = ant[k]; });
    if (ant.perfil) f.elements.perfil.value = ant.perfil;
    requestAnimationFrame(function () { bg.classList.add('on'); f.elements.name.focus(); });
    function fechar() { bg.classList.remove('on'); setTimeout(function () { bg.remove(); }, 350); document.removeEventListener('keydown', esc); }
    function esc(e) { if (e.key === 'Escape') fechar(); }
    document.addEventListener('keydown', esc);
    bg.addEventListener('click', function (e) { if (e.target === bg) fechar(); });
    bg.querySelector('button.s').onclick = fechar;

    f.onsubmit = function (e) {
      e.preventDefault();
      var d = { name: f.elements.name.value.trim(), email: f.elements.email.value.trim(), phone: f.elements.phone.value.trim(),
                perfil: f.elements.perfil.value, cidade: f.elements.cidade.value.trim() };
      msg.className = 'msg err';
      if (!d.name) { msg.textContent = 'Informe seu nome.'; return; }
      if (!d.email && !d.phone) { msg.textContent = 'Informe e-mail ou telefone.'; return; }
      if (d.email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(d.email)) { msg.textContent = 'E-mail inválido.'; return; }
      if (!bg.querySelector('#cic-l').checked) { msg.textContent = 'É preciso autorizar o contato (LGPD).'; return; }
      // prévia estática (portal.lsc-lab.com/preview/…): não há API — avisa e não grava nada
      if (window.CI_PREVIA) { msg.className = 'msg ok'; msg.textContent = 'Prévia: no site oficial este cadastro é guardado e enviado à Eidenai, e libera o livro completo. Aqui nada é gravado.'; return; }
      env.disabled = true; msg.className = 'msg'; msg.textContent = 'Enviando…';
      var quando = new Date().toISOString();
      Promise.resolve(o.terreno ? o.terreno() : null)
        .then(function (terreno) {
          var corpo = { lead: { name: d.name, email: d.email, phone: d.phone, perfil: d.perfil, cidade: d.cidade, consentimento: true },
                        motivo: o.motivo || 'contato', pagina: location.pathname,
                        mensagem: (o.mensagem || ('Cadastro pelo site — motivo: ' + (o.motivo || 'contato'))).slice(0, 4000) };
          if (terreno) corpo.terreno = terreno;
          return fetch('/api/ci/envio', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(corpo) });
        })
        .then(function (r) { return r.json().catch(function () { return {}; }).then(function (j) { if (!r.ok || !j.ok) throw new Error(j.erro || ('HTTP ' + r.status)); return j; }); })
        .then(function (j) {
          gravar({ name: d.name, email: d.email, phone: d.phone, perfil: d.perfil, cidade: d.cidade, quando: quando, protocolo: j.protocolo, chave: j.chave });
          msg.className = 'msg ok';
          msg.textContent = 'Recebido! Protocolo ' + j.protocolo + (j.arquivo_guardado ? ' — arquivo do terreno guardado.' : '.');
          setTimeout(function () { fechar(); if (o.aoConcluir) o.aoConcluir(j); }, j.arquivo_guardado ? 2600 : 1400);
        })
        .catch(function (err) { env.disabled = false; msg.className = 'msg err'; msg.textContent = 'Não consegui enviar agora (' + err.message + '). Tente de novo em instantes.'; });
    };
  }
  // livro(): a chave que a API exige para servir as páginas além da introdução (null se ainda não há)
  window.CICadastro = { abrir: abrir, feito: function () { return !!ler(); },
    livro: function () { var v = ler(); return v && v.protocolo && v.chave ? { p: v.protocolo, k: v.chave } : null; } };
})();
