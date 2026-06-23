// editor-controls.js - Maestro Central do Editor (Doze Teclas)

// =========================================================================
// 🎯 AMARRAÇÃO DE EVENTOS DESACOPLADOS DO EDITOR (Cifra-Editor)
// =========================================================================

// Eventos de Autenticação e Busca
document.getElementById('login-form')?.addEventListener('submit', (e) => {
    e.preventDefault();
    if (typeof window.handleLogin === 'function') window.handleLogin();
});

document.getElementById('acervo-search')?.addEventListener('input', () => {
    if (typeof window.filterSongs === 'function') window.filterSongs();
});

// Eventos de Metadados e Alteração de Visualização
document.getElementById('song-key')?.addEventListener('change', () => {
    if (typeof window.render === 'function') window.render();
});

document.getElementById('song-bpm')?.addEventListener('input', () => {
    if (typeof window.updatePreviewHeader === 'function') window.updatePreviewHeader();
});

// Eventos dos Botões Principais do Acervo
document.getElementById('btn-save-song')?.addEventListener('click', () => {
    if (typeof window.salvarCifra === 'function') window.salvarCifra();
});

document.getElementById('btn-reset-editor')?.addEventListener('click', () => {
    if (typeof window.resetEditor === 'function') window.resetEditor();
});

document.getElementById('delete-btn')?.addEventListener('click', () => {
    if (typeof window.removerCifra === 'function') window.removerCifra();
});

// Eventos das Ferramentas de Busca e Substituição de Texto
document.getElementById('btn-find-first')?.addEventListener('click', () => {
    if (typeof window.findFirst === 'function') window.findFirst();
});

document.getElementById('btn-find-next')?.addEventListener('click', () => {
    if (typeof window.findNext === 'function') window.findNext();
});

document.getElementById('btn-replace-single')?.addEventListener('click', () => {
    if (typeof window.applyReplaceSingle === 'function') window.applyReplaceSingle();
});

document.getElementById('btn-replace-all')?.addEventListener('click', () => {
    if (typeof window.applyReplaceAll === 'function') window.applyReplaceAll();
});

// Eventos de Transposição
document.getElementById('btn-tone-down')?.addEventListener('click', () => {
    if (typeof window.changeTone === 'function') window.changeTone(-1);
});

document.getElementById('btn-tone-up')?.addEventListener('click', () => {
    if (typeof window.changeTone === 'function') window.changeTone(1);
});

import { tradicionalParaChordPro, chordProParaTradicional, extrairAcordesUnicos } from './editor-parser.js';

// --- VARIÁVEIS DE ESTADO DO EDITOR ---
let idMusicaAtual = null;
let todasMusicas = [];
let diffAtual = 0;
let useSharps = true;

// Regra Regex unificada para capturar acordes, aceitando extensões complexas como G#m7(11)
const regexAcordeEstrito = /^[A-G][b#]?(?:m|M|maj|maj7|min|dim|aug|sus\d?|add\d?|\d|\(\d+\))*(?:\/[A-G][b#]?)?$/i;

// --- INICIALIZAÇÃO DO SISTEMA ---
document.addEventListener("DOMContentLoaded", async () => {
    const editorPrincipal = document.getElementById('main-editor');
    if (editorPrincipal) {
        editorPrincipal.addEventListener('input', aoDigitar);
    }

    // Escuta alterações nos campos de metadados
    ['song-title', 'artist-name', 'song-key', 'song-bpm'].forEach(id => {
        document.getElementById(id)?.addEventListener('input', updatePreviewHeader);
    });
    document.getElementById('song-key')?.addEventListener('change', () => render());

    document.getElementById('acervo-search')?.addEventListener('input', filterSongs);

    // =========================================================================
    // Botão de conversão CHORDPRO (Segmentação por Chunks Isolados)
    // =========================================================================
    document.getElementById('btn-magic-convert')?.addEventListener('click', () => {
        const editorPrincipal = document.getElementById('main-editor');
        if (!editorPrincipal) return;

        const textoBlocoNotas = editorPrincipal.value;
        if (!textoBlocoNotas.trim()) return;

        // console.log("⚡ Iniciando conversão definitiva por seções e acordes...");

        // Regexes de validação e extração limpas
        const validadorAcordeLocal = /^[A-G][b#]?(?:m|M|maj|maj7|min|dim|aug|sus\d?|add\d?|\d|\([\w#b+-]*\))*(?:\/[A-G][b#]?)?$/i;
        const extratorAcordeGlobal = /[A-G][b#]?(?:m|M|maj|maj7|min|dim|aug|sus\d?|add\d?|\d|\([\w#b+-]*\))*(?:\/[A-G][b#]?)?/gi;

        const lines = textoBlocoNotas.split(/\r?\n/);
        let chunks = [];
        let currentNativeChunk = [];

        for (let i = 0; i < lines.length; i++) {
            let linha = lines[i];
            let linhaTrim = linha.trim();

            if (!linhaTrim) {
                if (currentNativeChunk.length > 0) {
                    chunks.push({ type: 'native', lines: currentNativeChunk });
                    currentNativeChunk = [];
                }
                chunks.push({ type: 'empty' });
                continue;
            }

            // Identifica se a linha é estritamente uma tag isolada (ex: [Primeira Parte])
            if (linhaTrim.startsWith('[') && linhaTrim.endsWith(']') && !validadorAcordeLocal.test(linhaTrim.slice(1, -1))) {
                if (currentNativeChunk.length > 0) {
                    chunks.push({ type: 'native', lines: currentNativeChunk });
                    currentNativeChunk = [];
                }
                let secaoNome = linhaTrim.slice(1, -1).trim();
                chunks.push({ type: 'manual', content: `{c: ${secaoNome}}` });
                continue;
            }

            // Identifica se a linha começa com um indicador de seção e tem acordes na frente (ex: [Intro] C7M G/B)
            let matchSecaoMista = linhaTrim.match(/^\[(intro|introducao|introdução|parte\s*[a-z0-9]?|refrão|refrao|solo\s*[a-z0-9]?|ponte|fim|final|pré-refrão|pre-refrao|chorus|bridge|part\s*[a-z0-9]?)\](.*)/i);
            if (!matchSecaoMista) {
                matchSecaoMista = linhaTrim.match(/^(intro|introducao|introdução|parte\s*[a-z0-9]?|refrão|refrao|solo\s*[a-z0-9]?|ponte|fim|final|pré-refrão|pre-refrao|chorus|bridge|part\s*[a-z0-9]?)\b(.*)/i);
            }

            if (matchSecaoMista) {
                if (currentNativeChunk.length > 0) {
                    chunks.push({ type: 'native', lines: currentNativeChunk });
                    currentNativeChunk = [];
                }

                let nomeTag = matchSecaoMista[1].trim();
                let restanteLinha = matchSecaoMista[2].trim();
                let blocoConvertido = `{c: ${nomeTag.toUpperCase()}}`;

                if (restanteLinha) {
                    extratorAcordeGlobal.lastIndex = 0; // 🎯 RESET DO PONTEIRO
                    let acordesEnvelopados = restanteLinha.replace(extratorAcordeGlobal, (match) => {
                        return match.startsWith('[') ? match : `[${match}]`;
                    });
                    blocoConvertido += `\n${acordesEnvelopados}`;
                }

                chunks.push({ type: 'manual', content: blocoConvertido });
                continue;
            }

            // Verifica se é um arranjo instrumental explícito entre parênteses
            let isWrappedInstrumental = linhaTrim.startsWith("(") && linhaTrim.endsWith(")");

            // Valida se a linha contém estritamente apenas acordes válidos
            let linhaLimpaParaChecagem = linhaTrim.replace(/[|\[\]\-_]/g, ' ').trim();
            let palavras = linhaLimpaParaChecagem.split(/\s+/).filter(p => p !== "");
            let isPureChords = palavras.length > 0 && palavras.every(p => validadorAcordeLocal.test(p));

            let hasLyricsBelow = false;
            if (isPureChords && !isWrappedInstrumental) {
                let nextLine = lines[i + 1];
                let nextLineTrim = nextLine ? nextLine.trim() : "";
                if (nextLineTrim) {
                    let nextLineLimpa = nextLineTrim.replace(/[|\[\]\-_]/g, ' ').trim();
                    let nextPalabras = nextLineLimpa.split(/\s+/).filter(p => p !== "");
                    let nextIsChords = nextPalabras.length > 0 && nextPalabras.every(p => validadorAcordeLocal.test(p));
                    let nextIsSection = nextLineTrim.startsWith("[") || nextLineTrim.startsWith("{");
                    
                    if (!nextIsChords && !nextIsSection) {
                        hasLyricsBelow = true;
                    }
                }
            }

            if (isWrappedInstrumental || (isPureChords && !hasLyricsBelow)) {
                if (currentNativeChunk.length > 0) {
                    chunks.push({ type: 'native', lines: currentNativeChunk });
                    currentNativeChunk = [];
                }

                let miolo = isWrappedInstrumental ? linhaTrim.slice(1, -1).trim() : linhaTrim;
                extratorAcordeGlobal.lastIndex = 0; // 🎯 RESET DO PONTEIRO
                let linhaConvertida = miolo.replace(extratorAcordeGlobal, (match) => match.startsWith('[') ? match : `[${match}]`);
                
                chunks.push({ type: 'manual', content: linhaConvertida });
            } else {
                currentNativeChunk.push(linha);
            }
        }

        if (currentNativeChunk.length > 0) {
            chunks.push({ type: 'native', lines: currentNativeChunk });
        }

        let resultadoFinalLines = [];
        for (let chunk of chunks) {
            if (chunk.type === 'manual') {
                resultadoFinalLines.push(chunk.content);
            } else if (chunk.type === 'empty') {
                resultadoFinalLines.push("");
            } else if (chunk.type === 'native') {
                let subLines = chunk.lines;
                for (let j = 0; j < subLines.length; j++) {
                    let lAtual = subLines[j];
                    let lAtualTrim = lAtual.trim();
                    
                    let lAtualLimpa = lAtualTrim.replace(/[|\[\]\-_]/g, ' ').trim();
                    let parts = lAtualLimpa.split(/\s+/).filter(p => p !== "");
                    let lAtualEhAcorde = lAtualTrim.length > 0 && parts.every(p => validadorAcordeLocal.test(p));
                    
                    let lProxima = subLines[j + 1];
                    let lProximaTrim = lProxima ? lProxima.trim() : "";
                    let lProximaEhLetra = lProximaTrim.length > 0 && !lProximaTrim.startsWith('{') && !lProximaTrim.startsWith('[');

                    if (lAtualEhAcorde && lProximaEhLetra) {
                        let linhaAcordes = lAtual;
                        let linhaLetra = lProxima;
                        let resultadoMesclado = "";
                        let indiceLetra = 0;
                        
                        let acordesDaLinha = [];
                        let match;
                        
                        // 🚀 O CORRETOR SEGURO: Zera o ponteiro global antes de iniciar a busca na linha
                        extratorAcordeGlobal.lastIndex = 0; 
                        while ((match = extratorAcordeGlobal.exec(linhaAcordes)) !== null) {
                            acordesDaLinha.push({
                                acordeOriginal: match[0],
                                posicaoOriginal: match.index
                            });
                        }
                        
                        // console.log(`%c📝 Analisando par de linhas (J: ${j})`, "color: #ffc107; font-weight: bold;");
                        // console.table(acordesDaLinha);

                        for (let k = 0; k < acordesDaLinha.length; k++) {
                            let item = acordesDaLinha[k];
                            let posAjustada = item.posicaoOriginal;

                            while (posAjustada > 0 && linhaLetra[posAjustada] !== ' ' && linhaLetra[posAjustada - 1] !== ' ') {
                                posAjustada--;
                            }
                            
                            if (linhaLetra.length < posAjustada) {
                                linhaLetra = linhaLetra.padEnd(posAjustada, " ");
                            }
                            
                            if (posAjustada > indiceLetra) {
                                resultadoMesclado += linhaLetra.substring(indiceLetra, posAjustada);
                                indiceLetra = posAjustada;
                            }
                            
                            resultadoMesclado += `[${item.acordeOriginal}]`;
                        }
                        
                        if (indiceLetra < linhaLetra.length) {
                            resultadoMesclado += linhaLetra.substring(indiceLetra);
                        }
                        
                        resultadoFinalLines.push(resultadoMesclado);
                        j++; 
                    } else if (lAtualEhAcorde) {
                        extratorAcordeGlobal.lastIndex = 0; // 🎯 RESET DO PONTEIRO
                        let linhaConvertida = lAtual.replace(extratorAcordeGlobal, (match) => {
                            return match.startsWith('[') ? match : `[${match}]`;
                        });

                        if (resultadoFinalLines.length > 0 && 
                            !resultadoFinalLines[resultadoFinalLines.length - 1].startsWith('{') && 
                            !resultadoFinalLines[resultadoFinalLines.length - 1].startsWith('[') &&
                            resultadoFinalLines[resultadoFinalLines.length - 1].trim() !== "") {
                            resultadoFinalLines[resultadoFinalLines.length - 1] += " " + linhaConvertida.trim();
                        } else {
                            resultadoFinalLines.push(linhaConvertida);
                        }
                    } else {
                        if (lAtualTrim.startsWith('[') && lAtualTrim.endsWith(']') && !validadorAcordeLocal.test(lAtualTrim.slice(1, -1))) {
                            resultadoFinalLines.push(`{c: ${lAtualTrim.slice(1, -1).trim()}}`);
                        } else {
                            resultadoFinalLines.push(lAtual);
                        }
                    }
                }
            }
        }

        editorPrincipal.value = resultadoFinalLines.join('\n');
        
        if (typeof render === 'function') {
            render();
        }
    });

    // ===========================================================
    // Scroll sync bidirecional entre editor e preview (Mão Dupla)
    // ===========================================================
    const previewOutput = document.getElementById('preview-output');
    let estaRolando = false;

    if (editorPrincipal && previewOutput) {
        
        // 1. Ouvinte do Editor Principal (Esquerda -> Direita)
        editorPrincipal.addEventListener('scroll', () => {
            if (estaRolando) {
                estaRolando = false;
                return;
            }
            estaRolando = true;

            const pct = editorPrincipal.scrollTop / (editorPrincipal.scrollHeight - editorPrincipal.clientHeight);
            if (isFinite(pct)) {
                previewOutput.scrollTop = pct * (previewOutput.scrollHeight - previewOutput.clientHeight);
            }
        });

        // 2. Ouvinte do Preview Output (Direita -> Esquerda)
        previewOutput.addEventListener('scroll', () => {
            if (estaRolando) {
                estaRolando = false;
                return;
            }
            estaRolando = true;

            const pct = previewOutput.scrollTop / (previewOutput.scrollHeight - previewOutput.clientHeight);
            if (isFinite(pct)) {
                editorPrincipal.scrollTop = pct * (editorPrincipal.scrollHeight - editorPrincipal.clientHeight);
            }
        });
    }

    if (typeof _supabase === 'undefined') {
        console.error("ERRO: _supabase não encontrado. Verifique a ordem dos scripts no HTML.");
        return;
    }

    const { data: { session } } = await _supabase.auth.getSession();
    if (session) {
        document.getElementById('auth-overlay').style.display = 'none';
        inicializarEditor();
    }
});

// --- CONTROLE DE AUTENTICAÇÃO ---
async function handleLogin() {
    const email = document.getElementById('login-email').value.trim();
    const pass = document.getElementById('login-password').value;

    if (!email || !pass) {
        alert("Por favor, preencha o e-mail e a senha.");
        return;
    }

    const { data, error } = await _supabase.auth.signInWithPassword({ email, password: pass });

    if (error) {
        alert("Erro na autenticação: " + error.message);
        return;
    }

    document.getElementById('auth-overlay').style.display = 'none';
    inicializarEditor();
}

// --- CARREGAMENTO E ACERVO LATERAL ---
async function inicializarEditor() {
    await carregarListaAcervo();
    render();
}

async function carregarListaAcervo() {
    const container = document.getElementById('songs-container');
    if (!container) return;

    const { data, error } = await _supabase
        .from('musicas')
        .select('id, titulo, autor')
        .order('titulo', { ascending: true });

    if (error) {
        console.error("Erro ao carregar acervo:", error);
        container.innerHTML = "<p style='color:#ff4444;'>Erro ao carregar lista.</p>";
        return;
    }

    todasMusicas = data || [];
    container.innerHTML = "<p style='color:#666; padding:10px; font-size:13px; text-align:center;'>Digite no campo acima para buscar...</p>";
}

function renderizarListaLateral(lista) {
    const container = document.getElementById('songs-container');
    if (!container) return;

    if (lista.length === 0) {
        container.innerHTML = "<p style='color:#666; padding:10px; font-size:13px;'>Nenhuma música encontrada.</p>";
        return;
    }

    container.innerHTML = "";
        lista.forEach(musica => {
            const div = document.createElement('div');
            div.className = 'song-item';
            div.style.position = 'relative'; // Único estilo manual necessário para o ícone do olho ficar absoluto

            // 🎯 GUARDA O ID EXATO NA DIV (Fundamental para a nossa função de destaque)
            div.dataset.idMusica = musica.id;

            // 🎯 SE FOR A MÚSICA ATUAL, SÓ COLOCA A CLASSE ACTIVE (Sem mexer em div.style.background!)
            if (String(musica.id).trim() === String(idMusicaAtual).trim()) {
                div.classList.add('active');
            }

        // 🛡️ Captura o slug existente ou limpa o título de forma agressiva (removendo espaços)
        let slugLink = musica.slug ? musica.slug.trim() : "";
        
        if (!slugLink && musica.titulo) {
            const deAutor = musica.autor ? `-${musica.autor}` : "";
            const textoCompleto = `${musica.titulo}${deAutor}`;
            
            if (typeof gerarSlugDoTexto === 'function') {
                slugLink = gerarSlugDoTexto(textoCompleto);
            } else {
                slugLink = textoCompleto.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
            }
        }

        // 🔥 CORREÇÃO CRÍTICA: href agora está estritamente envolvido por aspas duplas ""
        div.innerHTML = `
            <div style="padding-right: 40px;">
                <div class="song-item-title">${musica.titulo}</div>
                <div class="song-item-artist">${musica.autor || 'Desconhecido'}</div>
            </div>
            <a href="cifra.html?s=${slugLink}" target="_blank" title="Ver Cifra Pública" 
               style="position: absolute; right: 12px; top: 50%; transform: translateY(-50%); 
                      color: #ffc502; text-decoration: none; font-size: 16px; padding: 5px; z-index: 10;">
               👁️
            </a>
        `;

        div.onclick = (e) => {
            if (e.target.tagName !== 'A') {
                carregarMusicaNoEditor(musica.id);
            }
        };
        
        // div.onmouseenter = () => { if (musica.id !== idMusicaAtual) div.style.background = "#1c1f24"; };
        // div.onmouseleave = () => { if (musica.id !== idMusicaAtual) div.style.background = ""; };

        container.appendChild(div);
    });
}

function atualizarDestaqueListaLateral() {
    const container = document.getElementById('songs-container');
    if (!container) return;

    const itens = container.getElementsByClassName('song-item');
    const listaItens = Array.from(itens);

    // 1️⃣ Força a conversão do ID da memória para uma String limpa
    const idAlvoString = (idMusicaAtual !== undefined && idMusicaAtual !== null) ? String(idMusicaAtual).trim() : "";

    // 2️⃣ Faz a varredura item por item limpando e aplicando o destaque
    listaItens.forEach(div => {
        const idDivString = div.dataset.idMusica ? String(div.dataset.idMusica).trim() : "";
        
        // Se o ID da div bater com o ID da memória, adiciona a classe. Se não, remove!
        if (idDivString !== "" && idDivString === idAlvoString) {
            div.classList.add('active');
        } else {
            div.classList.remove('active');
        }
    });
}

// Garante que o filtro continue com o escopo global ativo
window.filterSongs = filterSongs;

function filterSongs() {
    // 🔍 1. Ajustado para ler o ID correto do seu input: 'acervo-search'
    const termo = document.getElementById('acervo-search')?.value.toLowerCase().trim() || "";
    const container = document.getElementById('songs-container');
    
    // Se a lista global não existir ou estiver vazia, aborta de forma segura
    if (typeof todasMusicas === 'undefined' || !Array.isArray(todasMusicas)) {
        console.warn("Aviso: A lista global 'todasMusicas' não foi carregada ou está indefinida.");
        return;
    }

    if (!termo) {
        if (container) {
            container.innerHTML = "<p style='color:#666; padding:10px; font-size:13px; text-align:center;'>Digite no campo acima para buscar...</p>";
        }
        // Opcional: Se quiser que volte a mostrar a lista cheia ao limpar o campo, descomente a linha abaixo:
        // renderizarListaLateral(todasMusicas);
        return;
    }
    
    // 2. Filtra localmente na array que você já tem em memória
    const filtradas = todasMusicas.filter(m =>
        (m.titulo && m.titulo.toLowerCase().includes(termo)) ||
        (m.autor && m.autor.toLowerCase().includes(termo))
    );
    
    if (typeof renderizarListaLateral === 'function') {
        renderizarListaLateral(filtradas);
    }
}

// 🌐 SOLUÇÃO DO ERRO DE ESCOPO: Torna a função visível para o oninput="filterSongs()" do HTML
window.filterSongs = filterSongs;

// --- FLUXO DE ENTRADA (AO DIGITAR) ---
function aoDigitar() {
    const textoBruto = document.getElementById('main-editor')?.value || "";
    const chordProLimpo = tradicionalParaChordPro(textoBruto);
    atualizarSmartBar(extrairAcordesUnicos(chordProLimpo));
    render(); 
}

function atualizarSmartBar(listaAcordes) {
    const bar = document.getElementById('smart-bar');
    if (!bar) return;

    bar.innerHTML = "";
    listaAcordes.forEach(acorde => {
        const btn = document.createElement('button');
        
        // Se for uma seção (começa com {), mantém a injeção de diretriz pura
        if (acorde.startsWith('{')) {
            btn.className = "chord-badge badge-secao";
            btn.innerText = acorde.replace(/\{(?:c|comment):\s*([^}]+)\}/i, '$1'); // Mostra apenas "Refrão" no botão
            
            btn.onclick = () => inserirAcordeNaPosicao(`${acorde}\n`);
        } else {
            btn.className = "chord-badge";
            btn.innerText = acorde; // Mostra o acorde, "|" ou "/" limpo no botão
            
            /* 🎯 A CORREÇÃO CIRÚRGICA: 
               Removemos a trava anterior. Agora, qualquer item que não seja seção 
               (seja um acorde como C#m7, ou os símbolos | e /) será injetado com colchetes [ ] */
            btn.onclick = () => inserirAcordeNaPosicao(`[${acorde}]`);
        }
        
        bar.appendChild(btn);
    });
}

function inserirAcordeNaPosicao(acorde) {
    const txtArea = document.getElementById('main-editor');
    if (!txtArea) return;

    const scrollTopOriginal = txtArea.scrollTop;
    const startPos = txtArea.selectionStart;
    const endPos = txtArea.selectionEnd;
    txtArea.value = txtArea.value.substring(0, startPos) + acorde + txtArea.value.substring(endPos);

    txtArea.focus();
    txtArea.selectionStart = startPos + acorde.length;
    txtArea.selectionEnd = startPos + acorde.length;
    txtArea.scrollTop = scrollTopOriginal;

    aoDigitar();
}

function transporNotaCabecalho(notaOriginal, semitons) {
    if (!notaOriginal || notaOriginal === "--") return "--";
    const escala = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
    
    let notaNormalizada = notaOriginal.trim()
        .replace("Db", "C#")
        .replace("Eb", "D#")
        .replace("Gb", "F#")
        .replace("Ab", "G#")
        .replace("Bb", "A#");
        
    notaNormalizada = notaNormalizada.replace(/m|min|maj|dim|aug|7/g, "");

    const index = escala.indexOf(notaNormalizada);
    if (index === -1) return notaOriginal;

    let novoIndex = (index + semitons) % 12;
    if (novoIndex < 0) novoIndex += 12;

    const ehMenor = notaOriginal.includes("m") && !notaOriginal.includes("max");
    return escala[novoIndex] + (ehMenor ? "m" : "");
}

function updatePreviewHeader() {
    const titulo = document.getElementById('song-title')?.value.trim() || "TÍTULO DA CANÇÃO";
    const artista = document.getElementById('artist-name')?.value.trim() || "ARTISTA";
    const tomOriginal = document.getElementById('song-key')?.value || "--";
    const bpm = document.getElementById('song-bpm')?.value.trim() || "--";

    const gap = (typeof diffAtual !== 'undefined') ? diffAtual : 0;
    const tomAtualizado = gap !== 0 ? transporNotaCabecalho(tomOriginal, gap) : tomOriginal;

    // console.log(`=== ATUALIZANDO HEADER FIXO (Transposição: ${gap} semitons) ===`);

    const previewTitulo = document.getElementById('view-title');
    const previewArtista = document.getElementById('view-artist');
    const previewMeta = document.getElementById('view-meta');

    if (previewTitulo) {
        previewTitulo.textContent = titulo;
        previewTitulo.style.color = "#F1C40F";
        previewTitulo.style.fontSize = "32px";
        previewTitulo.style.fontWeight = "bold";
        previewTitulo.style.textTransform = "uppercase";
    }
    
    if (previewArtista) {
        previewArtista.textContent = artista;
        previewArtista.style.color = "#8E9499";
        previewArtista.style.fontSize = "18px";
        previewArtista.style.textTransform = "uppercase";
    }

    if (previewMeta) {
        const estiloTom = gap !== 0 
            ? "background: rgba(46, 204, 113, 0.15); color: #2ECC71; border: 1px solid rgba(46, 204, 113, 0.3);" 
            : "background: rgba(241, 196, 15, 0.1); color: #F1C40F;";

        previewMeta.innerHTML = `
            <span style="${estiloTom} padding: 4px 8px; border-radius: 4px; font-family: 'Roboto Mono', monospace; font-size: 12px; font-weight: bold;">
                TOM: ${tomAtualizado} ${gap !== 0 ? `(${gap > 0 ? '+' : ''}${gap})` : ''}
            </span>
            <span style="background: rgba(255, 255, 255, 0.05); color: #FFF; padding: 4px 8px; border-radius: 4px; font-family: 'Roboto Mono', monospace; font-size: 12px; margin-left: 8px;">
                COMPASSO: ${bpm ? bpm : '--'}
            </span>
        `;
    }
}

// --- ROTEADOR DE LINHAS UNIFICADO E DINÂMICO ---
function render() {
    // console.log("=== EXECUTANDO RENDER DO EDITOR ===");
    
    const renderContainer = document.getElementById('preview-output');
    if (!renderContainer) return;

    const textoChordPro = document.getElementById('main-editor')?.value || "";
    updatePreviewHeader();
    renderContainer.innerHTML = "";

    if (!textoChordPro.trim()) return;

    // =========================================================================
    // 🔍 MOTOR DE TRATAMENTO DINÂMICO DE LINHAS INSTRUMENTAIS
    // =========================================================================
    const linhas = textoChordPro.split(/\r?\n/);
    let linhasConvertidasParaPreview = [];

    for (let i = 0; i < linhas.length; i++) {
        let linha = linhas[i];
        let linhaTrim = linha.trim();

        if (!linhaTrim) {
            linhasConvertidasParaPreview.push("");
            continue;
        }

        // Se já for uma tag ChordPro legítima, pula
        if (linhaTrim.startsWith("{") && linhaTrim.endsWith("}")) {
            linhasConvertidasParaPreview.push(linha);
            continue;
        }

        // Se já contiver colchetes estruturados, mantém intacto
        if (linha.includes("[") || linha.includes("]")) {
            linhasConvertidasParaPreview.push(linha);
            continue;
        }

        // Identifica se a linha (limpa de ruídos) é puramente composta de acordes
        let linhaLimpaParaChecagem = linhaTrim.replace(/[|()\[\]\-_]/g, ' ').trim();
        let palavras = linhaLimpaParaChecagem.split(/\s+/);
        
        let ehLinhaPuraDeAcordes = palavras.length > 0 && palavras.every(p => {
            return regexAcordeEstrito.test(p) || p === "";
        });

        if (ehLinhaPuraDeAcordes) {
            // Se tiver parênteses estruturais nas pontas da linha tradicional, remove antes de envelopar
            if (linhaTrim.startsWith("(") && linhaTrim.endsWith(")")) {
                linha = linha.replace(/^\s*\(\s*/, '').replace(/\s*\)\s*$/, '');
                if (linha.startsWith("(")) linha = linha.substring(1);
                if (linha.endsWith(")")) linha = linha.slice(0, -1);
            }

            // Envelopa os acordes mantendo os blocos de espaços originais intocados
            let palavrasOriginais = linha.split(/(\s+)/);
            let linhaCamuflada = palavrasOriginais.map(p => {
                let token = p.trim();
                let tokenLimpo = token.replace(/[()]/g, ''); // Trata extensões como (11)
                if (regexAcordeEstrito.test(tokenLimpo) && tokenLimpo !== "") {
                    return p.replace(token, `[${token}]`); // <--- O BUG ESTÁ AQUI!
                }
                return p;
            }).join('');

            // 🔥 O SEGREDO VISUAL: Adiciona um espaço fixo no final da string instrumental.
            // Isso força o motor de renderização a criar a altura física da linha,
            // impedindo que linhas consecutivas de acordes subam e se sobreponham!
            linhasConvertidasParaPreview.push(linhaCamuflada + " ");
        } else {
            linhasConvertidasParaPreview.push(linha);
        }
    }

    // Unifica o texto pré-processado para alimentar o motor do preview
    const textoFinalParaPreview = linhasConvertidasParaPreview.join('\n');
    // console.log("1. TEXTO ENVIADO PARA O MOTOR (TEXTO FINAL):");
    // console.log(JSON.stringify(textoFinalParaPreview));

    const gap = (typeof diffAtual !== 'undefined') ? diffAtual : 0;
    const usaSustentados = (typeof useSharps !== 'undefined') ? useSharps : true;

    // Passa o texto estruturado com segurança para o interpretador visual
    const resultadoMotor = renderizarMusica(textoFinalParaPreview, gap, usaSustentados);
    // console.log("2. HTML GERADO PELO MOTOR (resultadoMotor.html):");
    // console.log(resultadoMotor ? resultadoMotor.html : "NULO");

    const htmlFinal = resultadoMotor && resultadoMotor.html ? resultadoMotor.html : "";

    const bodyDiv = document.createElement('div');
    bodyDiv.id = "cifra-render";
    bodyDiv.className = "preview-mode-active";
    bodyDiv.style.fontFamily = "'Roboto Mono', 'Source Code Pro', monospace";
    bodyDiv.style.display = "flex";
    bodyDiv.style.flexDirection = "column";
    bodyDiv.style.gap = "0px";
    bodyDiv.innerHTML = htmlFinal;

    renderContainer.appendChild(bodyDiv);

    if (resultadoMotor && resultadoMotor.chords && typeof atualizarSmartBar === 'function') {
        atualizarSmartBar(Array.from(resultadoMotor.chords));
    }
    
    // console.log("=== FIM RENDER ===");
}

function camuflarLinhaPuraParaChordPro(linha) {
    const regexAcordeEstruturado = /([A-G][b#]?(?:m|M|maj|maj7|min|dim|aug|sus\d?|add\d?|\d|\(\d+\))*(?:\/[A-G][b#]?)?)/g;
    let linhaLimpa = linha.replace(/[\[\]]/g, '');
    return linhaLimpa.replace(regexAcordeEstruturado, '[$1]');
}

function carriageEnd(linha, index) {
    while (index < linha.length && linha[index] !== " " && linha[index] !== "\t" && linha[index] !== "|") {
        index++;
    }
    return index;
}

function inlineTrim(str) {
    return str ? str.trim() : '';
}

/* ==========================================================================
   🎯 SINCRO DE SMART-BAR EM TEMPO REAL COM DEBOUNCE (400ms)
   ========================================================================== */
let debounceSmartBarTimer;

document.addEventListener('DOMContentLoaded', () => {
    const textareaEditor = document.getElementById('main-editor');

    if (textareaEditor) {
        textareaEditor.addEventListener('input', () => {
            // 1. Limpa o temporizador anterior se você ainda estiver digitando
            clearTimeout(debounceSmartBarTimer);
            
            // 2. Inicia uma nova contagem regressiva de 400ms
            debounceSmartBarTimer = setTimeout(() => {
                const textoAtual = textareaEditor.value;
                
                // 3. Só executa a varredura pesada quando você fizer uma pausa
                if (typeof extrairAcordesUnicos === 'function' && typeof atualizarSmartBar === 'function') {
                    const acordesAtualizados = extrairAcordesUnicos(textoAtual);
                    atualizarSmartBar(acordesAtualizados);
                    // console.log('[Smart-Bar] Atualizada após pausa na digitação.');
                }
            }, 1500); // 400 milissegundos é o tempo perfeito entre digitação e resposta
        });
    }
});

// --- BANCO DE DADOS E SINCRONIZAÇÃO (CORRIGIDO PARA SUPORTAR NOVOS REGISTROS DO ZERO) ---
async function carregarMusicaNoEditor(id) {
    if (!id) return;
    
    // 🛡️ NORMALIZAÇÃO: Garante que o ID seja tratado corretamente independente de ser número ou string/UUID
    idMusicaAtual = typeof id === 'string' && !isNaN(id) ? parseInt(id, 10) : id;
    diffAtual = 0;

    console.log("🔍 Carregando registro no editor. ID Alvo:", idMusicaAtual);

    // // Atualiza a lista lateral com tratamento de segurança
    // if (typeof renderizarListaLateral === 'function' && typeof todasMusicas !== 'undefined') {
    //     renderizarListaLateral(todasMusicas);
    // }

    // Busca os dados diretamente na tabela usando o ID normalizado
    const { data: musica, error } = await _supabase
        .from('musicas')
        .select('*')
        .eq('id', idMusicaAtual)
        .single();

    if (error || !musica) {
        console.error("Erro detalhado do Supabase:", error);
        alert("Erro ao buscar detalhes da cifra no banco de dados.");
        return;
    }

    // 📥 POPULANDO OS CAMPOS DO FORMULÁRIO ESQUERDO
    document.getElementById('song-title').value = musica.titulo || "";
    document.getElementById('artist-name').value = musica.autor || "";
    document.getElementById('song-bpm').value = musica.compasso || "";
    document.getElementById('song-ref').value = musica.link_referencia || "";
    
    // Alimenta o campo de slug na tela
    const inputSlug = document.getElementById('txt-slug');
    if (inputSlug) {
        inputSlug.value = musica.slug || '';
    }

    // Processamento seguro das Tags de Timbre (Patch)
    if (musica.tags) {
        try {
            const tagsArray = typeof musica.tags === 'string' ? JSON.parse(musica.tags) : musica.tags;
            document.getElementById('song-patch').value = Array.isArray(tagsArray) ? tagsArray.join(', ') : musica.tags;
        } catch (e) {
            document.getElementById('song-patch').value = musica.tags;
        }
    } else {
        document.getElementById('song-patch').value = "";
    }

    // Calibração do tom vindo do banco (Garante exibição correta no seletor)
    const escala = ["C", "Db", "D", "Eb", "E", "F", "Gb", "G", "Ab", "A", "Bb", "B"];
    let tomString = "C"; 

    if (musica.tom !== undefined && musica.tom !== null) {
        let tomRaw = parseInt(musica.tom, 10);
        if (!isNaN(tomRaw)) {
            let tomCalibradoIdx = (tomRaw - 3 + 12) % 12;
            tomString = escala[tomCalibradoIdx] || "C";
        } else {
            tomString = (musica.tom || "C").replace('C#','Db').replace('D#','Eb').replace('F#','Gb').replace('G#','Ab').replace('A#','Bb');
        }
    }

    const selectTom = document.getElementById('song-key');
    if (selectTom) {
        selectTom.value = tomString;
    }

    // Define se o tom padrão usa sustenidos ou bemóis
    useSharps = !["F", "Bb", "Eb", "Ab", "Db", "Gb"].includes(tomString);

    // Injeta o texto ChordPro puro dentro do textarea principal do editor
    const cifraChordProPura = musica.conteudo || "";
    document.getElementById('main-editor').value = cifraChordProPura;
    
    // Dispara a renderização e limpa os caches antigos do preview
    updatePreviewHeader();
    render(); 

    // No final de carregarMusicaNoEditor(id):
    updatePreviewHeader();
    render(); 
    
    // 🎯 ADICIONE ESTA LINHA AQUI: Atualiza o cursor visual da lista instantaneamente
    atualizarDestaqueListaLateral();
    
    if (typeof atualizarSmartBar === 'function' && typeof extrairAcordesUnicos === 'function') {
        atualizarSmartBar(extrairAcordesUnicos(cifraChordProPura));
    }
    
    // Atualiza a barra de acordes inteligentes embaixo do editor
    if (typeof atualizarSmartBar === 'function' && typeof extrairAcordesUnicos === 'function') {
        atualizarSmartBar(extrairAcordesUnicos(cifraChordProPura));
    }
}

async function salvarCifra() {
    console.log("=== INÍCIO DO PROCESSO DE SALVAMENTO ===");
    
    const titulo = document.getElementById('song-title').value.trim();
    const autor = document.getElementById('artist-name').value.trim();
    const compasso = document.getElementById('song-bpm').value.trim();
    const linkReferencia = document.getElementById('song-ref').value.trim();
    const patchTeclado = document.getElementById('song-patch').value.trim();
    const tomString = document.getElementById('song-key').value;
    
    let slug = document.getElementById('txt-slug')?.value.trim();

    if (!titulo) {
        alert("O título da canção é obrigatório.");
        return;
    }

    if (!slug) {
        if (typeof gerarSlugDoTexto === 'function') {
            slug = gerarSlugDoTexto(titulo);
        } else {
            slug = titulo.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
        }
        const inputSlug = document.getElementById('txt-slug');
        if (inputSlug) inputSlug.value = slug;
    }

    const escala = ["C", "Db", "D", "Eb", "E", "F", "Gb", "G", "Ab", "A", "Bb", "B"];
    let tomValueForBanco = null;
    let idx = escala.indexOf(tomString);
    if (idx !== -1) {
        tomValueForBanco = (idx + 3) % 12;
    }

    const cifraChordProPura = document.getElementById('main-editor').value;

    const dadosCifra = {
        titulo: titulo,
        autor: autor,
        compasso: compasso,
        link_referencia: linkReferencia,
        tags: patchTeclado,
        tom: tomValueForBanco,
        conteudo: cifraChordProPura,
        slug: slug
    };

    try {
        let resultadoQuery = null;
        let ehNovaMusica = !idMusicaAtual; // Guarda se era um cadastro novo

        if (idMusicaAtual) {
            console.log(`📝 Atualizando cifra existente (ID: ${idMusicaAtual})...`);
            resultadoQuery = await _supabase
                .from('musicas')
                .update(dadosCifra)
                .eq('id', idMusicaAtual)
                .select();
        } else {
            console.log("✨ Cadastrando nova cifra do zero no acervo...");
            resultadoQuery = await _supabase
                .from('musicas')
                .insert([dadosCifra])
                .select();
        }

        const { data, error, status } = resultadoQuery;
        if (error) throw error;

        console.log(`Resposta do Supabase (Status ${status}):`, data);
        alert("Cifra salva com sucesso no acervo do Doze Teclas!");

        if (ehNovaMusica && data && data.length > 0) {
            idMusicaAtual = data[0].id;
            console.log(`🆔 Novo ID capturado e vinculado ao editor: ${idMusicaAtual}`);
        }
        
        // 🛠️ ATUALIZAÇÃO LOCAL SENSACIONAL: Evita recarregar o banco inteiro
        if (typeof todasMusicas !== 'undefined' && data && data.length > 0) {
            const musicaSalva = data[0];

            if (ehNovaMusica) {
                // Se é nova, só adiciona ela no topo ou fim da sua lista local da memória
                todasMusicas.push(musicaSalva);
            } else {
                // Se é edição, localiza ela no array da memória e atualiza os dados
                const index = todasMusicas.findIndex(m => m.id === idMusicaAtual);
                if (index !== -1) {
                    todasMusicas[index] = musicaSalva;
                }
            }

            // Opcional: Re-ordena o array local por ordem alfabética de título
            todasMusicas.sort((a, b) => a.titulo.localeCompare(b.titulo));
        }

        // 🔄 RENDERIZAÇÃO INTELIGENTE DA BARRA LATERAL (Preservando filtros)
                if (typeof renderizarListaLateral === 'function' && typeof todasMusicas !== 'undefined') {
                    
                    const inputBusca = document.getElementById('acervo-search');
                    
                    // Se o usuário estava digitando um filtro na tela
                    if (inputBusca && inputBusca.value.trim() !== "") {
                        // 🚀 O PULO DO GATO: Dispara a sua função nativa de busca!
                        if (typeof filterSongs === 'function') {
                            filterSongs();
                        } else {
                            renderizarListaLateral(todasMusicas);
                        }
                    } else {
                        // Se não tinha busca nenhuma, renderiza a lista completa normal
                        renderizarListaLateral(todasMusicas);
                    }

                    // 🎯 O TOQUE DE CORREÇÃO: Logo após qualquer renderização acima acabar, 
                    // limpamos o rodo e aplicamos o destaque dourado estritamente na música atual.
                    if (typeof atualizarDestaqueListaLateral === 'function') {
                        atualizarDestaqueListaLateral();
                    }
                }

    } catch (err) {
        console.error("Erro crítico ao salvar no Supabase:", err);
        alert("Erro ao salvar a cifra. Abra o Console (F12) para ver o erro.");
    }
    
    console.log("=== FIM DO PROCESSO DE SALVAMENTO ===");
}

// --- FERRAMENTAS DE PRODUTIVIDADE: TRANSPOSIÇÃO DIRETA NO TEXTO E SELETOR (CORRIGIDO) ---
function changeTone(num) {
    const editor = document.getElementById('main-editor');
    const selectTom = document.getElementById('song-key');
    if (!editor || !editor.value.trim()) return;

    console.log(`🔄 Transpondo diretamente o texto do editor em ${num} semitom(ns)`);

    const escala = ["C", "Db", "D", "Eb", "E", "F", "Gb", "G", "Ab", "A", "Bb", "B"];
    
    // ⚙️ Função auxiliar interna para mudar a nota de verdade, ignorando lixos de acúmulo
    function moverNota(notaCompleta) {
        // Captura apenas a primeira nota válida de A a G e seu acidente real inicial (# ou b)
        const match = notaCompleta.match(/^[A-G][b#]?/);
        if (!match) return notaCompleta;
        
        const notaBase = match[0];
        const extensao = notaCompleta.slice(notaBase.length);
        
        const notaNormalizada = notaBase.replace('C#','Db').replace('D#','Eb').replace('F#','Gb').replace('G#','Ab').replace('A#','Bb');
        let idx = escala.indexOf(notaNormalizada);
        
        if (idx !== -1) {
            let novoIdx = (idx + num + 12) % 12;
            let novaNota = escala[novoIdx];
            
            if (useSharps) {
                const equivalentes = { "Db": "C#", "Eb": "D#", "Gb": "F#", "Ab": "G#", "Bb": "A#" };
                if (equivalentes[novaNota]) novaNota = equivalentes[novaNota];
            }
            // Retorna a nota transposta purificada, eliminando qualquer '#' extra que sobrou
            return novaNota + extensao.replace(/[#b]/g, ''); 
        }
        return notaCompleta;
    }

    // Processa o acorde tratando a divisão por barras (ex: G/B)
    function transporAcordeUnico(acorde) {
        return acorde.split('/').map(moverNota).join('/');
    }

    const linhas = editor.value.split('\n');
    const linhasTranspostas = linhas.map(linha => {
        // Limpa códigos HTML acidentais
        let linhaLimpa = linha.replace(/<\/?[^>]+(>|$)/g, "");

        // REGRA A: Se a linha possui colchetes oficiais do padrão ChordPro
        if (linhaLimpa.includes('[') && linhaLimpa.includes(']')) {
            // Transpõe estritamente e APENAS o que está capturado dentro dos colchetes
            return linhaLimpa.replace(/\[([^\]]+)\]/g, (match, miolo) => {
                return `[${transporAcordeUnico(miolo.trim())}]`;
            });
        }

        // REGRA B: Se for uma linha instrumental pura tradicional (ex: Introduções sem colchetes)
        // Captura os acordes soltos baseados na estrutura de espaços e barras comuns
        const regexTradicional = /(?:^|[\s|])([A-G][b#]?(?:m|M|maj|maj7|min|dim|aug|sus\d?|add\d?|\d|\(\d+\))*(?:\/[A-G][b#]?)?)(?=$|[\s|])/g;
        
        if (linhaLimpa.trim().startsWith('|') || !/[a-z]{3,}/i.test(linhaLimpa)) {
            return linhaLimpa.replace(regexTradicional, (match, acorde) => {
                return match.replace(acorde, transporAcordeUnico(acorde));
            });
        }

        return linhaLimpa;
    });

    // 1. Devolve o texto purificado para a caixa esquerda do editor
    editor.value = linhasTranspostas.join('\n');

    // 2. Atualiza o seletor visual de TOM do painel esquerdo
    if (selectTom) {
        const tomAtual = selectTom.value;
        let idx = escala.indexOf(tomAtual);
        if (idx !== -1) {
            let novoIdx = (idx + num + 12) % 12;
            const novoTom = escala[novoIdx];
            selectTom.value = novoTom;
            useSharps = !["F", "Bb", "Eb", "Ab", "Db", "Gb"].includes(novoTom);
        }
    }

    diffAtual = 0;
    updatePreviewHeader();
    render();
}

function transporChordPro(texto, semitones, sharps) {
    return texto.replace(/\[([^\]]+)\]/g, (match, acorde) => {
        return '[' + transporAcorde(acorde, semitones, sharps) + ']';
    });
}

function transporAcorde(acorde, semitones, useSharps) {
    const escala = ["C", "Db", "D", "Eb", "E", "F", "Gb", "G", "Ab", "A", "Bb", "B"];
    return acorde.replace(/[A-G][b#]?/g, nota => {
        const normalizada = nota.replace('C#','Db').replace('D#','Eb').replace('F#','Gb').replace('G#','Ab').replace('A#','Bb');
        const idx = escala.indexOf(normalizada);
        if (idx === -1) return nota;
        const novoIdx = (idx + semitones + 12) % 12;
        const resultado = escala[novoIdx];
        if (useSharps) {
            const mapSharps = { "Db":"C#", "Eb":"D#", "Gb":"F#", "Ab":"G#", "Bb":"A#" };
            return mapSharps[resultado] || resultado;
        }
        return resultado;
    });
}

// --- FERRAMENTAS DE PRODUTIVIDADE: LOCALIZAR E SUBSTITUIR ---
let _posicaoAtual = -1;
let _ocorrencias = [];

function findFirst() {
    const termo = document.getElementById('replace-search')?.value;
    if (!termo) return;

    const txtArea = document.getElementById('main-editor');
    const texto = txtArea.value;
    _ocorrencias = [];
    
    let idx = texto.indexOf(termo);
    while (idx !== -1) {
        _ocorrencias.push(idx);
        idx = texto.indexOf(termo, idx + 1);
    }

    if (_ocorrencias.length === 0) {
        alert(`"${termo}" não encontrado.`);
        _posicaoAtual = -1;
        return;
    }

    _posicaoAtual = 0;
    destacarOcorrencia(txtArea, _ocorrencias[0], termo.length);
}

function findNext() {
    if (_ocorrencias.length === 0) { findFirst(); return; }
    _posicaoAtual = (_posicaoAtual + 1) % _ocorrencias.length;
    const termo = document.getElementById('replace-search')?.value || "";
    destacarOcorrencia(document.getElementById('main-editor'), _ocorrencias[_posicaoAtual], termo.length);
}

function destacarOcorrencia(txtArea, inicio, comprimento) {
    txtArea.focus();
    txtArea.setSelectionRange(inicio, inicio + comprimento);
    
    const numLinhas = txtArea.value.substring(0, inicio).split('\n').length;
    const totalLinhas = txtArea.value.split('\n').length;
    txtArea.scrollTop = (numLinhas / totalLinhas) * txtArea.scrollHeight - (txtArea.clientHeight / 2);
}

function applyReplaceSingle() {
    const termo = document.getElementById('replace-search')?.value;
    const dest = document.getElementById('replace-dest')?.value ?? "";
    if (!termo || _posicaoAtual === -1 || _ocorrencias.length === 0) return;

    const txtArea = document.getElementById('main-editor');
    const pos = _ocorrencias[_posicaoAtual];
    
    txtArea.value = txtArea.value.substring(0, pos) + dest + txtArea.value.substring(pos + termo.length);
    _ocorrencias = [];
    _posicaoAtual = -1;
    aoDigitar();
}

function applyReplaceAll() {
    const termo = document.getElementById('replace-search')?.value;
    const dest = document.getElementById('replace-dest')?.value ?? "";
    if (!termo) return;

    const txtArea = document.getElementById('main-editor');
    const count = (txtArea.value.match(new RegExp(termo.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) || []).length;
    
    if (count === 0) { alert(`"${termo}" não encontrado.`); return; }

    txtArea.value = txtArea.value.replaceAll(termo, dest);
    _ocorrencias = [];
    _posicaoAtual = -1;
    aoDigitar();
    alert(`${count} ocorrência(s) substituída(s).`);
}

// --- PROCESSO DE EXCLUSÃO ---
async function removerCifra() {
    console.log("=== INICIANDO PROCESSO DE EXCLUSÃO ===");
    if (!idMusicaAtual) {
        alert("Nenhuma cifra selecionada para excluir.");
        return;
    }

    const titulo = document.getElementById('song-title').value || "esta cifra";
    const confirmado = confirm(`Tem certeza que deseja excluir permanentemente "${titulo}"? Esta ação não pode ser desfeita.`);
    
    if (!confirmado) return;

    try {
        const { data, error, status } = await _supabase
            .from('musicas')
            .delete()
            .eq('id', idMusicaAtual)
            .select();

        if (error) {
            alert("Erro ao excluir cifra: " + error.message);
            return;
        }

        alert("Cifra excluída com sucesso.");
        await carregarListaAcervo();
        resetEditor();

    } catch (err) {
        alert("Ocorreu um erro inesperado no código. Verifique o console.");
    }
}

function resetEditor() {
    idMusicaAtual = null;
    diffAtual = 0;

    const campos = ['song-title', 'artist-name', 'song-bpm', 'song-patch', 'song-ref', 'main-editor', 'acervo-search', 'txt-slug'];
    campos.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = "";
    });
    
    const selectTom = document.getElementById('song-key');
    if (selectTom) selectTom.value = "C";

    const container = document.getElementById('songs-container');
    if (container) {
        container.innerHTML = "<p style='color:#666; padding:10px; font-size:13px; text-align:center;'>Digite no campo acima para buscar...</p>";
    }
    
    /* ─── 🎯 O AJUSTE CIRÚRGICO ─── */
    // Garante que a Smart-Bar limpe todos os botões de acordes, compassos e seções na hora
    if (typeof atualizarSmartBar === 'function') {
        atualizarSmartBar([]);
    }

    render();
}

// Variável de controle para saber se o usuário alterou o slug manualmente
let slugEditadoManualmente = false;

// Função utilitária para transformar qualquer texto em um slug limpo
function gerarSlugDoTexto(texto) {
    return texto
        .toLowerCase()
        .normalize('NFD')                        // Remove acentos
        .replace(/[\u0300-\u036f]/g, '')         // Remove os restos dos acentos
        .replace(/[^a-z0-9\s-]/g, '')            // Remove caracteres especiais (manter apenas letras, números e espaços)
        .replace(/\s+/g, '-')                    // Substitui espaços por hífen
        .replace(/-+/g, '-')                     // Evita hífens duplicados (--)
        .trim();                                 // Remove espaços nas pontas
}

function popularEditor(musica) {
    // 1. Alinhado para os IDs reais do seu editor de cifras
    const inputTitulo = document.getElementById('song-title');
    const inputEditor = document.getElementById('main-editor');
    const inputSlug = document.getElementById('txt-slug');

    if (inputTitulo) inputTitulo.value = musica.titulo || '';
    if (inputEditor) inputEditor.value = musica.conteudo || '';
    if (inputSlug)   inputSlug.value = musica.slug || '';
    
    // 2. Como a música já existe no banco, travamos a geração automática por segurança
    slugEditadoManualmente = musica.slug ? true : false;
    
    console.log("✏️ Dados da cifra carregados no editor. Slug atual:", musica.slug);
}

// Ouvinte para gerar o slug em tempo real enquanto digita o Título
// Ouvinte para gerar o slug em tempo real enquanto digita o Título (CORRIGIDO: usando 'song-title')
document.getElementById('song-title')?.addEventListener('input', (e) => {
    // Só atualiza automaticamente se o usuário ainda não mexeu no slug por conta própria
    if (!slugEditadoManualmente) {
        const slugGerado = gerarSlugDoTexto(e.target.value);
        const inputSlug = document.getElementById('txt-slug');
        if (inputSlug) inputSlug.value = slugGerado;
    }
});

// Ouvinte para detectar se o usuário digitou diretamente no campo de Slug (Protegido com ?.)
document.getElementById('txt-slug')?.addEventListener('input', (e) => {
    slugEditadoManualmente = true; // Ativa a trava para o título não sobrescrever
    
    // Garante que mesmo digitando manualmente, o link não tenha espaços ou maiúsculas
    e.target.value = e.target.value.toLowerCase().replace(/\s+/g, '-');
});

// --- EXPOSIÇÃO GLOBAL DOS MÉTODOS ---
window.handleLogin = handleLogin;
window.filterSongs = filterSongs;
window.salvarCifra = salvarCifra;
window.removerCifra = removerCifra;
window.resetEditor = resetEditor;
window.aoDigitar = aoDigitar;
window.render = render;
window.updatePreviewHeader = updatePreviewHeader;
window.changeTone = changeTone;
window.findFirst = findFirst;
window.findNext = findNext;
window.applyReplaceSingle = applyReplaceSingle;
window.applyReplaceAll = applyReplaceAll;