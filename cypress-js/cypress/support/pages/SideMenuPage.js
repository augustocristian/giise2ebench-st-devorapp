import { TID } from "../testids";

const M = TID.sideMenu;

class SideMenuPage {
  open() {
    cy.tid(M.open).click();
    cy.tid(M.drawer).should("be.visible");
    return this;
  }

  selectTheme(name) {
    cy.tid(M.theme(name)).click();
    return this;
  }

  selectFontSize(size) {
    cy.tid(M.fontSize(size)).click();
    return this;
  }

  expectLightTheme() {
    cy.get("html").should("have.attr", "data-theme", "light");
    return this;
  }

  /** The dark theme is the default: it removes `data-theme` from <html>. */
  expectDarkTheme() {
    cy.get("html").should("not.have.attr", "data-theme");
    return this;
  }

  expectHtmlFontSize(size) {
    cy.get("html").should("have.attr", "data-font-size", size);
    return this;
  }

  expectFontSizeActive(size) {
    cy.tid(M.fontSize(size)).should("have.class", "active");
    return this;
  }
}

export default SideMenuPage;
