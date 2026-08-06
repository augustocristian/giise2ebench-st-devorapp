import pytest
from unittest.mock import patch, MagicMock
from app.services import valoracion_service
from app.models.dtos.valoracion_dto import ValoracionCreate
from app.models.entities.valoracion import Valoracion
from datetime import datetime


from app.models.entities.restaurante import Restaurante


@patch("app.services.valoracion_service.valoracion_repo")
def test_valorar_restaurante_crea_nueva(mock_repo):
    db_mock = MagicMock()
    data = ValoracionCreate(place_id="place1", calidad=5, precio=4, higiene=3, trato=5)
    mock_entity = Valoracion(
        id=1, user_id="uid1", restaurante=Restaurante(place_id="place1"),
        calidad=5, precio=4, higiene=3, trato=5, comentario=None, me_gustas=0, fecha=datetime.now()
    )
    mock_repo.crear_o_actualizar_valoracion.return_value = mock_entity

    result = valoracion_service.valorar_restaurante(db_mock, "uid1", data)

    mock_repo.crear_o_actualizar_valoracion.assert_called_once_with(db_mock, "uid1", data)
    assert result.place_id == "place1"
    assert result.calidad == 5


@patch("app.services.valoracion_service.valoracion_repo")
def test_obtener_todas_mis_valoraciones(mock_repo):
    db_mock = MagicMock()
    mock_repo.obtener_todas_las_valoraciones_usuario.return_value = [
        Valoracion(id=1, user_id="uid1", restaurante=Restaurante(place_id="place1"), calidad=4, precio=3, higiene=5, trato=4, comentario="Muy bien", me_gustas=0, fecha=datetime.now()),
        Valoracion(id=2, user_id="uid1", restaurante=Restaurante(place_id="place2"), calidad=2, precio=2, higiene=3, trato=2, comentario=None, me_gustas=0, fecha=datetime.now()),
    ]

    result = valoracion_service.obtener_todas_mis_valoraciones(db_mock, "uid1")

    mock_repo.obtener_todas_las_valoraciones_usuario.assert_called_once_with(db_mock, "uid1")
    assert len(result) == 2
    assert result[0].place_id == "place1"
    assert result[1].place_id == "place2"


@patch("app.services.valoracion_service.valoracion_repo")
def test_obtener_mi_valoracion_existente(mock_repo):
    db_mock = MagicMock()
    mock_repo.obtener_valoracion_usuario_por_place_id.return_value = Valoracion(
        id=1, user_id="uid1", restaurante=Restaurante(place_id="place1"), calidad=3, precio=4, higiene=5, trato=3, comentario="Ok", me_gustas=0, fecha=datetime.now()
    )

    result = valoracion_service.obtener_mi_valoracion(db_mock, "uid1", "place1")

    assert result["place_id"] == "place1"
    assert result["calidad"] == 3


@patch("app.services.valoracion_service.valoracion_repo")
def test_obtener_mi_valoracion_no_existente(mock_repo):
    db_mock = MagicMock()
    mock_repo.obtener_valoracion_usuario_por_place_id.return_value = None

    result = valoracion_service.obtener_mi_valoracion(db_mock, "uid1", "place_inexistente")

    assert result == {}


@patch("app.services.valoracion_service.valoracion_repo")
def test_eliminar_valoracion_existente(mock_repo):
    db_mock = MagicMock()
    mock_repo.eliminar_valoracion.return_value = True

    result = valoracion_service.eliminar_valoracion(db_mock, "uid1", "place1")

    assert result is True
    mock_repo.eliminar_valoracion.assert_called_once_with(db_mock, "uid1", "place1")


@patch("app.services.valoracion_service.valoracion_repo")
def test_eliminar_valoracion_no_existente(mock_repo):
    db_mock = MagicMock()
    mock_repo.eliminar_valoracion.return_value = False

    result = valoracion_service.eliminar_valoracion(db_mock, "uid1", "place_inexistente")

    assert result is False


# ── obtener_resenas_restaurante ───────────────────────────────────────────────

@patch("app.services.valoracion_service.valoracion_repo")
def test_obtener_resenas_restaurante_con_datos(mock_repo):
    db_mock = MagicMock()
    v1 = Valoracion(id=1, user_id="uid1", restaurante=Restaurante(place_id="place1"), calidad=5, precio=4, higiene=3, trato=5, comentario="Muy bien", me_gustas=2, fecha=datetime.now())
    v2 = Valoracion(id=2, user_id="uid2", restaurante=Restaurante(place_id="place1"), calidad=3, precio=3, higiene=4, trato=4, comentario=None, me_gustas=0, fecha=datetime.now())
    mock_repo.obtener_valoraciones_por_place_id.return_value = [v1, v2]

    mock_usuario1 = MagicMock()
    mock_usuario1.username = "pepe"
    mock_usuario2 = MagicMock()
    mock_usuario2.username = "ana"

    with patch("app.services.valoracion_service.valoracion_repo", mock_repo), \
         patch("app.infrastructure.repositories.usuario_repo.get_usuario_by_uid", side_effect=[mock_usuario1, mock_usuario2]):
        result = valoracion_service.obtener_resenas_restaurante(db_mock, "place1")

    assert len(result) == 2
    assert result[0].username == "pepe"
    assert result[0].calidad == 5
    assert result[0].me_gustas == 2
    assert result[1].username == "ana"
    assert result[1].comentario is None


@patch("app.services.valoracion_service.valoracion_repo")
def test_obtener_resenas_restaurante_sin_datos(mock_repo):
    db_mock = MagicMock()
    mock_repo.obtener_valoraciones_por_place_id.return_value = []

    result = valoracion_service.obtener_resenas_restaurante(db_mock, "place_sin_resenas")

    assert result == []
    mock_repo.obtener_valoraciones_por_place_id.assert_called_once_with(db_mock, "place_sin_resenas")


@patch("app.services.valoracion_service.valoracion_repo")
def test_obtener_resenas_usuario_desconocido(mock_repo):
    """Si Firebase no devuelve el usuario, el username debe ser 'Usuario desconocido'."""
    db_mock = MagicMock()
    mock_repo.obtener_valoraciones_por_place_id.return_value = [
        Valoracion(id=1, user_id="uid_raro", restaurante=Restaurante(place_id="place1"), calidad=4, precio=4, higiene=4, trato=4, comentario=None, me_gustas=0, fecha=datetime.now())
    ]

    with patch("app.services.valoracion_service.valoracion_repo", mock_repo), \
         patch("app.infrastructure.repositories.usuario_repo.get_usuario_by_uid", return_value=None):
        result = valoracion_service.obtener_resenas_restaurante(db_mock, "place1")

    assert len(result) == 1
    assert result[0].username == "Usuario desconocido"


# ── dar_me_gusta ──────────────────────────────────────────────────────────────

@patch("app.services.valoracion_service.valoracion_repo")
def test_dar_me_gusta_exitoso(mock_repo):
    db_mock = MagicMock()
    updated = Valoracion(id=1, user_id="uid1", restaurante=Restaurante(place_id="place1"), calidad=5, precio=4, higiene=3, trato=5, comentario="Ok", me_gustas=3, fecha=datetime.now())
    mock_repo.alternar_me_gusta.return_value = updated
    mock_repo.obtener_ids_valoraciones_likeadas_por_usuario.return_value = {1}

    mock_usuario = MagicMock()
    mock_usuario.username = "pepe"

    with patch("app.services.valoracion_service.valoracion_repo", mock_repo), \
         patch("app.infrastructure.repositories.usuario_repo.get_usuario_by_uid", return_value=mock_usuario):
        result = valoracion_service.dar_me_gusta(db_mock, "uid1", 1)

    assert result is not None
    assert result.me_gustas == 3
    assert result.username == "pepe"
    assert result.ha_dado_me_gusta is True


@patch("app.services.valoracion_service.valoracion_repo")
def test_dar_me_gusta_valoracion_no_encontrada(mock_repo):
    db_mock = MagicMock()
    mock_repo.alternar_me_gusta.return_value = None

    result = valoracion_service.dar_me_gusta(db_mock, "uid1", 9999)

    assert result is None
    mock_repo.alternar_me_gusta.assert_called_once_with(db_mock, "uid1", 9999)
