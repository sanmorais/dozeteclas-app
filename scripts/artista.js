// scripts/artista.js - Renderização do Perfil e Repertório com Conversão de Tons

const SVG_FALLBACK = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 48 48' width='48' height='48'%3E%3Crect width='48' height='48' fill='%232a2a35'/%3E%3Ccircle cx='24' cy='18' r='8' fill='%23555566'/%3E%3Cpath d='M10 40c0-7.7 6.3-14 14-14s14 6.3 14 14z' fill='%23555566'/%3E%3C/svg%3E";

// Tabela de conversão cromática (0 = C até 11 = B)
const ESCALA_NOTAS = ["C", "Db", "D", "Eb", "E", "F", "Gb", "G", "Ab", "A", "Bb", "B"];

function formatarTom(valorTom) {
    if (valorTom === null || valorTom === undefined || valorTom === '') return 'N/D';
    
    // Se o valor for numérico (ex: "7", "0", 5)
    if (!isNaN(valorTom) && valorTom !== true && valorTom !== false) {
        const valorNumerico = parseInt(valorTom, 10);
        // Subtrai 3 semitons para alinhar com o tom real da cifra
        const idx = (((valorNumerico - 3) % 12) + 12) % 12;
        return ESCALA_NOTAS[idx];
    }
    
    // Se já estiver salvo como texto (ex: "E", "G", "Am")
    return valorTom.toString().trim();
}

function getSlugFromUrl() {
    const params = new URLSearchParams(window.location.search);
    return params.get('a') || '';
}

function normalizar(str) {
    return (str || '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]/g, '')
        .trim();
}

function getSupabaseClient() {
    if (typeof _supabase !== 'undefined' && typeof _supabase.from === 'function') return _supabase;
    if (typeof supabaseClient !== 'undefined' && typeof supabaseClient.from === 'function') return supabaseClient;
    if (typeof db !== 'undefined' && typeof db.from === 'function') return db;
    if (typeof supabase !== 'undefined' && typeof supabase.from === 'function') return supabase;

    if (typeof supabase !== 'undefined' && typeof supabase.createClient === 'function') {
        if (window.SUPABASE_URL && window.SUPABASE_KEY) {
            return supabase.createClient(window.SUPABASE_URL, window.SUPABASE_KEY);
        }
    }
    return null;
}

async function inicializarPaginaArtista() {
    const slug = getSlugFromUrl();
    const tituloEl = document.getElementById('nome-artista-titulo');
    const bioEl = document.getElementById('artista-bio');
    const avatarEl = document.getElementById('artista-avatar');
    const totalCifrasEl = document.getElementById('total-cifras-badge');
    const listaContainer = document.getElementById('lista-musicas-container');

    if (!slug) {
        if (tituloEl) tituloEl.textContent = 'Artista não especificado';
        if (listaContainer) listaContainer.innerHTML = '<p class="error-msg">Nenhum artista foi selecionado.</p>';
        return;
    }

    const client = getSupabaseClient();
    if (!client) {
        console.error('❌ Cliente Supabase não encontrado no escopo global.');
        return;
    }

    try {
        // 1. Busca os dados do artista
        const { data: artistasDb, error: errArtista } = await client
            .from('artistas')
            .select('nome, foto_url, bio');

        if (errArtista) throw errArtista;

        const artistaAtual = artistasDb?.find(a => normalizar(a.nome) === normalizar(slug.replace(/-/g, ' ')));
        const nomeOficial = artistaAtual ? artistaAtual.nome : slug.replace(/-/g, ' ').toUpperCase();

        // 2. Preenche os dados no Hero Card
        if (tituloEl) tituloEl.textContent = nomeOficial;
        document.title = `${nomeOficial} - Cifras e Repertório | Doze Teclas`;

        if (bioEl && artistaAtual?.bio) {
            bioEl.textContent = artistaAtual.bio;
        }

        if (avatarEl) {
            let fotoFinal = SVG_FALLBACK;
            if (artistaAtual?.foto_url) {
                if (artistaAtual.foto_url.startsWith('http://') || artistaAtual.foto_url.startsWith('https://')) {
                    fotoFinal = artistaAtual.foto_url;
                } else {
                    const { data } = client.storage.from('artista').getPublicUrl(artistaAtual.foto_url);
                    fotoFinal = data?.publicUrl || SVG_FALLBACK;
                }
            }
            avatarEl.src = fotoFinal;
            avatarEl.onerror = () => { avatarEl.src = SVG_FALLBACK; };
        }

        // 3. Busca o repertório do artista
        const { data: musicas, error: errMusicas } = await client
            .from('musicas')
            .select('id, titulo, tom, slug')
            .ilike('autor', `%${nomeOficial}%`)
            .order('titulo', { ascending: true });

        if (errMusicas) throw errMusicas;

        // 4. Renderiza as músicas com o tom devidamente formatado
        const qtd = musicas?.length || 0;
        if (totalCifrasEl) {
            totalCifrasEl.innerHTML = `<i class="bi bi-music-note-beamed"></i> ${qtd} ${qtd === 1 ? 'cifra disponível' : 'cifras disponíveis'}`;
        }

        if (!musicas || musicas.length === 0) {
            listaContainer.innerHTML = '<div class="empty-state">Nenhuma cifra cadastrada para este artista ainda.</div>';
            return;
        }

        listaContainer.innerHTML = musicas.map(musica => `
            <a href="cifra.html?s=${musica.slug}" class="card-sugestao">
                <div class="cs-info">
                    <div class="cs-textos-bloco">
                        <div class="cs-titulo">${musica.titulo}</div>
                        <div class="cs-desc">Tom Original: <strong>${formatarTom(musica.tom)}</strong></div>
                    </div>
                </div>
                <div class="cs-seta">VER ➔</div>
            </a>
        `).join('');

        console.log(`✅ Repertório carregado: ${nomeOficial} (${qtd} cifras formatadas).`);

    } catch (err) {
        console.error('❌ Erro ao carregar página do artista:', err);
        if (listaContainer) {
            listaContainer.innerHTML = '<div class="error-msg">Erro ao carregar o repertório do artista.</div>';
        }
    }
}

document.addEventListener('DOMContentLoaded', inicializarPaginaArtista);