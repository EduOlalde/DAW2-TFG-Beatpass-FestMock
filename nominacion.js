/**
 * nominar_entrada_simulador.js
 * Lógica para el simulador de nominación de entradas.
 * Permite la entrada manual de códigos QR, escaneo mediante cámara y envío a API.
 */

// --- Configuración ---
// Asegúrate de que esta URL base sea la correcta para tu entorno de backend.
const URL_BASE_API = 'https://daw2-tfg-beatpass.onrender.com/api'; 
//const URL_BASE_API = 'http://localhost:8888/BeatpassTFG/api'; 

// --- Variables Globales ---
let currentQrStream = null; // Stream de la cámara para el escáner QR
let qrAnimationId = null; // ID para requestAnimationFrame del escáner QR

// --- Selectores del DOM ---
const qrForm = document.getElementById('qr-form');
const codigoQrManualInput = document.getElementById('codigoQrManual');
const scanQrButton = document.getElementById('scanQrButton');
const qrScannerContainer = document.getElementById('qrScannerContainer');
const qrVideo = document.getElementById('qrVideo');
const stopScanQrButton = document.getElementById('stopScanQrButton');
const statusQrScan = document.getElementById('statusQrScan');

const nominationForm = document.getElementById('nomination-form');
const codigoQrHiddenInput = document.getElementById('codigoQr'); // Input oculto en el form de nominación
const nombreNominadoInput = document.getElementById('nombreNominado');
const emailNominadoInput = document.getElementById('emailNominado');
const confirmEmailNominadoInput = document.getElementById('confirmEmailNominado');
const telefonoNominadoInput = document.getElementById('telefonoNominado');
const submitNominationButton = document.getElementById('submitNominationButton');
const nominationResultDiv = document.getElementById('nominationResult');

// --- UI Helper Functions ---
function mostrarMensajeUI(elemento, mensaje, esError) {
    if (!elemento) return;
    elemento.innerHTML = `<p>${mensaje}</p>`; // Usar innerHTML para permitir mensajes con formato si es necesario
    elemento.className = `message-box card visible ${esError ? 'error-message' : 'success-message'}`;
    elemento.style.display = 'block';
    if (esError) console.error("Mensaje UI (Error):", mensaje);
}

function limpiarMensajeUI(elemento) {
    if (elemento) {
        elemento.innerHTML = '';
        elemento.style.display = 'none';
        elemento.className = 'message-box card'; // Reset class
    }
}

function setButtonLoadingState(button, isLoading) {
    const buttonText = button.querySelector('.button-text');
    const spinner = button.querySelector('.spinner');

    if (isLoading) {
        button.disabled = true;
        if (buttonText) buttonText.style.display = 'none';
        if (spinner) spinner.style.display = 'inline-block';
        button.classList.add('loading');
    } else {
        button.disabled = false;
        if (buttonText) buttonText.style.display = 'inline';
        if (spinner) spinner.style.display = 'none';
        button.classList.remove('loading');
    }
}

function mostrarEstadoScanQR(mensaje, tipo = 'info') {
    if (statusQrScan) {
        statusQrScan.textContent = String(mensaje);
        statusQrScan.className = `scan-status ${tipo}`; // Asegúrate que 'info', 'success', 'error' estén en estilos.css
    }
}

// --- Lógica de Escaneo QR (adaptada de pos.js) ---
async function iniciarEscaneoQR() {
    if (!navigator.mediaDevices?.getUserMedia) {
        mostrarEstadoScanQR("La cámara no es compatible con este navegador.", 'error');
        return;
    }
    if (!window.jsQR) {
        mostrarEstadoScanQR("La librería de escaneo QR (jsQR) no se cargó correctamente.", 'error');
        return;
    }

    detenerEscaneoQR(); // Detener cualquier stream previo
    setButtonLoadingState(scanQrButton, true);

    try {
        currentQrStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
        qrVideo.srcObject = currentQrStream;
        await qrVideo.play(); // Esperar a que el video comience a reproducirse

        qrScannerContainer.style.display = 'block';
        mostrarEstadoScanQR("Escaneando QR... Apunta la cámara al código.", 'info');
        stopScanQrButton.style.display = 'block'; // Mostrar botón de detener

        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d', { willReadFrequently: true });

        function tick() {
            if (qrVideo.readyState === qrVideo.HAVE_ENOUGH_DATA && qrVideo.videoWidth > 0) {
                canvas.height = qrVideo.videoHeight;
                canvas.width = qrVideo.videoWidth;
                context.drawImage(qrVideo, 0, 0, canvas.width, canvas.height);
                const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
                const code = jsQR(imageData.data, imageData.width, imageData.height, {
                    inversionAttempts: "dontInvert", // "dontInvert" es default, "attemptBoth" o "invertFirst" pueden ayudar
                });

                if (code && code.data) {
                    codigoQrManualInput.value = code.data; // Poner el QR en el campo manual
                    codigoQrHiddenInput.value = code.data; // Y en el campo oculto del form de nominación
                    mostrarEstadoScanQR(`QR Detectado: ${code.data.substring(0, 30)}...`, 'success');
                    detenerEscaneoQR();
                    qrScannerContainer.style.display = 'none';
                }
            }
            if (currentQrStream) { // Solo continuar si el stream está activo
                qrAnimationId = requestAnimationFrame(tick);
            }
        }
        qrAnimationId = requestAnimationFrame(tick);

    } catch (err) {
        let msg = "Error al acceder a la cámara.";
        if (err.name === "NotAllowedError") msg = "Permiso para usar la cámara denegado.";
        else if (err.name === "NotFoundError") msg = "No se encontró una cámara compatible.";
        else if (err.name === "NotReadableError") msg = "La cámara ya está en uso o no se puede leer.";
        console.error("Error de cámara:", err);
        mostrarEstadoScanQR(msg, 'error');
        detenerEscaneoQR();
        qrScannerContainer.style.display = 'none';
    } finally {
        setButtonLoadingState(scanQrButton, false);
    }
}

function detenerEscaneoQR() {
    if (qrAnimationId) {
        cancelAnimationFrame(qrAnimationId);
        qrAnimationId = null;
    }
    if (currentQrStream) {
        currentQrStream.getTracks().forEach(track => track.stop());
        currentQrStream = null;
    }
    if (qrVideo) {
        qrVideo.srcObject = null;
    }
    // No ocultar qrScannerContainer aquí, se maneja donde se llama a detener.
    // mostrarEstadoScanQR("Escáner detenido.", 'info'); // Opcional: mensaje al detener manualmente
    stopScanQrButton.style.display = 'none';
}


// --- Lógica de Nominación ---
async function manejarNominacion(event) {
    event.preventDefault();
    limpiarMensajeUI(nominationResultDiv);
    setButtonLoadingState(submitNominationButton, true);

    // Tomar el valor del QR del campo manual, ya que el escáner también lo actualiza ahí.
    const codigoQrValue = codigoQrManualInput.value.trim();
    if (!codigoQrValue) {
        mostrarMensajeUI(nominationResultDiv, "El código QR de la entrada es obligatorio. Introdúcelo manualmente o escanéalo.", true);
        setButtonLoadingState(submitNominationButton, false);
        return;
    }
    // Actualizar el campo oculto por si acaso se editó manualmente el visible
    codigoQrHiddenInput.value = codigoQrValue;


    const formData = new FormData(nominationForm);
    const formProps = Object.fromEntries(formData); // Para facilitar el acceso a los datos

    if (formProps.emailNominado !== formProps.confirmEmailNominado) {
        mostrarMensajeUI(nominationResultDiv, "Los emails introducidos no coinciden. Por favor, verifica.", true);
        setButtonLoadingState(submitNominationButton, false);
        return;
    }

    // Validaciones adicionales de campos si es necesario (longitud, formato, etc.)
    if (!formProps.nombreNominado || !formProps.emailNominado) {
        mostrarMensajeUI(nominationResultDiv, "Nombre y Email del nominado son obligatorios.", true);
        setButtonLoadingState(submitNominationButton, false);
        return;
    }


    try {
        const response = await fetch(`${URL_BASE_API}/public/venta/nominar`, {
            method: 'POST',
            body: new URLSearchParams(formData) // Enviar como x-www-form-urlencoded
            // redirect: 'follow' // es el comportamiento por defecto de fetch
        });

        // La API redirige, así que response.url será la URL final.
        // Los mensajes de éxito/error están en los query params de la URL final.
        const finalUrl = new URL(response.url);
        const successMessage = finalUrl.searchParams.get('successMessage');
        const errorMessageFromQuery = finalUrl.searchParams.get('error'); // 'error' es el nombre del param en tu API

        if (response.ok && successMessage) {
            mostrarMensajeUI(nominationResultDiv, successMessage, false);
            nominationForm.reset(); // Limpiar formulario en éxito
            codigoQrManualInput.value = ''; // Limpiar también el QR manual
            codigoQrHiddenInput.value = '';
        } else if (errorMessageFromQuery) {
            mostrarMensajeUI(nominationResultDiv, errorMessageFromQuery, true);
        } else {
            // Si no hay query params específicos, pero la respuesta no fue OK (ej. error 500 antes de redirigir)
            // o si la página redirigida no tiene los parámetros esperados.
            const responseText = await response.text(); // El cuerpo podría ser HTML de una página de error
            console.error("Respuesta del servidor (inesperada):", responseText);
            mostrarMensajeUI(nominationResultDiv, "Error al nominar la entrada. Respuesta inesperada del servidor.", true);
        }

    } catch (error) {
        console.error('Error en la petición de nominación:', error);
        mostrarMensajeUI(nominationResultDiv, `Error de red o conexión al intentar nominar: ${error.message}`, true);
    } finally {
        setButtonLoadingState(submitNominationButton, false);
    }
}


// --- Inicialización y Event Listeners ---
document.addEventListener('DOMContentLoaded', () => {
    if (scanQrButton) {
        scanQrButton.addEventListener('click', iniciarEscaneoQR);
    }
    if (stopScanQrButton) {
        stopScanQrButton.addEventListener('click', () => {
            detenerEscaneoQR();
            qrScannerContainer.style.display = 'none'; // Ocultar el contenedor del video
            mostrarEstadoScanQR("Escáner detenido por el usuario.", 'info');
        });
    }
    if (nominationForm) {
        nominationForm.addEventListener('submit', manejarNominacion);
    }

    // Sincronizar el input manual del QR con el hidden input del form de nominación
    if (codigoQrManualInput && codigoQrHiddenInput) {
        codigoQrManualInput.addEventListener('input', (event) => {
            codigoQrHiddenInput.value = event.target.value;
        });
    }

    // Comprobaciones de compatibilidad (opcional, para informar al usuario)
    if (!navigator.mediaDevices?.getUserMedia) {
        console.warn("getUserMedia API (cámara) no es compatible con este navegador.");
        mostrarEstadoScanQR("La función de escaneo con cámara puede no estar disponible en este navegador.", 'warning');
    }
    if (!window.jsQR) {
        console.warn("Librería jsQR no cargada. El escáner QR no funcionará.");
        mostrarEstadoScanQR("Error al cargar el componente de escaneo QR.", 'error');
    }
});
