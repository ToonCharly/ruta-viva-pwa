"use strict";

const DB_NAME = "ruta-viva-db";
const STORE_NAME = "savedPlaces";
let db;
let deferredInstallPrompt;
let map;
let markers = [];

const seedPlaces = [
  {
    id: "seed-museo",
    name: "Museo Nacional de Antropología",
    category: "Museo",
    description: "Una colección esencial para conocer las culturas de México.",
    image: "https://images.unsplash.com/photo-1564399579883-451a5d44ec08?auto=format&fit=crop&w=900&q=80",
    lat: 19.4261,
    lon: -99.1862,
    note: ""
  },
  {
    id: "seed-castillo",
    name: "Castillo de Chapultepec",
    category: "Monumento",
    description: "Un mirador histórico rodeado por el bosque de Chapultepec.",
    image: "https://images.unsplash.com/photo-1568322445389-f64ac2515020?auto=format&fit=crop&w=900&q=80",
    lat: 19.4204,
    lon: -99.1818,
    note: ""
  },
  {
    id: "seed-bosque",
    name: "Jardín Botánico",
    category: "Naturaleza",
    description: "Plantas, senderos tranquilos y áreas para descansar.",
    image: "https://images.unsplash.com/photo-1534219575443-d9a5ed7a1939?auto=format&fit=crop&w=900&q=80",
    lat: 19.4128,
    lon: -99.1929,
    note: ""
  }
];

function openDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        database.createObjectStore(STORE_NAME, { keyPath: "id" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function dbAction(mode, data) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, mode === "getAll" ? "readonly" : "readwrite");
    const store = transaction.objectStore(STORE_NAME);
    let request;
    if (mode === "getAll") request = store.getAll();
    if (mode === "put") request = store.put(data);
    if (mode === "delete") request = store.delete(data);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;"
  })[character]);
}

function placeCard(place, saved = false) {
  const id = escapeHtml(place.id);
  const name = escapeHtml(place.name);
  const category = escapeHtml(place.category);
  const description = escapeHtml(place.description);
  const image = escapeHtml(place.image || "icons/icon-512.svg");
  const note = place.note ? `<p><strong>Nota:</strong> ${escapeHtml(place.note)}</p>` : "";
  const source = place.sourceUrl
    ? `<a class="source-link" href="${escapeHtml(place.sourceUrl)}" target="_blank" rel="noopener noreferrer">Fuente: Wikipedia</a>`
    : "";
  const buttons = saved
    ? `<button class="small-action" data-edit="${id}" type="button">Editar</button>
       <button class="small-action" data-delete="${id}" type="button">Eliminar</button>
       <button class="small-action primary" data-share="${id}" type="button">Compartir</button>
       <button class="small-action" data-saved-route="${id}" type="button">Ver ruta</button>`
    : `<button class="small-action primary" data-save="${id}" type="button">Guardar</button>
       <button class="small-action" data-route="${id}" type="button">Ver ruta</button>`;
  return `<article class="place-card">
    <img class="place-image" src="${image}" alt="${name}" loading="lazy" />
    <div class="place-body">
      <span class="place-category">${category}</span>
      <h3>${name}</h3>
      <p>${description}</p>
      ${source}
      ${note}
      <div class="place-actions">${buttons}</div>
    </div>
  </article>`;
}

function renderPlaces(places) {
  const grid = document.querySelector("#placesGrid");
  grid.innerHTML = places.length
    ? places.map((place) => placeCard(place)).join("")
    : '<div class="empty">No encontramos lugares con ese criterio.</div>';
  drawMarkers(places);
}

async function renderSaved() {
  const places = await dbAction("getAll");
  const grid = document.querySelector("#savedGrid");
  grid.innerHTML = places.length
    ? places.map((place) => placeCard(place, true)).join("")
    : '<div class="empty">Aún no tienes lugares guardados. Pulsa “Guardar” en alguno.</div>';
}

async function savePlace(place) {
  if (!place.id) {
    place.id = typeof crypto?.randomUUID === "function"
      ? `place-${crypto.randomUUID()}`
      : `place-${Date.now()}`;
  }
  await dbAction("put", place);
  await renderSaved();
  showToast("Lugar guardado");
}

function showToast(message) {
  const toast = document.querySelector("#toast");
  toast.textContent = message;
  toast.classList.add("visible");
  window.clearTimeout(showToast.timer);
  showToast.timer = window.setTimeout(() => toast.classList.remove("visible"), 2600);
}

function mapTourismElements(data) {
  if (Array.isArray(data)) return data;
  return data.elements
    .filter((element) => element.tags?.name)
    .map((element, index) => {
      const latitude = element.lat || element.center?.lat;
      const longitude = element.lon || element.center?.lon;
      return {
        id: `api-${element.type}-${element.id}`,
        name: element.tags.name,
        category: element.tags.tourism === "museum" ? "Museo" : "Monumento",
        description: element.tags["description"]
          || (element.tags["tourism"] === "viewpoint"
            ? "Sitio turístico recomendado por OpenStreetMap."
            : "Sitio de interés para visitar durante tu recorrido."),
        image: seedPlaces[index % seedPlaces.length].image,
        lat: latitude,
        lon: longitude
      };
    })
    .filter((place) => place.lat && place.lon);
}

async function requestTourismData(overpassQuery) {
  const endpoints = [
    "https://overpass-api.de/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
    "https://overpass.private.coffee/api/interpreter"
  ];
  let lastError;

  for (const endpoint of endpoints) {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 12000);
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Accept": "application/json",
          "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8"
        },
        body: new URLSearchParams({ data: overpassQuery }),
        signal: controller.signal
      });
      if (!response.ok) {
        lastError = new Error(`Overpass respondió ${response.status}`);
        continue;
      }
      return await response.json();
    } catch (error) {
      lastError = error;
    } finally {
      window.clearTimeout(timeout);
    }
  }

  throw lastError || new Error("No hay servidores Overpass disponibles");
}

async function requestWikipediaPlaces(lat, lon, query) {
  const parameters = new URLSearchParams({
    action: "query",
    list: "geosearch",
    gscoord: `${lat}|${lon}`,
    gsradius: "10000",
    gslimit: "24",
    format: "json",
    origin: "*"
  });
  const response = await fetch(`https://es.wikipedia.org/w/api.php?${parameters}`);
  if (!response.ok) throw new Error(`Wikipedia respondió ${response.status}`);
  const data = await response.json();
  const search = query.trim().toLocaleLowerCase();
  return (data.query?.geosearch || [])
    .filter((place) => !search || place.title.toLocaleLowerCase().includes(search))
    .map((place, index) => ({
      id: `wiki-${place.pageid}`,
      name: place.title,
      category: "Punto de interés",
      description: `Lugar cercano a ${place.dist < 1000
        ? `${Math.round(place.dist)} m`
        : `${(place.dist / 1000).toFixed(1)} km`}.`,
      image: seedPlaces[index % seedPlaces.length].image,
      lat: place.lat,
      lon: place.lon,
      sourceUrl: `https://es.wikipedia.org/?curid=${encodeURIComponent(place.pageid)}`
    }));
}

async function getCachedTourismData() {
  if (!("caches" in window)) return null;
  const cache = await caches.open("tourism-api");
  const cacheKey = new URL("./api-cache/tourism.json", window.location.href).toString();
  const cached = await cache.match(cacheKey);
  return cached ? cached.json() : null;
}

async function cacheTourismData(data) {
  if (!("caches" in window)) return;
  try {
    const cache = await caches.open("tourism-api");
    const cacheKey = new URL("./api-cache/tourism.json", window.location.href).toString();
    await cache.put(cacheKey, new Response(JSON.stringify(data), {
      headers: { "Content-Type": "application/json" }
    }));
  } catch (error) {
    console.warn("No se pudo guardar la respuesta de lugares en caché.", error);
  }
}

async function fetchTourismPlaces(query = "") {
  const grid = document.querySelector("#placesGrid");
  grid.innerHTML = '<div class="empty">Buscando lugares cercanos...</div>';

  const lat = state.userLocation?.lat || 19.4326;
  const lon = state.userLocation?.lon || -99.1332;
  const radius = 15000;
  const textFilter = query.trim() ? `[name~"${query.replace(/["\\]/g, "")}",i]` : "";
  const overpassQuery = `
    [out:json][timeout:12];
    (
      nwr["tourism"="museum"]${textFilter}(around:${radius},${lat},${lon});
      nwr["tourism"="attraction"]${textFilter}(around:${radius},${lat},${lon});
      nwr["tourism"="viewpoint"]${textFilter}(around:${radius},${lat},${lon});
    );
    out center 24;
  `;

  try {
    const data = await requestTourismData(overpassQuery);
    await cacheTourismData(data);
    const places = mapTourismElements(data);
    const visiblePlaces = places.length ? places : seedPlaces;
    state.places = visiblePlaces;
    renderPlaces(visiblePlaces);
  } catch (error) {
    let fallbackPlaces = [];
    try {
      fallbackPlaces = await requestWikipediaPlaces(lat, lon, query);
      if (fallbackPlaces.length) {
        await cacheTourismData(fallbackPlaces);
        showToast("Overpass está saturado; mostramos lugares cercanos de Wikipedia");
      }
    } catch (wikipediaError) {
      console.warn("No se pudo consultar la fuente turística de respaldo.", wikipediaError);
    }
    if (!fallbackPlaces.length) {
      try {
        const cachedData = await getCachedTourismData();
        fallbackPlaces = cachedData ? mapTourismElements(cachedData) : [];
      } catch (cacheError) {
        console.warn("No se pudo leer la caché de lugares.", cacheError);
      }
    }
    const visiblePlaces = fallbackPlaces.length ? fallbackPlaces : seedPlaces;
    state.places = visiblePlaces;
    renderPlaces(visiblePlaces);
    if (!fallbackPlaces.length) {
      showToast("APIs no disponibles; mostrando lugares de ejemplo");
    } else if (fallbackPlaces.every((place) => place.sourceUrl === undefined)) {
      showToast("API temporalmente no disponible; mostramos tus últimos lugares consultados");
    }
  }
}

const state = { userLocation: null };

function initMap() {
  if (!window.L) {
    document.querySelector("#map").innerHTML = '<div class="empty">El mapa requiere conexión para cargar.</div>';
    return;
  }
  map = L.map("map").setView([19.4326, -99.1332], 12);
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: "&copy; OpenStreetMap"
  }).addTo(map);
  drawMarkers(seedPlaces);
}

function drawMarkers(places) {
  if (!map || !window.L) return;
  markers.forEach((marker) => marker.remove());
  markers = [];
  places.forEach((place) => {
    if (!place.lat || !place.lon) return;
    const marker = L.marker([place.lat, place.lon]).addTo(map);
    marker.bindPopup(`<strong>${escapeHtml(place.name)}</strong><br>${escapeHtml(place.category)}`);
    markers.push(marker);
  });
  const valid = places.filter((place) => place.lat && place.lon);
  if (valid.length) {
    const bounds = L.latLngBounds(valid.map((place) => [place.lat, place.lon]));
    map.fitBounds(bounds, { padding: [30, 30], maxZoom: 14 });
  }
}

function openPlaceDialog(place) {
  document.querySelector("#dialogTitle").textContent = place ? "Editar lugar" : "Agregar lugar";
  document.querySelector("#placeId").value = place?.id || "";
  document.querySelector("#placeName").value = place?.name || "";
  document.querySelector("#placeCategory").value = place?.category || "Museo";
  document.querySelector("#placeDescription").value = place?.description || "";
  document.querySelector("#placeImage").value = place?.image || "";
  document.querySelector("#placeNote").value = place?.note || "";
  document.querySelector("#placeDialog").showModal();
}

async function sharePlace(place) {
  const url = `https://www.openstreetmap.org/?mlat=${place.lat || 19.4326}&mlon=${place.lon || -99.1332}&zoom=15`;
  try {
    if (navigator.share) {
      await navigator.share({ title: place.name, text: place.description, url });
    } else {
      await navigator.clipboard.writeText(`${place.name}: ${url}`);
      showToast("Enlace copiado");
    }
  } catch (error) {
    if (error.name !== "AbortError") showToast("No se pudo compartir el lugar");
  }
}

function updateConnectionStatus() {
  const status = document.querySelector("#connectionStatus");
  status.textContent = navigator.onLine ? "Conectado" : "Sin conexión";
  status.classList.toggle("offline", !navigator.onLine);
  if (!navigator.onLine) showToast("Estás trabajando sin conexión");
}

function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return;

  const hadController = Boolean(navigator.serviceWorker.controller);
  if (hadController) {
    let refreshing = false;
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (refreshing) return;
      refreshing = true;
      window.location.reload();
    }, { once: true });
  }

  navigator.serviceWorker.register("./sw.js", { updateViaCache: "none" })
    .then((registration) => {
      registration.update().catch((error) => {
        console.warn("No se pudo comprobar si hay una actualización PWA.", error);
      });
    })
    .catch((error) => {
      console.error("No se pudo registrar el Service Worker.", error);
      showToast("No se pudo activar el modo offline");
    });
}

async function locateUser() {
  if (!navigator.geolocation) {
    showToast("Geolocalización no disponible");
    return;
  }
  showToast("Obteniendo ubicación...");
  navigator.geolocation.getCurrentPosition(
    (position) => {
      state.userLocation = {
        lat: position.coords.latitude,
        lon: position.coords.longitude
      };
      if (map) {
        map.setView([state.userLocation.lat, state.userLocation.lon], 13);
        L.marker([state.userLocation.lat, state.userLocation.lon])
          .addTo(map)
          .bindPopup("Tu ubicación")
          .openPopup();
      }
      fetchTourismPlaces();
      showToast("Ubicación encontrada");
    },
    () => showToast("No pudimos acceder a tu ubicación"),
    { enableHighAccuracy: true, timeout: 10000 }
  );
}

const installButton = document.querySelector("#installButton");
const isInstalledApp = () =>
  window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true;

installButton.hidden = isInstalledApp();

window.addEventListener("beforeinstallprompt", (event) => {
  event.preventDefault();
  if (isInstalledApp()) return;
  deferredInstallPrompt = event;
  installButton.hidden = false;
});

window.addEventListener("appinstalled", () => {
  deferredInstallPrompt = null;
  installButton.hidden = true;
});

installButton.addEventListener("click", async () => {
  if (!deferredInstallPrompt) return;
  deferredInstallPrompt.prompt();
  await deferredInstallPrompt.userChoice;
  deferredInstallPrompt = null;
  installButton.hidden = true;
});

document.querySelector("#locateButton").addEventListener("click", locateUser);
document.querySelector("#searchForm").addEventListener("submit", (event) => {
  event.preventDefault();
  fetchTourismPlaces(document.querySelector("#searchInput").value);
});
document.querySelector("#addButton").addEventListener("click", () => openPlaceDialog());
document.querySelector("#closeDialog").addEventListener("click", () =>
  document.querySelector("#placeDialog").close()
);

document.querySelector("#placeForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const id = document.querySelector("#placeId").value;
  const place = {
    id: id || undefined,
    name: document.querySelector("#placeName").value.trim(),
    category: document.querySelector("#placeCategory").value,
    description: document.querySelector("#placeDescription").value.trim(),
    image: document.querySelector("#placeImage").value.trim(),
    note: document.querySelector("#placeNote").value.trim()
  };
  if (!place.name || !place.description) {
    showToast("Completa los campos obligatorios");
    return;
  }
  await savePlace(place);
  form.reset();
  document.querySelector("#placeDialog").close();
});

document.addEventListener("click", async (event) => {
  const saveButton = event.target.closest("[data-save]");
  const editButton = event.target.closest("[data-edit]");
  const deleteButton = event.target.closest("[data-delete]");
  const shareButton = event.target.closest("[data-share]");
  const routeButton = event.target.closest("[data-route]");
  const savedRouteButton = event.target.closest("[data-saved-route]");

  if (saveButton) {
    const place = state.places?.find((item) => item.id === saveButton.dataset.save);
    if (place) {
      await savePlace(place);
    } else {
      showToast("El lugar ya no está disponible");
    }
  }
  if (editButton) {
    const places = await dbAction("getAll");
    openPlaceDialog(places.find((place) => place.id === editButton.dataset.edit));
  }
  if (deleteButton) {
    if (window.confirm("¿Eliminar este lugar guardado?")) {
      await dbAction("delete", deleteButton.dataset.delete);
      await renderSaved();
      showToast("Lugar eliminado");
    }
  }
  if (shareButton) {
    const places = await dbAction("getAll");
    const place = places.find((item) => item.id === shareButton.dataset.share);
    if (place) await sharePlace(place);
  }
  if (routeButton) {
    const place = state.places?.find((item) => item.id === routeButton.dataset.route);
    openRoute(place);
  }
  if (savedRouteButton) {
    const places = await dbAction("getAll");
    const place = places.find((item) => item.id === savedRouteButton.dataset.savedRoute);
    openRoute(place);
  }
});

function openRoute(place) {
  if (place?.lat && place?.lon) {
    const origin = state.userLocation
      ? `&from=${state.userLocation.lat}%2C${state.userLocation.lon}`
      : "";
    window.open(
      `https://www.openstreetmap.org/directions?engine=fossgis_osrm_car${origin}&to=${place.lat}%2C${place.lon}`,
      "_blank",
      "noopener,noreferrer"
    );
  } else if (place) {
    window.open(
      `https://www.openstreetmap.org/search?query=${encodeURIComponent(place.name)}`,
      "_blank",
      "noopener,noreferrer"
    );
  } else {
    showToast("No pudimos abrir la ruta");
  }
}

window.addEventListener("online", updateConnectionStatus);
window.addEventListener("offline", updateConnectionStatus);

async function init() {
  db = await openDatabase();
  registerServiceWorker();
  initMap();
  await renderSaved();
  state.places = seedPlaces;
  await fetchTourismPlaces();
  updateConnectionStatus();
}

init();
