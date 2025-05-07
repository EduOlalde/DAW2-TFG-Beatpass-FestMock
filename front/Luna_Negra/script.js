document.addEventListener('DOMContentLoaded', () => {

    // --- Loader ---
    const loader = document.getElementById('loader');
    if(loader) {
        // Ocultar loader cuando la página esté lista (simplificado, mejor usar window.onload o similar)
        setTimeout(() => {
            loader.classList.add('hidden');
            document.body.classList.remove('loading');
             // Inicializar AOS DESPUÉS de quitar el loader para evitar flashes
            AOS.init({
                duration: 800, // Duración animación
                easing: 'ease-in-out', // Curva de aceleración
                once: true, // Animar solo una vez
                offset: 50 // Offset para disparar la animación antes
            });
        }, 500); // Simula un tiempo de carga mínimo
    } else {
        // Si no hay loader, inicializar AOS directamente
        AOS.init({
            duration: 800,
            easing: 'ease-in-out',
            once: true,
            offset: 50
        });
    }


    // --- Header Scroll Effect ---
    const header = document.getElementById('main-header');
    if (header) {
        window.addEventListener('scroll', () => {
            if (window.scrollY > 50) {
                header.classList.add('scrolled');
            } else {
                header.classList.remove('scrolled');
            }
        });
    }

    // --- Mobile Menu ---
    const menuToggle = document.getElementById('menu-toggle');
    const navMenu = document.getElementById('nav-menu');
    const navLinks = navMenu.querySelectorAll('.nav-link');

    if (menuToggle && navMenu) {
        menuToggle.addEventListener('click', () => {
            navMenu.classList.toggle('active');
            menuToggle.classList.toggle('open');
            // Aria expanded
            const isExpanded = menuToggle.getAttribute('aria-expanded') === 'true';
            menuToggle.setAttribute('aria-expanded', !isExpanded);
            // Bloquear scroll del body cuando el menú está abierto
            document.body.style.overflow = navMenu.classList.contains('active') ? 'hidden' : '';
        });

        // Cerrar menú al hacer clic en un enlace
        navLinks.forEach(link => {
            link.addEventListener('click', () => {
                if (navMenu.classList.contains('active')) {
                    navMenu.classList.remove('active');
                    menuToggle.classList.remove('open');
                    menuToggle.setAttribute('aria-expanded', 'false');
                    document.body.style.overflow = '';
                }
            });
        });
        // Cerrar menú si se hace clic fuera (opcional)
        document.addEventListener('click', (event) => {
             if (navMenu.classList.contains('active') && !navMenu.contains(event.target) && !menuToggle.contains(event.target)) {
                 navMenu.classList.remove('active');
                 menuToggle.classList.remove('open');
                 menuToggle.setAttribute('aria-expanded', 'false');
                 document.body.style.overflow = '';
             }
         });
    }

    // --- Active Nav Link on Scroll ---
    const sections = document.querySelectorAll('section[id]');
    const observerOptions = {
        root: null, // viewport
        rootMargin: '-40% 0px -60% 0px', // Activa en el centro vertical de la pantalla
        threshold: 0
    };

    const sectionObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            const id = entry.target.getAttribute('id');
            const navLink = document.querySelector(`.nav-link[href="#${id}"]`);

            if (entry.isIntersecting && navLink) {
                // Quitar 'active' de todos
                 document.querySelectorAll('.nav-link.active').forEach(link => link.classList.remove('active'));
                 // Añadir 'active' al actual
                navLink.classList.add('active');
            }
        });
    }, observerOptions);

    sections.forEach(section => {
        sectionObserver.observe(section);
    });


    // --- Lineup Filtering ---
    const tabButtons = document.querySelectorAll('.tab-button');
    const artistCards = document.querySelectorAll('.artist-card');

    if (tabButtons.length > 0 && artistCards.length > 0) {
        tabButtons.forEach(button => {
            button.addEventListener('click', () => {
                const stageFilter = button.getAttribute('data-stage');

                // Update active button style
                tabButtons.forEach(btn => btn.classList.remove('active'));
                button.classList.add('active');

                // Filter artists
                artistCards.forEach(card => {
                    const cardStage = card.getAttribute('data-stage');
                    // Usar animación para ocultar/mostrar suavemente
                    if (stageFilter === 'all' || cardStage === stageFilter) {
                       card.style.display = 'block'; // O 'grid', 'flex', etc. según layout
                       card.style.animation = 'fadeIn 0.5s ease forwards';
                    } else {
                         card.style.animation = 'fadeOut 0.5s ease forwards';
                         // Ocultar después de la animación
                         setTimeout(() => { card.style.display = 'none'; }, 500);
                    }
                });
            });
        });
         // Añadir keyframes para fade in/out si no los tienes ya en CSS
        const styleSheet = document.styleSheets[0];
        try {
             styleSheet.insertRule(`@keyframes fadeIn { from { opacity: 0; transform: scale(0.9); } to { opacity: 1; transform: scale(1); } }`, styleSheet.cssRules.length);
             styleSheet.insertRule(`@keyframes fadeOut { from { opacity: 1; transform: scale(1); } to { opacity: 0; transform: scale(0.9); } }`, styleSheet.cssRules.length);
        } catch (e) {
            console.warn("Could not insert fadeIn/fadeOut keyframes:", e);
        }
    }


    // --- Gallery Lightbox ---
    const galleryItems = document.querySelectorAll('.gallery-item');
    if (galleryItems.length > 0 && typeof basicLightbox !== 'undefined') {
        galleryItems.forEach(item => {
            item.addEventListener('click', (e) => {
                e.preventDefault(); // Prevenir navegación si es un enlace real
                const imageUrl = item.getAttribute('href'); // Obtener URL de imagen completa
                 if(imageUrl && imageUrl !== '#') { // Verificar si hay URL válida
                     const instance = basicLightbox.create(`<img src="${imageUrl}" alt="Vista ampliada">`);
                     instance.show();
                 }
            });
        });
    } else if (galleryItems.length > 0) {
        console.warn('basicLightbox library not found for gallery.');
    }

     // --- Newsletter Form (Placeholder) ---
    const newsletterForm = document.getElementById('newsletter-form');
    if(newsletterForm) {
        newsletterForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const emailInput = newsletterForm.querySelector('input[type="email"]');
            alert(`Suscripción enviada para: ${emailInput.value}. (Funcionalidad simulada)`);
            emailInput.value = ''; // Limpiar campo
        });
    }

}); // End DOMContentLoaded