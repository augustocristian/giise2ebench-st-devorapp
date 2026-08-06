// Mirrors selenium-java's pages/HomePage.java.
class HomePage {
  static SELECTORS = {
    topBar: ".topbar, header, nav",
  };

  /** Waits until the URL contains /home and the top nav bar is visible. */
  waitForLoad() {
    cy.url().should("include", "/home");
    cy.get(HomePage.SELECTORS.topBar).should("be.visible");
    return this;
  }

  isTopBarVisible() {
    return cy.get("body").then(($body) => $body.find(HomePage.SELECTORS.topBar).length > 0);
  }

  getCurrentUrl() {
    return cy.url();
  }
}

export default HomePage;
