// artista.js - Controle Dinâmico do Catálogo por Artista

// 🎯 FUNÇÃO CENTRAL DE EXECUÇÃO
async function carregarCatalogoArtista() {
    const urlParams = new URLSearchParams(window.location.search);
    const artistaSlug = urlParams.get('a');

    const tituloEl = document.getElementById('nome-artista-titulo');
    const container = document.getElementById('lista-musicas-container');

    if (!artistaSlug) {
        console.error("Nenhum artista especificado na URL.");
        if (tituloEl) tituloEl.innerText = "Artista não encontrado";
        if (container) container.innerHTML = `<p class="error-msg">Por favor, selecione um artista válido na página inicial.</p>`;
        return;
    }

    const nomeArtistaFormatado = artistaSlug.replace(/-/g, ' ').toUpperCase();
    if (tituloEl) tituloEl.innerText = nomeArtistaFormatado;
    document.title = `${nomeArtistaFormatado} | Doze Teclas`;

    document.getElementById('og-title')?.setAttribute('content', `Cifras de ${nomeArtistaFormatado} | Doze Teclas`);
    document.getElementById('og-desc')?.setAttribute('content', `Acesse o repertório completo e revisado de ${nomeArtistaFormatado} para teclado.`);

    try {
        console.log(`🔍 Buscando músicas no Supabase para o artista slug: ${artistaSlug}`);
        
        // 🎯 CAPTURA INTELIGENTE DE ESCOPO: Tenta buscar de qualquer escopo global disponível
        const instanciaSupabase = window._supabase || typeof _supabase !== 'undefined' ? _supabase : null;

        if (!instanciaSupabase) {
            throw new Error("A instância do Supabase não foi encontrada no escopo.");
        }

        // 2. Faz a Query no Supabase usando a instância encontrada
        const { data: musicas, error } = await instanciaSupabase
            .from('musicas')
            .select('titulo, autor, slug, tom, compasso')
            .ilike('autor', `%${nomeArtistaFormatado}%`)
            .order('titulo', { ascending: true });

        if (error) throw error;
        if (!container) return;
        
        container.innerHTML = ""; 

        if (!musicas || musicas.length === 0) {
            container.innerHTML = `
                <div class="no-songs-box">
                    <p>Ainda estamos revisando e preparando as cifras deste artista.</p>
                    <small>Em breve o catálogo completo estará disponível!</small>
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
            card.innerHTML = `
                <div class="card-info">
                    <h3 class="card-song-title">${musica.titulo}</h3>
                    <p class="card-song-meta">TOM ORIGINAL: <span>${tomVisual}</span></p>
                </div>
                <div class="card-action">
                    <span class="btn-acessar-cifra">VER ▶</span>
                </div>
            `;

            card.addEventListener('click', () => {
                window.location.href = `cifra.html?s=${musica.slug}`;
            });

            container.appendChild(card);
        });

    } catch (err) {
        console.error("Erro crítico ao carregar catálogo do artista:", err);
        if (container) container.innerHTML = `<p class="error-msg">Erro ao conectar com o acervo. Tente novamente mais tarde.</p>`;
    }
}

// 🎯 MOTOR DE CHECAGEM: Aguarda qualquer declaração do Supabase ficar pronta antes de disparar
const checarSupabase = setInterval(() => {
    const existeNoEscopo = window._supabase || typeof _supabase !== 'undefined';
    if (existeNoEscopo) {
        clearInterval(checarSupabase); 
        carregarCatalogoArtista();     
    }
}, 50);