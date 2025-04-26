# Simulador Frontend - Beatpass TFG

Este directorio contiene los archivos HTML, CSS y JavaScript para simular la interfaz de usuario de la plataforma Beatpass, interactuando con el backend de Beatpass TFG.

## Propósito

El simulador proporciona dos interfaces web básicas para probar y demostrar las funcionalidades clave del backend:

1.  **Simulador de Venta de Festival (`festival.html`):**
    * Muestra los detalles de un festival específico (obtenidos de la API).
    * Lista los tipos de entrada disponibles para ese festival (precio, stock).
    * Permite simular la compra de entradas, introduciendo los datos del comprador.
    * Muestra las entradas "compradas" (guardadas localmente en el navegador) con su código QR.
    * Permite nominar una entrada comprada a un asistente específico usando el código QR.
2.  **Simulador de Punto de Venta (POS) (`pos.html`):**
    * Permite iniciar sesión como un usuario con rol CAJERO (o ADMIN/PROMOTOR) usando la API de autenticación JWT.
    * Una vez autenticado, permite realizar operaciones sobre pulseras NFC asociadas a un festival específico:
        * Consultar datos y saldo de una pulsera por su UID.
        * Registrar recargas de saldo.
        * Registrar consumos (validando saldo y pertenencia al festival).

## Estructura de Archivos

* `index.html`: Página principal simple con enlaces a los dos simuladores.
* `festival.html`: Interfaz del simulador de venta del festival.
* `pos.html`: Interfaz del simulador del punto de venta (POS).
* `festival_simulator.js`: Lógica JavaScript para `festival.html`.
* `pos_simulator.js`: Lógica JavaScript para `pos.html`.
* `estilos.css`: Archivo CSS compartido que incluye estilos personalizados y utilidades (complementa a Tailwind CSS cargado vía CDN en los HTML).

## Interacción con el Backend

Estos simuladores realizan llamadas a la API REST del backend de Beatpass TFG:

* **Simulador Festival (`festival.html`):**
    * `GET /api/festivales/{id}`: Obtener detalles del festival.
    * `GET /api/festivales/{id}/entradas`: Obtener tipos de entrada.
    * `POST /api/public/venta/comprar`: Registrar una compra.
    * `POST /api/public/venta/nominar`: Nominar una entrada.
* **Simulador POS (`pos.html`):**
    * `POST /api/auth/login`: Autenticar usuario y obtener token JWT.
    * `GET /api/pos/pulseras/{uid}`: Consultar pulsera (requiere JWT).
    * `POST /api/pos/pulseras/{uid}/recargar?festivalId={id}`: Recargar pulsera (requiere JWT y `festivalId`).
    * `POST /api/pos/pulseras/{uid}/consumir`: Registrar consumo (requiere JWT, `idFestival` va en el cuerpo).

## Configuración

Antes de usar los simuladores, necesitas configurar las siguientes constantes dentro de los archivos JavaScript (`festival_simulator.js` y `pos_simulator.js`):

1.  **`API_BASE_URL`**: Debe apuntar a la URL base donde está desplegado tu backend Beatpass TFG (ej: `http://localhost:8080/BeatpassTFG/api` para pruebas locales o `https://tu-backend.onrender.com/api` para producción).
2.  **`FESTIVAL_ID`** (en `festival_simulator.js`): Establece el ID del festival que quieres simular en la página de venta. Asegúrate de que este festival exista y esté en estado `PUBLICADO` en tu base de datos.
3.  **`value` del input `posFestivalId`** (en `pos.html`): Establece el ID del festival para el cual operará el simulador POS. Asegúrate de que exista en tu base de datos. El JavaScript (`pos_simulator.js`) leerá este valor para las operaciones de recarga y consumo.

## Ejecución Local

1.  Asegúrate de que el backend Beatpass TFG esté ejecutándose y accesible desde la URL configurada en `API_BASE_URL`.
2.  Abre el archivo `index.html` en tu navegador.
    * *Recomendado:* Usa una extensión como "Live Server" en VS Code para servir los archivos localmente. Esto evita posibles problemas de CORS si el backend está también en `localhost` y ayuda con la recarga automática.
3.  Navega entre el simulador de festival y el simulador POS usando los enlaces proporcionados.

## Despliegue

Estos archivos HTML, CSS y JS son estáticos y pueden desplegarse fácilmente en cualquier servicio de hosting estático, como **GitHub Pages**.

**Importante para el despliegue:**

* Asegúrate de que `API_BASE_URL` en los archivos JS apunte a la URL **pública** de tu backend desplegado (ej: la URL de Render).
* Verifica que la configuración CORS en el `web.xml` de tu backend permita solicitudes desde el dominio donde despliegues el simulador (ej: `https://tu-usuario.github.io`).

