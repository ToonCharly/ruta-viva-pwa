"use strict";

const fs = require("fs");
const path = require("path");
const root = path.resolve(__dirname, "..");

const requiredFiles = [
  "index.html", "styles.css", "app.js", "sw.js", "manifest.json"
];
const missing = requiredFiles.filter((file) => !fs.existsSync(path.join(root, file)));
if (missing.length) throw new Error(`Faltan archivos: ${missing.join(", ")}`);

const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const app = fs.readFileSync(path.join(root, "app.js"), "utf8");
const sw = fs.readFileSync(path.join(root, "sw.js"), "utf8");
const manifest = JSON.parse(fs.readFileSync(path.join(root, "manifest.json"), "utf8"));

const checks = [
  [html.includes('name="theme-color"'), "meta theme-color"],
  [html.includes('rel="manifest"'), "manifest vinculado"],
  [html.includes('id="map"'), "contenedor de mapa"],
  [html.includes('id="placeDialog"'), "formulario CRUD"],
  [app.includes("indexedDB.open"), "IndexedDB"],
  [app.includes("navigator.geolocation"), "geolocalizacion"],
  [app.includes("navigator.share"), "compartir"],
  [app.includes("overpass-api.de"), "API REST"],
  [app.includes("crypto.randomUUID"), "generacion segura de IDs"],
  [sw.includes("addEventListener(\"fetch\""), "Service Worker fetch"],
  [manifest.start_url === "./", "start_url del manifest"],
  [manifest.icons.length >= 2, "iconos del manifest"]
];

const failures = checks.filter(([passed]) => !passed).map(([, label]) => label);
if (failures.length) throw new Error(`Pruebas fallidas: ${failures.join(", ")}`);

console.log(`OK: ${checks.length} verificaciones del proyecto PWA`);
