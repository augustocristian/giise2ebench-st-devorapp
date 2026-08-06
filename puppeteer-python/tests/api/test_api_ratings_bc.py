"""API Base-Choice tests for the ratings module.

Cases covered:
  * BASE - full rating (all 4 aspects + comment) is stored and returned correctly.
  * S3   - quality=1, price=3 -> scores match exactly.
  * S4   - quality=3, price=1 -> scores match exactly.
  * S9   - hygiene=1, service=3 -> scores match exactly.
  * S10  - hygiene=3, service=1 -> scores match exactly.
  * S14  - an empty comment is accepted.
  * del  - deleting a rating removes it from GET /ratings.
"""
from src.common.base_api_class import BaseApiClass


class TestApiRatingsBC(BaseApiClass):
    @classmethod
    def setup_class(cls) -> None:
        super().setup_class()
        ts = cls.unique()
        cls.register_and_login(cls.unique_username(ts), cls.unique_email(ts), "Test1234!")

    @classmethod
    def teardown_class(cls) -> None:
        cls.delete_test_user()
        super().teardown_class()

    # BASE: full rating, all fields stored

    def test_base_full_rating(self):
        """BASE - full rating with all aspects at max is stored and returned correctly."""
        place_id = f"bc_base_{self.unique()}"
        val = self.create_rating(place_id, 5, 5, 5, 5, "Excelente servicio y comida deliciosa")

        assert val["id"] > 0, "id must be positive"
        assert val["quality"] == 5, "quality=5"
        assert val["price"] == 5, "price=5"
        assert val["hygiene"] == 5, "hygiene=5"
        assert val["service"] == 5, "service=5"
        assert val["comment"] == "Excelente servicio y comida deliciosa", "comment matches"

    # S3: quality=1, price=3

    def test_s3_low_quality_mid_price(self):
        """S3 - quality=1, price=3, hygiene=5, service=5 stored correctly."""
        val = self.create_rating(f"bc_s3_{self.unique()}", 1, 3, 5, 5, "OK")

        assert val["quality"] == 1, "quality=1"
        assert val["price"] == 3, "price=3"
        assert val["hygiene"] == 5, "hygiene=5"
        assert val["service"] == 5, "service=5"

    # S4: quality=3, price=1

    def test_s4_mid_quality_low_price(self):
        """S4 - quality=3, price=1, hygiene=5, service=5 stored correctly."""
        val = self.create_rating(f"bc_s4_{self.unique()}", 3, 1, 5, 5, "OK")

        assert val["quality"] == 3, "quality=3"
        assert val["price"] == 1, "price=1"

    # S9: hygiene=1, service=3

    def test_s9_low_hygiene_mid_service(self):
        """S9 - quality=5, price=5, hygiene=1, service=3 stored correctly."""
        val = self.create_rating(f"bc_s9_{self.unique()}", 5, 5, 1, 3, "Regular hygiene")

        assert val["hygiene"] == 1, "hygiene=1"
        assert val["service"] == 3, "service=3"

    # S10: hygiene=3, service=1

    def test_s10_mid_hygiene_low_service(self):
        """S10 - quality=5, price=5, hygiene=3, service=1 stored correctly."""
        val = self.create_rating(f"bc_s10_{self.unique()}", 5, 5, 3, 1, "Service could be better")

        assert val["hygiene"] == 3, "hygiene=3"
        assert val["service"] == 1, "service=1"

    # S14: empty comment accepted

    def test_s14_empty_comment(self):
        """S14 - a rating with an empty comment is accepted (HTTP 201)."""
        status = self.put_rating(f"bc_s14_{self.unique()}", 5, 5, 5, 5, "").status

        assert status == 201, "A rating with an empty comment must return HTTP 201"

    # Deleting a rating removes it from GET /ratings

    def test_delete_rating(self):
        """Deleting a rating removes it from GET /ratings."""
        place_id = f"bc_del_{self.unique()}"
        self.create_rating(place_id, 4, 3, 5, 4, "A delete test")

        delete_status = self.delete(self.restaurants_url(f"/{place_id}/rating"))
        assert delete_status == 204, "DELETE must return HTTP 204"

        all_ratings = self.get_items(self.ratings_url(""))
        assert not any(r["place_id"] == place_id for r in all_ratings), "Deleted rating must not appear in the GET list"
