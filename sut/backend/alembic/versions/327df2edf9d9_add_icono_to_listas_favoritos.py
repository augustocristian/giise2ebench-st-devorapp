"""add_icono_to_listas_favoritos

Revision ID: 327df2edf9d9
Revises: 
Create Date: 2026-04-17 10:47:48.109470

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '327df2edf9d9'
down_revision: Union[str, Sequence[str], None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column('listas_favoritos', sa.Column('icono', sa.String(), nullable=False, server_default='Heart'))


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('listas_favoritos', 'icono')
