package epigijon.devorapp.e2e.functional.tests.e2e;

import com.google.gson.JsonObject;
import epigijon.devorapp.e2e.functional.common.BaseLoggedClass;
import epigijon.devorapp.e2e.functional.pages.HistoryPage;
import epigijon.devorapp.e2e.functional.pages.LoginPage;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.Assertions;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.openqa.selenium.By;
import org.openqa.selenium.WebElement;
import org.openqa.selenium.support.ui.ExpectedConditions;
import org.openqa.selenium.support.ui.WebDriverWait;

import java.io.IOException;
import java.time.Duration;
import java.util.List;

/**
 * Browser tests for the DevorApp rating modal (accessed from the history page).
 *
 * <p>Base-Choice coverage:
 * <ul>
 *   <li>BASE — all aspects rated at max with a comment → submission succeeds.</li>
 *   <li>S2, S5, S8, S11 — any single aspect at 0 stars disables the submit button.</li>
 *   <li>S3, S4, S6, S7 — variable calidad/precio ratings with the rest at max → succeeds.</li>
 *   <li>S9, S10, S12, S13 — variable higiene/trato ratings with the rest at max → succeeds.</li>
 *   <li>S14 — empty comment is accepted.</li>
 * </ul>
 */
class TestRatingView extends BaseLoggedClass {

    private static final String PLACE_ID = "ChIJN1t_tDeuEmsRUsoyG83frY4";

    @BeforeAll
    static void createTestUser() throws Exception {
        long ts = System.currentTimeMillis();
        setupTestUser("ratingui" + (ts % 100000), "ratingui" + ts + "@devorapp.test", "Test1234!");
    }

    @BeforeEach
    void ensureHistorialEntry() throws IOException {
        apiLogin();
        String apiBase = properties.getProperty("LOCALHOST_URL", "http://localhost:8000");
        apiDelete(apiBase + "/api/valoraciones/" + PLACE_ID);
        JsonObject payload = new JsonObject();
        payload.addProperty("place_id", PLACE_ID);
        apiPost(apiBase + "/api/historial", payload.toString());
    }

    @AfterAll
    static void cleanupTestUser() {
        tearDownTestUser();
    }

    // ── Navigation helpers ─────────────────────────────────────────────────────────────

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
        page.openCardMenu(0);
        WebDriverWait modalWait = new WebDriverWait(driver, Duration.ofSeconds(10));
        WebElement rateBtn = modalWait.until(ExpectedConditions.elementToBeClickable(
                By.xpath("//button[contains(.,'Valorar restaurante')]")));
        rateBtn.click();
        modalWait.until(ExpectedConditions.visibilityOfElementLocated(
                By.cssSelector(".valuation-content")));
    }

    private void selectStars(String aspect, int stars) {
        if (stars <= 0) return;
        List<WebElement> rows = driver.findElements(By.cssSelector(".aspect-row-premium"));
        WebElement row = rows.stream()
                .filter(r -> r.getText().toLowerCase().contains(aspect.toLowerCase()))
                .findFirst()
                .orElseThrow(() -> new org.openqa.selenium.NoSuchElementException(
                        "Aspect row not found: " + aspect));
        WebElement starsContainer = row.findElement(By.xpath("./div[2]"));
        List<WebElement> svgs = starsContainer.findElements(By.tagName("svg"));
        if (stars <= svgs.size()) {
            svgs.get(stars - 1).click();
        }
    }

    private boolean isSubmitEnabled() {
        List<WebElement> btns = driver.findElements(By.cssSelector("button.btn-submit-valuation"));
        return !btns.isEmpty() && btns.get(0).isEnabled();
    }

    private void fillRatings(int calidad, int precio, int higiene, int trato, String comentario) {
        selectStars("calidad", calidad);
        selectStars("precio",  precio);
        selectStars("higiene", higiene);
        selectStars("trato",   trato);
        WebElement textarea = driver.findElement(By.cssSelector("textarea.textarea-premium"));
        textarea.clear();
        if (comentario != null) textarea.sendKeys(comentario);
    }

    private void submitValuationAndVerifySuccess() {
        driver.findElement(By.cssSelector("button.btn-submit-valuation")).click();
        new WebDriverWait(driver, Duration.ofSeconds(10))
                .until(ExpectedConditions.invisibilityOfElementLocated(
                        By.cssSelector(".valuation-content")));
        waiter.waitForToast("success");
        Assertions.assertFalse(driver.findElements(By.cssSelector(".toast.success")).isEmpty(),
                "A success toast must appear after a successful rating submission");
    }

    // ── 1. BASE: todos los aspectos al máximo con comentario ─────────────────────────

    @Test
    @DisplayName("debe guardar la valoración con todos los aspectos al máximo y comentario (BASE)")
    void testGuardarValoracionCompletaBase() throws Exception {
        HistoryPage page = loginAndGoToHistory();
        openRatingModal(page);
        fillRatings(5, 5, 5, 5, "Excelente servicio y comida deliciosa");
        Assertions.assertTrue(isSubmitEnabled(), "Submit button must be enabled when all aspects are rated");
        submitValuationAndVerifySuccess();
    }

    // ── 2. S2, S5, S8, S11 + S14: 0 estrellas deshabilitan el botón; comentario vacío permitido ──

    @Test
    @DisplayName("debe deshabilitar envío con 0 estrellas en cualquier aspecto (S2, S5, S8, S11) y aceptar comentario vacío (S14)")
    void testValidarCeroEstrellasYComentarioVacio() throws Exception {
        // S2: Calidad = 0
        HistoryPage page = loginAndGoToHistory();
        openRatingModal(page);
        fillRatings(0, 5, 5, 5, "Comentario");
        Assertions.assertFalse(isSubmitEnabled(), "S2: submit must be disabled when calidad has 0 stars");

        // S5: Precio = 0
        driver.get(sutUrl + "/history");
        page = new HistoryPage(driver, waiter);
        openRatingModal(page);
        fillRatings(5, 0, 5, 5, "Comentario");
        Assertions.assertFalse(isSubmitEnabled(), "S5: submit must be disabled when precio has 0 stars");

        // S8: Higiene = 0
        driver.get(sutUrl + "/history");
        page = new HistoryPage(driver, waiter);
        openRatingModal(page);
        fillRatings(5, 5, 0, 5, "Comentario");
        Assertions.assertFalse(isSubmitEnabled(), "S8: submit must be disabled when higiene has 0 stars");

        // S11: Trato = 0
        driver.get(sutUrl + "/history");
        page = new HistoryPage(driver, waiter);
        openRatingModal(page);
        fillRatings(5, 5, 5, 0, "Comentario");
        Assertions.assertFalse(isSubmitEnabled(), "S11: submit must be disabled when trato has 0 stars");

        // S14: empty comment is accepted
        driver.get(sutUrl + "/history");
        page = new HistoryPage(driver, waiter);
        openRatingModal(page);
        fillRatings(5, 5, 5, 5, "");
        Assertions.assertTrue(isSubmitEnabled(), "S14: submit must be enabled even with empty comment");
        submitValuationAndVerifySuccess();
    }

    // ── 3. S3, S4, S6, S7, S9, S10, S12, S13: puntuaciones variables ─────────────────

    @Test
    @DisplayName("debe guardar valoraciones con puntuaciones variables de calidad, precio, higiene y trato (S3, S4, S6, S7, S9, S10, S12, S13)")
    void testPuntuacionesVariables() throws Exception {
        // S3 & S7: Calidad = 1, Precio = 3 (resto base = 5)
        HistoryPage page = loginAndGoToHistory();
        openRatingModal(page);
        fillRatings(1, 3, 5, 5, "Comentario");
        Assertions.assertTrue(isSubmitEnabled(), "S3/S7: submit must be enabled");
        submitValuationAndVerifySuccess();

        // S4 & S6: Calidad = 3, Precio = 1
        ensureHistorialEntry();
        driver.get(sutUrl + "/history");
        page = new HistoryPage(driver, waiter);
        openRatingModal(page);
        fillRatings(3, 1, 5, 5, "Comentario");
        Assertions.assertTrue(isSubmitEnabled(), "S4/S6: submit must be enabled");
        submitValuationAndVerifySuccess();

        // S9 & S13: Higiene = 1, Trato = 3
        ensureHistorialEntry();
        driver.get(sutUrl + "/history");
        page = new HistoryPage(driver, waiter);
        openRatingModal(page);
        fillRatings(5, 5, 1, 3, "Comentario");
        Assertions.assertTrue(isSubmitEnabled(), "S9/S13: submit must be enabled");
        submitValuationAndVerifySuccess();

        // S10 & S12: Higiene = 3, Trato = 1
        ensureHistorialEntry();
        driver.get(sutUrl + "/history");
        page = new HistoryPage(driver, waiter);
        openRatingModal(page);
        fillRatings(5, 5, 3, 1, "Comentario");
        Assertions.assertTrue(isSubmitEnabled(), "S10/S12: submit must be enabled");
        submitValuationAndVerifySuccess();
    }
}