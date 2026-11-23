# Ruta Viva

PWA de guía turística interactiva desarrollada con HTML, CSS y JavaScript.

## Sitio publicado

https://tooncharly.github.io/ruta-viva-pwa/

## Ejecutar

Publica el proyecto mediante un servidor HTTPS. Para una prueba local:

```bash
python -m http.server 8080
```

Abre `http://localhost:8080`.

## Funcionalidades

- Diseño responsivo.
- Manifest y Service Worker con recursos offline.
- Instalación como aplicación.
- Consulta REST a la API de Overpass/OpenStreetMap.
- Geolocalización y mapa con Leaflet/OpenStreetMap.
- Compartir lugares mediante Web Share API o portapapeles.
- CRUD de lugares mediante IndexedDB.
- Estados de conexión y manejo básico de errores.

## Pruebas

Ejecute:

```bash
npm test
```

Los reportes Lighthouse se encuentran en `evidencias/lighthouse.report.html` y `evidencias/lighthouse.report.json`.
