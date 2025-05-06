/**
 * festival_simulator.js
 * Lógica para el simulador de compra y nominación de entradas,
 * incluyendo el flujo de pago con Stripe y la visualización de entradas compradas.
 */

// --- Configuración ---
const API_BASE_URL = 'https://daw2-tfg-beatpass.onrender.com/api';
//const API_BASE_URL = 'http://localhost:8080/BeatpassTFG/api'; // Para pruebas locales
const FESTIVAL_ID = 19;
const STRIPE_PUBLISHABLE_KEY = 'pk_test_51RLUyq4Et9Src69RTyKKrqn48wubA5QIbS9zTguw8chLB8FGgwMt9sZV6VwvT4UEWE0vnKxaJCNFlj87EY6i9mGK00ggcR1AiX';

// --- Variables Globales ---
let purchasedTickets = JSON.parse(localStorage.getItem('purchasedTickets') || '[]');
let stripe = null;
let cardElement = null;

// --- Selectores del DOM ---
const festivalDetailsDiv = document.getElementById('festival-details');
const festivalErrorDiv = document.getElementById('festival-error');
const ticketListDiv = document.getElementById('ticket-list');
const ticketErrorDiv = document.getElementById('ticket-error');
const paymentForm = document.getElementById('payment-form');
const buyTicketTypeSelect = document.getElementById('buy-ticket-type');
const buyQuantityInput = document.getElementById('buy-quantity');
const buyEmailInput = document.getElementById('buy-email');
const buyNameInput = document.getElementById('buy-name');
const buyPhoneInput = document.getElementById('buy-phone');
const cardElementContainer = document.getElementById('card-element');
const cardErrorsDiv = document.getElementById('card-errors');
const submitButton = document.getElementById('submit-button');
const buttonText = document.getElementById('button-text');
const spinner = document.getElementById('spinner');
const paymentResultDiv = document.getElementById('payment-result');
const myTicketsSection = document.getElementById('my-tickets-section');
const myTicketsListDiv = document.getElementById('my-tickets-list');
const clearTicketsButton = document.getElementById('clear-tickets-button');
const nominateTicketForm = document.getElementById('nominate-ticket-form');
const nominateResultDiv = document.getElementById('nominate-result');
const buyFestivalIdInput = document.getElementById('buy-festival-id');

// --- Funciones Auxiliares de UI ---
function displayMessage(element, message, isError) {
    if (!element) return;
    element.innerHTML = '';
    const p = document.createElement('p');
    p.innerHTML = message;
    element.appendChild(p);
    element.className = `message-box ${isError ? 'error-message' : 'success-message'}`;
    element.style.display = 'block';
    if (isError) console.error("Mensaje UI (Error):", message);
    else console.log("Mensaje UI (Éxito):", message);
}
function clearResult(element) {
    if (element) {
        element.textContent = '';
        element.style.display = 'none';
        element.className = 'message-box';
    }
}
function setLoadingState(isLoading) {
    if (!submitButton || !buttonText || !spinner) return;
    if (isLoading) {
        submitButton.disabled = true;
        buttonText.style.display = 'none';
        spinner.style.display = 'inline-block';
        submitButton.classList.add('opacity-75', 'cursor-not-allowed');
    } else {
        submitButton.disabled = false;
        buttonText.style.display = 'inline';
        spinner.style.display = 'none';
        submitButton.classList.remove('opacity-75', 'cursor-not-allowed');
    }
}

// --- Funciones de API ---
async function apiFetch(url, options = {}) {
    const headers = { ...(options.headers || {}) };
    if (options.body) {
        if (options.body instanceof URLSearchParams) {
            if (!headers['Content-Type']) headers['Content-Type'] = 'application/x-www-form-urlencoded;charset=UTF-8';
        } else if (typeof options.body === 'object' && !(options.body instanceof FormData)) {
            if (!headers['Content-Type']) headers['Content-Type'] = 'application/json';
            if (typeof options.body !== 'string') {
                options.body = JSON.stringify(options.body);
            }
        }
    }
    const fetchOptions = { ...options, headers: headers };
    console.log(`API Fetching: ${url}`, fetchOptions);
    try {
        const response = await fetch(url, fetchOptions);
        let responseData = null;
        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
            try { responseData = await response.json(); }
            catch (jsonError) {
                console.warn("Fallo al parsear JSON, intentando obtener texto.", jsonError);
                try { responseData = await response.text(); console.warn("Respuesta obtenida como texto:", responseData); }
                catch (textError) { console.error("Fallo crítico al obtener texto de respuesta.", textError); responseData = `Error ${response.status}: Respuesta no procesable.`; }
            }
        } else {
            try { responseData = await response.text(); }
            catch (textError) { console.error("Fallo al obtener texto no JSON.", textError); responseData = `Error ${response.status}: Respuesta no procesable.`; }
        }
        if (!response.ok) {
            console.error(`API Error Response ${response.status} for ${url}:`, responseData);
            const errorMessage = (typeof responseData === 'object' && responseData?.error) ? responseData.error : (typeof responseData === 'string' && responseData.length < 200 && responseData.length > 0 ? responseData : `Error ${response.status}`);
            throw new Error(errorMessage || `HTTP error! status: ${response.status}`);
        }
        console.log(`API Success ${options.method || 'GET'} ${url}:`, responseData);
        return responseData;
    } catch (error) {
        console.error(`API Fetch error for ${url}:`, error);
        throw error;
    }
}

// --- Funciones de Carga de Datos ---
async function loadFestivalDetails() {
    clearResult(festivalErrorDiv);
    festivalDetailsDiv.textContent = 'Cargando detalles del festival...';
    if (buyFestivalIdInput) buyFestivalIdInput.value = FESTIVAL_ID;
    try {
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
async function loadTicketTypes() {
    clearResult(ticketErrorDiv);
    ticketListDiv.textContent = 'Cargando tipos de entrada...';
    buyTicketTypeSelect.innerHTML = '<option value="">Cargando...</option>';
    buyTicketTypeSelect.disabled = true;
    try {
        const ticketTypes = await apiFetch(`${API_BASE_URL}/festivales/${FESTIVAL_ID}/entradas`);
        ticketListDiv.innerHTML = '';
        buyTicketTypeSelect.innerHTML = '<option value="">Seleccione un tipo...</option>';
        if (Array.isArray(ticketTypes) && ticketTypes.length > 0) {
            let hasAvailableTickets = false;
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
                const option = document.createElement('option');
                option.value = ticket.idEntrada;
                if (ticket.stock > 0) {
                    option.textContent = `${ticket.tipo} (${ticket.precio?.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}) - Stock: ${ticket.stock}`;
                    option.disabled = false;
                    hasAvailableTickets = true;
                } else {
                    option.textContent = `${ticket.tipo} (AGOTADO)`;
                    option.disabled = true;
                }
                buyTicketTypeSelect.appendChild(option);
            });
            buyTicketTypeSelect.disabled = !hasAvailableTickets;
            if (!hasAvailableTickets) {
                buyTicketTypeSelect.innerHTML = '<option value="">Entradas Agotadas</option>';
            }
        } else {
            ticketListDiv.innerHTML = '<p class="text-gray-500 italic">No hay tipos de entrada disponibles.</p>';
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

// --- Inicialización de Stripe ---
function initializeStripe() {
    if (!STRIPE_PUBLISHABLE_KEY || STRIPE_PUBLISHABLE_KEY === 'pk_test_TU_CLAVE_PUBLICABLE_AQUI') {
        console.error("¡ERROR! Clave publicable de Stripe no configurada. Reemplaza el placeholder en festival_simulator.js.");
        displayMessage(paymentResultDiv, "Error de configuración: Falta la clave publicable de Stripe.", true);
        if (submitButton) submitButton.disabled = true;
        return;
    }
    try {
        stripe = Stripe(STRIPE_PUBLISHABLE_KEY);
        const elements = stripe.elements();
        const style = {
            base: { color: '#32325d', fontFamily: '"Inter", sans-serif', fontSmoothing: 'antialiased', fontSize: '16px', '::placeholder': { color: '#aab7c4' } },
            invalid: { color: '#fa755a', iconColor: '#fa755a' }
        };
        cardElement = elements.create('card', { style: style });
        if (cardElementContainer) {
            cardElement.mount('#card-element');
            console.log("Stripe Card Element montado.");
        } else {
            console.error("Error: No se encontró el contenedor #card-element en el HTML.");
            throw new Error("Contenedor de Stripe no encontrado.");
        }
        cardElement.on('change', (event) => {
            if (cardErrorsDiv) {
                if (event.error) { cardErrorsDiv.textContent = event.error.message; }
                else { cardErrorsDiv.textContent = ''; }
            }
        });
        console.log("Stripe Elements inicializado correctamente.");
    } catch (error) {
        console.error("Error inicializando Stripe Elements:", error);
        displayMessage(paymentResultDiv, `Error al inicializar el sistema de pago: ${error.message}. Por favor, recarga la página.`, true);
        if (submitButton) submitButton.disabled = true;
    }
}

// --- Manejador de Pago ---

/**
 * Maneja el envío del formulario de pago.
 */
async function handlePaymentSubmit(event) {
    event.preventDefault();
    setLoadingState(true);
    clearResult(paymentResultDiv);
    if (cardErrorsDiv) cardErrorsDiv.textContent = '';

    if (!stripe || !cardElement) {
        displayMessage(paymentResultDiv, "Error: El sistema de pago no está listo. Intenta recargar.", true);
        setLoadingState(false);
        return;
    }

    // 1. Recoger datos del formulario
    const idEntrada = buyTicketTypeSelect.value;
    const cantidad = parseInt(buyQuantityInput.value, 10);
    const emailAsistente = buyEmailInput.value;
    const nombreAsistente = buyNameInput.value;
    const telefonoAsistente = buyPhoneInput.value;

    if (!idEntrada || cantidad <= 0 || !emailAsistente || !nombreAsistente) {
        displayMessage(paymentResultDiv, "Por favor, completa todos los campos obligatorios (tipo de entrada, cantidad, email, nombre).", true);
        setLoadingState(false);
        return;
    }

    let clientSecret = null;

    try {
        // 2. Llamar al backend para iniciar el pago
        console.log("Llamando a backend: /public/venta/iniciar-pago");
        const iniciarPagoResponse = await apiFetch(`${API_BASE_URL}/public/venta/iniciar-pago`, {
            method: 'POST',
            body: JSON.stringify({ idEntrada: parseInt(idEntrada, 10), cantidad: cantidad }),
            headers: { 'Content-Type': 'application/json' }
        });
        clientSecret = iniciarPagoResponse?.clientSecret;
        if (!clientSecret) throw new Error("No se recibió el 'client_secret' del servidor.");
        console.log("Client Secret recibido.");

        // 3. Confirmar el pago de la tarjeta con Stripe.js
        console.log("Confirmando pago de tarjeta con Stripe...");
        const { error: stripeError, paymentIntent } = await stripe.confirmCardPayment(
            clientSecret, { payment_method: { card: cardElement } }
        );
        if (stripeError) {
            console.error("Error de Stripe al confirmar pago:", stripeError);
            if (cardErrorsDiv) cardErrorsDiv.textContent = stripeError.message || "Error desconocido durante el pago.";
            displayMessage(paymentResultDiv, `Error en el pago con tarjeta: ${stripeError.message}`, true);
            setLoadingState(false);
            return;
        }

        // 4. Si el pago con Stripe fue exitoso
        console.log("Pago con Stripe exitoso. PaymentIntent:", paymentIntent);
        if (paymentIntent && paymentIntent.status === 'succeeded') {
            // 5. Llamar al backend para confirmar la compra en nuestro sistema
            console.log("Llamando a backend: /public/venta/confirmar-compra");
            const backendConfirmationData = new URLSearchParams({
                idFestival: FESTIVAL_ID.toString(),
                idEntrada: idEntrada,
                cantidad: cantidad.toString(),
                emailAsistente: emailAsistente,
                nombreAsistente: nombreAsistente,
                telefonoAsistente: telefonoAsistente || '',
                paymentIntentId: paymentIntent.id
            });
            const compraConfirmada = await apiFetch(`${API_BASE_URL}/public/venta/confirmar-compra`, {
                method: 'POST',
                body: backendConfirmationData
            });

            // 6. Mostrar éxito y PROCESAR ENTRADAS GENERADAS
            displayMessage(paymentResultDiv, `¡Compra confirmada con éxito! ID Compra: ${compraConfirmada.idCompra}. Añadiendo entradas a la lista...`, false);

            // --- INICIO: Procesar entradas generadas ---
            if (compraConfirmada.entradasGeneradas && Array.isArray(compraConfirmada.entradasGeneradas)) {
                console.log("Procesando entradas generadas recibidas:", compraConfirmada.entradasGeneradas);
                const nuevasEntradasParaMostrar = [];
                // Usar Promise.all para generar QRs en paralelo
                await Promise.all(compraConfirmada.entradasGeneradas.map(async (entradaDTO) => {
                    const qrImageDataUrl = await generateQrDataUrl(entradaDTO.codigoQr); // Generar QR
                    const ticketLocal = {
                        idEntradaAsignada: entradaDTO.idEntradaAsignada,
                        codigoQr: entradaDTO.codigoQr,
                        estado: entradaDTO.estado,
                        tipoEntradaOriginal: entradaDTO.tipoEntradaOriginal,
                        qrCodeImageDataUrl: qrImageDataUrl, // Guardar URL generada
                        nombreAsistente: entradaDTO.nombreAsistente,
                        emailAsistente: entradaDTO.emailAsistente,
                        statusVisual: ''
                    };
                    nuevasEntradasParaMostrar.push(ticketLocal);
                }));

                // Añadir las nuevas entradas al array global y guardar en localStorage
                purchasedTickets.push(...nuevasEntradasParaMostrar);
                localStorage.setItem('purchasedTickets', JSON.stringify(purchasedTickets));
                renderPurchasedTickets(); // Actualizar la lista visual CON las imágenes QR
                console.log("Entradas generadas añadidas a la lista local y renderizadas.");
            } else {
                console.warn("La respuesta de confirmación no contenía la lista 'entradasGeneradas'. No se pueden mostrar las nuevas entradas.");
                // Modificar mensaje si no se reciben entradas
                displayMessage(paymentResultDiv, `¡Compra confirmada con éxito! ID Compra: ${compraConfirmada.idCompra}. (No se recibieron detalles de entradas generadas).`, false);
            }
            // --- FIN: Procesar entradas generadas ---

            if (paymentForm) paymentForm.reset();
            if (cardElement) cardElement.clear();
            loadTicketTypes(); // Recargar tipos para stock

        } else {
            console.warn("Estado inesperado del PaymentIntent tras confirmación:", paymentIntent?.status);
            displayMessage(paymentResultDiv, `El pago no se completó del todo (Estado: ${paymentIntent?.status || 'desconocido'}). Contacta con soporte.`, true);
        }

    } catch (error) {
        console.error("Error en el proceso de pago completo:", error);
        displayMessage(paymentResultDiv, `Error procesando la compra: ${error.message || 'Error desconocido'}`, true);
    } finally {
        setLoadingState(false);
    }
}

// --- Manejador de Nominación ---
async function handleNominateTicket(event) {
    event.preventDefault();
    clearResult(nominateResultDiv);
    const formData = new FormData(nominateTicketForm);
    const body = new URLSearchParams(formData);
    const submitButton = nominateTicketForm.querySelector('button[type="submit"]');
    submitButton.disabled = true; submitButton.textContent = 'Nominando...';
    try {
        const result = await apiFetch(`${API_BASE_URL}/public/venta/nominar`, { method: 'POST', body: body });
        displayMessage(nominateResultDiv, result.mensaje || 'Entrada nominada con éxito.', false);
        if (nominateTicketForm) nominateTicketForm.reset();
        updatePurchasedTicketStatus(formData.get('codigoQr'), 'Nominada');
    } catch (error) {
        displayMessage(nominateResultDiv, `Error al nominar: ${error.message}`, true);
    } finally {
        submitButton.disabled = false; submitButton.textContent = 'Nominar Entrada';
    }
}

// --- Funciones para Mostrar Entradas Compradas ---

/**
 * Genera la URL de datos Base64 para una imagen QR usando qrcode-generator.
 * <script src="https://cdnjs.cloudflare.com/ajax/libs/qrcode-generator/1.4.4/qrcode.min.js"></script>
 */
async function generateQrDataUrl(text) {
    if (typeof qrcode === 'undefined') {
        console.error("Librería qrcode-generator no cargada.");
        return null;
    }
    if (!text) return null;
    try {
        const qr = qrcode(0, 'M'); // typeNumber 0 (auto), errorCorrectionLevel 'M'
        qr.addData(text);
        qr.make();
        // Ajustar cellSize (4) y margin (2) para tamaño y borde
        const dataUrl = qr.createDataURL(4, 2);
        return dataUrl;
    } catch (error) {
        console.error("Error generando imagen QR para:", text, error);
        return null;
    }
}

/** Renderiza las entradas guardadas en localStorage */
async function renderPurchasedTickets() {
    if (!myTicketsListDiv || !myTicketsSection) return;

    myTicketsListDiv.innerHTML = ''; // Limpiar antes de re-renderizar
    if (purchasedTickets.length === 0) {
        myTicketsSection.style.display = 'none';
        return;
    }
    myTicketsSection.style.display = 'block';

    // Usar Promise.all para asegurar que todos los QRs (si necesitan generarse) se completen
    const ticketCardsHtmlPromises = purchasedTickets.map(async (ticket) => {
        // Generar URL de imagen QR si no existe en el objeto local
        if (!ticket.qrCodeImageDataUrl && ticket.codigoQr) {
            console.log(`Generando QR para ${ticket.codigoQr} on demand...`);
            ticket.qrCodeImageDataUrl = await generateQrDataUrl(ticket.codigoQr);
        }

        // Construir el HTML de la tarjeta para esta entrada
        return `
            <div class="ticket-card grid grid-cols-1 md:grid-cols-3 gap-4 items-center border-b last:border-b-0 py-4">
                <div class="md:col-span-2 space-y-1">
                    <p><strong class="font-medium text-gray-800">ID Entrada:</strong> ${ticket.idEntradaAsignada || 'N/A'}</p>
                    <p><strong class="font-medium text-gray-800">Tipo:</strong> ${ticket.tipoEntradaOriginal || 'N/A'}</p>
                    <p><strong class="font-medium text-gray-800">Código QR:</strong>
                       <input type="text" value="${ticket.codigoQr || 'N/A'}" readonly class="text-xs font-mono bg-gray-100 px-2 py-1 rounded border border-gray-300 w-full mt-1 cursor-pointer focus:outline-none focus:ring-1 focus:ring-indigo-500" title="Haz clic para copiar" onclick="this.select(); try{document.execCommand('copy'); console.log('Código QR copiado!');}catch(e){console.error('No se pudo copiar el QR.');}">
                    </p>
                    <p><strong class="font-medium text-gray-800">Estado API:</strong> ${ticket.estado || 'N/A'} <span class="text-blue-600 font-semibold">${ticket.statusVisual || ''}</span></p>
                    ${ticket.nombreAsistente ? `<p><strong class="font-medium text-gray-800">Nominada a:</strong> ${ticket.nombreAsistente} (${ticket.emailAsistente || 'email no disponible'})</p>` : '<p class="text-sm text-orange-600 italic">Pendiente de nominar</p>'}
                </div>
                <div class="text-center md:text-right">
                    ${ticket.qrCodeImageDataUrl
                ? `<img src="${ticket.qrCodeImageDataUrl}" alt="QR Entrada ${ticket.idEntradaAsignada}" class="w-24 h-24 inline-block border border-gray-300 p-1 bg-white qr-image-display" width="96" height="96">`
                : `<span class="text-xs text-gray-400 italic">(No se pudo generar QR)</span>`
            }
                </div>
            </div>
        `;
    });

    // Esperar a que todas las promesas HTML se resuelvan
    const ticketCardsHtml = await Promise.all(ticketCardsHtmlPromises);

    // Añadir todo el HTML generado al contenedor
    myTicketsListDiv.innerHTML = ticketCardsHtml.join('');

}


/** Limpia las entradas guardadas localmente */
function clearPurchasedTickets() {
    if (confirm('¿Seguro que quieres borrar las entradas compradas de esta simulación? (Esto solo afecta a la visualización local)')) {
        purchasedTickets = [];
        localStorage.removeItem('purchasedTickets');
        renderPurchasedTickets();
        console.log('Entradas compradas (simulación) borradas del almacenamiento local.');
    }
}

/** Actualiza el estado visual temporal de una entrada */
function updatePurchasedTicketStatus(qrCode, visualStatus) {
    let found = false;
    purchasedTickets = purchasedTickets.map(ticket => {
        if (ticket.codigoQr === qrCode) {
            found = true;
            return { ...ticket, statusVisual: `(${visualStatus})` };
        }
        return ticket;
    });
    if (found) {
        renderPurchasedTickets();
        console.log(`Estado visual actualizado para QR ${qrCode} a ${visualStatus}`);
    } else {
        console.warn(`No se encontró la entrada con QR ${qrCode} para actualizar estado visual.`);
    }
}


// --- Inicialización y Event Listeners ---
document.addEventListener('DOMContentLoaded', () => {
    console.log("DOM Cargado. Iniciando simulador de festival...");
    loadFestivalDetails();
    loadTicketTypes();
    initializeStripe();
    renderPurchasedTickets();

    // Listeners
    if (paymentForm) { paymentForm.addEventListener('submit', handlePaymentSubmit); console.log("Listener añadido a paymentForm."); }
    else { console.error("Error: No se encontró paymentForm."); }
    if (nominateTicketForm) { nominateTicketForm.addEventListener('submit', handleNominateTicket); console.log("Listener añadido a nominateTicketForm."); }
    else { console.warn("Elemento nominateTicketForm no encontrado."); }
    if (clearTicketsButton) { clearTicketsButton.addEventListener('click', clearPurchasedTickets); console.log("Listener añadido a clearTicketsButton."); }
    else { console.warn("Elemento clearTicketsButton no encontrado."); }
});
