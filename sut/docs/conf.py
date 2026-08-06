import os
import sys
sys.path.insert(0, os.path.abspath('../backend'))

project = 'EPI-DevorApp'
copyright = '2026, UO294431'
author = 'UO294431'
release = '0.1.0'

extensions = [
    'sphinx.ext.autodoc',
    'sphinx.ext.napoleon',
    'sphinx.ext.viewcode',
]

# firebase_admin requiere credenciales reales en el import; se simula para
# que autodoc pueda importar los módulos de la app sin secretos en CI.
autodoc_mock_imports = ['firebase_admin']

# Pre-importa toda la app antes de que autodoc procese ningún módulo.
# Si autodoc importa los módulos uno a uno, la introspección de la clase
# pydantic `Settings` corrompe la creación de clases pydantic posteriores
# (p. ej. el import de fastapi falla con NameError: 'Dict'); con la app ya
# en sys.modules, autodoc reutiliza los módulos sanos en caché.
from sphinx.ext.autodoc.mock import mock
with mock(autodoc_mock_imports):
    import app.main  # noqa: F401  (importa en cadena todos los módulos documentados)

exclude_patterns = ['_build', 'Thumbs.db', '.DS_Store']

html_theme = 'sphinx_rtd_theme'
