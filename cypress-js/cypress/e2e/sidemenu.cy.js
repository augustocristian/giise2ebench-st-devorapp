// Browser tests for the side menu drawer (theme + font-size toggles).
// Mirrors selenium-java's tests/e2e/TestSideMenu.java.
//
// Base-Choice coverage:
//   BASE, S2 - theme toggle ("Claro" sets data-theme=light, "Oscuro" removes it).
//   S3, S4 - font-size toggle ("S" and "L" apply data-font-size alongside "Claro").

import LoginPage from "../support/pages/LoginPage";
import SideMenuPage from "../support/pages/SideMenuPage";
import { uniqueTs, uniqueEmail, uniqueUsername } from "../support/commands/api";

describe("Side Menu", () => {
  const PASSWORD = "Test1234!";
  let testEmail;

  before(() => {
    const ts = uniqueTs();
    testEmail = uniqueEmail(ts);
    cy.registerTestUser(uniqueUsername(ts), testEmail, PASSWORD);
  });

  after(() => {
    cy.deleteTestUser(testEmail, PASSWORD);
  });

  beforeEach(() => {
    new LoginPage().visit().enterIdentifier(testEmail).enterPassword(PASSWORD).submitLogin();
  });

  it("BASE, S2 - theme toggle sets/removes data-theme on <html>, font-size M active by default", () => {
    const menu = new SideMenuPage().open();

    menu.clickTheme("Claro");
    menu.getHtmlDataTheme().should("eq", "light");
    menu.isFontSizeActive("M").should("be.true");

    menu.clickTheme("Oscuro");
    menu.getHtmlDataTheme().should("eq", "");
    menu.isFontSizeActive("M").should("be.true");
  });

  it("S3, S4 - font-size S and L apply data-font-size alongside Claro theme", () => {
    const menu = new SideMenuPage().open();
    menu.clickTheme("Claro");

    // S3: font-size S
    menu.clickFontSize("S");
    menu.getHtmlDataFontSize().should("eq", "S");
    menu.isFontSizeActive("S").should("be.true");

    // S4: font-size L
    menu.clickFontSize("L");
    menu.getHtmlDataFontSize().should("eq", "L");
    menu.isFontSizeActive("L").should("be.true");
  });
});
