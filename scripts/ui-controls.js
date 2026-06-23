// ui-controls.js - O Maestro da Interface (Doze Teclas)

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

            // 📊 4. Envia os dados da cifra carregada para o Google Analytics 4
            if (typeof gtag === 'function') {
                gtag('event', 'visualizacao_cifra', {
                    'nome_musica': musicaBase.titulo,
                    'autor_musica': musicaBase.autor || 'Artista Desconhecido',
                    'slug_musica': musicaBase.slug || 'slug-indisponivel'
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

    // Exibe o painel da vitrine removendo a classe de ocultação
    const painelVitrine = document.getElementById('portal-landing-vitrine');
    if (painelVitrine) {
        painelVitrine.classList.remove('vitrine-display-none');
        painelVitrine.style.display = 'block'; // Força exibição limpa
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
    document.getElementById('view-title').innerText = musicaBase.titulo || "Sem Título";
    document.getElementById('view-artist').innerText = musicaBase.autor || "Artista Desconhecido";
    
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

function toggleTxt() { 
    onlyText = !onlyText; 
    const container = document.getElementById('cifra-render');
    const btn = document.querySelector('button[onclick="toggleTxt()"]');
    
    if (onlyText) {
        container.classList.add('only-text-mode');
        btn?.classList.add('active');
    } else {
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

function triggerPrintLayout() {
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

document.addEventListener("DOMContentLoaded", () => {
    const inputBusca = document.getElementById('input-busca-portal');
    const dropdownBusca = document.getElementById('dropdown-busca-portal');

    if (!inputBusca || !dropdownBusca) return;

    let timeoutBusca = null;

    // Escuta o que o usuário digita
    inputBusca.addEventListener('input', (e) => {
        clearTimeout(timeoutBusca);
        const termo = e.target.value.trim();

        if (!termo) {
            dropdownBusca.innerHTML = "";
            dropdownBusca.classList.add('search-dropdown-hide');
            return;
        }

        // Aplica um pequeno "debounce" de 250ms para não sobrecarregar o Supabase a cada letra digitada
        timeoutBusca = setTimeout(async () => {
            try {
                // Faz a query buscando pelo termo no título ou no autor usando ilike (case-insensitive)
                const { data: resultados, error } = await _supabase
                    .from('musicas')
                    .select('titulo, autor, slug')
                    .or(`titulo.ilike.%${termo}%,autor.ilike.%${termo}%`)
                    .limit(8); // Limita a 8 resultados para manter o painel limpo

                if (error) throw error;

                dropdownBusca.innerHTML = "";
                
                // ❌ CASO 1: A busca não trouxe nenhum resultado do banco de dados
                if (!resultados || resultados.length === 0) {
                    const termoFalho = inputBusca.value.trim();

                    // Envia o termo frustrado sinalizando o falso positivo no relatório
                    if (termoFalho && typeof gtag === 'function') {
                        gtag('event', 'search', {
                            'search_term': termoFalho,
                            'resultado_encontrado': false
                        });
                    }

                    dropdownBusca.innerHTML = `<div class="spi-no-results">Nenhuma cifra encontrada.</div>`;
                    dropdownBusca.classList.remove('search-dropdown-hide');
                    return;
                }

                //  CASO 2: A busca encontrou registros com sucesso
                resultados.forEach(m => {
                    const item = document.createElement('div');
                    item.className = 'search-portal-item';
                    item.innerHTML = `
                        <div class="spi-title">${m.titulo}</div>
                        <div class="spi-artist">${m.autor || 'Desconhecido'}</div>
                    `;

                    // Ao clicar no item, o portal rastreia a busca bem-sucedida e redireciona
                    item.onclick = () => {
                        const termoBuscado = inputBusca.value.trim();
                        
                        // Dispara o evento de sucesso (não passamos o parâmetro "resultado_encontrado", logo o GA4 entende como verdadeiro ou você pode omitir)
                        if (termoBuscado && typeof gtag === 'function') {
                            gtag('event', 'search', {
                                'search_term': termoBuscado,
                                'resultado_encontrado': true
                            });
                        }

                        // Fluxo normal do seu site
                        inputBusca.value = "";
                        dropdownBusca.classList.add('search-dropdown-hide');
                        window.location.href = `cifra.html?s=${m.slug}`;
                    };

                    dropdownBusca.appendChild(item);
                });

                dropdownBusca.classList.remove('search-dropdown-hide');

            } catch (err) {
                console.error("Erro na busca do portal:", err);
            }
        }, 250);
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