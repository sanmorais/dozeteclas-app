// repertorio.js - Gerenciamento de Repertórios Litúrgicos (localStorage)
// Depende de: supabase-db.js (window._supabase), theme-toggle.js

/* ============================================================
   CONSTANTES
   ============================================================ */
const STORAGE_KEY = 'doze_repertorios';
const ESCALA_NOTAS = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
const MOMENTOS = [
    { id: 'entrada',    label: 'Entrada' },
    { id: 'penitencial', label: 'Ato Penitencial' },
    { id: 'gloria',     label: 'Glória' },
    { id: 'salmo',      label: 'Salmo Responsorial' },
    { id: 'aclamacao',  label: 'Aclamação' },
    { id: 'ofertorio',  label: 'Ofertório' },
    { id: 'santo',      label: 'Santo' },
    { id: 'amem',       label: 'Amém' },
    { id: 'cordeiro',   label: 'Cordeiro' },
    { id: 'comunhao',   label: 'Comunhão' },
    { id: 'final',      label: 'Final' },
    { id: 'homenagem',  label: 'Homenagem' },
    { id: 'adoracao',   label: 'Adoração' },
    { id: 'homilia',    label: 'Homilia' }
];

/* ============================================================
   ESTADO GLOBAL
   ============================================================ */
let state = {
    celebracoes: [],          // Todas as celebrações carregadas
    editandoId: null,         // ID da celebração sendo editada (null = nova)
    momentosAbertos: {}       // { momentoId: true/false } controle de collapse
};

// Estado dos modais
let momentoAlvoBusca = '';
let momentoAlvoTexto = '';
let textoEditandoId = null;
let popoverAtivo = null;
let callbackConfirmacao = null;

// 🔍 Cache em memória da lista resumida de cifras (titulo, autor, slug, tom)
// para busca instantânea e insensível a acentos — padrão adotado no portal (ui-controls.js).
let cacheBuscaCifras = null;

/* ============================================================
   UTILITÁRIOS
   ============================================================ */
function gerarId() {
    return 'r' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function escapeHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}

function normalizarTexto(str) {
    return (str || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim();
}

function hojeISO() {
    const d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
}

function tomIndexParaNota(idx) {
    const i = ((idx || 0) % 12 + 12) % 12;
    return ESCALA_NOTAS[i];
}

function notaParaTomIndex(nota) {
    const idx = ESCALA_NOTAS.indexOf(nota);
    return idx >= 0 ? idx : 0;
}

function formatarDataBR(dataISO) {
    if (!dataISO) return '';
    const partes = dataISO.split('-');
    if (partes.length !== 3) return dataISO;
    return `${partes[2]}/${partes[1]}/${partes[0]}`;
}

/* ============================================================
   LOCAL STORAGE OPERATIONS
   ============================================================ */
function carregarCelebracoes() {
    try {
        const dados = localStorage.getItem(STORAGE_KEY);
        const carregadas = dados ? JSON.parse(dados) : [];
        // 🔥 DEFESA: preserva celebrações temporárias que estão sendo editadas em memória
        // (ex: quando init() é chamado duas vezes por race condition do live reload)
        const tempEmEdicao = state.editandoId
            ? state.celebracoes.filter(c => c.id === state.editandoId && c.id.startsWith('temp_'))
            : [];
        state.celebracoes = [...tempEmEdicao, ...carregadas];
    } catch (e) {
        console.error('Erro ao carregar celebrações do localStorage:', e);
        state.celebracoes = [];
    }
    return state.celebracoes;
}

function salvarCelebracoes() {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state.celebracoes));
    } catch (e) {
        console.error('Erro ao salvar celebrações no localStorage:', e);
        alert('Erro ao salvar. O armazenamento local pode estar cheio.');
    }
}

function buscarCelebracaoPorId(id) {
    return state.celebracoes.find(c => c.id === id) || null;
}

function criarNovaCelebracao(titulo, data) {
    const nova = {
        id: gerarId(),
        titulo: titulo.trim(),
        data: data || hojeISO(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        itens: []
    };
    state.celebracoes.unshift(nova);
    salvarCelebracoes();
    return nova;
}

function atualizarCelebracao(id, titulo, data) {
    const idx = state.celebracoes.findIndex(c => c.id === id);
    if (idx === -1) return null;
    state.celebracoes[idx].titulo = titulo.trim();
    state.celebracoes[idx].data = data;
    state.celebracoes[idx].updatedAt = new Date().toISOString();
    salvarCelebracoes();
    return state.celebracoes[idx];
}

function excluirCelebracao(id) {
    state.celebracoes = state.celebracoes.filter(c => c.id !== id);
    salvarCelebracoes();
}

function adicionarItem(celebracaoId, item) {
    console.log('[repertorio] adicionarItem — celebracaoId:', celebracaoId, '| momento:', item.momento, '| titulo:', item.titulo);
    const celeb = buscarCelebracaoPorId(celebracaoId);
    if (!celeb) {
        console.error('[repertorio] ❌ adicionarItem: celebração não encontrada para id:', celebracaoId);
        return false;
    }
    celeb.itens.push({
        id: gerarId(),
        momento: item.momento,
        tipo: item.tipo || 'cifra',
        slug: item.slug || '',
        titulo: item.titulo || '',
        autor: item.autor || '',
        tomOriginal: item.tomOriginal != null ? item.tomOriginal : null,
        tomCustom: item.tomCustom != null ? item.tomCustom : item.tomOriginal,
        ordem: item.ordem ?? celeb.itens.length,
        observacao: item.observacao || '',
        conteudo: item.conteudo || ''
    });
    celeb.updatedAt = new Date().toISOString();
    salvarCelebracoes();
    console.log('[repertorio] ✅ Item adicionado com sucesso. Total itens:', celeb.itens.length);
    return true;
}

function atualizarItem(celebracaoId, itemId, campos) {
    const celeb = buscarCelebracaoPorId(celebracaoId);
    if (!celeb) return false;
    const idx = celeb.itens.findIndex(i => i.id === itemId);
    if (idx === -1) return false;
    Object.assign(celeb.itens[idx], campos);
    celeb.updatedAt = new Date().toISOString();
    salvarCelebracoes();
    return true;
}

function removerItem(celebracaoId, itemId) {
    const celeb = buscarCelebracaoPorId(celebracaoId);
    if (!celeb) return false;
    celeb.itens = celeb.itens.filter(i => i.id !== itemId);
    celeb.updatedAt = new Date().toISOString();
    salvarCelebracoes();
    return true;
}

function getItensPorMomento(celebracaoId, momentoId) {
    const celeb = buscarCelebracaoPorId(celebracaoId);
    if (!celeb) return [];
    return celeb.itens
        .filter(i => i.momento === momentoId)
        .sort((a, b) => (a.ordem || 0) - (b.ordem || 0));
}

/* ============================================================
   BUSCA DE CIFRAS (CACHE LOCAL + NORMALIZAÇÃO CLIENT-SIDE)
   ============================================================ */

// Carrega a lista resumida de todas as cifras (uma única vez por sessão) e a
// mantém em memória. A busca então ocorre 100% no cliente, garantindo
// insensibilidade total a acentos, cedilhas, diacríticos e caixa alta/baixa —
// algo que o operador ILIKE do PostgreSQL não oferece nativamente (ILIKE ignora
// caixa, mas NÃO remove acentos: "oracao" nunca casaria com "Oração" no banco).
async function carregarCacheBuscaCifras() {
    if (cacheBuscaCifras) return cacheBuscaCifras;

    const instancia = window._supabase || (typeof _supabase !== 'undefined' ? _supabase : null);
    if (!instancia) return null;

    try {
        const { data, error } = await instancia
            .from('musicas')
            .select('titulo, autor, slug, tom')
            .order('titulo', { ascending: true });

        if (error) throw error;
        cacheBuscaCifras = data || [];
    } catch (err) {
        console.error('Erro ao carregar cache de busca de cifras:', err);
        cacheBuscaCifras = [];
    }
    return cacheBuscaCifras;
}

async function buscarCifrasNoBanco(termo) {
    const termoNorm = normalizarTexto(termo);
    if (termoNorm.length < 2) return [];

    try {
        const lista = await carregarCacheBuscaCifras();
        if (!lista) {
            console.warn('Supabase ainda não carregado, aguardando...');
            return [];
        }
        return filtrarResultados(lista, termoNorm);
    } catch (err) {
        console.error('Erro ao buscar cifras:', err);
        return [];
    }
}

function filtrarResultados(lista, termoNorm) {
    return (lista || []).filter(m => {
        const tituloNorm = normalizarTexto(m.titulo || '');
        const autorNorm = normalizarTexto(m.autor || '');
        return tituloNorm.includes(termoNorm) || autorNorm.includes(termoNorm);
    }).slice(0, 30);
}

function converterTomParaExibicao(tomRaw) {
    if (tomRaw == null || isNaN(tomRaw)) return '--';
    const idx = ((parseInt(tomRaw, 10) - 3 + 12) % 12);
    return ESCALA_NOTAS[idx];
}

function obterDadinhosResultado(r) {
    return {
        titulo: r.titulo || '',
        autor: r.autor || '',
        slug: r.slug || '',
        tomOriginal: r.tom != null ? parseInt(r.tom, 10) : null
    };
}

/* ============================================================
   RENDER: LISTA DE CELEBRAÇÕES
   ============================================================ */
function renderizarLista() {
    const container = document.getElementById('lista-celebracoes');
    if (!container) return;

    if (state.celebracoes.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <i class="bi bi-calendar-plus"></i>
                <h3>Nenhuma celebração ainda</h3>
                <p>Crie seu primeiro repertório litúrgico clicando em "Nova".</p>
            </div>`;
        return;
    }

    container.innerHTML = state.celebracoes.map(c => {
        const totalItens = c.itens ? c.itens.length : 0;
        const dataFmt = formatarDataBR(c.data);
        return `
            <div class="celebracao-card" data-id="${escapeHtml(c.id)}">
                <div class="celebracao-info">
                    <h3 class="celebracao-titulo">${escapeHtml(c.titulo)}</h3>
                    <div class="celebracao-meta">
                        <span class="celebracao-data">📅 ${escapeHtml(dataFmt)}</span>
                        <span class="celebracao-count">${totalItens} itens</span>
                    </div>
                </div>
                <div class="celebracao-actions">
                    <button class="btn-action-card btn-edit-list" data-id="${escapeHtml(c.id)}" title="Editar"><i class="bi bi-pencil"></i></button>
                    <button class="btn-action-card btn-setlist" data-id="${escapeHtml(c.id)}" title="Executar"><i class="bi bi-play-fill"></i></button>
                    <button class="btn-action-card btn-del btn-del-list" data-id="${escapeHtml(c.id)}" title="Excluir"><i class="bi bi-trash"></i></button>
                </div>
            </div>`;
    }).join('');

    // Eventos nos cards
    container.querySelectorAll('.celebracao-card').forEach(card => {
        card.addEventListener('click', (e) => {
            if (e.target.closest('.btn-edit-list') || e.target.closest('.btn-setlist') || e.target.closest('.btn-del-list')) return;
            const id = card.dataset.id;
            abrirEditor(id);
        });
    });

    container.querySelectorAll('.btn-edit-list').forEach(btn => {
        btn.addEventListener('click', (e) => { e.stopPropagation(); abrirEditor(btn.dataset.id); });
    });

    container.querySelectorAll('.btn-setlist').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            window.location.href = `setlist.html?r=${encodeURIComponent(btn.dataset.id)}`;
        });
    });

    container.querySelectorAll('.btn-del-list').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            confirmarExclusao(btn.dataset.id);
        });
    });
}

/* ============================================================
   RENDER: EDITOR DE MOMENTOS (GRID)
   ============================================================ */
function renderizarEditor() {
    console.log('[repertorio] renderizarEditor — editandoId:', state.editandoId);
    let celeb = null;
    if (state.editandoId) {
        celeb = buscarCelebracaoPorId(state.editandoId);
    }

    if (celeb) {
        document.getElementById('input-titulo').value = celeb.titulo || '';
        document.getElementById('input-data').value = celeb.data || hojeISO();
        document.getElementById('editor-titulo').textContent = celeb.titulo || 'Nova Celebração';
    } else {
        document.getElementById('input-titulo').value = '';
        document.getElementById('input-data').value = hojeISO();
        document.getElementById('editor-titulo').textContent = 'Nova Celebração';
    }

    const grid = document.getElementById('momentos-grid');
    if (!grid) return;

    grid.innerHTML = MOMENTOS.map(m => {
        const itens = getItensPorMomento(state.editandoId, m.id);
        const estaAberto = state.momentosAbertos[m.id] !== false;
        const qtd = itens.length;
        return `
            <div class="momento-card ${estaAberto ? '' : 'collapsed'}" data-momento="${m.id}">
                <div class="momento-header" data-toggle-momento="${m.id}">
                    <span class="momento-label">${m.label}<span class="momento-count">${qtd}</span></span>
                    <span class="momento-toggle"><i class="bi bi-chevron-down"></i></span>
                </div>
                <div class="momento-body">
                    ${itens.length === 0 ? '<p style="color:var(--text-sec);font-size:0.8rem;margin:0;text-align:center;">Nenhum item neste momento.</p>' : ''}
                    ${itens.map(item => renderSlot(item, m.id)).join('')}
                    <button class="btn-add-slot" data-momento="${m.id}"><i class="bi bi-plus-lg"></i> Adicionar Cifra</button>
                    <button class="btn-add-slot btn-add-texto" data-momento="${m.id}" style="margin-top:4px;border-color:rgba(255,255,255,0.03);font-size:0.75rem;"><i class="bi bi-file-text"></i> Adicionar Texto</button>
                </div>
            </div>`;
    }).join('');

    // Eventos: toggle collapse
    grid.querySelectorAll('[data-toggle-momento]').forEach(el => {
        el.addEventListener('click', () => {
            const momentoId = el.dataset.toggleMomento;
            const card = el.closest('.momento-card');
            if (!card) return;
            const ativo = !card.classList.contains('collapsed');
            card.classList.toggle('collapsed');
            state.momentosAbertos[momentoId] = !ativo;
        });
    });

    // Eventos: adicionar cifra
    grid.querySelectorAll('.btn-add-slot:not(.btn-add-texto)').forEach(btn => {
        btn.addEventListener('click', () => abrirModalBusca(btn.dataset.momento));
    });

    // Eventos: adicionar texto
    grid.querySelectorAll('.btn-add-texto').forEach(btn => {
        btn.addEventListener('click', () => abrirModalTexto(btn.dataset.momento, null));
    });

    // Eventos nos slots
    grid.querySelectorAll('.btn-up-slot').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            moverItem(state.editandoId, btn.dataset.itemId, 'up');
        });
    });

    grid.querySelectorAll('.btn-down-slot').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            moverItem(state.editandoId, btn.dataset.itemId, 'down');
        });
    });

    grid.querySelectorAll('.btn-del-slot').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const itemId = btn.dataset.itemId;
            confirmarExclusaoItem(itemId);
        });
    });

    grid.querySelectorAll('.btn-transpose-slot').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            togglePopover(btn, btn.dataset.itemId);
        });
    });

    grid.querySelectorAll('.btn-edit-texto').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const itemId = btn.dataset.itemId;
            const celeb = buscarCelebracaoPorId(state.editandoId);
            if (!celeb) return;
            const item = celeb.itens.find(i => i.id === itemId);
            if (item) abrirModalTexto(btn.dataset.momento, item);
        });
    });
}

function renderSlot(item, momentoId) {
    const tomVisual = item.tomCustom != null ? converterTomParaExibicao(item.tomCustom) :
                       (item.tomOriginal != null ? converterTomParaExibicao(item.tomOriginal) : '--');
    const ehTexto = item.tipo === 'texto';

    if (ehTexto) {
        return `<div class="slot-item" data-item-id="${item.id}">
            <span class="slot-order"><i class="bi bi-file-text"></i></span>
            <div class="slot-info">
                <p class="slot-titulo">${escapeHtml(item.titulo || 'Texto')}</p>
                <p class="slot-autor" style="font-style:italic;"><i class="bi bi-chat-dots"></i> ${escapeHtml(item.conteudo || '').slice(0, 60)}</p>
            </div>
            <span class="slot-texto-badge">📄 TEXTO</span>
            <div class="slot-actions">
                <button class="btn-slot-action btn-edit-texto" data-item-id="${item.id}" data-momento="${momentoId}" title="Editar texto"><i class="bi bi-pencil"></i></button>
                <button class="btn-slot-action btn-del-slot" data-item-id="${item.id}" title="Remover"><i class="bi bi-x-lg"></i></button>
            </div>
        </div>`;
    }

    return `<div class="slot-item" data-item-id="${item.id}">
        <span class="slot-order">${(item.ordem != null ? item.ordem + 1 : '')}</span>
        <div class="slot-info">
            <p class="slot-titulo">${escapeHtml(item.titulo)}</p>
            <p class="slot-autor">${escapeHtml(item.autor || 'Autor desconhecido')}</p>
        </div>
        <button class="btn-transpose-slot" data-item-id="${item.id}" title="Transpor tom">${escapeHtml(tomVisual)}</button>
        <div class="slot-actions">
            <button class="btn-slot-action btn-up-slot" data-item-id="${item.id}" data-momento="${momentoId}" title="Subir ordem"><i class="bi bi-chevron-up"></i></button>
            <button class="btn-slot-action btn-down-slot" data-item-id="${item.id}" data-momento="${momentoId}" title="Descer ordem"><i class="bi bi-chevron-down"></i></button>
            <button class="btn-slot-action btn-del-slot" data-item-id="${item.id}" title="Remover"><i class="bi bi-x-lg"></i></button>
        </div>
    </div>`;
}

function moverItem(celebracaoId, itemId, direcao) {
    const celeb = buscarCelebracaoPorId(celebracaoId);
    if (!celeb) return;
    const idx = celeb.itens.findIndex(i => i.id === itemId);
    if (idx === -1) return;
    const momentoId = celeb.itens[idx].momento;
    const itensMomento = celeb.itens.filter(i => i.momento === momentoId).sort((a, b) => (a.ordem || 0) - (b.ordem || 0));
    const posAtual = itensMomento.findIndex(i => i.id === itemId);
    if (posAtual === -1) return;
    const novaPos = direcao === 'up' ? posAtual - 1 : posAtual + 1;
    if (novaPos < 0 || novaPos >= itensMomento.length) return;
    const ordemTemp = itensMomento[posAtual].ordem;
    itensMomento[posAtual].ordem = itensMomento[novaPos].ordem;
    itensMomento[novaPos].ordem = ordemTemp;
    celeb.updatedAt = new Date().toISOString();
    salvarCelebracoes();
    renderizarEditor();
}

/* ============================================================
   MODAIS
   ============================================================ */
function abrirModalBusca(momentoId) {
    console.log('[repertorio] abrirModalBusca — momentoAlvo:', momentoId, '| editandoId:', state.editandoId);
    momentoAlvoBusca = momentoId;
    document.getElementById('input-busca-cifra').value = '';
    document.getElementById('resultados-busca').innerHTML = '<p class="busca-placeholder">Digite ao menos 2 caracteres para buscar...</p>';
    document.getElementById('modal-busca').style.display = 'flex';
    setTimeout(() => document.getElementById('input-busca-cifra').focus(), 100);

    // 🔥 Pré-carrega o cache de busca em background ao abrir o modal,
    // para que a primeira digitação já encontre a lista em memória.
    carregarCacheBuscaCifras();
}

function fecharModalBusca() {
    console.log('[repertorio] fecharModalBusca — momentoAlvo anterior:', momentoAlvoBusca);
    document.getElementById('modal-busca').style.display = 'none';
    momentoAlvoBusca = '';
}

function renderizarResultadosBusca(resultados) {
    const container = document.getElementById('resultados-busca');
    if (!container) return;
    if (resultados.length === 0) {
        container.innerHTML = '<p class="busca-placeholder">Nenhuma cifra encontrada. Tente outro termo.</p>';
        return;
    }
    container.innerHTML = resultados.map(r => {
        const dados = obterDadinhosResultado(r);
        const tomVisual = converterTomParaExibicao(dados.tomOriginal);
        // 🔥 CORREÇÃO: data-* attributes NÃO devem usar escapeHtml — o dataset API
        // já lida com encoding. Usar escapeHtml aqui causa double-encoding em títulos
        // com aspas/ampersands, corrompendo os valores lidos via dataset.
        // Usamos .replace(/"/g,'&quot;') APENAS para não quebrar o atributo HTML.
        const attrSlug = (dados.slug || '').replace(/"/g, '&quot;');
        const attrTitulo = (dados.titulo || '').replace(/"/g, '&quot;');
        const attrAutor = (dados.autor || '').replace(/"/g, '&quot;');
        const attrTom = (dados.tomOriginal != null) ? dados.tomOriginal : '';
        return `<div class="resultado-item" data-slug="${attrSlug}" data-titulo="${attrTitulo}" data-autor="${attrAutor}" data-tom="${attrTom}">
            <div class="resultado-info"><p class="resultado-titulo">${escapeHtml(dados.titulo)}</p><p class="resultado-autor">${escapeHtml(dados.autor)}</p></div>
            <span class="resultado-tom">${escapeHtml(tomVisual)}</span>
        </div>`;
    }).join('');

    container.querySelectorAll('.resultado-item').forEach(el => {
        el.addEventListener('click', () => {
            console.log('[repertorio] Click em resultado da busca:', {
                editandoId: state.editandoId,
                momentoAlvoBusca: momentoAlvoBusca,
                slug: el.dataset.slug,
                titulo: el.dataset.titulo,
                autor: el.dataset.autor,
                tom: el.dataset.tom
            });

            if (!state.editandoId) {
                console.warn('[repertorio] ❌ state.editandoId está vazio — a celebração alvo foi perdida.');
                return;
            }
            if (!momentoAlvoBusca) {
                console.warn('[repertorio] ❌ momentoAlvoBusca está vazio — o momento litúrgico alvo foi perdido.');
                return;
            }

            const slug = el.dataset.slug;
            const titulo = el.dataset.titulo;
            const autor = el.dataset.autor;
            const tomStr = el.dataset.tom;
            const tomOriginal = (tomStr != null && tomStr !== '') ? parseInt(tomStr, 10) : null;

            const item = {
                momento: momentoAlvoBusca,
                tipo: 'cifra',
                slug: slug || '',
                titulo: titulo || '',
                autor: autor || '',
                tomOriginal: tomOriginal,
                tomCustom: tomOriginal
            };

            const adicionado = adicionarItem(state.editandoId, item);
            console.log('[repertorio] adicionarItem retornou:', adicionado, 'para celebracaoId:', state.editandoId);

            if (!adicionado) {
                console.error('[repertorio] ❌ Falha ao adicionar item — verifique se a celebração ainda existe no estado.');
                alert('Erro ao adicionar a cifra. A celebração pode ter sido removida. Tente novamente.');
            }

            fecharModalBusca();
            renderizarEditor();
        });
    });
}

function togglePopover(btnRef, itemId) {
    if (popoverAtivo) { popoverAtivo.remove(); popoverAtivo = null; if (popoverAtivo === btnRef) return; }
    const celeb = buscarCelebracaoPorId(state.editandoId);
    if (!celeb) return;
    const item = celeb.itens.find(i => i.id === itemId);
    if (!item) return;
    const tomAtual = (item.tomCustom != null ? item.tomCustom : item.tomOriginal) || 0;
    const rect = btnRef.getBoundingClientRect();
    const popover = document.createElement('div');
    popover.className = 'transpose-popover';
    popover.style.top = (rect.bottom + 8) + 'px';
    popover.style.left = Math.max(8, rect.left) + 'px';
    popover.style.position = 'fixed';
    popover.innerHTML = `<p class="popover-label">Tom: ${escapeHtml(item.titulo)}</p><div class="popover-notes">${ESCALA_NOTAS.map((nota, i) => `<button class="popover-note-btn ${i === tomAtual ? 'active' : ''}" data-nota-idx="${i}">${nota}</button>`).join('')}</div>`;
    document.body.appendChild(popover);
    popoverAtivo = popover;
    popover.querySelectorAll('.popover-note-btn').forEach(btn => {
        btn.addEventListener('click', () => { atualizarItem(state.editandoId, itemId, { tomCustom: parseInt(btn.dataset.notaIdx, 10) }); popover.remove(); popoverAtivo = null; renderizarEditor(); });
    });
    setTimeout(() => { document.addEventListener('click', fecharPopoverExterno, { once: true }); }, 0);
}

function fecharPopoverExterno(e) {
    if (popoverAtivo && !popoverAtivo.contains(e.target) && !e.target.closest('.btn-transpose-slot')) {
        popoverAtivo.remove();
        popoverAtivo = null;
    }
}

function abrirModalTexto(momentoId, itemExistente) {
    momentoAlvoTexto = momentoId;
    textoEditandoId = itemExistente ? itemExistente.id : null;
    document.getElementById('input-texto-titulo').value = itemExistente ? itemExistente.titulo : '';
    document.getElementById('input-texto-conteudo').value = itemExistente ? itemExistente.conteudo : '';
    document.getElementById('modal-texto').style.display = 'flex';
    setTimeout(() => document.getElementById('input-texto-titulo').focus(), 100);
}

function fecharModalTexto() {
    document.getElementById('modal-texto').style.display = 'none';
    momentoAlvoTexto = '';
    textoEditandoId = null;
}

function salvarTextoModal() {
    const titulo = document.getElementById('input-texto-titulo').value.trim();
    const conteudo = document.getElementById('input-texto-conteudo').value.trim();
    if (!titulo && !conteudo) { alert('Preencha o título ou o conteúdo do texto.'); return; }
    if (!state.editandoId) return;

    if (textoEditandoId) {
        // Editando texto existente
        atualizarItem(state.editandoId, textoEditandoId, {
            titulo: titulo,
            conteudo: conteudo
        });
    } else {
        // Novo texto
        const item = {
            momento: momentoAlvoTexto,
            tipo: 'texto',
            titulo: titulo,
            conteudo: conteudo,
            slug: '',
            autor: '',
            tomOriginal: null,
            tomCustom: null
        };
        adicionarItem(state.editandoId, item);
    }

    fecharModalTexto();
    renderizarEditor();
}

/* ============================================================
   CONFIRMAÇÃO (EXCLUSÃO)
   ============================================================ */
function fecharModalConfirmacao() {
    document.getElementById('modal-confirmacao').style.display = 'none';
    callbackConfirmacao = null;
}

function confirmarExclusao(id) {
    const celeb = buscarCelebracaoPorId(id);
    if (!celeb) return;
    document.getElementById('confirm-titulo').textContent = 'Excluir Celebração';
    document.getElementById('confirm-mensagem').textContent = `Tem certeza que deseja excluir "${celeb.titulo}"? Esta ação não pode ser desfeita.`;
    callbackConfirmacao = () => {
        excluirCelebracao(id);
        fecharModalConfirmacao();
        renderizarLista();
    };
    document.getElementById('modal-confirmacao').style.display = 'flex';
}

function confirmarExclusaoItem(itemId) {
    const celeb = buscarCelebracaoPorId(state.editandoId);
    if (!celeb) return;
    const item = celeb.itens.find(i => i.id === itemId);
    if (!item) return;
    document.getElementById('confirm-titulo').textContent = 'Remover Item';
    document.getElementById('confirm-mensagem').textContent = `Remover "${item.titulo}" do repertório?`;
    callbackConfirmacao = () => {
        removerItem(state.editandoId, itemId);
        fecharModalConfirmacao();
        renderizarEditor();
    };
    document.getElementById('modal-confirmacao').style.display = 'flex';
}

/* ============================================================
   NAVEGAÇÃO ENTRE LISTA / EDITOR
   ============================================================ */
function mostrarLista() {
    // Remove celebrações temporárias não salvas
    const tempIds = state.celebracoes.filter(c => c.id.startsWith('temp_') && !c.titulo.trim()).map(c => c.id);
    tempIds.forEach(id => excluirCelebracao(id));

    document.getElementById('section-lista').style.display = 'block';
    document.getElementById('section-editor').style.display = 'none';
    state.editandoId = null;
    renderizarLista();
}

function abrirEditor(id) {
    state.editandoId = id;
    const celeb = buscarCelebracaoPorId(id);
    document.getElementById('section-lista').style.display = 'none';
    document.getElementById('section-editor').style.display = 'block';
    if (celeb) {
        document.getElementById('editor-titulo').textContent = celeb.titulo || 'Editar Celebração';
    } else {
        document.getElementById('editor-titulo').textContent = 'Nova Celebração';
    }
    renderizarEditor();
}

function salvarCelebracaoAtual() {
    const titulo = document.getElementById('input-titulo').value.trim();
    const data = document.getElementById('input-data').value;

    if (!titulo) { alert('Por favor, defina um título para a celebração.'); return; }

    if (state.editandoId) {
        const existente = buscarCelebracaoPorId(state.editandoId);
        if (existente) {
            // Se for ID temporário, substitui por ID real
            if (state.editandoId.startsWith('temp_')) {
                const realId = gerarId();
                existente.id = realId;
                state.editandoId = realId;
            }
            atualizarCelebracao(state.editandoId, titulo, data);
        }
    } else {
        const nova = criarNovaCelebracao(titulo, data);
        state.editandoId = nova.id;
    }

    mostrarLista();
}

/* ============================================================
   INICIALIZAÇÃO
   ============================================================ */
let _inicializado = false;

function init() {
    if (_inicializado) {
        console.warn('[repertorio] ⚠️ init() bloqueado — já inicializado anteriormente.');
        return;
    }
    _inicializado = true;
    console.log('[repertorio] 🚀 init() iniciado');
    carregarCelebracoes();
    renderizarLista();

    // Botão nova celebração
    document.getElementById('btn-nova-celebracao')?.addEventListener('click', () => {
        // Cria celebração temporária em memória
        const tempId = 'temp_' + Date.now();
        const temp = {
            id: tempId,
            titulo: '',
            data: hojeISO(),
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            itens: []
        };
        state.celebracoes.unshift(temp);
        state.editandoId = tempId;
        console.log('[repertorio] Nova celebração temporária criada:', tempId);
        document.getElementById('input-titulo').value = '';
        document.getElementById('input-data').value = hojeISO();
        document.getElementById('editor-titulo').textContent = 'Nova Celebração';
        document.getElementById('section-lista').style.display = 'none';
        document.getElementById('section-editor').style.display = 'block';
        renderizarEditor();
        document.getElementById('input-titulo').focus();
    });

    // Botão voltar para lista
    document.getElementById('btn-voltar-lista')?.addEventListener('click', mostrarLista);

    // Botão salvar celebração
    document.getElementById('btn-salvar-celebracao')?.addEventListener('click', salvarCelebracaoAtual);

    // Botões de modais
    document.getElementById('btn-fechar-busca')?.addEventListener('click', fecharModalBusca);
    document.getElementById('btn-confirm-cancel')?.addEventListener('click', fecharModalConfirmacao);
    document.getElementById('btn-confirm-ok')?.addEventListener('click', () => { if (callbackConfirmacao) callbackConfirmacao(); });
    document.getElementById('btn-fechar-texto')?.addEventListener('click', fecharModalTexto);
    document.getElementById('btn-cancelar-texto')?.addEventListener('click', fecharModalTexto);
    document.getElementById('btn-salvar-texto')?.addEventListener('click', salvarTextoModal);

    // Fechar modais ao clicar fora
    document.querySelectorAll('.modal-overlay').forEach(modal => {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                if (modal.id === 'modal-busca') fecharModalBusca();
                else if (modal.id === 'modal-confirmacao') fecharModalConfirmacao();
                else if (modal.id === 'modal-texto') fecharModalTexto();
            }
        });
    });

    // Busca com debounce
    const inputBusca = document.getElementById('input-busca-cifra');
    if (inputBusca) {
        let timeoutId;
        inputBusca.addEventListener('input', () => {
            clearTimeout(timeoutId);
            const termo = inputBusca.value.trim();
            if (termo.length < 2) {
                document.getElementById('resultados-busca').innerHTML = '<p class="busca-placeholder">Digite ao menos 2 caracteres para buscar...</p>';
                return;
            }
            timeoutId = setTimeout(async () => {
                const resultados = await buscarCifrasNoBanco(termo);
                renderizarResultadosBusca(resultados);
            }, 300);
        });
    }

    // Keyboard shortcut: Ctrl+S salva
    document.addEventListener('keydown', (e) => {
        if ((e.ctrlKey || e.metaKey) && e.key === 's') {
            if (document.getElementById('section-editor').style.display !== 'none') {
                e.preventDefault();
                salvarCelebracaoAtual();
            }
        }
    });
}

// Aguarda o Supabase carregar
function esperarSupabase() {
    let jaIniciou = false;
    const check = setInterval(() => {
        const existe = window._supabase || (typeof _supabase !== 'undefined');
        if (existe) {
            clearInterval(check);
            if (!jaIniciou) { jaIniciou = true; init(); }
        }
    }, 50);

    // Timeout de segurança
    setTimeout(() => {
        clearInterval(check);
        if (!jaIniciou) { jaIniciou = true; init(); }
    }, 5000);
}

document.addEventListener('DOMContentLoaded', esperarSupabase);