// Recommendation search page: filter combinations against the real backend; S10/S11 stub the response.
// Base-Choice scenarios: BASE, S2-S11.
import { useTestUser } from "../../support/commands/users";
import RecommendPage from "../../support/pages/RecommendPage";
import { installGoogleAutocompleteMock } from "../../support/commands/mocks";
import { restaurantStub, searchResponseStub } from "../../support/factories";

describe("Recommend", () => {
  const user = useTestUser("rec");
  const page = new RecommendPage();
  const MEXICAN = ["mexican_restaurant", "Mexicano"];
  const ITALIAN = ["italian_restaurant", "Italiano"];

  function openRecommend(options) {
    cy.loginAs(user);
    page.visit(options);
  }

  /**
   * One-shot stub for the next search. Register it AFTER addCuisine: picking a tag already
   * searches, and a stub registered earlier would swallow that request and leave the filter
   * panel collapsed with the search form gone.
   */
  function stubNextSearch(results) {
    cy.intercept({ method: "POST", url: "**/api/v1/recommendations/search", times: 1 }, searchResponseStub(results));
  }

  it("BASE - preferred location, several cuisines and prices", () => {
    openRecommend();
    page.addCuisine(...MEXICAN).addCuisine(...ITALIAN);
    page.selectPrice(1).selectPrice(2).setIncludeNoPrice(true).setOpenNow(true);
    page.selectPreferredLocation().search().expectNoError();
  });

  it("S2, S4 - no cuisines and no prices still searches", () => {
    openRecommend();
    page.selectPreferredLocation().search().expectNoError();
  });

  it("S3 - one cuisine, several prices", () => {
    openRecommend();
    page
      .addCuisine(...MEXICAN)
      .selectPrice(1)
      .selectPrice(2);
    page.selectPreferredLocation().search().expectNoError();
  });

  it("S5 - several cuisines, one price", () => {
    openRecommend();
    page
      .addCuisine(...MEXICAN)
      .addCuisine(...ITALIAN)
      .selectPrice(1);
    page.selectPreferredLocation().search().expectNoError();
  });

  it("S6, S7 - without 'no price' and 'open now' still searches", () => {
    openRecommend();
    page
      .addCuisine(...ITALIAN)
      .setIncludeNoPrice(false)
      .setOpenNow(false);
    page.selectPreferredLocation().search().expectNoError();
  });

  it("S8 - another valid location searches without error", () => {
    openRecommend({ onBeforeLoad: installGoogleAutocompleteMock });
    page
      .addCuisine(...MEXICAN)
      .addCuisine(...ITALIAN)
      .selectPrice(1)
      .selectPrice(2);
    page.selectOtherLocation("Barcelona, España");
    cy.triggerAutocompletePlaceChanged();
    page.search().expectNoError();
  });

  it("S9 - an empty other location shows an error", () => {
    openRecommend();
    page.addCuisine(...MEXICAN).selectOtherLocation("");
    page.submitWithoutWaiting().expectError(/ubicaci[oó]n|localiz/i);
  });

  it("S10 - a response with 0 results renders no cards", () => {
    openRecommend();
    page.addCuisine(...MEXICAN);
    stubNextSearch([]);
    page.selectPreferredLocation().search().expectResultCount(0);
  });

  it("S11 - a response with 1 result renders one card", () => {
    openRecommend();
    page.addCuisine(...MEXICAN);
    stubNextSearch([restaurantStub({ id: "test_place_11", name: "Restaurante Once" })]);
    page.selectPreferredLocation().search().expectResultCount(1);
  });
});
