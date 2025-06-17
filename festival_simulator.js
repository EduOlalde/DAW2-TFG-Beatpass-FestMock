/**
 * festival_simulator.js
 * Lógica para el simulador de compra y nominación de entradas de festivales.
 * Incluye flujo de pago con Stripe y visualización de entradas con QR.
 *
 */

// --- Configuración ---
const URL_BASE_API = 'https://daw2-tfg-beatpass.onrender.com/api';
//const URL_BASE_API = 'http://localhost:8080/BeatpassTFG/api'; 
const CLAVE_PUBLICABLE_STRIPE = 'pk_test_51RLUyq4Et9Src69RTyKKrqn48wubA5QIbS9zTguw8chLB8FGgwMt9sZV6VwvT4UEWE0vnKxaJCNFlj87EY6i9mGK00ggcR1AiX';

// --- Variables Globales ---
let entradasCompradas = JSON.parse(localStorage.getItem('entradasCompradas') || '[]');
let stripe = null;
let elementoTarjeta = null;

// --- Selectores del DOM ---
const entradaIdFestivalGlobal = document.getElementById('posFestivalId');
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
const textoBotonPago = botonEnviarPago.querySelector('.button-text'); // Corregido: Se busca dentro del botón
const spinnerPago = botonEnviarPago ? botonEnviarPago.querySelector('.spinner') : null;
const divResultadoPago = document.getElementById('payment-result');
const seccionMisEntradas = document.getElementById('my-tickets-section');
const divListaMisEntradas = document.getElementById('my-tickets-list');
const botonLimpiarEntradas = document.getElementById('clear-tickets-button');
const formularioNominarEntrada = document.getElementById('nominate-ticket-form');
const divResultadoNominacion = document.getElementById('nominate-result');

// --- UI ---
function mostrarMensajeUI(elemento, mensaje, esError) {
    if (!elemento) return;
    elemento.innerHTML = `<p>${mensaje}</p>`;
    elemento.className = `message-box visible ${esError ? 'error-message' : 'success-message'}`;
    if (esError) console.error("Mensaje UI (Error):", mensaje);
}

function limpiarMensajeUI(elemento) {
    if (elemento) {
        elemento.innerHTML = '';
        elemento.className = 'message-box';
    }
}

function establecerEstadoCargaBoton(estaCargando, boton, textoElem, spinnerElem) {
    if (!boton) return;
    const textoOriginal = textoElem ? textoElem.dataset.originalText || textoElem.textContent : '';
    if (textoElem && !textoElem.dataset.originalText) textoElem.dataset.originalText = textoOriginal;

    if (estaCargando) {
        boton.disabled = true;
        if (textoElem) textoElem.style.display = 'none';
        if (spinnerElem) spinnerElem.style.display = 'inline-block';
        boton.classList.add('loading');
    } else {
        boton.disabled = false;
        if (textoElem) {
            textoElem.style.display = 'inline';
            textoElem.textContent = textoOriginal;
        }
        if (spinnerElem) spinnerElem.style.display = 'none';
        boton.classList.remove('loading');
    }
}

function obtenerIdFestivalActual() {
    if (!entradaIdFestivalGlobal) return null;
    const idFestival = parseInt(entradaIdFestivalGlobal.value, 10);
    return (isNaN(idFestival) || idFestival <= 0) ? null : idFestival;
}

// --- API ---
async function peticionApi(url, opciones = {}) {
    const cabeceras = { ...(opciones.headers || {}) };
    if (opciones.body) {
        if (typeof opciones.body === 'object' &&
            !(opciones.body instanceof FormData) &&
            !(opciones.body instanceof URLSearchParams)) {
            if (!cabeceras['Content-Type']) {
                cabeceras['Content-Type'] = 'application/json';
            }
            opciones.body = JSON.stringify(opciones.body);
        } else if (opciones.body instanceof URLSearchParams) {
            if (!cabeceras['Content-Type']) {
                cabeceras['Content-Type'] = 'application/x-www-form-urlencoded;charset=UTF-8';
            }
        }
    }
    const opcionesFetch = { ...opciones, headers: cabeceras };

    try {
        const respuesta = await fetch(url, opcionesFetch);
        let datosRespuesta = null;
        const tipoContenido = respuesta.headers.get('content-type');

        if (tipoContenido?.includes('application/json')) {
            try { datosRespuesta = await respuesta.json(); }
            catch (e) { datosRespuesta = await respuesta.text(); }
        } else {
            datosRespuesta = await respuesta.text();
        }

        if (!respuesta.ok) {
            const mensajeError = (typeof datosRespuesta === 'object' && datosRespuesta?.error) ? datosRespuesta.error : (datosRespuesta || `Error ${respuesta.status}`);
            throw new Error(mensajeError);
        }
        return datosRespuesta;
    } catch (error) {
        console.error(`Error en API ${url}:`, error.message);
        throw error;
    }
}

// --- Carga de Datos ---
async function cargarDetallesFestival() {
    limpiarMensajeUI(divErrorFestival);
    divDetallesFestival.textContent = 'Cargando detalles...';
    const idFestival = obtenerIdFestivalActual();
    if (!idFestival) {
        mostrarMensajeUI(divErrorFestival, "ID de festival inválido.", true);
        divDetallesFestival.textContent = ''; return;
    }
    try {
        const festival = await peticionApi(`${URL_BASE_API}/festivales/${idFestival}`);
        if (festival && typeof festival === 'object') {
            divDetallesFestival.innerHTML = `
                <p><strong>Nombre:</strong> ${festival.nombre || 'N/A'}</p>
                <p><strong>Fechas:</strong> ${festival.fechaInicio || 'N/A'} - ${festival.fechaFin || 'N/A'}</p>
                <p><strong>Estado:</strong> <span class="${festival.estado === 'PUBLICADO' ? 'text-green-600' : 'text-red-600'}">${festival.estado || 'N/A'}</span></p>
            `;
        } else mostrarMensajeUI(divErrorFestival, 'Respuesta inesperada del festival.', true);
    } catch (e) { mostrarMensajeUI(divErrorFestival, `Error cargando festival: ${e.message}`, true); }
}

async function cargarTiposEntrada() {
    limpiarMensajeUI(divErrorEntradas);
    divListaEntradas.textContent = 'Cargando entradas...';
    selectTipoEntradaCompra.innerHTML = '<option value="">Cargando...</option>';
    selectTipoEntradaCompra.disabled = true;
    const idFestival = obtenerIdFestivalActual();
    if (!idFestival) {
        mostrarMensajeUI(divErrorEntradas, "ID de festival inválido.", true);
        divListaEntradas.innerHTML = ''; selectTipoEntradaCompra.innerHTML = '<option value="">ID Festival?</option>'; return;
    }
    try {
        const tipos = await peticionApi(`${URL_BASE_API}/festivales/${idFestival}/tipos-entrada`);
        divListaEntradas.innerHTML = ''; selectTipoEntradaCompra.innerHTML = '<option value="">Seleccione tipo...</option>';
        if (Array.isArray(tipos) && tipos.length > 0) {
            let hayDisponibles = false;
            tipos.forEach(e => {
                divListaEntradas.innerHTML += `<div class="border-b pb-2 mb-2"><p><strong>${e.tipo}</strong></p><p class="text-sm">Precio: ${e.precio?.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' }) || 'N/A'} | Stock: ${e.stock ?? 'N/A'}</p></div>`;
                const opt = document.createElement('option');
                opt.value = e.idTipoEntrada;
                opt.textContent = `${e.tipo} (${e.precio?.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}) - Stock: ${e.stock}`;
                opt.disabled = e.stock <= 0;
                if (e.stock > 0) hayDisponibles = true;
                selectTipoEntradaCompra.appendChild(opt);
            });
            selectTipoEntradaCompra.disabled = !hayDisponibles;
            if (!hayDisponibles && tipos.length > 0) selectTipoEntradaCompra.innerHTML = '<option value="">Agotadas</option>';
            else if (!hayDisponibles && tipos.length === 0) selectTipoEntradaCompra.innerHTML = '<option value="">No hay entradas</option>';

        } else {
            divListaEntradas.innerHTML = '<p>No hay tipos de entrada.</p>';
            selectTipoEntradaCompra.innerHTML = '<option value="">No hay entradas</option>';
            selectTipoEntradaCompra.disabled = true;
        }
    } catch (e) { mostrarMensajeUI(divErrorEntradas, `Error cargando entradas: ${e.message}`, true); }
}

// --- Stripe ---
function iniciarStripe() {
    if (!CLAVE_PUBLICABLE_STRIPE || CLAVE_PUBLICABLE_STRIPE.startsWith('pk_test_TU_CLAVE')) {
        mostrarMensajeUI(divResultadoPago, "Error: Clave Stripe no configurada.", true);
        if (botonEnviarPago) botonEnviarPago.disabled = true; return;
    }
    try {
        stripe = Stripe(CLAVE_PUBLICABLE_STRIPE);
        elementoTarjeta = stripe.elements().create('card', { style: { base: { fontSize: '16px' } } });
        if (contenedorElementoTarjeta) elementoTarjeta.mount('#card-element');
        else throw new Error("Contenedor Stripe #card-element no encontrado.");
        elementoTarjeta.on('change', e => { if (divErroresTarjeta) divErroresTarjeta.textContent = e.error ? e.error.message : ''; });
    } catch (e) { mostrarMensajeUI(divResultadoPago, `Error Stripe: ${e.message}.`, true); if (botonEnviarPago) botonEnviarPago.disabled = true; }
}

// --- Pago ---
async function manejarEnvioPago(evento) {
    evento.preventDefault();
    establecerEstadoCargaBoton(true, botonEnviarPago, textoBotonPago, spinnerPago);
    limpiarMensajeUI(divResultadoPago); if (divErroresTarjeta) divErroresTarjeta.textContent = '';

    if (!stripe || !elementoTarjeta) {
        mostrarMensajeUI(divResultadoPago, "Error: Sistema de pago no listo.", true);
        establecerEstadoCargaBoton(false, botonEnviarPago, textoBotonPago, spinnerPago); return;
    }

    const idFestival = obtenerIdFestivalActual();
    const idTipoEntrada = selectTipoEntradaCompra.value;
    const cantidad = parseInt(entradaCantidadCompra.value, 10);
    const email = entradaEmailCompra.value;
    const nombre = entradaNombreCompra.value;

    if (!idFestival || !idTipoEntrada || !cantidad || !email || !nombre) {
        mostrarMensajeUI(divResultadoPago, "Complete todos los campos.", true);
        establecerEstadoCargaBoton(false, botonEnviarPago, textoBotonPago, spinnerPago); return;
    }

    try {
        const respPago = await peticionApi(`${URL_BASE_API}/public/venta/iniciar-pago`, {
            method: 'POST',
            body: { idEntrada: parseInt(idTipoEntrada), cantidad: cantidad },
        });
        if (!respPago?.clientSecret) throw new Error("No se recibió client_secret.");

        const { error: errStripe, paymentIntent: pIntent } = await stripe.confirmCardPayment(
            respPago.clientSecret, { payment_method: { card: elementoTarjeta } }
        );
        if (errStripe) throw new Error(errStripe.message);

        if (pIntent?.status === 'succeeded') {
            const datosConf = new URLSearchParams({
                idEntrada: idTipoEntrada,
                cantidad: cantidad.toString(),
                emailComprador: email,
                nombreComprador: nombre,
                telefonoComprador: entradaTelefonoCompra.value || '',
                paymentIntentId: pIntent.id
            });
            const compraConf = await peticionApi(`${URL_BASE_API}/public/venta/confirmar-compra`, { method: 'POST', body: datosConf });
            mostrarMensajeUI(divResultadoPago, `Compra OK! ID: ${compraConf.idCompra}.`, false);

            if (Array.isArray(compraConf.entradasGeneradas)) {
                const nuevas = await Promise.all(compraConf.entradasGeneradas.map(async dto => ({
                    ...dto, urlDatosImagenQr: await generarUrlDatosQr(dto.codigoQr), estadoVisual: ''
                })));
                entradasCompradas.push(...nuevas);
                localStorage.setItem('entradasCompradas', JSON.stringify(entradasCompradas));
                mostrarEntradasGuardadas();
            }
            if (formularioPago) formularioPago.reset(); if (elementoTarjeta) elementoTarjeta.clear();
            cargarTiposEntrada();
        } else throw new Error(`Pago no completado (Estado: ${pIntent?.status || 'desconocido'}).`);
    } catch (e) { mostrarMensajeUI(divResultadoPago, `Error compra: ${e.message}`, true); }
    finally { establecerEstadoCargaBoton(false, botonEnviarPago, textoBotonPago, spinnerPago); }
}

// --- Nominación ---
async function manejarNominarEntrada(evento) {
    evento.preventDefault();
    limpiarMensajeUI(divResultadoNominacion);
    const datosForm = new FormData(formularioNominarEntrada);
    const cuerpo = new URLSearchParams(datosForm);
    const btn = formularioNominarEntrada.querySelector('button[type="submit"]');
    if (btn) { btn.disabled = true; btn.textContent = 'Nominando...'; }

    try {
        const res = await peticionApi(`${URL_BASE_API}/public/venta/nominar`, { method: 'POST', body: cuerpo });
        mostrarMensajeUI(divResultadoNominacion, res.mensaje || 'Nominación OK.', false);
        if (formularioNominarEntrada) formularioNominarEntrada.reset();
        actualizarEstadoEntradaComprada(datosForm.get('codigoQr'), 'Nominada', {
            nombreNominado: datosForm.get('nombreNominado'), emailNominado: datosForm.get('emailNominado')
        });
    } catch (e) { mostrarMensajeUI(divResultadoNominacion, `Error nominando: ${e.message}`, true); }
    finally { if (btn) { btn.disabled = false; btn.textContent = 'Nominar Entrada'; } }
}

// --- Entradas Compradas (UI) ---
async function generarUrlDatosQr(texto) {
    if (typeof qrcode === 'undefined') { console.error("qrcode-generator no cargado."); return null; }
    if (!texto) return null;
    try {
        const qr = qrcode(0, 'M'); qr.addData(texto); qr.make();
        return qr.createDataURL(4, 2);
    } catch (e) { console.error("Error generando QR:", e); return null; }
}

async function mostrarEntradasGuardadas() {
    if (!divListaMisEntradas || !seccionMisEntradas) return;
    divListaMisEntradas.innerHTML = '';
    if (entradasCompradas.length === 0) { seccionMisEntradas.style.display = 'none'; return; }
    seccionMisEntradas.style.display = 'block';

    const promesasTarjetas = entradasCompradas.map(async (e) => {
        if (!e.urlDatosImagenQr && e.codigoQr) {
            e.urlDatosImagenQr = await generarUrlDatosQr(e.codigoQr);
        }
        return `
            <div class="ticket-card grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
                <div class="md:col-span-2 space-y-1">
                    <p><strong>ID:</strong> ${e.idEntrada || 'N/A'}</p>
                    <p><strong>Tipo:</strong> ${e.tipoEntradaOriginal || 'N/A'}</p>
                    <p><strong>QR:</strong> <input type="text" value="${e.codigoQr || 'N/A'}" readonly class="text-xs font-mono bg-gray-100 px-1 py-0.5 rounded border w-full mt-0.5" onclick="this.select();document.execCommand('copy');"></p>
                    <p><strong>Estado:</strong> ${e.estado || 'N/A'} <span class="font-semibold">${e.estadoVisual || ''}</span></p>
                    ${e.nombreAsistente ? `<p><strong>Nominada:</strong> ${e.nombreAsistente} (${e.emailAsistente || 'N/A'})</p>` : '<p class="italic">Pendiente nominar</p>'}
                </div>
                <div>${e.urlDatosImagenQr ? `<img src="${e.urlDatosImagenQr}" alt="QR" class="qr-image-display w-24 h-24">` : ''}</div>
            </div>`;
    });
    divListaMisEntradas.innerHTML = (await Promise.all(promesasTarjetas)).join('');
}

function limpiarEntradasCompradas() {
    if (confirm('¿Borrar entradas de simulación?')) {
        entradasCompradas = [];
        localStorage.removeItem('entradasCompradas');
        mostrarEntradasGuardadas();
    }
}

function actualizarEstadoEntradaComprada(codigoQr, estadoVisual, datosNominado = null) {
    let encontrado = false;
    entradasCompradas = entradasCompradas.map(e => {
        if (e.codigoQr === codigoQr) {
            encontrado = true;
            const actualizada = { ...e, estadoVisual: `(${estadoVisual})` };
            if (datosNominado) {
                actualizada.nombreAsistente = datosNominado.nombreNominado;
                actualizada.emailAsistente = datosNominado.emailNominado;
            }
            return actualizada;
        }
        return e;
    });
    if (encontrado) {
        localStorage.setItem('entradasCompradas', JSON.stringify(entradasCompradas));
        mostrarEntradasGuardadas();
    }
}

// --- Inicialización ---
document.addEventListener('DOMContentLoaded', () => {
    if (entradaIdFestivalGlobal) {
        entradaIdFestivalGlobal.addEventListener('change', () => {
            limpiarMensajeUI(divErrorFestival); limpiarMensajeUI(divErrorEntradas);
            divDetallesFestival.innerHTML = ''; divListaEntradas.innerHTML = '';
            selectTipoEntradaCompra.innerHTML = '<option value="">Seleccione...</option>';
            selectTipoEntradaCompra.disabled = true; limpiarMensajeUI(divResultadoPago);
            cargarDetallesFestival(); cargarTiposEntrada();
        });
        cargarDetallesFestival(); cargarTiposEntrada();
    }

    iniciarStripe();
    mostrarEntradasGuardadas();

    if (formularioPago) formularioPago.addEventListener('submit', manejarEnvioPago);
    if (formularioNominarEntrada) formularioNominarEntrada.addEventListener('submit', manejarNominarEntrada);
    if (botonLimpiarEntradas) botonLimpiarEntradas.addEventListener('click', limpiarEntradasCompradas);
});