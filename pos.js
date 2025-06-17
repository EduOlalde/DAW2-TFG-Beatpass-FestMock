const URL_BASE_API = 'https://daw2-tfg-beatpass.onrender.com/api';
//const URL_BASE_API = 'http://localhost:8888/BeatpassTFG/api'; // Para desarrollo local
let tokenJwt = null;
let currentQrStream = null; // Stream de la cámara para el escáner QR
let qrAnimationId = null; // ID para requestAnimationFrame del escáner QR

// --- Selectores del DOM ---
const formularioLogin = document.getElementById('loginForm');
const estadoLogin = document.getElementById('loginStatus');
const botonCerrarSesion = document.getElementById('logoutButton');
const divOperacionesTPV = document.getElementById('posOperations');
const areaResultadoGeneral = document.getElementById('resultArea');
const formularioConsultarSaldo = document.getElementById('checkBalanceForm');
const formularioRecarga = document.getElementById('rechargeForm');
const formularioConsumo = document.getElementById('consumeForm');
const entradaIdFestivalTPV = document.getElementById('posFestivalId');

const divResultadoConsulta = document.getElementById('consultaResult');
const divResultadoRecarga = document.getElementById('recargaResult');
const divResultadoConsumo = document.getElementById('consumoResult');

// NFC
const btnScanNfcCheck = document.getElementById('scanNfcCheck');
const inputCheckUid = document.getElementById('checkUid');
const statusCheckNfc = document.getElementById('nfcStatusCheck');
const btnScanRecharge = document.getElementById('scanNfcRecharge');
const inputRechargeUid = document.getElementById('rechargeUid');
const statusRechargeNfc = document.getElementById('nfcStatusRecharge');
const btnScanConsume = document.getElementById('scanNfcConsume');
const inputConsumeUid = document.getElementById('consumeUid');
const statusConsumeNfc = document.getElementById('nfcStatusConsume');

// Asociar Pulsera
const formularioAsociarPulsera = document.getElementById('asociarPulseraForm');
const inputAsociarQrEntrada = document.getElementById('asociarQrEntrada');
const inputAsociarUidPulsera = document.getElementById('asociarUidPulsera');
const btnScanNfcAsociar = document.getElementById('scanNfcAsociar');
const statusNfcAsociar = document.getElementById('nfcStatusAsociar');
const divResultadoAsociar = document.getElementById('asociarResult');

// Escáner QR Entrada (Asociar Pulsera)
const btnScanQrEntrada = document.getElementById('scanQrEntradaButton');
const qrScannerEntradaContainer = document.getElementById('qrScannerEntradaContainer');
const videoQrEntrada = document.getElementById('qrVideoEntrada');
const btnStopScanQrEntrada = document.getElementById('stopScanQrEntradaButton');
const statusQrEntradaScan = document.getElementById('statusQrEntradaScan');

// --- Gestión del Token ---
function almacenarToken(token) {
    tokenJwt = token;
    localStorage.setItem('tokenJwt', token);
    actualizarEstadoLogin(true);
}

function limpiarToken() {
    tokenJwt = null;
    localStorage.removeItem('tokenJwt');
    actualizarEstadoLogin(false);
}

function cargarToken() {
    const tokenAlmacenado = localStorage.getItem('tokenJwt');
    if (tokenAlmacenado) {
        tokenJwt = tokenAlmacenado;
        actualizarEstadoLogin(true);
    } else {
        actualizarEstadoLogin(false);
    }
}

// --- UI ---
function actualizarEstadoLogin(sesionIniciada) {
    if (sesionIniciada) {
        estadoLogin.textContent = 'Autenticado';
        estadoLogin.className = 'success';
        divOperacionesTPV.style.display = 'block';
        botonCerrarSesion.style.display = 'inline-block';
        if (formularioLogin) formularioLogin.style.display = 'none';
    } else {
        estadoLogin.textContent = 'No autenticado';
        estadoLogin.className = 'error';
        divOperacionesTPV.style.display = 'none';
        botonCerrarSesion.style.display = 'none';
        if (formularioLogin) formularioLogin.style.display = 'block';
        limpiarResultadosEspecificos();
        limpiarEstadosNFC();
        limpiarEstadosScanQR();
        areaResultadoGeneral.innerHTML = 'Esperando acciones...';
        areaResultadoGeneral.className = '';
    }
}

function mostrarResultadoGeneral(datos, esError = false) {
    areaResultadoGeneral.innerHTML = '';
    const contenido = document.createElement('pre');
    contenido.textContent = typeof datos === 'object' ? JSON.stringify(datos, null, 2) : String(datos);
    areaResultadoGeneral.appendChild(contenido);
    areaResultadoGeneral.className = esError ? 'error' : 'success';
    // Log en consola para depuración
    if (esError) console.error("API Response (Error):", datos); else console.log("API Response (Success):", datos);
}

function mostrarResultadoEspecifico(divDestino, mensaje, esError) {
    if (divDestino) {
        divDestino.textContent = String(mensaje);
        divDestino.className = `section-result visible ${esError ? 'error' : 'success'}`;
    }
}

function mostrarEstadoNFC(divDestino, mensaje, tipo = 'info') {
    if (divDestino) {
        divDestino.textContent = String(mensaje);
        divDestino.className = `nfc-status ${tipo}`;
    }
}

function mostrarEstadoScanQR(divDestino, mensaje, tipo = 'info') {
    if (divDestino) {
        divDestino.textContent = String(mensaje);
        divDestino.className = `scan-status ${tipo}`;
    }
}

function limpiarResultadosEspecificos() {
    [divResultadoConsulta, divResultadoRecarga, divResultadoConsumo, divResultadoAsociar].forEach(div => {
        if (div) {
            div.textContent = '';
            div.className = 'section-result';
        }
    });
}

function limpiarEstadosNFC() {
    [statusCheckNfc, statusRechargeNfc, statusConsumeNfc, statusNfcAsociar].forEach(div => {
        if (div) {
            div.textContent = '';
            div.className = 'nfc-status';
        }
    });
}

function limpiarEstadosScanQR() {
    if (statusQrEntradaScan) {
        statusQrEntradaScan.textContent = '';
        statusQrEntradaScan.className = 'scan-status';
    }
    if (qrScannerEntradaContainer) qrScannerEntradaContainer.style.display = 'none';
}

// --- API ---
async function peticionApiConAutenticacion(url, opciones = {}) {
    const cabeceras = { ...(opciones.headers || {}) };
    if (tokenJwt) {
        cabeceras['Authorization'] = `Bearer ${tokenJwt}`;
    }
    if (opciones.body) {
        if (opciones.body instanceof URLSearchParams) {
            if (!cabeceras['Content-Type']) cabeceras['Content-Type'] = 'application/x-www-form-urlencoded;charset=UTF-8';
        } else if (typeof opciones.body === 'object' && !(opciones.body instanceof FormData)) {
            if (!cabeceras['Content-Type']) cabeceras['Content-Type'] = 'application/json';
            if (typeof opciones.body !== 'string') opciones.body = JSON.stringify(opciones.body);
        }
    }
    const opcionesFetch = { ...opciones, headers: cabeceras };
    const payloadParaMostrar = opciones.body instanceof URLSearchParams ? opciones.body.toString() : (typeof opciones.body === 'string' ? opciones.body : JSON.stringify(opciones.body, null, 2));
    mostrarResultadoGeneral(`Enviando petición a: ${url.replace(URL_BASE_API, "")}\nPayload: ${payloadParaMostrar || '(sin payload)'}`, false);

    try {
        const respuesta = await fetch(url, opcionesFetch);
        let datosRespuesta = null;
        const tipoContenido = respuesta.headers.get('content-type');

        if (tipoContenido && tipoContenido.includes('application/json')) {
            try { datosRespuesta = await respuesta.json(); }
            catch (e) { datosRespuesta = await respuesta.text(); } // Fallback a texto
        } else {
            datosRespuesta = await respuesta.text();
        }

        if (!respuesta.ok) {
            const mensajeError = (datosRespuesta && typeof datosRespuesta === 'object' && datosRespuesta.error) ? datosRespuesta.error : (datosRespuesta || `Error ${respuesta.status}`);
            mostrarResultadoGeneral(datosRespuesta, true);
            throw new Error(mensajeError);
        }
        mostrarResultadoGeneral(datosRespuesta, false);
        return datosRespuesta;
    } catch (error) {
        // El error ya se muestra en mostrarResultadoGeneral dentro del bloque !respuesta.ok
        // o si es un error de red.
        console.error('Error en peticionApiConAutenticacion:', error.message);
        throw error;
    }
}

// --- NFC ---
async function leerEtiquetaNFC(inputElement, statusElement) {
    if (!('NDEFReader' in window)) {
        mostrarEstadoNFC(statusElement, "Web NFC no es compatible.", 'error');
        return;
    }
    mostrarEstadoNFC(statusElement, "Acerca etiqueta NFC...", 'info');
    try {
        const ndef = new NDEFReader();
        await ndef.scan();
        mostrarEstadoNFC(statusElement, "Escaneo NFC activo.", 'info');
        ndef.addEventListener("readingerror", () => mostrarEstadoNFC(statusElement, "Error al leer NFC.", 'error'));
        ndef.addEventListener("reading", ({ serialNumber }) => {
            if (inputElement) inputElement.value = serialNumber || "N/A";
            mostrarEstadoNFC(statusElement, `NFC Leído: ${serialNumber}`, 'success');
            // Considerar ndef.abort() si solo se necesita una lectura.
        });
    } catch (error) {
        let msg = `Error NFC: ${error.message}`;
        if (error.name === 'NotAllowedError') msg = "NFC: Permiso denegado.";
        else if (error.name === 'NotSupportedError') msg = "NFC: No soportado/activado.";
        mostrarEstadoNFC(statusElement, msg, 'error');
    }
}

// --- Escáner QR ---
async function iniciarEscaneoQR(videoElement, inputElement, statusElement, scannerContainer) {
    if (!navigator.mediaDevices?.getUserMedia) {
        mostrarEstadoScanQR(statusElement, "Cámara no soportada.", 'error');
        return;
    }
    if (!window.jsQR) {
        mostrarEstadoScanQR(statusElement, "Librería jsQR no cargada.", 'error');
        return;
    }
    detenerEscaneoQR(); // Detener stream previo
    try {
        currentQrStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
        videoElement.srcObject = currentQrStream;
        videoElement.play();
        scannerContainer.style.display = 'block';
        mostrarEstadoScanQR(statusElement, "Escaneando QR...", 'info');

        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d', { willReadFrequently: true });

        function tick() {
            if (videoElement.readyState === videoElement.HAVE_ENOUGH_DATA) {
                canvas.height = videoElement.videoHeight;
                canvas.width = videoElement.videoWidth;
                context.drawImage(videoElement, 0, 0, canvas.width, canvas.height);
                const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
                const code = jsQR(imageData.data, imageData.width, imageData.height);
                if (code) {
                    inputElement.value = code.data;
                    mostrarEstadoScanQR(statusElement, `QR Detectado`, 'success'); // Mensaje más corto
                    detenerEscaneoQR();
                    scannerContainer.style.display = 'none';
                }
            }
            if (currentQrStream) qrAnimationId = requestAnimationFrame(tick);
        }
        qrAnimationId = requestAnimationFrame(tick);
    } catch (err) {
        let msg = "Error cámara.";
        if (err.name === "NotAllowedError") msg = "Permiso cámara denegado.";
        else if (err.name === "NotFoundError") msg = "Cámara no encontrada.";
        mostrarEstadoScanQR(statusElement, msg, 'error');
        detenerEscaneoQR();
        scannerContainer.style.display = 'none';
    }
}

function detenerEscaneoQR() {
    if (qrAnimationId) cancelAnimationFrame(qrAnimationId);
    qrAnimationId = null;
    if (currentQrStream) {
        currentQrStream.getTracks().forEach(track => track.stop());
        currentQrStream = null;
    }
    if (videoQrEntrada) videoQrEntrada.srcObject = null;
    // No ocultar scannerContainer aquí, se maneja donde se llama
}

// --- Manejadores de Eventos ---
async function manejarLogin(evento) {
    evento.preventDefault();
    const credenciales = { email: formularioLogin.email.value, password: formularioLogin.password.value };
    limpiarResultadosEspecificos(); limpiarEstadosNFC(); limpiarEstadosScanQR();
    try {
        const datos = await peticionApiConAutenticacion(`${URL_BASE_API}/auth/login`, { method: 'POST', body: credenciales });
        if (datos?.token) almacenarToken(datos.token);
        else { mostrarResultadoGeneral("Error: Login fallido.", true); limpiarToken(); }
    } catch (e) { limpiarToken(); }
}

function manejarCierreSesion() {
    limpiarToken();
    detenerEscaneoQR();
    mostrarResultadoGeneral("Sesión cerrada.");
}

async function manejarConsultarSaldo(evento) {
    evento.preventDefault();
    const uid = inputCheckUid.value;
    limpiarResultadosEspecificos(); limpiarEstadosNFC();
    if (!uid) { mostrarResultadoEspecifico(divResultadoConsulta, "UID de pulsera requerido.", true); return; }
    mostrarResultadoEspecifico(divResultadoConsulta, `Consultando UID: ${uid}...`, false);
    try {
        const datos = await peticionApiConAutenticacion(`${URL_BASE_API}/pos/pulseras/${uid}`, { method: 'GET' });
        if (datos?.saldo !== undefined) {
            const estado = datos.activa ? 'Activa' : 'Inactiva';
            const saldoF = datos.saldo.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' });
            mostrarResultadoEspecifico(divResultadoConsulta, `Saldo: ${saldoF} | Estado: ${estado} ${datos.idFestival ? `(Fest ID: ${datos.idFestival})` : ''} ${datos.nombreAsistente ? `- Asist: ${datos.nombreAsistente}` : ''}`, false);
        } else mostrarResultadoEspecifico(divResultadoConsulta, "Respuesta inesperada.", true);
    } catch (e) { mostrarResultadoEspecifico(divResultadoConsulta, `Error: ${e.message}`, true); }
}

async function manejarAsociarPulseraAEntrada(evento) {
    evento.preventDefault();
    detenerEscaneoQR();
    const codigoQr = inputAsociarQrEntrada.value;
    const uidPulsera = inputAsociarUidPulsera.value;
    const idFestival = entradaIdFestivalTPV.value;

    limpiarResultadosEspecificos(); limpiarEstadosNFC();
    if (!codigoQr || !uidPulsera || !idFestival) {
        mostrarResultadoEspecifico(divResultadoAsociar, "QR, UID Pulsera e ID Festival son obligatorios.", true); return;
    }
    mostrarResultadoEspecifico(divResultadoAsociar, `Asociando UID: ${uidPulsera} a QR: ${codigoQr.substring(0, 10)}...`, false);
    const cuerpo = new URLSearchParams({ codigoQrEntrada: codigoQr, codigoUidPulsera: uidPulsera, idFestival: idFestival });
    try {
        const datos = await peticionApiConAutenticacion(`${URL_BASE_API}/pos/pulseras/asociar-pulsera`, { method: 'POST', body: cuerpo });
        if (datos?.pulsera?.codigoUid) {
            mostrarResultadoEspecifico(divResultadoAsociar, datos.mensaje || `Pulsera ${datos.pulsera.codigoUid} asociada.`, false);
            inputAsociarQrEntrada.value = ''; inputAsociarUidPulsera.value = '';
            if (statusQrEntradaScan) { statusQrEntradaScan.textContent = ''; statusQrEntradaScan.className = 'scan-status'; }
        } else mostrarResultadoEspecifico(divResultadoAsociar, datos.mensaje || "Error al asociar.", true);
    } catch (e) { mostrarResultadoEspecifico(divResultadoAsociar, `Error: ${e.message}`, true); }
}

async function manejarRecarga(evento) {
    evento.preventDefault();
    const uid = formularioRecarga.codigoUid.value; // Acceso directo al valor del input
    const monto = formularioRecarga.monto.value;
    const metodoPago = formularioRecarga.metodoPago.value;
    const idFestival = entradaIdFestivalTPV.value;

    limpiarResultadosEspecificos(); limpiarEstadosNFC();
    if (!idFestival || !monto || !uid) {
        mostrarResultadoEspecifico(divResultadoRecarga, "UID, Monto e ID Festival son obligatorios.", true); return;
    }
    mostrarResultadoEspecifico(divResultadoRecarga, `Recargando UID: ${uid}...`, false);
    const cuerpo = new URLSearchParams({ monto, metodoPago });
    try {
        const url = `${URL_BASE_API}/pos/pulseras/${uid}/recargar?festivalId=${encodeURIComponent(idFestival)}`;
        const datos = await peticionApiConAutenticacion(url, { method: 'POST', body: cuerpo });
        if (datos?.saldo !== undefined) {
            mostrarResultadoEspecifico(divResultadoRecarga, `Recarga OK. Saldo: ${datos.saldo.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}`, false);
            formularioRecarga.codigoUid.value = ''; formularioRecarga.monto.value = '';
        } else mostrarResultadoEspecifico(divResultadoRecarga, "Error en recarga.", true);
    } catch (e) { mostrarResultadoEspecifico(divResultadoRecarga, `Error: ${e.message}`, true); }
}

async function manejarConsumo(evento) {
    evento.preventDefault();
    const uid = formularioConsumo.codigoUid.value;
    const monto = formularioConsumo.monto.value;
    const descripcion = formularioConsumo.descripcion.value;
    const idPuntoVenta = formularioConsumo.idPuntoVenta.value;
    const idFestival = entradaIdFestivalTPV.value;

    limpiarResultadosEspecificos(); limpiarEstadosNFC();
    if (!idFestival || !monto || !uid || !descripcion) {
        mostrarResultadoEspecifico(divResultadoConsumo, "UID, Monto, Descripción e ID Festival son obligatorios.", true); return;
    }
    mostrarResultadoEspecifico(divResultadoConsumo, `Consumiendo de UID: ${uid}...`, false);
    const cuerpo = new URLSearchParams({ monto, descripcion, idFestival });
    if (idPuntoVenta) cuerpo.append('idPuntoVenta', idPuntoVenta);
    try {
        const url = `${URL_BASE_API}/pos/pulseras/${uid}/consumir`;
        const datos = await peticionApiConAutenticacion(url, { method: 'POST', body: cuerpo });
        if (datos?.saldo !== undefined) {
            mostrarResultadoEspecifico(divResultadoConsumo, `Consumo OK. Saldo: ${datos.saldo.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}`, false);
            formularioConsumo.codigoUid.value = ''; formularioConsumo.monto.value = ''; formularioConsumo.descripcion.value = 'Bebida';
        } else mostrarResultadoEspecifico(divResultadoConsumo, "Error en consumo.", true);
    } catch (e) { mostrarResultadoEspecifico(divResultadoConsumo, `Error: ${e.message}`, true); }
}

// --- Inicialización ---
document.addEventListener('DOMContentLoaded', () => {
    cargarToken();

    // Formularios
    if (formularioLogin) formularioLogin.addEventListener('submit', manejarLogin);
    if (botonCerrarSesion) botonCerrarSesion.addEventListener('click', manejarCierreSesion);
    if (formularioConsultarSaldo) formularioConsultarSaldo.addEventListener('submit', manejarConsultarSaldo);
    if (formularioAsociarPulsera) formularioAsociarPulsera.addEventListener('submit', manejarAsociarPulseraAEntrada);
    if (formularioRecarga) formularioRecarga.addEventListener('submit', manejarRecarga);
    if (formularioConsumo) formularioConsumo.addEventListener('submit', manejarConsumo);

    // Botones NFC
    if (btnScanNfcCheck) btnScanNfcCheck.addEventListener('click', () => leerEtiquetaNFC(inputCheckUid, statusCheckNfc));
    if (btnScanNfcAsociar) btnScanNfcAsociar.addEventListener('click', () => leerEtiquetaNFC(inputAsociarUidPulsera, statusNfcAsociar));
    if (btnScanRecharge) btnScanRecharge.addEventListener('click', () => leerEtiquetaNFC(inputRechargeUid, statusRechargeNfc));
    if (btnScanConsume) btnScanConsume.addEventListener('click', () => leerEtiquetaNFC(inputConsumeUid, statusConsumeNfc));

    // Botones Escáner QR
    if (btnScanQrEntrada) btnScanQrEntrada.addEventListener('click', () => iniciarEscaneoQR(videoQrEntrada, inputAsociarQrEntrada, statusQrEntradaScan, qrScannerEntradaContainer));
    if (btnStopScanQrEntrada) btnStopScanQrEntrada.addEventListener('click', () => {
        detenerEscaneoQR();
        qrScannerEntradaContainer.style.display = 'none';
        mostrarEstadoScanQR(statusQrEntradaScan, "Escáner detenido.", 'info');
    });

    // Comprobaciones de compatibilidad
    if (!('NDEFReader' in window)) console.warn("Web NFC API no compatible.");
    if (!navigator.mediaDevices?.getUserMedia) console.warn("getUserMedia API (cámara) no compatible.");
    if (!window.jsQR) console.warn("Librería jsQR no cargada. Escáner QR no funcionará.");
});
