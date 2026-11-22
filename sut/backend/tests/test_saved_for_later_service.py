"""Tests for app.services.saved_for_later_service."""
import pytest
from unittest.mock import patch, MagicMock
from app.services import saved_for_later_service
from app.models.entities.saved_for_later import SavedForLater
from app.models.entities.restaurant import Restaurant


@patch("app.services.saved_for_later_service.saved_for_later_repo")
def test_get_save_for_later(mock_repo):
    db_mock = MagicMock()
    mock_repo.get_save_for_later_by_user.return_value = [
        SavedForLater(id=1, user_id="uid1", restaurant=Restaurant(place_id="place1")),
    ]

    mock_repo.count_save_for_later_by_user.return_value = 12

    entries, total = saved_for_later_service.get_save_for_later(db_mock, "uid1", 5, 10)

    assert len(entries) == 1
    assert entries[0].place_id == "place1"
    assert total == 12
    mock_repo.get_save_for_later_by_user.assert_called_once_with(db_mock, "uid1", 5, 10)


@patch("app.services.saved_for_later_service.saved_for_later_repo")
def test_get_save_for_later_empty(mock_repo):
    db_mock = MagicMock()
    mock_repo.get_save_for_later_by_user.return_value = []

    mock_repo.count_save_for_later_by_user.return_value = 0

    entries, total = saved_for_later_service.get_save_for_later(db_mock, "uid1")

    assert entries == []
    assert total == 0


@patch("app.services.saved_for_later_service.saved_for_later_repo")
def test_get_save_for_later_entry_scoped_to_user(mock_repo):
    db_mock = MagicMock()
    mock_repo.get_save_for_later_entry.return_value = None
    assert saved_for_later_service.get_save_for_later_entry(db_mock, 3, "uid1") is None
    mock_repo.get_save_for_later_entry.assert_called_once_with(db_mock, 3, "uid1")


@patch("app.services.saved_for_later_service.saved_for_later_repo")
def test_add_to_save_for_later_new(mock_repo):
    db_mock = MagicMock()
    entry = SavedForLater(id=1, user_id="uid1", restaurant=Restaurant(place_id="place1"))
    mock_repo.add_save_for_later_entry.return_value = (entry, False)

    result_entry, already_saved = saved_for_later_service.add_to_save_for_later(db_mock, "uid1", "place1")

    assert result_entry.id == 1
    assert result_entry.place_id == "place1"
    assert already_saved is False
    mock_repo.add_save_for_later_entry.assert_called_once_with(db_mock, "uid1", "place1")


@patch("app.services.saved_for_later_service.saved_for_later_repo")
def test_add_to_save_for_later_already_exists(mock_repo):
    db_mock = MagicMock()
    entry = SavedForLater(id=2, user_id="uid1", restaurant=Restaurant(place_id="place2"))
    mock_repo.add_save_for_later_entry.return_value = (entry, True)

    result_entry, already_saved = saved_for_later_service.add_to_save_for_later(db_mock, "uid1", "place2")

    assert already_saved is True


@patch("app.services.saved_for_later_service.saved_for_later_repo")
def test_delete_from_save_for_later_success(mock_repo):
    db_mock = MagicMock()
    mock_repo.delete_save_for_later_entry.return_value = True

    result = saved_for_later_service.delete_from_save_for_later(db_mock, 1, "uid1")

    assert result is True
    mock_repo.delete_save_for_later_entry.assert_called_once_with(db_mock, 1, "uid1")


@patch("app.services.saved_for_later_service.saved_for_later_repo")
def test_delete_from_save_for_later_not_found(mock_repo):
    db_mock = MagicMock()
    mock_repo.delete_save_for_later_entry.return_value = False

    result = saved_for_later_service.delete_from_save_for_later(db_mock, 999, "uid1")

    assert result is False
