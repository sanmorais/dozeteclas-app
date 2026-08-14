/**
 * ==========================================================
 * AUTO-SCROLL FLUIDO - Motor de Rolagem Ultra-Suave
 * Doze Teclas - Sistema de Rolagem Automática para Cifras
 * ==========================================================
 */

class AutoScrollEngine {
    constructor() {
        this.isScrolling = false;
        this.scrollSpeed = 30; // pixels por segundo
        this.lastTimestamp = null;
        this.animationId = null;
        this.hideTimeout = null;
        
        // Elementos DOM
        this.container = document.getElementById('auto-scroll-container');
        this.btn = document.getElementById('auto-scroll-btn');
        this.icon = document.getElementById('auto-scroll-icon');
        this.sliderContainer = document.getElementById('speed-slider-container');
        this.speedSlider = document.getElementById('speed-slider');
        
        this.init();
    }
    
    init() {
        if (!this.container || !this.btn || !this.icon || !this.sliderContainer || !this.speedSlider) {
            console.warn('Auto-scroll: Elementos DOM não encontrados');
            return;
        }
        
        this.setupEventListeners();
        this.updateSpeedFromSlider();
    }
    
    setupEventListeners() {
        // Botão principal - toggle play/pause
        this.btn.addEventListener('click', () => {
            this.toggleAutoScroll();
        });
        
        // Slider de velocidade
        this.speedSlider.addEventListener('input', () => {
            this.updateSpeedFromSlider();
            this.resetHideTimer();
        });
        
        // Interação com o slider - cancelar auto-hide
        this.sliderContainer.addEventListener('mouseenter', () => {
            this.clearHideTimer();
        });
        
        this.sliderContainer.addEventListener('mouseleave', () => {
            this.resetHideTimer();
        });
        
        // Touch events para mobile
        this.sliderContainer.addEventListener('touchstart', () => {
            this.clearHideTimer();
        });
        
        this.sliderContainer.addEventListener('touchend', () => {
            this.resetHideTimer();
        });
        
        // Parar rolagem ao chegar no fim da página
        window.addEventListener('scroll', () => {
            if (this.isScrolling && this.isAtBottom()) {
                this.stopAutoScroll();
            }
        });
        
        // Parar rolagem com tecla ESC
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.isScrolling) {
                this.stopAutoScroll();
            }
        });
    }
    
    toggleAutoScroll() {
        if (this.isScrolling) {
            this.stopAutoScroll();
        } else {
            this.startAutoScroll();
        }
    }
    
    startAutoScroll() {
        if (this.isScrolling) return;
        
        this.isScrolling = true;
        this.lastTimestamp = null;
        
        // Atualizar UI
        this.btn.classList.add('playing');
        this.icon.className = 'bi bi-pause-fill';
        this.btn.title = 'Pausar Rolagem Automática';
        
        // Mostrar slider de velocidade
        this.showSpeedSlider();
        
        // Iniciar animação
        this.animationId = requestAnimationFrame((timestamp) => {
            this.scrollStep(timestamp);
        });
        
        // Disparar evento analytics
        if (window.gtag) {
            gtag('event', 'auto_scroll_start', {
                'event_category': 'cifra_tools',
                'event_label': 'auto_scroll',
                'value': this.scrollSpeed
            });
        }
    }
    
    stopAutoScroll() {
        if (!this.isScrolling) return;
        
        this.isScrolling = false;
        this.lastTimestamp = null;
        
        // Cancelar animação
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
            this.animationId = null;
        }
        
        // Atualizar UI
        this.btn.classList.remove('playing');
        this.icon.className = 'bi bi-play-fill';
        this.btn.title = 'Rolagem Automática';
        
        // Ocultar slider após um delay
        this.resetHideTimer();
        
        // Disparar evento analytics
        if (window.gtag) {
            gtag('event', 'auto_scroll_stop', {
                'event_category': 'cifra_tools',
                'event_label': 'auto_scroll'
            });
        }
    }
    
    scrollStep(timestamp) {
        if (!this.isScrolling) return;
        
        // Calcular delta time
        if (!this.lastTimestamp) {
            this.lastTimestamp = timestamp;
        }
        
        const deltaTime = (timestamp - this.lastTimestamp) / 1000; // converter para segundos
        this.lastTimestamp = timestamp;
        
        // Calcular pixels a rolar baseado na velocidade e tempo decorrido
        const pixelsToScroll = this.scrollSpeed * deltaTime;
        
        // Rolar suavemente
        window.scrollBy(0, pixelsToScroll);
        
        // Verificar se chegou ao fim da página
        if (this.isAtBottom()) {
            this.stopAutoScroll();
            return;
        }
        
        // Continuar animação
        this.animationId = requestAnimationFrame((nextTimestamp) => {
            this.scrollStep(nextTimestamp);
        });
    }
    
    updateSpeedFromSlider() {
        this.scrollSpeed = parseInt(this.speedSlider.value);
    }
    
    showSpeedSlider() {
        this.sliderContainer.style.display = 'flex';
        // Forçar reflow para animação
        this.sliderContainer.offsetHeight;
        this.sliderContainer.classList.add('show');
        
        this.resetHideTimer();
    }
    
    hideSpeedSlider() {
        this.sliderContainer.classList.remove('show');
        setTimeout(() => {
            if (!this.sliderContainer.classList.contains('show')) {
                this.sliderContainer.style.display = 'none';
            }
        }, 300); // Aguardar transição CSS
    }
    
    resetHideTimer() {
        this.clearHideTimer();
        
        // Auto-hide após 3 segundos se não estiver pausado
        if (this.isScrolling) {
            this.hideTimeout = setTimeout(() => {
                this.hideSpeedSlider();
            }, 3000);
        }
    }
    
    clearHideTimer() {
        if (this.hideTimeout) {
            clearTimeout(this.hideTimeout);
            this.hideTimeout = null;
        }
    }
    
    isAtBottom() {
        const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
        const windowHeight = window.innerHeight;
        const documentHeight = document.documentElement.scrollHeight;
        
        // Margem de 5px para evitar problemas de precisão
        return (scrollTop + windowHeight) >= (documentHeight - 5);
    }
    
    // Método público para controle externo
    setSpeed(speed) {
        this.scrollSpeed = Math.max(10, Math.min(100, speed));
        this.speedSlider.value = this.scrollSpeed;
    }
    
    // Método público para obter estado
    getState() {
        return {
            isScrolling: this.isScrolling,
            speed: this.scrollSpeed
        };
    }
}

// Inicializar quando o DOM estiver pronto
document.addEventListener('DOMContentLoaded', () => {
    // Aguardar um pouco para garantir que todos os elementos estejam carregados
    setTimeout(() => {
        window.autoScrollEngine = new AutoScrollEngine();
    }, 100);
});

// Exportar para uso global
window.AutoScrollEngine = AutoScrollEngine;