package epigijon.devorapp.e2e.functional.tests.api;

import com.google.gson.JsonArray;
import com.google.gson.JsonObject;
import epigijon.devorapp.e2e.functional.common.BaseApiClass;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.Assertions;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.io.IOException;

/**
 * API Base-Choice tests for the ratings (valoraciones) module.
 *
 * <p>Adapts the rating scenarios from {@code rating.spec.ts} (Playwright)
 * to pure REST assertions.
 *
 * <p>Cases covered:
 * <ul>
 *   <li>BASE  — full rating (all 4 aspects + comment) is stored and retrieved correctly.</li>
 *   <li>S3    — calidad=1, precio=3 → scores match exactly.</li>
 *   <li>S4    — calidad=3, precio=1 → scores match exactly.</li>
 *   <li>S9    — higiene=1, trato=3 → scores match exactly.</li>
 *   <li>S10   — higiene=3, trato=1 → scores match exactly.</li>
 *   <li>S14   — empty comment is stored as empty string or null.</li>
 *   <li>del   — deleting a rating removes it from GET /api/valoraciones.</li>
 * </ul>
 */
class TestApiValoracionesBC extends BaseApiClass {

    @BeforeAll
    static void authSetup() throws IOException {
        long ts = unique();
        registerAndLogin(uniqueUsername(ts), uniqueEmail(ts), "Test1234!");
    }

    @AfterAll
    static void authTeardown() throws IOException {
        deleteTestUser();
    }

    // ── BASE: valoración completa → todos los campos almacenados ─────────────

    @Test
    @DisplayName("BASE — full rating with all aspects at max stored and retrieved correctly")
    void testBase_ValoracionCompleta() throws IOException {
        String placeId = "bc_base_" + unique();
        JsonObject val = createValoracion(placeId, 5, 5, 5, 5,
                "Excelente servicio y comida deliciosa");

        Assertions.assertAll(
                () -> Assertions.assertTrue(val.get("id").getAsInt() > 0, "id must be positive"),
                () -> Assertions.assertEquals(5, val.get("calidad").getAsInt(),  "calidad=5"),
                () -> Assertions.assertEquals(5, val.get("precio").getAsInt(),   "precio=5"),
                () -> Assertions.assertEquals(5, val.get("higiene").getAsInt(),  "higiene=5"),
                () -> Assertions.assertEquals(5, val.get("trato").getAsInt(),    "trato=5"),
                () -> Assertions.assertEquals("Excelente servicio y comida deliciosa",
                        val.get("comentario").getAsString(), "comentario matches")
        );
    }

    // ── S3: calidad=1, precio=3 ───────────────────────────────────────────────

    @Test
    @DisplayName("S3 — calidad=1, precio=3, higiene=5, trato=5 stored correctly")
    void testS3_CalidadBajaPrecioMedio() throws IOException {
        String placeId = "bc_s3_" + unique();
        JsonObject val = createValoracion(placeId, 1, 3, 5, 5, "OK");

        Assertions.assertAll(
                () -> Assertions.assertEquals(1, val.get("calidad").getAsInt(), "calidad=1"),
                () -> Assertions.assertEquals(3, val.get("precio").getAsInt(),  "precio=3"),
                () -> Assertions.assertEquals(5, val.get("higiene").getAsInt(), "higiene=5"),
                () -> Assertions.assertEquals(5, val.get("trato").getAsInt(),   "trato=5")
        );
    }

    // ── S4: calidad=3, precio=1 ───────────────────────────────────────────────

    @Test
    @DisplayName("S4 — calidad=3, precio=1, higiene=5, trato=5 stored correctly")
    void testS4_CalidadMedioPrecioBajo() throws IOException {
        String placeId = "bc_s4_" + unique();
        JsonObject val = createValoracion(placeId, 3, 1, 5, 5, "OK");

        Assertions.assertAll(
                () -> Assertions.assertEquals(3, val.get("calidad").getAsInt(), "calidad=3"),
                () -> Assertions.assertEquals(1, val.get("precio").getAsInt(),  "precio=1")
        );
    }

    // ── S9: higiene=1, trato=3 ───────────────────────────────────────────────

    @Test
    @DisplayName("S9 — calidad=5, precio=5, higiene=1, trato=3 stored correctly")
    void testS9_HigieneBajoTratoMedio() throws IOException {
        String placeId = "bc_s9_" + unique();
        JsonObject val = createValoracion(placeId, 5, 5, 1, 3, "Regular higiene");

        Assertions.assertAll(
                () -> Assertions.assertEquals(1, val.get("higiene").getAsInt(), "higiene=1"),
                () -> Assertions.assertEquals(3, val.get("trato").getAsInt(),   "trato=3")
        );
    }

    // ── S10: higiene=3, trato=1 ──────────────────────────────────────────────

    @Test
    @DisplayName("S10 — calidad=5, precio=5, higiene=3, trato=1 stored correctly")
    void testS10_HigieneMedioTratoBajo() throws IOException {
        String placeId = "bc_s10_" + unique();
        JsonObject val = createValoracion(placeId, 5, 5, 3, 1, "Trato mejorable");

        Assertions.assertAll(
                () -> Assertions.assertEquals(3, val.get("higiene").getAsInt(), "higiene=3"),
                () -> Assertions.assertEquals(1, val.get("trato").getAsInt(),   "trato=1")
        );
    }

    // ── S14: comentario vacío aceptado ───────────────────────────────────────

    @Test
    @DisplayName("S14 — rating with empty comment is accepted (HTTP 201)")
    void testS14_ComentarioVacio() throws IOException {
        String placeId = "bc_s14_" + unique();
        int status = postStatus(valoracionesUrl(""),
                valoracionPayload(placeId, 5, 5, 5, 5, ""));

        Assertions.assertEquals(201, status,
                "A rating with an empty comment must return HTTP 201");
    }

    // ── Eliminar valoración la quita de GET /api/valoraciones ────────────────

    @Test
    @DisplayName("Deleting a rating removes it from GET /api/valoraciones")
    void testEliminarValoracion() throws IOException {
        String placeId = "bc_del_" + unique();
        createValoracion(placeId, 4, 3, 5, 4, "A delete test");

        int deleteStatus = delete(valoracionesUrl("/" + placeId));
        Assertions.assertEquals(204, deleteStatus, "DELETE must return HTTP 204");

        JsonArray all = getJsonArray(valoracionesUrl(""));
        boolean found = false;
        for (com.google.gson.JsonElement el : all) {
            if (placeId.equals(el.getAsJsonObject().get("place_id").getAsString())) {
                found = true;
                break;
            }
        }
        Assertions.assertFalse(found, "Deleted valoracion must not appear in GET list");
    }
}