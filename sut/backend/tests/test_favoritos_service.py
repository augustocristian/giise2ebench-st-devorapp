import pytest
from unittest.mock import patch, MagicMock
from app.services import favoritos_service
from app.models.entities.listas_favoritos import ListaFavoritos
from app.models.entities.favoritos import Favorito

@patch("app.services.favoritos_service.favoritos_repo")
def test_get_listas(mock_repo):
    db_mock = MagicMock()
    mock_repo.get_listas_by_user.return_value = [ListaFavoritos(id=1, user_id="uid1", nombre="Fav1")]
    
    result = favoritos_service.get_listas(db_mock, "uid1")
    
    assert len(result) == 1
    assert result[0].nombre == "Fav1"
    mock_repo.get_listas_by_user.assert_called_once_with(db_mock, "uid1")

@patch("app.services.favoritos_service.favoritos_repo")
def test_get_lista_by_id(mock_repo):
    db_mock = MagicMock()
    mock_repo.get_lista_by_id.return_value = ListaFavoritos(id=1, user_id="uid1", nombre="Fav1")
    
    result = favoritos_service.get_lista_by_id(db_mock, 1, "uid1")
    
    assert result.nombre == "Fav1"
    mock_repo.get_lista_by_id.assert_called_once_with(db_mock, 1, "uid1")

@patch("app.services.favoritos_service.favoritos_repo")
def test_create_lista_success(mock_repo):
    db_mock = MagicMock()
    mock_repo.get_lista_by_nombre.return_value = None
    mock_repo.create_lista.return_value = ListaFavoritos(id=1, user_id="uid1", nombre="Fav1", icono="Heart")
    
    result = favoritos_service.create_lista(db_mock, "uid1", "Fav1")
    
    assert result.id == 1
    mock_repo.create_lista.assert_called_once_with(db_mock, "uid1", "Fav1", "Heart")

@patch("app.services.favoritos_service.favoritos_repo")
def test_create_lista_duplicate(mock_repo):
    db_mock = MagicMock()
    mock_repo.get_lista_by_nombre.return_value = ListaFavoritos(id=1, user_id="uid1", nombre="Fav1")
    
    with pytest.raises(ValueError, match="Ya existe una lista de favoritos llamada"):
        favoritos_service.create_lista(db_mock, "uid1", "Fav1")

@patch("app.services.favoritos_service.favoritos_repo")
def test_delete_lista(mock_repo):
    db_mock = MagicMock()
    mock_repo.delete_lista.return_value = True
    
    result = favoritos_service.delete_lista(db_mock, 1, "uid1")
    
    assert result is True
    mock_repo.delete_lista.assert_called_once_with(db_mock, 1, "uid1")

from app.models.entities.restaurante import Restaurante

@patch("app.services.favoritos_service.favoritos_repo")
def test_get_favoritos(mock_repo):
    db_mock = MagicMock()
    mock_repo.get_favoritos_by_lista.return_value = [
        Favorito(id=1, lista_id=1, restaurante=Restaurante(place_id="place1"))
    ]
    
    result = favoritos_service.get_favoritos(db_mock, 1)
    
    assert len(result) == 1
    assert result[0].place_id == "place1"
    mock_repo.get_favoritos_by_lista.assert_called_once_with(db_mock, 1)

@patch("app.services.favoritos_service.favoritos_repo")
def test_add_favorito_success(mock_repo):
    db_mock = MagicMock()
    mock_repo.get_favorito_by_place.return_value = None
    mock_repo.add_favorito.return_value = Favorito(id=1, lista_id=1, restaurante=Restaurante(place_id="place1"))
    
    result = favoritos_service.add_favorito(db_mock, 1, "place1")
    
    assert result.id == 1
    mock_repo.add_favorito.assert_called_once_with(db_mock, 1, "place1")

@patch("app.services.favoritos_service.favoritos_repo")
def test_add_favorito_duplicate(mock_repo):
    db_mock = MagicMock()
    mock_repo.get_favorito_by_place.return_value = Favorito(id=1, lista_id=1, restaurante=Restaurante(place_id="place1"))
    
    with pytest.raises(ValueError, match="Este restaurante ya está en la lista de favoritos."):
        favoritos_service.add_favorito(db_mock, 1, "place1")

@patch("app.services.favoritos_service.favoritos_repo")
def test_delete_favorito(mock_repo):
    db_mock = MagicMock()
    mock_repo.delete_favorito.return_value = True
    
    result = favoritos_service.delete_favorito(db_mock, 1, "uid1")
    
    assert result is True
    mock_repo.delete_favorito.assert_called_once_with(db_mock, 1, "uid1")
