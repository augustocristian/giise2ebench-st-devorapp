package epigijon.devorapp.e2e.functional.common;

import org.openqa.selenium.By;

/** Locator factory for the frontend {@code data-testid} contract (see cypress-js/TESTIDS.md). */
public final class TestId {

    private TestId() {
    }

    public static By of(String id) {
        return By.cssSelector("[data-testid='" + id + "']");
    }

    /** Builds ids such as {@code price-2} from a prefix and a numeric suffix. */
    public static By ofIndexed(String prefix, int n) {
        return of(prefix + "-" + n);
    }
}
