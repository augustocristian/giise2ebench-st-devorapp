// Registration, login and availability checks (no session needed).
import { api } from "../../support/commands/api";
import { newUser } from "../../support/data/users";

describe("API - Register / Login - Base-Choice", () => {
  let user;

  beforeEach(() => {
    user = newUser("regapi", { first_name: "Ana", last_name: "García", location: "" });
  });

  // Tests register `user` themselves; this removes it so nothing leaks into the backend.
  afterEach(() => cy.deleteUser(user));

  it("BASE - valid registration returns 201", () => {
    api.auth.register(user).its("status").should("eq", 201);
  });

  it("S3 - registering with a duplicate email returns 409", () => {
    api.auth.register(user);
    const other = newUser("regdup", { email: user.email });

    api.auth.register(other).then((res) => {
      expect(res.status, "Duplicate email must be a conflict").to.eq(409);
    });
  });

  it("users/availability - email_taken flips from false to true after registration", () => {
    api.auth.checkAvailability({ email: user.email }).its("body.email_taken").should("eq", false);
    api.auth.register(user);
    api.auth.checkAvailability({ email: user.email }).its("body.email_taken").should("eq", true);
  });

  it("users/availability - username_taken flips from false to true after registration", () => {
    api.auth.checkAvailability({ username: user.username }).its("body.username_taken").should("eq", false);
    api.auth.register(user);
    api.auth.checkAvailability({ username: user.username }).its("body.username_taken").should("eq", true);
  });

  it("S7 - login with correct credentials returns 201", () => {
    api.auth.register(user);
    api.auth.login(user.email, user.password).its("status").should("eq", 201);
  });

  it("S8 - login with a wrong password returns 401", () => {
    api.auth.register(user);
    api.auth.login(user.email, "WrongPassword99!").its("status").should("eq", 401);
  });
});
