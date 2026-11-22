"""rename_spanish_schema_to_english

Renames the Spanish tables and columns to American English, together with the
primary keys, foreign keys, unique constraints, indexes and sequences that carry
the old names, so an upgraded database is identical to one created from the models.

Revision ID: a41c7e2f9b10
Revises: 327df2edf9d9
Create Date: 2026-11-22 12:00:00.000000

"""
import re
from typing import Sequence, Union

from alembic import op


# revision identifiers, used by Alembic.
revision: str = 'a41c7e2f9b10'
down_revision: Union[str, Sequence[str], None] = '327df2edf9d9'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


# (old table, new table)
TABLES = [
    ("favoritos", "favorites"),
    ("listas_favoritos", "favorite_lists"),
    ("historial", "history"),
    ("mas_tarde", "saved_for_later"),
    ("valoraciones", "ratings"),
    ("likes_valoraciones", "rating_likes"),
    ("restaurantes", "restaurants"),
]

# new table -> [(old column, new column)]
COLUMNS = {
    "favorites": [("lista_id", "list_id"), ("restaurante_id", "restaurant_id")],
    "favorite_lists": [("nombre", "name"), ("icono", "icon")],
    "history": [("restaurante_id", "restaurant_id"), ("fecha_acceso", "accessed_at")],
    "saved_for_later": [("restaurante_id", "restaurant_id")],
    "ratings": [
        ("restaurante_id", "restaurant_id"),
        ("calidad", "quality"),
        ("precio", "price"),
        ("higiene", "hygiene"),
        ("trato", "service"),
        ("comentario", "comment"),
        ("me_gustas", "likes"),
        ("fecha", "created_at"),
    ],
    "rating_likes": [("valoracion_id", "rating_id")],
}

# Extra name fragments used inside constraint names (e.g. uq_user_valoracion_like).
EXTRA_TOKENS = [("valoracion", "rating")]


def _translate(name: str, tables, columns, tokens) -> str:
    """Translate an index/constraint/sequence name from one naming scheme to the other."""
    new = name
    for old_t, new_t in sorted(tables, key=lambda p: len(p[0]), reverse=True):
        pattern = r"^(ix_)?%s_" % re.escape(old_t)
        if re.match(pattern, new):
            new = re.sub(pattern, lambda m: (m.group(1) or "") + new_t + "_", new, count=1)
            break
    for old_c, new_c in columns:
        new = re.sub(r"(?<=_)%s(?=_|$)" % re.escape(old_c), new_c, new)
    for old_k, new_k in tokens:
        new = re.sub(r"(?<=_)%s(?=_|$)" % re.escape(old_k), new_k, new)
    return new


def _apply(tables, columns, tokens) -> None:
    """
    tables:  [(source table, destination table)]
    columns: {destination table: [(source column, destination column)]}
    tokens:  extra [(source fragment, destination fragment)] for constraint names
    """
    bind = op.get_bind()

    for src, dst in tables:
        op.rename_table(src, dst)
    for _, dst in tables:
        for src_c, dst_c in columns.get(dst, []):
            op.alter_column(dst, src_c, new_column_name=dst_c)

    # Constraints, indexes and sequences that carry the old names
    for src, dst in tables:
        cols = columns.get(dst, [])
        constraints = [r[0] for r in bind.exec_driver_sql(
            "SELECT conname FROM pg_constraint WHERE conrelid = %s::regclass", (dst,))]
        for name in constraints:
            new = _translate(name, tables, cols, tokens)
            if new != name:
                op.execute('ALTER TABLE "%s" RENAME CONSTRAINT "%s" TO "%s"' % (dst, name, new))
        indexes = [r[0] for r in bind.exec_driver_sql(
            "SELECT indexname FROM pg_indexes WHERE schemaname = current_schema() AND tablename = %s",
            (dst,))]
        for name in indexes:
            new = _translate(name, tables, cols, tokens)
            if new != name:
                op.execute('ALTER INDEX "%s" RENAME TO "%s"' % (name, new))
        old_seq = "%s_id_seq" % src
        new_seq = _translate(old_seq, tables, [], tokens)
        op.execute('ALTER SEQUENCE IF EXISTS "%s" RENAME TO "%s"' % (old_seq, new_seq))


def upgrade() -> None:
    """Upgrade schema: Spanish -> American English names."""
    _apply(TABLES, COLUMNS, EXTRA_TOKENS)


def downgrade() -> None:
    """Downgrade schema: American English -> Spanish names."""
    tables = [(new, old) for old, new in TABLES]
    columns = {old: [(n, o) for o, n in COLUMNS[new]] for old, new in TABLES if new in COLUMNS}
    tokens = [(new, old) for old, new in EXTRA_TOKENS]
    _apply(tables, columns, tokens)
