// supabase-db.js - Gerenciamento exclusivo de dados do Doze Teclas
const SUPABASE_URL = "https://bzkqetttagpvfcayhovp.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ6a3FldHR0YWdwdmZjYXlob3ZwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYxMzE4NzIsImV4cCI6MjA5MTcwNzg3Mn0.WA15riHx0dE-KvxrrXwQhQfO7a-WXrPI7TwS9X6nNKk";

// Inicializa o cliente Supabase globalmente
// Inicializa o cliente Supabase globalmente
const _supabase = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

function getQueryParam(param) {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get(param);
}

// Busca a música de forma limpa e retorna o objeto do banco (Mantida por segurança)
async function buscarMusicaNoBanco(id) {
    try {
        const { data, error } = await _supabase
            .from('musicas')
            .select('*')
            .eq('id', id)
            .single();

        if (error) throw error;
        return data;
    } catch (error) {
        console.error("Erro ao buscar cifra no Supabase por ID:", error);
        return null;
    }
}

// 🔥 NOVA FUNÇÃO: Busca a música usando a coluna 'slug' para a URL Amigável
async function buscarMusicaNoBancoPorSlug(slug) {
    try {
        const { data, error } = await _supabase
            .from('musicas')
            .select('*')
            .eq('slug', slug) // Mira na coluna slug do seu banco
            .single();

        if (error) throw error;
        return data; // Retorna os dados da música encontrados
    } catch (error) {
        console.error("Erro ao buscar cifra no Supabase por Slug:", error);
        return null;
    }
}

// Se o seu projeto rodar como módulo e os outros arquivos precisarem enxergar esta função:
window.buscarMusicaNoBancoPorSlug = buscarMusicaNoBancoPorSlug;