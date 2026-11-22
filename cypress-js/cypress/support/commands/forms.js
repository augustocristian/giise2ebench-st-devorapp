// cy.fill(value): clears the input and types `value`. Unlike `.clear().type("")`,
// an empty value is allowed (Cypress refuses to type an empty string), which the
// validation scenarios ("empty password", "both fields empty") rely on.
Cypress.Commands.add("fill", { prevSubject: "element" }, (subject, value) => {
  cy.wrap(subject).clear();
  if (value !== undefined && value !== null && String(value) !== "") {
    cy.wrap(subject).type(String(value));
  }
  return cy.wrap(subject);
});
