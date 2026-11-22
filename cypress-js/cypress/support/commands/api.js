// Per-resource API client. Every method yields the full Cypress.Response (4xx/5xx do not
// fail the command), so specs assert on `.status` / `.body` themselves.

const apiUrl = (path) => `${Cypress.expose("apiUrl")}/api/v1${path}`;

// ── Per-resource client ──────────────────────────────────────────────────

function request(method, path, { body, qs } = {}) {
  return cy.request({ method, url: apiUrl(path), body, qs, failOnStatusCode: false });
}

export const api = {
  auth: {
    register: (user) => {
      const { username, email, password, first_name, last_name, location } = user;
      return request("POST", "/users", { body: { username, email, password, first_name, last_name, location } });
    },
    login: (identifier, password) => request("POST", "/sessions", { body: { identifier, password } }),
    logout: () => request("DELETE", "/sessions/current"),
    me: () => request("GET", "/me"),
    checkAvailability: (query) => request("GET", "/users/availability", { qs: query }),
  },

  profile: {
    update: (fields) => request("PATCH", "/profile", { body: fields }),
    changeEmail: (newEmail, password) =>
      request("PATCH", "/profile/email", { body: { new_email: newEmail, password } }),
    changePassword: (oldPassword, newPassword) =>
      request("PATCH", "/profile/password", { body: { old_password: oldPassword, new_password: newPassword } }),
    remove: (password) => request("DELETE", "/profile", { qs: { password } }),
  },

  favorites: {
    createList: (name, icon = "Heart") => request("POST", "/favorites/lists", { body: { name, icon } }),
    lists: () => request("GET", "/favorites/lists"),
    getList: (listId) => request("GET", `/favorites/lists/${listId}`),
    deleteList: (listId) => request("DELETE", `/favorites/lists/${listId}`),
    addRestaurant: (listId, placeId) =>
      request("POST", `/favorites/lists/${listId}/restaurants`, { body: { place_id: placeId } }),
    removeRestaurant: (listId, favoriteId) => request("DELETE", `/favorites/lists/${listId}/restaurants/${favoriteId}`),
  },

  history: {
    add: (placeId) => request("POST", "/history", { body: { place_id: placeId } }),
    list: (qs) => request("GET", "/history", { qs }),
    get: (entryId) => request("GET", `/history/${entryId}`),
    popular: (qs) => request("GET", "/history/popular", { qs }),
    remove: (entryId) => request("DELETE", `/history/${entryId}`),
  },

  savedForLater: {
    add: (placeId) => request("POST", "/saved-for-later", { body: { place_id: placeId } }),
    list: (qs) => request("GET", "/saved-for-later", { qs }),
    get: (entryId) => request("GET", `/saved-for-later/${entryId}`),
    remove: (entryId) => request("DELETE", `/saved-for-later/${entryId}`),
  },

  ratings: {
    // scores: { quality, price, hygiene, service }. PUT upsert: 201 when created, 200 when replaced.
    create: (placeId, scores, comment) =>
      request("PUT", `/restaurants/${placeId}/rating`, { body: { ...scores, comment } }),
    get: (placeId) => request("GET", `/restaurants/${placeId}/rating`),
    list: (qs) => request("GET", "/ratings", { qs }),
    byRestaurant: (placeId, qs) => request("GET", `/restaurants/${placeId}/ratings`, { qs }),
    remove: (placeId) => request("DELETE", `/restaurants/${placeId}/rating`),
    like: (ratingId) => request("POST", `/ratings/${ratingId}/likes`),
    unlike: (ratingId) => request("DELETE", `/ratings/${ratingId}/likes`),
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
