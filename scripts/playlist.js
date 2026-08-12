// playlist.js - Filtro Temático de Repertórios (Playlists por Tags)

// 🛡️ SANITIZAÇÃO ANTI-XSS: Escapa texto vindo do Supabase (título, autor) antes de
// injetar via innerHTML, impedindo execução de <script>/tags maliciosas salvas no banco.
function escapeHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

// 🛡️ SANITIZAÇÃO DE FILTRO ILIKE: Escapa os caracteres especiais do PostgREST (% e _)
// que atuam como wildcards dentro do operador ilike, evitando que o valor vindo da URL
// (?t=) manipule o filtro para retornar resultados além do pretendido.
function escapeIlike(str) {
    return String(str).replace(/[%_]/g, '\\$&');
}

// 🎯 FUNÇÃO CENTRAL DE EXECUÇÃO
async function carregarPlaylistTematica() {
    const urlParams = new URLSearchParams(window.location.search);
    const playlistTag = urlParams.get('t');


    const tituloEl = document.getElementById('playlist-title');
    const container = document.getElementById('playlist-grid-container');

    if (!playlistTag) {
        console.error("Nenhuma tag de playlist especificada na URL.");
        if (tituloEl) tituloEl.innerText = "Playlist não encontrada";
        if (container) container.innerHTML = `<p class="error-msg">Por favor, selecione uma categoria válida na página inicial.</p>`;
        return;
    }

    const dicionarioTemas = {
        "adoracao": "ADORAÇÃO",
        "comunhao": "COMUNHÃO",
        "ofertorio": "OFERTÓRIO",
        "maria": "NOSSA SENHORA",
        "louvor": "LOUVOR E ANIMAÇÃO"
    };

    const nomePlaylistFormatado = dicionarioTemas[playlistTag.toLowerCase()] || playlistTag.toUpperCase();
    if (tituloEl) tituloEl.innerText = nomePlaylistFormatado;
    document.title = `Playlist ${nomePlaylistFormatado} | Doze Teclas`;

    document.getElementById('og-title')?.setAttribute('content', `Playlist: ${nomePlaylistFormatado} | Doze Teclas`);
    document.getElementById('og-desc')?.setAttribute('content', `Seleção especial de cifras revisadas e preparadas para o momento de ${nomePlaylistFormatado}.`);

    try {
        console.log(`🔍 Buscando músicas no Supabase com a tag: ${playlistTag}`);
        
        const instanciaSupabase = window._supabase || (typeof _supabase !== 'undefined' ? _supabase : null);

        if (!instanciaSupabase) {
            throw new Error("A instância do Supabase não foi encontrada no escopo.");
        }

        // 🎯 CORREÇÃO AQUI: Mudamos 'patch' para 'tags' tanto no select quanto no filtro ilike
        const { data: musicas, error } = await instanciaSupabase
            .from('musicas')
            .select('titulo, autor, slug, tom, compasso, tags') // Buscando a coluna certa
            .ilike('tags', `%${escapeIlike(playlistTag)}%`)     // Filtrando na coluna certa (sanitizado)
            .order('titulo', { ascending: true });


        if (error) throw error;
        if (!container) return;
        
        container.innerHTML = ""; 

        if (!musicas || musicas.length === 0) {
            container.innerHTML = `
                <div class="no-songs-box">
                    <p>Ainda estamos preparando as cifras para esta categoria.</p>
                    <small>Em breve novos repertórios estarão disponíveis!</small>
                </div>`;
            return;
        }

        const escalaExibicao = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

        musicas.forEach(musica => {
            let tomVisual = "--";
            let tomRaw = parseInt(musica.tom, 10);
            if (!isNaN(tomRaw)) {
                let idx = (tomRaw - 3 + 12) % 12;
                tomVisual = escalaExibicao[idx];
            }

            const card = document.createElement('div');
            card.className = 'card-musica-item';
            // 🛡️ Título/autor escapados para impedir XSS armazenado vindo do banco
            card.innerHTML = `
                <div class="card-info">
                    <h3 class="card-song-title">${escapeHtml(musica.titulo)}</h3>
                    <p class="card-song-meta">${escapeHtml((musica.autor || '').toUpperCase())} • TOM: <span>${escapeHtml(tomVisual)}</span></p>
                </div>
                <div class="card-action">
                    <span class="btn-acessar-cifra">VER ▶</span>
                </div>
            `;

            card.addEventListener('click', () => {
                // 🛡️ encodeURIComponent evita que o slug quebre a URL ou injete parâmetros extras
                window.location.href = `cifra.html?s=${encodeURIComponent(musica.slug)}`;
            });


            container.appendChild(card);
        });

    } catch (err) {
        console.error("Erro crítico ao carregar playlist:", err);
        if (container) container.innerHTML = `<p class="error-msg">Erro ao conectar com o acervo. Tente novamente mais tarde.</p>`;
    }
}

const checarSupabase = setInterval(() => {
    const existeNoEscopo = window._supabase || typeof _supabase !== 'undefined';
    if (existeNoEscopo) {
        clearInterval(checarSupabase); 
        carregarPlaylistTematica();     
    }
}, 50);