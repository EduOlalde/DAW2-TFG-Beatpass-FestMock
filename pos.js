const URL_BASE_API = 'https://daw2-tfg-beatpass.onrender.com/api';
//const URL_BASE_API = 'http://localhost:8080/BeatpassTFG/api'; // Para desarrollo local
let tokenJwt = null;

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

// Selectores para NFC
const btnScanCheck = document.getElementById('scanNfcCheck');
const inputCheckUid = document.getElementById('checkUid');
const statusCheckNfc = document.getElementById('nfcStatusCheck');

const btnScanRecharge = document.getElementById('scanNfcRecharge');
const inputRechargeUid = document.getElementById('rechargeUid');
const statusRechargeNfc = document.getElementById('nfcStatusRecharge');

const btnScanConsume = document.getElementById('scanNfcConsume');
const inputConsumeUid = document.getElementById('consumeUid');
const statusConsumeNfc = document.getElementById('nfcStatusConsume');

// Selectores para Asociar Pulsera
const formularioAsociarPulsera = document.getElementById('asociarPulseraForm');
const inputAsociarQrEntrada = document.getElementById('asociarQrEntrada');
const inputAsociarUidPulsera = document.getElementById('asociarUidPulsera');
const btnScanNfcAsociar = document.getElementById('scanNfcAsociar');
const statusNfcAsociar = document.getElementById('nfcStatusAsociar');
const divResultadoAsociar = document.getElementById('asociarResult');


// --- Funciones de Gestión del Token ---
function almacenarToken(token) {
    tokenJwt = token;
    localStorage.setItem('tokenJwt', token);
    actualizarEstadoLogin(true);
    console.log("Token JWT almacenado.");
}

function limpiarToken() {
    tokenJwt = null;
    localStorage.removeItem('tokenJwt');
    actualizarEstadoLogin(false);
    console.log("Token JWT eliminado.");
}

function cargarToken() {
    const tokenAlmacenado = localStorage.getItem('tokenJwt');
    if (tokenAlmacenado) {
        tokenJwt = tokenAlmacenado;
        actualizarEstadoLogin(true);
        console.log("Token JWT cargado desde localStorage.");
    } else {
        actualizarEstadoLogin(false);
    }
}

// --- Funciones de UI ---
function actualizarEstadoLogin(sesionIniciada) {
    if (sesionIniciada) {
        estadoLogin.textContent = 'Autenticado';
        estadoLogin.className = 'success'; // La clase CSS se encarga del estilo
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
        areaResultadoGeneral.innerHTML = 'Esperando acciones...';
        areaResultadoGeneral.className = ''; // Sin clase de error/éxito inicial
    }
}

/** Muestra un resultado general en el área designada. */
function mostrarResultadoGeneral(datos, esError = false) {
    areaResultadoGeneral.innerHTML = '';
    const contenido = document.createElement('pre');
    // Estilos para 'pre' están en CSS, no es necesario aquí.
    contenido.textContent = typeof datos === 'object' ? JSON.stringify(datos, null, 2) : String(datos);
    areaResultadoGeneral.appendChild(contenido);
    areaResultadoGeneral.className = esError ? 'error' : 'success';
    if (esError) console.error("Error API (General):", datos); else console.log("Éxito API (General):", datos);
}

/** Muestra un resultado en un div específico para una operación. */
function mostrarResultadoEspecifico(divDestino, mensaje, esError) {
    if (divDestino) {
        divDestino.textContent = String(mensaje);
        divDestino.className = `section-result visible ${esError ? 'error' : 'success'}`; // Añadir 'visible'
    }
}

/** Muestra un mensaje de estado en un div específico para NFC. */
function mostrarEstadoNFC(divDestino, mensaje, tipo = 'info') {
    if (divDestino) {
        divDestino.textContent = String(mensaje);
        divDestino.className = `nfc-status ${tipo}`; // La clase CSS se encarga del color
    }
}

function limpiarResultadosEspecificos() {
    const resultados = [divResultadoConsulta, divResultadoRecarga, divResultadoConsumo, divResultadoAsociar];
    resultados.forEach(div => {
        if (div) {
            div.textContent = '';
            div.className = 'section-result'; // Quitar 'visible', 'error', 'success'
        }
    });
}

function limpiarEstadosNFC() {
    const estados = [statusCheckNfc, statusRechargeNfc, statusConsumeNfc, statusNfcAsociar];
    estados.forEach(div => {
        if (div) {
            div.textContent = '';
            div.className = 'nfc-status'; // Resetear a clase base
        }
    });
}

/**
 * Realiza una llamada fetch a la API, añadiendo el token JWT si está disponible.
 * Maneja la respuesta y posibles errores.
 * @param {string} url - La URL completa del endpoint de la API.
 * @param {object} [opciones={}] - Opciones para la función fetch (method, body, etc.).
 * @returns {Promise<any>} - Promesa que resuelve con los datos de la respuesta o rechaza con error.
 */
async function peticionApiConAutenticacion(url, opciones = {}) {
    const cabeceras = { ...(opciones.headers || {}) };
    if (tokenJwt) {
        cabeceras['Authorization'] = `Bearer ${tokenJwt}`;
    }
    // Determinar Content-Type si no está explícitamente en las opciones
    if (opciones.body) {
        if (opciones.body instanceof URLSearchParams) {
            if (!cabeceras['Content-Type']) cabeceras['Content-Type'] = 'application/x-www-form-urlencoded;charset=UTF-8';
        } else if (typeof opciones.body === 'object' && !(opciones.body instanceof FormData)) {
            // Asumir JSON si es un objeto y no FormData
            if (!cabeceras['Content-Type']) cabeceras['Content-Type'] = 'application/json';
            // Convertir a string JSON si aún no lo es
            if (typeof opciones.body !== 'string') opciones.body = JSON.stringify(opciones.body);
        }
        // FormData se maneja automáticamente por fetch, no necesita Content-Type explícito aquí.
    }

    const opcionesFetch = { ...opciones, headers: cabeceras };
    console.log(`Petición: ${url}`, opcionesFetch);

    // Mostrar intento de petición en el área general
    const payloadParaMostrar = opciones.body instanceof URLSearchParams ? opciones.body.toString() : (typeof opciones.body === 'string' ? opciones.body : JSON.stringify(opciones.body, null, 2));
    mostrarResultadoGeneral(`Enviando petición a: ${url.replace(URL_BASE_API, "")}\nPayload: ${payloadParaMostrar || '(sin payload)'}`, false);

    try {
        const respuesta = await fetch(url, opcionesFetch);
        let datosRespuesta = null;
        const tipoContenido = respuesta.headers.get('content-type');

        if (tipoContenido && tipoContenido.includes('application/json')) {
            try {
                datosRespuesta = await respuesta.json();
            } catch (errorJson) {
                console.warn("Fallo al parsear JSON, intentando obtener texto.", errorJson);
                try { datosRespuesta = await respuesta.text(); } // Fallback a texto
                catch (errorTexto) { console.error("Fallo crítico al obtener texto de respuesta.", errorTexto); datosRespuesta = `Error ${respuesta.status}: Respuesta no procesable.`; }
            }
        } else { // Si no es JSON, intentar obtener como texto
            try {
                datosRespuesta = await respuesta.text();
            } catch (errorTexto) {
                console.error("Fallo al obtener texto no JSON.", errorTexto);
                datosRespuesta = `Error ${respuesta.status}: Respuesta no procesable.`;
            }
        }

        if (!respuesta.ok) {
            console.error(`Error HTTP: ${respuesta.status} ${respuesta.statusText}`, datosRespuesta);
            // Intentar extraer un mensaje de error más específico del cuerpo de la respuesta
            const mensajeError = (datosRespuesta && typeof datosRespuesta === 'object' && datosRespuesta.error)
                ? datosRespuesta.error
                : (datosRespuesta && typeof datosRespuesta === 'string' && datosRespuesta.length < 200 && datosRespuesta.length > 0 ? datosRespuesta : `Error ${respuesta.status}: ${respuesta.statusText}`);
            mostrarResultadoGeneral(datosRespuesta, true);
            throw new Error(mensajeError);
        }

        mostrarResultadoGeneral(datosRespuesta, false);
        console.log("Petición API exitosa", datosRespuesta);
        return datosRespuesta;

    } catch (error) {
        console.error('Error en peticionApiConAutenticacion:', error);
        // El error ya se debería haber mostrado en el área general
        throw error; // Re-lanzar para que el manejador específico lo capture
    }
}

/**
 * Intenta leer una etiqueta NFC usando la Web NFC API.
 * @param {HTMLInputElement} inputElement - El campo de texto donde se escribirá el UID.
 * @param {HTMLElement} statusElement - El elemento para mostrar mensajes de estado NFC.
 */
async function leerEtiquetaNFC(inputElement, statusElement) {
    if (!('NDEFReader' in window)) {
        mostrarEstadoNFC(statusElement, "Web NFC no es compatible con este navegador/dispositivo.", 'error');
        console.warn("Web NFC API no disponible.");
        return;
    }

    mostrarEstadoNFC(statusElement, "Acerca una etiqueta NFC al lector del móvil...", 'info');

    try {
        const ndef = new NDEFReader();
        await ndef.scan(); // Inicia el escaneo
        console.log("NFC: Escaneo iniciado");
        mostrarEstadoNFC(statusElement, "Escaneo NFC activo. Esperando etiqueta...", 'info');

        ndef.addEventListener("readingerror", (event) => {
            const errorMessage = "NFC: No se pudo leer la etiqueta.";
            mostrarEstadoNFC(statusElement, errorMessage, 'error');
            console.error(errorMessage, event);
        });

        ndef.addEventListener("reading", ({ serialNumber }) => {
            console.log(`NFC: Número de serie leído: ${serialNumber}`);
            const uidNFC = serialNumber || "N/A"; // Usar el serialNumber como UID

            if (inputElement) {
                inputElement.value = uidNFC;
                mostrarEstadoNFC(statusElement, `NFC: Etiqueta leída (UID: ${uidNFC})`, 'success');
            } else {
                // Esto no debería pasar si se llama correctamente
                mostrarEstadoNFC(statusElement, `NFC: Etiqueta leída (UID: ${uidNFC}), pero no se encontró el campo de destino.`, 'warning');
            }
            // Considerar si detener el escaneo aquí o permitir lecturas continuas.
            // Para un solo campo, abortar es usualmente lo deseado.
            // ndef.abort(); // Opcional: detener escaneo tras lectura exitosa
            // console.log("NFC: Escaneo detenido después de la lectura.");
        });

    } catch (error) {
        let errorMessage = `Error NFC: ${error.message}`;
        if (error.name === 'NotAllowedError') { // Permiso denegado por el usuario
            errorMessage = "Error NFC: Permiso denegado para acceder a NFC.";
        } else if (error.name === 'NotSupportedError') { // Hardware no soportado o desactivado
            errorMessage = "Error NFC: El hardware NFC no está disponible o activado.";
        }
        mostrarEstadoNFC(statusElement, errorMessage, 'error');
        console.error("Error al iniciar escaneo NFC:", error);
    }
}

// --- Manejadores de Eventos ---

async function manejarLogin(evento) {
    evento.preventDefault();
    const datosFormulario = new FormData(formularioLogin);
    const credenciales = { email: datosFormulario.get('email'), password: datosFormulario.get('password') };
    limpiarResultadosEspecificos();
    limpiarEstadosNFC();
    try {
        const datos = await peticionApiConAutenticacion(`${URL_BASE_API}/auth/login`, { method: 'POST', body: credenciales });
        if (datos && datos.token) {
            almacenarToken(datos.token);
        } else {
            console.error("Respuesta de login inesperada (sin token):", datos);
            mostrarResultadoGeneral("Error: Respuesta de login inesperada del servidor.", true);
            limpiarToken();
        }
    } catch (error) {
        limpiarToken(); // Asegurar que no quede un token inválido
    }
}

function manejarCierreSesion() {
    limpiarToken();
    mostrarResultadoGeneral("Sesión cerrada.");
    limpiarResultadosEspecificos();
    limpiarEstadosNFC();
}

async function manejarConsultarSaldo(evento) {
    evento.preventDefault();
    const uid = inputCheckUid.value;
    limpiarResultadosEspecificos();
    limpiarEstadosNFC();

    if (!uid) {
        mostrarResultadoEspecifico(divResultadoConsulta, "Por favor, introduce o escanea un UID de pulsera.", true);
        return;
    }
    mostrarResultadoEspecifico(divResultadoConsulta, `Consultando pulsera UID: ${uid}...`, false);

    try {
        const datos = await peticionApiConAutenticacion(`${URL_BASE_API}/pos/pulseras/${uid}`, { method: 'GET' });
        if (datos && datos.saldo !== undefined && datos.activa !== undefined) {
            const estado = datos.activa ? 'Activa' : 'Inactiva';
            const saldoFormateado = datos.saldo.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' });
            const infoFestival = datos.idFestival ? ` (Festival ID: ${datos.idFestival})` : '';
            const infoAsistente = datos.nombreAsistente ? ` - Asistente: ${datos.nombreAsistente}` : '';
            mostrarResultadoEspecifico(divResultadoConsulta, `Saldo: ${saldoFormateado} | Estado: ${estado}${infoFestival}${infoAsistente}`, false);
        } else {
            mostrarResultadoEspecifico(divResultadoConsulta, "Respuesta recibida, pero faltan datos de saldo o estado.", true);
        }
    } catch (error) {
        mostrarResultadoEspecifico(divResultadoConsulta, `Error al consultar: ${error.message}`, true);
    }
}

async function manejarAsociarPulseraAEntrada(evento) {
    evento.preventDefault();
    const codigoQr = inputAsociarQrEntrada.value;
    const uidPulsera = inputAsociarUidPulsera.value;
    const idFestival = entradaIdFestivalTPV.value;

    limpiarResultadosEspecificos();
    limpiarEstadosNFC();

    if (!codigoQr) {
        mostrarResultadoEspecifico(divResultadoAsociar, "Por favor, introduce el Código QR de la entrada.", true);
        return;
    }
    if (!uidPulsera) {
        mostrarResultadoEspecifico(divResultadoAsociar, "Por favor, introduce o escanea el UID de la pulsera.", true);
        return;
    }
    if (!idFestival) {
        mostrarResultadoEspecifico(divResultadoAsociar, "Error: No se ha definido el ID del Festival para el TPV.", true);
        return;
    }

    mostrarResultadoEspecifico(divResultadoAsociar, `Asociando pulsera UID: ${uidPulsera} a entrada QR: ${codigoQr.substring(0, 15)}... (Fest ID: ${idFestival})...`, false);

    const cuerpoPeticion = new URLSearchParams();
    cuerpoPeticion.append('codigoQrEntrada', codigoQr);
    cuerpoPeticion.append('codigoUidPulsera', uidPulsera);
    cuerpoPeticion.append('idFestival', idFestival);

    try {
        // Endpoint actualizado según el backend: /pos/pulseras/asociar-entrada-qr
        const url = `${URL_BASE_API}/pos/pulseras/asociar-entrada-qr`;
        const datosRespuesta = await peticionApiConAutenticacion(url, {
            method: 'POST',
            body: cuerpoPeticion
        });

        if (datosRespuesta && datosRespuesta.pulsera && datosRespuesta.pulsera.codigoUid) {
            mostrarResultadoEspecifico(divResultadoAsociar, datosRespuesta.mensaje || `Pulsera ${datosRespuesta.pulsera.codigoUid} asociada correctamente.`, false);
            inputAsociarQrEntrada.value = '';
            inputAsociarUidPulsera.value = '';
        } else {
            // Si la respuesta no tiene la estructura esperada pero fue un 2xx, podría ser un mensaje simple.
            // Si 'datosRespuesta.mensaje' existe, se usa. Si no, mensaje genérico.
            const mensajeServidor = datosRespuesta && datosRespuesta.mensaje ? datosRespuesta.mensaje : "Respuesta inesperada del servidor al asociar.";
            mostrarResultadoEspecifico(divResultadoAsociar, mensajeServidor, !(datosRespuesta && datosRespuesta.pulsera)); // esError si no hay 'pulsera'
        }
    } catch (error) {
        mostrarResultadoEspecifico(divResultadoAsociar, `Error al asociar pulsera: ${error.message}`, true);
    }
}

async function manejarRecarga(evento) {
    evento.preventDefault();
    const datosFormulario = new FormData(formularioRecarga);
    const uid = datosFormulario.get('codigoUid');
    const idFestival = entradaIdFestivalTPV.value;
    limpiarResultadosEspecificos();
    limpiarEstadosNFC();

    if (!idFestival) {
        mostrarResultadoEspecifico(divResultadoRecarga, "Error: No se ha definido el ID del Festival para el TPV.", true);
        return;
    }
    if (!datosFormulario.has('monto') || !datosFormulario.get('monto')) {
        mostrarResultadoEspecifico(divResultadoRecarga, "Por favor, introduce un monto para la recarga.", true);
        return;
    }
    if (!uid) {
        mostrarResultadoEspecifico(divResultadoRecarga, "Por favor, introduce o escanea un UID de pulsera.", true);
        return;
    }

    const cuerpoPeticion = new URLSearchParams();
    cuerpoPeticion.append('monto', datosFormulario.get('monto'));
    cuerpoPeticion.append('metodoPago', datosFormulario.get('metodoPago'));

    mostrarResultadoEspecifico(divResultadoRecarga, `Intentando recargar pulsera UID: ${uid} en Festival ID: ${idFestival}...`, false);

    try {
        const url = `${URL_BASE_API}/pos/pulseras/${uid}/recargar?festivalId=${encodeURIComponent(idFestival)}`;
        const datos = await peticionApiConAutenticacion(url, {
            method: 'POST',
            body: cuerpoPeticion
        });

        if (datos && datos.saldo !== undefined) {
            const nuevoSaldoFormateado = datos.saldo.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' });
            mostrarResultadoEspecifico(divResultadoRecarga, `Recarga exitosa. Nuevo Saldo: ${nuevoSaldoFormateado}`, false);
            inputRechargeUid.value = ''; // Limpiar campos tras éxito
            document.getElementById('rechargeAmount').value = '';
        } else {
            mostrarResultadoEspecifico(divResultadoRecarga, "Recarga procesada, pero no se recibió el nuevo saldo.", true);
        }

    } catch (error) {
        mostrarResultadoEspecifico(divResultadoRecarga, `Error al recargar: ${error.message}`, true);
    }
}

async function manejarConsumo(evento) {
    evento.preventDefault();
    const datosFormulario = new FormData(formularioConsumo);
    const uid = datosFormulario.get('codigoUid');
    const idFestival = entradaIdFestivalTPV.value;
    limpiarResultadosEspecificos();
    limpiarEstadosNFC();

    if (!idFestival) {
        mostrarResultadoEspecifico(divResultadoConsumo, "Error: No se ha definido el ID del Festival para el TPV.", true);
        return;
    }
    if (!datosFormulario.has('monto') || !datosFormulario.get('monto')) {
        mostrarResultadoEspecifico(divResultadoConsumo, "Por favor, introduce un monto para el consumo.", true);
        return;
    }
    if (!uid) {
        mostrarResultadoEspecifico(divResultadoConsumo, "Por favor, introduce o escanea un UID de pulsera.", true);
        return;
    }

    const cuerpoPeticion = new URLSearchParams();
    cuerpoPeticion.append('monto', datosFormulario.get('monto'));
    cuerpoPeticion.append('descripcion', datosFormulario.get('descripcion'));
    cuerpoPeticion.append('idFestival', idFestival);
    if (datosFormulario.get('idPuntoVenta')) {
        cuerpoPeticion.append('idPuntoVenta', datosFormulario.get('idPuntoVenta'));
    }

    mostrarResultadoEspecifico(divResultadoConsumo, `Intentando registrar consumo en pulsera UID: ${uid} (Fest: ${idFestival})...`, false);

    try {
        const url = `${URL_BASE_API}/pos/pulseras/${uid}/consumir`;
        const datos = await peticionApiConAutenticacion(url, {
            method: 'POST',
            body: cuerpoPeticion
        });

        if (datos && datos.saldo !== undefined) {
            const nuevoSaldoFormateado = datos.saldo.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' });
            mostrarResultadoEspecifico(divResultadoConsumo, `Consumo registrado. Nuevo Saldo: ${nuevoSaldoFormateado}`, false);
            inputConsumeUid.value = ''; // Limpiar campos tras éxito
            document.getElementById('consumeAmount').value = '';
            document.getElementById('consumeDescription').value = 'Bebida'; // Resetear descripción
        } else {
            mostrarResultadoEspecifico(divResultadoConsumo, "Consumo procesado, pero no se recibió el nuevo saldo.", true);
        }

    } catch (error) {
        mostrarResultadoEspecifico(divResultadoConsumo, `Error al consumir: ${error.message}`, true);
    }
}

// --- Inicialización ---
document.addEventListener('DOMContentLoaded', () => {
    cargarToken(); // Cargar token al iniciar

    // Asignar manejadores de eventos a los formularios y botones
    if (formularioLogin) formularioLogin.addEventListener('submit', manejarLogin);
    if (botonCerrarSesion) botonCerrarSesion.addEventListener('click', manejarCierreSesion);
    if (formularioConsultarSaldo) formularioConsultarSaldo.addEventListener('submit', manejarConsultarSaldo);
    if (formularioAsociarPulsera) formularioAsociarPulsera.addEventListener('submit', manejarAsociarPulseraAEntrada);
    if (formularioRecarga) formularioRecarga.addEventListener('submit', manejarRecarga);
    if (formularioConsumo) formularioConsumo.addEventListener('submit', manejarConsumo);

    // Asignar manejadores a los botones NFC
    if (btnScanCheck) btnScanCheck.addEventListener('click', () => leerEtiquetaNFC(inputCheckUid, statusCheckNfc));
    if (btnScanNfcAsociar) btnScanNfcAsociar.addEventListener('click', () => leerEtiquetaNFC(inputAsociarUidPulsera, statusNfcAsociar));
    if (btnScanRecharge) btnScanRecharge.addEventListener('click', () => leerEtiquetaNFC(inputRechargeUid, statusRechargeNfc));
    if (btnScanConsume) btnScanConsume.addEventListener('click', () => leerEtiquetaNFC(inputConsumeUid, statusConsumeNfc));

    // Verificar compatibilidad Web NFC al cargar
    if (!('NDEFReader' in window)) {
        console.warn("Web NFC API no es compatible con este navegador.");
        // Se podría mostrar un mensaje más persistente al usuario si NFC es crucial
        // Por ejemplo, en un div dedicado en el HTML.
    } else {
        console.log("Web NFC API parece ser compatible.");
    }
});
