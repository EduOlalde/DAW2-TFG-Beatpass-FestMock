/**
 * festival_simulator.js
 * Lógica para el simulador de compra y nominación de entradas,
 * interactuando con los endpoints públicos /api/public/venta/*
 * sin necesidad de login ni API Key desde el frontend.
 */

// URL base de la API
const API_BASE_URL = 'http://localhost:8080/BeatpassTFG/api'; // Asegúrate que el puerto y contexto son correctos
const FESTIVAL_ID = 7; // ID del festival para esta simulación

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
// No hay elementos de login/logout

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
            if (!headers['Content-Type']) headers['Content-Type'] = 'application/json';
            if (typeof options.body !== 'string') options.body = JSON.stringify(options.body);
        }
    }

    const fetchOptions = { ...options, headers: headers };
    console.log(`Fetching: ${url}`, fetchOptions);

    try {
        const response = await fetch(url, fetchOptions);
        const contentType = response.headers.get('content-type');
        let data;
        if (contentType && contentType.includes('application/json')) {
            data = await response.json();
        } else {
            data = await response.text();
        }
        if (!response.ok) {
            const errorMessage = (typeof data === 'object' && data?.error) ? data.error : (typeof data === 'string' && data.length < 200 ? data : `Error ${response.status}`);
            console.error(`API Error ${response.status}: ${errorMessage}`, data);
            throw new Error(errorMessage || `HTTP error! status: ${response.status}`);
        }
        console.log(`API Success ${options.method || 'GET'} ${url}:`, data);
        return data;
    } catch (error) {
        console.error(`Fetch error for ${url}:`, error);
        throw error; // Re-lanzar para que el llamador lo maneje
    }
}

// --- Funciones de Carga de Datos ---

/** Carga los detalles del festival */
async function loadFestivalDetails() {
    clearResult(festivalErrorDiv);
    festivalDetailsDiv.textContent = 'Cargando...';
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
        ticketListDiv.innerHTML = '';
        buyTicketTypeSelect.innerHTML = '<option value="">Seleccione un tipo...</option>';
        if (Array.isArray(ticketTypes) && ticketTypes.length > 0) {
            ticketTypes.forEach(ticket => {
                const div = document.createElement('div');
                div.className = 'border-b pb-2 mb-2';
                div.innerHTML = `
                    <p><strong class="font-medium">${ticket.tipo}</strong></p>
                    <p class="text-sm text-gray-600">${ticket.descripcion || ''}</p>
                    <p class="text-sm font-semibold text-indigo-600">Precio: ${ticket.precio?.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' }) || 'N/A'}</p>
                    <p class="text-sm text-gray-500">Stock: ${ticket.stock !== null ? ticket.stock : 'N/A'}</p>
                `;
                ticketListDiv.appendChild(div);
                if (ticket.stock > 0) {
                    const option = document.createElement('option');
                    option.value = ticket.idEntrada;
                    option.textContent = `${ticket.tipo} (${ticket.precio?.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}) - Stock: ${ticket.stock}`;
                    buyTicketTypeSelect.appendChild(option);
                } else {
                    const option = document.createElement('option');
                    option.value = ticket.idEntrada;
                    option.textContent = `${ticket.tipo} (AGOTADO)`;
                    option.disabled = true;
                    buyTicketTypeSelect.appendChild(option);
                }
            });
            buyTicketTypeSelect.disabled = false;
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
    const body = new URLSearchParams(formData);
    const submitButton = buyTicketForm.querySelector('button[type="submit"]');
    setButtonState(submitButton, true, 'Procesando...', 'Comprar Entradas');

    try {
        // Llama al endpoint público /api/public/venta/comprar
        const generatedTickets = await apiFetch(`${API_BASE_URL}/public/venta/comprar`, {
            method: 'POST',
            body: body
        });

        if (Array.isArray(generatedTickets) && generatedTickets.length > 0) {
            const cantidad = parseInt(formData.get('cantidad') || '0', 10);
            purchasedTickets.push(...generatedTickets);
            localStorage.setItem('purchasedTickets', JSON.stringify(purchasedTickets));
            renderPurchasedTickets();
            displayMessage(buyResultDiv, `¡Compra realizada con éxito! Se generaron ${cantidad} entrada(s). Puedes verlas y nominarlas abajo.`, false);
            buyTicketForm.reset(); // Limpiar formulario
        } else {
            displayMessage(buyResultDiv, 'La compra no devolvió entradas válidas.', true);
        }
    } catch (error) {
        displayMessage(buyResultDiv, `Error en la compra: ${error.message}`, true);
    } finally {
        setButtonState(submitButton, false, 'Procesando...', 'Comprar Entradas');
    }
}

/** Maneja el envío del formulario de nominación */
async function handleNominateTicket(event) {
    event.preventDefault();
    clearResult(nominateResultDiv);
    const formData = new FormData(nominateTicketForm);
    const body = new URLSearchParams(formData);
    const submitButton = nominateTicketForm.querySelector('button[type="submit"]');
    setButtonState(submitButton, true, 'Nominando...', 'Nominar Entrada');

    try {
        // Llama al endpoint público /api/public/venta/nominar
        const result = await apiFetch(`${API_BASE_URL}/public/venta/nominar`, {
            method: 'POST',
            body: body
        });

        displayMessage(nominateResultDiv, result.mensaje || 'Entrada nominada con éxito.', false);
        nominateTicketForm.reset(); // Limpiar formulario
        updatePurchasedTicketStatus(formData.get('codigoQr'), 'Nominada'); // Actualizar visualmente

    } catch (error) {
        displayMessage(nominateResultDiv, `Error al nominar: ${error.message}`, true);
    } finally {
        setButtonState(submitButton, false, 'Nominando...', 'Nominar Entrada');
    }
}

// --- Funciones para Mostrar Entradas Compradas (Simulación) ---

/** Renderiza las entradas guardadas en localStorage */
function renderPurchasedTickets() {
    myTicketsListDiv.innerHTML = '';
    if (purchasedTickets.length === 0) {
        myTicketsSection.style.display = 'none';
        return;
    }
    myTicketsSection.style.display = 'block';

    purchasedTickets.forEach((ticket) => {
        const card = document.createElement('div');
        card.className = 'ticket-card grid grid-cols-1 md:grid-cols-3 gap-4 items-center';

        const detailsDiv = document.createElement('div');
        detailsDiv.className = 'md:col-span-2';
        detailsDiv.innerHTML = `
            <p><strong class="font-medium">ID Entrada:</strong> ${ticket.idEntradaAsignada}</p>
            <p><strong class="font-medium">Código QR:</strong>
               <input type="text" value="${ticket.codigoQr || 'N/A'}" readonly class="text-xs font-mono bg-gray-200 px-1 rounded border border-gray-300 w-full mt-1 cursor-pointer" title="Haz clic para copiar" onclick="this.select(); try{document.execCommand('copy'); alert('Código QR copiado!');}catch(e){alert('No se pudo copiar.');}">
            </p>
            <p><strong class="font-medium">Estado:</strong> ${ticket.estado || 'N/A'} <span class="text-blue-600 font-semibold">${ticket.statusVisual || ''}</span></p>
             ${ticket.nombreAsistente ? `<p><strong class="font-medium">Nominada a:</strong> ${ticket.nombreAsistente} (${ticket.emailAsistente})</p>` : ''}
        `;

        const qrDiv = document.createElement('div');
        qrDiv.className = 'text-center md:text-right';
        if (ticket.qrCodeImageDataUrl) {
            qrDiv.innerHTML = `<img src="${ticket.qrCodeImageDataUrl}" alt="QR Entrada ${ticket.idEntradaAsignada}" class="w-24 h-24 inline-block qr-image-display" width="96" height="96">`;
        } else {
            qrDiv.innerHTML = `<span class="text-xs text-gray-400 italic">(Imagen QR no disponible)</span>`;
        }

        card.appendChild(detailsDiv);
        card.appendChild(qrDiv);
        myTicketsListDiv.appendChild(card);
    });
}

/** Limpia las entradas de localStorage */
function clearPurchasedTickets() {
    if (confirm('¿Seguro que quieres borrar las entradas compradas de esta simulación?')) {
        purchasedTickets = [];
        localStorage.removeItem('purchasedTickets');
        renderPurchasedTickets();
        console.log('Entradas compradas (simulación) borradas.');
    }
}

/** Actualiza visualmente el estado de una entrada */
function updatePurchasedTicketStatus(qrCode, visualStatus) {
    purchasedTickets = purchasedTickets.map(ticket => {
        if (ticket.codigoQr === qrCode) {
            // Añadimos un campo visual, no modificamos el 'estado' real
            return { ...ticket, statusVisual: `(${visualStatus})` };
        }
        return ticket;
    });
    // No guardar estado visual en localStorage
    renderPurchasedTickets();
}


// --- Inicialización y Event Listeners ---
document.addEventListener('DOMContentLoaded', () => {
    // Cargar datos iniciales
    loadFestivalDetails();
    loadTicketTypes();
    renderPurchasedTickets(); // Mostrar entradas guardadas

    // Añadir listeners a los formularios
    buyTicketForm.addEventListener('submit', handleBuyTicket);
    nominateTicketForm.addEventListener('submit', handleNominateTicket);
    clearTicketsButton.addEventListener('click', clearPurchasedTickets);
});
