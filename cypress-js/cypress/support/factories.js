// Builders for the API payloads that specs stub with cy.intercept(). Pass overrides to tweak a field.
import { PLACES } from "./data/places";

const RESTAURANTS = [
  { id: PLACES.A, name: "Restaurante Uno", address: "Calle Ficticia 1", rating: 4.5 },
  { id: PLACES.B, name: "Restaurante Dos", address: "Calle Ficticia 2", rating: 4.0 },
];

/** Restaurant payload as embedded in favorites, history and search responses. */
export function restaurantStub(overrides = {}) {
  return {
    ...RESTAURANTS[0],
    user_ratings_total: 100,
    main_photo: null,
    types: ["restaurant"],
    summary: "Artificial summary",
    open_now: true,
    ...overrides,
  };
}

/** The n-th (0-based) canned restaurant: "Restaurante Uno", "Restaurante Dos", cycling. */
export function nthRestaurantStub(n, overrides = {}) {
  return restaurantStub({ ...RESTAURANTS[n % RESTAURANTS.length], address: `Calle Ficticia ${n + 1}`, ...overrides });
}

/** One favorites list; GET /api/favoritos/listas returns an array of these. */
export function favoritesListStub(overrides = {}) {
  return { id: 1, user_id: "uid", nombre: "Lista 1", icono: "Heart", ...overrides };
}

export function favoritesListsStub(count) {
  return Array.from({ length: count }, (_, i) => favoritesListStub({ id: i + 1, nombre: `Lista ${i + 1}` }));
}

/** GET /api/favoritos/listas/<id>: the list plus `restaurantCount` restaurants. */
export function favoritesDetailStub(restaurantCount, list = favoritesListStub()) {
  const restaurantes = Array.from({ length: restaurantCount }, (_, i) => {
    const restaurant = nthRestaurantStub(i);
    return { id: i + 1, lista_id: list.id, place_id: restaurant.id, restaurant };
  });
  return { lista: list, restaurantes };
}

/** One history entry; `date` is the ISO access timestamp that decides its month group. */
export function historyEntryStub({ id = 1, date, restaurant = restaurantStub() } = {}) {
  return { id, user_id: "uid", place_id: restaurant.id, fecha_acceso: date, restaurant };
}

/** Two entries (Uno, Dos) accessed on the given dates. */
export function historyStub(dateUno, dateDos) {
  return [
    historyEntryStub({ id: 1, date: dateUno, restaurant: nthRestaurantStub(0) }),
    historyEntryStub({ id: 2, date: dateDos, restaurant: nthRestaurantStub(1) }),
  ];
}

/** POST /api/recommendations/search response. */
export function searchResponseStub(results = []) {
  return { results, next_page_token: null };
}
