"""DB-level tests (in-memory SQLite) for the round-2 repository behavior."""
import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.infrastructure.database import Base
from app.infrastructure.repositories import (
    rating_repo, history_repo, saved_for_later_repo, favorites_repo,
)
from app.models.dtos.rating_dto import RatingUpsert
from app.models.entities.rating import Rating


@pytest.fixture
def db(monkeypatch):
    # Import every entity so Base.metadata knows all the tables
    import app.models.entities.favorites, app.models.entities.favorite_lists  # noqa: F401
    import app.models.entities.history, app.models.entities.saved_for_later  # noqa: F401
    import app.models.entities.rating, app.models.entities.rating_like, app.models.entities.restaurant  # noqa: F401
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(engine)
    session = sessionmaker(bind=engine)()

    # The production helper uses PostgreSQL-only INSERT ... ON CONFLICT ... RETURNING;
    # replace it with a portable equivalent so the repositories run on SQLite.
    from app.infrastructure.repositories import restaurant_repo
    from app.models.entities.restaurant import Restaurant

    def portable_get_or_create(session_, place_id):
        row = session_.query(Restaurant).filter(Restaurant.place_id == place_id).first()
        if row is None:
            row = Restaurant(place_id=place_id)
            session_.add(row)
            session_.commit()
        return row.id

    monkeypatch.setattr(restaurant_repo, "get_or_create_restaurant", portable_get_or_create)
    yield session
    session.close()


def _scores(**kw):
    return RatingUpsert(quality=4, price=3, hygiene=5, service=2, **kw)


def test_upsert_creates_then_replaces(db):
    first, created = rating_repo.create_or_update_review(db, "u1", "placeA", _scores(comment="a"))
    assert created is True
    second, created = rating_repo.create_or_update_review(db, "u1", "placeA", RatingUpsert(
        quality=1, price=1, hygiene=1, service=1, comment="b"))
    assert created is False
    assert second.id == first.id and second.quality == 1 and second.comment == "b"
    assert rating_repo.count_user_reviews(db, "u1") == 1


def test_like_and_unlike_are_idempotent_and_keep_counter(db):
    review, _ = rating_repo.create_or_update_review(db, "owner", "placeA", _scores())
    assert rating_repo.add_like(db, "u2", review.id).likes == 1
    assert rating_repo.add_like(db, "u2", review.id).likes == 1  # second POST: unchanged
    assert rating_repo.add_like(db, "u3", review.id).likes == 2
    assert rating_repo.get_liked_review_ids_by_user(db, "u2", [review.id]) == {review.id}
    assert rating_repo.remove_like(db, "u2", review.id).likes == 1
    assert rating_repo.remove_like(db, "u2", review.id).likes == 1  # second DELETE: unchanged
    assert rating_repo.get_liked_review_ids_by_user(db, "u2", [review.id]) == set()


def test_like_missing_rating_returns_none(db):
    assert rating_repo.add_like(db, "u1", 12345) is None
    assert rating_repo.remove_like(db, "u1", 12345) is None


def test_ratings_pagination_and_totals(db):
    for i in range(5):
        rating_repo.create_or_update_review(db, f"user{i}", "placeA", _scores())
    page = rating_repo.get_reviews_by_place_id(db, "placeA", 2, 2)
    assert len(page) == 2
    assert rating_repo.count_reviews_by_place_id(db, "placeA") == 5
    assert rating_repo.get_reviews_by_place_id(db, "placeA", 10, 5) == []
    assert rating_repo.count_reviews_by_place_id(db, "unknown") == 0
    assert len(rating_repo.get_all_user_reviews(db, "user0", 50, 0)) == 1


def test_history_pagination_and_get_by_id_is_owner_scoped(db):
    ids = [history_repo.add_history_entry(db, "u1", f"p{i}").id for i in range(4)]
    history_repo.add_history_entry(db, "u2", "p9")
    assert history_repo.count_history_by_user(db, "u1") == 4
    assert len(history_repo.get_history_by_user(db, "u1", 3, 0)) == 3
    assert len(history_repo.get_history_by_user(db, "u1", 3, 3)) == 1
    assert history_repo.get_history_entry(db, ids[0], "u1").id == ids[0]
    assert history_repo.get_history_entry(db, ids[0], "u2") is None


def test_saved_for_later_pagination_and_get_by_id_is_owner_scoped(db):
    first, _ = saved_for_later_repo.add_save_for_later_entry(db, "u1", "p1")
    saved_for_later_repo.add_save_for_later_entry(db, "u1", "p2")
    saved_for_later_repo.add_save_for_later_entry(db, "u2", "p1")
    assert saved_for_later_repo.count_save_for_later_by_user(db, "u1") == 2
    assert len(saved_for_later_repo.get_save_for_later_by_user(db, "u1", 1, 1)) == 1
    assert saved_for_later_repo.get_save_for_later_entry(db, first.id, "u1").id == first.id
    assert saved_for_later_repo.get_save_for_later_entry(db, first.id, "u2") is None


def test_delete_favorite_requires_matching_list_and_owner(db):
    mine = favorites_repo.create_list(db, "u1", "Mine")
    other = favorites_repo.create_list(db, "u1", "Other")
    foreign = favorites_repo.create_list(db, "u2", "Foreign")
    fav = favorites_repo.add_favorite(db, mine.id, "p1")
    assert favorites_repo.delete_favorite(db, other.id, fav.id, "u1") is False  # wrong list
    assert favorites_repo.delete_favorite(db, mine.id, fav.id, "u2") is False   # not the owner
    assert favorites_repo.delete_favorite(db, foreign.id, fav.id, "u1") is False
    assert favorites_repo.delete_favorite(db, mine.id, fav.id, "u1") is True
    assert favorites_repo.delete_favorite(db, mine.id, fav.id, "u1") is False
