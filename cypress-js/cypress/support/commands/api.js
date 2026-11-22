// Per-resource API client. Every method yields the full Cypress.Response (4xx/5xx do not
// fail the command), so specs assert on `.status` / `.body` themselves.

const apiUrl = (path) => `${Cypress.env("apiUrl")}/api${path}`;

// ── Per-resource client ──────────────────────────────────────────────────

function request(method, path, { body, qs } = {}) {
  return cy.request({ method, url: apiUrl(path), body, qs, failOnStatusCode: false });
}

export const api = {
  auth: {
    register: (user) => {
      const { username, email, password, nombre, apellidos, ubicacion } = user;
      return request("POST", "/register", { body: { username, email, password, nombre, apellidos, ubicacion } });
    },
    login: (identifier, password) => request("POST", "/login", { body: { identifier, password } }),
    me: () => request("GET", "/me"),
    checkAvailability: (query) => request("GET", "/check-availability", { qs: query }),
  },

  profile: {
    update: (fields) => request("PATCH", "/profile", { body: fields }),
    changeEmail: (newEmail, password) =>
      request("PATCH", "/profile/email", { body: { new_email: newEmail, password } }),
    changePassword: (oldPassword, newPassword) =>
      request("PATCH", "/profile/password", { body: { old_password: oldPassword, new_password: newPassword } }),
    remove: (password) => request("DELETE", "/profile", { qs: { password } }),
  },

  favoritos: {
    createList: (nombre, icono = "Heart") => request("POST", "/favoritos/listas", { body: { nombre, icono } }),
    lists: () => request("GET", "/favoritos/listas"),
    getList: (listId) => request("GET", `/favoritos/listas/${listId}`),
    deleteList: (listId) => request("DELETE", `/favoritos/listas/${listId}`),
    addRestaurant: (listId, placeId) => request("POST", `/favoritos/listas/${listId}`, { body: { place_id: placeId } }),
    removeRestaurant: (favoritoId) => request("DELETE", `/favoritos/${favoritoId}`),
  },

  historial: {
    add: (placeId) => request("POST", "/historial", { body: { place_id: placeId } }),
    list: () => request("GET", "/historial"),
    remove: (entryId) => request("DELETE", `/historial/${entryId}`),
  },

  masTarde: {
    add: (placeId) => request("POST", "/mas-tarde", { body: { place_id: placeId } }),
    list: () => request("GET", "/mas-tarde"),
    remove: (entryId) => request("DELETE", `/mas-tarde/${entryId}`),
  },

  valoraciones: {
    // scores: { calidad, precio, higiene, trato }
    create: (placeId, scores, comentario) =>
      request("POST", "/valoraciones", { body: { place_id: placeId, ...scores, comentario } }),
    list: () => request("GET", "/valoraciones"),
    remove: (placeId) => request("DELETE", `/valoraciones/${placeId}`),
  },

  recommendations: {
    // `criteria` overrides the defaults below.
    search: (criteria = {}) =>
      request("POST", "/recommendations/search", {
        body: {
          categories: ["mexican_restaurant"],
          prices: ["PRICE_LEVEL_MODERATE"],
          include_unconfirmed_price: true,
          location: "Gijón, España",
          sort_by: "rating",
          max_results: 5,
          ...criteria,
        },
      }),
  },
};
