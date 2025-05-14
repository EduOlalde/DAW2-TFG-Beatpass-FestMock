# Simulador Frontend - Beatpass TFG

Este directorio contiene los archivos HTML, CSS y JavaScript para simular la interfaz de usuario de la plataforma Beatpass, interactuando con el backend de Beatpass TFG.
Repositorio del Backend: [https://github.com/EduOlalde/DAW2-TFG-Beatpass.git](https://github.com/EduOlalde/DAW2-TFG-Beatpass.git)

## Propósito

El simulador proporciona dos interfaces web básicas para probar y demostrar las funcionalidades clave del backend:

1.  **Simulador de Venta de Festival (`festival.html`):**
    * Muestra los detalles de un festival específico (obtenidos de la API).
    * Lista los tipos de entrada disponibles para ese festival (precio, stock).
    * Permite simular la compra de entradas, introduciendo los datos del comprador y utilizando Stripe Elements para el procesamiento (simulado) de tarjetas.
    * Muestra las entradas "compradas" (guardadas localmente en el navegador) con su código QR generado dinámicamente.
    * Permite nominar una entrada comprada a un asistente específico usando el código QR.

2.  **Simulador de Punto de Venta (POS) (`pos.html`):**
    * Permite iniciar sesión como un usuario con rol CAJERO (u otro rol con permisos POS como ADMIN o PROMOTOR) usando la API de autenticación JWT.
    * Una vez autenticado, permite realizar operaciones sobre pulseras NFC asociadas a un festival específico:
        * Consultar datos y saldo de una pulsera por su UID.
        * Registrar recargas de saldo.
        * Registrar consumos (validando saldo y pertenencia al festival).
        * **Lectura de UID de pulseras mediante Web NFC** (si el navegador y dispositivo son compatibles y se otorgan los permisos necesarios).
        * **Asociación de una pulsera NFC a una entrada existente** mediante el código QR de la entrada y el UID de la pulsera.

## Estructura de Archivos

* `index.html`: Página principal simple con enlaces a los dos simuladores.
* `festival.html`: Interfaz del simulador de venta del festival.
* `pos.html`: Interfaz del simulador del punto de venta (POS).
* `festival_simulator.js`: Lógica JavaScript para `festival.html`.
* `pos.js`: Lógica JavaScript para `pos.html`.
* `estilos.css`: Archivo CSS compartido que incluye estilos personalizados y utilidades (complementa a Tailwind CSS cargado vía CDN en `festival.html` e `index.html`).

## Interacción con el Backend

Estos simuladores realizan llamadas a la API REST del backend de Beatpass TFG:

### Simulador Festival (`festival.html`):
* `GET /api/festivales/{id}`: Obtener detalles del festival.
* `GET /api/festivales/{id}/entradas`: Obtener tipos de entrada.
* `POST /api/public/venta/iniciar-pago`: Inicia el proceso de pago con Stripe y obtiene un `client_secret`.
* `POST /api/public/venta/confirmar-compra`: Confirma la compra después del pago exitoso en Stripe.
* `POST /api/public/venta/nominar`: Nominar una entrada.

### Simulador POS (`pos.html`):
* `POST /api/auth/login`: Autenticar usuario y obtener token JWT.
* `GET /api/pos/pulseras/{codigoUid}`: Consultar pulsera (requiere JWT).
* `POST /api/pos/pulseras/{codigoUid}/recargar?festivalId={id}`: Recargar pulsera (requiere JWT y `festivalId` como QueryParam).
* `POST /api/pos/pulseras/{codigoUid}/consumir`: Registrar consumo (requiere JWT; `idFestival`, `monto`, `descripcion` en el cuerpo).
* `POST /api/pos/pulseras/asociar-entrada-qr`: Asocia una pulsera NFC a una entrada mediante el código QR de la entrada (requiere JWT; `codigoQrEntrada`, `codigoUidPulsera`, `idFestival` en el cuerpo).

## Configuración

Antes de usar los simuladores, necesitas configurar las siguientes constantes dentro de los archivos JavaScript (`festival_simulator.js` y `pos.js`):

1.  **`URL_BASE_API`**: Debe apuntar a la URL base donde está desplegado tu backend Beatpass TFG (ej: `http://localhost:8080/BeatpassTFG/api` para pruebas locales o `https://tu-backend.onrender.com/api` para producción).
2.  **`CLAVE_PUBLICABLE_STRIPE`** (en `festival_simulator.js`): Debe ser tu clave publicable de Stripe para pruebas (ej: `pk_test_xxxxxxxxxxxx`).

## Ejecución Local

1.  Asegúrate de que el backend Beatpass TFG esté ejecutándose y accesible desde la URL configurada en `URL_BASE_API`.
2.  Abre el archivo `index.html` en tu navegador.
    * *Recomendado:* Usa una extensión como "Live Server" en VS Code para servir los archivos localmente. Esto evita posibles problemas de CORS si el backend está también en `localhost` y ayuda con la recarga automática.
3.  Navega entre el simulador de festival y el simulador POS usando los enlaces proporcionados.

## Funcionalidad Web NFC

La lectura de etiquetas NFC en `pos.html` utiliza la **Web NFC API**. Esta API tiene las siguientes consideraciones:
* Solo está disponible en navegadores y dispositivos compatibles (principalmente Chrome en Android).
* Requiere un contexto seguro (HTTPS), excepto para `localhost`.
* El usuario debe interactuar con la página (ej. hacer clic en un botón) antes de que se pueda iniciar el escaneo NFC.
* El usuario deberá otorgar permiso al sitio para usar NFC.

Si Web NFC no está disponible, los campos UID deberán completarse manualmente.

## Despliegue

Estos archivos HTML, CSS y JS son estáticos y pueden desplegarse fácilmente en cualquier servicio de hosting estático, como **GitHub Pages**, Netlify, Vercel, etc.

**Importante para el despliegue:**

* Asegúrate de que `URL_BASE_API` en los archivos JS apunte a la URL **pública** de tu backend desplegado (ej: la URL de Render).
* Verifica que la configuración CORS en el `web.xml` (o la configuración de CORS de tu framework Java si no usas `web.xml` directamente para esto) de tu backend permita solicitudes desde el dominio donde despliegues el simulador (ej: `https://tu-usuario.github.io`).
* Para que Web NFC funcione en producción, el sitio debe servirse sobre **HTTPS**.
