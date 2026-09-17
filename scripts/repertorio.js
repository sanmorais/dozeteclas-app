// repertorio.js - Gerenciamento de Repertórios Litúrgicos (localStorage)
// Depende de: supabase-db.js (window._supabase), theme-toggle.js

/* ============================================================
   CONSTANTES
   ============================================================ */
const STORAGE_KEY = 'doze_repertorios';
const ESCALA_NOTAS = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
const MOMENTOS = [
    { id: 'entrada',      label: 'Entrada' },
    { id: 'ato',          label: 'Ato Penitencial' },
    { id: 'gloria',       label: 'Glória' },
    { id: 'refrao_meditativo', label: 'Refrão Meditativo' },
    { id: 'salmo',        label: 'Salmo' },
    { id: 'aclamacao',    label: 'Aclamação' },
    { id: 'homilia',      label: 'Homilia' },
    { id: 'ofertorio',    label: 'Ofertório' },
    { id: 'santo',        label: 'Santo' },
    { id: 'amem',         label: 'Amém' },
    { id: 'cordeiro',     label: 'Cordeiro' },
    { id: 'comunhao',     label: 'Comunhão' },
    { id: 'oracao',       label: 'Oração / Pós-Comunhão' },
    { id: 'final',        label: 'Final' },
    { id: 'homenagem',    label: 'Homenagem' },
    { id: 'adoracao',     label: 'Adoração' }
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

// 🔍 Cache em memória da lista resumida de cifras (titulo, autor, slug, tom, tags)
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

/* ============================================================
   TOAST NOTIFICATION (standalone, sem dependência de smart-bar)
   ============================================================ */
function mostrarToast(mensagem, tipo = 'info') {
    // Remove toast anterior se existir
    const existente = document.querySelector('.repertorio-toast');
    if (existente) existente.remove();

    const toast = document.createElement('div');
    toast.className = 'repertorio-toast';
    toast.textContent = mensagem;

    const cores = {
        success: { bg: '#065f46', border: '#34d399', color: '#ecfdf5' },
        error:   { bg: '#7f1d1d', border: '#f87171', color: '#fef2f2' },
        info:    { bg: '#1e3a5f', border: '#60a5fa', color: '#eff6ff' }
    };
    const c = cores[tipo] || cores.info;

    toast.style.cssText = `
        position: fixed; bottom: 24px; left: 50%; transform: translateX(-50%);
        z-index: 99999; padding: 12px 24px; border-radius: 8px; font-size: 14px;
        font-weight: 600; max-width: 90vw; text-align: center; white-space: nowrap;
        background: ${c.bg}; border: 1px solid ${c.border}; color: ${c.color};
        box-shadow: 0 4px 20px rgba(0,0,0,0.5); transition: opacity 0.3s ease;
        animation: toastSlideUp 0.3s ease;
    `;

    document.body.appendChild(toast);

    setTimeout(() => {
        toast.style.opacity = '0';
        setTimeout(() => { if (toast.parentNode) toast.remove(); }, 300);
    }, 3000);
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

/* ============================================================
   COMPARTILHAMENTO DE REPERTÓRIO (Supabase)
   ============================================================ */

/**
 * Limpa o payload da celebração para compartilhamento,
 * removendo IDs locais e dados desnecessários.
 */
function limparPayloadParaCompartilhamento(celeb) {
    return {
        titulo: celeb.titulo || '',
        data: celeb.data || '',
        itens: (celeb.itens || []).map(item => ({
            momento: item.momento || '',
            tipo: item.tipo || 'cifra',
            slug: item.slug || '',
            titulo: item.titulo || '',
            autor: item.autor || '',
            tomOriginal: item.tomOriginal != null ? item.tomOriginal : null,
            tomCustom: item.tomCustom != null ? item.tomCustom : null,
            observacao: item.observacao || '',
            conteudo: item.conteudo || ''
        }))
    };
}

/**
 * Gera um hash aleatório curto para usar como ID do link compartilhado.
 * @param {number} tamanho - comprimento do hash (default 6)
 * @returns {string} hash alfanumérico minúsculo
 */
function gerarHashCurto(tamanho = 6) {
    const caracteres = 'abcdefghijklmnopqrstuvwxyz0123456789';
    let hash = '';
    for (let i = 0; i < tamanho; i++) {
        hash += caracteres.charAt(Math.floor(Math.random() * caracteres.length));
    }
    return hash;
}

/**
 * 🔗 Popula o campo de URL no card da celebração (share-url-container).
 * Exibe o container, define o valor do input e garante que o botão [Copiar]
 * capture um clique direto do usuário (evitando o bloqueio da Clipboard API
 * após requisições assíncronas do Supabase).
 */
function popularUrlNoCard(celebracaoId, url) {
    const card = document.querySelector(`.celebracao-card[data-id="${celebracaoId}"]`);
    if (!card) return;
    const container = card.querySelector('.share-url-container');
    const input = card.querySelector('.share-url-input');
    if (container) container.style.display = 'flex';
    if (input) input.value = url;
}

/**
 * 📋 Copia o link do input para a área de transferência.
 * Chamado diretamente pelo onclick no botão [Copiar] — clique direto do usuário,
 * portanto a permissão da Clipboard API é garantida.
 * Fallback: input.select() + document.execCommand('copy') para navegadores restritivos.
 */
function copiarLinkDoInput(btn) {
    const container = btn.closest('.share-url-container');
    if (!container) return;
    const input = container.querySelector('.share-url-input');
    if (!input || !input.value) return;

    const textoOriginal = btn.innerHTML;
    const sucesso = () => {
        btn.innerHTML = '<i class="bi bi-check-lg"></i> Copiado!';
        btn.classList.add('copiado');
        setTimeout(() => {
            btn.innerHTML = textoOriginal;
            btn.classList.remove('copiado');
        }, 2000);
    };

    // Tenta Clipboard API primeiro (moderno)
    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(input.value).then(() => {
            sucesso();
            if (typeof gtag === 'function') {
                gtag('event', 'copiar_link_repertorio', {
                    event_category: 'repertorio',
                    event_label: input.value
                });
            }
        }).catch(() => {
            // Fallback: selecionar + execCommand
            input.select();
            input.setSelectionRange(0, 99999);
            try {
                document.execCommand('copy');
                sucesso();
            } catch (e) {
                mostrarToast('📋 Pressione Ctrl+C para copiar o link.', 'info');
            }
        });
    } else {
        // Fallback para navegadores sem Clipboard API
        input.select();
        input.setSelectionRange(0, 99999);
        try {
            document.execCommand('copy');
            sucesso();
        } catch (e) {
            mostrarToast('📋 Pressione Ctrl+C para copiar o link.', 'info');
        }
    }
}
// 🔓 Expõe no escopo global para uso via onclick inline (módulo ES6)
window.copiarLinkDoInput = copiarLinkDoInput;

/**
 * Compartilha/atualiza uma celebração via Supabase:
 * - Se a celebração já foi compartilhada antes (possui sharedId), faz UPSERT no registro existente.
 * - Caso contrário, cria um novo registro e armazena o sharedId na celebração.
 * Exibe a URL no card com botão de cópia manual (evita bloqueio da Clipboard API pós-async).
 */
async function compartilharCelebracao(id) {
    const celeb = buscarCelebracaoPorId(id);
    if (!celeb) {
        mostrarToast('❌ Celebração não encontrada.', 'error');
        return;
    }

    const instancia = window._supabase || (typeof _supabase !== 'undefined' ? _supabase : null);
    if (!instancia) {
        mostrarToast('⏳ Conectando ao servidor... Tente novamente.', 'info');
        return;
    }

    // 🔁 Reaproveita o sharedId existente para atualizar o mesmo registro
    const isUpdate = !!celeb.sharedId;
    const shortId = celeb.sharedId || gerarHashCurto(6);

    // Sanitiza o payload: JSON.parse(JSON.stringify(...)) remove undefined e garante JSON limpo
    const payloadLimpo = JSON.parse(JSON.stringify(limparPayloadParaCompartilhamento(celeb)));
    const body = { id: shortId, payload: payloadLimpo };

    console.log('[repertorio] 🔍 DEBUG —', isUpdate ? 'UPSERT (atualização)' : 'INSERT (novo)', '— id:', shortId,
                '| payload:', JSON.stringify(body).substring(0, 200));

    try {
        if (isUpdate) {
            // Atualiza o registro existente — mesmo link, dados novos
            const { error } = await instancia
                .from('repertorios_compartilhados')
                .upsert(body);
            if (error) throw error;

            const urlCurta = `https://dozeteclas.com.br/setlist.html?id=${shortId}`;
            // ✅ Atualiza o campo de URL visível no card (se já estiver visível)
            popularUrlNoCard(id, urlCurta);
            mostrarToast('✅ Repertório atualizado no link de compartilhamento!', 'success');

            if (typeof gtag === 'function') {
                gtag('event', 'atualizar_repertorio', {
                    event_category: 'repertorio',
                    event_label: celeb.titulo,
                    method: 'supabase_upsert'
                });
            }
        } else {
            // Novo compartilhamento: insere e salva o sharedId na celebração
            const { error } = await instancia
                .from('repertorios_compartilhados')
                .insert(body);
            if (error) throw error;

            // ✅ Guarda o sharedId na celebração para futuras atualizações
            celeb.sharedId = shortId;
            salvarCelebracoes();

            const urlCurta = `https://dozeteclas.com.br/setlist.html?id=${shortId}`;
            // ✅ Exibe a URL no card com botão de cópia manual garantido
            popularUrlNoCard(id, urlCurta);
            mostrarToast('🔗 Link gerado! Use o botão [Copiar] no card.', 'success');
        }
    } catch (err) {
        // 🔬 LOG ULTRA-DETALHADO para diagnóstico
        console.error('[repertorio] ❌ Erro ao compartilhar — DIAGNÓSTICO COMPLETO:');
        console.error('  Modo:', isUpdate ? 'UPSERT' : 'INSERT', '| id:', shortId);
        console.error('  Tipo:', typeof err, '| Construtor:', err?.constructor?.name);
        console.error('  Keys próprias:', Object.keys(err || {}));
        console.error('  Todas as props:', Object.getOwnPropertyNames(err || {}));
        try { console.error('  JSON.stringify:', JSON.stringify(err)); } catch (e) { console.error('  (não serializável)'); }
        console.error('  message:', err?.message);
        console.error('  code:', err?.code);
        console.error('  details:', err?.details);
        console.error('  hint:', err?.hint);
        console.error('  status:', err?.status);
        console.error('  statusCode:', err?.statusCode);
        console.error('  error:', err?.error);
        console.error('  causa:', err?.cause);
        console.error('  Objeto cru:', err);

        // Tenta extrair corpo se for Response
        if (err && typeof err.json === 'function') {
            try {
                const bodyText = await err.text();
                console.error('[repertorio] 📨 Corpo da resposta HTTP:', bodyText);
            } catch (bodyErr) {
                console.error('[repertorio] (não foi possível ler corpo da resposta)');
            }
        }

        // Fallback: tenta upsert para colisão de hash
        if (err?.code === '23505') {
            console.warn('[repertorio] ⚠️ Colisão de hash, tentando upsert...');
            try {
                const { error: upsertErr } = await instancia
                    .from('repertorios_compartilhados')
                    .upsert(body);
                if (upsertErr) throw upsertErr;

                // Se for novo compartilhamento, salva o sharedId
                if (!isUpdate) {
                    celeb.sharedId = shortId;
                    salvarCelebracoes();
                }

                const urlCurta = `https://dozeteclas.com.br/setlist.html?id=${shortId}`;
                if (!isUpdate) {
                    popularUrlNoCard(id, urlCurta);
                    mostrarToast('🔗 Link gerado! Use o botão [Copiar] no card.', 'success');
                } else {
                    mostrarToast('✅ Repertório atualizado!', 'success');
                }
                return;
            } catch (upsertErr) {
                console.error('[repertorio] ❌ Upsert também falhou:', upsertErr?.message || upsertErr);
            }
        }

        if (err?.code === '42501' || (err?.message && err.message.includes('permission'))) {
            mostrarToast('🔒 Permissão negada. Verifique as políticas RLS no Supabase.', 'error');
        } else if (err?.code === '23505') {
            mostrarToast('⚠️ Link já existe. Tentando novamente...', 'info');
        } else {
            mostrarToast('❌ Erro ao gerar link. Verifique sua conexão.', 'error');
        }
    }
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
            .select('titulo, autor, slug, tom, tags')
            .order('titulo', { ascending: true });

        if (error) throw error;
        cacheBuscaCifras = data || [];
    } catch (err) {
        console.error('Erro ao carregar cache de busca de cifras:', err);
        cacheBuscaCifras = [];
    }
    return cacheBuscaCifras;
}

async function buscarCifrasNoBanco(termo, tagFiltro = '') {
    const termoNorm = normalizarTexto(termo);
    const tagAtiva = tagFiltro && tagFiltro.trim() !== '';

    // Só bloqueia por texto curto se NÃO houver tag selecionada
    if (termoNorm.length < 2 && !tagAtiva) return [];

    try {
        const lista = await carregarCacheBuscaCifras();
        if (!lista) {
            console.warn('Supabase ainda não carregado, aguardando...');
            return [];
        }
        return filtrarResultados(lista, termoNorm, tagFiltro);
    } catch (err) {
        console.error('Erro ao buscar cifras:', err);
        return [];
    }
}

function filtrarResultados(lista, termoNorm, tagFiltro = '') {
    const termoVazio = !termoNorm || termoNorm.length < 2;
    const tagVazia = !tagFiltro || tagFiltro === '';

    return (lista || []).filter(m => {
        // Filtro de texto
        const passaTexto = termoVazio || (() => {
            const tituloNorm = normalizarTexto(m.titulo || '');
            const autorNorm = normalizarTexto(m.autor || '');
            return tituloNorm.includes(termoNorm) || autorNorm.includes(termoNorm);
        })();

        if (!passaTexto) return false;

        // Filtro de tag (string separada por vírgulas) — com higienização
        if (tagVazia) return true;
        const tagsRaw = (m.tags || '').toLowerCase();
        const tagsArr = tagsRaw.split(',').map(t => higienizarTag(t)).filter(Boolean);
        const tagFiltroLimpa = higienizarTag(tagFiltro);
        return tagsArr.includes(tagFiltroLimpa);
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
        tags: r.tags || '',
        tomOriginal: r.tom != null ? parseInt(r.tom, 10) : null
    };
}

/* ============================================================
   EXTRAÇÃO E POPULAÇÃO DE TAGS (Filtro Litúrgico)
   ============================================================ */

// 🏷️ Dicionário configurável de formatação visual de tags
// Chave: tag higienizada (minúscula, sem acentos). Valor: rótulo visual com acentuação e capitalização.
// Tags não mapeadas recebem fallback: primeira letra maiúscula sobre o texto original.
const DICIONARIO_TAGS = {
    'adoracao': 'Adoração',
    'oracao': 'Oração',
    'animacao': 'Animação',
    'reflexao': 'Reflexão',
    'aclamacao': 'Aclamação',
    'comunhao': 'Comunhão',
    'gloria': 'Glória',
    'bencao': 'Bênção',
    'espirito': 'Espírito',
    'espiritosanto': 'Espírito Santo',
    'louvor': 'Louvor',
    'entrada': 'Entrada',
    'ato': 'Ato Penitencial',
    'ofertorio': 'Ofertório',
    'santo': 'Santo',
    'cordeiro': 'Cordeiro',
    'amem': 'Amém',
    'final': 'Final',
    'quaresma': 'Quaresma',
    'cruz': 'Cruz',
    'maria': 'Maria',
    'casamento': 'Casamento',
    'amizade': 'Amizade',
    'familia': 'Família',
    'balada': 'Balada',
    'gospel': 'Gospel',
    'cerco': 'Cerco de Jericó'
};

/**
 * Higieniza uma tag crua (vinda do banco ou digitada):
 * - Remove aspas simples/duplas, colchetes, chaves e espaços extras
 * - Converte para minúsculas e remove acentos (NFD)
 * - Normaliza espaços múltiplos para um único espaço
 * @param {string} raw - Tag bruta
 * @returns {string} Tag higienizada (minúscula, sem acentos, sem lixo)
 */
function higienizarTag(raw) {
    if (!raw) return '';
    return String(raw)
        .toLowerCase()
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // remove acentos
        .replace(/["'«»„‟‚‛「」『』\[\]\{\}]/g, '')        // remove aspas, colchetes, chaves
        .replace(/\s+/g, ' ')                                // normaliza espaços
        .trim();
}

/**
 * Retorna o rótulo visual formatado para exibição de uma tag.
 * Consulta o DICIONARIO_TAGS primeiro; se não encontrar, aplica fallback:
 * capitaliza a primeira letra do texto original (higienizado sem remover acentos).
 * @param {string} tagHigienizada - Tag já higienizada (minúscula, sem acentos)
 * @param {string} [textoOriginal] - Texto original antes da higienização (para fallback)
 * @returns {string} Rótulo visual formatado
 */
function formatarTagVisual(tagHigienizada, textoOriginal) {
    if (!tagHigienizada) return '';
    // Consulta o dicionário primeiro
    if (DICIONARIO_TAGS[tagHigienizada]) {
        return DICIONARIO_TAGS[tagHigienizada];
    }
    // Fallback: usa o texto original (com acentos) ou a tag higienizada, capitalizando
    const base = (textoOriginal || tagHigienizada).trim();
    return base.charAt(0).toUpperCase() + base.slice(1);
}

// Catálogo base de tags litúrgicas conhecidas (fallback) — já higienizadas
const TAGS_CONHECIDAS = [
    'adoracao', 'santo', 'aclamacao', 'cordeiro', 'comunhao', 'louvor',
    'entrada', 'gloria', 'ato', 'ofertorio', 'reflexao', 'espirito',
    'maria', 'animacao', 'oracao', 'quaresma', 'cruz', 'casamento',
    'amizade', 'familia', 'salmo', 'amem'
];

function extrairTagsUnicas() {
    const tagsSet = new Set(TAGS_CONHECIDAS);
    if (cacheBuscaCifras) {
        cacheBuscaCifras.forEach(m => {
            const raw = (m.tags || '').toLowerCase();
            raw.split(',').map(t => t.trim()).filter(Boolean).forEach(t => {
                const higienizada = higienizarTag(t);
                if (higienizada) tagsSet.add(higienizada);
            });
        });
    }
    return [...tagsSet].sort((a, b) => a.localeCompare(b, 'pt-BR'));
}

function popularDropdownTags() {
    const select = document.getElementById('filtro-tag-musica');
    if (!select) return;
    const tags = extrairTagsUnicas();
    select.innerHTML = '<option value="">Todas as categorias</option>' +
        tags.map(t => {
            const rotulo = formatarTagVisual(t);
            return `<option value="${t}">${escapeHtml(rotulo)}</option>`;
        }).join('');
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
        // 🔗 Se a celebração já foi compartilhada, exibe o link automaticamente
        const temSharedId = !!c.sharedId;
        const urlCompartilhada = temSharedId ? `https://dozeteclas.com.br/setlist.html?id=${c.sharedId}` : '';
        return `
            <div class="celebracao-card" data-id="${escapeHtml(c.id)}">
                <div class="celebracao-card-row">
                    <div class="celebracao-info">
                        <h3 class="celebracao-titulo">${escapeHtml(c.titulo)}</h3>
                        <div class="celebracao-meta">
                            <span class="celebracao-data"><i class="bi bi-calendar3-event"></i>  ${escapeHtml(dataFmt)}</span>
                            <span class="celebracao-count">${totalItens} itens</span>
                        </div>
                    </div>
                    <div class="celebracao-actions">
                        <button class="btn-action-card btn-edit-list" data-id="${escapeHtml(c.id)}" title="Editar"><i class="bi bi-pencil"></i></button>
                        <button class="btn-action-card btn-setlist" data-id="${escapeHtml(c.id)}" title="Executar"><i class="bi bi-play-fill"></i></button>
                        <button class="btn-action-card btn-del btn-del-list" data-id="${escapeHtml(c.id)}" title="Excluir"><i class="bi bi-trash"></i></button>
                    </div>
                </div>
                <div class="share-url-container" style="${temSharedId ? '' : 'display:none;'}">
                    <input type="text" class="share-url-input" value="${escapeHtml(urlCompartilhada)}" readonly onclick="this.select()">
                    <button type="button" class="btn-copiar-link" onclick="copiarLinkDoInput(this)">
                        <i class="bi bi-clipboard"></i> Copiar
                    </button>
                </div>
            </div>`;
    }).join('');

    // Eventos nos cards
    container.querySelectorAll('.celebracao-card').forEach(card => {
        card.addEventListener('click', (e) => {
            if (e.target.closest('.btn-edit-list') || e.target.closest('.btn-setlist') || e.target.closest('.btn-del-list') || e.target.closest('.btn-copiar-link') || e.target.closest('.share-url-input')) return;
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
                    <button class="btn-add-slot btn-add-texto" data-momento="${m.id}" style="margin-top:4px;border-color:rgba(255,255,255,0.03);font-size:0.75rem;"><i class="bi bi-file-text"></i> Adicionar Anotação</button>
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
/**
 * Retorna o filtro de tag correspondente a um momento litúrgico
 * para pré-seleção contextual ao abrir o modal de busca de cifras.
 * Retorna '' (vazio) para momentos que devem mostrar "Todas as categorias".
 * @param {string} momentoId - ID interno do momento litúrgico
 * @returns {string} Valor da tag a ser pré-selecionada ou '' para "todos"
 */
function obterFiltroPorMomento(momentoId) {
    if (!momentoId) return '';

    const m = momentoId.toLowerCase().trim();

    // Mapeamento explícito: momentos → tag normalizada
    const MAPA = {
        'santo':      'santo',
        'amem':       'amem',
        'salmo':      'salmo',
        'entrada':    'entrada',
        'ato':        'ato',
        'gloria':     'gloria',
        'aclamacao':  'aclamacao',
        'ofertorio':  'ofertorio',
        'cordeiro':   'cordeiro',
        'comunhao':   'comunhao',
        'adoracao':   'adoracao'
    };

    if (MAPA.hasOwnProperty(m)) {
        return MAPA[m];
    }

    // Momentos que devem exibir "Todos" (sem filtro ativo):
    // 'refrao_meditativo', 'homilia', 'oracao' (Pós-Comunhão),
    // 'final', 'homenagem' e quaisquer outros não mapeados
    return '';
}

function abrirModalBusca(momentoId) {
    console.log('[repertorio] abrirModalBusca — momentoAlvo:', momentoId, '| editandoId:', state.editandoId);
    momentoAlvoBusca = momentoId;
    document.getElementById('input-busca-cifra').value = '';
    document.getElementById('resultados-busca').innerHTML = '<p class="busca-placeholder">Digite ao menos 2 caracteres para buscar...</p>';
    document.getElementById('modal-busca').style.display = 'flex';

    // 🔥 Pré-carrega o cache de busca em background ao abrir o modal,
    // para que a primeira digitação já encontre a lista em memória.
    carregarCacheBuscaCifras().then(() => {
        popularDropdownTags();

        // 🏷️ Pré-seleção contextual inteligente: mapeia momentoId → tag correspondente
        const select = document.getElementById('filtro-tag-musica');
        if (select && momentoId) {
            const filtro = obterFiltroPorMomento(momentoId);
            if (filtro) {
                // Tag específica: verifica se a opção existe no dropdown e seleciona
                const option = Array.from(select.options).find(o => o.value === filtro);
                if (option) {
                    select.value = filtro;
                    // Dispara busca inicial com a tag pré-selecionada
                    executarBuscaComFiltros();
                } else {
                    // Tag não disponível no dropdown → fallback para "todos"
                    select.value = '';
                }
            } else {
                // "todos": sem filtro ativo
                select.value = '';
            }
        }
    });

    setTimeout(() => document.getElementById('input-busca-cifra').focus(), 100);
}

function fecharModalBusca() {
    console.log('[repertorio] fecharModalBusca — momentoAlvo anterior:', momentoAlvoBusca);
    document.getElementById('modal-busca').style.display = 'none';
    momentoAlvoBusca = '';
}

// 🔍 Função unificada de filtragem: acionada pelo input de texto E pelo dropdown de tags
async function executarBuscaComFiltros() {
    const inputBusca = document.getElementById('input-busca-cifra');
    const selectTag = document.getElementById('filtro-tag-musica');
    const termo = inputBusca ? inputBusca.value.trim() : '';
    const tagFiltro = selectTag ? selectTag.value : '';

    if (termo.length < 2 && !tagFiltro) {
        document.getElementById('resultados-busca').innerHTML = '<p class="busca-placeholder">Digite ao menos 2 caracteres ou selecione uma categoria...</p>';
        return;
    }

    const resultados = await buscarCifrasNoBanco(termo, tagFiltro);
    renderizarResultadosBusca(resultados);
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

        // 🏷️ Chips de tags (máx 3 para não poluir) — com higienização e formatação visual
        const tagsRaw = (dados.tags || '').toLowerCase();
        const tagsArr = tagsRaw.split(',').map(t => t.trim()).filter(Boolean).slice(0, 3);
        const tagsHtml = tagsArr.length > 0
            ? `<div class="resultado-tags">${tagsArr.map(t => {
                const limpa = higienizarTag(t);
                const rotulo = formatarTagVisual(limpa, t);
                return `<span class="resultado-tag">${escapeHtml(rotulo)}</span>`;
            }).join('')}</div>`
            : '';

        return `<div class="resultado-item" data-slug="${attrSlug}" data-titulo="${attrTitulo}" data-autor="${attrAutor}" data-tom="${attrTom}">
            <div class="resultado-info"><p class="resultado-titulo">${escapeHtml(dados.titulo)}</p><p class="resultado-autor">${escapeHtml(dados.autor)}</p>${tagsHtml}</div>
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

    // Converte o valor armazenado (deslocado em +3) para índice 0-11 da ESCALA_NOTAS
    const storedTom = (item.tomCustom != null ? item.tomCustom : item.tomOriginal) || 0;
    const popoverIdx = ((storedTom - 3 + 12) % 12);

    const rect = btnRef.getBoundingClientRect();
    const popover = document.createElement('div');
    popover.className = 'transpose-popover';
    popover.style.top = (rect.bottom + 8) + 'px';
    popover.style.left = Math.max(8, rect.left) + 'px';
    popover.style.position = 'fixed';
    popover.innerHTML = `<p class="popover-label">Tom: ${escapeHtml(item.titulo)}</p><div class="popover-notes">${ESCALA_NOTAS.map((nota, i) => `<button class="popover-note-btn ${i === popoverIdx ? 'active' : ''}" data-nota-idx="${i}">${nota}</button>`).join('')}</div>`;
    document.body.appendChild(popover);
    popoverAtivo = popover;
    popover.querySelectorAll('.popover-note-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const popoverIdxSelecionado = parseInt(btn.dataset.notaIdx, 10);
            // Converte índice do popover (0-11) de volta para valor armazenado (deslocado em +3)
            const novoTomCustom = (popoverIdxSelecionado + 3) % 12;
            atualizarItem(state.editandoId, itemId, { tomCustom: novoTomCustom });

            // Atualização imediata do botão no card (antes do re-render completo)
            const btnTomCard = document.querySelector(`.slot-item[data-item-id="${itemId}"] .btn-transpose-slot`);
            if (btnTomCard) {
                btnTomCard.textContent = ESCALA_NOTAS[popoverIdxSelecionado];
            }

            popover.remove();
            popoverAtivo = null;
            renderizarEditor();
        });
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

async function salvarCelebracaoAtual() {
    const titulo = document.getElementById('input-titulo').value.trim();
    const data = document.getElementById('input-data').value;

    if (!titulo) { alert('Por favor, defina um título para a celebração.'); return; }

    // 1. Salvar localmente (localStorage)
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

    // 2. Garantir sharedId e sincronizar com Supabase (upsert automático)
    const celeb = buscarCelebracaoPorId(state.editandoId);
    if (celeb) {
        await sincronizarCelebracaoNoSupabase(celeb);
    }

    // 3. Voltar para a listagem (o toast já foi exibido na sincronização)
    mostrarLista();
}

/**
 * 🔄 Sincroniza a celebração com o Supabase via upsert.
 * Garante que o sharedId existe (gerando se necessário) e faz o upsert
 * na tabela repertorios_compartilhados de forma resiliente.
 * @param {Object} celeb - objeto celebração (já salvo no localStorage)
 */
async function sincronizarCelebracaoNoSupabase(celeb) {
    const instancia = window._supabase || (typeof _supabase !== 'undefined' ? _supabase : null);
    if (!instancia) {
        mostrarToast('⏳ Sem conexão com o servidor. Salvo apenas localmente.', 'info');
        return;
    }

    // Garante sharedId permanente
    if (!celeb.sharedId) {
        celeb.sharedId = gerarHashCurto(6);
        salvarCelebracoes(); // persiste o sharedId imediatamente
    }

    const payloadLimpo = JSON.parse(JSON.stringify(limparPayloadParaCompartilhamento(celeb)));
    const body = { id: celeb.sharedId, payload: payloadLimpo };

    try {
        const { error } = await instancia
            .from('repertorios_compartilhados')
            .upsert(body);

        if (error) throw error;

        mostrarToast('✅ Playlist salva e atualizada no link!', 'success');

        if (typeof gtag === 'function') {
            gtag('event', 'salvar_sincronizar_repertorio', {
                event_category: 'repertorio',
                event_label: celeb.titulo
            });
        }
    } catch (err) {
        console.error('[repertorio] Erro ao sincronizar com Supabase:', err?.message || err);
        // Fallback resiliente: tenta uma segunda vez após 1s (problemas de rede intermitentes)
        setTimeout(async () => {
            try {
                const { error: retryErr } = await instancia
                    .from('repertorios_compartilhados')
                    .upsert(body);
                if (retryErr) throw retryErr;
                mostrarToast('✅ Playlist salva e atualizada no link!', 'success');
            } catch (retryError) {
                console.error('[repertorio] Retry também falhou:', retryError?.message || retryError);
                mostrarToast('⚠️ Salvo localmente. Sincronização pendente — tente novamente.', 'info');
            }
        }, 1000);
    }
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

    // Busca unificada com debounce: input de texto + dropdown de tags
    const inputBusca = document.getElementById('input-busca-cifra');
    const selectTag = document.getElementById('filtro-tag-musica');

    if (inputBusca) {
        let timeoutId;
        inputBusca.addEventListener('input', () => {
            clearTimeout(timeoutId);
            timeoutId = setTimeout(() => executarBuscaComFiltros(), 300);
        });
    }

    if (selectTag) {
        selectTag.addEventListener('change', () => executarBuscaComFiltros());
    }

    // 🔥 SINCRONIZAÇÃO IMEDIATA: Título e Data → objeto de estado em memória
    // Resolve a perda de estado ao adicionar/remover cifras, que re-renderiza o editor
    // e sobrescrevia os inputs com os valores obsoletos do objeto.
    const inputTitulo = document.getElementById('input-titulo');
    const inputData = document.getElementById('input-data');

    if (inputTitulo) {
        inputTitulo.addEventListener('input', () => {
            if (state.editandoId) {
                const celeb = buscarCelebracaoPorId(state.editandoId);
                if (celeb) celeb.titulo = inputTitulo.value;
            }
        });
    }

    if (inputData) {
        const sincronizarData = () => {
            if (state.editandoId) {
                const celeb = buscarCelebracaoPorId(state.editandoId);
                if (celeb) celeb.data = inputData.value;
            }
        };
        inputData.addEventListener('input', sincronizarData);
        inputData.addEventListener('change', sincronizarData); // calendário dispara 'change'
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