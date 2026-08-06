// Mirrors selenium-java's common/BaseApiClass.java: URL builders, payload
// factories, HTTP verb helpers, and CRUD helpers shared by every API spec.

// A stable Google Places ID used as a test restaurant across specs.
export const TEST_PLACE_ID = "ChIJN1t_tDeuEmsRUsoyG83frY4";

// ── URL builders ─────────────────────────────────────────────────────────

export function apiUrl(path) {
  return `${Cypress.env("apiUrl")}/api${path}`;
}
export function authUrl(path) {
  return apiUrl(path);
}
export function favoritosUrl(path) {
  return apiUrl(`/favoritos${path}`);
}
export function historialUrl(path) {
  return apiUrl(`/historial${path}`);
}
export function masTardeUrl(path) {
  return apiUrl(`/mas-tarde${path}`);
}
export function valoracionesUrl(path) {
  return apiUrl(`/valoraciones${path}`);
}
export function recommendationsUrl(path) {
  return apiUrl(`/recommendations${path}`);
}

// ── Uniqueness helpers ───────────────────────────────────────────────────

export function uniqueTs() {
  return Date.now();
}
export function uniqueEmail(ts) {
  return `testuser${ts}@devorapp.test`;
}
export function uniqueUsername(ts) {
  const raw = `tst${ts}`;
  return raw.length > 30 ? raw.slice(-30) : raw;
}

// ── Payload builders ─────────────────────────────────────────────────────

export function registerPayload(username, email, password, nombre = "Test", apellidos = "User", ubicacion = "") {
  return { username, email, password, nombre, apellidos, ubicacion };
}

export function loginPayload(identifier, password) {
  return { identifier, password };
}

export function listaPayload(nombre, icono = "Heart") {
  return { nombre, icono };
}

function placeIdPayload(placeId) {
  return { place_id: placeId };
}
export const favoritoPayload = placeIdPayload;
export const masTardePayload = placeIdPayload;
export const historialPayload = placeIdPayload;

export function valoracionPayload(placeId, calidad, precio, higiene, trato, comentario) {
  return { place_id: placeId, calidad, precio, higiene, trato, comentario };
}

export function profileUpdatePayload(nombre, apellidos, ubicacion, password) {
  return { nombre, apellidos, ubicacion, password };
}

export function popularesPayload(limit) {
  return { limit };
}

export function searchPayload(categories, prices, includeUnconfirmedPrice, location, maxResults) {
  return {
    categories,
    prices,
    include_unconfirmed_price: includeUnconfirmedPrice,
    location,
    sort_by: "rating",
    max_results: maxResults,
  };
}

// ── HTTP verb commands ───────────────────────────────────────────────────
// Each yields the full Cypress.Response so callers assert `.status` / `.body`
// directly - replaces Java's separate "status-only" helper methods.

Cypress.Commands.add("apiGet", (url) => {
  return cy.request({ method: "GET", url, failOnStatusCode: false });
});

Cypress.Commands.add("apiPost", (url, body) => {
  return cy.request({ method: "POST", url, body, failOnStatusCode: false });
});

Cypress.Commands.add("apiPatch", (url, body) => {
  return cy.request({ method: "PATCH", url, body, failOnStatusCode: false });
});

Cypress.Commands.add("apiDelete", (url, qs) => {
  return cy.request({ method: "DELETE", url, qs, failOnStatusCode: false });
});

// ── CRUD helpers ─────────────────────────────────────────────────────────

Cypress.Commands.add("createLista", (nombre) => {
  return cy.apiPost(favoritosUrl("/listas"), listaPayload(nombre)).then((res) => res.body.id);
});

Cypress.Commands.add("addFavorito", (listaId, placeId) => {
  return cy
    .apiPost(favoritosUrl(`/listas/${listaId}`), favoritoPayload(placeId))
    .then((res) => res.body.id);
});

Cypress.Commands.add("addHistorial", (placeId) => {
  return cy.apiPost(historialUrl(""), historialPayload(placeId)).then((res) => res.body.id);
});

Cypress.Commands.add("addMasTarde", (placeId) => {
  return cy.apiPost(masTardeUrl(""), masTardePayload(placeId)).then((res) => res.body.id);
});

Cypress.Commands.add("createValoracion", (placeId, calidad, precio, higiene, trato, comentario) => {
  return cy
    .apiPost(valoracionesUrl(""), valoracionPayload(placeId, calidad, precio, higiene, trato, comentario))
    .then((res) => res.body);
});

Cypress.Commands.add("getDefaultListaId", () => {
  return cy.apiGet(favoritosUrl("/listas")).then((res) => {
    const listas = res.body || [];
    const found = listas.find((l) => l.nombre === "Favoritos");
    return found ? found.id : -1;
  });
});
