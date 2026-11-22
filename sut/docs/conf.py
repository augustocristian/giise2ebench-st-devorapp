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

# firebase_admin requires real credentials at import time; it is mocked so
# autodoc can import the app modules without secrets in CI.
autodoc_mock_imports = ['firebase_admin']

# Pre-import the whole app before autodoc processes any module.
# If autodoc imports the modules one by one, introspecting the pydantic
# `Settings` class corrupts the creation of later pydantic classes
# (e.g. the fastapi import fails with NameError: 'Dict'); with the app already
# in sys.modules, autodoc reuses the healthy cached modules.
from sphinx.ext.autodoc.mock import mock
with mock(autodoc_mock_imports):
    import app.main  # noqa: F401  (imports all documented modules transitively)

exclude_patterns = ['_build', 'Thumbs.db', '.DS_Store']

html_theme = 'sphinx_rtd_theme'
