// 1. Definição do dataLayer e da função gtag global
window.dataLayer = window.dataLayer || [];
function gtag(){ dataLayer.push(arguments); }

// 2. Condicional de Segurança: Só executa se NÃO estiver rodando localmente na sua máquina
if (window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
    
    // Injeta dinamicamente a tag externa do Google Tag Manager no HTML
    const gTagScript = document.createElement('script');
    gTagScript.async = true;
    gTagScript.src = 'https://www.googletagmanager.com/gtag/js?id=G-08QR6T5GD9';
    document.head.appendChild(gTagScript);

    // Inicializa as configurações do GA4
    gtag('js', new Date());
    gtag('config', 'G-08QR6T5GD9');
} else {
    console.log('[Doze Teclas Dev] Google Analytics bloqueado em ambiente local para evitar falsos positivos.');
}