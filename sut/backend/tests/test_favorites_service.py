import pytest
from unittest.mock import patch, MagicMock
from app.services import favorites_service
from app.models.entities.favorite_lists import FavoriteList
from app.models.entities.favorites import Favorite

@patch("app.services.favorites_service.favorites_repo")
def test_get_lists(mock_repo):
    db_mock = MagicMock()
    mock_repo.get_lists_by_user.return_value = [FavoriteList(id=1, user_id="uid1", name="Fav1")]
    
    result = favorites_service.get_lists(db_mock, "uid1")
    
    assert len(result) == 1
    assert result[0].name == "Fav1"
    mock_repo.get_lists_by_user.assert_called_once_with(db_mock, "uid1")

@patch("app.services.favorites_service.favorites_repo")
def test_get_list_by_id(mock_repo):
    db_mock = MagicMock()
    mock_repo.get_list_by_id.return_value = FavoriteList(id=1, user_id="uid1", name="Fav1")
    
    result = favorites_service.get_list_by_id(db_mock, 1, "uid1")
    
    assert result.name == "Fav1"
    mock_repo.get_list_by_id.assert_called_once_with(db_mock, 1, "uid1")

@patch("app.services.favorites_service.favorites_repo")
def test_create_list_success(mock_repo):
    db_mock = MagicMock()
    mock_repo.get_list_by_name.return_value = None
    mock_repo.create_list.return_value = FavoriteList(id=1, user_id="uid1", name="Fav1", icon="Heart")
    
    result = favorites_service.create_list(db_mock, "uid1", "Fav1")
    
    assert result.id == 1
    mock_repo.create_list.assert_called_once_with(db_mock, "uid1", "Fav1", "Heart")

@patch("app.services.favorites_service.favorites_repo")
def test_create_list_duplicate(mock_repo):
    db_mock = MagicMock()
    mock_repo.get_list_by_name.return_value = FavoriteList(id=1, user_id="uid1", name="Fav1")
    
    with pytest.raises(favorites_service.ConflictError, match="Ya existe una lista de favoritos llamada"):
        favorites_service.create_list(db_mock, "uid1", "Fav1")


@patch("app.services.favorites_service.favorites_repo")
def test_create_list_empty_name_is_validation_error(mock_repo):
    with pytest.raises(ValueError) as exc:
        favorites_service.create_list(MagicMock(), "uid1", "   ")
    assert not isinstance(exc.value, favorites_service.ConflictError)
    mock_repo.create_list.assert_not_called()


@patch("app.services.favorites_service.favorites_repo")
def test_update_list_duplicate_name_is_conflict(mock_repo):
    mock_repo.get_list_by_name.return_value = FavoriteList(id=2, user_id="uid1", name="Otra")
    with pytest.raises(favorites_service.ConflictError):
        favorites_service.update_list(MagicMock(), 1, "uid1", "Otra")

@patch("app.services.favorites_service.favorites_repo")
def test_delete_list(mock_repo):
    db_mock = MagicMock()
    mock_repo.delete_list.return_value = True
    
    result = favorites_service.delete_list(db_mock, 1, "uid1")
    
    assert result is True
    mock_repo.delete_list.assert_called_once_with(db_mock, 1, "uid1")

from app.models.entities.restaurant import Restaurant

@patch("app.services.favorites_service.favorites_repo")
def test_get_favorites(mock_repo):
    db_mock = MagicMock()
    mock_repo.get_favorites_by_list.return_value = [
        Favorite(id=1, list_id=1, restaurant=Restaurant(place_id="place1"))
    ]
    
    result = favorites_service.get_favorites(db_mock, 1)
    
    assert len(result) == 1
    assert result[0].place_id == "place1"
    mock_repo.get_favorites_by_list.assert_called_once_with(db_mock, 1)

@patch("app.services.favorites_service.favorites_repo")
def test_add_favorite_success(mock_repo):
    db_mock = MagicMock()
    mock_repo.get_favorite_by_place.return_value = None
    mock_repo.add_favorite.return_value = Favorite(id=1, list_id=1, restaurant=Restaurant(place_id="place1"))
    
    result = favorites_service.add_favorite(db_mock, 1, "place1")
    
    assert result.id == 1
    mock_repo.add_favorite.assert_called_once_with(db_mock, 1, "place1")

@patch("app.services.favorites_service.favorites_repo")
def test_add_favorite_duplicate(mock_repo):
    db_mock = MagicMock()
    mock_repo.get_favorite_by_place.return_value = Favorite(id=1, list_id=1, restaurant=Restaurant(place_id="place1"))
    
    with pytest.raises(favorites_service.ConflictError, match="Este restaurante ya está en la lista de favoritos."):
        favorites_service.add_favorite(db_mock, 1, "place1")

@patch("app.services.favorites_service.favorites_repo")
def test_delete_favorite(mock_repo):
    db_mock = MagicMock()
    mock_repo.delete_favorite.return_value = True
    
    result = favorites_service.delete_favorite(db_mock, 3, 1, "uid1")
    
    assert result is True
    mock_repo.delete_favorite.assert_called_once_with(db_mock, 3, 1, "uid1")
