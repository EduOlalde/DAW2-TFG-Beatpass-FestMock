/**
 * festival_simulator.js
 * Lógica para el simulador de compra y nominación de entradas de festivales.
 * Incluye flujo de pago con Stripe y visualización de entradas con QR.
 */

// --- Configuración ---
const URL_BASE_API = 'https://daw2-tfg-beatpass.onrender.com/api';
//const URL_BASE_API = 'http://localhost:8080/BeatpassTFG/api'; // Para desarrollo local
const CLAVE_PUBLICABLE_STRIPE = 'pk_test_51RLUyq4Et9Src69RTyKKrqn48wubA5QIbS9zTguw8chLB8FGgwMt9sZV6VwvT4UEWE0vnKxaJCNFlj87EY6i9mGK00ggcR1AiX'; // Reemplazar con tu clave publicable real

// --- Variables Globales ---
let entradasCompradas = JSON.parse(localStorage.getItem('entradasCompradas') || '[]');
let stripe = null;
let elementoTarjeta = null;

// --- Selectores del DOM ---
const entradaIdFestivalGlobal = document.getElementById('posFestivalId'); // Input para el ID del festival
const divDetallesFestival = document.getElementById('festival-details');
const divErrorFestival = document.getElementById('festival-error');
const divListaEntradas = document.getElementById('ticket-list');
const divErrorEntradas = document.getElementById('ticket-error');
const formularioPago = document.getElementById('payment-form');
const selectTipoEntradaCompra = document.getElementById('buy-ticket-type');
const entradaCantidadCompra = document.getElementById('buy-quantity');
const entradaEmailCompra = document.getElementById('buy-email');
const entradaNombreCompra = document.getElementById('buy-name');
const entradaTelefonoCompra = document.getElementById('buy-phone');
const contenedorElementoTarjeta = document.getElementById('card-element');
const divErroresTarjeta = document.getElementById('card-errors');
const botonEnviarPago = document.getElementById('submit-button');
const textoBotonPago = document.getElementById('button-text');
const spinnerPago = document.getElementById('spinner'); // Asegúrate que este ID exista si lo usas
const divResultadoPago = document.getElementById('payment-result');
const seccionMisEntradas = document.getElementById('my-tickets-section');
const divListaMisEntradas = document.getElementById('my-tickets-list');
const botonLimpiarEntradas = document.getElementById('clear-tickets-button');
const formularioNominarEntrada = document.getElementById('nominate-ticket-form');
const divResultadoNominacion = document.getElementById('nominate-result');

// --- Funciones Auxiliares de UI ---

/**
 * Muestra un mensaje al usuario en un elemento específico del DOM.
 * @param {HTMLElement} elemento - El elemento donde mostrar el mensaje.
 * @param {string} mensaje - El mensaje a mostrar.
 * @param {boolean} esError - True si es un mensaje de error.
 */
function mostrarMensajeUI(elemento, mensaje, esError) {
    if (!elemento) return;
    elemento.innerHTML = ''; // Limpiar contenido previo
    const p = document.createElement('p');
    p.innerHTML = mensaje; // Usar innerHTML por si el mensaje contiene HTML simple
    elemento.appendChild(p);
    // Las clases 'message-box', 'error-message', 'success-message' están en estilos.css
    elemento.className = `message-box visible ${esError ? 'error-message' : 'success-message'}`;
    if (esError) console.error("Mensaje UI (Error):", mensaje);
}

function limpiarMensajeUI(elemento) {
    if (elemento) {
        elemento.innerHTML = '';
        elemento.className = 'message-box'; // Resetear a clase base, quitando 'visible'
    }
}

/**
 * Controla el estado visual del botón de envío (activo/cargando).
 * @param {boolean} estaCargando - True para mostrar estado de carga.
 */
function establecerEstadoCargaBoton(estaCargando, boton, textoBotonElem, spinnerElem) {
    if (!boton || !textoBotonElem || !spinnerElem) return;
    if (estaCargando) {
        boton.disabled = true;
        textoBotonElem.style.display = 'none';
        spinnerElem.style.display = 'inline-block'; // O 'block' según tu CSS para el spinner
        boton.classList.add('loading'); // Clase para estilos de carga
    } else {
        boton.disabled = false;
        textoBotonElem.style.display = 'inline';
        spinnerElem.style.display = 'none';
        boton.classList.remove('loading');
    }
}

// --- Función para obtener el ID del Festival actual ---
function obtenerIdFestivalActual() {
    if (!entradaIdFestivalGlobal) {
        console.error("Input #posFestivalId (global) no encontrado.");
        return null;
    }
    const idFestival = parseInt(entradaIdFestivalGlobal.value, 10);
    if (isNaN(idFestival) || idFestival <= 0) {
        console.warn("ID de festival inválido en el input:", entradaIdFestivalGlobal.value);
        return null;
    }
    return idFestival;
}

// --- Funciones de API ---
async function peticionApi(url, opciones = {}) {
    const cabeceras = { ...(opciones.headers || {}) };
    if (opciones.body) {
        if (opciones.body instanceof URLSearchParams) {
            if (!cabeceras['Content-Type']) cabeceras['Content-Type'] = 'application/x-www-form-urlencoded;charset=UTF-8';
        } else if (typeof opciones.body === 'object' && !(opciones.body instanceof FormData)) {
            if (!cabeceras['Content-Type']) cabeceras['Content-Type'] = 'application/json';
            if (typeof opciones.body !== 'string') opciones.body = JSON.stringify(opciones.body);
        }
    }
    const opcionesFetch = { ...opciones, headers: cabeceras };

    try {
        const respuesta = await fetch(url, opcionesFetch);
        let datosRespuesta = null;
        const tipoContenido = respuesta.headers.get('content-type');

        if (tipoContenido && tipoContenido.includes('application/json')) {
            try { datosRespuesta = await respuesta.json(); }
            catch (errorJson) {
                console.warn("Fallo al parsear JSON, intentando texto.", errorJson);
                try { datosRespuesta = await respuesta.text(); }
                catch (errorTexto) { datosRespuesta = `Error ${respuesta.status}: Respuesta no procesable.`; }
            }
        } else {
            try { datosRespuesta = await respuesta.text(); }
            catch (errorTexto) { datosRespuesta = `Error ${respuesta.status}: Respuesta no procesable.`; }
        }

        if (!respuesta.ok) {
            const mensajeError = (typeof datosRespuesta === 'object' && datosRespuesta?.error) ? datosRespuesta.error : (typeof datosRespuesta === 'string' && datosRespuesta.length < 200 && datosRespuesta.length > 0 ? datosRespuesta : `Error ${respuesta.status}`);
            throw new Error(mensajeError || `HTTP error! status: ${respuesta.status}`);
        }
        return datosRespuesta;
    } catch (error) {
        console.error(`API Fetch error for ${url}:`, error);
        throw error;
    }
}

// --- Funciones de Carga de Datos ---
async function cargarDetallesFestival() {
    limpiarMensajeUI(divErrorFestival);
    divDetallesFestival.textContent = 'Cargando detalles del festival...';
    const idFestival = obtenerIdFestivalActual();

    if (!idFestival) {
        mostrarMensajeUI(divErrorFestival, "Por favor, introduce un ID de festival válido.", true);
        divDetallesFestival.textContent = '';
        return;
    }

    try {
        const festival = await peticionApi(`${URL_BASE_API}/festivales/${idFestival}`);
        if (festival && typeof festival === 'object') {
            divDetallesFestival.innerHTML = `
                <p><strong class="font-medium text-gray-700">Nombre:</strong> ${festival.nombre || 'N/A'}</p>
                <p><strong class="font-medium text-gray-700">Fechas:</strong> ${festival.fechaInicio || 'N/A'} - ${festival.fechaFin || 'N/A'}</p>
                <p><strong class="font-medium text-gray-700">Ubicación:</strong> ${festival.ubicacion || 'N/A'}</p>
                <p><strong class="font-medium text-gray-700">Descripción:</strong> ${festival.descripcion || 'N/A'}</p>
                <p><strong class="font-medium text-gray-700">Estado:</strong> <span class="font-semibold ${festival.estado === 'PUBLICADO' ? 'text-green-600' : 'text-red-600'}">${festival.estado || 'N/A'}</span></p>
            `;
        } else {
            mostrarMensajeUI(divErrorFestival, 'No se pudieron cargar los detalles del festival (respuesta inesperada).', true);
            divDetallesFestival.textContent = '';
        }
    } catch (error) {
        mostrarMensajeUI(divErrorFestival, `Error al cargar detalles del festival (ID: ${idFestival}): ${error.message}`, true);
        divDetallesFestival.textContent = '';
    }
}

async function cargarTiposEntrada() {
    limpiarMensajeUI(divErrorEntradas);
    divListaEntradas.textContent = 'Cargando tipos de entrada...';
    selectTipoEntradaCompra.innerHTML = '<option value="">Cargando...</option>';
    selectTipoEntradaCompra.disabled = true;
    const idFestival = obtenerIdFestivalActual();

    if (!idFestival) {
        mostrarMensajeUI(divErrorEntradas, "Introduce un ID de festival válido para ver las entradas.", true);
        divListaEntradas.innerHTML = '';
        selectTipoEntradaCompra.innerHTML = '<option value="">Introduce ID Festival</option>';
        return;
    }

    try {
        const tiposEntrada = await peticionApi(`${URL_BASE_API}/festivales/${idFestival}/entradas`);
        divListaEntradas.innerHTML = '';
        selectTipoEntradaCompra.innerHTML = '<option value="">Seleccione un tipo...</option>';

        if (Array.isArray(tiposEntrada) && tiposEntrada.length > 0) {
            let hayEntradasDisponibles = false;
            tiposEntrada.forEach(entrada => {
                const div = document.createElement('div');
                div.className = 'ticket-card-info border-b pb-2 mb-2'; // Clase para posible estilo específico
                div.innerHTML = `
                    <p><strong class="font-medium">${entrada.tipo}</strong></p>
                    <p class="text-sm text-gray-600">${entrada.descripcion || ''}</p>
                    <p class="text-sm font-semibold text-indigo-600">Precio: ${entrada.precio?.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' }) || 'N/A'}</p>
                    <p class="text-sm text-gray-500">Stock: ${entrada.stock !== null ? entrada.stock : 'N/A'}</p>
                `;
                divListaEntradas.appendChild(div);

                const opcion = document.createElement('option');
                opcion.value = entrada.idEntrada;
                if (entrada.stock > 0) {
                    opcion.textContent = `${entrada.tipo} (${entrada.precio?.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}) - Stock: ${entrada.stock}`;
                    opcion.disabled = false;
                    hayEntradasDisponibles = true;
                } else {
                    opcion.textContent = `${entrada.tipo} (AGOTADO)`;
                    opcion.disabled = true;
                }
                selectTipoEntradaCompra.appendChild(opcion);
            });
            selectTipoEntradaCompra.disabled = !hayEntradasDisponibles;
            if (!hayEntradasDisponibles && tiposEntrada.length > 0) { // Si hay tipos pero todos agotados
                selectTipoEntradaCompra.innerHTML = '<option value="">Entradas Agotadas</option>';
            } else if (!hayEntradasDisponibles && tiposEntrada.length === 0) { // Si no hay ningún tipo de entrada
                selectTipoEntradaCompra.innerHTML = '<option value="">No hay entradas</option>';
            }
        } else {
            divListaEntradas.innerHTML = '<p class="text-gray-500 italic">No hay tipos de entrada disponibles para este festival.</p>';
            selectTipoEntradaCompra.innerHTML = '<option value="">No hay entradas disponibles</option>';
            selectTipoEntradaCompra.disabled = true;
        }
    } catch (error) {
        mostrarMensajeUI(divErrorEntradas, `Error al cargar tipos de entrada (ID: ${idFestival}): ${error.message}`, true);
        divListaEntradas.innerHTML = '';
        selectTipoEntradaCompra.innerHTML = '<option value="">Error al cargar</option>';
        selectTipoEntradaCompra.disabled = true;
    }
}

// --- Inicialización de Stripe ---
function iniciarStripe() {
    if (!CLAVE_PUBLICABLE_STRIPE || CLAVE_PUBLICABLE_STRIPE.startsWith('pk_test_TU_CLAVE')) {
        console.error("¡ERROR! Clave publicable de Stripe no configurada.");
        mostrarMensajeUI(divResultadoPago, "Error de configuración: Falta la clave publicable de Stripe.", true);
        if (botonEnviarPago) botonEnviarPago.disabled = true;
        return;
    }
    try {
        stripe = Stripe(CLAVE_PUBLICABLE_STRIPE);
        const elementos = stripe.elements();
        const estilo = { // Estilos para el elemento de tarjeta de Stripe
            base: { color: '#32325d', fontFamily: '"Inter", sans-serif', fontSmoothing: 'antialiased', fontSize: '16px', '::placeholder': { color: '#aab7c4' } },
            invalid: { color: '#fa755a', iconColor: '#fa755a' }
        };
        elementoTarjeta = elementos.create('card', { style: estilo });

        if (contenedorElementoTarjeta) {
            elementoTarjeta.mount('#card-element'); // Montar en el div del HTML
        } else {
            throw new Error("Contenedor de Stripe #card-element no encontrado.");
        }

        elementoTarjeta.on('change', (evento) => { // Mostrar errores de validación de la tarjeta
            if (divErroresTarjeta) divErroresTarjeta.textContent = evento.error ? evento.error.message : '';
        });
    } catch (error) {
        console.error("Error inicializando Stripe Elements:", error);
        mostrarMensajeUI(divResultadoPago, `Error al inicializar el sistema de pago: ${error.message}.`, true);
        if (botonEnviarPago) botonEnviarPago.disabled = true;
    }
}

// --- Manejador de Pago ---
async function manejarEnvioPago(evento) {
    evento.preventDefault();
    establecerEstadoCargaBoton(true, botonEnviarPago, textoBotonPago, spinnerPago);
    limpiarMensajeUI(divResultadoPago);
    if (divErroresTarjeta) divErroresTarjeta.textContent = '';

    if (!stripe || !elementoTarjeta) {
        mostrarMensajeUI(divResultadoPago, "Error: El sistema de pago no está listo. Intenta recargar.", true);
        establecerEstadoCargaBoton(false, botonEnviarPago, textoBotonPago, spinnerPago);
        return;
    }

    const idFestival = obtenerIdFestivalActual();
    const idTipoEntrada = selectTipoEntradaCompra.value;
    const cantidad = parseInt(entradaCantidadCompra.value, 10);
    const emailAsistente = entradaEmailCompra.value;
    const nombreAsistente = entradaNombreCompra.value;
    const telefonoAsistente = entradaTelefonoCompra.value;

    if (!idFestival || !idTipoEntrada || cantidad <= 0 || !emailAsistente || !nombreAsistente) {
        mostrarMensajeUI(divResultadoPago, "Por favor, completa todos los campos obligatorios.", true);
        establecerEstadoCargaBoton(false, botonEnviarPago, textoBotonPago, spinnerPago);
        return;
    }

    let secretoCliente = null;

    try {
        // 1. Iniciar pago en backend (crear PaymentIntent)
        const respuestaIniciarPago = await peticionApi(`${URL_BASE_API}/public/venta/iniciar-pago`, {
            method: 'POST',
            body: JSON.stringify({ idEntrada: parseInt(idTipoEntrada, 10), cantidad: cantidad }),
        });
        secretoCliente = respuestaIniciarPago?.clientSecret;
        if (!secretoCliente) throw new Error("No se recibió el 'client_secret' del servidor.");

        // 2. Confirmar pago de tarjeta con Stripe.js
        const { error: errorStripe, paymentIntent: intentoPago } = await stripe.confirmCardPayment(
            secretoCliente, { payment_method: { card: elementoTarjeta } }
        );

        if (errorStripe) {
            if (divErroresTarjeta) divErroresTarjeta.textContent = errorStripe.message || "Error desconocido durante el pago.";
            mostrarMensajeUI(divResultadoPago, `Error en el pago con tarjeta: ${errorStripe.message}`, true);
            establecerEstadoCargaBoton(false, botonEnviarPago, textoBotonPago, spinnerPago);
            return;
        }

        // 3. Si pago con Stripe fue exitoso (status 'succeeded')
        if (intentoPago && intentoPago.status === 'succeeded') {
            // 4. Confirmar compra en nuestro backend
            const datosConfirmacionBackend = new URLSearchParams({
                idFestival: idFestival.toString(),
                idEntrada: idTipoEntrada,
                cantidad: cantidad.toString(),
                emailAsistente: emailAsistente,
                nombreAsistente: nombreAsistente,
                telefonoAsistente: telefonoAsistente || '',
                paymentIntentId: intentoPago.id
            });
            const compraConfirmada = await peticionApi(`${URL_BASE_API}/public/venta/confirmar-compra`, {
                method: 'POST',
                body: datosConfirmacionBackend
            });

            mostrarMensajeUI(divResultadoPago, `¡Compra confirmada! ID Compra: ${compraConfirmada.idCompra}. Revisa "Mis Entradas".`, false);

            if (compraConfirmada.entradasGeneradas && Array.isArray(compraConfirmada.entradasGeneradas)) {
                const nuevasEntradasParaMostrar = [];
                await Promise.all(compraConfirmada.entradasGeneradas.map(async (entradaDTO) => {
                    const urlDatosImagenQr = await generarUrlDatosQr(entradaDTO.codigoQr);
                    nuevasEntradasParaMostrar.push({
                        idEntradaAsignada: entradaDTO.idEntradaAsignada,
                        codigoQr: entradaDTO.codigoQr,
                        estado: entradaDTO.estado,
                        tipoEntradaOriginal: entradaDTO.tipoEntradaOriginal,
                        urlDatosImagenQr: urlDatosImagenQr,
                        nombreAsistente: entradaDTO.nombreAsistente,
                        emailAsistente: entradaDTO.emailAsistente,
                        estadoVisual: '' // Para UI, ej: '(Nominada)'
                    });
                }));
                entradasCompradas.push(...nuevasEntradasParaMostrar);
                localStorage.setItem('entradasCompradas', JSON.stringify(entradasCompradas));
                mostrarEntradasGuardadas();
            }

            if (formularioPago) formularioPago.reset();
            if (elementoTarjeta) elementoTarjeta.clear();
            cargarTiposEntrada(); // Recargar para actualizar stock
        } else {
            mostrarMensajeUI(divResultadoPago, `El pago no se completó (Estado: ${intentoPago?.status || 'desconocido'}).`, true);
        }
    } catch (error) {
        mostrarMensajeUI(divResultadoPago, `Error procesando la compra: ${error.message || 'Error desconocido'}`, true);
    } finally {
        establecerEstadoCargaBoton(false, botonEnviarPago, textoBotonPago, spinnerPago);
    }
}

// --- Manejador de Nominación ---
async function manejarNominarEntrada(evento) {
    evento.preventDefault();
    limpiarMensajeUI(divResultadoNominacion);
    const datosFormulario = new FormData(formularioNominarEntrada);
    const cuerpoPeticion = new URLSearchParams(datosFormulario);
    const botonEnviarNominacion = formularioNominarEntrada.querySelector('button[type="submit"]');
    if (botonEnviarNominacion) { // Deshabilitar botón durante la petición
        botonEnviarNominacion.disabled = true; botonEnviarNominacion.textContent = 'Nominando...';
    }

    try {
        const resultado = await peticionApi(`${URL_BASE_API}/public/venta/nominar`, {
            method: 'POST',
            body: cuerpoPeticion
        });
        mostrarMensajeUI(divResultadoNominacion, resultado.mensaje || 'Entrada nominada con éxito.', false);
        if (formularioNominarEntrada) formularioNominarEntrada.reset();

        // Actualizar visualmente la entrada en "Mis Entradas"
        actualizarEstadoEntradaComprada(datosFormulario.get('codigoQr'), 'Nominada', {
            nombreNominado: datosFormulario.get('nombreNominado'),
            emailNominado: datosFormulario.get('emailNominado')
        });
    } catch (error) {
        mostrarMensajeUI(divResultadoNominacion, `Error al nominar: ${error.message}`, true);
    } finally {
        if (botonEnviarNominacion) { // Rehabilitar botón
            botonEnviarNominacion.disabled = false; botonEnviarNominacion.textContent = 'Nominar Entrada';
        }
    }
}

// --- Funciones para Mostrar Entradas Compradas ---

/**
 * Genera la URL de datos Base64 para una imagen QR.
 * @param {string} texto - El texto a codificar en el QR.
 * @returns {Promise<string|null>} La URL de datos de la imagen QR o null si hay error.
 */
async function generarUrlDatosQr(texto) {
    if (typeof qrcode === 'undefined') { // qrcode-generator debe estar cargado
        console.error("Librería qrcode-generator no cargada.");
        return null;
    }
    if (!texto) return null;
    try {
        const qr = qrcode(0, 'M'); // typeNumber 0 (auto), errorCorrectionLevel 'M'
        qr.addData(texto);
        qr.make();
        return qr.createDataURL(4, 2); // cellSize 4px, margin 2 módulos
    } catch (error) {
        console.error("Error generando imagen QR para:", texto, error);
        return null;
    }
}

/** Renderiza las entradas guardadas en localStorage en la sección "Mis Entradas". */
async function mostrarEntradasGuardadas() {
    if (!divListaMisEntradas || !seccionMisEntradas) return;

    divListaMisEntradas.innerHTML = '';
    if (entradasCompradas.length === 0) {
        seccionMisEntradas.style.display = 'none';
        return;
    }
    seccionMisEntradas.style.display = 'block';

    const promesasHtmlTarjetas = entradasCompradas.map(async (entrada) => {
        if (!entrada.urlDatosImagenQr && entrada.codigoQr) { // Generar QR si no existe
            entrada.urlDatosImagenQr = await generarUrlDatosQr(entrada.codigoQr);
        }
        return `
            <div class="ticket-card grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
                <div class="md:col-span-2 space-y-1">
                    <p><strong class="font-medium text-gray-800">ID Entrada:</strong> ${entrada.idEntradaAsignada || 'N/A'}</p>
                    <p><strong class="font-medium text-gray-800">Tipo:</strong> ${entrada.tipoEntradaOriginal || 'N/A'}</p>
                    <p><strong class="font-medium text-gray-800">Código QR:</strong>
                        <input type="text" value="${entrada.codigoQr || 'N/A'}" readonly class="text-xs font-mono bg-gray-100 px-2 py-1 rounded border border-gray-300 w-full mt-1 cursor-pointer focus:outline-none focus:ring-1 focus:ring-indigo-500" title="Haz clic para copiar" onclick="this.select(); try{document.execCommand('copy'); console.log('Código QR copiado!'); this.blur();}catch(e){console.error('No se pudo copiar el QR.');}">
                    </p>
                    <p><strong class="font-medium text-gray-800">Estado API:</strong> ${entrada.estado || 'N/A'} <span class="text-blue-600 font-semibold">${entrada.estadoVisual || ''}</span></p>
                    ${entrada.nombreAsistente ? `<p><strong class="font-medium text-gray-800">Nominada a:</strong> ${entrada.nombreAsistente} (${entrada.emailAsistente || 'email no disponible'})</p>` : '<p class="text-sm text-orange-600 italic">Pendiente de nominar</p>'}
                </div>
                <div class="text-center md:text-right">
                    ${entrada.urlDatosImagenQr ? `<img src="${entrada.urlDatosImagenQr}" alt="QR Entrada ${entrada.idEntradaAsignada}" class="qr-image-display w-24 h-24 inline-block border border-gray-300 p-1 bg-white" width="96" height="96">` : `<span class="text-xs text-gray-400 italic">(No se pudo generar QR)</span>`}
                </div>
            </div>
        `;
    });
    const htmlTarjetas = await Promise.all(promesasHtmlTarjetas);
    divListaMisEntradas.innerHTML = htmlTarjetas.join('');
}

function limpiarEntradasCompradas() {
    if (confirm('¿Seguro que quieres borrar las entradas compradas de esta simulación?')) {
        entradasCompradas = [];
        localStorage.removeItem('entradasCompradas');
        mostrarEntradasGuardadas();
    }
}

/**
 * Actualiza el estado visual y/o datos del nominado de una entrada en la lista local.
 * @param {string} codigoQr - El código QR de la entrada a actualizar.
 * @param {string} estadoVisual - El estado visual a mostrar (ej. 'Nominada').
 * @param {object|null} [datosNominado=null] - Objeto con {nombreNominado, emailNominado}.
 */
function actualizarEstadoEntradaComprada(codigoQr, estadoVisual, datosNominado = null) {
    let encontrado = false;
    entradasCompradas = entradasCompradas.map(entrada => {
        if (entrada.codigoQr === codigoQr) {
            encontrado = true;
            const entradaActualizada = { ...entrada, estadoVisual: `(${estadoVisual})` };
            if (datosNominado) {
                entradaActualizada.nombreAsistente = datosNominado.nombreNominado;
                entradaActualizada.emailAsistente = datosNominado.emailNominado;
            }
            return entradaActualizada;
        }
        return entrada;
    });
    if (encontrado) {
        localStorage.setItem('entradasCompradas', JSON.stringify(entradasCompradas));
        mostrarEntradasGuardadas();
    }
}

// --- Inicialización y Event Listeners ---
document.addEventListener('DOMContentLoaded', () => {
    if (entradaIdFestivalGlobal) {
        entradaIdFestivalGlobal.addEventListener('change', () => {
            limpiarMensajeUI(divErrorFestival);
            limpiarMensajeUI(divErrorEntradas);
            divDetallesFestival.innerHTML = '';
            divListaEntradas.innerHTML = '';
            selectTipoEntradaCompra.innerHTML = '<option value="">Seleccione un tipo...</option>';
            selectTipoEntradaCompra.disabled = true;
            limpiarMensajeUI(divResultadoPago);
            cargarDetallesFestival();
            cargarTiposEntrada();
        });
        cargarDetallesFestival(); // Carga inicial
        cargarTiposEntrada();   // Carga inicial
    } else {
        if (divErrorFestival) mostrarMensajeUI(divErrorFestival, "Error: Falta el campo ID del festival.", true);
    }

    iniciarStripe();
    mostrarEntradasGuardadas();

    if (formularioPago) formularioPago.addEventListener('submit', manejarEnvioPago);
    if (formularioNominarEntrada) formularioNominarEntrada.addEventListener('submit', manejarNominarEntrada);
    if (botonLimpiarEntradas) botonLimpiarEntradas.addEventListener('click', limpiarEntradasCompradas);
});