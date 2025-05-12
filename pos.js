const URL_BASE_API = 'https://daw2-tfg-beatpass.onrender.com/api';
//const URL_BASE_API = 'http://localhost:8888/BeatpassTFG/api'; // Para desarrollo local
let tokenJwt = null; // Variable global para almacenar el token JWT

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
const entradaOcultaIdFestivalConsumo = document.getElementById('consumeFestivalId');

const divResultadoConsulta = document.getElementById('consultaResult');
const divResultadoRecarga = document.getElementById('recargaResult');
const divResultadoConsumo = document.getElementById('consumoResult');

// --- Selectores para NFC (añadidos) ---
const btnScanCheck = document.getElementById('scanNfcCheck');
const inputCheckUid = document.getElementById('checkUid');
const statusCheckNfc = document.getElementById('nfcStatusCheck');

const btnScanRecharge = document.getElementById('scanNfcRecharge');
const inputRechargeUid = document.getElementById('rechargeUid');
const statusRechargeNfc = document.getElementById('nfcStatusRecharge');

const btnScanConsume = document.getElementById('scanNfcConsume');
const inputConsumeUid = document.getElementById('consumeUid');
const statusConsumeNfc = document.getElementById('nfcStatusConsume');


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
        limpiarEstadosNFC(); // Limpiar estados NFC al hacer logout
        areaResultadoGeneral.innerHTML = 'Esperando acciones...';
        areaResultadoGeneral.className = '';
    }
}

/** Muestra un resultado general en el área designada. */
function mostrarResultadoGeneral(datos, esError = false) {
    areaResultadoGeneral.innerHTML = '';
    const contenido = document.createElement('pre');
    contenido.style.whiteSpace = 'pre-wrap';
    contenido.style.wordWrap = 'break-word';
    contenido.textContent = typeof datos === 'object' ? JSON.stringify(datos, null, 2) : datos;
    areaResultadoGeneral.appendChild(contenido);
    areaResultadoGeneral.className = esError ? 'error' : 'success';
    if (esError) console.error("Error API (General):", datos); else console.log("Éxito API (General):", datos);
}

/** Muestra un resultado en un div específico para una operación. */
function mostrarResultadoEspecifico(divDestino, mensaje, esError) {
    if (divDestino) {
        divDestino.textContent = mensaje;
        divDestino.className = `section-result ${esError ? 'error' : 'success'}`;
    }
}

/** Muestra un mensaje de estado en un div específico para NFC. */
function mostrarEstadoNFC(divDestino, mensaje, tipo = 'info') {
    if (divDestino) {
        divDestino.textContent = mensaje;
        divDestino.className = `nfc-status ${tipo}`;
    }
}


function limpiarResultadosEspecificos() {
    if (divResultadoConsulta) { divResultadoConsulta.textContent = ''; divResultadoConsulta.className = 'section-result'; }
    if (divResultadoRecarga) { divResultadoRecarga.textContent = ''; divResultadoRecarga.className = 'section-result'; }
    if (divResultadoConsumo) { divResultadoConsumo.textContent = ''; divResultadoConsumo.className = 'section-result'; }
}

// Limpia los mensajes de estado de NFC
function limpiarEstadosNFC() {
    if (statusCheckNfc) { statusCheckNfc.textContent = ''; statusCheckNfc.className = 'nfc-status'; }
    if (statusRechargeNfc) { statusRechargeNfc.textContent = ''; statusRechargeNfc.className = 'nfc-status'; }
    if (statusConsumeNfc) { statusConsumeNfc.textContent = ''; statusConsumeNfc.className = 'nfc-status'; }
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
    if (opciones.body) {
        // Determinar Content-Type si no está especificado
        if (opciones.body instanceof URLSearchParams) {
            if (!cabeceras['Content-Type']) cabeceras['Content-Type'] = 'application/x-www-form-urlencoded;charset=UTF-8';
        } else if (typeof opciones.body === 'object' && !(opciones.body instanceof FormData)) {
            // Asumir JSON si es un objeto y no FormData
            if (!cabeceras['Content-Type']) cabeceras['Content-Type'] = 'application/json';
            // Convertir a JSON string si no lo es ya
            if (typeof opciones.body !== 'string') opciones.body = JSON.stringify(opciones.body);
        }      
    }

    const opcionesFetch = { ...opciones, headers: cabeceras };
    console.log(`Petición: ${url}`, opcionesFetch);

    try {
        const respuesta = await fetch(url, opcionesFetch);
        let datosRespuesta = null;
        const tipoContenido = respuesta.headers.get('content-type');

        // Intentar parsear como JSON si el content-type lo indica
        if (tipoContenido && tipoContenido.includes('application/json')) {
            try {
                datosRespuesta = await respuesta.json();
            } catch (errorJson) {
                console.warn("Fallo al parsear JSON, intentando obtener texto.", errorJson);
                // Si falla el parseo JSON, intentar obtener como texto plano
                try { datosRespuesta = await respuesta.text(); }
                catch (errorTexto) { console.error("Fallo crítico al obtener texto de respuesta.", errorTexto); datosRespuesta = `Error ${respuesta.status}: Respuesta no procesable.`; }
            }
        } else { // Si no es JSON, obtener como texto
            try {
                datosRespuesta = await respuesta.text();
            } catch (errorTexto) {
                console.error("Fallo al obtener texto no JSON.", errorTexto);
                datosRespuesta = `Error ${respuesta.status}: Respuesta no procesable.`;
            }
        }

        // Comprobar si la respuesta HTTP fue exitosa (status 2xx)
        if (!respuesta.ok) {
            console.error(`Error HTTP: ${respuesta.status} ${respuesta.statusText}`, datosRespuesta);
            // Intentar extraer un mensaje de error más específico de la respuesta
            const mensajeError = (datosRespuesta && typeof datosRespuesta === 'object' && datosRespuesta.error)
                ? datosRespuesta.error // Si la API devuelve un { error: "mensaje" }
                : (datosRespuesta && typeof datosRespuesta === 'string' && datosRespuesta.length < 200 && datosRespuesta.length > 0 ? datosRespuesta : `Error ${respuesta.status}: ${respuesta.statusText}`);
            throw new Error(mensajeError); // Lanzar error para ser capturado por el catch externo
        }

        console.log("Petición API exitosa", datosRespuesta);
        return datosRespuesta; 

    } catch (error) {
        console.error('Error en peticionApiConAutenticacion:', error);
        // Mostrar error general solo si no es un error HTTP ya reportado (para evitar duplicados)
        // o si es un error de red/configuración.
        if (!error.message.includes("Error HTTP") && !error.message.startsWith("Error ") && !(error instanceof DOMException && error.name === "AbortError")) {
            mostrarResultadoGeneral(`Error de red o configuración: ${error.message}`, true);
        }
        throw error; // Re-lanzar para que el manejador original lo capture y muestre en su sección específica.
    }
}


// --- Función para leer NFC ---
/**
 * Intenta leer una etiqueta NFC usando la Web NFC API (si está disponible).
 * Requiere interacción del usuario (ej. clic en un botón) y HTTPS.
 * SOLO FUNCIONA EN NAVEGADORES COMPATIBLES (Ej: Chrome en Android).
 * @param {HTMLInputElement} inputElement - El campo de texto donde se escribirá el UID leído.
 * @param {HTMLElement} statusElement - El elemento donde mostrar mensajes de estado/error NFC.
 */
async function leerEtiquetaNFC(inputElement, statusElement) {
    // Verificar si la API Web NFC está presente en el objeto window
    if (!('NDEFReader' in window)) {
        mostrarEstadoNFC(statusElement, "Web NFC no es compatible con este navegador/dispositivo.", 'error');
        console.warn("Web NFC API no disponible.");
        return;
    }

    // Limpiar estado anterior y mostrar mensaje inicial
    mostrarEstadoNFC(statusElement, "Acerca una etiqueta NFC al lector del móvil...", 'info');

    try {
        // Crear una nueva instancia de NDEFReader
        const ndef = new NDEFReader();

        // Iniciar el escaneo. Esto debe hacerse como respuesta a una acción del usuario.
        // Devuelve una promesa que resuelve cuando el escaneo está listo o rechaza si hay error/permiso denegado.
        await ndef.scan();
        console.log("NFC: Escaneo iniciado");
        mostrarEstadoNFC(statusElement, "Escaneo NFC activo. Esperando etiqueta...", 'info');

        // Añadir listener para errores durante la lectura
        ndef.addEventListener("readingerror", (event) => {
            const errorMessage = "NFC: No se pudo leer la etiqueta.";
            mostrarEstadoNFC(statusElement, errorMessage, 'error');
            console.error(errorMessage, event);
        });

        // Añadir listener para cuando se lee una etiqueta correctamente
        ndef.addEventListener("reading", ({ message, serialNumber }) => {
            console.log(`NFC: Número de serie leído: ${serialNumber}`);      
            const uidNFC = serialNumber || "N/A"; 

            // Rellenar el campo de texto correspondiente con el valor leído
            if (inputElement) {
                inputElement.value = uidNFC;
                mostrarEstadoNFC(statusElement, `NFC: Etiqueta leída (UID aprox: ${uidNFC})`, 'success');
            } else {
                // Caso improbable si la referencia al input se pierde
                mostrarEstadoNFC(statusElement, `NFC: Etiqueta leída (UID aprox: ${uidNFC}), pero no se encontró el campo de destino.`, 'warning');
            }

            // Detener el escaneo después de una lectura exitosa
            ndef.abort(); 
            console.log("NFC: Escaneo detenido después de la lectura.");
        });

    } catch (error) {
        // Capturar errores al iniciar el escaneo (ej. permisos denegados, hardware no disponible)
        let errorMessage = `Error NFC: ${error.message}`;
        if (error.name === 'NotAllowedError') {
            errorMessage = "Error NFC: Permiso denegado para acceder a NFC.";
        } else if (error.name === 'NotSupportedError') {
            errorMessage = "Error NFC: El hardware NFC no está disponible o activado.";
        }
        mostrarEstadoNFC(statusElement, errorMessage, 'error');
        console.error("Error al iniciar escaneo NFC:", error);
    }
}


// --- Manejadores de Eventos ---

/** Maneja el envío del formulario de login. */
async function manejarLogin(evento) {
    evento.preventDefault();
    const datosFormulario = new FormData(formularioLogin);
    const credenciales = { email: datosFormulario.get('email'), password: datosFormulario.get('password') };
    mostrarResultadoGeneral("Intentando iniciar sesión...");
    limpiarResultadosEspecificos();
    limpiarEstadosNFC();
    try {
        const datos = await peticionApiConAutenticacion(`${URL_BASE_API}/auth/login`, { method: 'POST', body: credenciales });
        if (datos && datos.token) {
            almacenarToken(datos.token);
            mostrarResultadoGeneral("Login exitoso. Token recibido.", false); 
        } else {
            console.error("Respuesta de login inesperada (sin token):", datos);
            mostrarResultadoGeneral("Error: Respuesta de login inesperada del servidor.", true);
            limpiarToken();
        }
    } catch (error) {
        mostrarResultadoGeneral(`Error en login: ${error.message}`, true);
        limpiarToken(); 
    }
}

/** Maneja el clic en el botón de cerrar sesión. */
function manejarCierreSesion() {
    limpiarToken();
    mostrarResultadoGeneral("Sesión cerrada.");
    limpiarResultadosEspecificos();
    limpiarEstadosNFC(); 
}

/** Maneja la consulta de saldo de una pulsera. */
async function manejarConsultarSaldo(evento) {
    evento.preventDefault();
    const uid = inputCheckUid.value; 
    limpiarResultadosEspecificos(); 
    limpiarEstadosNFC(); 
    areaResultadoGeneral.innerHTML = ''; areaResultadoGeneral.className = ''; 

    if (!uid) {
        mostrarResultadoEspecifico(divResultadoConsulta, "Por favor, introduce o escanea un UID de pulsera.", true);
        return;
    }
    // Indicar inicio de la operación
    mostrarResultadoEspecifico(divResultadoConsulta, `Consultando pulsera UID: ${uid}...`, false);

    try {
        // Realizar la petición a la API
        const datos = await peticionApiConAutenticacion(`${URL_BASE_API}/pos/pulseras/${uid}`, { method: 'GET' });
        // Procesar la respuesta exitosa
        if (datos && datos.saldo !== undefined && datos.activa !== undefined) {
            const estado = datos.activa ? 'Activa' : 'Inactiva';
            const saldoFormateado = datos.saldo.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' });
            const infoFestival = datos.idFestival ? ` (Festival ID: ${datos.idFestival})` : '';
            mostrarResultadoEspecifico(divResultadoConsulta, `Saldo: ${saldoFormateado} | Estado: ${estado}${infoFestival}`, false);
        } else {
            // La respuesta fue OK (2xx) pero no contenía los datos esperados
            mostrarResultadoEspecifico(divResultadoConsulta, "Respuesta recibida, pero faltan datos de saldo o estado.", true);
        }
    } catch (error) {
        // Mostrar error específico de la operación si la petición falló
        mostrarResultadoEspecifico(divResultadoConsulta, `Error al consultar: ${error.message}`, true);
    }
}

/** Maneja el formulario de recarga de pulsera. */
async function manejarRecarga(evento) {
    evento.preventDefault();
    const datosFormulario = new FormData(formularioRecarga);
    const uid = datosFormulario.get('codigoUid'); 
    const idFestival = entradaIdFestivalTPV.value;
    limpiarResultadosEspecificos();
    limpiarEstadosNFC();
    areaResultadoGeneral.innerHTML = ''; areaResultadoGeneral.className = '';

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

    // Crear cuerpo de la petición (solo monto y método de pago, UID va en URL)
    const cuerpoPeticion = new URLSearchParams();
    cuerpoPeticion.append('monto', datosFormulario.get('monto'));
    cuerpoPeticion.append('metodoPago', datosFormulario.get('metodoPago'));

    mostrarResultadoEspecifico(divResultadoRecarga, `Intentando recargar pulsera UID: ${uid} en Festival ID: ${idFestival}...`, false);

    try {
        const url = `${URL_BASE_API}/pos/pulseras/${uid}/recargar?festivalId=${encodeURIComponent(idFestival)}`;
        const datos = await peticionApiConAutenticacion(url, {
            method: 'POST',
            body: cuerpoPeticion // Contiene 'monto' y 'metodoPago'
        });

        if (datos && datos.saldo !== undefined) {
            const nuevoSaldoFormateado = datos.saldo.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' });
            mostrarResultadoEspecifico(divResultadoRecarga, `Recarga exitosa. Nuevo Saldo: ${nuevoSaldoFormateado}`, false);
            // Limpiar solo los campos de monto y UID después de una recarga exitosa
            inputRechargeUid.value = '';
            document.getElementById('rechargeAmount').value = '';
        } else {
            mostrarResultadoEspecifico(divResultadoRecarga, "Recarga procesada, pero no se recibió el nuevo saldo.", true);
        }
       
    } catch (error) {
        mostrarResultadoEspecifico(divResultadoRecarga, `Error al recargar: ${error.message}`, true);
    }
}

/** Maneja el formulario de registro de consumo. */
async function manejarConsumo(evento) {
    evento.preventDefault();
    const datosFormulario = new FormData(formularioConsumo);
    const uid = datosFormulario.get('codigoUid'); 
    const idFestival = entradaIdFestivalTPV.value;
    limpiarResultadosEspecificos();
    limpiarEstadosNFC();
    areaResultadoGeneral.innerHTML = ''; areaResultadoGeneral.className = '';

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

    // Asignar el ID del festival del TPV al campo oculto y asegurar que esté en datosFormulario
    if (entradaOcultaIdFestivalConsumo) {
        entradaOcultaIdFestivalConsumo.value = idFestival;
        datosFormulario.set('idFestival', idFestival); // Asegurar que esté en datosFormulario
    } else {
        console.warn("Campo oculto 'consumeFestivalId' no encontrado, añadiendo idFestival a datosFormulario.");
        datosFormulario.set('idFestival', idFestival);
    }

    // Crear el cuerpo de la petición con todos los datos necesarios del formulario
    // Quitar codigoUid porque va en la URL
    datosFormulario.delete('codigoUid');
    const cuerpoPeticion = new URLSearchParams(datosFormulario);

    mostrarResultadoEspecifico(divResultadoConsumo, `Intentando registrar consumo en pulsera UID: ${uid} (Fest: ${idFestival})...`, false);

    try {
        // El idFestival va en el cuerpo de la petición
        const url = `${URL_BASE_API}/pos/pulseras/${uid}/consumir`;
        const datos = await peticionApiConAutenticacion(url, {
            method: 'POST',
            body: cuerpoPeticion
        });

        if (datos && datos.saldo !== undefined) {
            const nuevoSaldoFormateado = datos.saldo.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' });
            mostrarResultadoEspecifico(divResultadoConsumo, `Consumo registrado. Nuevo Saldo: ${nuevoSaldoFormateado}`, false);
            // Limpiar campos UID, monto y descripción tras éxito
            inputConsumeUid.value = '';
            document.getElementById('consumeAmount').value = '';
            document.getElementById('consumeDescription').value = 'Bebida'; // Resetear a valor por defecto
        } else {
            mostrarResultadoEspecifico(divResultadoConsumo, "Consumo procesado, pero no se recibió el nuevo saldo.", true);
        }
        
    } catch (error) {
        mostrarResultadoEspecifico(divResultadoConsumo, `Error al consumir: ${error.message}`, true);
    }
}

// --- Inicialización ---
document.addEventListener('DOMContentLoaded', () => {
    cargarToken(); // Intentar cargar token al inicio

    // Asignar manejadores a los formularios y botones principales
    if (formularioLogin) formularioLogin.addEventListener('submit', manejarLogin);
    else console.warn("Elemento 'loginForm' no encontrado.");

    if (botonCerrarSesion) botonCerrarSesion.addEventListener('click', manejarCierreSesion);
    else console.warn("Elemento 'logoutButton' no encontrado.");

    if (formularioConsultarSaldo) formularioConsultarSaldo.addEventListener('submit', manejarConsultarSaldo);
    else console.warn("Elemento 'checkBalanceForm' no encontrado.");

    if (formularioRecarga) formularioRecarga.addEventListener('submit', manejarRecarga);
    else console.warn("Elemento 'rechargeForm' no encontrado.");

    if (formularioConsumo) formularioConsumo.addEventListener('submit', manejarConsumo);
    else console.warn("Elemento 'consumeForm' no encontrado.");

    // --- Asignar manejadores a los botones NFC ---
    if (btnScanCheck && inputCheckUid && statusCheckNfc) {
        btnScanCheck.addEventListener('click', () => leerEtiquetaNFC(inputCheckUid, statusCheckNfc));
    } else {
        console.warn("Elementos NFC para Consulta no encontrados o incompletos.");
    }

    if (btnScanRecharge && inputRechargeUid && statusRechargeNfc) {
        btnScanRecharge.addEventListener('click', () => leerEtiquetaNFC(inputRechargeUid, statusRechargeNfc));
    } else {
        console.warn("Elementos NFC para Recarga no encontrados o incompletos.");
    }

    if (btnScanConsume && inputConsumeUid && statusConsumeNfc) {
        btnScanConsume.addEventListener('click', () => leerEtiquetaNFC(inputConsumeUid, statusConsumeNfc));
    } else {
        console.warn("Elementos NFC para Consumo no encontrados o incompletos.");
    }

    // Mensaje inicial sobre compatibilidad NFC (opcional)
    if (!('NDEFReader' in window)) {
        console.warn("Web NFC API no es compatible con este navegador.");
    } else {
        console.log("Web NFC API parece ser compatible.");
    }
});
