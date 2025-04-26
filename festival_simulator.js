/**
 * festival_simulator.js
 * Lógica para el simulador de compra y nominación de entradas,
 * interactuando con los endpoints públicos /api/public/venta/*
 * sin necesidad de login ni API Key desde el frontend.
 */

// URL base de la API (Ajustar si el backend se despliega en otro sitio)
const API_BASE_URL = 'https://daw2-tfg-beatpass.onrender.com/api';
//const API_BASE_URL = 'http://localhost:8080/BeatpassTFG/api';
// ID del festival para esta simulación 
const FESTIVAL_ID = 19; // Ejemplo: Luna Negra Fest

// --- Estado (Simulación) ---
// Usaremos localStorage para persistir las entradas compradas en esta sesión del navegador
let purchasedTickets = JSON.parse(localStorage.getItem('purchasedTickets') || '[]');

// --- Selectores del DOM ---
const festivalDetailsDiv = document.getElementById('festival-details');
const festivalErrorDiv = document.getElementById('festival-error');
const ticketListDiv = document.getElementById('ticket-list');
const ticketErrorDiv = document.getElementById('ticket-error');
const buyTicketForm = document.getElementById('buy-ticket-form');
const buyTicketTypeSelect = document.getElementById('buy-ticket-type');
const buyResultDiv = document.getElementById('buy-result');
const myTicketsSection = document.getElementById('my-tickets-section');
const myTicketsListDiv = document.getElementById('my-tickets-list');
const clearTicketsButton = document.getElementById('clear-tickets-button');
const nominateTicketForm = document.getElementById('nominate-ticket-form');
const nominateResultDiv = document.getElementById('nominate-result');
const buyFestivalIdInput = document.getElementById('buy-festival-id'); // Input oculto

// --- Funciones Auxiliares de UI ---

/**
 * Muestra un mensaje en un div específico, con clase de éxito o error.
 * @param {HTMLElement} element - El elemento div donde mostrar el mensaje.
 * @param {string} message - El mensaje.
 * @param {boolean} isError - true si es error, false si es éxito.
 */
function displayMessage(element, message, isError) {
    if (!element) return;
    element.innerHTML = ''; // Limpiar contenido previo
    const p = document.createElement('p');
    p.innerHTML = message; // Usar innerHTML por si hay saltos de línea
    element.appendChild(p);
    element.className = `message-box ${isError ? 'error-message' : 'success-message'}`;
    element.style.display = 'block';
    if (isError) console.error(message); else console.log(message);
}

/** Limpia un mensaje de resultado */
function clearResult(element) {
    if (element) {
        element.textContent = '';
        element.style.display = 'none';
        element.className = 'message-box'; // Resetear clase
    }
}

/** Habilita o deshabilita un botón y cambia su texto */
function setButtonState(button, isLoading, loadingText, defaultText) {
    if (button) {
        button.disabled = isLoading;
        button.textContent = isLoading ? loadingText : defaultText;
        if (isLoading) button.classList.add('opacity-50', 'cursor-not-allowed');
        else button.classList.remove('opacity-50', 'cursor-not-allowed');
    }
}

// --- Funciones de API (Sin autenticación) ---

/**
 * Realiza una petición fetch a la API. No añade cabeceras de autenticación.
 * @param {string} url - URL completa del endpoint.
 * @param {object} [options={}] - Opciones para fetch (method, headers, body).
 * @returns {Promise<any>} - Promesa que resuelve con los datos JSON o texto, o rechaza con error.
 */
async function apiFetch(url, options = {}) {
    const headers = { ...(options.headers || {}) };

    // Establecer Content-Type si hay body y no está definido
    if (options.body) {
        if (options.body instanceof URLSearchParams) {
            if (!headers['Content-Type']) headers['Content-Type'] = 'application/x-www-form-urlencoded';
        } else if (typeof options.body === 'object' && !(options.body instanceof FormData)) {
            // Si es un objeto JS, lo convertimos a JSON
            if (!headers['Content-Type']) headers['Content-Type'] = 'application/json';
            if (typeof options.body !== 'string') options.body = JSON.stringify(options.body);
        }
        // Si es FormData, el navegador establece el Content-Type automáticamente
    }

    const fetchOptions = { ...options, headers: headers };
    console.log(`Fetching: ${url}`, fetchOptions);

    try {
        const response = await fetch(url, fetchOptions);
        const contentType = response.headers.get('content-type');
        let data;

        // Intentar parsear como JSON si el Content-Type lo indica
        if (contentType && contentType.includes('application/json')) {
            data = await response.json();
        } else {
            // Si no, obtener como texto
            data = await response.text();
            // Intentar parsear como JSON de todas formas, por si el Content-Type es incorrecto
            try {
                data = JSON.parse(data);
            } catch (e) {
                // Si falla el parseo, mantener como texto
                console.warn("Respuesta no es JSON válido, se mantiene como texto:", data);
            }
        }

        // Comprobar si la respuesta fue exitosa (status 2xx)
        if (!response.ok) {
            // Intentar obtener mensaje de error del cuerpo JSON, si no, usar texto de status
            const errorMessage = (typeof data === 'object' && data?.error)
                ? data.error
                : (typeof data === 'string' && data.length < 200 && data.length > 0 ? data : `Error ${response.status}`);
            console.error(`API Error ${response.status}: ${errorMessage}`, data);
            // Lanzar un error con el mensaje obtenido
            throw new Error(errorMessage || `HTTP error! status: ${response.status}`);
        }

        console.log(`API Success ${options.method || 'GET'} ${url}:`, data);
        return data; // Devolver los datos (JSON o texto)

    } catch (error) {
        // Capturar errores de red o errores lanzados por !response.ok
        console.error(`Fetch error for ${url}:`, error);
        throw error; // Re-lanzar para que el llamador lo maneje
    }
}


// --- Funciones de Carga de Datos ---

/** Carga los detalles del festival */
async function loadFestivalDetails() {
    clearResult(festivalErrorDiv);
    festivalDetailsDiv.textContent = 'Cargando...';
    if (buyFestivalIdInput) buyFestivalIdInput.value = FESTIVAL_ID; // Establecer ID en el form de compra
    try {
        // Llama al endpoint público (no requiere autenticación)
        const festival = await apiFetch(`${API_BASE_URL}/festivales/${FESTIVAL_ID}`);
        if (festival && typeof festival === 'object') {
            festivalDetailsDiv.innerHTML = `
                <p><strong class="font-medium text-gray-700">Nombre:</strong> ${festival.nombre || 'N/A'}</p>
                <p><strong class="font-medium text-gray-700">Fechas:</strong> ${festival.fechaInicio || 'N/A'} - ${festival.fechaFin || 'N/A'}</p>
                <p><strong class="font-medium text-gray-700">Ubicación:</strong> ${festival.ubicacion || 'N/A'}</p>
                <p><strong class="font-medium text-gray-700">Descripción:</strong> ${festival.descripcion || 'N/A'}</p>
                <p><strong class="font-medium text-gray-700">Estado:</strong> <span class="font-semibold ${festival.estado === 'PUBLICADO' ? 'text-green-600' : 'text-red-600'}">${festival.estado || 'N/A'}</span></p>
            `;
        } else {
            displayMessage(festivalErrorDiv, 'No se pudieron cargar los detalles del festival (respuesta inesperada).', true);
            festivalDetailsDiv.textContent = '';
        }
    } catch (error) {
        displayMessage(festivalErrorDiv, `Error al cargar detalles del festival: ${error.message}`, true);
        festivalDetailsDiv.textContent = '';
    }
}

/** Carga los tipos de entrada */
async function loadTicketTypes() {
    clearResult(ticketErrorDiv);
    ticketListDiv.textContent = 'Cargando...';
    buyTicketTypeSelect.innerHTML = '<option value="">Cargando...</option>';
    try {
        // Llama al endpoint público (no requiere autenticación)
        const ticketTypes = await apiFetch(`${API_BASE_URL}/festivales/${FESTIVAL_ID}/entradas`);
        ticketListDiv.innerHTML = ''; // Limpiar antes de añadir
        buyTicketTypeSelect.innerHTML = '<option value="">Seleccione un tipo...</option>'; // Resetear select

        if (Array.isArray(ticketTypes) && ticketTypes.length > 0) {
            ticketTypes.forEach(ticket => {
                // Mostrar tipo de entrada en la lista
                const div = document.createElement('div');
                div.className = 'border-b pb-2 mb-2';
                div.innerHTML = `
                    <p><strong class="font-medium">${ticket.tipo}</strong></p>
                    <p class="text-sm text-gray-600">${ticket.descripcion || ''}</p>
                    <p class="text-sm font-semibold text-indigo-600">Precio: ${ticket.precio?.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' }) || 'N/A'}</p>
                    <p class="text-sm text-gray-500">Stock: ${ticket.stock !== null ? ticket.stock : 'N/A'}</p>
                `;
                ticketListDiv.appendChild(div);

                // Añadir opción al select de compra si hay stock
                const option = document.createElement('option');
                option.value = ticket.idEntrada;
                if (ticket.stock > 0) {
                    option.textContent = `${ticket.tipo} (${ticket.precio?.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}) - Stock: ${ticket.stock}`;
                    option.disabled = false;
                } else {
                    option.textContent = `${ticket.tipo} (AGOTADO)`;
                    option.disabled = true;
                }
                buyTicketTypeSelect.appendChild(option);
            });
            buyTicketTypeSelect.disabled = false; // Habilitar select si hay opciones
        } else {
            ticketListDiv.innerHTML = '<p class="text-gray-500 italic">No hay tipos de entrada disponibles para este festival.</p>';
            buyTicketTypeSelect.innerHTML = '<option value="">No hay entradas disponibles</option>';
            buyTicketTypeSelect.disabled = true;
        }
    } catch (error) {
        displayMessage(ticketErrorDiv, `Error al cargar tipos de entrada: ${error.message}`, true);
        ticketListDiv.innerHTML = '';
        buyTicketTypeSelect.innerHTML = '<option value="">Error al cargar</option>';
        buyTicketTypeSelect.disabled = true;
    }
}


// --- Manejadores de Eventos ---

/** Maneja el envío del formulario de compra */
async function handleBuyTicket(event) {
    event.preventDefault();
    clearResult(buyResultDiv);
    const formData = new FormData(buyTicketForm);
    const body = new URLSearchParams(formData); // Enviar como form-urlencoded
    const submitButton = buyTicketForm.querySelector('button[type="submit"]');
    setButtonState(submitButton, true, 'Procesando...', 'Comprar Entradas');

    try {
        // Llama al endpoint público /api/public/venta/comprar
        const generatedTickets = await apiFetch(`${API_BASE_URL}/public/venta/comprar`, {
            method: 'POST',
            body: body // URLSearchParams se envía como x-www-form-urlencoded
        });

        if (Array.isArray(generatedTickets) && generatedTickets.length > 0) {
            const cantidad = parseInt(formData.get('cantidad') || '0', 10);
            // Añadir las nuevas entradas al array local y guardar en localStorage
            purchasedTickets.push(...generatedTickets);
            localStorage.setItem('purchasedTickets', JSON.stringify(purchasedTickets));
            renderPurchasedTickets(); // Actualizar la lista visual
            displayMessage(buyResultDiv, `¡Compra realizada con éxito! Se generaron ${cantidad} entrada(s). Puedes verlas y nominarlas abajo.`, false);
            buyTicketForm.reset(); // Limpiar formulario
            // Recargar tipos de entrada para actualizar stock visualmente
            loadTicketTypes();
        } else {
            // Si la respuesta no es un array o está vacío
            displayMessage(buyResultDiv, 'La compra se procesó, pero no se recibieron detalles de las entradas generadas.', true);
        }
    } catch (error) {
        // Mostrar error específico de la API
        displayMessage(buyResultDiv, `Error en la compra: ${error.message}`, true);
    } finally {
        // Reactivar el botón
        setButtonState(submitButton, false, 'Procesando...', 'Comprar Entradas');
    }
}


/** Maneja el envío del formulario de nominación */
async function handleNominateTicket(event) {
    event.preventDefault();
    clearResult(nominateResultDiv);
    const formData = new FormData(nominateTicketForm);
    const body = new URLSearchParams(formData); // Enviar como form-urlencoded
    const submitButton = nominateTicketForm.querySelector('button[type="submit"]');
    setButtonState(submitButton, true, 'Nominando...', 'Nominar Entrada');

    try {
        // Llama al endpoint público /api/public/venta/nominar
        const result = await apiFetch(`${API_BASE_URL}/public/venta/nominar`, {
            method: 'POST',
            body: body
        });

        // Mostrar mensaje de éxito (asumiendo que la API devuelve un objeto con 'mensaje')
        displayMessage(nominateResultDiv, result.mensaje || 'Entrada nominada con éxito.', false);
        nominateTicketForm.reset(); // Limpiar formulario

        // Actualizar visualmente la entrada en la lista de "Mis Entradas"
        updatePurchasedTicketStatus(formData.get('codigoQr'), 'Nominada');

    } catch (error) {
        // Mostrar error específico de la API
        displayMessage(nominateResultDiv, `Error al nominar: ${error.message}`, true);
    } finally {
        // Reactivar el botón
        setButtonState(submitButton, false, 'Nominando...', 'Nominar Entrada');
    }
}


// --- Funciones para Mostrar Entradas Compradas (Simulación) ---

/** Renderiza las entradas guardadas en localStorage */
function renderPurchasedTickets() {
    myTicketsListDiv.innerHTML = ''; // Limpiar lista actual
    if (purchasedTickets.length === 0) {
        myTicketsSection.style.display = 'none'; // Ocultar sección si no hay entradas
        return;
    }
    myTicketsSection.style.display = 'block'; // Mostrar sección

    // Iterar sobre las entradas compradas y crear elementos HTML
    purchasedTickets.forEach((ticket) => {
        const card = document.createElement('div');
        // Usar clases de Tailwind para estilizar la tarjeta
        card.className = 'ticket-card grid grid-cols-1 md:grid-cols-3 gap-4 items-center';

        // Columna de detalles de la entrada
        const detailsDiv = document.createElement('div');
        detailsDiv.className = 'md:col-span-2'; // Ocupa 2 columnas en pantallas medianas+
        detailsDiv.innerHTML = `
            <p><strong class="font-medium">ID Entrada:</strong> ${ticket.idEntradaAsignada || 'N/A'}</p>
            <p><strong class="font-medium">Tipo:</strong> ${ticket.tipoEntradaOriginal || 'N/A'}</p>
            <p><strong class="font-medium">Código QR:</strong>
               <input type="text" value="${ticket.codigoQr || 'N/A'}" readonly class="text-xs font-mono bg-gray-200 px-1 rounded border border-gray-300 w-full mt-1 cursor-pointer" title="Haz clic para copiar" onclick="this.select(); try{document.execCommand('copy'); alert('Código QR copiado!');}catch(e){alert('No se pudo copiar.');}">
            </p>
            <p><strong class="font-medium">Estado:</strong> ${ticket.estado || 'N/A'} <span class="text-blue-600 font-semibold">${ticket.statusVisual || ''}</span></p>
            ${ticket.nombreAsistente ? `<p><strong class="font-medium">Nominada a:</strong> ${ticket.nombreAsistente} (${ticket.emailAsistente || 'email no disponible'})</p>` : '<p class="text-sm text-orange-600 italic">Pendiente de nominar</p>'}
        `;

        // Columna para la imagen QR
        const qrDiv = document.createElement('div');
        qrDiv.className = 'text-center md:text-right'; // Centrado en móvil, derecha en escritorio
        if (ticket.qrCodeImageDataUrl) {
            // Mostrar la imagen QR si la URL de datos está disponible
            qrDiv.innerHTML = `<img src="${ticket.qrCodeImageDataUrl}" alt="QR Entrada ${ticket.idEntradaAsignada}" class="w-24 h-24 inline-block qr-image-display" width="96" height="96">`;
        } else {
            // Mensaje si no hay imagen QR
            qrDiv.innerHTML = `<span class="text-xs text-gray-400 italic">(Imagen QR no disponible)</span>`;
        }

        // Añadir las columnas a la tarjeta y la tarjeta a la lista
        card.appendChild(detailsDiv);
        card.appendChild(qrDiv);
        myTicketsListDiv.appendChild(card);
    });
}


/** Limpia las entradas de localStorage */
function clearPurchasedTickets() {
    if (confirm('¿Seguro que quieres borrar las entradas compradas de esta simulación?')) {
        purchasedTickets = []; // Vaciar array local
        localStorage.removeItem('purchasedTickets'); // Limpiar localStorage
        renderPurchasedTickets(); // Actualizar la vista
        console.log('Entradas compradas (simulación) borradas.');
    }
}

/** Actualiza visualmente el estado de una entrada en la lista local (no persiste el estado visual) */
function updatePurchasedTicketStatus(qrCode, visualStatus) {
    // Mapear el array para encontrar la entrada y añadir/actualizar 'statusVisual'
    purchasedTickets = purchasedTickets.map(ticket => {
        if (ticket.codigoQr === qrCode) {
            // Añadimos un campo visual temporal, no modificamos el 'estado' real de la API
            return { ...ticket, statusVisual: `(${visualStatus})` };
        }
        return ticket; // Devolver las otras entradas sin cambios
    });
    // No guardar este estado visual en localStorage, solo actualizar la vista
    renderPurchasedTickets();
}


// --- Inicialización y Event Listeners ---
document.addEventListener('DOMContentLoaded', () => {
    // Cargar datos iniciales al cargar la página
    loadFestivalDetails();
    loadTicketTypes();
    renderPurchasedTickets(); // Mostrar entradas previamente compradas (si existen en localStorage)

    // Añadir listeners a los formularios y botones
    if (buyTicketForm) buyTicketForm.addEventListener('submit', handleBuyTicket);
    if (nominateTicketForm) nominateTicketForm.addEventListener('submit', handleNominateTicket);
    if (clearTicketsButton) clearTicketsButton.addEventListener('click', clearPurchasedTickets);
});
