"""
Migrate the Firestore profile data from the Spanish layout to the English one.

    usuarios/{uid}  ->  users/{uid}
    nombre          ->  first_name
    apellidos       ->  last_name
    ubicacion       ->  location
    (username, is_google and any other field are copied unchanged)

Behavior:
  * Dry-run by default: reports what would happen and writes nothing.
  * --apply       actually writes the new documents.
  * --delete-old  also removes each old `usuarios/{uid}` document once its `users/{uid}`
                  counterpart exists (copied in this run, or already present from a previous
                  run). Requires --apply; in a dry-run it only reports what would be deleted.
  * Idempotent: an existing `users/{uid}` document is never overwritten, so it is safe to
    run the script several times.

Target Firestore:
  * Emulator: set FIRESTORE_EMULATOR_HOST (e.g. localhost:8080); no credentials needed.
  * Real project: a service-account file, taken from --service-account, or else from the
    FIREBASE_SERVICE_ACCOUNT_PATH setting used by the backend.

Deployment order: run this script (--apply) BEFORE deploying the backend version that reads
the `users` collection. Run it from the backend directory:

    python scripts/migrate_firestore_users.py                  # dry-run
    python scripts/migrate_firestore_users.py --apply          # copy
    python scripts/migrate_firestore_users.py --apply --delete-old
"""
from __future__ import annotations

import argparse
import os
import sys
from dataclasses import dataclass, field
from typing import Any, Callable

OLD_COLLECTION = "usuarios"
NEW_COLLECTION = "users"
FIELD_RENAMES = {
    "nombre": "first_name",
    "apellidos": "last_name",
    "ubicacion": "location",
}


@dataclass
class MigrationReport:
    copied: list[str] = field(default_factory=list)
    skipped_existing: list[str] = field(default_factory=list)
    deleted: list[str] = field(default_factory=list)
    errors: list[tuple[str, str]] = field(default_factory=list)


def convert_profile(data: dict[str, Any]) -> dict[str, Any]:
    """Return a copy of an old profile document with the English field names."""
    return {FIELD_RENAMES.get(key, key): value for key, value in data.items()}


def migrate(
    client: Any,
    apply: bool = False,
    delete_old: bool = False,
    log: Callable[[str], None] = print,
) -> MigrationReport:
    """
    Copy every `usuarios/{uid}` document to `users/{uid}` with the renamed fields.

    `client` is a Firestore client (or anything exposing the same collection/document API).
    """
    report = MigrationReport()
    mode = "APPLY" if apply else "DRY-RUN"

    for old_doc in client.collection(OLD_COLLECTION).stream():
        uid = old_doc.id
        try:
            target_ref = client.collection(NEW_COLLECTION).document(uid)
            if target_ref.get().exists:
                report.skipped_existing.append(uid)
                log(f"[{mode}] {uid}: users/{uid} already exists, skipping copy")
            else:
                new_data = convert_profile(old_doc.to_dict() or {})
                if apply:
                    target_ref.set(new_data)
                report.copied.append(uid)
                log(f"[{mode}] {uid}: {'copied' if apply else 'would copy'} to users/{uid}")

            if delete_old:
                if apply:
                    client.collection(OLD_COLLECTION).document(uid).delete()
                report.deleted.append(uid)
                log(f"[{mode}] {uid}: {'deleted' if apply else 'would delete'} usuarios/{uid}")
        except Exception as exc:  # keep going: report the failure and continue with the rest
            report.errors.append((uid, str(exc)))
            log(f"[{mode}] {uid}: ERROR {exc}")

    verb = "" if apply else "would be "
    log(
        f"[{mode}] done: {len(report.copied)} {verb}copied, "
        f"{len(report.skipped_existing)} skipped (already migrated), "
        f"{len(report.deleted)} {verb}deleted, {len(report.errors)} errors"
    )
    return report


def _build_client(service_account: str | None) -> Any:
    """Build a Firestore client using the project's firebase_admin initialization helper."""
    sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))
    from app.core.config import settings

    if service_account:
        settings.FIREBASE_SERVICE_ACCOUNT_PATH = service_account
    from app.infrastructure.firebase.firebase_admin import get_firestore_client

    return get_firestore_client()


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--apply", action="store_true", help="write the changes (default is a dry-run)")
    parser.add_argument("--delete-old", action="store_true",
                        help="delete each usuarios/{uid} once users/{uid} exists (needs --apply to take effect)")
    parser.add_argument("--service-account", help="path to the service-account JSON file (real project)")
    args = parser.parse_args(argv)

    client = _build_client(args.service_account)
    target = os.getenv("FIRESTORE_EMULATOR_HOST") or "real Firestore project"
    print(f"Target: {target}")
    report = migrate(client, apply=args.apply, delete_old=args.delete_old)
    return 1 if report.errors else 0


if __name__ == "__main__":
    sys.exit(main())
