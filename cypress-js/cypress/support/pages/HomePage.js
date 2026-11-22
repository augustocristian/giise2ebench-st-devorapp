import { TID } from "../testids";

class HomePage {
  expectLoaded() {
    cy.url().should("include", "/home");
    cy.tid(TID.shared.topbar).should("be.visible");
    return this;
  }
}

export default HomePage;
