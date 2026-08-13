// supabase-db.js - Gerenciamento exclusivo de dados do Doze Teclas
//
// 🛡️ AUDITORIA DE SEGURANÇA (Chaves e Segredos):
// A constante SUPABASE_KEY abaixo é a chave pública "anon" do projeto (visível no JWT
// decodificado: "role":"anon"). Esta chave é PROJETADA para ser exposta no client-side —
// é o equivalente a uma API Key pública protegida por Row Level Security (RLS) no
// PostgreSQL. NUNCA substitua este valor pela "service_role_key" do painel do Supabase,
// pois ela ignora todas as políticas de RLS e permite acesso irrestrito ao banco inteiro
// (leitura/escrita/exclusão em qualquer tabela) para quem inspecionar o código-fonte.
//
// ⚠️ Pré-requisito obrigatório de segurança: a proteção real dos dados NÃO vem de
// esconder esta chave (impossível em app 100% client-side), e sim de políticas de RLS
// bem configuradas no Supabase (Database > Tables > musicas > RLS Policies), garantindo
// que apenas usuários autenticados como admin possam fazer INSERT/UPDATE/DELETE, e que
// leitura pública (SELECT) exponha somente colunas seguras (sem dados sensíveis).
const SUPABASE_URL = "https://bzkqetttagpvfcayhovp.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ6a3FldHR0YWdwdmZjYXlob3ZwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYxMzE4NzIsImV4cCI6MjA5MTcwNzg3Mn0.WA15riHx0dE-KvxrrXwQhQfO7a-WXrPI7TwS9X6nNKk";

// Inicializa o cliente Supabase globalmente
const _supabase = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// 🛡️ CORREÇÃO DE ESCOPO GLOBAL: `const`/`let` declarados no nível superior de um
// <script> clássico NÃO se tornam propriedades de `window` automaticamente (diferente
// de `var`/funções). Scripts do tipo module (como catalogo.js e artista.js) dependem
// de `window._supabase` como uma das formas de localizar o cliente já inicializado.
// Atribuir explicitamente aqui garante 100% de confiabilidade, independente da ordem
// de carregamento ou do tipo de script que for consumir esta instância depois.
window._supabase = _supabase;



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