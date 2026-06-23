// music-engine.js - Processador de Lógica Musical Puro e Alinhamento de Grades
const escala = ["C", "Db", "D", "Eb", "E", "F", "Gb", "G", "Ab", "A", "Bb", "B"];

function transpose(chord, semitones, useSharps) {
    return chord.replace(/[A-G][b#]?/g, n => {
        let note = n.replace('C#','Db').replace('D#','Eb').replace('F#','Gb').replace('G#','Ab').replace('A#','Bb');
        let idx = (escala.indexOf(note) + semitones + 12) % 12;
        let res = escala[idx];
        if(useSharps) {
            const map = {"Db":"C#","Eb":"D#","Gb":"F#","Ab":"G#","Bb":"A#"};
            return map[res] || res;
        }
        return res;
    });
}

function formatNote(note, useSharps) {
    if (!useSharps) return note;
    const sharps = { "Db": "C#", "Eb": "D#", "Gb": "F#", "Ab": "G#", "Bb": "A#" };
    return sharps[note] || note;
}

/**
 * MOTOR DE RENDERIZAÇÃO ORIGINAL DO DOZE TECLAS
 * Mantém o sincronismo perfeito de grid e letras usando .c-line e .c-chord
 */
function renderizarMusica(text, diff = 0, useSharps = true) {
    if (!text) return { html: "", chords: new Set() };

    const lines = text.split('\n');
    let html = "";
    let chordsFound = new Set();

    lines.forEach(line => {
        let rawLine = line.replace(/\{(start_of_grid|end_of_grid)\}/g, '').trimEnd();

        // Oculta metadados técnicos do ChordPro (mas mantém comentários e diretivas visíveis)
        if (rawLine.startsWith('{') && rawLine.endsWith('}') && !rawLine.toLowerCase().includes('{c:')) {
            return; 
        }

        // Seções e Rótulos {c: INTRO} -> Gera a tarja amarela do seu CSS
        const sectionMatch = rawLine.match(/\{c:\s*(.*?)\}/i);
        if (sectionMatch) {
            let nomeSecao = sectionMatch[1].trim().replace(/:$/, '');
            html += `<div class="section-label">${nomeSecao.toUpperCase()}</div>\n`;
            return;
        }

        // Normalização automática de Grades Antigas (se houver linhas com | mas sem [])
        if (rawLine.includes('|') && !rawLine.includes('[')) {
            rawLine = rawLine.replace(/([A-G][b#]?(m|maj|dim|aug|sus|add|7|9|11|13)*(\/[A-G][b#]?)?)/g, '[$1]');
        }

        // -----------------------------------------------------------------
        // PROCESSAMENTO DE ACORDES, LETRAS E GRADES (ALINHAMENTO POR CARACTERE)
        // -----------------------------------------------------------------
        if (rawLine.includes('[') || rawLine.includes('|')) {
            let chordLine = "";
            let textLine = "";
            let i = 0;
            
            // Verifica se a linha possui texto/letra real ou se é apenas uma linha de acordes/grades pura
            const hasLyrics = rawLine.replace(/\[.*?\]/g, '').replace(/[|\s\d*xX/\\_.-]/g, '').trim().length > 0;

            while (i < rawLine.length) {
                if (rawLine[i] === '[') {
                    let j = rawLine.indexOf(']', i);
                    if (j === -1) break;
                    
                    let chord = rawLine.substring(i + 1, j);
                    
                    // TRANSPOSIÇÃO GARANTIDA
                    let transChord = transpose(chord, diff, useSharps);
                    chordsFound.add(transChord);
                    
                    // Detecta se é linha de grade (se tem barras ou se não tem letra nenhuma na linha)
                    let nextChar = rawLine[j + 1] || "";
                    let isGridLine = "|/\\ ".includes(nextChar) && (rawLine.trim().startsWith('|') || !hasLyrics);

                    if (isGridLine) {
                        // Em linhas de grade pura ou blocos de acordes, ocupa espaço físico real
                        chordLine += `<span class="c-chord">${transChord}</span>`;
                    } else {
                        // Em linhas de letra, o acorde flutua para manter o sincronismo da sílaba
                        chordLine += `<span style="display: inline-block; width: 0; vertical-align: bottom; white-space: nowrap;"><span class="c-chord">${transChord}</span></span>`;
                    }
                    
                    i = j + 1;
                } 
                else if ("|/\\".includes(rawLine[i])) {
                    chordLine += `<span class="c-chord">${rawLine[i]}</span>`;
                    textLine += "&nbsp;"; 
                    i++;
                } 
                else {
                    chordLine += "&nbsp;"; 
                    textLine += (rawLine[i] === " ") ? "&nbsp;" : rawLine[i];
                    i++;
                }
            }

            html += `<div class="c-line">${chordLine}</div>\n`;
            if (hasLyrics) {
                html += `<div class="c-line">${textLine}</div>\n`;
            }
        } else {
            // -----------------------------------------------------------------
            // TEXTO SIMPLES, COMENTÁRIOS PARÊNTESES OU QUEBRAS DE LINHA
            // -----------------------------------------------------------------
            
            // 1. Linha completamente vazia: Preserva o espaçamento e quebra de linha física
            if (rawLine.trim() === "") {
                html += `<div class="c-line">&nbsp;</div>\n`;
            } 
            // 2. Comentário isolado em linha única entre parênteses: Remove os símbolos ( ) do preview
            else if (rawLine.trim().startsWith('(') && rawLine.trim().endsWith(')')) {
                let textoComentario = rawLine.replace(/^\s*\(\s*/, '').replace(/\s*\)\s*$/, '');
                html += `<div class="c-line"><span class="c-comment">${textoComentario}</span></div>\n`;
            } 
            // 3. Linha de texto comum ou comentário no meio da frase
            else {
                let formattedText = rawLine.replace(/\((.*?)\)/g, '<span class="c-comment">$1</span>');
                html += `<div class="c-line">${formattedText}</div>\n`;
            }
        }
    });

    return { html, chords: chordsFound };
}