// editor-parser.js - Versão 2.7 (Fundação Rígida de Espaços e Fim do Truncamento)

export function tradicionalParaChordPro(textoTradicional) {
    if (!textoTradicional) return "";
    const linhas = textoTradicional.split('\n');
    let resultado = [];

    for (let i = 0; i < linhas.length; i++) {
        const linhaAtual = linhas[i];
        const linhaTrim = linhaAtual.trim();

        if (!linhaTrim) {
            resultado.push("");
            continue;
        }

        if (linhaTrim.startsWith('(') && linhaTrim.endsWith(')')) {
            resultado.push(`{comment: ${linhaTrim}}`);
            continue;
        }

        if (linhaTrim.endsWith(':') || /^(INTRO|PARTE|REFRÃO|PRÉ|PONTE|CORO|SOLO|FIM|PASSAGEM|FINAL|VOCAL)/i.test(linhaTrim)) {
            resultado.push(`{c: ${linhaTrim.toUpperCase()}}`);
            continue;
        }

        if (ehLinhaDeAcordes(linhaAtual)) {
            const linhaSeguinte = (i + 1 < linhas.length) ? linhas[i + 1] : null;

            if (linhaSeguinte !== null && linhaSeguinte.trim() !== "" && 
                !ehLinhaDeAcordes(linhaSeguinte) && 
                !linhaSeguinte.trim().endsWith(':') && 
                !(linhaSeguinte.trim().startsWith('(') && linhaSeguinte.trim().endsWith(')')) &&
                !/^(INTRO|PARTE|REFRÃO|PRÉ|PONTE|CORO|SOLO|FIM|PASSAGEM)/i.test(linhaSeguinte.trim())) {
                
                resultado.push(mesclarAcordesEmTexto(linhaAtual, linhaSeguinte));
                i++;
            } else {
                // Aqui acontece a mágica para as sequências puras!
                resultado.push(converterLinhaAcordesPura(linhaAtual));
            }
            continue;
        }

        resultado.push(linhaAtual);
    }

    return resultado.join('\n');
}

export function chordProParaTradicional(textoChordPro) {
    if (!textoChordPro) return "";
    const linhas = textoChordPro.split(/\r?\n/);
    let resultado = [];

    for (let i = 0; i < linhas.length; i++) {
        let linha = linhas[i];
        let linhaTrim = linha.trim();

        if (linhaTrim.startsWith('{start_of_grid}') || linhaTrim.startsWith('{end_of_grid}')) continue;

        if (!linhaTrim) {
            resultado.push("");
            continue;
        }

        if (linhaTrim.startsWith('{') && linhaTrim.endsWith('}')) {
            let conteudo = linhaTrim.slice(1, -1).trim();
            if (conteudo.startsWith('c:') || conteudo.startsWith('comment:')) {
                let valor = conteudo.substring(conteudo.indexOf(':') + 1).trim();
                resultado.push(valor);
            }
            continue;
        }

        if (!linha.includes('[')) {
            resultado.push(linha);
            continue;
        }

        let linhaAcordes = "";
        let linhaLetra = "";
        let j = 0;

        while (j < linha.length) {
            if (linha[j] === '[') {
                let fechar = linha.indexOf(']', j);
                if (fechar !== -1) {
                    let acorde = linha.substring(j + 1, fechar).replace(/<[^>]*>/g, '');
                    while (linhaAcordes.length < linhaLetra.length) {
                        linhaAcordes += " ";
                    }
                    linhaAcordes += acorde;
                    j = fechar + 1;
                    continue;
                }
            }
            linhaLetra += linha[j];
            j++;
        }

        // LIMPEZA: Converte os espaços rígidos invisíveis de volta para espaços normais do editor
        linhaLetra = linhaLetra.replace(/\u00A0/g, ' ');

        if (linhaAcordes.trim()) resultado.push(linhaAcordes);
        
        // Só devolve a linha de letra para o editor se ela tiver texto de verdade, ignorando as fundações falsas
        if (linhaLetra.trim().length > 0) resultado.push(linhaLetra);
    }

    return resultado.join('\n');
}

function ehLinhaDeAcordes(linha) {
    const linhaTrim = linha.trim();
    if (!linhaTrim) return false;

    if (linhaTrim.includes('|')) return true;

    const tokens = linhaTrim.split(/\s+/).filter(t => t.trim() !== '');
    if (tokens.length === 0) return false;

    const regexAcordeExato = /^[A-G][b#]?(m|M|maj|MIN|MAJ|min|dim|aug|sus|add|b|#|\d|\(|\)|\+)*(\/[A-G][b#]?(m|M|maj|min|dim|aug|sus|add|b|#|\d|\(|\)|\+)*)?$/;

    let acertos = 0;
    for (let t of tokens) {
        let limpo = t.replace(/^[|()]+|[|()]+$/g, '');
        if (regexAcordeExato.test(limpo) || limpo.toLowerCase() === 'x' || limpo === '-' || limpo === '/') {
            acertos++;
        }
    }
    return (acertos / tokens.length) >= 0.4;
}

function converterLinhaAcordesPura(linha) {
    // Em vez de retornar com colchetes que ativam o algoritmo de alinhamento,
    // retornamos o acorde envolto em um span com uma classe que o CSS vai estilizar.
    // Assim, o motor acha que é apenas texto comum e não altera o espaçamento.
    return linha.replace(/\[([^\]]+)\]/g, '<span class="chord-manual">$1</span>');
}

function mesclarAcordesEmTexto(linhaAcordes, linhaTexto) {
    let res = "";
    let idxTexto = 0;

    for (let i = 0; i < linhaAcordes.length; i++) {
        if (linhaAcordes[i] !== ' ' && linhaAcordes[i] !== '\t') {
            let acorde = "";
            let inicioIdx = i;

            while (i < linhaAcordes.length && linhaAcordes[i] !== ' ' && linhaAcordes[i] !== '\t') {
                acorde += linhaAcordes[i];
                i++;
            }
            i--;

            while (idxTexto < inicioIdx && idxTexto < linhaTexto.length) {
                res += linhaTexto[idxTexto];
                idxTexto++;
            }

            while (res.length < inicioIdx) {
                res += " ";
            }

            res += `[${acorde}]`;
        }
    }

    if (idxTexto < linhaTexto.length) {
        res += linhaTexto.substring(idxTexto);
    }
    return res;
}

export function extrairAcordesUnicos(textoChordPro) {
    if (!textoChordPro) return [];
    
    let itensSmartBar = new Set();
    
    // 1. CAPTURA DE DIRETRIZES DE SEÇÃO (ex: {c: Refrão}, {c: Intro})
    // Procura por padrões {c: Qualquer Texto} ou {comment: Qualquer Texto}
    const regexDiretrizes = /\{(?:c|comment):\s*([^}]+)\}/gi;
    let matchDiretriz;
    while ((matchDiretriz = regexDiretrizes.exec(textoChordPro)) !== null) {
        let secao = matchDiretriz[1].trim();
        if (secao) {
            // Adiciona a seção formatada como diretriz ChordPro para o botão injetar certo
            itensSmartBar.add(`{c: ${secao}}`);
        }
    }

    // 2. CAPTURA DE ACORDES E SÍMBOLOS DE COMPASSO
    // Remove apenas as linhas de diretrizes para a análise de colchetes, evitando spans residuais
    const linhasLimpas = textoChordPro.split('\n').filter(l => !l.trim().startsWith('{'));
    const textoParaAnalisar = linhasLimpas.join('\n');

    const regexAcordes = /\[([^\]]+)\]/g;
    let matchAcorde;
    
    while ((matchAcorde = regexAcordes.exec(textoParaAnalisar)) !== null) {
        let item = matchAcorde[1].replace(/<[^>]*>/g, '').trim();
        
        if (item) {
            // 🎯 LIBERAÇÃO DOS SÍMBOLOS: Se for estritamente uma barra ou um divisor de tempo, mantém!
            if (item === '|' || item === '/') {
                itensSmartBar.add(item);
            } 
            // Validação padrão para acordes legítimos (começando de A a G)
            else if (!item.toLowerCase().includes('span') && /^[A-G]/i.test(item)) {
                itensSmartBar.add(item);
            }
        }
    }
    
    return Array.from(itensSmartBar);
}

// --- VALIDADOR DE LINHA DE ACORDES PURA AJUSTADO ---
function ehLinhaDeAcordesPura(linha) {
    if (!linha.trim()) return false;

    // Remove barras de compasso e espaços para analisar apenas o conteúdo técnico
    let linhaLimpa = linha.replace(/[||\-\s]/g, '');
    if (!linhaLimpa) return false;

    // REGEX ATUALIZADO: Agora ele reconhece explicitamente o "M" maiúsculo, maj, sus, etc.
    const regexAcordeValido = /^([A-G][b#]?(?:m|M|maj|maj7|min|dim|aug|sus\d?|add\d?|\d)*(?:\/[A-G][b#]?)?)+$/;

    // Divide a linha por espaços ou barras para validar bloco por bloco
    let blocos = linha.split(/[\s|]+/);
    let temAcorde = false;

    for (let i = 0; i < blocos.length; i++) {
        let bloco = blocos[i].trim();
        if (!bloco) continue;

        // Se encontrar qualquer bloco de texto que não case com o padrão de acordes (ex: uma palavra real), não é linha pura
        if (!regexAcordeValido.test(bloco)) {
            return false;
        }
        temAcorde = true;
    }

    return temAcorde;
}

window.ehLinhaDeAcordesPura = ehLinhaDeAcordesPura;