// Mirrors selenium-java's pages/SideMenuPage.java.
// The drawer contains a theme toggle group (Claro/Oscuro) and a font-size
// toggle group (S/M/L).
class SideMenuPage {
  static SELECTORS = {
    hamburger: "button[aria-label='Abrir menú']",
    drawer: ".sidemenu-drawer",
    toggleGroups: ".sidemenu-toggle-group",
    html: "html",
  };

  open() {
    cy.get(SideMenuPage.SELECTORS.hamburger).click();
    cy.get(SideMenuPage.SELECTORS.drawer).should("be.visible");
    return this;
  }

  isOpen() {
    return cy.get("body").then(($body) => $body.find(SideMenuPage.SELECTORS.drawer).length > 0);
  }

  // ── Theme toggle ──────────────────────────────────────────────────────────

  /** Clicks the theme button with the given label ("Claro" or "Oscuro"). */
  clickTheme(label) {
    cy.get(SideMenuPage.SELECTORS.toggleGroups).eq(0).contains("button", label).click();
    return this;
  }

  isThemeActive(label) {
    return cy
      .get(SideMenuPage.SELECTORS.toggleGroups)
      .eq(0)
      .contains("button", label)
      .then(($btn) => $btn.hasClass("active"));
  }

  getHtmlDataTheme() {
    return cy.get(SideMenuPage.SELECTORS.html).then(($html) => $html.attr("data-theme") || "");
  }

  // ── Font-size toggle ──────────────────────────────────────────────────────

  /** Clicks the font-size button with the given label ("S", "M", or "L"). */
  clickFontSize(label) {
    cy.get(SideMenuPage.SELECTORS.toggleGroups)
      .eq(1)
      .contains("button", new RegExp(`^${label}$`))
      .click();
    return this;
  }

  isFontSizeActive(label) {
    return cy
      .get(SideMenuPage.SELECTORS.toggleGroups)
      .eq(1)
      .contains("button", new RegExp(`^${label}$`))
      .then(($btn) => $btn.hasClass("active"));
  }

  getHtmlDataFontSize() {
    return cy.get(SideMenuPage.SELECTORS.html).then(($html) => $html.attr("data-font-size") || "");
  }
}

export default SideMenuPage;
