"""Tests para app.services.mas_tarde_service."""
import pytest
from unittest.mock import patch, MagicMock
from app.services import mas_tarde_service
from app.models.entities.mas_tarde import MasTarde
from app.models.entities.restaurante import Restaurante


@patch("app.services.mas_tarde_service.mas_tarde_repo")
def test_get_mas_tarde(mock_repo):
    db_mock = MagicMock()
    mock_repo.get_mas_tarde_by_user.return_value = [
        MasTarde(id=1, user_id="uid1", restaurante=Restaurante(place_id="place1")),
    ]

    result = mas_tarde_service.get_mas_tarde(db_mock, "uid1")

    assert len(result) == 1
    assert result[0].place_id == "place1"
    mock_repo.get_mas_tarde_by_user.assert_called_once_with(db_mock, "uid1")


@patch("app.services.mas_tarde_service.mas_tarde_repo")
def test_get_mas_tarde_vacio(mock_repo):
    db_mock = MagicMock()
    mock_repo.get_mas_tarde_by_user.return_value = []

    result = mas_tarde_service.get_mas_tarde(db_mock, "uid1")

    assert result == []


@patch("app.services.mas_tarde_service.mas_tarde_repo")
def test_add_to_mas_tarde_nuevo(mock_repo):
    db_mock = MagicMock()
    entry = MasTarde(id=1, user_id="uid1", restaurante=Restaurante(place_id="place1"))
    mock_repo.add_mas_tarde_entry.return_value = (entry, False)

    result_entry, already_saved = mas_tarde_service.add_to_mas_tarde(db_mock, "uid1", "place1")

    assert result_entry.id == 1
    assert result_entry.place_id == "place1"
    assert already_saved is False
    mock_repo.add_mas_tarde_entry.assert_called_once_with(db_mock, "uid1", "place1")


@patch("app.services.mas_tarde_service.mas_tarde_repo")
def test_add_to_mas_tarde_ya_existente(mock_repo):
    db_mock = MagicMock()
    entry = MasTarde(id=2, user_id="uid1", restaurante=Restaurante(place_id="place2"))
    mock_repo.add_mas_tarde_entry.return_value = (entry, True)

    result_entry, already_saved = mas_tarde_service.add_to_mas_tarde(db_mock, "uid1", "place2")

    assert already_saved is True


@patch("app.services.mas_tarde_service.mas_tarde_repo")
def test_delete_from_mas_tarde_success(mock_repo):
    db_mock = MagicMock()
    mock_repo.delete_mas_tarde_entry.return_value = True

    result = mas_tarde_service.delete_from_mas_tarde(db_mock, 1, "uid1")

    assert result is True
    mock_repo.delete_mas_tarde_entry.assert_called_once_with(db_mock, 1, "uid1")


@patch("app.services.mas_tarde_service.mas_tarde_repo")
def test_delete_from_mas_tarde_not_found(mock_repo):
    db_mock = MagicMock()
    mock_repo.delete_mas_tarde_entry.return_value = False

    result = mas_tarde_service.delete_from_mas_tarde(db_mock, 999, "uid1")

    assert result is False
