import pytest
from unittest.mock import patch, MagicMock
from app.services import history_service
from app.models.entities.history import History

from app.models.entities.restaurant import Restaurant

@patch("app.services.history_service.history_repo")
def test_get_history(mock_repo):
    db_mock = MagicMock()
    mock_repo.get_history_by_user.return_value = [
        History(id=1, user_id="uid1", restaurant=Restaurant(place_id="place1"))
    ]
    
    mock_repo.count_history_by_user.return_value = 41
    result, total = history_service.get_history(db_mock, "uid1", 10, 20)
    
    assert len(result) == 1
    assert result[0].place_id == "place1"
    assert total == 41
    mock_repo.get_history_by_user.assert_called_once_with(db_mock, "uid1", 10, 20)

@patch("app.services.history_service.history_repo")
def test_add_to_history(mock_repo):
    db_mock = MagicMock()
    mock_repo.add_history_entry.return_value = History(
        id=1, user_id="uid1", restaurant=Restaurant(place_id="place1")
    )
    
    result = history_service.add_to_history(db_mock, "uid1", "place1")
    
    assert result.id == 1
    assert result.place_id == "place1"
    mock_repo.add_history_entry.assert_called_once_with(db_mock, "uid1", "place1")

@patch("app.services.history_service.history_repo")
def test_delete_from_history(mock_repo):
    db_mock = MagicMock()
    mock_repo.delete_history_entry.return_value = True
    
    result = history_service.delete_from_history(db_mock, 1, "uid1")
    
    assert result is True
    mock_repo.delete_history_entry.assert_called_once_with(db_mock, 1, "uid1")


@patch("app.services.history_service.history_repo")
def test_get_popular_places(mock_repo):
    """get_popular_places must return the most visited place ids from the repo."""
    db_mock = MagicMock()
    mock_repo.get_top_places.return_value = [("place1", 10), ("place2", 5)]

    result = history_service.get_popular_places(db_mock, limit=2)

    assert result == [("place1", 10), ("place2", 5)]
    mock_repo.get_top_places.assert_called_once_with(db_mock, 2)


@patch("app.services.history_service.history_repo")
def test_get_popular_places_empty(mock_repo):
    """get_popular_places returns an empty list when there is no history."""
    db_mock = MagicMock()
    mock_repo.get_top_places.return_value = []

    result = history_service.get_popular_places(db_mock)
    assert result == []


@patch("app.services.history_service.history_repo")
def test_get_history_entry_scoped_to_user(mock_repo):
    db_mock = MagicMock()
    mock_repo.get_history_entry.return_value = None
    assert history_service.get_history_entry(db_mock, 5, "uid1") is None
    mock_repo.get_history_entry.assert_called_once_with(db_mock, 5, "uid1")
