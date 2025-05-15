# Simulador Frontend - Beatpass TFG

Este directorio contiene los archivos HTML, CSS y JavaScript para simular la interfaz de usuario de la plataforma Beatpass, interactuando con el backend de Beatpass TFG.
Repositorio del Backend: [https://github.com/EduOlalde/DAW2-TFG-Beatpass.git](https://github.com/EduOlalde/DAW2-TFG-Beatpass.git)

## Propósito

El simulador proporciona dos interfaces web básicas para probar y demostrar las funcionalidades clave del backend:

1.  **Simulador de Venta de Festival (`festival.html`):**
    * Muestra los detalles de un festival (obtenidos de la API según un ID configurable).
    * Lista los tipos de entrada disponibles para ese festival (precio, stock).
    * Permite simular la compra de entradas, introduciendo datos del comprador y utilizando Stripe Elements para el procesamiento (simulado) de tarjetas.
    * Muestra las entradas "compradas" (guardadas localmente) con su código QR generado dinámicamente.
    * Permite nominar una entrada comprada a un asistente específico usando el código QR.

2.  **Simulador de Punto de Venta (POS) (`pos.html`):**
    * Permite iniciar sesión como un usuario con rol CAJERO (u otro con permisos POS) usando la API de autenticación JWT.
    * Una vez autenticado, permite realizar operaciones sobre pulseras NFC asociadas a un festival (ID configurable):
        * Consultar datos y saldo de una pulsera por su UID.
        * Registrar recargas de saldo.
        * Registrar consumos.
        * **Lectura de UID de pulseras mediante Web NFC** (si el navegador/dispositivo es compatible y se otorgan permisos).
        * **Asociación de una pulsera NFC a una entrada existente** mediante el código QR de la entrada y el UID de la pulsera.
        * **Escaneo de códigos QR de entrada mediante la cámara del dispositivo** (usando `jsQR`, si es compatible y se otorgan permisos) para la asociación de pulseras.

## Estructura de Archivos

* `index.html`: Página principal con enlaces a los simuladores.
* `festival.html`: Interfaz del simulador de venta del festival.
* `pos.html`: Interfaz del simulador del punto de venta (POS).
* `festival_simulator.js`: Lógica JavaScript para `festival.html`.
* `pos.js`: Lógica JavaScript para `pos.html`.
* `estilos.css`: Archivo CSS compartido con estilos personalizados.

## Interacción con el Backend

Los simuladores realizan llamadas a la API REST del backend de Beatpass TFG:

### Simulador Festival (`festival.html`):
* `GET /api/festivales/{id}`: Obtener detalles del festival.
* `GET /api/festivales/{id}/entradas`: Obtener tipos de entrada.
* `POST /api/public/venta/iniciar-pago`: Inicia el proceso de pago y obtiene un `client_secret` de Stripe.
* `POST /api/public/venta/confirmar-compra`: Confirma la compra tras el pago en Stripe.
* `POST /api/public/venta/nominar`: Nominar una entrada.

### Simulador POS (`pos.html`):
* `POST /api/auth/login`: Autenticar usuario y obtener token JWT.
* `GET /api/pos/pulseras/{codigoUid}`: Consultar pulsera (requiere JWT).
* `POST /api/pos/pulseras/{codigoUid}/recargar?festivalId={id}`: Recargar pulsera (requiere JWT).
* `POST /api/pos/pulseras/{codigoUid}/consumir`: Registrar consumo (requiere JWT).
* `POST /api/pos/pulseras/asociar-entrada-qr`: Asocia pulsera a entrada (requiere JWT).

## Configuración

En `festival_simulator.js` y `pos.js`:
1.  **`URL_BASE_API`**: URL base del backend Beatpass TFG.
2.  **`CLAVE_PUBLICABLE_STRIPE`** (en `festival_simulator.js`): Clave publicable de Stripe para pruebas.

## Ejecución Local

1.  Asegurar que el backend Beatpass TFG esté en ejecución y accesible.
2.  Abrir `index.html` en un navegador (se recomienda "Live Server" en VS Code).

## Funcionalidades Avanzadas del Navegador

* **Web NFC (`pos.html`):** Para leer UIDs de pulseras.
    * Requiere navegador/dispositivo compatible (ej. Chrome en Android).
    * Requiere contexto seguro (HTTPS), excepto para `localhost`.
    * El usuario debe interactuar con la página y otorgar permiso.
* **Escáner QR (`pos.html`):** Para leer códigos QR de entradas.
    * Utiliza la cámara del dispositivo (`getUserMedia`) y la librería `jsQR`.
    * Requiere navegador/dispositivo compatible.
    * Requiere contexto seguro (HTTPS), excepto para `localhost`.
    * El usuario debe otorgar permiso para el uso de la cámara.

Si estas APIs no están disponibles, los campos UID y QR deberán completarse manualmente.

## Despliegue

Los archivos son estáticos y pueden desplegarse en cualquier servicio de hosting (GitHub Pages, Netlify, etc.).
* Asegurar que `URL_BASE_API` apunte a la URL pública del backend.
* Configurar CORS en el backend para permitir solicitudes desde el dominio del frontend.
* Para Web NFC y escáner QR en producción, el sitio debe servirse sobre **HTTPS**.

