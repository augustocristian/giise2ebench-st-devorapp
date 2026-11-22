// Registration, login and availability checks (no session needed).
import { api } from "../../support/commands/api";
import { newUser } from "../../support/data/users";

describe("API - Register / Login - Base-Choice", () => {
  let user;

  beforeEach(() => {
    user = newUser("regapi", { nombre: "Ana", apellidos: "García", ubicacion: "" });
  });

  // Tests register `user` themselves; this removes it so nothing leaks into the backend.
  afterEach(() => cy.deleteUser(user));

  it("BASE - valid registration returns 201", () => {
    api.auth.register(user).its("status").should("eq", 201);
  });

  it("S3 - registering with a duplicate email returns 400 or 409", () => {
    api.auth.register(user);
    const other = newUser("regdup", { email: user.email });

    api.auth.register(other).then((res) => {
      expect([400, 409], `Duplicate email must be rejected, got ${res.status}`).to.include(res.status);
    });
  });

  it("check-availability - email_taken flips from false to true after registration", () => {
    api.auth.checkAvailability({ email: user.email }).its("body.email_taken").should("eq", false);
    api.auth.register(user);
    api.auth.checkAvailability({ email: user.email }).its("body.email_taken").should("eq", true);
  });

  it("check-availability - username_taken flips from false to true after registration", () => {
    api.auth.checkAvailability({ username: user.username }).its("body.username_taken").should("eq", false);
    api.auth.register(user);
    api.auth.checkAvailability({ username: user.username }).its("body.username_taken").should("eq", true);
  });

  it("S7 - login with correct credentials returns 200", () => {
    api.auth.register(user);
    api.auth.login(user.email, user.password).its("status").should("eq", 200);
  });

  it("S8 - login with a wrong password returns 401", () => {
    api.auth.register(user);
    api.auth.login(user.email, "WrongPassword99!").its("status").should("eq", 401);
  });
});
