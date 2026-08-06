import pytest
from unittest.mock import patch, MagicMock
from app.services import historial_service
from app.models.entities.historial import Historial

from app.models.entities.restaurante import Restaurante

@patch("app.services.historial_service.historial_repo")
def test_get_historial(mock_repo):
    db_mock = MagicMock()
    mock_repo.get_historial_by_user.return_value = [
        Historial(id=1, user_id="uid1", restaurante=Restaurante(place_id="place1"))
    ]
    
    result = historial_service.get_historial(db_mock, "uid1")
    
    assert len(result) == 1
    assert result[0].place_id == "place1"
    mock_repo.get_historial_by_user.assert_called_once_with(db_mock, "uid1")

@patch("app.services.historial_service.historial_repo")
def test_add_to_historial(mock_repo):
    db_mock = MagicMock()
    mock_repo.add_historial_entry.return_value = Historial(
        id=1, user_id="uid1", restaurante=Restaurante(place_id="place1")
    )
    
    result = historial_service.add_to_historial(db_mock, "uid1", "place1")
    
    assert result.id == 1
    assert result.place_id == "place1"
    mock_repo.add_historial_entry.assert_called_once_with(db_mock, "uid1", "place1")

@patch("app.services.historial_service.historial_repo")
def test_delete_from_historial(mock_repo):
    db_mock = MagicMock()
    mock_repo.delete_historial_entry.return_value = True
    
    result = historial_service.delete_from_historial(db_mock, 1, "uid1")
    
    assert result is True
    mock_repo.delete_historial_entry.assert_called_once_with(db_mock, 1, "uid1")


@patch("app.services.historial_service.historial_repo")
def test_get_popular_places(mock_repo):
    """get_popular_places debe devolver los places_id más visitados del repo."""
    db_mock = MagicMock()
    mock_repo.get_top_places.return_value = [("place1", 10), ("place2", 5)]

    result = historial_service.get_popular_places(db_mock, limit=2)

    assert result == [("place1", 10), ("place2", 5)]
    mock_repo.get_top_places.assert_called_once_with(db_mock, 2)


@patch("app.services.historial_service.historial_repo")
def test_get_popular_places_vacio(mock_repo):
    """get_popular_places devuelve lista vacía si no hay historial."""
    db_mock = MagicMock()
    mock_repo.get_top_places.return_value = []

    result = historial_service.get_popular_places(db_mock)
    assert result == []

