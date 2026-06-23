// chordpro-parser.js - Versão Definitiva com Limpeza Periférica de Parênteses

function converterBlocoParaChordPro(textoBruto) {
    if (!textoBruto || !textoBruto.trim()) return "";
    
    const linhas = textoBruto.split(/\r?\n/);
    let resultadoChordPro = [];
    
    // REGEX DE ACORDES PARA TECLADO: Aceita extensões complexas com parênteses embutidos
    const regexAcorde = /^[A-G][b#]?(2|4|5|6|7|9|11|13|maj|min|m|dim|aug|sus|add|\(\d+\))*(\/[A-G][b#]?)?$/i;

    for (let i = 0; i < linhas.length; i++) {
        let linhaAtual = linhas[i];
        let linhaSeguinte = linhas[i + 1] !== undefined ? linhas[i + 1] : "";

        let linhaLimpa = linhaAtual.trim();
        if (linhaLimpa === "") {
            resultadoChordPro.push(linhaAtual);
            continue;
        }

        // 🔍 ESTRATÉGIA ANTI-CORTINA: Detecta se a linha está envolvida por () ou [] externos de marcação instrumental
        let temEnvoltórioExterno = (linhaLimpa.startsWith("(") && linhaLimpa.endsWith(")")) || 
                                   (linhaLimpa.startsWith("[") && linhaLimpa.endsWith("]"));
        
        if (temEnvoltórioExterno) {
            // Remove apenas o primeiro e o último caractere (os delimitadores externos)
            let conteudoInterno = linhaLimpa.slice(1, -1).trim();
            
            // Verifica se o que sobrou lá dentro são apenas acordes separados por espaços
            let palavrasInternas = conteudoInterno.split(/\s+/);
            let internoEhApenasAcordes = palavrasInternas.length > 0 && palavrasInternas.every(p => {
                let itemLimpo = p.replace(/[|\-_\.]/g, '').trim();
                return regexAcorde.test(itemLimpo) || itemLimpo === "";
            });

            // Se for apenas acorde envolvido, nós "desembrulhamos" a linha e preservamos a estrutura original
            if (internoEhApenasAcordes) {
                // Reconstroi a linha original mantendo o espaçamento relativo aproximado, mas sem as bordas
                linhaAtual = "  " + conteudoInterno; 
                linhaLimpa = linhaAtual.trim();
            }
        }

        // 1. Agora sim, tokeniza para verificar se a linha processada é EXCLUSIVAMENTE composta por acordes
        let palavras = linhaLimpa.split(/\s+/);
        let ehLinhaDeAcordes = palavras.length > 0 && palavras.every(p => {
            let itemLimpo = p.replace(/[|\-_\.]/g, '').trim();
            return regexAcorde.test(itemLimpo) || itemLimpo === "";
        });

        // SE FOR LINHA DE ACORDES: Faz a fusão com a letra abaixo ou mantém como instrumental pura
        if (ehLinhaDeAcordes) {
            let palavrasSeguinte = linhaSeguinte.trim().split(/\s+/);
            let seguinteEhAcorde = palavrasSeguinte.length > 0 && palavrasSeguinte.every(p => regexAcorde.test(p.replace(/[|\-_\.]/g, '').trim()));

            // Fusão milimétrica por colunas com a linha de baixo (se for a letra real da música)
            if (!seguinteEhAcorde && linhaSeguinte.trim() !== "") {
                let linhaMesclada = "";
                let offsetLetra = 0;
                
                for (let col = 0; col < linhaAtual.length; col++) {
                    if (linhaAtual[col] !== " " && (col === 0 || linhaAtual[col - 1] === " ")) {
                        let restoLinha = linhaAtual.substring(col);
                        let acorde = restoLinha.split(" ")[0]; 
                        
                        while (offsetLetra < col) {
                            linhaMesclada += linhaSeguinte[offsetLetra] || " ";
                            offsetLetra++;
                        }
                        
                        linhaMesclada += `[${acorde}]`;
                        col += acorde.length - 1;
                    } else {
                        if (offsetLetra <= col && linhaSeguinte[offsetLetra] !== undefined) {
                            linhaMesclada += linhaSeguinte[offsetLetra];
                            offsetLetra++;
                        }
                    }
                }
                
                if (offsetLetra < linhaSeguinte.length) {
                    linhaMesclada += linhaSeguinte.substring(offsetLetra);
                }
                
                resultadoChordPro.push(linhaMesclada);
                i++; // Consome a linha da letra
                continue;
            } else {
                // Linha instrumental pura isolada (ex: introdução sem letra embaixo). Mantém intacta!
                resultadoChordPro.push(linhaAtual);
                continue;
            }
        }

        // 2. SE NÃO FOR LINHA DE ACORDES: Avalia se é marcação de Seção Real (Intro, Refrão, etc.)
        let linhaCaixaAlta = linhaLimpa.toUpperCase();
        let ehMarcacaoSecao = false;
        let nomeSecaoDetectada = "";

        if ((linhaLimpa.startsWith("[") && linhaLimpa.endsWith("]")) || 
            (linhaLimpa.startsWith("(") && linhaLimpa.endsWith(")")) || 
            linhaCaixaAlta.startsWith("INTRO") || linhaCaixaAlta.startsWith("REFRÃO") || 
            linhaCaixaAlta.startsWith("CORO") || linhaCaixaAlta.startsWith("PONTE") || 
            linhaCaixaAlta.startsWith("PARTE") || linhaCaixaAlta.startsWith("PRÉ")) {
            
            ehMarcacaoSecao = true;
            nomeSecaoDetectada = linhaAtual.replace(/[:[\]()]/g, '').trim();
        }

        if (ehMarcacaoSecao) {
            resultadoChordPro.push(`{c: ${nomeSecaoDetectada}}`);
            continue;
        }

        // 3. Linha comum de letra de música
        resultadoChordPro.push(linhaAtual);
    }

    return resultadoChordPro.join('\n');
}

// Vincula ao escopo global para comunicação dinâmica
window.converterBlocoParaChordPro = converterBlocoParaChordPro;