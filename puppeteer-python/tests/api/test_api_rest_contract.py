"""API tests for the REST contract under /api/v1.

Covers Location headers, 409/422 status codes, the idempotent rating upsert,
paginated envelopes, nested favorites and idempotent likes.
"""
import json

from src.common.base_api_class import BaseApiClass

PASSWORD = "Test1234!"
PLACE_A = "MOCK_PLACE_101"
PLACE_B = "MOCK_PLACE_102"


class TestApiRestContract(BaseApiClass):
    @classmethod
    def setup_class(cls) -> None:
        super().setup_class()
        ts = cls.unique()
        cls.register_and_login(cls.unique_username(ts), cls.unique_email(ts), PASSWORD)

    @classmethod
    def teardown_class(cls) -> None:
        cls.delete_test_user()
        super().teardown_class()

    # Favorites

    def test_create_list_location(self):
        """POST /favorites/lists returns 201 with a Location header pointing to the new list."""
        result = self.post(self.favorites_url("/lists"), self.list_payload(f"Loc{self.unique()}"))

        assert result.status == 201, "Creating a list must return HTTP 201"
        assert result.location.endswith(f"/api/v1/favorites/lists/{result.json()['id']}"), (
            "Location must address the new list"
        )

    def test_create_list_conflict_and_invalid(self):
        """POST /favorites/lists with an existing name returns 409; with an empty name returns 422."""
        name = f"Dup{self.unique()}"
        self.create_list(name)

        duplicate = self.post(self.favorites_url("/lists"), self.list_payload(name))
        assert duplicate.status == 409, "Duplicate list name must return HTTP 409"

        invalid = self.post(self.favorites_url("/lists"), self.list_payload(""))
        assert invalid.status == 422, "Empty list name must return HTTP 422"

    def test_favorite_lifecycle_under_list(self):
        """POST /favorites/lists/{id}/restaurants returns 201 + Location, duplicate 409; DELETE returns 204 then 404."""
        list_id = self.create_list(f"Fav{self.unique()}")
        url = self.favorites_url(f"/lists/{list_id}/restaurants")

        added = self.post(url, self.place_payload(PLACE_A))
        fav_id = added.json()["id"]
        assert added.status == 201, "Adding a favorite must return HTTP 201"
        assert added.location.endswith(f"/api/v1/favorites/lists/{list_id}/restaurants/{fav_id}"), (
            "Location must address the new favorite under its list"
        )

        again = self.post(url, self.place_payload(PLACE_A))
        assert again.status == 409, "Adding the same restaurant twice must return HTTP 409"

        assert self.delete(f"{url}/{fav_id}") == 204, "DELETE favorite must return HTTP 204"
        assert self.delete(f"{url}/{fav_id}") == 404, "Deleting it again must return HTTP 404"

    # History

    def test_history_location_and_get_by_id(self):
        """POST /history returns 201 with a Location header and GET /history/{id} returns that entry."""
        result = self.post(self.history_url(""), self.place_payload(PLACE_A))
        entry_id = result.json()["id"]

        assert result.status == 201, "Adding a history entry must return HTTP 201"
        assert result.location.endswith(f"/api/v1/history/{entry_id}"), "Location must address the new entry"

        entry = self.send("GET", self.history_url(f"/{entry_id}"))
        assert entry.status == 200, "GET /history/{id} must return HTTP 200"
        assert entry.json()["id"] == entry_id, "The returned entry must match the id"

    def test_history_unknown_id(self):
        """GET /history/{id} with an unknown id returns HTTP 404."""
        assert self.get_status(self.history_url("/999999999")) == 404, "Unknown history entry must return HTTP 404"

    def test_history_pagination(self):
        """GET /history returns the {items,total,limit,offset} envelope and honors limit/offset."""
        self.add_history(PLACE_A)
        self.add_history(PLACE_B)

        page = self.get_json_object(self.history_url("?limit=1&offset=0"))
        assert len(page["items"]) == 1, "limit=1 must return one item"
        assert page["limit"] == 1, "limit must be echoed"
        assert page["offset"] == 0, "offset must be echoed"
        assert page["total"] >= 2, "total counts all entries"

        following = self.get_json_object(self.history_url("?limit=1&offset=1"))
        assert following["offset"] == 1, "offset must be echoed"
        assert len(following["items"]) == 1, "second page must contain one item"

    def test_history_limit_and_offset_out_of_range(self):
        """GET /history with limit 0 or 101, or offset -1, returns HTTP 422."""
        for query in ("limit=0", "limit=101", "offset=-1"):
            assert self.get_status(self.history_url(f"?{query}")) == 422, f"{query} must return HTTP 422"

    def test_history_popular_is_array(self):
        """GET /history/popular returns HTTP 200 with a plain JSON array."""
        result = self.send("GET", self.history_url("/popular?limit=3"))

        assert result.status == 200, "GET /history/popular must return HTTP 200"
        assert isinstance(json.loads(result.body), list), "Popular must be a plain array"

    # Saved for later

    def test_saved_for_later_duplicate(self):
        """POST /saved-for-later twice: first 201 + Location, second 200 with already_saved true and no Location."""
        place_id = f"test_place_{self.unique()}"

        first = self.post(self.saved_for_later_url(""), self.place_payload(place_id))
        assert first.status == 201, "First save must return HTTP 201"
        assert first.location.endswith(f"/api/v1/saved-for-later/{first.json()['id']}"), (
            "Location must address the entry"
        )

        second = self.post(self.saved_for_later_url(""), self.place_payload(place_id))
        assert second.status == 200, "Saving again must return HTTP 200"
        assert second.json()["already_saved"], "already_saved must be true"
        assert second.location is None, "A repeated save must not return a Location header"

    # Ratings

    def test_rating_upsert(self):
        """PUT /restaurants/{id}/rating returns 201 + Location when created, 200 when replaced."""
        place_id = f"bc_put_{self.unique()}"

        created = self.put_rating(place_id, 4, 4, 4, 4, "first")
        assert created.status == 201, "First PUT must return HTTP 201"
        assert created.location.endswith(f"/api/v1/restaurants/{place_id}/rating"), "Location must address the rating"

        replaced = self.put_rating(place_id, 2, 2, 2, 2, "second")
        assert replaced.status == 200, "Second PUT must return HTTP 200"

        own = self.get_json_object(self.restaurants_url(f"/{place_id}/rating"))
        assert own["quality"] == 2, "GET must return the replaced rating"
        assert own["comment"] == "second", "comment must be the replaced one"

    def test_own_rating_empty_when_none(self):
        """GET /restaurants/{id}/rating returns 200 with an empty object when the user has no rating."""
        result = self.send("GET", self.restaurants_url(f"/bc_none_{self.unique()}/rating"))

        assert result.status == 200, "GET own rating must return HTTP 200"
        assert result.json() == {}, "Body must be an empty object when there is no rating"

    def test_restaurant_ratings_envelope(self):
        """GET /restaurants/{id}/ratings returns the paginated envelope."""
        place_id = f"bc_env_{self.unique()}"
        self.put_rating(place_id, 5, 5, 5, 5, "envelope")

        page = self.get_json_object(self.restaurants_url(f"/{place_id}/ratings"))
        assert isinstance(page["items"], list), "items must be an array"
        assert page["total"] == 1, "total must be 1"
        assert "limit" in page, "limit must be present"
        assert "offset" in page, "offset must be present"

    def test_likes_idempotent(self):
        """POST/DELETE /ratings/{id}/likes by another user are idempotent (200/200, 204/204)."""
        rating_id = self.put_rating(f"bc_like_{self.unique()}", 5, 5, 5, 5, "likeable").json()["id"]

        ts = self.unique() + 1
        with self.new_client(self.unique_username(ts), self.unique_email(ts), PASSWORD) as other:
            url = self.ratings_url(f"/{rating_id}/likes")
            try:
                assert other.post(url).status_code == 200, "First like must return 200"
                second = other.post(url)
                assert second.status_code == 200, "Repeated like must return 200"
                assert second.json()["likes"] == 1, "Repeated like must not add a second like"

                assert other.delete(url).status_code == 204, "Unlike must return 204"
                assert other.delete(url).status_code == 204, "Repeated unlike must return 204"
            finally:
                self.delete_client_user(other, PASSWORD)

    # Registration

    def test_register_duplicate_username(self):
        """POST /users with a duplicate username returns 409."""
        ts = self.unique() + 2
        username = self.unique_username(ts)
        first = self.post(self.auth_url("/users"),
                          self.register_payload(username, self.unique_email(ts), PASSWORD, "Ana", "García", ""))
        assert first.status == 201, "First registration must return HTTP 201"

        second = self.post(self.auth_url("/users"),
                           self.register_payload(username, self.unique_email(ts + 1), PASSWORD, "Ana", "García", ""))
        assert second.status == 409, "Duplicate username must return HTTP 409"

        # Remove the extra account
        with self.new_client(username, self.unique_email(ts), PASSWORD) as cleanup:
            self.delete_client_user(cleanup, PASSWORD)

    def test_register_validation_failures(self):
        """POST /users with an invalid email or a weak password returns 422."""
        ts = self.unique() + 3
        bad_email = self.post(self.auth_url("/users"), self.register_payload(
            self.unique_username(ts), "not-an-email", PASSWORD, "Ana", "Perez", ""))
        assert bad_email.status == 422, "Invalid email format must return HTTP 422"

        weak = self.post(self.auth_url("/users"), self.register_payload(
            self.unique_username(ts), self.unique_email(ts), "weak", "Ana", "Perez", ""))
        assert weak.status == 422, "Weak password must return HTTP 422"
