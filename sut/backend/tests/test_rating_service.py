import pytest
from unittest.mock import patch, MagicMock
from app.services import rating_service
from app.models.dtos.rating_dto import RatingUpsert
from app.models.entities.rating import Rating
from datetime import datetime


from app.models.entities.restaurant import Restaurant


@patch("app.services.rating_service.rating_repo")
def test_rate_restaurant_creates_new(mock_repo):
    db_mock = MagicMock()
    data = RatingUpsert(quality=5, price=4, hygiene=3, service=5)
    mock_entity = Rating(
        id=1, user_id="uid1", restaurant=Restaurant(place_id="place1"),
        quality=5, price=4, hygiene=3, service=5, comment=None, likes=0, created_at=datetime.now()
    )
    mock_repo.create_or_update_review.return_value = (mock_entity, True)

    result, created = rating_service.rate_restaurant(db_mock, "uid1", "place1", data)

    mock_repo.create_or_update_review.assert_called_once_with(db_mock, "uid1", "place1", data)
    assert created is True
    assert result.place_id == "place1"
    assert result.quality == 5


@patch("app.services.rating_service.rating_repo")
def test_get_all_my_reviews(mock_repo):
    db_mock = MagicMock()
    mock_repo.get_all_user_reviews.return_value = [
        Rating(id=1, user_id="uid1", restaurant=Restaurant(place_id="place1"), quality=4, price=3, hygiene=5, service=4, comment="Muy bien", likes=0, created_at=datetime.now()),
        Rating(id=2, user_id="uid1", restaurant=Restaurant(place_id="place2"), quality=2, price=2, hygiene=3, service=2, comment=None, likes=0, created_at=datetime.now()),
    ]

    mock_repo.count_user_reviews.return_value = 9

    result, total = rating_service.get_all_my_reviews(db_mock, "uid1", 2, 4)

    mock_repo.get_all_user_reviews.assert_called_once_with(db_mock, "uid1", 2, 4)
    assert total == 9
    assert len(result) == 2
    assert result[0].place_id == "place1"
    assert result[1].place_id == "place2"


@patch("app.services.rating_service.rating_repo")
def test_get_my_review_existing(mock_repo):
    db_mock = MagicMock()
    mock_repo.get_user_review_by_place_id.return_value = Rating(
        id=1, user_id="uid1", restaurant=Restaurant(place_id="place1"), quality=3, price=4, hygiene=5, service=3, comment="Ok", likes=0, created_at=datetime.now()
    )

    result = rating_service.get_my_review(db_mock, "uid1", "place1")

    assert result["place_id"] == "place1"
    assert result["quality"] == 3


@patch("app.services.rating_service.rating_repo")
def test_get_my_review_nonexistent(mock_repo):
    db_mock = MagicMock()
    mock_repo.get_user_review_by_place_id.return_value = None

    result = rating_service.get_my_review(db_mock, "uid1", "place_inexistente")

    assert result == {}


@patch("app.services.rating_service.rating_repo")
def test_delete_review_existing(mock_repo):
    db_mock = MagicMock()
    mock_repo.delete_review.return_value = True

    result = rating_service.delete_review(db_mock, "uid1", "place1")

    assert result is True
    mock_repo.delete_review.assert_called_once_with(db_mock, "uid1", "place1")


@patch("app.services.rating_service.rating_repo")
def test_delete_review_nonexistent(mock_repo):
    db_mock = MagicMock()
    mock_repo.delete_review.return_value = False

    result = rating_service.delete_review(db_mock, "uid1", "place_inexistente")

    assert result is False


# ── get_restaurant_reviews ───────────────────────────────────────────────

@patch("app.services.rating_service.rating_repo")
def test_get_reviews_restaurant_with_data(mock_repo):
    db_mock = MagicMock()
    v1 = Rating(id=1, user_id="uid1", restaurant=Restaurant(place_id="place1"), quality=5, price=4, hygiene=3, service=5, comment="Muy bien", likes=2, created_at=datetime.now())
    v2 = Rating(id=2, user_id="uid2", restaurant=Restaurant(place_id="place1"), quality=3, price=3, hygiene=4, service=4, comment=None, likes=0, created_at=datetime.now())
    mock_repo.get_reviews_by_place_id.return_value = [v1, v2]

    mock_user_1 = MagicMock()
    mock_user_1.username = "pepe"
    mock_user_2 = MagicMock()
    mock_user_2.username = "ana"

    with patch("app.services.rating_service.rating_repo", mock_repo), \
         patch("app.infrastructure.repositories.usuario_repo.get_user_by_uid", side_effect=[mock_user_1, mock_user_2]):
        result, total = rating_service.get_restaurant_reviews(db_mock, "place1")

    assert total == mock_repo.count_reviews_by_place_id.return_value
    assert len(result) == 2
    assert result[0].username == "pepe"
    assert result[0].quality == 5
    assert result[0].likes == 2
    assert result[1].username == "ana"
    assert result[1].comment is None


@patch("app.services.rating_service.rating_repo")
def test_get_reviews_restaurant_without_data(mock_repo):
    db_mock = MagicMock()
    mock_repo.get_reviews_by_place_id.return_value = []

    mock_repo.count_reviews_by_place_id.return_value = 0

    result, total = rating_service.get_restaurant_reviews(db_mock, "place_sin_resenas")

    assert result == []
    assert total == 0
    mock_repo.get_reviews_by_place_id.assert_called_once_with(db_mock, "place_sin_resenas", 50, 0)


@patch("app.services.rating_service.rating_repo")
def test_get_reviews_unknown_user(mock_repo):
    """If Firebase does not return the user, the username must be 'Usuario desconocido'."""
    db_mock = MagicMock()
    mock_repo.get_reviews_by_place_id.return_value = [
        Rating(id=1, user_id="uid_raro", restaurant=Restaurant(place_id="place1"), quality=4, price=4, hygiene=4, service=4, comment=None, likes=0, created_at=datetime.now())
    ]

    with patch("app.services.rating_service.rating_repo", mock_repo), \
         patch("app.infrastructure.repositories.usuario_repo.get_user_by_uid", return_value=None):
        result, _ = rating_service.get_restaurant_reviews(db_mock, "place1")

    assert len(result) == 1
    assert result[0].username == "Usuario desconocido"


# ── like_review ──────────────────────────────────────────────────────────────

@patch("app.services.rating_service.rating_repo")
def test_like_review_successful(mock_repo):
    db_mock = MagicMock()
    updated = Rating(id=1, user_id="uid1", restaurant=Restaurant(place_id="place1"), quality=5, price=4, hygiene=3, service=5, comment="Ok", likes=3, created_at=datetime.now())
    mock_repo.add_like.return_value = updated
    mock_repo.get_liked_review_ids_by_user.return_value = {1}

    mock_user_entity = MagicMock()
    mock_user_entity.username = "pepe"

    with patch("app.services.rating_service.rating_repo", mock_repo), \
         patch("app.infrastructure.repositories.usuario_repo.get_user_by_uid", return_value=mock_user_entity):
        result = rating_service.like_review(db_mock, "uid1", 1)

    assert result is not None
    assert result.likes == 3
    assert result.username == "pepe"
    assert result.liked_by_me is True


@patch("app.services.rating_service.rating_repo")
def test_like_review_review_not_found(mock_repo):
    db_mock = MagicMock()
    mock_repo.add_like.return_value = None

    result = rating_service.like_review(db_mock, "uid1", 9999)

    assert result is None
    mock_repo.add_like.assert_called_once_with(db_mock, "uid1", 9999)


@patch("app.services.rating_service.rating_repo")
def test_rate_restaurant_replaces_existing(mock_repo):
    entity = Rating(id=1, user_id="uid1", restaurant=Restaurant(place_id="place1"),
                    quality=1, price=1, hygiene=1, service=1, comment="x", likes=0, created_at=datetime.now())
    mock_repo.create_or_update_review.return_value = (entity, False)
    _, created = rating_service.rate_restaurant(
        MagicMock(), "uid1", "place1", RatingUpsert(quality=1, price=1, hygiene=1, service=1, comment="x"))
    assert created is False


@patch("app.services.rating_service.rating_repo")
def test_unlike_review_existing_and_missing(mock_repo):
    db_mock = MagicMock()
    mock_repo.remove_like.return_value = Rating(id=1, user_id="u", restaurant=Restaurant(place_id="p"),
                                                quality=1, price=1, hygiene=1, service=1, likes=0,
                                                created_at=datetime.now())
    assert rating_service.unlike_review(db_mock, "uid1", 1) is True
    mock_repo.remove_like.assert_called_once_with(db_mock, "uid1", 1)

    mock_repo.remove_like.return_value = None
    assert rating_service.unlike_review(db_mock, "uid1", 9999) is False


@patch("app.services.rating_service.rating_repo")
def test_like_review_reports_liked_by_me_from_repo(mock_repo):
    """liked_by_me must reflect the persisted like, so POST twice yields the same body."""
    review = Rating(id=1, user_id="uid1", restaurant=Restaurant(place_id="place1"), quality=5, price=4,
                    hygiene=3, service=5, comment=None, likes=1, created_at=datetime.now())
    mock_repo.add_like.return_value = review
    mock_repo.get_liked_review_ids_by_user.return_value = {1}
    user = MagicMock()
    user.username = "pepe"
    with patch("app.infrastructure.repositories.usuario_repo.get_user_by_uid", return_value=user):
        first = rating_service.like_review(MagicMock(), "uid1", 1)
        second = rating_service.like_review(MagicMock(), "uid1", 1)
    assert first == second and first.likes == 1 and first.liked_by_me is True
