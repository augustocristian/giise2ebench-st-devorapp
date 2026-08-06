"""Selector builders for the frontend ``data-testid`` contract.

Mirrors ``TestId.java`` (selenium-java) and ``TestId.cs`` (playwright-csharp).
The full id list lives in cypress-js/TESTIDS.md.
"""


class TestId:
    __test__ = False  # not a pytest test class despite the name

    @staticmethod
    def of(test_id: str) -> str:
        """Selector for a plain test id, e.g. ``login-submit``."""
        return f"[data-testid='{test_id}']"

    @staticmethod
    def indexed(prefix: str, n: int) -> str:
        """Selector for ids made of a prefix and a number, e.g. ``price-2``."""
        return TestId.of(f"{prefix}-{n}")

    @staticmethod
    def price(level: int) -> str:
        """Price level button, 1 (cheapest) to 4."""
        return TestId.indexed("price", level)

    @staticmethod
    def rating_star(aspect: str, n: int) -> str:
        """Star n (1-5) of a rating aspect: quality, price, hygiene or service."""
        return TestId.indexed(f"rating-star-{aspect}", n)

    @staticmethod
    def side_menu(entry: str) -> str:
        """Side menu entry: home, recommend, favorites, saved, history, ratings, profile or logout."""
        return TestId.of(f"side-menu-{entry}")

    @staticmethod
    def history_menu(action: str) -> str:
        """History card menu entry: details, rechoose, favorite, rate or delete."""
        return TestId.of(f"history-menu-{action}")

    @staticmethod
    def cuisine_option(tag_id: str) -> str:
        """Cuisine dropdown option for a tag id from the frontend tags.json."""
        return TestId.of(f"cuisine-option-{tag_id}")

    @staticmethod
    def profile_card(card: str) -> str:
        """Profile card: personal, location, email, security or danger."""
        return TestId.of(f"profile-card-{card}")

    @staticmethod
    def toast(kind: str) -> str:
        """Toast of a type: success, error, info or warning."""
        return TestId.of(f"toast-{kind}")

    @staticmethod
    def element_id(element_id: str) -> str:
        """Selector for the few elements located by their DOM id."""
        return f"[id='{element_id}']"
