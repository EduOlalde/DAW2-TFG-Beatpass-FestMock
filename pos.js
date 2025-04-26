// Definir la URL base de la API (¡Ajusta si es necesario!)
const API_BASE_URL = 'https://daw2-tfg-beatpass.onrender.com/api';
//const API_BASE_URL = 'http://localhost:8080/BeatpassTFG/api';
let jwtToken = null; // Variable global para almacenar el token JWT

// --- Obtener Elementos del DOM ---
const loginForm = document.getElementById('loginForm');
const loginStatus = document.getElementById('loginStatus');
const logoutButton = document.getElementById('logoutButton');
const posOperationsDiv = document.getElementById('posOperations');
const resultArea = document.getElementById('resultArea');
const checkBalanceForm = document.getElementById('checkBalanceForm');
const rechargeForm = document.getElementById('rechargeForm');
const consumeForm = document.getElementById('consumeForm');
const posFestivalIdInput = document.getElementById('posFestivalId'); 
const consumeFestivalIdHiddenInput = document.getElementById('consumeFestivalId'); // Input oculto en form consumo

// Referencias a los divs de resultados específicos
const consultaResultDiv = document.getElementById('consultaResult');
const recargaResultDiv = document.getElementById('recargaResult');
const consumoResultDiv = document.getElementById('consumoResult');

// --- Funciones Auxiliares ---
function storeToken(token) {
    jwtToken = token;
    localStorage.setItem('jwtToken', token);
    updateLoginStatus(true);
    console.log("Token JWT almacenado.");
}
function clearToken() {
    jwtToken = null;
    localStorage.removeItem('jwtToken');
    updateLoginStatus(false);
    console.log("Token JWT eliminado.");
}
function loadToken() {
    const storedToken = localStorage.getItem('jwtToken');
    if (storedToken) {
        jwtToken = storedToken;
        updateLoginStatus(true);
        console.log("Token JWT cargado desde localStorage.");
    } else {
        updateLoginStatus(false);
    }
}
function updateLoginStatus(isLoggedIn) {
    if (isLoggedIn) {
        loginStatus.textContent = 'Autenticado';
        loginStatus.className = 'success';
        posOperationsDiv.style.display = 'block';
        logoutButton.style.display = 'inline-block';
        loginForm.style.display = 'none';
    } else {
        loginStatus.textContent = 'No autenticado';
        loginStatus.className = 'error';
        posOperationsDiv.style.display = 'none';
        logoutButton.style.display = 'none';
        loginForm.style.display = 'block';
        clearSpecificResults();
        resultArea.innerHTML = 'Esperando acciones...';
        resultArea.className = '';
    }
}
function displayResult(data, isError = false) {
    resultArea.innerHTML = '';
    const content = document.createElement('pre');
    content.style.whiteSpace = 'pre-wrap';
    content.style.wordWrap = 'break-word';
    content.textContent = typeof data === 'object' ? JSON.stringify(data, null, 2) : data;
    resultArea.appendChild(content);
    resultArea.className = isError ? 'error' : 'success'; 
    if (isError) console.error("API Error:", data); else console.log("API Success:", data);
}
function displaySpecificResult(targetDiv, message, isError) {
    if (targetDiv) {
        targetDiv.textContent = message;
        targetDiv.className = `section-result ${isError ? 'error' : 'success'}`;
    }
}
function clearSpecificResults() {
    if (consultaResultDiv) { consultaResultDiv.textContent = ''; consultaResultDiv.className = 'section-result'; }
    if (recargaResultDiv) { recargaResultDiv.textContent = ''; recargaResultDiv.className = 'section-result'; }
    if (consumoResultDiv) { consumoResultDiv.textContent = ''; consumoResultDiv.className = 'section-result'; }
}

/**
 * Realiza una llamada fetch a la API, añadiendo el token JWT si está disponible.
 * Maneja la respuesta y posibles errores, mostrando resultados en las áreas designadas.
 * @param {string} url - La URL completa del endpoint de la API.
 * @param {object} [options={}] - Opciones para la función fetch (method, body, etc.).
 * @returns {Promise<any>} - Promesa que resuelve con los datos de la respuesta o rechaza con error.
 */
async function fetchWithAuth(url, options = {}) {
    const headers = { ...(options.headers || {}) };
    if (jwtToken) {
        headers['Authorization'] = `Bearer ${jwtToken}`;
    }
    if (options.body) {
        if (options.body instanceof URLSearchParams) {
            if (!headers['Content-Type']) headers['Content-Type'] = 'application/x-www-form-urlencoded;charset=UTF-8';
        } else if (typeof options.body === 'object' && !(options.body instanceof FormData)) {
            if (!headers['Content-Type']) headers['Content-Type'] = 'application/json';
            if (typeof options.body !== 'string') options.body = JSON.stringify(options.body);
        }
    }
    const fetchOptions = { ...options, headers: headers };
    console.log(`Fetching: ${url}`, fetchOptions);

    try {
        const response = await fetch(url, fetchOptions);
        let responseData = null;
        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
            try { responseData = await response.json(); }
            catch (jsonError) {
                console.warn("Fallo al parsear JSON, intentando obtener texto.", jsonError);
                try { responseData = await response.text(); }
                catch (textError) { console.error("Fallo al obtener texto.", textError); responseData = `Error ${response.status}: Respuesta no procesable.`; }
            }
        } else {
            try { responseData = await response.text(); }
            catch (textError) { console.error("Fallo al obtener texto no JSON.", textError); responseData = `Error ${response.status}: Respuesta no procesable.`; }
        }

        if (!response.ok) {
            console.error(`HTTP Error: ${response.status} ${response.statusText}`, responseData);
            const errorMessage = (responseData && typeof responseData === 'object' && responseData.error)
                ? responseData.error
                : (responseData && typeof responseData === 'string' && responseData.length < 200 && responseData.length > 0 ? responseData : `Error ${response.status}: ${response.statusText}`);
            displayResult(errorMessage, true);
            throw new Error(errorMessage);
        }
        console.log("Fetch successful", responseData);
        displayResult(responseData, false);
        return responseData;

    } catch (error) {
        console.error('Error en fetchWithAuth:', error);
        if (!error.message.includes("HTTP Error") && !error.message.startsWith("Error ")) {
            displayResult(`Error de red o fetch: ${error.message}`, true);
        }
        throw error;
    }
}

// --- Manejadores de Eventos ---

/** Maneja el envío del formulario de login */
async function handleLogin(event) {
    event.preventDefault();
    const formData = new FormData(loginForm);
    const credentials = { email: formData.get('email'), password: formData.get('password') };
    displayResult("Intentando iniciar sesión...");
    clearSpecificResults();
    try {
        const data = await fetchWithAuth(`${API_BASE_URL}/auth/login`, { method: 'POST', body: credentials });
        if (data && data.token) {
            storeToken(data.token);
        } else {
            console.error("Respuesta de login inesperada (sin token):", data);
            displayResult("Error: Respuesta de login inesperada del servidor.", true);
            clearToken();
        }
    } catch (error) {
        clearToken();
    }
}

/** Maneja el clic en el botón de logout */
function handleLogout() {
    clearToken();
    displayResult("Sesión cerrada.");
    clearSpecificResults();
}

/** Maneja la consulta de datos de una pulsera */
async function handleCheckBalance(event) {
    event.preventDefault();
    const uid = document.getElementById('checkUid').value;
    clearSpecificResults();
    resultArea.innerHTML = ''; resultArea.className = '';

    if (!uid) {
        displaySpecificResult(consultaResultDiv, "Por favor, introduce un UID de pulsera.", true);
        return;
    }
    displaySpecificResult(consultaResultDiv, `Consultando pulsera UID: ${uid}...`, false);
    displayResult(`Consultando pulsera UID: ${uid}...`, false);

    try {
        // La consulta de datos no necesita el idFestival explícitamente en la URL,
        // la verificación de permisos (si es promotor) se hace en el backend.
        const data = await fetchWithAuth(`${API_BASE_URL}/pos/pulseras/${uid}`, { method: 'GET' });
        if (data && data.saldo !== undefined && data.activa !== undefined) {
            const estado = data.activa ? 'Activa' : 'Inactiva';
            const saldoFormateado = data.saldo.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' });
            // *** Mostrar ID del festival al que pertenece la pulsera ***
            const festivalInfo = data.idFestival ? ` (Festival ID: ${data.idFestival})` : '';
            displaySpecificResult(consultaResultDiv, `Saldo: ${saldoFormateado} | Estado: ${estado}${festivalInfo}`, false);
        } else {
            displaySpecificResult(consultaResultDiv, "Respuesta recibida, pero faltan datos de saldo o estado.", true);
        }
    } catch (error) {
        displaySpecificResult(consultaResultDiv, `Error al consultar: ${error.message}`, true);
    }
}

/** Maneja el formulario de recarga de pulsera */
async function handleRecharge(event) {
    event.preventDefault();
    const formData = new FormData(rechargeForm);
    const uid = formData.get('codigoUid');
    const festivalId = posFestivalIdInput.value; 
    const body = new URLSearchParams(formData);
    clearSpecificResults();
    resultArea.innerHTML = ''; resultArea.className = '';

    if (!festivalId) {
        displaySpecificResult(recargaResultDiv, "Error: No se ha definido el ID del Festival para el POS.", true);
        return;
    }

    displaySpecificResult(recargaResultDiv, `Intentando recargar pulsera UID: ${uid} en Festival ID: ${festivalId}...`, false);
    displayResult(`Intentando recargar pulsera UID: ${uid} en Festival ID: ${festivalId}...`, false);

    try {
        // *** Añadir festivalId como Query Parameter a la URL ***
        const url = `${API_BASE_URL}/pos/pulseras/${uid}/recargar?festivalId=${encodeURIComponent(festivalId)}`;
        const data = await fetchWithAuth(url, {
            method: 'POST',
            body: body
        });

        if (data && data.saldo !== undefined) {
            const nuevoSaldoFormateado = data.saldo.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' });
            displaySpecificResult(recargaResultDiv, `Recarga exitosa. Nuevo Saldo: ${nuevoSaldoFormateado}`, false);
        } else {
            displaySpecificResult(recargaResultDiv, "Recarga procesada, pero no se recibió el nuevo saldo.", true);
        }
        rechargeForm.reset();

    } catch (error) {
        displaySpecificResult(recargaResultDiv, `Error al recargar: ${error.message}`, true);
    }
}

/** Maneja el formulario de registro de consumo */
async function handleConsume(event) {
    event.preventDefault();
    const formData = new FormData(consumeForm);
    const uid = formData.get('codigoUid');
    const festivalId = posFestivalIdInput.value; 
    clearSpecificResults();
    resultArea.innerHTML = ''; resultArea.className = '';

    if (!festivalId) {
        displaySpecificResult(consumoResultDiv, "Error: No se ha definido el ID del Festival para el POS.", true);
        return;
    }
    // *** Asignar el ID del festival del POS al campo oculto del formulario ***
    if (consumeFestivalIdHiddenInput) {
        consumeFestivalIdHiddenInput.value = festivalId;
        formData.set('idFestival', festivalId); // Asegurar que esté en formData
    } else {
        displaySpecificResult(consumoResultDiv, "Error: Falta el campo oculto para idFestival en el formulario.", true);
        return;
    }

    const body = new URLSearchParams(formData); // Crear body DESPUÉS de asignar idFestival

    displaySpecificResult(consumoResultDiv, `Intentando registrar consumo en pulsera UID: ${uid} (Fest: ${festivalId})...`, false);
    displayResult(`Intentando registrar consumo en pulsera UID: ${uid} (Fest: ${festivalId})...`, false);

    try {
        // La URL no necesita festivalId como query param, ya va en el body
        const url = `${API_BASE_URL}/pos/pulseras/${uid}/consumir`;
        const data = await fetchWithAuth(url, {
            method: 'POST',
            body: body
        });

        if (data && data.saldo !== undefined) {
            const nuevoSaldoFormateado = data.saldo.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' });
            displaySpecificResult(consumoResultDiv, `Consumo registrado. Nuevo Saldo: ${nuevoSaldoFormateado}`, false);
        } else {
            displaySpecificResult(consumoResultDiv, "Consumo procesado, pero no se recibió el nuevo saldo.", true);
        }
        consumeForm.reset(); // Limpiar formulario

    } catch (error) {
        displaySpecificResult(consumoResultDiv, `Error al consumir: ${error.message}`, true);
    }
}


// --- Inicialización ---
document.addEventListener('DOMContentLoaded', () => {
    loadToken(); // Intentar cargar token al inicio

    // Asignar manejadores a los formularios y botones
    if (loginForm) loginForm.addEventListener('submit', handleLogin);
    if (logoutButton) logoutButton.addEventListener('click', handleLogout);
    if (checkBalanceForm) checkBalanceForm.addEventListener('submit', handleCheckBalance);
    if (rechargeForm) rechargeForm.addEventListener('submit', handleRecharge);
    if (consumeForm) consumeForm.addEventListener('submit', handleConsume);
});
