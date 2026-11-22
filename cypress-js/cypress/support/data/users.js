export const DEFAULT_PASSWORD = "Test1234!";

let counter = 0;

/** A unique, not-yet-registered user. `prefix` keeps emails readable in the backend logs. */
export function newUser(prefix = "testuser", overrides = {}) {
  const id = `${Date.now()}${counter++}`;
  return {
    email: `${prefix}${id}@devorapp.test`,
    username: `${prefix}${id}`.slice(-30),
    password: DEFAULT_PASSWORD,
    first_name: "Test",
    last_name: "User",
    location: "Gijón",
    ...overrides,
  };
}
