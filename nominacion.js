/**
 * nominacion.js
 * Lógica para la página de nominación de entradas.
 * Incluye escaneo de QR y envío de datos de nominación.
 */

// --- Configuración ---
const URL_BASE_API = 'https://daw2-tfg-beatpass.onrender.com/api'; // URL de producción
//const URL_BASE_API = 'http://localhost:8888/BeatpassTFG/api'; // Para desarrollo local

// --- Variables Globales para el Escáner QR ---
let currentQrStream = null;
let qrAnimationId = null;

// --- Selectores del DOM ---
const nominationForm = document.getElementById('nominate-ticket-form-standalone');
const qrCodeInput = document.getElementById('nominate-qr');
const scanQrButton = document.getElementById('scanQrButton');
const qrScannerContainer = document.getElementById('qrScannerContainer');
const qrVideoElement = document.getElementById('qrVideo');
const stopScanQrButton = document.getElementById('stopScanQrButton');
const qrScanStatusElement = document.getElementById('qrScanStatus');
const nominationResultElement = document.getElementById('nominate-result');
const submitButton = document.getElementById('submit-nomination-button');
const buttonTextElement = submitButton ? submitButton.querySelector('.button-text') : null;
const spinnerElement = submitButton ? submitButton.querySelector('.spinner') : null;


// --- UI ---
/**
 * Muestra un mensaje en un elemento de la UI.
 * @param {HTMLElement} elemento El elemento donde mostrar el mensaje.
 * @param {string} mensaje El mensaje a mostrar.
 * @param {boolean} esError True si es un mensaje de error, false si es de éxito/informativo.
 */
function mostrarMensajeUI(elemento, mensaje, esError) {
    if (!elemento) return;
    elemento.innerHTML = `<p>${mensaje}</p>`; // Usar innerHTML para permitir etiquetas si es necesario.

    // Limpiar clases previas y establecer las nuevas
    elemento.className = 'message-box'; // Clase base
    if (esError) {
        elemento.classList.add('error-message');
    } else {
        elemento.classList.add('success-message');
    }
    elemento.classList.add('visible'); // Clase para controlar visibilidad vía CSS

    // Asegurar que el elemento sea visible (CSS debería manejar esto con .visible)
    // pero una asignación directa de estilo lo refuerza.
    elemento.style.display = 'block';

    if (esError) {
        console.error("Mensaje UI (Error):", mensaje);
    } else {
        console.log("Mensaje UI (Éxito/Info):", mensaje);
    }
}

/**
 * Limpia un mensaje de un elemento de la UI y lo oculta.
 * @param {HTMLElement} elemento El elemento del mensaje a limpiar.
 */
function limpiarMensajeUI(elemento) {
    if (elemento) {
        elemento.innerHTML = '';
        elemento.className = 'message-box'; // Restablecer a clase base
        elemento.style.display = 'none';    // Ocultar explícitamente
    }
}

function establecerEstadoCargaBoton(estaCargando, boton, textoElem, spinnerElem) {
    if (!boton || !textoElem || !spinnerElem) return;
    const textoOriginal = textoElem.dataset.originalText || textoElem.textContent;
    if (!textoElem.dataset.originalText) {
        textoElem.dataset.originalText = textoOriginal;
    }

    if (estaCargando) {
        boton.disabled = true;
        textoElem.style.display = 'none';
        spinnerElem.style.display = 'inline-block';
        boton.classList.add('loading');
    } else {
        boton.disabled = false;
        textoElem.style.display = 'inline';
        // textoElem.textContent = textoOriginal; // No es necesario si el texto no cambia
        spinnerElem.style.display = 'none';
        boton.classList.remove('loading');
    }
}

function mostrarEstadoScanQR(mensaje, tipo = 'info') {
    if (qrScanStatusElement) {
        qrScanStatusElement.textContent = String(mensaje);
        qrScanStatusElement.className = `scan-status ${tipo}`; // Clases: info, success, warning, error
    }
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

// --- Escáner QR ---
async function iniciarEscaneoQR() {
    if (!navigator.mediaDevices?.getUserMedia) {
        mostrarEstadoScanQR("La cámara no es compatible con este navegador.", 'error');
        return;
    }
    if (!window.jsQR) {
        mostrarEstadoScanQR("La librería de escaneo QR (jsQR) no se cargó correctamente.", 'error');
        return;
    }

    detenerEscaneoQRPrevio();

    try {
        currentQrStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
        qrVideoElement.srcObject = currentQrStream;
        qrVideoElement.onloadedmetadata = () => {
            qrVideoElement.play().catch(e => console.error("Error al reproducir video:", e));
        };
        qrScannerContainer.style.display = 'block';
        scanQrButton.disabled = true;
        stopScanQrButton.disabled = false;
        mostrarEstadoScanQR("Apunte la cámara al código QR...", 'info');

        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d', { willReadFrequently: true });

        function tick() {
            if (qrVideoElement.readyState === qrVideoElement.HAVE_ENOUGH_DATA && currentQrStream) {
                canvas.height = qrVideoElement.videoHeight;
                canvas.width = qrVideoElement.videoWidth;
                if (canvas.width > 0 && canvas.height > 0) {
                    context.drawImage(qrVideoElement, 0, 0, canvas.width, canvas.height);
                    const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
                    const code = jsQR(imageData.data, imageData.width, imageData.height, {
                        inversionAttempts: "dontInvert",
                    });
                    if (code && code.data) {
                        qrCodeInput.value = code.data;
                        mostrarEstadoScanQR(`QR Detectado: ${code.data.substring(0, 30)}...`, 'success');
                        detenerEscaneoQR();
                    }
                }
            }
            if (currentQrStream) {
                qrAnimationId = requestAnimationFrame(tick);
            }
        }
        qrAnimationId = requestAnimationFrame(tick);
    } catch (err) {
        let msg = "Error al acceder a la cámara.";
        if (err.name === "NotAllowedError") msg = "Permiso para usar la cámara denegado.";
        else if (err.name === "NotFoundError") msg = "No se encontró una cámara compatible.";
        else if (err.name === "NotReadableError") msg = "La cámara está siendo utilizada por otra aplicación o sistema.";
        mostrarEstadoScanQR(msg, 'error');
        console.error("Error detallado de cámara:", err);
        detenerEscaneoQR();
    }
}

function detenerEscaneoQRPrevio() {
    if (qrAnimationId) {
        cancelAnimationFrame(qrAnimationId);
        qrAnimationId = null;
    }
    if (currentQrStream) {
        currentQrStream.getTracks().forEach(track => track.stop());
        currentQrStream = null;
    }
    if (qrVideoElement) {
        qrVideoElement.srcObject = null;
    }
}


function detenerEscaneoQR() {
    detenerEscaneoQRPrevio();
    qrScannerContainer.style.display = 'none';
    scanQrButton.disabled = false;
    stopScanQrButton.disabled = true;
    // Solo actualizar el mensaje si no se detectó un QR o si estaba en estado "Apunte..."
    if (qrScanStatusElement && (qrScanStatusElement.textContent.includes("Apunte la cámara") || qrScanStatusElement.textContent === "" || !qrScanStatusElement.classList.contains('success'))) {
        mostrarEstadoScanQR("Escaneo detenido por el usuario.", 'info');
    }
}


// --- Nominación ---
async function manejarNominacion(evento) {
    evento.preventDefault();
    limpiarMensajeUI(nominationResultElement); // Limpiar mensajes previos de nominación
    establecerEstadoCargaBoton(true, submitButton, buttonTextElement, spinnerElement);

    const formData = new FormData(nominationForm);
    const cuerpoPeticion = new URLSearchParams();

    // Validaciones básicas
    const codigoQr = formData.get('codigoQr');
    const emailNominado = formData.get('emailNominado');
    const nombreNominado = formData.get('nombreNominado');

    if (!codigoQr || !emailNominado || !nombreNominado) {
        mostrarMensajeUI(nominationResultElement, "El código QR, el email y el nombre del nominado son obligatorios.", true);
        establecerEstadoCargaBoton(false, submitButton, buttonTextElement, spinnerElement);
        return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(emailNominado)) {
        mostrarMensajeUI(nominationResultElement, "Por favor, introduce un email válido para el nominado.", true);
        establecerEstadoCargaBoton(false, submitButton, buttonTextElement, spinnerElement);
        return;
    }

    for (const [key, value] of formData.entries()) {
        cuerpoPeticion.append(key, value);
    }

    try {
        const respuesta = await peticionApi(`${URL_BASE_API}/public/venta/nominar`, {
            method: 'POST',
            body: cuerpoPeticion,
        });
        mostrarMensajeUI(nominationResultElement, respuesta.mensaje || 'Entrada nominada correctamente.', false);
        nominationForm.reset();
        limpiarMensajeUI(qrScanStatusElement); // Limpiar estado del escáner QR
    } catch (error) {
        mostrarMensajeUI(nominationResultElement, `Error al nominar: ${error.message}`, true);
    } finally {
        establecerEstadoCargaBoton(false, submitButton, buttonTextElement, spinnerElement);
    }
}

// --- Inicialización ---
document.addEventListener('DOMContentLoaded', () => {
    // Comprobar que todos los elementos críticos del DOM existen
    if (!nominationForm || !scanQrButton || !stopScanQrButton || !qrVideoElement ||
        !qrScannerContainer || !qrCodeInput || !qrScanStatusElement ||
        !nominationResultElement || !submitButton || !buttonTextElement || !spinnerElement) {
        console.error("Error crítico: No se encontraron todos los elementos del DOM necesarios para la página de nominación.");
        // Opcionalmente, mostrar un mensaje al usuario en la propia página
        const body = document.querySelector('body');
        if (body) {
            const errorDiv = document.createElement('div');
            errorDiv.textContent = "Error: La página de nominación no pudo cargarse completamente. Algunos elementos faltan.";
            errorDiv.style.color = "red";
            errorDiv.style.backgroundColor = "#fdd";
            errorDiv.style.border = "1px solid red";
            errorDiv.style.padding = "10px";
            errorDiv.style.margin = "10px";
            errorDiv.style.textAlign = "center";
            errorDiv.style.fontWeight = "bold";
            body.prepend(errorDiv); // Añadir al principio del body
        }
        return; // Detener la ejecución si faltan elementos clave
    }

    nominationForm.addEventListener('submit', manejarNominacion);
    scanQrButton.addEventListener('click', iniciarEscaneoQR);
    stopScanQrButton.addEventListener('click', detenerEscaneoQR);
    stopScanQrButton.disabled = true; // Botón de detener escaneo inicialmente deshabilitado
});
