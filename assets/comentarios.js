/*!
 * Caixa de comentários — quem usa aponta o que quer mudar na tela e escreve ali.
 * Arquivo único, sem dependências; funciona em React, Vue e HTML simples publicados como artefato
 * do claude.ai.
 *
 *   <script src="comentarios.js"></script>
 *   <script>CaixaDeComentarios.iniciar()</script>
 *
 * Partes da tela com nome: data-comment-target="Cartão 1001 · Empresa Alfa" (o contorno mostra o
 * nome e o comentário guarda). Referência (ex.: número do pedido): data-comment-ref="1001" num
 * elemento em volta. Partes da própria caixa levam data-comentar e nunca são alvo.
 *
 * Onde guarda: no artefato do claude.ai, no banco do artefato (coleção "comentarios"; publique com
 * capabilities { db: {}, user: { scopes: ['profile'] } }); todos que o artefato deixa gravar (ex.:
 * convidados como Editor) veem os mesmos comentários. Fora do claude.ai (preview, arquivo aberto no
 * PC), neste navegador. Para forçar: armazem: 'artefato' ou 'local'.
 */
(function () {
  'use strict';

  var PROPRIO = 'data-comentar';
  var ALVO = 'data-comment-target';
  var REF = 'data-comment-ref';
  var CHAVE_NOME = 'caixa-de-comentarios:meu-nome';
  var MAX_TEXTO = 2000;
  var BLOQUEADOS = ['pointerdown', 'mousedown', 'pointerup', 'mouseup', 'dblclick', 'dragstart', 'contextmenu', 'mousemove', 'mouseover', 'mouseout', 'mouseenter', 'mouseleave', 'pointerover', 'pointerout', 'pointerenter', 'pointerleave', 'focusin', 'focusout'];
  // passar o mouse e o foco: só não chegam à página (não cancela, senão o navegador não foca)
  var SO_PARAR = { mousemove: 1, mouseover: 1, mouseout: 1, mouseenter: 1, mouseleave: 1, pointerover: 1, pointerout: 1, pointerenter: 1, pointerleave: 1, focusin: 1, focusout: 1 };
  var TECLAS_DE_ACAO = { ArrowUp: 1, ArrowDown: 1, ArrowLeft: 1, ArrowRight: 1, Home: 1, End: 1 };

  var TEXTOS = {
    comentar: 'Comentar',
    cancelar: 'Cancelar',
    comentarios: 'Comentários',
    dicaModo: 'Clique no que você quer mudar para deixar um comentário. Esc cancela.',
    comentario: 'Comentário',
    seuNome: 'Seu nome',
    oQueMudar: 'O que você quer mudar aqui?',
    salvar: 'Salvar comentário',
    salvando: 'Salvando…',
    salvo: 'Comentário salvo.',
    erroSalvar: 'Não deu para salvar o comentário agora. Tente de novo.',
    semPermissao: 'Para comentar, entre no claude.ai com o e-mail que foi convidado como Editor.',
    novoComentario: 'Novo comentário',
    quemComentou: 'Quem comentou',
    sobreOQue: 'Sobre o quê',
    exemploQuem: 'Ex.: Ana, da Empresa Alfa',
    exemploSobre: 'Ex.: tela inicial, pedido 1001',
    oQuePessoaQuer: 'O que a pessoa quer mudar?',
    dicaApontar: 'Também dá para apontar na tela: botão Comentar.',
    abertos: 'Abertos',
    resolvidos: 'Resolvidos',
    nenhumAberto: 'Nenhum comentário aberto',
    nenhumResolvido: 'Nenhum comentário resolvido',
    dicaVazio: 'Use o botão Comentar e clique no que você quer mudar.',
    dicaVazioResolvidos: 'Os comentários marcados como resolvidos aparecem aqui.',
    marcarResolvido: 'Marcar como resolvido',
    reabrir: 'Reabrir',
    resolvido: 'resolvido',
    semNome: 'Sem nome',
    fechar: 'Fechar',
    sistemaEmGeral: 'Sistema em geral',
    parteDaTela: 'Parte da tela',
  };

  // ---------------------------------------------------------------- utilidades

  function el(tag, atributos, filhos) {
    var e = document.createElement(tag);
    if (atributos)
      Object.keys(atributos).forEach(function (k) {
        var v = atributos[k];
        if (v === undefined || v === null || v === false) return;
        if (k === 'texto') e.textContent = v;
        else if (k === 'classe') e.className = v;
        else if (k.slice(0, 2) === 'on' && typeof v === 'function') e.addEventListener(k.slice(2), v);
        else e.setAttribute(k, v === true ? '' : String(v));
      });
    (filhos || []).forEach(function (f) {
      if (f) e.appendChild(typeof f === 'string' ? document.createTextNode(f) : f);
    });
    return e;
  }

  function lembrado() {
    try {
      return localStorage.getItem(CHAVE_NOME) || '';
    } catch (e) {
      return '';
    }
  }
  function lembrar(nome) {
    try {
      if (nome && nome.trim()) localStorage.setItem(CHAVE_NOME, nome.trim());
    } catch (e) {
      /* sem localStorage: só não lembra */
    }
  }

  function novoId() {
    return 'cm-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 7);
  }

  function fmtData(iso) {
    var d = new Date(iso);
    if (isNaN(d.getTime())) return iso || '';
    var dd = String(d.getDate()).padStart(2, '0');
    var mm = String(d.getMonth() + 1).padStart(2, '0');
    var hh = String(d.getHours()).padStart(2, '0');
    var mi = String(d.getMinutes()).padStart(2, '0');
    return dd + '/' + mm + (d.getFullYear() !== new Date().getFullYear() ? '/' + d.getFullYear() : '') + ', ' + hh + ':' + mi;
  }

  var daFerramenta = function (alvo) {
    return alvo instanceof Element && !!alvo.closest('[' + PROPRIO + ']');
  };

  /** A parte comentável que contém `alvo`: a marcada mais próxima, senão o próprio elemento (ícones contam como o que os contém). */
  function alvoDe(alvo) {
    if (!alvo || !(alvo instanceof Element) || daFerramenta(alvo)) return null;
    var marcado = alvo.closest('[' + ALVO + ']');
    if (marcado instanceof HTMLElement) return marcado;
    var h = alvo;
    while (h && !(h instanceof HTMLElement)) h = h.parentElement;
    return h === document.body || h === document.documentElement ? null : h;
  }
  function nomeDe(e) {
    var texto = (e.textContent || '').replace(/\s+/g, ' ').trim();
    return e.getAttribute(ALVO) || e.getAttribute('aria-label') || texto.slice(0, 60) || TEXTOS.parteDaTela;
  }
  function referenciaDe(e) {
    var r = e.closest('[' + REF + ']');
    return r ? r.getAttribute(REF) : null;
  }

  // ---------------------------------------------------------------- armazéns

  /** Neste navegador (localStorage). Outras abas do mesmo navegador veem na hora. */
  function armazemLocal(chave) {
    var K = 'caixa-de-comentarios:' + (chave || 'padrao');
    var ler = function () {
      try {
        var l = JSON.parse(localStorage.getItem(K) || '[]');
        return Array.isArray(l) ? l : [];
      } catch (e) {
        return [];
      }
    };
    var memoria = ler();
    var gravar = function (l) {
      memoria = l;
      try {
        localStorage.setItem(K, JSON.stringify(l));
      } catch (e) {
        /* fica só em memória */
      }
    };
    return {
      listar: function () {
        var l = ler();
        return Promise.resolve(l.length || !memoria.length ? l : memoria);
      },
      criar: function (dados) {
        var c = Object.assign({}, dados, { id: novoId() });
        gravar(ler().concat(c));
        return Promise.resolve(c);
      },
      atualizar: function (id, dados) {
        var l = ler();
        var c = l.find(function (x) {
          return x.id === id;
        });
        if (!c) return Promise.reject(new Error('Comentário não encontrado.'));
        Object.assign(c, dados);
        gravar(l);
        return Promise.resolve(c);
      },
      observar: function (aoMudar) {
        var f = function (e) {
          if (e.key === K) aoMudar();
        };
        window.addEventListener('storage', f);
        return function () {
          window.removeEventListener('storage', f);
        };
      },
    };
  }

  /**
   * Banco do artefato do claude.ai (publique com capabilities { db: {}, user: { scopes: ['profile'] } }).
   * Grava quem o artefato deixa gravar (dono, organização, convidados como Editor); quem só vê ou
   * não entrou na conta recebe o aviso de sem permissão. Guarda o id de quem comentou, nunca o nome
   * do perfil: o nome é buscado na hora de mostrar (nomes()).
   */
  function armazemArtefato(colecao) {
    var nomeCol = colecao || 'comentarios';
    var pronto = null;
    var api = function () {
      if (!pronto)
        pronto = Promise.all([window.claude.use('db'), window.claude.use('user')]).then(function (r) {
          if (!r[0]) throw new Error('Sem o banco do artefato (sem login no claude.ai ou sem a capacidade db).');
          return { db: r[0], user: r[1] };
        });
      return pronto;
    };
    var mapa = new Map();
    var ouvintes = new Set();
    var primeira = null; // resolve com a 1ª resposta do banco; depois o mapa fica em dia sozinho
    var assinar = function (a) {
      if (primeira) return primeira;
      primeira = new Promise(function (ok, falhou) {
        a.db
          .collection(nomeCol)
          .limit(1000)
          .onSnapshot(
            function (s) {
              mapa = new Map();
              s.docs.forEach(function (d) {
                if (d.exists) mapa.set(d.id, Object.assign(JSON.parse(JSON.stringify(d.data())), { id: d.id }));
              });
              ok();
              ouvintes.forEach(function (f) {
                f();
              });
            },
            function (e) {
              console.warn('Comentários: o banco do artefato não respondeu.', e);
              falhou(e);
            },
          );
      });
      return primeira;
    };
    return {
      listar: function () {
        return api()
          .then(assinar)
          .then(function () {
            return Array.from(mapa.values());
          });
      },
      criar: function (dados) {
        return api().then(function (a) {
          var c = Object.assign({}, dados, { id: novoId() });
          return a.db
            .doc(nomeCol + '/' + c.id)
            .set(JSON.parse(JSON.stringify(c)))
            .then(function () {
              return c;
            });
        });
      },
      atualizar: function (id, dados) {
        return api().then(function (a) {
          return a.db
            .doc(nomeCol + '/' + id)
            .update(JSON.parse(JSON.stringify(dados)))
            .then(function () {
              return Object.assign({}, mapa.get(id) || { id: id }, dados);
            });
        });
      },
      observar: function (aoMudar) {
        ouvintes.add(aoMudar);
        return function () {
          ouvintes.delete(aoMudar);
        };
      },
      eu: function () {
        return api()
          .then(function (a) {
            if (!a.user) return { id: null, nome: '', podeGravar: null };
            return Promise.all([a.user.me(), a.user.can('data.write')]).then(function (r) {
              return { id: r[0].id || null, nome: r[0].name || '', podeGravar: r[1] };
            });
          })
          .catch(function () {
            return { id: null, nome: '', podeGravar: false };
          });
      },
      /** Nome atual de cada pessoa, pelo id ("" quando o claude.ai não diz). */
      nomes: function (ids) {
        return api()
          .then(function (a) {
            if (!a.user || typeof a.user.profiles !== 'function') return {};
            return a.user.profiles(ids).then(function (ps) {
              var r = {};
              ids.forEach(function (id) {
                r[id] = (ps && ps[id] && ps[id].name) || '';
              });
              return r;
            });
          })
          .catch(function () {
            return {};
          });
      },
    };
  }

  function noClaude() {
    return !!(window.claude && typeof window.claude.use === 'function');
  }

  function criarArmazem(opcao) {
    if (!opcao || opcao === 'auto') return noClaude() ? armazemArtefato() : armazemLocal();
    if (opcao === 'local') return armazemLocal();
    if (opcao === 'artefato') {
      if (!noClaude()) throw new Error('Fora do claude.ai não há banco do artefato. Use armazem: "local" ou deixe automático.');
      return armazemArtefato();
    }
    if (typeof opcao.listar === 'function' && typeof opcao.criar === 'function') return opcao;
    throw new Error('Armazém inválido: use "artefato", "local" ou deixe automático.');
  }

  // ---------------------------------------------------------------- estilos

  var CSS =
    ':root{--cdc-primaria:#163e67;--cdc-escuro:#102d4b;--cdc-destaque:#d9a521;--cdc-fundo:#ffffff;--cdc-fundo-suave:#eef2f6;--cdc-texto:#172b43;--cdc-texto-2:#3d4f63;--cdc-apagado:#5b6b7c;--cdc-linha:#e3e9ef;--cdc-borda-campo:#c8d2dc;--cdc-perigo:#b42318;--cdc-sombra:0 18px 50px rgba(16,45,75,.28)}' +
    '.cdc *{box-sizing:border-box}.cdc{font-family:inherit;font-size:13px;line-height:1.45;color:var(--cdc-texto)}' +
    '.cdc-botoes{position:fixed;z-index:2147483000;display:flex;gap:8px}' +
    '.cdc-botao{display:inline-flex;align-items:center;gap:8px;min-height:40px;padding:0 14px;border:1px solid rgba(255,255,255,.18);border-radius:10px;background:var(--cdc-escuro);color:#fff;font:inherit;font-weight:650;cursor:pointer;box-shadow:0 6px 18px rgba(16,45,75,.25)}' +
    '.cdc-botao:hover{filter:brightness(1.12)}.cdc-botao:focus-visible{outline:2px solid var(--cdc-destaque);outline-offset:2px}' +
    '.cdc-botao[aria-pressed=true]{background:var(--cdc-destaque);color:var(--cdc-escuro)}' +
    '.cdc-contador{min-width:20px;padding:0 6px;border-radius:999px;background:var(--cdc-destaque);color:var(--cdc-escuro);font-size:11px;font-weight:700;line-height:18px;text-align:center}' +
    '.cdc-faixa-fora{position:fixed;top:14px;left:16px;right:16px;z-index:2147483001;display:flex;justify-content:center;pointer-events:none}' +
    '.cdc-faixa{display:flex;align-items:center;gap:12px;padding:8px 8px 8px 14px;border-radius:10px;background:var(--cdc-escuro);color:#fff;box-shadow:var(--cdc-sombra)}' +
    '.cdc-faixa button{pointer-events:auto;min-height:30px;padding:0 12px;border:1px solid rgba(255,255,255,.3);border-radius:8px;background:transparent;color:#fff;font:inherit;font-weight:600;cursor:pointer}' +
    '.cdc-mira{position:fixed;z-index:2147482999;pointer-events:none;border:2px solid var(--cdc-destaque);border-radius:10px;background:rgba(217,165,33,.08)}' +
    '.cdc-mira span{position:absolute;left:0;max-width:320px;padding:2px 8px;border-radius:6px;background:var(--cdc-destaque);color:var(--cdc-escuro);font-size:12px;font-weight:650;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}' +
    '.cdc-caixa{position:fixed;z-index:2147483001;display:flex;flex-direction:column;gap:10px;padding:14px;border:1px solid var(--cdc-linha);border-radius:12px;background:var(--cdc-fundo);box-shadow:var(--cdc-sombra)}' +
    '.cdc-cab{display:flex;align-items:center;gap:8px}.cdc-chip{min-width:0;flex:1;padding:1px 8px;border-radius:6px;background:var(--cdc-fundo-suave);color:var(--cdc-texto-2);font-size:12px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}' +
    '.cdc input[type=text],.cdc textarea{width:100%;min-height:36px;padding:8px 10px;border:1px solid var(--cdc-borda-campo);border-radius:8px;background:var(--cdc-fundo);color:var(--cdc-texto);font:inherit}' +
    '.cdc textarea{min-height:84px;resize:vertical}.cdc input:disabled,.cdc textarea:disabled{background:var(--cdc-fundo-suave)}' +
    '.cdc-acoes{display:flex;align-items:center;justify-content:flex-end;gap:8px}' +
    '.cdc-btn{min-height:34px;padding:0 14px;border-radius:8px;font:inherit;font-weight:600;cursor:pointer}' +
    '.cdc-btn-primario{border:0;background:var(--cdc-primaria);color:#fff}.cdc-btn-primario:disabled{opacity:.5;cursor:default}' +
    '.cdc-btn-contorno{border:1px solid var(--cdc-borda-campo);background:var(--cdc-fundo);color:var(--cdc-primaria)}' +
    '.cdc-erro{color:var(--cdc-perigo);font-size:12px}.cdc-dica{color:var(--cdc-apagado);font-size:12px}' +
    '.cdc-fundo-painel{position:fixed;inset:0;z-index:2147482990;background:rgba(16,45,75,.35)}' +
    '.cdc-painel{position:fixed;top:0;right:0;bottom:0;z-index:2147482991;width:min(560px,100%);display:flex;flex-direction:column;background:var(--cdc-fundo);box-shadow:var(--cdc-sombra)}' +
    '.cdc-painel-cab{display:flex;align-items:center;gap:12px;min-height:56px;padding:0 16px 0 20px;background:var(--cdc-escuro);color:#fff}.cdc-painel-cab h2{flex:1;margin:0;font-size:17px}' +
    '.cdc-painel-cab button{width:32px;height:32px;border:0;border-radius:8px;background:transparent;color:#fff;font-size:20px;cursor:pointer}' +
    '.cdc-corpo{flex:1;overflow:auto;padding:16px 20px 20px;display:flex;flex-direction:column;gap:14px}.cdc-inline .cdc-corpo{padding:0;overflow:visible}' +
    '.cdc-form{display:flex;flex-direction:column;gap:10px;padding:14px;border:1px solid var(--cdc-linha);border-radius:10px;background:var(--cdc-fundo)}' +
    '.cdc-form label{display:flex;flex-direction:column;gap:4px;font-size:12px;font-weight:600;color:var(--cdc-texto-2)}' +
    '.cdc-grade{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:10px}' +
    '.cdc-abas{display:flex;gap:4px;border-bottom:1px solid var(--cdc-linha)}' +
    '.cdc-aba{display:flex;align-items:center;gap:6px;min-height:40px;padding:0 12px;margin-bottom:-1px;border:0;border-bottom:2px solid transparent;background:transparent;color:var(--cdc-apagado);font:inherit;font-weight:600;cursor:pointer}' +
    '.cdc-aba[aria-selected=true]{border-bottom-color:var(--cdc-primaria);color:var(--cdc-texto)}' +
    '.cdc-aba span{padding:0 6px;border-radius:999px;background:var(--cdc-fundo-suave);font-size:11px;font-weight:700;line-height:17px}.cdc-aba[aria-selected=true] span{background:var(--cdc-primaria);color:#fff}' +
    '.cdc-item{display:flex;flex-direction:column;gap:8px;padding:12px 14px;border:1px solid var(--cdc-linha);border-radius:10px;background:var(--cdc-fundo)}' +
    '.cdc-item-cab{display:flex;flex-wrap:wrap;align-items:baseline;gap:8px}.cdc-item-texto{font-size:14px;white-space:pre-wrap;overflow-wrap:anywhere}' +
    '.cdc-item-pe{display:flex;flex-wrap:wrap;align-items:center;gap:8px}.cdc-item-pe .cdc-dica{flex:1;min-width:180px}' +
    '.cdc-vazio{padding:32px;border:1px dashed var(--cdc-borda-campo);border-radius:8px;text-align:center;display:flex;flex-direction:column;gap:6px}' +
    '.cdc-aviso{position:fixed;left:50%;bottom:24px;transform:translateX(-50%);z-index:2147483002;max-width:calc(100vw - 32px);padding:10px 14px;border-radius:10px;background:#e7f5ec;color:#0f6b3a;font-weight:600;box-shadow:var(--cdc-sombra)}' +
    'body.cdc-modo,body.cdc-modo *{cursor:crosshair!important;user-select:none}body.cdc-modo [data-comentar],body.cdc-modo [data-comentar] *{cursor:pointer!important}';

  // ---------------------------------------------------------------- a caixa

  var estado = null;

  function iniciar(opcoes) {
    if (estado) parar();
    opcoes = opcoes || {};
    Object.assign(TEXTOS, opcoes.textos || {});
    var armazem = criarArmazem(opcoes.armazem);
    var s = {
      opcoes: opcoes,
      armazem: armazem,
      comentarios: [],
      eu: null, // { id, nome, podeGravar }
      nomes: {}, // id de quem comentou -> nome atual (artefato)
      buscandoNomes: false,
      ativo: false,
      raiz: el('div', { classe: 'cdc', 'data-comentar': '' }),
      paineis: new Set(), // funções que redesenham painéis abertos/montados
      desligar: [],
    };
    estado = s;
    if (!document.getElementById('cdc-estilo')) document.head.appendChild(el('style', { id: 'cdc-estilo', texto: CSS }));
    if (opcoes.cores) {
      var mapa = { primaria: '--cdc-primaria', escuro: '--cdc-escuro', destaque: '--cdc-destaque' };
      Object.keys(opcoes.cores).forEach(function (k) {
        if (mapa[k]) s.raiz.style.setProperty(mapa[k], opcoes.cores[k]);
      });
    }
    document.body.appendChild(s.raiz);
    if (opcoes.botoes !== false) desenharBotoes(s);
    recarregar(s);
    if (armazem.eu)
      armazem.eu().then(function (p) {
        s.eu = p;
        redesenhar(s);
      });
    else if (typeof opcoes.quem === 'function')
      Promise.resolve(opcoes.quem()).then(function (p) {
        s.eu = p ? { id: p.id || null, nome: p.nome || '', podeGravar: p.podeGravar !== false } : null;
        redesenhar(s);
      });
    if (armazem.observar)
      s.desligar.push(
        armazem.observar(function () {
          recarregar(s);
        }),
      );
    return api;
  }

  function parar() {
    var s = estado;
    if (!s) return;
    sairDoModo(s);
    s.desligar.forEach(function (f) {
      if (typeof f === 'function') f();
    });
    if (s.raiz.parentNode) s.raiz.parentNode.removeChild(s.raiz);
    estado = null;
  }

  function podeComentar(s) {
    return !(s.eu && s.eu.podeGravar === false);
  }

  function recarregar(s) {
    return s.armazem
      .listar()
      .then(function (l) {
        if (estado !== s) return;
        s.comentarios = l || [];
        redesenhar(s);
      })
      .catch(function (e) {
        console.warn('Comentários: não deu para ler.', e);
      });
  }

  /** Busca o nome de quem comentou sem digitar o nome (comentário guarda só o id). */
  function buscarNomes(s) {
    if (!s.armazem.nomes || s.buscandoNomes) return;
    var faltam = [];
    s.comentarios.forEach(function (c) {
      if (!c.pessoa && c.autorId && !(c.autorId in s.nomes) && faltam.indexOf(c.autorId) < 0) faltam.push(c.autorId);
    });
    if (!faltam.length) return;
    s.buscandoNomes = true;
    s.armazem.nomes(faltam).then(function (r) {
      s.buscandoNomes = false;
      if (estado !== s) return;
      faltam.forEach(function (id) {
        s.nomes[id] = (r && r[id]) || '';
      });
      redesenhar(s);
    });
  }

  function redesenhar(s) {
    var n = s.comentarios.filter(function (c) {
      return !c.resolvido;
    }).length;
    if (s.contador) {
      s.contador.textContent = String(n);
      s.contador.hidden = n === 0;
    }
    s.paineis.forEach(function (f) {
      f();
    });
    if (typeof s.opcoes.aoMudar === 'function') s.opcoes.aoMudar(s.comentarios.slice());
  }

  function avisar(s, texto) {
    var a = el('div', { classe: 'cdc-aviso', role: 'status', texto: texto });
    s.raiz.appendChild(a);
    setTimeout(function () {
      if (a.parentNode) a.parentNode.removeChild(a);
    }, 4000);
  }

  function salvarComentario(s, dados) {
    var c = {
      alvo: dados.alvo || TEXTOS.sistemaEmGeral,
      onde: dados.onde || document.title || location.pathname,
      referencia: dados.referencia || null,
      texto: String(dados.texto || '').trim().slice(0, MAX_TEXTO),
      pessoa: (dados.pessoa || '').trim(),
      autorId: s.eu ? s.eu.id : null,
      criadoEm: new Date().toISOString(),
      resolvido: false,
      resolvidoEm: null,
    };
    return s.armazem.criar(c).then(function (salvo) {
      // o banco do artefato pode avisar do novo antes de criar() terminar: não repete
      s.comentarios = s.comentarios
        .filter(function (x) {
          return x.id !== salvo.id;
        })
        .concat(salvo);
      redesenhar(s);
      if (typeof s.opcoes.aoComentar === 'function') s.opcoes.aoComentar(salvo);
      return salvo;
    });
  }

  function resolver(s, id, resolvido) {
    return s.armazem.atualizar(id, { resolvido: resolvido, resolvidoEm: resolvido ? new Date().toISOString() : null }).then(function (c) {
      s.comentarios = s.comentarios.map(function (x) {
        return x.id === id ? Object.assign({}, x, c) : x;
      });
      redesenhar(s);
    });
  }

  // ---------------------------------------------------------------- botões

  function desenharBotoes(s) {
    var pos = s.opcoes.posicao || 'inferior-esquerda';
    var box = el('div', { classe: 'cdc-botoes', 'data-comentar': '' });
    box.style.bottom = '16px';
    box.style[pos === 'inferior-direita' ? 'right' : 'left'] = '16px';
    s.botao = el('button', { type: 'button', classe: 'cdc-botao', 'aria-pressed': 'false', title: 'Comentar: aponte o que você quer mudar' }, [icone(), el('span', { texto: TEXTOS.comentar })]);
    s.botao.addEventListener('click', function () {
      if (s.caixa) fecharCaixa(s);
      if (s.ativo) sairDoModo(s);
      else entrarNoModo(s);
    });
    s.contador = el('span', { classe: 'cdc-contador', hidden: true });
    var ver = el('button', { type: 'button', classe: 'cdc-botao', title: TEXTOS.comentarios }, [el('span', { texto: TEXTOS.comentarios }), s.contador]);
    ver.addEventListener('click', function () {
      abrirPainel();
    });
    box.appendChild(s.botao);
    if (s.opcoes.botaoPainel !== false) box.appendChild(ver);
    s.raiz.appendChild(box);
  }

  function icone() {
    var ns = 'http://www.w3.org/2000/svg';
    var svg = document.createElementNS(ns, 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('width', '18');
    svg.setAttribute('height', '18');
    svg.setAttribute('fill', 'none');
    svg.setAttribute('stroke', 'currentColor');
    svg.setAttribute('stroke-width', '1.8');
    svg.setAttribute('stroke-linecap', 'round');
    svg.setAttribute('stroke-linejoin', 'round');
    svg.setAttribute('aria-hidden', 'true');
    ['M21 11.5a8.5 8.5 0 0 1-12.4 7.6L3 20.5l1.4-5A8.5 8.5 0 1 1 21 11.5z', 'M12.5 8v7M9 11.5h7'].forEach(function (d) {
      var p = document.createElementNS(ns, 'path');
      p.setAttribute('d', d);
      svg.appendChild(p);
    });
    return svg;
  }

  // ---------------------------------------------------------------- modo de apontar

  function entrarNoModo(s) {
    if (s.ativo) return;
    s.ativo = true;
    if (s.botao) {
      s.botao.setAttribute('aria-pressed', 'true');
      s.botao.lastChild.textContent = TEXTOS.cancelar;
    }
    var cancelar = el('button', { type: 'button', texto: TEXTOS.cancelar });
    cancelar.addEventListener('click', function () {
      sairDoModo(s);
      if (s.botao) s.botao.focus();
    });
    s.faixa = el('div', { classe: 'cdc-faixa-fora' }, [el('div', { classe: 'cdc-faixa', role: 'status', 'data-comentar': '' }, [el('span', { texto: TEXTOS.dicaModo }), cancelar])]);
    s.raiz.appendChild(s.faixa);
    s.mira = el('div', { classe: 'cdc-mira', 'aria-hidden': 'true', hidden: true }, [el('span')]);
    s.raiz.appendChild(s.mira);

    var mirarEm = function (alvo) {
      if (!alvo) {
        s.mira.hidden = true;
        return;
      }
      var r = alvo.getBoundingClientRect();
      s.mira.hidden = false;
      s.mira.style.left = r.left - 3 + 'px';
      s.mira.style.top = r.top - 3 + 'px';
      s.mira.style.width = r.width + 6 + 'px';
      s.mira.style.height = r.height + 6 + 'px';
      var rot = s.mira.firstChild;
      rot.textContent = nomeDe(alvo);
      rot.style.top = r.top > 30 ? '-26px' : '100%';
    };
    var pressionado = null;
    var mirar = function (e) {
      mirarEm(alvoDe(document.elementFromPoint(e.clientX, e.clientY)));
      if (!daFerramenta(e.target)) e.stopPropagation();
    };
    var bloquear = function (e) {
      // passar o mouse e o foco não chegam à página (frameworks tiram o "entrou" do "saiu" do botão)
      if (SO_PARAR[e.type]) {
        if (e.type === 'focusin' && !daFerramenta(e.target)) mirarEm(alvoDe(e.target));
        e.stopPropagation();
        return;
      }
      if (daFerramenta(e.target)) return;
      if (e.type === 'pointerdown') pressionado = alvoDe(e.target);
      e.preventDefault();
      e.stopPropagation();
    };
    var clicar = function (e) {
      if (daFerramenta(e.target)) return;
      e.preventDefault();
      e.stopPropagation();
      var alvo = alvoDe(e.target);
      var desceu = pressionado;
      pressionado = null;
      // arrastar (desceu numa parte, subiu em outra) não comenta
      if (alvo && (!desceu || desceu === alvo)) escolher(s, alvo);
    };
    var tecla = function (e) {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        sairDoModo(s);
        return;
      }
      if (daFerramenta(document.activeElement)) return;
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        e.stopPropagation();
        var alvo = alvoDe(document.activeElement);
        if (alvo) escolher(s, alvo);
      } else if (TECLAS_DE_ACAO[e.key]) {
        e.stopPropagation();
      }
    };
    var rolou = function () {
      s.mira.hidden = true;
    };
    var opc = { capture: true };
    window.addEventListener('pointermove', mirar, opc);
    window.addEventListener('click', clicar, opc);
    BLOQUEADOS.forEach(function (t) {
      window.addEventListener(t, bloquear, opc);
    });
    window.addEventListener('keydown', tecla, opc);
    window.addEventListener('scroll', rolou, opc);
    document.body.classList.add('cdc-modo');
    s.sairModo = function () {
      window.removeEventListener('pointermove', mirar, opc);
      window.removeEventListener('click', clicar, opc);
      BLOQUEADOS.forEach(function (t) {
        window.removeEventListener(t, bloquear, opc);
      });
      window.removeEventListener('keydown', tecla, opc);
      window.removeEventListener('scroll', rolou, opc);
      document.body.classList.remove('cdc-modo');
    };
  }

  function sairDoModo(s) {
    if (!s.ativo) return;
    s.ativo = false;
    if (s.sairModo) s.sairModo();
    s.sairModo = null;
    if (s.faixa && s.faixa.parentNode) s.faixa.parentNode.removeChild(s.faixa);
    if (s.mira && s.mira.parentNode) s.mira.parentNode.removeChild(s.mira);
    if (s.botao) {
      s.botao.setAttribute('aria-pressed', 'false');
      s.botao.lastChild.textContent = TEXTOS.comentar;
    }
  }

  /** Depois de escolher, segura cliques por um instante: no duplo clique, o 2º não cai na página. */
  function engolirCliques() {
    var parar = function (e) {
      if (daFerramenta(e.target)) return;
      e.preventDefault();
      e.stopPropagation();
    };
    var tipos = ['click', 'dblclick', 'pointerdown', 'mousedown', 'pointerup', 'mouseup'];
    tipos.forEach(function (t) {
      window.addEventListener(t, parar, true);
    });
    setTimeout(function () {
      tipos.forEach(function (t) {
        window.removeEventListener(t, parar, true);
      });
    }, 450);
  }

  function escolher(s, alvo) {
    sairDoModo(s);
    engolirCliques();
    abrirCaixa(s, { alvo: nomeDe(alvo), referencia: referenciaDe(alvo), rect: alvo.getBoundingClientRect() });
  }

  // ---------------------------------------------------------------- caixa de comentário

  function fecharCaixa(s, voltar) {
    if (s.caixa && s.caixa.parentNode) s.caixa.parentNode.removeChild(s.caixa);
    s.caixa = null;
    if (voltar && s.botao) s.botao.focus();
  }

  function abrirCaixa(s, r) {
    fecharCaixa(s);
    var pode = podeComentar(s);
    var pedeNome = !(s.eu && s.eu.nome);
    var largura = Math.min(380, window.innerWidth - 32);
    var altura = pode ? 250 : 150;
    var left = Math.max(16, Math.min(r.rect.left, window.innerWidth - largura - 16));
    var top = r.rect.bottom + 8 + altura < window.innerHeight ? r.rect.bottom + 8 : Math.max(16, Math.min(r.rect.top - 8 - altura, window.innerHeight - altura - 16));

    var nome = el('input', { type: 'text', 'aria-label': TEXTOS.seuNome, placeholder: TEXTOS.seuNome });
    nome.value = lembrado();
    var texto = el('textarea', { 'aria-label': TEXTOS.comentario, placeholder: TEXTOS.oQueMudar, maxlength: MAX_TEXTO, rows: 4 });
    var erro = el('div', { classe: 'cdc-erro', role: 'alert' });
    var salvar = el('button', { type: 'button', classe: 'cdc-btn cdc-btn-primario', texto: TEXTOS.salvar, disabled: true });
    var cancelar = el('button', { type: 'button', classe: 'cdc-btn cdc-btn-contorno', texto: TEXTOS.cancelar });
    texto.addEventListener('input', function () {
      salvar.disabled = !texto.value.trim();
    });
    cancelar.addEventListener('click', function () {
      fecharCaixa(s, true);
    });
    var enviar = function () {
      if (!texto.value.trim() || salvar.disabled) return;
      salvar.disabled = true;
      salvar.textContent = TEXTOS.salvando;
      erro.textContent = '';
      if (pedeNome) lembrar(nome.value);
      salvarComentario(s, { alvo: r.alvo, referencia: r.referencia, texto: texto.value, pessoa: pedeNome ? nome.value : '' }).then(
        function () {
          fecharCaixa(s, true);
          avisar(s, TEXTOS.salvo);
        },
        function (e) {
          console.warn('Comentários: não salvou.', e);
          erro.textContent = TEXTOS.erroSalvar;
          salvar.disabled = false;
          salvar.textContent = TEXTOS.salvar;
        },
      );
    };
    salvar.addEventListener('click', enviar);

    var filhos = [el('div', { classe: 'cdc-cab' }, [icone(), el('b', { texto: TEXTOS.comentario }), el('span', { classe: 'cdc-chip', title: r.alvo, texto: r.alvo })])];
    if (pode) {
      if (pedeNome) filhos.push(nome);
      filhos.push(texto, erro, el('div', { classe: 'cdc-acoes' }, [cancelar, salvar]));
    } else {
      var ok = el('button', { type: 'button', classe: 'cdc-btn cdc-btn-primario', texto: 'Entendi' });
      ok.addEventListener('click', function () {
        fecharCaixa(s, true);
      });
      filhos.push(el('div', { texto: TEXTOS.semPermissao }), el('div', { classe: 'cdc-acoes' }, [ok]));
    }
    var caixa = el('div', { classe: 'cdc-caixa', role: 'dialog', 'aria-label': TEXTOS.comentario + ': ' + r.alvo, 'data-comentar': '' }, filhos);
    caixa.style.left = left + 'px';
    caixa.style.top = top + 'px';
    caixa.style.width = largura + 'px';
    caixa.addEventListener('keydown', function (e) {
      // Esc fecha só a caixa (não o que estiver aberto embaixo dela)
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        fecharCaixa(s, true);
      } else if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        enviar();
      }
    });
    s.raiz.appendChild(caixa);
    s.caixa = caixa;
    setTimeout(function () {
      if (!pode) caixa.querySelector('button').focus();
      else if (pedeNome && !nome.value) nome.focus();
      else texto.focus();
    }, 0);
  }

  // ---------------------------------------------------------------- painel de comentários

  /** Formulário + abas Abertos/Resolvidos + lista, dentro de `onde` (painel lateral ou uma página sua). */
  function desenharPainel(s, onde, opc) {
    var aba = 'abertos';
    var corpo = el('div', { classe: 'cdc-corpo' });
    onde.appendChild(corpo);

    // formulário (registrar o comentário de outra pessoa ou o seu)
    var quem = el('input', { type: 'text', placeholder: TEXTOS.exemploQuem });
    var sobre = el('input', { type: 'text', placeholder: TEXTOS.exemploSobre });
    var texto = el('textarea', { placeholder: TEXTOS.oQuePessoaQuer, maxlength: MAX_TEXTO, rows: 3 });
    var dica = el('span', { classe: 'cdc-dica', texto: TEXTOS.dicaApontar });
    var salvar = el('button', { type: 'button', classe: 'cdc-btn cdc-btn-primario', texto: TEXTOS.salvar, disabled: true });
    quem.value = s.eu && s.eu.nome ? '' : lembrado();
    var atualizarBotao = function () {
      salvar.disabled = !podeComentar(s) || !texto.value.trim();
    };
    texto.addEventListener('input', atualizarBotao);
    var enviar = function () {
      if (salvar.disabled) return;
      salvar.disabled = true;
      salvar.textContent = TEXTOS.salvando;
      if (!(s.eu && s.eu.nome)) lembrar(quem.value);
      var ref = (sobre.value.match(/\b\d{4,}\b/) || [])[0] || null;
      salvarComentario(s, { alvo: sobre.value.trim() || TEXTOS.sistemaEmGeral, referencia: ref, texto: texto.value, pessoa: quem.value }).then(
        function () {
          texto.value = '';
          sobre.value = '';
          salvar.textContent = TEXTOS.salvar;
          dica.className = 'cdc-dica';
          dica.textContent = TEXTOS.dicaApontar;
          atualizarBotao();
          avisar(s, TEXTOS.salvo);
        },
        function () {
          salvar.textContent = TEXTOS.salvar;
          dica.className = 'cdc-erro';
          dica.textContent = TEXTOS.erroSalvar;
          atualizarBotao();
        },
      );
    };
    salvar.addEventListener('click', enviar);
    texto.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        enviar();
      }
    });
    if (!opc || opc.formulario !== false) {
      corpo.appendChild(
        el('section', { classe: 'cdc-form', 'aria-label': TEXTOS.novoComentario }, [
          el('b', { texto: TEXTOS.novoComentario }),
          el('div', { classe: 'cdc-grade' }, [el('label', null, [TEXTOS.quemComentou, quem]), el('label', null, [TEXTOS.sobreOQue, sobre])]),
          el('label', null, [TEXTOS.comentario, texto]),
          el('div', { classe: 'cdc-acoes' }, [dica, salvar]),
        ]),
      );
    }

    var abaAbertos = el('button', { type: 'button', role: 'tab', classe: 'cdc-aba' });
    var abaResolvidos = el('button', { type: 'button', role: 'tab', classe: 'cdc-aba' });
    var lista = el('div', { style: 'display:flex;flex-direction:column;gap:10px' });
    corpo.appendChild(el('div', { role: 'tablist', classe: 'cdc-abas' }, [abaAbertos, abaResolvidos]));
    corpo.appendChild(lista);
    abaAbertos.addEventListener('click', function () {
      aba = 'abertos';
      desenhar();
    });
    abaResolvidos.addEventListener('click', function () {
      aba = 'resolvidos';
      desenhar();
    });

    var podeResolver = s.opcoes.podeResolver !== false;
    function desenhar() {
      var recentes = function (a, b) {
        return String(b || '').localeCompare(String(a || ''));
      };
      var abertos = s.comentarios
        .filter(function (c) {
          return !c.resolvido;
        })
        .sort(function (a, b) {
          return recentes(a.criadoEm, b.criadoEm);
        });
      var resolvidos = s.comentarios
        .filter(function (c) {
          return c.resolvido;
        })
        .sort(function (a, b) {
          return recentes(a.resolvidoEm || a.criadoEm, b.resolvidoEm || b.criadoEm);
        });
      abaAbertos.replaceChildren(TEXTOS.abertos, el('span', { texto: String(abertos.length) }));
      abaResolvidos.replaceChildren(TEXTOS.resolvidos, el('span', { texto: String(resolvidos.length) }));
      abaAbertos.setAttribute('aria-selected', String(aba === 'abertos'));
      abaResolvidos.setAttribute('aria-selected', String(aba === 'resolvidos'));
      var itens = aba === 'abertos' ? abertos : resolvidos;
      buscarNomes(s);
      if (!itens.length) {
        lista.replaceChildren(
          el('div', { classe: 'cdc-vazio' }, [
            el('b', { texto: aba === 'abertos' ? TEXTOS.nenhumAberto : TEXTOS.nenhumResolvido }),
            el('span', { classe: 'cdc-dica', texto: aba === 'abertos' ? TEXTOS.dicaVazio : TEXTOS.dicaVazioResolvidos }),
          ]),
        );
      } else {
        lista.replaceChildren.apply(
          lista,
          itens.map(function (c) {
            var autor = c.pessoa || (c.autorId && s.nomes[c.autorId]) || (s.eu && c.autorId && c.autorId === s.eu.id ? s.eu.nome : '') || TEXTOS.semNome;
            var meta = autor + ' · ' + fmtData(c.criadoEm) + (c.resolvido && c.resolvidoEm ? ' · ' + TEXTOS.resolvido + ' em ' + fmtData(c.resolvidoEm) : '');
            var pe = [el('span', { classe: 'cdc-dica', texto: meta })];
            if (podeResolver && podeComentar(s)) {
              var b = el('button', { type: 'button', classe: 'cdc-btn cdc-btn-contorno', texto: c.resolvido ? TEXTOS.reabrir : TEXTOS.marcarResolvido });
              b.addEventListener('click', function () {
                b.disabled = true;
                resolver(s, c.id, !c.resolvido).catch(function () {
                  b.disabled = false;
                  avisar(s, TEXTOS.erroSalvar);
                });
              });
              pe.push(b);
            }
            var cab = [el('b', { texto: c.alvo || TEXTOS.sistemaEmGeral })];
            var detalhe = [c.onde, c.referencia].filter(Boolean).join(' · ');
            if (detalhe) cab.push(el('span', { classe: 'cdc-dica', texto: detalhe }));
            return el('article', { classe: 'cdc-item' }, [el('div', { classe: 'cdc-item-cab' }, cab), el('div', { classe: 'cdc-item-texto', texto: c.texto }), el('div', { classe: 'cdc-item-pe' }, pe)]);
          }),
        );
      }
      atualizarBotao();
      if (!podeComentar(s)) {
        dica.className = 'cdc-erro';
        dica.textContent = TEXTOS.semPermissao;
      }
    }
    desenhar();
    s.paineis.add(desenhar);
    return function () {
      s.paineis.delete(desenhar);
      if (corpo.parentNode) corpo.parentNode.removeChild(corpo);
    };
  }

  function abrirPainel() {
    var s = estado;
    if (!s || s.painel) return;
    var fechar = function () {
      tirar();
      s.raiz.removeChild(fundo);
      s.raiz.removeChild(painel);
      s.painel = null;
      document.removeEventListener('keydown', esc, true);
    };
    var esc = function (e) {
      if (e.key === 'Escape' && !s.caixa && !s.ativo) {
        e.stopPropagation();
        fechar();
      }
    };
    var fundo = el('div', { classe: 'cdc-fundo-painel', 'data-comentar': '' });
    fundo.addEventListener('click', fechar);
    var botaoFechar = el('button', { type: 'button', 'aria-label': TEXTOS.fechar, texto: '×' });
    botaoFechar.addEventListener('click', fechar);
    var painel = el('div', { classe: 'cdc-painel', role: 'dialog', 'aria-label': TEXTOS.comentarios, 'data-comentar': '' }, [
      el('div', { classe: 'cdc-painel-cab' }, [el('h2', { texto: s.opcoes.titulo || TEXTOS.comentarios }), botaoFechar]),
    ]);
    s.raiz.appendChild(fundo);
    s.raiz.appendChild(painel);
    var tirar = desenharPainel(s, painel);
    s.painel = { fechar: fechar };
    document.addEventListener('keydown', esc, true);
    botaoFechar.focus();
  }

  /** Desenha o formulário e a lista dentro de um elemento seu (uma aba ou página "Comentários"). */
  function montarPainel(elemento, opc) {
    var s = estado;
    if (!s) throw new Error('Chame CaixaDeComentarios.iniciar() antes.');
    var caixa = el('div', { classe: 'cdc cdc-inline', 'data-comentar': '' });
    elemento.appendChild(caixa);
    var tirar = desenharPainel(s, caixa, opc);
    return function () {
      tirar();
      if (caixa.parentNode) caixa.parentNode.removeChild(caixa);
    };
  }

  var api = {
    iniciar: iniciar,
    parar: parar,
    comentar: function () {
      if (estado) entrarNoModo(estado);
    },
    abrirPainel: abrirPainel,
    montarPainel: montarPainel,
    recarregar: function () {
      return estado ? recarregar(estado) : Promise.resolve();
    },
    lista: function () {
      return estado ? estado.comentarios.slice() : [];
    },
    cancelar: function () {
      if (estado) sairDoModo(estado);
    },
    comentando: function () {
      return !!(estado && estado.ativo);
    },
  };
  window.CaixaDeComentarios = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})();
