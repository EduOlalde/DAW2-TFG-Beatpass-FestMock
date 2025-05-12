const URL_BASE_API = 'https://daw2-tfg-beatpass.onrender.com/api';
//const URL_BASE_API = 'http://localhost:8888/BeatpassTFG/api'; // Para desarrollo local
let tokenJwt = null; // Variable global para almacenar el token JWT

// --- Selectores del DOM ---
const formularioLogin = document.getElementById('loginForm');
const estadoLogin = document.getElementById('loginStatus');
const botonCerrarSesion = document.getElementById('logoutButton');
const divOperacionesTPV = document.getElementById('posOperations');
const areaResultadoGeneral = document.getElementById('resultArea'); // Renombrado para mayor claridad
const formularioConsultarSaldo = document.getElementById('checkBalanceForm');
const formularioRecarga = document.getElementById('rechargeForm');
const formularioConsumo = document.getElementById('consumeForm');
const entradaIdFestivalTPV = document.getElementById('posFestivalId');
const entradaOcultaIdFestivalConsumo = document.getElementById('consumeFestivalId');

const divResultadoConsulta = document.getElementById('consultaResult');
const divResultadoRecarga = document.getElementById('recargaResult');
const divResultadoConsumo = document.getElementById('consumoResult');

// --- Funciones de Gestión del Token ---
function almacenarToken(token) {
    tokenJwt = token;
    localStorage.setItem('tokenJwt', token); // Clave en localStorage también traducida para consistencia
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
        estadoLogin.className = 'success'; // Mantener clases CSS si son referenciadas así
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
        divDestino.className = `section-result ${esError ? 'error' : 'success'}`; // Mantener clases CSS
    }
}

function limpiarResultadosEspecificos() {
    if (divResultadoConsulta) { divResultadoConsulta.textContent = ''; divResultadoConsulta.className = 'section-result'; }
    if (divResultadoRecarga) { divResultadoRecarga.textContent = ''; divResultadoRecarga.className = 'section-result'; }
    if (divResultadoConsumo) { divResultadoConsumo.textContent = ''; divResultadoConsumo.className = 'section-result'; }
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
        if (opciones.body instanceof URLSearchParams) {
            if (!cabeceras['Content-Type']) cabeceras['Content-Type'] = 'application/x-www-form-urlencoded;charset=UTF-8';
        } else if (typeof opciones.body === 'object' && !(opciones.body instanceof FormData)) {
            if (!cabeceras['Content-Type']) cabeceras['Content-Type'] = 'application/json';
            if (typeof opciones.body !== 'string') opciones.body = JSON.stringify(opciones.body);
        }
    }
    const opcionesFetch = { ...opciones, headers: cabeceras };
    console.log(`Petición: ${url}`, opcionesFetch);

    try {
        const respuesta = await fetch(url, opcionesFetch);
        let datosRespuesta = null;
        const tipoContenido = respuesta.headers.get('content-type');

        if (tipoContenido && tipoContenido.includes('application/json')) {
            try { datosRespuesta = await respuesta.json(); }
            catch (errorJson) {
                console.warn("Fallo al parsear JSON, intentando obtener texto.", errorJson);
                try { datosRespuesta = await respuesta.text(); }
                catch (errorTexto) { console.error("Fallo crítico al obtener texto de respuesta.", errorTexto); datosRespuesta = `Error ${respuesta.status}: Respuesta no procesable.`; }
            }
        } else {
            try { datosRespuesta = await respuesta.text(); }
            catch (errorTexto) { console.error("Fallo al obtener texto no JSON.", errorTexto); datosRespuesta = `Error ${respuesta.status}: Respuesta no procesable.`; }
        }

        if (!respuesta.ok) {
            console.error(`Error HTTP: ${respuesta.status} ${respuesta.statusText}`, datosRespuesta);
            const mensajeError = (datosRespuesta && typeof datosRespuesta === 'object' && datosRespuesta.error)
                ? datosRespuesta.error
                : (datosRespuesta && typeof datosRespuesta === 'string' && datosRespuesta.length < 200 && datosRespuesta.length > 0 ? datosRespuesta : `Error ${respuesta.status}: ${respuesta.statusText}`);
            // No llamar a mostrarResultadoGeneral aquí para que cada manejador decida dónde mostrar el error.
            throw new Error(mensajeError);
        }
        console.log("Petición API exitosa", datosRespuesta);
        // No llamar a mostrarResultadoGeneral aquí, el llamador se encargará.
        return datosRespuesta;

    } catch (error) {
        console.error('Error en peticionApiConAutenticacion:', error);
        // No mostrar error genérico aquí si ya fue un error HTTP, para evitar duplicados.
        // Solo mostrar si es un error de red u otro tipo no manejado arriba.
        if (!error.message.includes("Error HTTP") && !error.message.startsWith("Error ") && !(error instanceof DOMException && error.name === "AbortError")) {
            mostrarResultadoGeneral(`Error de red o configuración: ${error.message}`, true);
        }
        throw error; // Re-lanzar para que el manejador original lo capture.
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
    try {
        const datos = await peticionApiConAutenticacion(`${URL_BASE_API}/auth/login`, { method: 'POST', body: credenciales });
        if (datos && datos.token) {
            almacenarToken(datos.token);
            mostrarResultadoGeneral("Login exitoso. Token recibido.", false); // Mensaje de éxito general
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
}

/** Maneja la consulta de saldo de una pulsera. */
async function manejarConsultarSaldo(evento) {
    evento.preventDefault();
    const uid = document.getElementById('checkUid').value; // ID específico de este formulario
    limpiarResultadosEspecificos();
    areaResultadoGeneral.innerHTML = ''; areaResultadoGeneral.className = ''; // Limpiar área general

    if (!uid) {
        mostrarResultadoEspecifico(divResultadoConsulta, "Por favor, introduce un UID de pulsera.", true);
        return;
    }
    mostrarResultadoEspecifico(divResultadoConsulta, `Consultando pulsera UID: ${uid}...`, false);

    try {
        const datos = await peticionApiConAutenticacion(`${URL_BASE_API}/pos/pulseras/${uid}`, { method: 'GET' });
        if (datos && datos.saldo !== undefined && datos.activa !== undefined) {
            const estado = datos.activa ? 'Activa' : 'Inactiva';
            const saldoFormateado = datos.saldo.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' });
            const infoFestival = datos.idFestival ? ` (Festival ID: ${datos.idFestival})` : ''; // Mostrar ID del festival
            mostrarResultadoEspecifico(divResultadoConsulta, `Saldo: ${saldoFormateado} | Estado: ${estado}${infoFestival}`, false);
        } else {
            mostrarResultadoEspecifico(divResultadoConsulta, "Respuesta recibida, pero faltan datos de saldo o estado.", true);
        }
    } catch (error) {
        mostrarResultadoEspecifico(divResultadoConsulta, `Error al consultar: ${error.message}`, true);
    }
}

/** Maneja el formulario de recarga de pulsera. */
async function manejarRecarga(evento) {
    evento.preventDefault();
    const datosFormulario = new FormData(formularioRecarga);
    const uid = datosFormulario.get('codigoUid');
    const idFestival = entradaIdFestivalTPV.value;
    const cuerpoPeticion = new URLSearchParams(datosFormulario); // UID y monto están aquí
    limpiarResultadosEspecificos();
    areaResultadoGeneral.innerHTML = ''; areaResultadoGeneral.className = '';

    if (!idFestival) {
        mostrarResultadoEspecifico(divResultadoRecarga, "Error: No se ha definido el ID del Festival para el TPV.", true);
        return;
    }
    // El festivalId se añade como query parameter
    if (!cuerpoPeticion.has('monto') || !datosFormulario.get('monto')) {
        mostrarResultadoEspecifico(divResultadoRecarga, "Por favor, introduce un monto para la recarga.", true);
        return;
    }


    mostrarResultadoEspecifico(divResultadoRecarga, `Intentando recargar pulsera UID: ${uid} en Festival ID: ${idFestival}...`, false);

    try {
        const url = `${URL_BASE_API}/pos/pulseras/${uid}/recargar?festivalId=${encodeURIComponent(idFestival)}`;
        const datos = await peticionApiConAutenticacion(url, {
            method: 'POST',
            body: cuerpoPeticion // Contiene 'monto'
        });

        if (datos && datos.saldo !== undefined) {
            const nuevoSaldoFormateado = datos.saldo.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' });
            mostrarResultadoEspecifico(divResultadoRecarga, `Recarga exitosa. Nuevo Saldo: ${nuevoSaldoFormateado}`, false);
        } else {
            mostrarResultadoEspecifico(divResultadoRecarga, "Recarga procesada, pero no se recibió el nuevo saldo.", true);
        }
        formularioRecarga.reset();
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
    areaResultadoGeneral.innerHTML = ''; areaResultadoGeneral.className = '';

    if (!idFestival) {
        mostrarResultadoEspecifico(divResultadoConsumo, "Error: No se ha definido el ID del Festival para el TPV.", true);
        return;
    }

    // Asignar el ID del festival del TPV al campo oculto del formulario de consumo si existe
    // y asegurar que esté en datosFormulario para construir el cuerpo de la petición.
    if (entradaOcultaIdFestivalConsumo) {
        entradaOcultaIdFestivalConsumo.value = idFestival;
        datosFormulario.set('idFestival', idFestival); // Asegurar que esté en datosFormulario
    } else {
        // Si no existe el campo oculto, igualmente se puede enviar si la API lo espera en el body
        console.warn("Campo oculto 'consumeFestivalId' no encontrado, se intentará enviar idFestival en el cuerpo si está presente en datosFormulario.");
        if (!datosFormulario.has('idFestival')) { // Si no se pudo setear antes y no está
            datosFormulario.set('idFestival', idFestival); // Lo añadimos explícitamente
        }
    }
    if (!datosFormulario.has('monto') || !datosFormulario.get('monto')) {
        mostrarResultadoEspecifico(divResultadoConsumo, "Por favor, introduce un monto para el consumo.", true);
        return;
    }


    const cuerpoPeticion = new URLSearchParams(datosFormulario); // Crear cuerpoPeticion DESPUÉS de asignar idFestival

    mostrarResultadoEspecifico(divResultadoConsumo, `Intentando registrar consumo en pulsera UID: ${uid} (Fest: ${idFestival})...`, false);

    try {
        // El idFestival va en el cuerpo de la petición, no como query param.
        const url = `${URL_BASE_API}/pos/pulseras/${uid}/consumir`;
        const datos = await peticionApiConAutenticacion(url, {
            method: 'POST',
            body: cuerpoPeticion
        });

        if (datos && datos.saldo !== undefined) {
            const nuevoSaldoFormateado = datos.saldo.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' });
            mostrarResultadoEspecifico(divResultadoConsumo, `Consumo registrado. Nuevo Saldo: ${nuevoSaldoFormateado}`, false);
        } else {
            mostrarResultadoEspecifico(divResultadoConsumo, "Consumo procesado, pero no se recibió el nuevo saldo.", true);
        }
        formularioConsumo.reset();
    } catch (error) {
        mostrarResultadoEspecifico(divResultadoConsumo, `Error al consumir: ${error.message}`, true);
    }
}

// --- Inicialización ---
document.addEventListener('DOMContentLoaded', () => {
    cargarToken(); // Intentar cargar token al inicio

    // Asignar manejadores a los formularios y botones, verificando su existencia
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
});