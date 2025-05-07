/**
 * Ritmos Del Sur: Hyper-Oasis - Script Principal v5 (Final Integrado)
 *
 * Notas:
 * - Carga dinámica de detalles del festival y tipos de entrada desde la API,
 * usando la estructura JSON proporcionada.
 * - Mantiene funcionalidades UI: Loader, Cursor (restaurado), Scroll Header,
 * Menú Móvil, Theme Toggle, Parallax, Smooth Scroll, Indicador Carrusel.
 * - Los colores de los enlaces de navegación se controlan principalmente
 * desde el CSS (v4), este script solo añade/quita la clase '.active'.
 * - Depende de AOS y basicLightbox (enlazados en HTML).
 * - Necesita un <div id="error-container" style="display: none;"></div> en index.html
 */
document.addEventListener('DOMContentLoaded', () => { // ÚNICO listener DOMContentLoaded

    // --- Configuración ---
    const API_BASE_URL = 'https://daw2-tfg-beatpass.onrender.com/api'; // ¡¡¡ AJUSTA ESTA URL !!! (Ej: https://daw2-tfg-beatpass.onrender.com/api)
    const FESTIVAL_ID = 20; // ID de "Ritmos Del Sur"

    // --- Selectores DOM Globales ---
    const body = document.body;
    const header = document.getElementById('main-header');
    const cursorDot = document.getElementById('cursor-dot');
    const cursorRing = document.getElementById('cursor-ring');
    const loader = document.getElementById('loader');
    const menuToggle = document.getElementById('menu-toggle');
    const navMenu = document.getElementById('nav-menu');
    const themeToggleButton = document.getElementById('theme-toggle');
    const heroSection = document.getElementById('hero');
    const sections = document.querySelectorAll('section[id]');
    const navLiAnchors = document.querySelectorAll('.main-nav ul li a');
    const carouselWrapper = document.querySelector('.artist-carousel-wrapper');
    const carousel = document.querySelector('.artist-carousel-css');
    const errorContainer = document.getElementById('error-container');

    // --- Estado Global ---
    let lastScrollY = window.scrollY;
    let rafIdCursor; // ID específico para animación del cursor
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    // =========================================================================
    // == Funciones de Utilidad (UI Helpers)
    // =========================================================================

    function debounce(func, wait = 15, immediate = false) {
        let timeout;
        return function() {
            const context = this, args = arguments;
            const later = function() {
                timeout = null;
                if (!immediate) func.apply(context, args);
            };
            const callNow = immediate && !timeout;
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
            if (callNow) func.apply(context, args);
        };
    }

    function displayError(message) {
        if (errorContainer) {
            errorContainer.textContent = `Error: ${message}`;
            errorContainer.style.display = 'block';
        } else {
            console.error("Error container (#error-container) not found in HTML.");
            alert(`Error: ${message}`); // Fallback
        }
    }

     // Función helper para obtener características (si decides usarlas en lugar de solo descripción)
     function getTicketFeatures(ticketType) {
         if (!ticketType) return [];
         const typeLower = ticketType.toLowerCase();
         if (typeLower.includes('vip') || typeLower.includes('premium') || typeLower.includes('palmera')) {
             return ['Acceso 3 Días + Fast Track', 'Zona VIP "Mirador Neón"', 'Barras Premium & Chill', 'Regalo Exclusivo RDS'];
         } else if (typeLower.includes('oasis') || typeLower.includes('ultra')) {
             return ['Todo lo VIP +', 'Acceso Backstage*', 'Meet & Greet Selecto*', 'Fiesta Privada Previa*'];
         } else { // General / Sol / Otros
             return ['Acceso 3 Días', 'Todos los Escenarios', 'Experiencias Oasis', 'Pulsera Inteligente RDS'];
         }
         // Si prefieres mostrar SOLO la descripción de la API, elimina el uso de esta función
         // en displayTicketTypes y usa ticket.descripcion directamente.
     }

    // =========================================================================
    // == Funciones de Carga de Datos (API Fetching)
    // =========================================================================

    async function fetchFestivalDetails(festivalId) {
        const url = `${API_BASE_URL}/festivales/${festivalId}`; // URL Corregida
        try {
            console.log(`Workspaceing festival details from: ${url}`); // Log Corregido
            const response = await fetch(url);
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            const data = await response.json();
            console.log('Festival details received:', data);
            return data;
        } catch (error) {
            console.error(`Error fetching festival details (${url}):`, error);
            displayError('No se pudo cargar la información del festival.');
            return null;
        }
    }

    async function fetchTicketTypes(festivalId) {
        const url = `${API_BASE_URL}/festivales/${festivalId}/entradas`; // URL Corregida
        try {
            console.log(`Workspaceing ticket types from: ${url}`); // Log Corregido
            const response = await fetch(url);
            if (!response.ok) {
                if (response.status === 404) {
                    console.warn(`Festival (ID: ${festivalId}) no encontrado o no publicado.`);
                    return []; // Devolver vacío si 404
                }
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            const data = await response.json();
            console.log('Ticket types received:', data);
            return data;
        } catch (error) {
            console.error(`Error fetching ticket types (${url}):`, error);
            displayError('No se pudieron cargar los tipos de entrada.');
            return []; // Devolver array vacío en caso de error
        }
    }

    // =========================================================================
    // == Funciones de Renderizado del DOM (Adaptadas a JSON específico)
    // =========================================================================

    function displayFestivalDetails(festivalData) {
        if (!festivalData) {
            displayError("No se recibieron datos del festival.");
            document.getElementById('festival-name-line1').textContent = 'Festival';
            document.getElementById('festival-subtitle').textContent = 'Detalles no disponibles';
            document.getElementById('festival-dates-location').textContent = 'Fechas y lugar por confirmar';
            return;
        }

        const nameElement1 = document.getElementById('festival-name-line1');
        const nameElement2 = document.getElementById('festival-name-line2');
        if (nameElement1) nameElement1.textContent = festivalData.nombre || 'Nombre del Festival';
        if (nameElement2) nameElement2.textContent = ''; // Limpiar

        const subtitleElement = document.getElementById('festival-subtitle');
        if (subtitleElement) {
            subtitleElement.textContent = festivalData.descripcion || 'Vive la experiencia';
        }

        const datesLocationElement = document.getElementById('festival-dates-location');
        if (datesLocationElement) {
            const formatDate = (dateString) => {
                if (!dateString) return '?';
                try {
                    const date = new Date(dateString + 'T00:00:00');
                    return new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'long' }).format(date);
                } catch (e) { console.error("Error formateando fecha:", e); return dateString; }
            };
            const startDate = formatDate(festivalData.fechaInicio);
            const endDate = formatDate(festivalData.fechaFin);
            const location = festivalData.ubicacion || 'Lugar por confirmar';
            let dateText = `${startDate}`;
            if (startDate !== endDate) { dateText += ` - ${endDate}`; }
            datesLocationElement.textContent = `${dateText} | ${location}`;
        }

        // Opcional: Usar imagenUrl
        const hero = document.getElementById('hero');
        const layer1 = hero?.querySelector('.layer-1');
        if (layer1 && festivalData.imagenUrl) {
            console.log("Imagen del festival disponible:", festivalData.imagenUrl, "(Aplicación visual pendiente en CSS)");
            // Ejemplo: Podrías añadir una clase para que el CSS aplique la imagen
            // hero.classList.add('has-custom-bg');
            // hero.style.setProperty('--hero-bg-image', `url('${festivalData.imagenUrl}')`);
        }
    }

    function displayTicketTypes(ticketData) {
        const grid = document.getElementById('ticket-grid');
        if (!grid) { console.error("Ticket grid element (#ticket-grid) not found!"); return; }

        grid.innerHTML = ''; // Limpiar

        if (!ticketData || ticketData.length === 0) {
            grid.innerHTML = '<p class="text-center col-span-full" style="grid-column: 1 / -1;">No hay entradas disponibles en este momento.</p>';
            return;
        }

        ticketData.forEach((ticket, index) => {
            if (!ticket || typeof ticket.tipo === 'undefined' || typeof ticket.precio === 'undefined' || typeof ticket.idEntrada === 'undefined') {
                console.warn('Saltando entrada con datos inválidos:', ticket);
                return;
            }

            const card = document.createElement('div');
            card.classList.add('ticket-card');
            const typeClass = ticket.tipo.toLowerCase().includes('premium') ? 'vip' : // Mapear 'Premium' a 'vip'
                              ticket.tipo.toLowerCase().includes('general') ? 'general' : '';
            if (typeClass) card.classList.add(typeClass);

            const aosAnim = index % 3 === 0 ? 'fade-right' : index % 3 === 1 ? 'fade-up' : 'fade-left';
            card.setAttribute('data-aos', aosAnim);
            card.setAttribute('data-aos-delay', `${100 + index * 100}`);

            const visual = document.createElement('div');
            visual.classList.add('ticket-visual');
            if (typeClass === 'vip') visual.classList.add('palm');
            else visual.classList.add('sun'); // 'general' usa 'sun'

            const name = document.createElement('h3');
            name.textContent = ticket.tipo.toUpperCase();

            const description = document.createElement('p');
            description.textContent = ticket.descripcion || `Acceso ${ticket.tipo}`;

            const price = document.createElement('div');
            price.classList.add('ticket-price');
            try {
                price.textContent = `€${Number(ticket.precio).toFixed(2)}`;
            } catch (e) { price.textContent = 'Precio N/A'; }

            // **Decisión: Usar la descripción de la API en lugar de lista de features**
            // const features = document.createElement('ul');
            // features.classList.add('ticket-features');
            // getTicketFeatures(ticket.tipo).forEach(featureText => { // O usa ticket.descripcion
            //     const li = document.createElement('li');
            //     li.textContent = featureText;
            //     features.appendChild(li);
            // });

            const buyButton = document.createElement('a');
            buyButton.href = '#';
            buyButton.classList.add('cta-button', 'ticket-buy');
            if (typeClass) buyButton.classList.add(`${typeClass}-buy`);
            buyButton.dataset.ticketId = ticket.idEntrada;
            buyButton.dataset.ticketType = ticket.tipo;
            buyButton.dataset.ticketPrice = ticket.precio;
            const tipoButton = ticket.tipo ? ticket.tipo.split(' ')[0] : 'Entrada';
            buyButton.innerHTML = `<span>Conseguir ${tipoButton}</span>`;
            buyButton.addEventListener('click', handleBuyTicketClick);

            card.appendChild(visual);
            card.appendChild(name);
            card.appendChild(description); // Se muestra la descripción de la API
            card.appendChild(price);
            // card.appendChild(features); // No añadimos la lista <ul>
            card.appendChild(buyButton);
            grid.appendChild(card);
        });

        if (typeof AOS !== 'undefined' && !prefersReducedMotion) {
            AOS.refreshHard();
        }
    }

    // Placeholder para manejar click en botón de compra
    function handleBuyTicketClick(event) {
        event.preventDefault();
        const button = event.currentTarget;
        const ticketId = button.dataset.ticketId;
        const ticketType = button.dataset.ticketType;
        const ticketPrice = button.dataset.ticketPrice;

        console.log(`Compra iniciada para: ID=${ticketId}, Tipo=${ticketType}, Precio=${ticketPrice}`);
        alert(`Funcionalidad de compra para "${ticketType}" (ID: ${ticketId}) no implementada aún.`);
        // Lógica futura aquí
    }

    // =========================================================================
    // == Inicialización de Componentes UI (Loader, Cursor, Scroll, Menú, etc.)
    // =========================================================================

    // --- Loader ---
    function initAOS() {
        if (typeof AOS !== 'undefined' && !prefersReducedMotion) {
            AOS.init({ duration: 900, easing: 'ease-out-cubic', once: true, offset: 100 });
        } else if (typeof AOS !== 'undefined' && prefersReducedMotion) {
            console.log('AOS animations disabled');
            document.querySelectorAll('[data-aos]').forEach(el => {
                el.style.opacity = 1; el.style.transform = 'none'; el.classList.add('aos-animate');
            });
        } else { console.warn('AOS library not found.'); }
    }

    function hideLoader() {
        if (body.classList.contains('loading')) {
            body.classList.remove('loading');
            if (loader) {
                loader.classList.add('hidden');
                loader.addEventListener('transitionend', () => loader?.remove(), { once: true });
            }
            initAOS(); // Init AOS after loader hidden
        }
    }

    if (loader) {
        window.addEventListener('load', hideLoader);
        setTimeout(hideLoader, 3500); // Fallback
    } else {
        initAOS();
    }

    // --- Cursor Follower (Restaurado) ---
    if (cursorDot && cursorRing && window.matchMedia("(pointer: fine)").matches && !prefersReducedMotion) {
        let mouseX = window.innerWidth / 2, mouseY = window.innerHeight / 2;
        let ringX = mouseX, ringY = mouseY;
        let dotX = mouseX, dotY = mouseY;
        const ringSpeed = 0.12;
        let isCursorVisible = false;

        const updateCursor = () => {
            dotX = mouseX; dotY = mouseY;
            ringX += (mouseX - ringX) * ringSpeed; ringY += (mouseY - ringY) * ringSpeed;
            // Check for NaN before applying styles
            if (!isNaN(dotX) && !isNaN(dotY)) cursorDot.style.transform = `translate(${dotX}px, ${dotY}px) translate(-50%, -50%)`;
            if (!isNaN(ringX) && !isNaN(ringY)) cursorRing.style.transform = `translate(${ringX}px, ${ringY}px) translate(-50%, -50%)`;
            rafIdCursor = requestAnimationFrame(updateCursor);
        };

        document.addEventListener('mousemove', (e) => {
            mouseX = e.clientX; mouseY = e.clientY;
            if (!isCursorVisible) {
                cursorDot.style.opacity = 1; cursorRing.style.opacity = 1; isCursorVisible = true;
            }
        }, { passive: true });

        updateCursor(); // Iniciar animación del cursor
        // body.style.cursor = 'none'; // Ocultar cursor nativo (CSS lo hace en @media)

    } else if (cursorDot || cursorRing) {
        // Ocultar si no es puntero fino o si hay preferencia de movimiento reducido
        if (cursorDot) cursorDot.style.display = 'none';
        if (cursorRing) cursorRing.style.display = 'none';
        body.style.cursor = 'default'; // Asegurar cursor normal
    }


    // --- Header Scroll ---
    if (header) {
        const handleHeaderScroll = () => {
            header.classList.toggle('scrolled', window.scrollY > 80);
        };
        window.addEventListener('scroll', debounce(handleHeaderScroll, 10), { passive: true });
        handleHeaderScroll(); // Check initial state
    }

    // --- Mobile Menu ---
    if (menuToggle && navMenu) {
        const navLinks = navMenu.querySelectorAll('.nav-link');
        menuToggle.addEventListener('click', () => {
            const isActive = navMenu.classList.toggle('active');
            menuToggle.classList.toggle('open');
            menuToggle.setAttribute('aria-expanded', isActive);
            body.style.overflowY = isActive ? 'hidden' : '';
        });
        navLinks.forEach(link => {
            link.addEventListener('click', () => {
                if (navMenu.classList.contains('active')) {
                    navMenu.classList.remove('active');
                    menuToggle.classList.remove('open');
                    menuToggle.setAttribute('aria-expanded', 'false');
                    body.style.overflowY = '';
                }
            });
        });
    }

    // --- Active Nav Link on Scroll ---
    if (sections.length > 0 && navLiAnchors.length > 0 && typeof IntersectionObserver !== 'undefined') {
        let currentActiveId = null;
        const observerCallback = (entries) => {
            let topEntry = null;
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    // Prioritize entry closest to the top or most visible in the target area
                    if (!topEntry || entry.boundingClientRect.top < topEntry.boundingClientRect.top) {
                         if (entry.intersectionRatio > 0) { // Make sure it's actually visible
                            topEntry = entry;
                         }
                    }
                }
            });
            currentActiveId = topEntry ? topEntry.target.getAttribute('id') : null;

            navLiAnchors.forEach(a => {
                a.classList.toggle('active', a.getAttribute('href') === `#${currentActiveId}`);
            });
        };
        const sectionObserver = new IntersectionObserver(observerCallback, {
            root: null,
            rootMargin: '-40% 0px -59% 0px', // Adjusted margin slightly
            threshold: 0 // Trigger on entry/exit of margin
        });
        sections.forEach(section => sectionObserver.observe(section));
    }


    // --- Parallax Hero ---
    if (heroSection && !prefersReducedMotion) {
        const layers = heroSection.querySelectorAll('.hero-bg-layer');
        if (layers.length > 0) {
            let rafParallaxId;
            const handleParallaxScroll = () => {
                const scrollFactor = window.scrollY * 0.3;
                layers.forEach(layer => {
                    const speed = parseFloat(layer.getAttribute('data-speed') || '0');
                    layer.style.setProperty('--scroll-y', scrollFactor * speed);
                    layer.style.transform = `translate3d(0, var(--scroll-y, 0)px, 0)`;
                });
                rafParallaxId = null;
            };
            const debouncedScrollHandler = () => {
                if (!rafParallaxId) {
                    rafParallaxId = requestAnimationFrame(handleParallaxScroll);
                }
            };
            window.addEventListener('scroll', debouncedScrollHandler, { passive: true });
            handleParallaxScroll();
        }
    }

    // --- Gallery Lightbox ---
    if (typeof basicLightbox !== 'undefined') {
        document.body.addEventListener('click', (e) => {
            const galleryLink = e.target.closest('.gallery-item');
            if (galleryLink) {
                e.preventDefault();
                const imageUrl = galleryLink.getAttribute('href');
                if (imageUrl && imageUrl !== '#') {
                    try {
                        basicLightbox.create(`<img src="${imageUrl}" alt="Vista ampliada">`, { className: 'rds-lightbox' }).show();
                    } catch (error) { console.error("Lightbox error:", error); }
                }
            }
        });
    } else { console.warn('basicLightbox library not found.'); }

    // --- Theme Toggle ---
    if (themeToggleButton) {
        const applyTheme = (theme) => {
            body.setAttribute('data-theme', theme);
            localStorage.setItem('theme', theme);
        };
        const savedTheme = localStorage.getItem('theme') || (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
        applyTheme(savedTheme);
        themeToggleButton.addEventListener('click', () => {
            let newTheme = body.getAttribute('data-theme') === 'light' ? 'dark' : 'light';
            applyTheme(newTheme);
        });
    }

    // --- Smooth Scroll ---
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            const targetId = this.getAttribute('href');
            if (targetId === '#' || !targetId.startsWith('#')) return;
            e.preventDefault();
            try {
                const targetElement = document.querySelector(targetId);
                if (targetElement) {
                    const headerOffset = (header ? header.offsetHeight : 0) + 20;
                    const elementPosition = targetElement.getBoundingClientRect().top;
                    const offsetPosition = window.pageYOffset + elementPosition - headerOffset;
                    window.scrollTo({ top: offsetPosition, behavior: prefersReducedMotion ? 'auto' : 'smooth' });
                    // Close mobile menu if open
                    if (navMenu?.classList.contains('active')) {
                         navMenu.classList.remove('active');
                         menuToggle?.classList.remove('open');
                         menuToggle?.setAttribute('aria-expanded', 'false');
                         body.style.overflowY = '';
                    }
                } else { console.warn(`Smooth scroll target not found: ${targetId}`); }
            } catch (error) { console.error(`Error during smooth scroll to ${targetId}:`, error); }
        });
    });

    // --- Check Carousel Scrollable ---
    const checkScrollable = () => { // Definida globalmente dentro del DOMContentLoaded
        if (carousel && carouselWrapper) {
            const isScrollable = carousel.scrollWidth > carousel.clientWidth + 10;
            carouselWrapper.classList.toggle('is-scrollable', isScrollable);
        }
    };

    if (carousel && carouselWrapper) {
        if (typeof ResizeObserver !== 'undefined') {
            const resizeObserver = new ResizeObserver(debounce(checkScrollable, 50));
            resizeObserver.observe(carouselWrapper);
            resizeObserver.observe(carousel);
        } else {
            window.addEventListener('resize', debounce(checkScrollable, 250));
        }
        // checkScrollable se llamará tras cargar datos
    }

    // --- Placeholder para Newsletter Form ---
    const newsletterLink = document.querySelector('.newsletter-link');
    if (newsletterLink) {
        newsletterLink.addEventListener('click', (e) => {
            e.preventDefault();
            alert('Funcionalidad de suscripción no implementada en este prototipo.');
        });
    }

    // =========================================================================
    // == Carga Inicial de Datos del Festival ==
    // =========================================================================
    async function loadFestivalData() {
        console.log("Loading festival data...");
        if (errorContainer) errorContainer.style.display = 'none';

        const grid = document.getElementById('ticket-grid');
        if (grid) grid.innerHTML = '<p id="tickets-loading" class="text-center col-span-full" style="grid-column: 1 / -1;">Cargando tipos de entrada...</p>';

        // Cargar datos en paralelo
        const [festivalData, ticketData] = await Promise.all([
            fetchFestivalDetails(FESTIVAL_ID),
            fetchTicketTypes(FESTIVAL_ID)
        ]);

        // Renderizar datos
        displayFestivalDetails(festivalData);
        displayTicketTypes(ticketData);

        console.log("Festival data loading complete.");

        // Re-chequear scroll carrusel tras renderizar
        checkScrollable();
    }

    // Iniciar la carga de datos
    loadFestivalData();

}); // Fin del ÚNICO DOMContentLoaded