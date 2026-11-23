# Documento técnico - Ruta Viva

## Portada
- Proyecto: Ruta Viva - Guía Turística Interactiva
- Asignatura: Aplicaciones Web Progresivas
- División: Tecnologías de la Información
- Fecha: Noviembre de 2026

## Problemática
Las personas visitantes suelen depender de conexión móvil y consultan varias aplicaciones para conocer lugares cercanos, guardar información y obtener una ruta.

## Objetivos
- Mostrar lugares turísticos mediante una API REST.
- Permitir guardar, editar y eliminar lugares sin conexión.
- Usar geolocalización y mapas para orientar al usuario.
- Permitir compartir destinos y rutas.
- Instalar la aplicación y operar mediante caché.

## Arquitectura
El proyecto usa una arquitectura PWA de cliente:

1. HTML, CSS y JavaScript forman la interfaz.
2. Overpass/OpenStreetMap proporciona información turística; la búsqueda geográfica de Wikipedia sirve como fuente de respaldo si Overpass no está disponible.
3. Leaflet representa el mapa y sus marcadores.
4. IndexedDB almacena los lugares guardados.
5. El Service Worker controla caché de la aplicación y mapas.
6. Web Manifest habilita instalación.

## Tecnologías
- HTML5, CSS3 y JavaScript.
- Web App Manifest.
- Service Worker.
- IndexedDB.
- Leaflet y OpenStreetMap.
- Overpass API.
- Wikipedia GeoSearch API (respaldo y atribución a las páginas de origen).
- APIs Geolocation y Web Share.

## Funcionalidades CRUD
- Crear: formulario de nuevo lugar.
- Leer: lugares recomendados y colección guardada.
- Actualizar: edición de campos desde la colección.
- Eliminar: confirmación y eliminación de IndexedDB.

## Seguridad
- Validación HTML y JavaScript.
- Escape de datos antes de imprimirlos.
- Content Security Policy.
- Operación mediante HTTPS en producción.
- No se almacenan contraseñas ni datos sensibles.

## Pruebas requeridas
Completar con capturas:
- Lighthouse: rendimiento, accesibilidad, mejores prácticas y PWA.
- Chrome móvil: instalación, geolocalización, CRUD y offline.
- Segundo dispositivo o navegador: responsividad e instalación.
- API: solicitud y respuesta de Overpass.
- Offline: recarga sin conexión y consulta de lugares guardados.

## Evidencias
Las capturas deben colocarse en `evidencias/` y referenciarse desde `EVIDENCIAS.md`.
