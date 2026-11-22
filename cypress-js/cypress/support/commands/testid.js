// cy.tid(id) queries [data-testid=id] from the document; .tid(id) searches inside the
// previous subject. One "optional" command covers both forms so specs read the same.
Cypress.Commands.add("tid", { prevSubject: "optional" }, (subject, id, options) => {
  const selector = `[data-testid="${id}"]`;
  return subject ? cy.wrap(subject, { log: false }).find(selector, options) : cy.get(selector, options);
});
