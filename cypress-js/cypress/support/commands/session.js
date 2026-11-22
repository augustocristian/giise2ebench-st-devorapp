// Every test starts from a clean browser: cookies, local/session storage and IndexedDB
// (where Firebase keeps its tokens).
Cypress.Commands.add("clearAppSession", () => {
  cy.clearCookies();
  cy.clearLocalStorage();
  cy.window({ log: false }).then(async (win) => {
    win.sessionStorage.clear();
    const dbs = (await win.indexedDB?.databases?.()) ?? [];
    dbs.forEach((db) => win.indexedDB.deleteDatabase(db.name));
  });
});
