// Side menu drawer: theme and font-size toggles.
import { useTestUser } from "../../support/commands/users";
import SideMenuPage from "../../support/pages/SideMenuPage";

describe("Side Menu", () => {
  const user = useTestUser("sidemenu");
  let menu;

  beforeEach(() => {
    cy.loginAs(user);
    menu = new SideMenuPage().open();
  });

  it("BASE - the dark theme removes data-theme from <html>", () => {
    menu.selectTheme("light").selectTheme("dark").expectDarkTheme();
  });

  it("S2 - the light theme sets data-theme=light", () => {
    menu.selectTheme("light").expectLightTheme();
  });

  it("BASE - font size M is active by default", () => {
    menu.expectFontSizeActive("M");
  });

  [
    ["S3", "S"],
    ["S4", "L"],
  ].forEach(([id, size]) => {
    it(`${id} - font size ${size} sets data-font-size and becomes active`, () => {
      menu.selectTheme("light").selectFontSize(size).expectHtmlFontSize(size).expectFontSizeActive(size);
    });
  });
});
