"""Tests for scripts/migrate_firestore_users.py using an in-memory fake Firestore client."""
import importlib.util
import pathlib
import sys

import pytest

_SCRIPT = pathlib.Path(__file__).resolve().parent.parent / "scripts" / "migrate_firestore_users.py"
_spec = importlib.util.spec_from_file_location("migrate_firestore_users", _SCRIPT)
mig = importlib.util.module_from_spec(_spec)
# @dataclass looks the module up in sys.modules while the class is built (Python 3.12)
sys.modules[_spec.name] = mig
_spec.loader.exec_module(mig)


class FakeSnapshot:
    def __init__(self, doc_id, data):
        self.id = doc_id
        self._data = data

    @property
    def exists(self):
        return self._data is not None

    def to_dict(self):
        return None if self._data is None else dict(self._data)


class FakeDocRef:
    def __init__(self, store, name, doc_id):
        self._store, self._name, self.id = store, name, doc_id

    def get(self):
        return FakeSnapshot(self.id, self._store.get(self._name, {}).get(self.id))

    def set(self, data):
        self._store.setdefault(self._name, {})[self.id] = dict(data)

    def delete(self):
        self._store.get(self._name, {}).pop(self.id, None)


class FakeCollection:
    def __init__(self, store, name):
        self._store, self._name = store, name

    def document(self, doc_id):
        return FakeDocRef(self._store, self._name, doc_id)

    def stream(self):
        return [FakeSnapshot(i, d) for i, d in list(self._store.get(self._name, {}).items())]


class FakeFirestore:
    def __init__(self, store=None):
        self.store = store if store is not None else {}

    def collection(self, name):
        return FakeCollection(self.store, name)


@pytest.fixture
def client():
    return FakeFirestore({
        "usuarios": {
            "u1": {"username": "ana", "nombre": "Ana", "apellidos": "Lopez", "ubicacion": "Gijon", "is_google": False},
            "u2": {"username": "bob", "nombre": "Bob", "apellidos": "", "ubicacion": None, "is_google": True},
        }
    })


def _quiet(_message):
    pass


def test_convert_profile_renames_fields_and_keeps_the_rest():
    result = mig.convert_profile({"username": "x", "nombre": "A", "apellidos": "B", "ubicacion": "C", "is_google": True})
    assert result == {"username": "x", "first_name": "A", "last_name": "B", "location": "C", "is_google": True}


def test_apply_copies_documents_with_renamed_fields(client):
    report = mig.migrate(client, apply=True, log=_quiet)
    assert sorted(report.copied) == ["u1", "u2"]
    assert client.store["users"]["u1"] == {
        "username": "ana", "first_name": "Ana", "last_name": "Lopez", "location": "Gijon", "is_google": False,
    }
    assert client.store["users"]["u2"]["is_google"] is True
    assert client.store["users"]["u2"]["location"] is None
    # old documents are kept without --delete-old
    assert set(client.store["usuarios"]) == {"u1", "u2"}


def test_dry_run_writes_nothing(client):
    before = {k: dict(v) for k, v in client.store.items()}
    report = mig.migrate(client, apply=False, delete_old=True, log=_quiet)
    assert sorted(report.copied) == ["u1", "u2"]
    assert sorted(report.deleted) == ["u1", "u2"]  # reported only
    assert client.store == before
    assert "users" not in client.store


def test_existing_targets_are_skipped_not_overwritten(client):
    client.store["users"] = {"u1": {"username": "ana", "first_name": "EDITED"}}
    report = mig.migrate(client, apply=True, log=_quiet)
    assert report.skipped_existing == ["u1"]
    assert report.copied == ["u2"]
    assert client.store["users"]["u1"]["first_name"] == "EDITED"


def test_is_idempotent(client):
    mig.migrate(client, apply=True, log=_quiet)
    snapshot = {k: dict(v) for k, v in client.store.items()}
    report = mig.migrate(client, apply=True, log=_quiet)
    assert report.copied == []
    assert sorted(report.skipped_existing) == ["u1", "u2"]
    assert client.store == snapshot


def test_delete_old_removes_old_documents_after_copy(client):
    report = mig.migrate(client, apply=True, delete_old=True, log=_quiet)
    assert sorted(report.deleted) == ["u1", "u2"]
    assert client.store["usuarios"] == {}
    assert set(client.store["users"]) == {"u1", "u2"}


def test_delete_old_never_deletes_when_copy_fails(client, monkeypatch):
    original_set = FakeDocRef.set

    def failing_set(self, data):
        if self.id == "u1":
            raise RuntimeError("boom")
        original_set(self, data)

    monkeypatch.setattr(FakeDocRef, "set", failing_set)
    report = mig.migrate(client, apply=True, delete_old=True, log=_quiet)
    assert [uid for uid, _ in report.errors] == ["u1"]
    assert "u1" in client.store["usuarios"]  # not deleted because the copy failed
    assert "u1" not in client.store.get("users", {})
    assert "u2" not in client.store["usuarios"]  # the other one was migrated normally
    assert "u2" in client.store["users"]


def test_delete_old_without_apply_deletes_nothing(client):
    mig.migrate(client, apply=False, delete_old=True, log=_quiet)
    assert set(client.store["usuarios"]) == {"u1", "u2"}


def test_main_dry_run_then_apply(monkeypatch, client):
    monkeypatch.setattr(mig, "_build_client", lambda service_account: client)
    assert mig.main([]) == 0
    assert "users" not in client.store
    assert mig.main(["--apply", "--delete-old"]) == 0
    assert set(client.store["users"]) == {"u1", "u2"}
    assert client.store["usuarios"] == {}
