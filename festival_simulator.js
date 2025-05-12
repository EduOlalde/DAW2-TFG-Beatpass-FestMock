/**
 * simulador_festival.js
 * Lógica para el simulador de compra y nominación de entradas,
 * incluyendo el flujo de pago con Stripe y la visualización de entradas compradas.
 * Versión con ID de Festival dinámico leído desde el input #entradaIdFestivalPOS.
 */

// --- Configuración ---
const URL_BASE_API = 'https://daw2-tfg-beatpass.onrender.com/api';
//const URL_BASE_API = 'http://localhost:8888/BeatpassTFG/api'; // Para pruebas locales
const CLAVE_PUBLICABLE_STRIPE = 'pk_test_51RLUyq4Et9Src69RTyKKrqn48wubA5QIbS9zTguw8chLB8FGgwMt9sZV6VwvT4UEWE0vnKxaJCNFlj87EY6i9mGK00ggcR1AiX'; // Reemplazar con tu clave real

// --- Variables Globales ---
let entradasCompradas = JSON.parse(localStorage.getItem('entradasCompradas') || '[]'); // Entradas compradas en esta sesión
let stripe = null; // Instancia de Stripe
let elementoTarjeta = null; // Elemento de tarjeta de Stripe

// --- Selectores del DOM ---
const entradaIdFestivalPOS = document.getElementById('posFestivalId'); // Mantenido ID original para compatibilidad HTML
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
const botonEnviar = document.getElementById('submit-button');
const textoBoton = document.getElementById('button-text');
const spinner = document.getElementById('spinner');
const divResultadoPago = document.getElementById('payment-result');
const seccionMisEntradas = document.getElementById('my-tickets-section');
const divListaMisEntradas = document.getElementById('my-tickets-list');
const botonLimpiarEntradas = document.getElementById('clear-tickets-button');
const formularioNominarEntrada = document.getElementById('nominate-ticket-form');
const divResultadoNominacion = document.getElementById('nominate-result');

// --- Funciones Auxiliares de UI ---

/** Muestra un mensaje al usuario en un elemento específico. */
function mostrarMensaje(elemento, mensaje, esError) {
    if (!elemento) return;
    elemento.innerHTML = '';
    const p = document.createElement('p');
    p.innerHTML = mensaje; // Usar innerHTML para permitir HTML simple
    elemento.appendChild(p);
    elemento.className = `message-box ${esError ? 'error-message' : 'success-message'}`;
    elemento.style.display = 'block';
    if (esError) console.error("Mensaje UI (Error):", mensaje);
}

/** Limpia un elemento de mensaje. */
function limpiarResultado(elemento) {
    if (elemento) {
        elemento.innerHTML = '';
        elemento.style.display = 'none';
        elemento.className = 'message-box';
    }
}

/** Controla el estado visual del botón de envío (activo/cargando). */
function establecerEstadoCarga(estaCargando) {
    if (!botonEnviar || !textoBoton || !spinner) return;
    if (estaCargando) {
        botonEnviar.disabled = true;
        textoBoton.style.display = 'none';
        spinner.style.display = 'inline-block';
        botonEnviar.classList.add('opacity-75', 'cursor-not-allowed');
    } else {
        botonEnviar.disabled = false;
        textoBoton.style.display = 'inline';
        spinner.style.display = 'none';
        botonEnviar.classList.remove('opacity-75', 'cursor-not-allowed');
    }
}

// --- Función para obtener el ID del Festival actual ---
/** Lee y valida el ID del festival desde el input #entradaIdFestivalPOS. */
function obtenerIdFestivalActual() {
    if (!entradaIdFestivalPOS) {
        console.error("Input #posFestivalId no encontrado."); // Mantenido ID original
        return null;
    }
    const idFestival = parseInt(entradaIdFestivalPOS.value, 10);
    if (isNaN(idFestival) || idFestival <= 0) {
        console.warn("ID de festival inválido en el input:", entradaIdFestivalPOS.value);
        return null; // Retorna null si no es un número válido o es <= 0
    }
    return idFestival;
}


// --- Funciones de API ---
/** Realiza una petición fetch a la API, manejando JSON y errores comunes. */
async function peticionApi(url, opciones = {}) {
    // Configuración automática de Content-Type si no se especifica
    const cabeceras = { ...(opciones.headers || {}) };
    if (opciones.body) {
        if (opciones.body instanceof URLSearchParams) {
            if (!cabeceras['Content-Type']) cabeceras['Content-Type'] = 'application/x-www-form-urlencoded;charset=UTF-8';
        } else if (typeof opciones.body === 'object' && !(opciones.body instanceof FormData)) {
            if (!cabeceras['Content-Type']) cabeceras['Content-Type'] = 'application/json';
            if (typeof opciones.body !== 'string') {
                opciones.body = JSON.stringify(opciones.body);
            }
        }
    }
    const opcionesFetch = { ...opciones, headers: cabeceras };

    try {
        const respuesta = await fetch(url, opcionesFetch);
        let datosRespuesta = null;
        const tipoContenido = respuesta.headers.get('content-type');

        // Intenta parsear como JSON si el Content-Type lo indica
        if (tipoContenido && tipoContenido.includes('application/json')) {
            try { datosRespuesta = await respuesta.json(); }
            catch (errorJson) {
                console.warn("Fallo al parsear JSON, intentando obtener texto.", errorJson);
                try { datosRespuesta = await respuesta.text(); console.warn("Respuesta obtenida como texto:", datosRespuesta); }
                catch (errorTexto) { console.error("Fallo crítico al obtener texto de respuesta.", errorTexto); datosRespuesta = `Error ${respuesta.status}: Respuesta no procesable.`; }
            }
        } else { // Si no es JSON, intenta obtener como texto
            try { datosRespuesta = await respuesta.text(); }
            catch (errorTexto) { console.error("Fallo al obtener texto no JSON.", errorTexto); datosRespuesta = `Error ${respuesta.status}: Respuesta no procesable.`; }
        }

        // Manejo de errores HTTP (status no OK)
        if (!respuesta.ok) {
            console.error(`API Error Response ${respuesta.status} for ${url}:`, datosRespuesta);
            // Intenta obtener un mensaje de error significativo de la respuesta
            const mensajeError = (typeof datosRespuesta === 'object' && datosRespuesta?.error) ? datosRespuesta.error : (typeof datosRespuesta === 'string' && datosRespuesta.length < 200 && datosRespuesta.length > 0 ? datosRespuesta : `Error ${respuesta.status}`);
            throw new Error(mensajeError || `HTTP error! status: ${respuesta.status}`);
        }

        return datosRespuesta; // Devuelve los datos si todo fue bien
    } catch (error) {
        console.error(`API Fetch error for ${url}:`, error);
        throw error; // Re-lanzar para que las funciones que llaman puedan manejarlo
    }
}

// --- Funciones de Carga de Datos ---

/** Carga y muestra los detalles del festival actual. */
async function cargarDetallesFestival() {
    limpiarResultado(divErrorFestival);
    divDetallesFestival.textContent = 'Cargando detalles del festival...';
    const idFestival = obtenerIdFestivalActual();

    if (!idFestival) {
        mostrarMensaje(divErrorFestival, "Por favor, introduce un ID de festival válido.", true);
        divDetallesFestival.textContent = '';
        return;
    }

    try {
        const festival = await peticionApi(`${URL_BASE_API}/festivales/${idFestival}`);
        if (festival && typeof festival === 'object') {
            // Renderiza los detalles del festival
            divDetallesFestival.innerHTML = `
                <p><strong class="font-medium text-gray-700">Nombre:</strong> ${festival.nombre || 'N/A'}</p>
                <p><strong class="font-medium text-gray-700">Fechas:</strong> ${festival.fechaInicio || 'N/A'} - ${festival.fechaFin || 'N/A'}</p>
                <p><strong class="font-medium text-gray-700">Ubicación:</strong> ${festival.ubicacion || 'N/A'}</p>
                <p><strong class="font-medium text-gray-700">Descripción:</strong> ${festival.descripcion || 'N/A'}</p>
                <p><strong class="font-medium text-gray-700">Estado:</strong> <span class="font-semibold ${festival.estado === 'PUBLICADO' ? 'text-green-600' : 'text-red-600'}">${festival.estado || 'N/A'}</span></p>
            `;
        } else {
            // Manejo de respuesta inesperada
            mostrarMensaje(divErrorFestival, 'No se pudieron cargar los detalles del festival (respuesta inesperada).', true);
            divDetallesFestival.textContent = '';
        }
    } catch (error) {
        // Manejo de error en la petición
        mostrarMensaje(divErrorFestival, `Error al cargar detalles del festival (ID: ${idFestival}): ${error.message}`, true);
        divDetallesFestival.textContent = '';
    }
}

/** Carga y muestra los tipos de entrada disponibles para el festival actual. */
async function cargarTiposEntrada() {
    limpiarResultado(divErrorEntradas);
    divListaEntradas.textContent = 'Cargando tipos de entrada...';
    selectTipoEntradaCompra.innerHTML = '<option value="">Cargando...</option>';
    selectTipoEntradaCompra.disabled = true;
    const idFestival = obtenerIdFestivalActual();

    if (!idFestival) {
        mostrarMensaje(divErrorEntradas, "Introduce un ID de festival válido para ver las entradas.", true);
        divListaEntradas.innerHTML = '';
        selectTipoEntradaCompra.innerHTML = '<option value="">Introduce ID Festival</option>';
        return;
    }

    try {
        const tiposEntrada = await peticionApi(`${URL_BASE_API}/festivales/${idFestival}/entradas`);
        divListaEntradas.innerHTML = ''; // Limpiar antes de añadir nuevos
        selectTipoEntradaCompra.innerHTML = '<option value="">Seleccione un tipo...</option>'; // Limpiar antes de añadir nuevos

        if (Array.isArray(tiposEntrada) && tiposEntrada.length > 0) {
            let hayEntradasDisponibles = false;
            // Itera sobre los tipos de entrada y los muestra
            tiposEntrada.forEach(entrada => {
                const div = document.createElement('div');
                div.className = 'border-b pb-2 mb-2';
                div.innerHTML = `
                    <p><strong class="font-medium">${entrada.tipo}</strong></p>
                    <p class="text-sm text-gray-600">${entrada.descripcion || ''}</p>
                    <p class="text-sm font-semibold text-indigo-600">Precio: ${entrada.precio?.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' }) || 'N/A'}</p>
                    <p class="text-sm text-gray-500">Stock: ${entrada.stock !== null ? entrada.stock : 'N/A'}</p>
                `;
                divListaEntradas.appendChild(div);

                // Añade la opción al select de compra
                const opcion = document.createElement('option');
                opcion.value = entrada.idEntrada; // ID del TIPO de entrada
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
            // Habilita/deshabilita el select según disponibilidad
            selectTipoEntradaCompra.disabled = !hayEntradasDisponibles;
            if (!hayEntradasDisponibles) {
                selectTipoEntradaCompra.innerHTML = '<option value="">Entradas Agotadas</option>';
            }
        } else {
            // Mensaje si no hay tipos de entrada
            divListaEntradas.innerHTML = '<p class="text-gray-500 italic">No hay tipos de entrada disponibles para este festival.</p>';
            selectTipoEntradaCompra.innerHTML = '<option value="">No hay entradas disponibles</option>';
            selectTipoEntradaCompra.disabled = true;
        }
    } catch (error) {
        // Manejo de error en la petición
        mostrarMensaje(divErrorEntradas, `Error al cargar tipos de entrada (ID: ${idFestival}): ${error.message}`, true);
        divListaEntradas.innerHTML = '';
        selectTipoEntradaCompra.innerHTML = '<option value="">Error al cargar</option>';
        selectTipoEntradaCompra.disabled = true;
    }
}

// --- Inicialización de Stripe ---
/** Inicializa Stripe.js y monta el elemento de tarjeta. */
function iniciarStripe() {
    // Validar que la clave publicable esté configurada
    if (!CLAVE_PUBLICABLE_STRIPE || CLAVE_PUBLICABLE_STRIPE === 'pk_test_TU_CLAVE_PUBLICABLE_AQUI') {
        console.error("¡ERROR! Clave publicable de Stripe no configurada. Reemplaza el placeholder en simulador_festival.js.");
        mostrarMensaje(divResultadoPago, "Error de configuración: Falta la clave publicable de Stripe.", true);
        if (botonEnviar) botonEnviar.disabled = true;
        return;
    }
    try {
        stripe = Stripe(CLAVE_PUBLICABLE_STRIPE);
        const elementos = stripe.elements();
        // Estilos para el elemento de tarjeta
        const estilo = {
            base: { color: '#32325d', fontFamily: '"Inter", sans-serif', fontSmoothing: 'antialiased', fontSize: '16px', '::placeholder': { color: '#aab7c4' } },
            invalid: { color: '#fa755a', iconColor: '#fa755a' }
        };
        elementoTarjeta = elementos.create('card', { style: estilo });

        // Montar el elemento en el contenedor del DOM
        if (contenedorElementoTarjeta) {
            elementoTarjeta.mount('#card-element');
        } else {
            console.error("Error: No se encontró el contenedor #card-element en el HTML.");
            throw new Error("Contenedor de Stripe no encontrado.");
        }

        // Escuchar cambios en el CardElement y mostrar errores
        elementoTarjeta.on('change', (evento) => {
            if (divErroresTarjeta) {
                if (evento.error) { divErroresTarjeta.textContent = evento.error.message; }
                else { divErroresTarjeta.textContent = ''; }
            }
        });
    } catch (error) {
        // Manejo de error en la inicialización de Stripe
        console.error("Error inicializando Stripe Elements:", error);
        mostrarMensaje(divResultadoPago, `Error al inicializar el sistema de pago: ${error.message}. Por favor, recarga la página.`, true);
        if (botonEnviar) botonEnviar.disabled = true;
    }
}

// --- Manejador de Pago ---

/**
 * Maneja el envío del formulario de pago.
 * 1. Obtiene datos del formulario y valida.
 * 2. Llama al backend para crear un PaymentIntent (/iniciar-pago).
 * 3. Confirma el pago con tarjeta usando Stripe.js.
 * 4. Si Stripe confirma, llama al backend para registrar la compra (/confirmar-compra).
 * 5. Procesa las entradas generadas (genera QR, guarda localmente, renderiza).
 */
async function manejarEnvioPago(evento) {
    evento.preventDefault();
    establecerEstadoCarga(true);
    limpiarResultado(divResultadoPago);
    if (divErroresTarjeta) divErroresTarjeta.textContent = '';

    // Verificar que Stripe esté listo
    if (!stripe || !elementoTarjeta) {
        mostrarMensaje(divResultadoPago, "Error: El sistema de pago no está listo. Intenta recargar.", true);
        establecerEstadoCarga(false);
        return;
    }

    // 1. Obtener ID del festival y datos del formulario
    const idFestival = obtenerIdFestivalActual();
    const idTipoEntrada = selectTipoEntradaCompra.value; // ID del TIPO de entrada
    const cantidad = parseInt(entradaCantidadCompra.value, 10);
    const emailAsistente = entradaEmailCompra.value;
    const nombreAsistente = entradaNombreCompra.value;
    const telefonoAsistente = entradaTelefonoCompra.value;

    // Validaciones básicas
    if (!idFestival) {
        mostrarMensaje(divResultadoPago, "Error: No se ha especificado un ID de festival válido.", true);
        establecerEstadoCarga(false);
        return;
    }
    if (!idTipoEntrada || cantidad <= 0 || !emailAsistente || !nombreAsistente) {
        mostrarMensaje(divResultadoPago, "Por favor, completa todos los campos obligatorios (tipo de entrada, cantidad, email, nombre).", true);
        establecerEstadoCarga(false);
        return;
    }

    let secretoCliente = null;

    try {
        // 2. Llamar al backend para iniciar el pago (crear PaymentIntent)
        const respuestaIniciarPago = await peticionApi(`${URL_BASE_API}/public/venta/iniciar-pago`, {
            method: 'POST',
            body: JSON.stringify({ idEntrada: parseInt(idTipoEntrada, 10), cantidad: cantidad }),
            headers: { 'Content-Type': 'application/json' }
        });
        secretoCliente = respuestaIniciarPago?.clientSecret;
        if (!secretoCliente) throw new Error("No se recibió el 'client_secret' del servidor.");

        // 3. Confirmar el pago de la tarjeta con Stripe.js
        const { error: errorStripe, paymentIntent: intentoPago } = await stripe.confirmCardPayment(
            secretoCliente, { payment_method: { card: elementoTarjeta } }
        );

        // Manejar error de Stripe
        if (errorStripe) {
            console.error("Error de Stripe al confirmar pago:", errorStripe);
            if (divErroresTarjeta) divErroresTarjeta.textContent = errorStripe.message || "Error desconocido durante el pago.";
            mostrarMensaje(divResultadoPago, `Error en el pago con tarjeta: ${errorStripe.message}`, true);
            establecerEstadoCarga(false);
            return; // No continuar si Stripe falla
        }

        // 4. Si el pago con Stripe fue exitoso (status 'succeeded')
        if (intentoPago && intentoPago.status === 'succeeded') {
            // 5. Llamar al backend para confirmar la compra en nuestro sistema
            const datosConfirmacionBackend = new URLSearchParams({
                idFestival: idFestival.toString(), // Usar el ID dinámico
                idEntrada: idTipoEntrada,
                cantidad: cantidad.toString(),
                emailAsistente: emailAsistente,
                nombreAsistente: nombreAsistente,
                telefonoAsistente: telefonoAsistente || '',
                paymentIntentId: intentoPago.id // ID de la transacción de Stripe
            });
            const compraConfirmada = await peticionApi(`${URL_BASE_API}/public/venta/confirmar-compra`, {
                method: 'POST',
                body: datosConfirmacionBackend
            });

            // 6. Mostrar éxito y procesar entradas generadas
            mostrarMensaje(divResultadoPago, `¡Compra confirmada con éxito! ID Compra: ${compraConfirmada.idCompra}. Añadiendo entradas a la lista...`, false);

            // --- INICIO: Procesar entradas generadas ---
            if (compraConfirmada.entradasGeneradas && Array.isArray(compraConfirmada.entradasGeneradas)) {
                const nuevasEntradasParaMostrar = [];
                // Generar QRs y preparar datos para guardar localmente
                await Promise.all(compraConfirmada.entradasGeneradas.map(async (entradaDTO) => {
                    const urlDatosImagenQr = await generarUrlDatosQr(entradaDTO.codigoQr);
                    const entradaLocal = {
                        idEntradaAsignada: entradaDTO.idEntradaAsignada,
                        codigoQr: entradaDTO.codigoQr,
                        estado: entradaDTO.estado, // Estado devuelto por la API
                        tipoEntradaOriginal: entradaDTO.tipoEntradaOriginal,
                        urlDatosImagenQr: urlDatosImagenQr, // URL del QR generado
                        nombreAsistente: entradaDTO.nombreAsistente, // Puede ser null inicialmente
                        emailAsistente: entradaDTO.emailAsistente, // Puede ser null inicialmente
                        estadoVisual: '' // Estado visual temporal (ej. 'Nominada')
                    };
                    nuevasEntradasParaMostrar.push(entradaLocal);
                }));

                // Añadir nuevas entradas al array global y guardar en localStorage
                entradasCompradas.push(...nuevasEntradasParaMostrar);
                localStorage.setItem('entradasCompradas', JSON.stringify(entradasCompradas));
                mostrarEntradasGuardadas(); // Actualizar la lista visual
            } else {
                console.warn("La respuesta de confirmación no contenía la lista 'entradasGeneradas'.");
                mostrarMensaje(divResultadoPago, `¡Compra confirmada con éxito! ID Compra: ${compraConfirmada.idCompra}. (No se recibieron detalles de entradas generadas).`, false);
            }
            // --- FIN: Procesar entradas generadas ---

            // Limpiar formulario y recargar tipos de entrada (para stock)
            if (formularioPago) formularioPago.reset();
            if (elementoTarjeta) elementoTarjeta.clear();
            cargarTiposEntrada();

        } else {
            // Caso raro: Stripe no da error pero el intent no está 'succeeded'
            console.warn("Estado inesperado del PaymentIntent tras confirmación:", intentoPago?.status);
            mostrarMensaje(divResultadoPago, `El pago no se completó del todo (Estado: ${intentoPago?.status || 'desconocido'}). Contacta con soporte.`, true);
        }

    } catch (error) {
        // Captura errores de peticionApi o Stripe no controlados antes
        console.error("Error en el proceso de pago completo:", error);
        mostrarMensaje(divResultadoPago, `Error procesando la compra: ${error.message || 'Error desconocido'}`, true);
    } finally {
        establecerEstadoCarga(false); // Reactivar el botón siempre
    }
}

// --- Manejador de Nominación ---
/**
 * Maneja el envío del formulario de nominación.
 * 1. Obtiene datos del formulario.
 * 2. Llama al backend para nominar la entrada (/public/venta/nominar).
 * 3. Muestra el resultado y actualiza la entrada en la lista local.
 */
async function manejarNominarEntrada(evento) {
    evento.preventDefault();
    limpiarResultado(divResultadoNominacion);
    const datosFormulario = new FormData(formularioNominarEntrada);
    const cuerpoPeticion = new URLSearchParams(datosFormulario); // Enviar como x-www-form-urlencoded
    const botonEnviarNominacion = formularioNominarEntrada.querySelector('button[type="submit"]');
    if (botonEnviarNominacion) {
        botonEnviarNominacion.disabled = true; botonEnviarNominacion.textContent = 'Nominando...';
    }

    try {
        // Llamar a la API para nominar
        const resultado = await peticionApi(`${URL_BASE_API}/public/venta/nominar`, {
            method: 'POST',
            body: cuerpoPeticion
        });
        mostrarMensaje(divResultadoNominacion, resultado.mensaje || 'Entrada nominada con éxito.', false);
        if (formularioNominarEntrada) formularioNominarEntrada.reset(); // Limpiar formulario

        // Actualizar visualmente la entrada en la lista "Mis Entradas"
        // Pasamos los datos del nominado para actualizar la visualización
        const datosNominado = {
            nombreNominado: datosFormulario.get('nombreNominado'),
            emailNominado: datosFormulario.get('emailNominado')
        };
        actualizarEstadoEntradaComprada(datosFormulario.get('codigoQr'), 'Nominada', datosNominado);

    } catch (error) {
        // Manejo de error en la nominación
        mostrarMensaje(divResultadoNominacion, `Error al nominar: ${error.message}`, true);
    } finally {
        // Reactivar el botón
        if (botonEnviarNominacion) {
            botonEnviarNominacion.disabled = false; botonEnviarNominacion.textContent = 'Nominar Entrada';
        }
    }
}

// --- Funciones para Mostrar Entradas Compradas ---

/**
 * Genera la URL de datos Base64 para una imagen QR usando qrcode-generator.
 * Requiere que la librería qrcode-generator esté incluida en el HTML.
 * <script src="https://cdnjs.cloudflare.com/ajax/libs/qrcode-generator/1.4.4/qrcode.min.js"></script>
 */
async function generarUrlDatosQr(texto) {
    // Comprobar si la librería está cargada
    if (typeof qrcode === 'undefined') {
        console.error("Librería qrcode-generator no cargada. Asegúrate de incluir el script en tu HTML.");
        return null; // Retorna null si la librería no está disponible
    }
    if (!texto) return null; // No generar QR si no hay texto

    try {
        const qr = qrcode(0, 'M'); // typeNumber 0 (auto-detect), errorCorrectionLevel 'M' (Medium)
        qr.addData(texto);
        qr.make();
        // createDataURL(cellSize, margin)
        const urlDatos = qr.createDataURL(4, 2); // Tamaño de celda 4px, margen de 2 módulos
        return urlDatos;
    } catch (error) {
        console.error("Error generando imagen QR para:", texto, error);
        return null; // Retorna null en caso de error
    }
}

/** Renderiza las entradas guardadas en localStorage en la sección "Mis Entradas". */
async function mostrarEntradasGuardadas() {
    if (!divListaMisEntradas || !seccionMisEntradas) return;

    divListaMisEntradas.innerHTML = ''; // Limpiar antes de re-renderizar
    if (entradasCompradas.length === 0) {
        seccionMisEntradas.style.display = 'none'; // Ocultar sección si no hay entradas
        return;
    }
    seccionMisEntradas.style.display = 'block'; // Mostrar sección si hay entradas

    // Mapear cada entrada a una promesa que resuelve con el HTML de su tarjeta
    // Esto permite generar los QR que falten de forma asíncrona
    const promesasHtmlTarjetasEntrada = entradasCompradas.map(async (entrada) => {
        // Generar URL de imagen QR si no existe en el objeto local O si es null
        if (!entrada.urlDatosImagenQr && entrada.codigoQr) {
            entrada.urlDatosImagenQr = await generarUrlDatosQr(entrada.codigoQr);
            // Opcional: Actualizar localStorage si se genera un QR nuevo (puede ser costoso)
            // localStorage.setItem('entradasCompradas', JSON.stringify(entradasCompradas));
        }

        // Construir el HTML de la tarjeta para esta entrada
        return `
            <div class="ticket-card grid grid-cols-1 md:grid-cols-3 gap-4 items-center border-b last:border-b-0 py-4">
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
                    ${entrada.urlDatosImagenQr
                ? `<img src="${entrada.urlDatosImagenQr}" alt="QR Entrada ${entrada.idEntradaAsignada}" class="w-24 h-24 inline-block border border-gray-300 p-1 bg-white qr-image-display" width="96" height="96">`
                : `<span class="text-xs text-gray-400 italic">(No se pudo generar QR)</span>` // Mensaje si falla la generación del QR
            }
                </div>
            </div>
        `;
    });

    // Esperar a que todas las promesas HTML (incluida la generación de QR) se resuelvan
    const htmlTarjetasEntrada = await Promise.all(promesasHtmlTarjetasEntrada);

    // Añadir todo el HTML generado al contenedor
    divListaMisEntradas.innerHTML = htmlTarjetasEntrada.join('');
}


/** Limpia las entradas guardadas localmente (simulación). */
function limpiarEntradasCompradas() {
    if (confirm('¿Seguro que quieres borrar las entradas compradas de esta simulación? (Esto solo afecta a la visualización local)')) {
        entradasCompradas = [];
        localStorage.removeItem('entradasCompradas');
        mostrarEntradasGuardadas(); // Re-renderizar para ocultar la sección
    }
}

/**
 * Actualiza el estado visual temporal y/o los datos del nominado de una entrada en la lista local.
 * @param {string} codigoQr - El código QR de la entrada a actualizar.
 * @param {string} estadoVisual - El estado visual a mostrar (ej. 'Nominada', 'Validada').
 * @param {object|null} datosNominado - Objeto con {nombreNominado, emailNominado} o null.
 */
function actualizarEstadoEntradaComprada(codigoQr, estadoVisual, datosNominado = null) {
    let encontrado = false;
    entradasCompradas = entradasCompradas.map(entrada => {
        if (entrada.codigoQr === codigoQr) {
            encontrado = true;
            const entradaActualizada = { ...entrada, estadoVisual: `(${estadoVisual})` };
            // Si se proporcionan datos del nominado, actualizarlos también
            if (datosNominado) {
                entradaActualizada.nombreAsistente = datosNominado.nombreNominado;
                entradaActualizada.emailAsistente = datosNominado.emailNominado;
                // Podríamos querer actualizar el estado API local también si la nominación lo cambia
                // entradaActualizada.estado = 'NOMINADA'; // O el estado que devuelva la API
            }
            return entradaActualizada;
        }
        return entrada;
    });

    if (encontrado) {
        // Guardar los cambios en localStorage y re-renderizar
        localStorage.setItem('entradasCompradas', JSON.stringify(entradasCompradas));
        mostrarEntradasGuardadas();
    } else {
        console.warn(`No se encontró la entrada con QR ${codigoQr} para actualizar estado visual/nominado.`);
    }
}


// --- Inicialización y Event Listeners ---
document.addEventListener('DOMContentLoaded', () => {

    // Comprobar si el input del ID existe antes de añadir el listener y cargar datos
    if (entradaIdFestivalPOS) {
        // Listener para cambios en el ID del festival: recarga datos
        entradaIdFestivalPOS.addEventListener('change', () => {
            // Limpiar errores y datos anteriores antes de cargar los nuevos
            limpiarResultado(divErrorFestival);
            limpiarResultado(divErrorEntradas);
            divDetallesFestival.innerHTML = ''; // Limpiar detalles
            divListaEntradas.innerHTML = ''; // Limpiar lista de tipos
            selectTipoEntradaCompra.innerHTML = '<option value="">Seleccione un tipo...</option>'; // Resetear select
            selectTipoEntradaCompra.disabled = true;
            limpiarResultado(divResultadoPago); // Limpiar resultado de pago anterior

            // Recargar datos con el nuevo ID
            cargarDetallesFestival();
            cargarTiposEntrada();
        });

        // Carga inicial de datos usando el valor por defecto del input
        cargarDetallesFestival();
        cargarTiposEntrada();
    } else {
        // Error crítico si falta el input principal
        console.error("Error crítico: Input #posFestivalId no encontrado en el DOM.");
        if (divErrorFestival) mostrarMensaje(divErrorFestival, "Error: Falta el campo para introducir el ID del festival en la página.", true);
    }

    // Inicializar Stripe (siempre)
    iniciarStripe();
    // Renderizar entradas guardadas (si las hay)
    mostrarEntradasGuardadas();

    // Listeners para formularios y botones (verificar existencia)
    if (formularioPago) {
        formularioPago.addEventListener('submit', manejarEnvioPago);
    } else { console.error("Error: No se encontró formularioPago."); }

    if (formularioNominarEntrada) {
        formularioNominarEntrada.addEventListener('submit', manejarNominarEntrada);
    } else { console.warn("Elemento formularioNominarEntrada no encontrado."); }

    if (botonLimpiarEntradas) {
        botonLimpiarEntradas.addEventListener('click', limpiarEntradasCompradas);
    } else { console.warn("Elemento botonLimpiarEntradas no encontrado."); }
});