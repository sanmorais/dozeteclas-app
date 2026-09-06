// ui-controls.js - O Maestro da Interface (Doze Teclas)

import { parseAcorde, renderMiniTeclado } from './chord-diagram-engine.js';
import { slugify } from './slug-utils.js';

// 🛡️ SANITIZAÇÃO ANTI-XSS: Escapa caracteres HTML antes de injetar texto (títulos, artistas)
// vindo do Supabase via innerHTML, impedindo execução de <script> ou tags maliciosas.
function escapeHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}
// Função utilitária para normalização de texto (insensível a acentos e cedilhas)
function normalizarTexto(str) {
    return (str || '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .trim();
}



let musicaBase = null;

let tomAtualIdx = 0;       // Índice da nota selecionada no momento
let tomOriginalIdx = 0;    // Índice do tom original da cifra calibrado
let useSharps = true;
let onlyText = false;

document.addEventListener("DOMContentLoaded", async () => {
    // 🔗 1. Mudamos a captura para ler o parâmetro amigável "s" (slug)
    const slugMusica = getQueryParam('s');
    
    // 🏠 SE NÃO HOUVER SLUG: Ativa o modo vitrine e cancela o carregamento da cifra
    if (!slugMusica) {
        console.log("🏠 Sem slug na URL. Ativando portal de boas-vindas.");
        montarVitrinePortal();
        return;
    }

    // 🛡️ SEGURANÇA: Se houver um slug na URL, garante que a vitrine fique totalmente oculta
    const painelVitrine = document.getElementById('portal-landing-vitrine');
    if (painelVitrine) painelVitrine.style.display = 'none';
    document.body.classList.remove('portal-vitrine-active');

    console.log("🔍 Buscando dados no acervo para o slug:", slugMusica);
    
    // 2. Mudamos a chamada para a sua nova função que criamos no supabase-db.js
    musicaBase = await buscarMusicaNoBancoPorSlug(slugMusica);

    if (musicaBase) {
        // Calibração do tom numérico do seu banco (Ex: 8 -> Subtrai 3 -> vira índice 5)
        let tomRaw = parseInt(musicaBase.tom, 10); 

        if (!isNaN(tomRaw)) {
            tomOriginalIdx = (tomRaw - 3 + 12) % 12; 
            tomAtualIdx = tomOriginalIdx; 
        } else {
            const tomBase = (musicaBase.tom || "C").replace('C#','Db').replace('D#','Eb').replace('F#','Gb').replace('G#','Ab').replace('A#','Bb');
            tomOriginalIdx = escala.indexOf(tomBase);
            if(tomOriginalIdx === -1) tomOriginalIdx = 0;
            tomAtualIdx = tomOriginalIdx;
        }

        // Preferência por Sustenidos ou Bemóis com base na nota calculada
        const notaBaseNome = escala[tomOriginalIdx];
        useSharps = !["F", "Bb", "Eb", "Ab", "Db", "Gb"].includes(notaBaseNome);
        
        const btnAcc = document.getElementById('btn-acc');
        if (btnAcc) btnAcc.innerText = useSharps ? '#' : 'b';

        setupTonePopup();
        renderizarCifraNaTela();
    } else {
        console.error("Não foi possível encontrar nenhuma cifra correspondente a:", slugMusica);
        montarVitrinePortal(); // Se o slug estiver errado ou quebrado, mostra a vitrine
    }

    // Exemplo do que será feito no script de carregamento da sua página pública:
    if (musicaBase) {
            // 1. Altera o título do card para o nome real da canção
            document.getElementById('og-title')?.setAttribute('content', `${musicaBase.titulo?.toUpperCase()}`);
            
            // 2. Altera a descrição para exibir o artista
            document.getElementById('og-desc')?.setAttribute('content', `Cifra para teclado de: ${musicaBase.autor || 'Artista Desconhecido'}`);
            
            // 3. Se você quiser colocar uma foto padrão do projeto ou a logo do Doze Teclas
            document.getElementById('og-image')?.setAttribute('content', 'https://seusite.com/assets/logo-dozeteclas-card.jpg');
            
            // Atualiza também o título da aba do navegador do usuário
            document.title = `${musicaBase.titulo} - ${musicaBase.autor || 'Frei Gilson'} | Doze Teclas`;

            // 📊 4. Envia o Pageview Virtual para o Google Analytics 4
            if (typeof gtag === 'function') {
                gtag('event', 'page_view', {
                    'page_title': `${musicaBase.titulo} - ${musicaBase.autor || 'Artista Desconhecido'}`,
                    'page_location': window.location.href,
                    'page_path': `/cifra/${musicaBase.slug}` // Faz o GA4 entender como se fosse a página /cifra/nome-da-musica
                });
            }
        }

});


// 🎨 FUNÇÃO INTERRUPTOR: Ativa a vitrine no HTML e limpa as sobras da cifra vazia
function montarVitrinePortal() {
    // Adiciona uma classe de controle no body (útil caso queira aplicar alguma regra global no CSS)
    document.body.classList.add('portal-vitrine-active');

    // Oculta os elementos da estrutura da cifra para não acumularem
    const mainContent = document.querySelector('.content');
    const headerTools = document.querySelector('.header-tools');
    
    if (mainContent) mainContent.style.display = 'none';
    if (headerTools) headerTools.style.display = 'none';

    // Oculta o botão de auto-scroll quando a vitrine estiver ativa
    ocultarBotaoAutoScroll();

    // Exibe o painel da vitrine removendo a classe de ocultação
    const painelVitrine = document.getElementById('portal-landing-vitrine');
    if (painelVitrine) {
        painelVitrine.classList.remove('vitrine-display-none');
        painelVitrine.style.display = 'block'; // Força exibição limpa
    }
}

// ==========================================
// 🎯 CONTROLE DE VISIBILIDADE DO BOTÃO AUTO-SCROLL
// ==========================================

/**
 * Exibe o botão flutuante de auto-scroll após a cifra ser carregada
 */
function exibirBotaoAutoScroll() {
    const autoScrollContainer = document.getElementById('auto-scroll-container');
    if (autoScrollContainer) {
        autoScrollContainer.classList.add('visible');
        console.log('✅ Botão de auto-scroll exibido');
    }
}

/**
 * Oculta o botão flutuante de auto-scroll
 */
function ocultarBotaoAutoScroll() {
    const autoScrollContainer = document.getElementById('auto-scroll-container');
    if (autoScrollContainer) {
        autoScrollContainer.classList.remove('visible');
        console.log('🔒 Botão de auto-scroll ocultado');
    }
}

function getQueryParam(param) {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get(param);
}

function renderizarCifraNaTela() {
    if (!musicaBase || !musicaBase.conteudo) return;

    // Calcula a diferença exata de semitones para passar ao motor
    const diff = (tomAtualIdx - tomOriginalIdx + 12) % 12;

    // Chama o seu motor original com os parâmetros corretos
    const resultado = renderizarMusica(musicaBase.conteudo, diff, useSharps);

    // Injeta os Metadados na tela
    const elTitulo = document.getElementById('view-title');
    if (elTitulo) {
        const tituloTexto = (musicaBase.titulo || "Sem Título").trim();
        if (musicaBase.revisada === true) {
            const palavras = tituloTexto.split(' ');
            if (palavras.length > 1) {
                const ultimaPalavra = palavras.pop();
                const textoRestante = palavras.join(' ');
                elTitulo.innerHTML = `${escapeHtml(textoRestante)} <span class="badge-wrapper-nowrap" aria-label="Cifra revisada">${escapeHtml(ultimaPalavra)} <i class="bi bi-patch-check-fill badge-revisada" title="Cifra revisada" aria-hidden="true"></i></span>`;
            } else {
                elTitulo.innerHTML = `<span class="badge-wrapper-nowrap" aria-label="Cifra revisada">${escapeHtml(tituloTexto)} <i class="bi bi-patch-check-fill badge-revisada" title="Cifra revisada" aria-hidden="true"></i></span>`;
            }
        } else {
            elTitulo.textContent = tituloTexto;
        }
    }
    // Renderiza o artista com link
    const elArtista = document.getElementById('view-artist');
    if (elArtista) {
        const nomeArtista = musicaBase.autor || "Artista Desconhecido";
        const slugArtista = slugify(nomeArtista);
        elArtista.innerHTML = `<a href="artista.html?a=${encodeURIComponent(slugArtista)}" class="link-artista-cifra">${escapeHtml(nomeArtista)}</a>`;
    }
    
    const tomOriginalNome = formatNote(escala[tomOriginalIdx], useSharps);
    const meta = document.getElementById('view-meta');
    if (meta) {
        meta.innerText = `TOM: ${tomOriginalNome || '--'} | TAGS: ${musicaBase.tags || '--'}`;
    }

    // Atualiza o Badge visual do Tom selecionado
    const display = document.getElementById('current-tone-display');
    if (display) {
        display.innerText = formatNote(escala[tomAtualIdx], useSharps);
    }

    // Injeta o HTML renderizado dentro do container
    const renderContainer = document.getElementById('cifra-render');
    if (renderContainer) {
        renderContainer.innerHTML = resultado.html ? resultado.html : resultado;

        // 🧹 Se o modo "Apenas Texto" estiver ativo, remove novamente o caractere "_"
        // e os espaços de alinhamento no início das linhas do conteúdo recém-renderizado
        // (ex: após transposição de tom), sem afetar nenhum outro símbolo do texto.
        if (onlyText) {
            renderContainer.innerHTML = removerMarcasApenasTexto(renderContainer.innerHTML);
        }

        // 🎯 EXIBE O BOTÃO DE AUTO-SCROLL após a cifra ser renderizada com sucesso
        exibirBotaoAutoScroll();
    }
}


// --- FUNÇÃO DO YOUTUBE INTEGRADA ---
function extractId(url) {
    if (!url) return null;
    
    // 1. Tratamento específico para o formato Shorts
    if (url.includes('/shorts/')) {
        const partes = url.split('/shorts/');
        // Pega o ID após a barra e limpa qualquer parâmetro extra (como ?feature=share)
        const videoId = partes[1].split('?')[0].split('&')[0];
        // Garante que o ID do YouTube tem os 11 caracteres padrão antes de retornar
        return (videoId && videoId.length === 11) ? videoId : false;
    }

    // 2. Fluxo original com a Regex antiga para links normais e encurtados
    const regExp = /^.*((youtu.be\/)|(v\/)|(\/u\/\w\/)|(embed\/)|(watch\?))\??v?=?([^#&?]*).*/;
    const match = url.match(regExp);
    return (match && match[7].length === 11) ? match[7] : false;
}

function togglePreview() {
    const container = document.getElementById('preview-container');
    const btn = document.getElementById('btn-preview');
    // Mapeia tanto link_referencia quanto linkReferencia por segurança
    const url = musicaBase?.link_referencia || musicaBase?.linkReferencia; 

    if (!url) {
        alert("Link de vídeo não encontrado no banco de dados para esta música.");
        return;
    }

    if (!container) {
        console.error("Elemento #preview-container não encontrado no HTML.");
        return;
    }

    if (container.style.display === 'none' || container.style.display === '') {
        const videoId = extractId(url);
        if (!videoId) {
            alert("Não foi possível extrair o ID do vídeo. Verifique o formato do link.");
            return;
        }

        container.style.display = 'block';
        btn?.classList.add('active');
        
        const ytPlayer = document.getElementById('yt-player');
        if (ytPlayer) {
            ytPlayer.innerHTML = `
                <iframe width="100%" height="100%" 
                    src="https://www.youtube.com/embed/${videoId}?autoplay=1" 
                    frameborder="0" allow="autoplay; encrypted-media" allowfullscreen>
                </iframe>`;
        }
            
        container.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } else {
        container.style.display = 'none';
        btn?.classList.remove('active');
        const ytPlayer = document.getElementById('yt-player');
        if (ytPlayer) ytPlayer.innerHTML = ''; 
    }
}

// Expõe a função explicitamente para o escopo global (garante o funcionamento do onclick do HTML)
window.togglePreview = togglePreview;

function setupTonePopup() {
    const container = document.getElementById('tone-popup');
    if (!container) return;
    container.innerHTML = "";

    escala.forEach((t, i) => {
        const btn = document.createElement('div');
        btn.className = 'tone-btn' + (i === tomAtualIdx ? ' active' : '');
        btn.innerText = formatNote(t, useSharps);
        
        btn.onclick = (e) => { 
            e.stopPropagation(); 
            tomAtualIdx = i; 
            setupTonePopup();
            renderizarCifraNaTela(); 
            toggleTonePopup(); 
        };
        container.appendChild(btn);
    });

    const btnOriginal = document.createElement('div');
    btnOriginal.className = 'tone-btn original-btn';
    btnOriginal.style.gridColumn = "1 / span 4"; 
    btnOriginal.innerText = "TOM ORIGINAL";
    
    btnOriginal.onclick = (e) => {
        e.stopPropagation();
        tomAtualIdx = tomOriginalIdx;
        setupTonePopup();
        renderizarCifraNaTela();
        toggleTonePopup();
    };
    container.appendChild(btnOriginal);
}

function toggleTonePopup() {
    const p = document.getElementById('tone-popup');
    if(p) p.style.display = p.style.display === 'grid' ? 'none' : 'grid';
}

function changeZoom(v) {
    const el = document.getElementById('cifra-render');
    const currentSize = parseFloat(window.getComputedStyle(el).fontSize);
    el.style.fontSize = (currentSize + v) + "px";
}

function resetZoom() { 
    document.getElementById('cifra-render').style.fontSize = "16px"; 
}

// 🧹 FUNÇÃO UTILITÁRIA DO MODO "APENAS TEXTO": remove o caractere "_" (usado como
// espaçamento de sílaba), normaliza os espaços entre palavras e remove as sequências 
// de "&nbsp;" que ficam no INÍCIO de cada linha (<div class="c-line">).
function removerMarcasApenasTexto(html) {
    return html
        .replace(/_/g, '') // Remove underlines usados para espaçamento
        .replace(/(<div class="c-line">)(?:&nbsp;)+/g, '$1') // Remove espaços do início das linhas
        .replace(/&nbsp;+/g, ' ') // Substitui múltiplos &nbsp; por um espaço simples
        .replace(/\s+/g, ' '); // Normaliza múltiplos espaços em branco para um espaço simples
}

function toggleTxt() { 
    onlyText = !onlyText; 
    const container = document.getElementById('cifra-render');
    const btn = document.getElementById('btn-toggle-txt');

    if (!container) return;

    if (onlyText) {
        // 🧹 Guarda o HTML original (com os underlines "_" e espaços de alinhamento)
        // antes de removê-los, para que seja possível restaurar o conteúdo exato
        // ao desativar o modo.
        container.dataset.originalHtml = container.innerHTML;

        // Remove o caractere "_" e os espaços em branco do início de cada linha
        // exibidos no modo Apenas Texto. Nenhum outro símbolo do conteúdo é alterado.
        container.innerHTML = removerMarcasApenasTexto(container.innerHTML);

        container.classList.add('only-text-mode');
        btn?.classList.add('active');
    } else {
        // Restaura o HTML original (com os underlines e espaços) ao sair do modo Apenas Texto
        if (container.dataset.originalHtml !== undefined) {
            container.innerHTML = container.dataset.originalHtml;
            delete container.dataset.originalHtml;
        }

        container.classList.remove('only-text-mode');
        btn?.classList.remove('active');
    }
}



function toggleAccidental() { 
    useSharps = !useSharps; 
    const btn = document.getElementById('btn-acc');
    if(btn) btn.innerText = useSharps ? '#' : 'b';
    setupTonePopup();
    renderizarCifraNaTela(); 
}

function toggleColumns() {
    document.getElementById('cifra-render').classList.toggle('two-columns');
    document.getElementById('btn-columns')?.classList.toggle('active');
}

function isInAppBrowser() {
    return /Instagram|FBAN|FBAV|Twitter|TikTok/i.test(navigator.userAgent);
}

function showPrintAlert() {
    // Cria um overlay de alerta elegante se não existir
    let modal = document.getElementById('print-modal-alert');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'print-modal-alert';
        modal.style.cssText = `
            position: fixed; top: 0; left: 0; width: 100%; height: 100%; 
            background: rgba(0,0,0,0.85); display: flex; align-items: center; 
            justify-content: center; z-index: 9999; padding: 20px;
        `;
        modal.innerHTML = `
            <div style="background: #1a1d20; color: #fff; padding: 25px; border-radius: 12px; max-width: 400px; text-align: center; border: 1px solid #ffd700;">
                <h3 style="color: #ffd700; margin-bottom: 15px;">Atenção</h3>
                <p style="margin-bottom: 20px; line-height: 1.5;">O navegador do Instagram/Redes Sociais bloqueia a impressão direta.</p>
                <p style="margin-bottom: 20px; line-height: 1.5; font-size: 0.9em;">Toque nos <b>3 pontinhos (⋮ ou •••)</b> no canto superior e selecione <b>"Abrir no navegador externo"</b> para imprimir ou salvar em PDF.</p>
                <button id="btn-close-print-modal" style="background: #ffd700; color: #000; border: none; padding: 10px 20px; border-radius: 5px; font-weight: bold; cursor: pointer;">Entendido</button>
            </div>
        `;
        document.body.appendChild(modal);
        document.getElementById('btn-close-print-modal').onclick = () => modal.style.display = 'none';
    } else {
        modal.style.display = 'flex';
    }
}

function triggerPrintLayout() {
    if (isInAppBrowser()) {
        showPrintAlert();
        return;
    }
    
    document.body.classList.add('print-mode');
    setTimeout(() => {
        window.print();
        document.body.classList.remove('print-mode');
    }, 150);
}

// Fecha o popup ao clicar fora
document.addEventListener('click', (e) => {
    const popup = document.getElementById('tone-popup');
    const btn = document.getElementById('current-tone-display');
    if (popup?.style.display === 'grid' && !btn.contains(e.target) && !popup.contains(e.target)) {
        toggleTonePopup();
    }
});

// ==========================================
// 🔍 MOTOR DE BUSCA INTERNO DO PORTAL PÚBLICO
// ==========================================

let acervoBuscaCache = null;

async function carregarCacheBusca() {
    if (acervoBuscaCache) return;
    try {
        const { data, error } = await _supabase
            .from('musicas')
            .select('titulo, autor, slug');
        
        if (error) throw error;
        acervoBuscaCache = data || [];
    } catch (err) {
        console.error("Erro ao carregar cache de busca:", err);
    }
}

document.addEventListener("DOMContentLoaded", () => {
    const inputBusca = document.getElementById('input-busca-portal');
    const dropdownBusca = document.getElementById('dropdown-busca-portal');

    if (!inputBusca || !dropdownBusca) return;

    // Carrega o cache assim que a página carregar
    carregarCacheBusca();

    let timeoutBusca = null;

    // Escuta o que o usuário digita
    inputBusca.addEventListener('input', async (e) => {
        clearTimeout(timeoutBusca);
        const termoOriginal = e.target.value.trim();

        if (termoOriginal.length < 2) {
            dropdownBusca.innerHTML = "";
            dropdownBusca.classList.add('search-dropdown-hide');
            return;
        }

        // Garante que o cache esteja carregado
        if (!acervoBuscaCache) await carregarCacheBusca();

        const termoNormalizado = normalizarTexto(termoOriginal);

        timeoutBusca = setTimeout(() => {
            const resultados = acervoBuscaCache.filter(m => {
                const tit = normalizarTexto(m.titulo || '');
                const art = normalizarTexto(m.autor || '');
                return tit.includes(termoNormalizado) || art.includes(termoNormalizado);
            }).slice(0, 8);

            dropdownBusca.innerHTML = "";
            
            if (resultados.length === 0) {
                dropdownBusca.innerHTML = `<div class="spi-no-results">Nenhuma cifra encontrada.</div>`;
            } else {
                resultados.forEach(m => {
                    const div = document.createElement('div');
                    div.className = 'search-portal-item';
                    div.style.cursor = 'pointer';
                    div.innerHTML = `<strong>${escapeHtml(m.titulo)}</strong><br><small>${escapeHtml(m.autor || '')}</small>`;
                    div.onclick = () => window.location.href = `cifra.html?s=${m.slug}`;
                    dropdownBusca.appendChild(div);
                });
            }
            dropdownBusca.classList.remove('search-dropdown-hide');
        }, 150);
    });

    // Fecha o painel de resultados se o usuário clicar em qualquer outro lugar da tela
    document.addEventListener('click', (e) => {
        if (!inputBusca.contains(e.target) && !dropdownBusca.contains(e.target)) {
            dropdownBusca.classList.add('search-dropdown-hide');
        }
    });
});

async function carregarContadorProvaSocial() {
    try {
        // Pede ao Supabase apenas a contagem exata de registros, sem trazer os dados
        const { count, error } = await _supabase
            .from('musicas')
            .select('*', { count: 'exact', head: true });

        if (error) throw error;

        const elementoContador = document.getElementById('total-cifras-contador');
        if (elementoContador && count !== null) {
            elementoContador.innerText = count;
        }
    } catch (err) {
        console.error("Erro ao carregar o contador de prova social:", err);
        // Fallback discreto caso falhe: esconde o contador ou poe um número base
        document.getElementById('total-cifras-contador').innerText = "29";
    }
}

// Contador de Músicas
document.addEventListener("DOMContentLoaded", () => {
    carregarContadorProvaSocial();
    // ... suas outras funções da home ...
});

// 🌐 EXPONDO AS FUNÇÕES PARA O ESCOPO GLOBAL (Resolve o travamento dos botões)
window.changeZoom = changeZoom;
window.resetZoom = resetZoom;
window.toggleTxt = toggleTxt;
window.toggleAccidental = toggleAccidental;
window.toggleColumns = toggleColumns;
window.triggerPrintLayout = triggerPrintLayout;
window.toggleTonePopup = toggleTonePopup; // 👈 Adicione esta linha aqui!

// =========================================================================
// 🎯 AMARRAÇÃO DE EVENTOS DESACOPLADOS DO PAINEL DE VISUALIZAÇÃO (Cifra.html)
// =========================================================================

// Botão de retorno minimalista da barra superior
document.getElementById('btn-back-minimal')?.addEventListener('click', () => {
    window.history.back();
});

// Acionamento do pop-up de modulação de tom
document.getElementById('current-tone-display')?.addEventListener('click', () => {
    if (typeof window.toggleTonePopup === 'function') window.toggleTonePopup();
});

// Barra flutuante inferior de ferramentas (Header-Tools)
document.getElementById('btn-zoom-out')?.addEventListener('click', () => {
    if (typeof window.changeZoom === 'function') window.changeZoom(-1);
});

document.getElementById('btn-zoom-reset')?.addEventListener('click', () => {
    if (typeof window.resetZoom === 'function') window.resetZoom();
});

document.getElementById('btn-zoom-in')?.addEventListener('click', () => {
    if (typeof window.changeZoom === 'function') window.changeZoom(1);
});

document.getElementById('btn-toggle-txt')?.addEventListener('click', () => {
    if (typeof window.toggleTxt === 'function') window.toggleTxt();
});

document.getElementById('btn-acc')?.addEventListener('click', () => {
    if (typeof window.toggleAccidental === 'function') window.toggleAccidental();
});

document.getElementById('btn-columns')?.addEventListener('click', () => {
    if (typeof window.toggleColumns === 'function') window.toggleColumns();
});

document.getElementById('btn-print')?.addEventListener('click', () => {
    if (typeof window.triggerPrintLayout === 'function') window.triggerPrintLayout();
});

document.getElementById('btn-preview')?.addEventListener('click', () => {
    if (typeof window.togglePreview === 'function') window.togglePreview();
});

// =========================================================================
// ☀️🌙 ALTERNADOR DE TEMA REMOVIDO DESTE ARQUIVO
// =========================================================================
// A funcionalidade de alternância de tema foi movida para theme-toggle.js
// para evitar conflitos entre scripts. O theme-toggle.js é o responsável
// exclusivo por gerenciar a alternância entre temas claro e escuro.


// --- RENDERIZADOR DE DIAGRAMAS DE TECLADO ---
function configurarPainelDiagramas() {
  document.addEventListener('click', (e) => {
    const btnToggle = e.target.closest('#btn-toggle-diagramas');
    if (btnToggle) {
      const painel = document.getElementById('painel-diagramas-cifra');
      const grade = document.getElementById('grade-diagramas');

      if (!painel || !grade) return;

      if (painel.style.display === 'block') {
        painel.style.display = 'none';
        return;
      }

      grade.innerHTML = '';
      const acordesUnicos = new Set();
      const ignorar = new Set(['|', '||', '%', 'intro', 'solo', 'fim', 'final', 'refrão', 'refrao', 'ponte', 'verso', 'c:', 't:', 'b:']);

      document.querySelectorAll('.c-chord').forEach(el => {
        const txt = el.textContent.replace(/[\[\]]/g, '').trim();
        if (txt && !ignorar.has(txt.toLowerCase()) && !/^\d+x$/.test(txt)) {
          acordesUnicos.add(txt);
        }
      });

      if (acordesUnicos.size === 0) {
        grade.innerHTML = '<p style="color: #b0b3b8; font-size: 13px; grid-column: 1/-1; text-align: center;">Nenhum acorde detectado nesta música.</p>';
        painel.style.display = 'block';
        return;
      }

      acordesUnicos.forEach(acordeStr => {
        const info = parseAcorde(acordeStr);
        if (!info) return;

        const card = document.createElement('div');
        card.className = 'card-acorde-item';

        const titulo = document.createElement('div');
        titulo.className = 'card-acorde-nome';
        titulo.textContent = info.original;
        card.appendChild(titulo);

        const teclado = renderMiniTeclado(info);
        card.appendChild(teclado);

        grade.appendChild(card);
      });

      painel.style.display = 'block';
      painel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      return;
    }

    const btnFechar = e.target.closest('#btn-fechar-diagramas');
    if (btnFechar) {
      const painel = document.getElementById('painel-diagramas-cifra');
      if (painel) painel.style.display = 'none';
    }
  });
}

configurarPainelDiagramas();

