package epigijon.devorapp.e2e.functional.tests.e2e;

import com.google.gson.JsonObject;
import epigijon.devorapp.e2e.functional.common.BaseLoggedClass;
import epigijon.devorapp.e2e.functional.common.TestId;
import epigijon.devorapp.e2e.functional.pages.HistoryPage;
import epigijon.devorapp.e2e.functional.pages.LoginPage;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.Assertions;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.openqa.selenium.WebElement;
import org.openqa.selenium.support.ui.ExpectedConditions;
import org.openqa.selenium.support.ui.WebDriverWait;

import java.io.IOException;
import java.time.Duration;
import java.util.List;

/** Browser tests for the rating modal opened from the history page (BASE, S2-S14). */
class TestRatingView extends BaseLoggedClass {

    private static final String PLACE_ID = "MOCK_PLACE_101";

    @BeforeAll
    static void createTestUser() throws Exception {
        long ts = System.currentTimeMillis();
        setupTestUser("ratingui" + (ts % 100000), "ratingui" + ts + "@devorapp.test", "Test1234!");
    }

    @BeforeEach
    void ensureHistoryEntry() throws IOException {
        apiLogin();
        String apiBase = properties.getProperty("LOCALHOST_URL", "http://localhost:8000");
        apiDelete(apiBase + "/api/v1/restaurants/" + PLACE_ID + "/rating");
        JsonObject payload = new JsonObject();
        payload.addProperty("place_id", PLACE_ID);
        apiPost(apiBase + "/api/v1/history", payload.toString());
    }

    @AfterAll
    static void cleanupTestUser() {
        tearDownTestUser();
    }

    private void clearSessionAndLogin() {
        clearSession();
        driver.get(sutUrl + "/login");
    }

    private HistoryPage loginAndGoToHistory() throws Exception {
        clearSessionAndLogin();
        new LoginPage(driver, waiter)
                .enterIdentifier(testEmail)
                .enterPassword(testPassword)
                .submitLogin();
        driver.get(sutUrl + "/history");
        return new HistoryPage(driver, waiter);
    }

    private void openRatingModal(HistoryPage page) throws Exception {
        page.openCardMenu(0).chooseMenuAction("rate");
        new WebDriverWait(driver, Duration.ofSeconds(10)).until(
                ExpectedConditions.visibilityOfElementLocated(TestId.of("rating-modal")));
    }

    private void selectStars(String aspect, int stars) {
        if (stars <= 0) return;
        driver.findElement(TestId.of("rating-star-" + aspect + "-" + stars)).click();
    }

    private boolean isSubmitEnabled() {
        List<WebElement> btns = driver.findElements(TestId.of("rating-submit"));
        return !btns.isEmpty() && btns.get(0).isEnabled();
    }

    private void fillRatings(int quality, int price, int hygiene, int service, String comment) {
        selectStars("quality", quality);
        selectStars("price", price);
        selectStars("hygiene", hygiene);
        selectStars("service", service);
        WebElement textarea = driver.findElement(TestId.of("rating-comment"));
        textarea.clear();
        if (comment != null) textarea.sendKeys(comment);
    }

    private void submitRatingAndVerifySuccess() {
        driver.findElement(TestId.of("rating-submit")).click();
        new WebDriverWait(driver, Duration.ofSeconds(10))
                .until(ExpectedConditions.invisibilityOfElementLocated(TestId.of("rating-modal")));
        waiter.waitForToast("success");
        Assertions.assertFalse(driver.findElements(TestId.of("toast-success")).isEmpty(),
                "A success toast must appear after a successful rating submission");
    }

    private HistoryPage reloadHistory() {
        driver.get(sutUrl + "/history");
        return new HistoryPage(driver, waiter);
    }

    @Test
    @DisplayName("Save a rating with all aspects at maximum and a comment (BASE)")
    void testSaveFullRatingBase() throws Exception {
        HistoryPage page = loginAndGoToHistory();
        openRatingModal(page);
        fillRatings(5, 5, 5, 5, "Excelente servicio y comida deliciosa");
        Assertions.assertTrue(isSubmitEnabled(), "Submit button must be enabled when all aspects are rated");
        submitRatingAndVerifySuccess();
    }

    @Test
    @DisplayName("Submit is disabled with 0 stars in any aspect (S2, S5, S8, S11) and an empty comment is accepted (S14)")
    void testZeroStarsDisableSubmitAndEmptyCommentAccepted() throws Exception {
        // S2: quality = 0
        HistoryPage page = loginAndGoToHistory();
        openRatingModal(page);
        fillRatings(0, 5, 5, 5, "Comentario");
        Assertions.assertFalse(isSubmitEnabled(), "S2: submit must be disabled when quality has 0 stars");

        // S5: price = 0
        page = reloadHistory();
        openRatingModal(page);
        fillRatings(5, 0, 5, 5, "Comentario");
        Assertions.assertFalse(isSubmitEnabled(), "S5: submit must be disabled when price has 0 stars");

        // S8: hygiene = 0
        page = reloadHistory();
        openRatingModal(page);
        fillRatings(5, 5, 0, 5, "Comentario");
        Assertions.assertFalse(isSubmitEnabled(), "S8: submit must be disabled when hygiene has 0 stars");

        // S11: service = 0
        page = reloadHistory();
        openRatingModal(page);
        fillRatings(5, 5, 5, 0, "Comentario");
        Assertions.assertFalse(isSubmitEnabled(), "S11: submit must be disabled when service has 0 stars");

        // S14: empty comment is accepted
        page = reloadHistory();
        openRatingModal(page);
        fillRatings(5, 5, 5, 5, "");
        Assertions.assertTrue(isSubmitEnabled(), "S14: submit must be enabled even with empty comment");
        submitRatingAndVerifySuccess();
    }

    @Test
    @DisplayName("Save ratings with varying quality, price, hygiene and service (S3, S4, S6, S7, S9, S10, S12, S13)")
    void testVariableRatings() throws Exception {
        // S3 & S7: quality = 1, price = 3 (rest at base = 5)
        HistoryPage page = loginAndGoToHistory();
        openRatingModal(page);
        fillRatings(1, 3, 5, 5, "Comentario");
        Assertions.assertTrue(isSubmitEnabled(), "S3/S7: submit must be enabled");
        submitRatingAndVerifySuccess();

        // S4 & S6: quality = 3, price = 1
        ensureHistoryEntry();
        page = reloadHistory();
        openRatingModal(page);
        fillRatings(3, 1, 5, 5, "Comentario");
        Assertions.assertTrue(isSubmitEnabled(), "S4/S6: submit must be enabled");
        submitRatingAndVerifySuccess();

        // S9 & S13: hygiene = 1, service = 3
        ensureHistoryEntry();
        page = reloadHistory();
        openRatingModal(page);
        fillRatings(5, 5, 1, 3, "Comentario");
        Assertions.assertTrue(isSubmitEnabled(), "S9/S13: submit must be enabled");
        submitRatingAndVerifySuccess();

        // S10 & S12: hygiene = 3, service = 1
        ensureHistoryEntry();
        page = reloadHistory();
        openRatingModal(page);
        fillRatings(5, 5, 3, 1, "Comentario");
        Assertions.assertTrue(isSubmitEnabled(), "S10/S12: submit must be enabled");
        submitRatingAndVerifySuccess();
    }
}
