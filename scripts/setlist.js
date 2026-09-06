// setlist.js - Modo Execução ao Vivo de Repertórios Litúrgicos
// Depende de: supabase-db.js (window._supabase), chordpro-parser.js (window.converterBlocoParaChordPro),
//             music-engine.js (window.renderizarMusica), auto-scroll.js (window.autoScrollEngine)

const STORAGE_KEY = 'doze_repertorios';
const ESCALA_NOTAS = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
const SETLIST_PREFS_KEY = 'doze_setlist_prefs';
const MOMENTOS_MAP = {
    entrada: 'Entrada',
    penitencial: 'Ato Penitencial',
    gloria: 'Glória',
    salmo: 'Salmo Responsorial',
    aclamacao: 'Aclamação',
    ofertorio: 'Ofertório',
    santo: 'Santo',
    amem: 'Amém',
    cordeiro: 'Cordeiro',
    comunhao: 'Comunhão',
    final: 'Final',
    homenagem: 'Homenagem',
    adoracao: 'Adoração',
    homilia: 'Homilia'
};

let state = {
    celebracao: null,
    itens: [],
    itemAtualIdx: -1,
    cacheCifras: {}  // { slug: { conteudo: string, titulo, autor, tom } }
};

/* ============================================================
   ESTADO DA BARRA DE FERRAMENTAS (Modo Palco)
   ============================================================ */
let toolbarState = {
    fontSize: 16,           // Tamanho da fonte em px
    onlyText: false,        // Modo apenas texto (sem acordes)
    twoColumns: false,      // Modo duas colunas
    forceSharps: null       // null = auto; true = sustenido; false = bemol
};

function carregarToolbarPrefs() {
    try {
        const saved = localStorage.getItem(SETLIST_PREFS_KEY);
        if (saved) {
            const prefs = JSON.parse(saved);
            if (prefs.fontSize) toolbarState.fontSize = prefs.fontSize;
            if (typeof prefs.onlyText === 'boolean') toolbarState.onlyText = prefs.onlyText;
            if (typeof prefs.twoColumns === 'boolean') toolbarState.twoColumns = prefs.twoColumns;
            if (prefs.forceSharps !== undefined) toolbarState.forceSharps = prefs.forceSharps;
        }
    } catch (e) { /* ignora */ }
}

function salvarToolbarPrefs() {
    try {
        localStorage.setItem(SETLIST_PREFS_KEY, JSON.stringify(toolbarState));
    } catch (e) { /* ignora */ }
}

function getQueryParam(param) {
    return new URLSearchParams(window.location.search).get(param);
}

function normalizarTexto(str) {
    return (str || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
}

function escapeHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}

function converterTomParaExibicao(tomRaw) {
    if (tomRaw == null || isNaN(tomRaw)) return '--';
    const idx = ((parseInt(tomRaw, 10) - 3 + 12) % 12);
    return ESCALA_NOTAS[idx];
}

/** Retorna o índice efetivo na ESCALA_NOTAS (0-11) para um item, considerando tomCustom ou tomOriginal */
function getEffectiveNoteIndex(item) {
    const raw = item.tomCustom != null ? item.tomCustom : (item.tomOriginal != null ? item.tomOriginal : 0);
    return ((parseInt(raw, 10) - 3 + 12) % 12);
}

/** Formata nota no índice idx (0-11) para exibição, respeitando forceSharps */
function formatNoteSetlist(idx, useSharps) {
    const nome = ESCALA_NOTAS[idx];
    if (!useSharps) {
        const flats = { 'C#': 'Db', 'D#': 'Eb', 'F#': 'Gb', 'G#': 'Ab', 'A#': 'Bb' };
        return flats[nome] || nome;
    }
    return nome;
}

/** Determina o useSharps efetivo atual */
function getUseSharpsEfetivo() {
    if (toolbarState.forceSharps !== null) return toolbarState.forceSharps;
    const item = state.itens[state.itemAtualIdx];
    if (!item || item.tipo === 'texto') return true;
    const idx = getEffectiveNoteIndex(item);
    return !['F', 'Bb', 'Eb', 'Ab', 'Db', 'Gb'].includes(ESCALA_NOTAS[idx].replace('C#','Db').replace('D#','Eb').replace('F#','Gb').replace('G#','Ab').replace('A#','Bb'));
}

/* ============================================================
   CARREGAR CELEBRAÇÃO
   ============================================================ */
function carregarCelebracaoLocal(id) {
    try {
        const dados = localStorage.getItem(STORAGE_KEY);
        const lista = dados ? JSON.parse(dados) : [];
        return lista.find(c => c.id === id) || null;
    } catch (e) {
        console.error('Erro ao carregar do localStorage:', e);
        return null;
    }
}

function salvarCelebracaoLocal() {
    try {
        const dados = localStorage.getItem(STORAGE_KEY);
        const lista = dados ? JSON.parse(dados) : [];
        const idx = lista.findIndex(c => c.id === state.celebracao.id);
        if (idx >= 0) {
            lista[idx] = state.celebracao;
            localStorage.setItem(STORAGE_KEY, JSON.stringify(lista));
        }
    } catch (e) {
        console.error('Erro ao salvar celebração:', e);
    }
}

async function carregarCifraDoBanco(slug) {
    if (state.cacheCifras[slug]) return state.cacheCifras[slug];
    try {
        const instancia = window._supabase || (typeof _supabase !== 'undefined' ? _supabase : null);
        if (!instancia) return null;
        const { data, error } = await instancia
            .from('musicas')
            .select('*')
            .eq('slug', slug)
            .maybeSingle();
        if (error) throw error;
        if (data) {
            state.cacheCifras[slug] = data;
            return data;
        }
        return null;
    } catch (err) {
        console.error('Erro ao buscar cifra:', slug, err?.message || err, err?.details || '', err?.hint || '');
        return null;
    }
}

function ordenarItens(itens) {
    const ordemMomentos = Object.keys(MOMENTOS_MAP);
    return [...itens].sort((a, b) => {
        const idxA = ordemMomentos.indexOf(a.momento);
        const idxB = ordemMomentos.indexOf(b.momento);
        const posA = idxA === -1 ? 999 : idxA;
        const posB = idxB === -1 ? 999 : idxB;
        return posA - posB;
    });
}

/* ============================================================
   POPUP DE TONALIDADE (TOM) - Igual ao cifra.html
   ============================================================ */

/** Abre/fecha o popup de seleção de tom */
function toggleSetlistTonePopup() {
    const p = document.getElementById('tone-popup');
    if (p) p.style.display = p.style.display === 'grid' ? 'none' : 'grid';
}

/** Constrói os botões do popup de tom com base no item atual */
function setupSetlistTonePopup() {
    const container = document.getElementById('tone-popup');
    if (!container) return;
    container.innerHTML = '';

    const item = state.itens[state.itemAtualIdx];
    if (!item || item.tipo === 'texto') return;

    const currentIdx = getEffectiveNoteIndex(item);
    const useSharps = getUseSharpsEfetivo();

    ESCALA_NOTAS.forEach((_t, i) => {
        const btn = document.createElement('div');
        btn.className = 'tone-btn' + (i === currentIdx ? ' active' : '');
        btn.innerText = formatNoteSetlist(i, useSharps);
        btn.onclick = (e) => {
            e.stopPropagation();
            item.tomCustom = i + 3; // Armazena como valor MIDI-like (compatível com converterTomParaExibicao)
            salvarCelebracaoLocal();
            setupSetlistTonePopup();
            renderItemAtual();
            toggleSetlistTonePopup();
        };
        container.appendChild(btn);
    });

    // Botão "TOM ORIGINAL"
    const btnOriginal = document.createElement('div');
    btnOriginal.className = 'tone-btn original-btn';
    btnOriginal.style.gridColumn = '1 / span 4';
    btnOriginal.innerText = 'TOM ORIGINAL';
    btnOriginal.onclick = (e) => {
        e.stopPropagation();
        item.tomCustom = item.tomOriginal; // Restaura o tom original do banco
        salvarCelebracaoLocal();
        setupSetlistTonePopup();
        renderItemAtual();
        toggleSetlistTonePopup();
    };
    container.appendChild(btnOriginal);
}

/* ============================================================
   FUNÇÕES DA BARRA DE FERRAMENTAS (MODO PALCO)
   ============================================================ */

function removerMarcasApenasTexto(html) {
    return html
        .replace(/_/g, '')
        .replace(/(<div class="c-line">)(?:&nbsp;|\s)+/g, '$1')
        .replace(/&nbsp;+/g, ' ')
        .replace(/\s+/g, ' ');
}

function aplicarEstadoToolbar() {
    const cifraRender = document.getElementById('cifra-render');
    if (!cifraRender) return;
    cifraRender.style.fontSize = toolbarState.fontSize + 'px';
    if (toolbarState.onlyText) cifraRender.classList.add('only-text-mode');
    else cifraRender.classList.remove('only-text-mode');
    if (toolbarState.twoColumns) cifraRender.classList.add('two-columns');
    else cifraRender.classList.remove('two-columns');
    atualizarBotoesToolbar();
}

function atualizarBotoesToolbar() {
    const btnTxt = document.getElementById('btn-setlist-toggle-txt');
    const btnCols = document.getElementById('btn-setlist-columns');
    if (btnTxt) btnTxt.classList.toggle('active', toolbarState.onlyText);
    if (btnCols) btnCols.classList.toggle('active', toolbarState.twoColumns);
}

function changeZoomSetlist(v) {
    toolbarState.fontSize = Math.max(10, Math.min(40, toolbarState.fontSize + v));
    const cifraRender = document.getElementById('cifra-render');
    if (cifraRender) cifraRender.style.fontSize = toolbarState.fontSize + 'px';
    salvarToolbarPrefs();
}

function resetZoomSetlist() {
    toolbarState.fontSize = 16;
    const cifraRender = document.getElementById('cifra-render');
    if (cifraRender) cifraRender.style.fontSize = '16px';
    salvarToolbarPrefs();
}

function toggleTxtSetlist() {
    toolbarState.onlyText = !toolbarState.onlyText;
    const cifraRender = document.getElementById('cifra-render');
    const btn = document.getElementById('btn-setlist-toggle-txt');
    if (!cifraRender) return;
    if (toolbarState.onlyText) {
        if (!cifraRender.dataset.originalHtml) {
            cifraRender.dataset.originalHtml = cifraRender.innerHTML;
        }
        cifraRender.innerHTML = removerMarcasApenasTexto(cifraRender.innerHTML);
        cifraRender.classList.add('only-text-mode');
        if (btn) btn.classList.add('active');
    } else {
        if (cifraRender.dataset.originalHtml) {
            cifraRender.innerHTML = cifraRender.dataset.originalHtml;
            delete cifraRender.dataset.originalHtml;
        }
        cifraRender.classList.remove('only-text-mode');
        if (btn) btn.classList.remove('active');
    }
    cifraRender.style.fontSize = toolbarState.fontSize + 'px';
    if (toolbarState.twoColumns) cifraRender.classList.add('two-columns');
    salvarToolbarPrefs();
}

function toggleColumnsSetlist() {
    toolbarState.twoColumns = !toolbarState.twoColumns;
    const cifraRender = document.getElementById('cifra-render');
    const btn = document.getElementById('btn-setlist-columns');
    if (cifraRender) cifraRender.classList.toggle('two-columns', toolbarState.twoColumns);
    if (btn) btn.classList.toggle('active', toolbarState.twoColumns);
    salvarToolbarPrefs();
}

/* ============================================================
   IMPRESSÃO: ESCOLHA DO MODO E GERAÇÃO DO LIVRETO COMPLETO
   ============================================================ */

/** Exibe alerta para usuários em navegadores embutidos de redes sociais */
function mostrarAlertaAppExternoSetlist() {
    let modal = document.getElementById('print-modal-alert-setlist');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'print-modal-alert-setlist';
        modal.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.85);display:flex;align-items:center;justify-content:center;z-index:9999;padding:20px;';
        modal.innerHTML = `<div style="background:#1a1d20;color:#fff;padding:25px;border-radius:12px;max-width:400px;text-align:center;border:1px solid #FFC502;">
            <h3 style="color:#FFC502;margin-bottom:15px;">Atenção</h3>
            <p style="margin-bottom:20px;line-height:1.5;">O navegador de redes sociais bloqueia a impressão direta.</p>
            <p style="margin-bottom:20px;line-height:1.5;font-size:0.9em;">Toque nos <b>3 pontinhos</b> e selecione <b>"Abrir no navegador externo"</b> para imprimir ou salvar em PDF.</p>
            <button id="btn-close-print-modal-setlist" style="background:#FFC502;color:#000;border:none;padding:10px 20px;border-radius:5px;font-weight:bold;cursor:pointer;">Entendido</button></div>`;
        document.body.appendChild(modal);
        document.getElementById('btn-close-print-modal-setlist').onclick = () => modal.style.display = 'none';
    } else { modal.style.display = 'flex'; }
}

/** Modal de escolha entre impressão única ou celebração completa */
function mostrarModalEscolhaImpressao(totalMusicas) {
    const existente = document.getElementById('print-choice-modal');
    if (existente) existente.remove();

    const modal = document.createElement('div');
    modal.id = 'print-choice-modal';
    modal.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.85);display:flex;align-items:center;justify-content:center;z-index:9999;padding:20px;';
    modal.innerHTML = `
        <div style="background:#1a1d20;color:#fff;padding:28px 24px;border-radius:14px;max-width:420px;width:100%;text-align:center;border:1px solid #FFC502;box-shadow:0 8px 32px rgba(0,0,0,0.5);">
            <div style="font-size:2rem;margin-bottom:8px;">🖨️</div>
            <h3 style="color:#FFC502;margin:0 0 6px 0;font-size:1.15rem;">Opções de Impressão</h3>
            <p style="margin:0 0 22px 0;font-size:0.85rem;color:#8b949e;line-height:1.4;">Escolha como deseja gerar o PDF ou imprimir:</p>
            <div style="display:flex;flex-direction:column;gap:10px;">
                <button id="btn-print-single" style="background:#2a2d32;color:#e0e0e0;border:1px solid rgba(255,255,255,0.12);padding:13px 20px;border-radius:8px;font-weight:600;cursor:pointer;transition:all 0.2s;font-size:0.9rem;text-align:left;display:flex;align-items:center;gap:10px;">
                    <span style="font-size:1.2rem;">🎵</span><span>Imprimir Apenas Esta Cifra</span>
                </button>
                <button id="btn-print-batch" style="background:linear-gradient(135deg, #FFC502, #e5b000);color:#000;border:none;padding:13px 20px;border-radius:8px;font-weight:700;cursor:pointer;transition:all 0.2s;font-size:0.9rem;text-align:left;display:flex;align-items:center;gap:10px;">
                    <span style="font-size:1.2rem;">📖</span><span>Imprimir Celebração Completa <small style="display:block;font-weight:400;opacity:0.7;">(${totalMusicas} músicas)</small></span>
                </button>
                <button id="btn-print-cancel" style="background:transparent;color:#8b949e;border:none;padding:8px;cursor:pointer;font-size:0.8rem;margin-top:4px;">Cancelar</button>
            </div>
        </div>`;

    document.body.appendChild(modal);

    const fechar = () => modal.remove();

    const btnSingle = modal.querySelector('#btn-print-single');
    const btnBatch = modal.querySelector('#btn-print-batch');
    const btnCancel = modal.querySelector('#btn-print-cancel');

    btnSingle.onmouseenter = () => { btnSingle.style.background = '#3a3d44'; btnSingle.style.borderColor = 'rgba(255,197,2,0.4)'; };
    btnSingle.onmouseleave = () => { btnSingle.style.background = '#2a2d32'; btnSingle.style.borderColor = 'rgba(255,255,255,0.12)'; };
    btnBatch.onmouseenter = () => { btnBatch.style.background = 'linear-gradient(135deg, #FFD700, #f0c000)'; };
    btnBatch.onmouseleave = () => { btnBatch.style.background = 'linear-gradient(135deg, #FFC502, #e5b000)'; };
    btnCancel.onmouseenter = () => { btnCancel.style.color = '#fff'; };
    btnCancel.onmouseleave = () => { btnCancel.style.color = '#8b949e'; };

    btnSingle.onclick = () => {
        fechar();
        window.onafterprint = null;
        document.body.classList.add('print-mode');
        setTimeout(() => { window.print(); }, 150);
    };

    btnBatch.onclick = async () => {
        fechar();
        await renderizarCelebracaoCompletaParaImpressao();
    };

    btnCancel.onclick = fechar;

    modal.addEventListener('click', (e) => {
        if (e.target === modal) fechar();
    });
}

/** Gera o container temporário com todas as músicas e dispara a impressão */
async function renderizarCelebracaoCompletaParaImpressao() {
    // 1. Garante que todas as cifras estão no cache (busca assíncrona das faltantes)
    const slugsFaltantes = state.itens
        .filter(i => i.tipo === 'cifra' && i.slug && !state.cacheCifras[i.slug])
        .map(i => i.slug);

    if (slugsFaltantes.length > 0) {
        const loadingEl = document.createElement('div');
        loadingEl.id = 'print-loading-indicator';
        loadingEl.style.cssText = 'position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);background:#1a1d20;color:#FFC502;padding:20px 30px;border-radius:12px;z-index:10000;font-weight:700;border:1px solid #FFC502;box-shadow:0 8px 32px rgba(0,0,0,0.6);font-family:\'Segoe UI\',sans-serif;';
        loadingEl.textContent = '⏳ Carregando cifras para impressão...';
        document.body.appendChild(loadingEl);
        await Promise.all(slugsFaltantes.map(slug => carregarCifraDoBanco(slug)));
        loadingEl.remove();
    }

    // 2. Remove container de impressão anterior se existir
    const existente = document.getElementById('print-batch-container');
    if (existente) existente.remove();

    // 3. Cria o container temporário (oculto na tela, visível no @media print)
    const batchContainer = document.createElement('div');
    batchContainer.id = 'print-batch-container';

    // 4. Renderiza cada item da celebração em sequência
    for (let i = 0; i < state.itens.length; i++) {
        const item = state.itens[i];
        const pageDiv = document.createElement('div');
        pageDiv.className = 'setlist-print-page';
        const momentoNome = MOMENTOS_MAP[item.momento] || item.momento || '';

        if (item.tipo === 'texto') {
            pageDiv.innerHTML = `
                <div class="print-song-header">
                    <div class="print-momento-badge">${escapeHtml(momentoNome)}</div>
                    <h1 class="print-song-title">${escapeHtml(item.titulo)}</h1>
                </div>
                <div class="print-text-content">${escapeHtml(item.conteudo || '')}</div>`;
        } else {
            const dadosCifra = state.cacheCifras[item.slug];
            if (!dadosCifra || !dadosCifra.conteudo) {
                pageDiv.innerHTML = `
                    <div class="print-song-header">
                        <div class="print-momento-badge">${escapeHtml(momentoNome)}</div>
                        <h1 class="print-song-title">${escapeHtml(item.titulo)}</h1>
                        <p class="print-song-artist">${escapeHtml(item.autor || '')}</p>
                    </div>
                    <p class="print-unavailable">Cifra não disponível no acervo.</p>`;
            } else {
                const tomOriginal = item.tomOriginal != null ? item.tomOriginal : 0;
                const tomCustom = item.tomCustom != null ? item.tomCustom : tomOriginal;
                const diff = ((tomCustom - tomOriginal) % 12 + 12) % 12;
                const notaCustomIdx = ((tomCustom % 12) + 12) % 12;
                const notaCustomNome = ESCALA_NOTAS[notaCustomIdx];
                let useSharps;
                if (toolbarState.forceSharps !== null) {
                    useSharps = toolbarState.forceSharps;
                } else {
                    useSharps = !['F', 'Bb', 'Eb', 'Ab', 'Db', 'Gb'].includes(notaCustomNome);
                }

                const resultado = typeof renderizarMusica === 'function'
                    ? renderizarMusica(dadosCifra.conteudo, diff, useSharps)
                    : (window.renderizarMusica ? window.renderizarMusica(dadosCifra.conteudo, diff, useSharps) : { html: '' });
                const cifraHtml = resultado.html ? resultado.html : resultado;
                const tomExibicao = converterTomParaExibicao(tomCustom);

                pageDiv.innerHTML = `
                    <div class="print-song-header">
                        <div class="print-momento-badge">${escapeHtml(momentoNome)}</div>
                        <h1 class="print-song-title">${escapeHtml(item.titulo)}</h1>
                        <p class="print-song-artist">${escapeHtml(item.autor || '')}</p>
                        <span class="print-song-tom">TOM: ${escapeHtml(tomExibicao)}</span>
                    </div>
                    <div class="print-cifra-render">${cifraHtml}</div>`;
            }
        }
        batchContainer.appendChild(pageDiv);
    }

    // 5. Insere no body, ativa modo de impressão em lote e dispara
    if (toolbarState.onlyText) batchContainer.classList.add('only-text-mode');
    document.body.appendChild(batchContainer);
    document.body.classList.add('print-batch-mode');
    setTimeout(() => { window.print(); }, 250);

    // 6. Limpeza automática após fechamento da janela de impressão
    window.onafterprint = () => {
        document.body.classList.remove('print-batch-mode');
        document.body.classList.remove('print-mode');
        const container = document.getElementById('print-batch-container');
        if (container) container.remove();
        window.onafterprint = null;
    };
}

/** Handler principal do botão de impressão */
function triggerPrintSetlist() {
    const isInApp = /Instagram|FBAN|FBAV|Twitter|TikTok/i.test(navigator.userAgent);
    if (isInApp) {
        mostrarAlertaAppExternoSetlist();
        return;
    }

    const totalMusicas = state.itens.filter(i => i.tipo === 'cifra').length;

    if (totalMusicas === 0) {
        document.body.classList.add('print-mode');
        setTimeout(() => { window.print(); }, 150);
        return;
    }

    mostrarModalEscolhaImpressao(totalMusicas);
}

function toggleAccidentalSetlist() {
    // Determina o useSharps atualmente efetivo (mesmo algoritmo do renderItemAtual)
    const item = state.itens[state.itemAtualIdx];
    if (!item || item.tipo === 'texto') return;

    const tomOriginal = item.tomOriginal != null ? item.tomOriginal : 0;
    const tomCustom = item.tomCustom != null ? item.tomCustom : tomOriginal;

    let currentUseSharps;
    if (toolbarState.forceSharps !== null) {
        currentUseSharps = toolbarState.forceSharps;
    } else {
        const notaCustomIdx = ((tomCustom % 12) + 12) % 12;
        const notaCustomNome = ESCALA_NOTAS[notaCustomIdx];
        currentUseSharps = !['F', 'Bb', 'Eb', 'Ab', 'Db', 'Gb'].includes(notaCustomNome);
    }

    toolbarState.forceSharps = !currentUseSharps;
    salvarToolbarPrefs();

    const btn = document.getElementById('btn-setlist-acc');
    if (btn) btn.innerText = toolbarState.forceSharps ? '#' : 'b';

    renderItemAtual();
}

function exibirAutoScrollSetlist() {
    const autoScrollContainer = document.getElementById('auto-scroll-container');
    if (autoScrollContainer) autoScrollContainer.classList.add('visible');
}

/* ============================================================
   RENDER: ITEM ATUAL
   ============================================================ */
function renderItemAtual() {
    const container = document.getElementById('setlist-content');
    if (!container) return;

    if (!state.celebracao || state.itens.length === 0) {
        container.innerHTML = `<div class="setlist-empty"><h2>Repertório vazio</h2><p>Nenhum item encontrado nesta celebração.</p></div>`;
        return;
    }

    if (state.itemAtualIdx < 0 || state.itemAtualIdx >= state.itens.length) {
        container.innerHTML = `<div class="setlist-empty"><h2>Fim do repertório</h2><p>Você chegou ao final da celebração.</p></div>`;
        return;
    }

    const item = state.itens[state.itemAtualIdx];
    const ehTexto = item.tipo === 'texto';

    // Atualiza navegação
    document.getElementById('btn-ant').disabled = state.itemAtualIdx <= 0;
    document.getElementById('btn-prox').disabled = state.itemAtualIdx >= state.itens.length - 1;
    const elTituloSetlist = document.getElementById('setlist-musica-titulo');
    const tituloTextoSetlist = (item.titulo || 'Item').trim();
    const dadosCacheSetlist = state.cacheCifras[item.slug];
    if (dadosCacheSetlist && dadosCacheSetlist.revisada === true) {
        const palavras = tituloTextoSetlist.split(' ');
        if (palavras.length > 1) {
            const ultimaPalavra = palavras.pop();
            const textoRestante = palavras.join(' ');
            elTituloSetlist.innerHTML = `${escapeHtml(textoRestante)} <span class="badge-wrapper-nowrap" aria-label="Cifra revisada">${escapeHtml(ultimaPalavra)} <i class="bi bi-patch-check-fill badge-revisada" title="Cifra revisada" aria-hidden="true"></i></span>`;
        } else {
            elTituloSetlist.innerHTML = `<span class="badge-wrapper-nowrap" aria-label="Cifra revisada">${escapeHtml(tituloTextoSetlist)} <i class="bi bi-patch-check-fill badge-revisada" title="Cifra revisada" aria-hidden="true"></i></span>`;
        }
    } else {
        elTituloSetlist.textContent = tituloTextoSetlist;
    }
    document.getElementById('setlist-progresso').textContent = `${state.itemAtualIdx + 1}/${state.itens.length}`;
    document.getElementById('setlist-momento').textContent = MOMENTOS_MAP[item.momento] || item.momento;
    document.title = `${item.titulo} | Setlist | Doze Teclas`;

    if (ehTexto) {
        container.innerHTML = `
            <div class="setlist-texto-item">
                <h3>${escapeHtml(item.titulo)}</h3>
                <p>${escapeHtml(item.conteudo || '')}</p>
            </div>`;
        // Oculta auto-scroll para itens de texto
        const ac = document.getElementById('auto-scroll-container');
        if (ac) ac.classList.remove('visible');
        return;
    }

    // Render cifra usando o motor oficial (music-engine.js)
    const dadosCifra = state.cacheCifras[item.slug];
    if (!dadosCifra || !dadosCifra.conteudo) {
        container.innerHTML = `<div class="setlist-loading">Carregando cifra...</div>`;
        // Fallback: recarrega assincronamente se o slug existir
        if (item.slug) {
            carregarCifraDoBanco(item.slug).then(data => {
                if (data && data.conteudo) {
                    state.cacheCifras[item.slug] = data;
                    renderItemAtual();
                } else {
                    container.innerHTML = `<div class="setlist-empty"><p>Cifra não encontrada no acervo.</p></div>`;
                }
            });
        }
        return;
    }

    const tomOriginal = item.tomOriginal != null ? item.tomOriginal : 0;
    const tomCustom = item.tomCustom != null ? item.tomCustom : tomOriginal;
    const diff = ((tomCustom - tomOriginal) % 12 + 12) % 12;

    // Detecta preferência sustenido/bemol (respeita forceSharps da toolbar)
    let useSharps;
    if (toolbarState.forceSharps !== null) {
        useSharps = toolbarState.forceSharps;
    } else {
        const notaCustomIdx = ((tomCustom % 12) + 12) % 12;
        const notaCustomNome = ESCALA_NOTAS[notaCustomIdx];
        useSharps = !['F', 'Bb', 'Eb', 'Ab', 'Db', 'Gb'].includes(notaCustomNome);
    }

    // Invoca o motor de renderização oficial (idêntico ao cifra.html)
    const resultado = typeof renderizarMusica === 'function'
        ? renderizarMusica(dadosCifra.conteudo, diff, useSharps)
        : (window.renderizarMusica ? window.renderizarMusica(dadosCifra.conteudo, diff, useSharps) : { html: '' });
    const cifraHtml = resultado.html ? resultado.html : resultado;

    const tomExibicao = converterTomParaExibicao(tomCustom);

    container.innerHTML = `
        <div class="song-header setlist-song-header">
            <h1 class="cifra-titulo">${escapeHtml(item.titulo)}</h1>
            <p class="cifra-subtitulo">${escapeHtml(item.autor || '')}</p>
        </div>
        <div class="tone-control-wrapper">
            <span class="label">TOM:</span>
            <div class="current-tone-badge" id="current-tone-display">${escapeHtml(tomExibicao)}</div>
            <div id="tone-popup"></div>
        </div>
        <div id="cifra-render" style="font-size:${toolbarState.fontSize}px;">
            ${cifraHtml}
        </div>`;

    // Aplica estado da toolbar sobre o #cifra-render recém-criado
    aplicarEstadoToolbar();

    // Setup do popup de tom (deve vir depois que o innerHTML foi injetado)
    setupSetlistTonePopup();

    // Event listener do controle de tom
    document.getElementById('current-tone-display')?.addEventListener('click', toggleSetlistTonePopup);

    // Exibe auto-scroll
    exibirAutoScrollSetlist();

    // Sincroniza label do botão de acidentes (sustenido/bemol)
    const btnAcc = document.getElementById('btn-setlist-acc');
    if (btnAcc) btnAcc.innerText = useSharps ? '#' : 'b';
}

/* ============================================================
   NAVEGAÇÃO ENTRE ITENS
   ============================================================ */
function irParaAnterior() {
    if (state.itemAtualIdx > 0) {
        state.itemAtualIdx--;
        renderItemAtual();
        atualizarDrawerAtivo();
    }
}

function irParaProximo() {
    if (state.itemAtualIdx < state.itens.length - 1) {
        state.itemAtualIdx++;
        renderItemAtual();
        atualizarDrawerAtivo();
    }
}

/* ============================================================
   DRAWER: ROTEIRO DA CELEBRAÇÃO
   ============================================================ */
function renderizarDrawer() {
    const drawerBody = document.getElementById('drawer-body');
    if (!drawerBody) return;
    if (!state.celebracao || state.itens.length === 0) {
        drawerBody.innerHTML = '<p class="drawer-empty">Nenhum item no roteiro.</p>'; return;
    }
    const grupos = {};
    for (const item of state.itens) {
        if (!grupos[item.momento]) grupos[item.momento] = [];
        grupos[item.momento].push(item);
    }
    let html = '';
    const ordemMomentos = Object.keys(MOMENTOS_MAP);
    for (const momentoId of ordemMomentos) {
        const itens = grupos[momentoId];
        if (!itens) continue;
        const label = MOMENTOS_MAP[momentoId] || momentoId;
        html += `<div class="drawer-momento-group"><p class="drawer-momento-label">${label}</p>`;
        for (const item of itens) {
            const ehAtivo = state.itens[state.itemAtualIdx]?.id === item.id;
            const tomVisual = item.tomCustom != null ? converterTomParaExibicao(item.tomCustom) : (item.tomOriginal != null ? converterTomParaExibicao(item.tomOriginal) : '--');
            const ehTexto = item.tipo === 'texto';
            html += `<div class="drawer-item ${ehAtivo ? 'active' : ''}" data-item-id="${item.id}">
                ${ehTexto ? '<span class="drawer-item-texto"><i class="bi bi-file-text"></i></span>' : ''}
                <span class="drawer-item-titulo">${escapeHtml(item.titulo)}</span>
                ${ehTexto ? '' : `<span class="drawer-item-tom">▶</span>`}
            </div>`;
        }
        html += `</div>`;
    }
    drawerBody.innerHTML = html;
    drawerBody.querySelectorAll('.drawer-item').forEach(el => {
        el.addEventListener('click', () => {
            const itemId = el.dataset.itemId;
            const idx = state.itens.findIndex(i => i.id === itemId);
            if (idx >= 0) { state.itemAtualIdx = idx; renderItemAtual(); fecharDrawer(); }
        });
    });
}

function atualizarDrawerAtivo() {
    const drawerBody = document.getElementById('drawer-body');
    if (!drawerBody) return;
    const todos = drawerBody.querySelectorAll('.drawer-item');
    todos.forEach(el => {
        const itemId = el.dataset.itemId;
        const ehAtivo = state.itens[state.itemAtualIdx]?.id === itemId;
        el.classList.toggle('active', ehAtivo);
    });
}

function abrirDrawer() {
    renderizarDrawer();
    document.getElementById('drawer').style.display = 'block';
    document.getElementById('drawer-overlay').style.display = 'block';
}

function fecharDrawer() {
    document.getElementById('drawer').style.display = 'none';
    document.getElementById('drawer-overlay').style.display = 'none';
}

/* ============================================================
   UTILITÁRIOS DE TELA
   ============================================================ */
function toggleFullscreen() {
    if (!document.fullscreenElement && !document.webkitFullscreenElement) {
        const el = document.documentElement;
        if (el.requestFullscreen) el.requestFullscreen();
        else if (el.webkitRequestFullscreen) el.webkitRequestFullscreen();
    } else {
        if (document.exitFullscreen) document.exitFullscreen();
        else if (document.webkitExitFullscreen) document.webkitExitFullscreen();
    }
}

/* ============================================================
   AUTO-SCROLL TOGGLE (Integrado com auto-scroll.js)
   ============================================================ */
function toggleAutoScroll() {
    const engine = window.autoScrollEngine;
    if (engine && typeof engine.toggleAutoScroll === 'function') {
        engine.toggleAutoScroll();
        // Sincroniza o ícone do botão do header com o estado do engine
        atualizarIconeAutoScroll();
    } else {
        setTimeout(() => {
            const eng = window.autoScrollEngine;
            if (eng && typeof eng.toggleAutoScroll === 'function') {
                eng.toggleAutoScroll();
                atualizarIconeAutoScroll();
            }
        }, 500);
    }
}

function atualizarIconeAutoScroll() {
    const engine = window.autoScrollEngine;
    const icon = document.getElementById('scroll-icon-setlist');
    if (engine && icon) {
        icon.className = engine.isScrolling ? 'bi bi-pause-fill' : 'bi bi-play-fill';
    }
}

/* ============================================================
   INICIALIZAÇÃO
   ============================================================ */
async function init() {
    carregarToolbarPrefs();

    const repId = getQueryParam('r');
    if (!repId) {
        document.getElementById('setlist-content').innerHTML = `<div class="setlist-empty"><h2>Repertório não especificado</h2><p>Use ?r=ID na URL ou <a href="repertorio.html" style="color:var(--accent)">volte ao repertório</a>.</p></div>`;
        document.getElementById('setlist-titulo').textContent = 'Nenhum repertório';
        return;
    }
    state.celebracao = carregarCelebracaoLocal(repId);
    if (!state.celebracao) {
        document.getElementById('setlist-content').innerHTML = `<div class="setlist-empty"><h2>Celebração não encontrada</h2><p>O repertório pode ter sido excluído. <a href="repertorio.html" style="color:var(--accent)">Voltar</a></p></div>`;
        document.getElementById('setlist-titulo').textContent = 'Não encontrado';
        return;
    }
    state.itens = ordenarItens(state.celebracao.itens.filter(i => i.tipo === 'cifra' || i.tipo === 'texto'));
    document.getElementById('setlist-titulo').textContent = state.celebracao.titulo;

    const slugsParaBuscar = state.itens.filter(i => i.tipo === 'cifra' && i.slug && !state.cacheCifras[i.slug]).map(i => i.slug);
    if (slugsParaBuscar.length > 0) {
        await Promise.all(slugsParaBuscar.map(slug => carregarCifraDoBanco(slug)));
    }

    state.itemAtualIdx = 0;
    renderItemAtual();

    document.getElementById('btn-ant')?.addEventListener('click', irParaAnterior);
    document.getElementById('btn-prox')?.addEventListener('click', irParaProximo);
    document.getElementById('btn-drawer')?.addEventListener('click', abrirDrawer);
    document.getElementById('btn-fechar-drawer')?.addEventListener('click', fecharDrawer);
    document.getElementById('drawer-overlay')?.addEventListener('click', fecharDrawer);
    document.getElementById('btn-fullscreen')?.addEventListener('click', toggleFullscreen);

    // ---------------------------------------------------------------
    // EVENTOS DA BARRA DE FERRAMENTAS (MODO PALCO)
    // ---------------------------------------------------------------
    document.getElementById('btn-setlist-zoom-out')?.addEventListener('click', () => changeZoomSetlist(-1));
    document.getElementById('btn-setlist-zoom-reset')?.addEventListener('click', resetZoomSetlist);
    document.getElementById('btn-setlist-zoom-in')?.addEventListener('click', () => changeZoomSetlist(1));
    document.getElementById('btn-setlist-toggle-txt')?.addEventListener('click', toggleTxtSetlist);
    document.getElementById('btn-setlist-acc')?.addEventListener('click', toggleAccidentalSetlist);
    document.getElementById('btn-setlist-columns')?.addEventListener('click', toggleColumnsSetlist);
    document.getElementById('btn-setlist-print')?.addEventListener('click', triggerPrintSetlist);

    // ---------------------------------------------------------------
    // FECHA POPUP DE TOM AO CLICAR FORA
    // ---------------------------------------------------------------
    document.addEventListener('click', (e) => {
        const popup = document.getElementById('tone-popup');
        const badge = document.getElementById('current-tone-display');
        if (popup && popup.style.display === 'grid') {
            const clickedInside = (badge && badge.contains(e.target)) ||
                                  popup.contains(e.target);
            if (!clickedInside) toggleSetlistTonePopup();
        }
    });

    document.addEventListener('keydown', (e) => {
        if (e.key === 'ArrowRight' || e.key === 'ArrowDown') irParaProximo();
        if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') irParaAnterior();
        if (e.key === 'Escape') {
            const popupTone = document.getElementById('tone-popup');
            if (popupTone && popupTone.style.display === 'grid') {
                toggleSetlistTonePopup();
            } else {
                fecharDrawer();
            }
        }
        // Atalhos da toolbar (ignora se input estiver focado)
        if (document.activeElement && document.activeElement.tagName === 'INPUT') return;
        if (e.key === '+' || e.key === '=') { e.preventDefault(); changeZoomSetlist(1); }
        if (e.key === '-') { e.preventDefault(); changeZoomSetlist(-1); }
        if (e.key === '0') { e.preventDefault(); resetZoomSetlist(); }
    });

    // Theme toggle
    const btnTheme = document.getElementById('btn-theme-toggle-setlist');
    if (btnTheme) {
        const aplicar = (tema) => {
            const icone = document.getElementById('theme-toggle-icon-setlist');
            document.body.classList.toggle('light-theme', tema === 'light');
            if (icone) icone.className = tema === 'light' ? 'bi bi-toggle-on' : 'bi bi-toggle-off';
        };
        const salvo = localStorage.getItem('theme') || 'dark';
        aplicar(salvo);
        btnTheme.addEventListener('click', () => {
            const novoTema = document.body.classList.contains('light-theme') ? 'dark' : 'light';
            aplicar(novoTema);
            localStorage.setItem('theme', novoTema);
        });
    }
}

/* ============================================================
   STARTUP (compatível com type="module")
   ============================================================ */
// Como setlist.js é type="module", o DOM já está pronto e DOMContentLoaded já disparou.
// Verificamos o Supabase e iniciamos imediatamente ou via polling.
function iniciarQuandoPronto() {
    const check = setInterval(() => {
        if (window._supabase || typeof _supabase !== 'undefined') {
            clearInterval(check);
            init();
        }
    }, 50);
    setTimeout(() => { clearInterval(check); init(); }, 5000);
}

if (window._supabase || typeof _supabase !== 'undefined') {
    init();
} else {
    iniciarQuandoPronto();
}

