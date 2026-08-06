# Suite de Pruebas para DevorApp (Puppeteer + Python)

Suite de pruebas de extremo a extremo (E2E) y de API para **DevorApp** (una aplicación de descubrimiento y recomendación de restaurantes), implementada con **[pyppeteer](https://github.com/pyppeteer/pyppeteer)** (el puerto Python de Puppeteer) y **pytest**.

Es el equivalente funcional de la suite [`selenium-java`](../selenium-java), replicando exactamente los mismos casos de prueba (Base-Choice) sobre la misma arquitectura Page Object Model, pero con Puppeteer/Python en lugar de Selenium/Java.

---

## Dependencias necesarias

### 1. Requisitos del sistema

| Herramienta | Propósito | Instalación rápida |
| :--- | :--- | :--- |
| **Python 3.9+** (recomendado 3.11+) | Ejecutar la suite (pytest + pyppeteer) | `winget install Python.Python.3.12` (Win) / `brew install python@3.12` (Mac) |
| **[Poetry](https://python-poetry.org/)** | Gestor de dependencias y empaquetado (equivalente a Maven en `selenium-java`) | `pipx install poetry` / `curl -sSL https://install.python-poetry.org \| python3 -` |
| **Docker Desktop / Engine** (Compose v2) | Ejecutar los servicios del SUT | `winget install Docker.DockerDesktop` (Win) / `brew install --cask docker` (Mac) |
| **Git** | Clonar el SUT en la primera ejecución | `winget install Git.Git` (Win) / `brew install git` (Mac) |

*En Linux (Ubuntu/Debian):* `sudo apt install python3 python3-venv git docker.io docker-compose-v2 pipx && pipx install poetry`.

Pyppeteer descarga automáticamente una versión de Chromium compatible la primera vez que se lanza el navegador (se cachea en `~/.local-share/pyppeteer` / `%LOCALAPPDATA%\pyppeteer`).

> **Nota**: pyppeteer apunta a una revisión de Chromium fija que Google elimina periódicamente de su bucket de snapshots (problema conocido, el paquete lleva sin mantenimiento activo desde 2022). Si la descarga automática falla con un error `NoSuchKey`/`OSError`, define la variable de entorno `PUPPETEER_EXECUTABLE_PATH` (o `CHROME_PATH`) apuntando a un Chrome/Chromium/Edge ya instalado en el sistema — exactamente igual que pasar `executablePath` al Puppeteer de Node:
> ```powershell
> $env:PUPPETEER_EXECUTABLE_PATH = "C:\Program Files\Google\Chrome\Application\chrome.exe"
> ```
> ```bash
> export PUPPETEER_EXECUTABLE_PATH=/usr/bin/google-chrome
> ```

### 2. Credenciales de Firebase

Igual que en la suite Selenium: coloca `firebase-service-account.json` en la raíz del proyecto (`./firebase-service-account.json`) para la autenticación de usuarios en las pruebas. El script de despliegue del SUT lo copia automáticamente al contenedor del backend.

### 3. Librerías de Python

El proyecto usa **Poetry** con metadatos [PEP 621](https://peps.python.org/pep-0621/) — todas las dependencias ([`pyppeteer`](https://pypi.org/project/pyppeteer/), `requests`, `pytest`, `pytest-cov`, `pytest-html`, `flake8`) están fijadas en [`pyproject.toml`](pyproject.toml) (equivalente al `<dependencies>` de `pom.xml`).

```bash
# Instala las dependencias en un virtualenv gestionado por Poetry
poetry install

# Ejecuta cualquier comando dentro de ese virtualenv, p.ej.:
poetry run pytest
```

Alternativamente, sin el CLI de Poetry (por ejemplo en un contenedor CI minimalista), `pip` puede instalar el mismo `pyproject.toml` directamente gracias al backend `poetry-core`:

```powershell
# Windows (PowerShell)
python -m venv .venv
.venv\Scripts\Activate.ps1
pip install -e .
```

```bash
# Linux / macOS (Bash)
python3 -m venv .venv
source .venv/bin/activate
pip install -e .
```

---

## Despliegue del Sistema bajo Prueba (SUT)

Usa los mismos scripts que la suite Selenium, desde la raíz del repositorio:

```powershell
# Windows
..\deploy.ps1
```

```bash
# Linux / macOS
../deploy.sh
```

> **Verificación**: El SUT estará listo para las pruebas una vez que veas `[+] DevorApp backend is ready at http://localhost:8000/health`.

---

## Estructura del proyecto

```
puppeteer-python/
├── pyproject.toml               # Poetry: metadatos PEP 621, dependencias, config de pytest/coverage/logging
├── conftest.py                  # bootstrap de pytest (sys.path) + hooks pytest_runtest_setup/teardown
├── .flake8                      # config de lint (equivalente al checkstyle/PMD de un pom.xml)
├── resources/
│   └── test.properties          # URLs del SUT, modo headless (idéntico al de selenium-java)
├── src/
│   ├── common/
│   │   ├── base_api_class.py    # BaseApiClass: cliente HTTP + payload builders
│   │   ├── base_logged_class.py # BaseLoggedClass: ciclo de vida del navegador + usuario de prueba
│   │   ├── by.py                # abstracción de localizador CSS/XPath (equivalente a org.openqa.selenium.By)
│   │   ├── config.py            # carga de test.properties + variables de entorno
│   │   └── exceptions.py        # ElementNotFoundException
│   ├── pages/                   # Page Objects (uno por vista, igual que selenium-java/.../pages)
│   └── utils/
│       ├── click.py             # click con reintento + fallback JS (equivalente a Click.java)
│       ├── dom.py                # helpers de resolución de localizadores
│       └── waiter.py            # esperas explícitas (equivalente a Waiter.java)
└── tests/
    ├── context.py                # bootstrap de sys.path (paridad estructural con el proyecto de referencia)
    ├── api/                     # pruebas REST puras (sin navegador)
    └── e2e/                     # pruebas de navegador (Page Objects)
```

---

## Ejecución de las Pruebas

Las pruebas están estructuradas en dos categorías, igual que en la suite Selenium:

1. **Pruebas de API (`tests/api`)**: comprueban los endpoints REST del backend a nivel HTTP.
2. **Pruebas E2E de interfaz (`tests/e2e`)**: automatizan la experiencia de usuario en Chromium (vía Puppeteer/pyppeteer) usando el patrón **Page Object Model (POM)**.

### Todos los tests

```bash
# Ejecuta la suite de pruebas completa en modo visual
poetry run pytest

# Ejecuta las pruebas de navegador en modo oculto/sin cabecera (Headless)
HEADLESS_BROWSER=true poetry run pytest        # Bash
$env:HEADLESS_BROWSER='true'; poetry run pytest   # PowerShell
```

### Subconjuntos de pruebas

```bash
# Ejecutar solo las pruebas de la API
poetry run pytest -m api
# equivalente literal por ruta:
poetry run pytest tests/api

# Ejecutar solo las pruebas de interfaz E2E
poetry run pytest -m e2e
poetry run pytest tests/e2e

# Ejecutar una sola clase de pruebas
poetry run pytest tests/e2e/test_login.py

# Ejecutar un único método de prueba dentro de una clase
poetry run pytest tests/api/test_api_register.py::TestApiRegister::test_s7_login_correcto
```

### Reportes de resultados

`pyproject.toml` habilita cobertura por defecto (`--cov=src --cov-report=xml:coverage.xml --cov-branch`, igual que el proyecto de referencia), así que un simple `poetry run pytest` ya genera `coverage.xml`. Para un reporte HTML de resultados (equivalente al `maven-surefire-report-plugin`):

```bash
poetry run pytest --html=target/local/report.html --self-contained-html
```

En CI, aísla cada TJob bajo su propio subdirectorio (igual que `target/${TJOB_NAME}` en Maven):

```bash
TJOB_NAME=tjob1 SUT_URL=http://backend:8000 poetry run pytest --html=target/tjob1/report.html --self-contained-html
```

Los logs de ejecución se escriben en `logs/pytest.log` (configurado en `[tool.pytest.ini_options]` de `pyproject.toml`), y en tiempo real por consola (`log_cli = true`).

---

## Configuración Opcional

Edita [`resources/test.properties`](resources/test.properties) para cambiar las URLs a las que apunta la suite (idéntico formato al de `selenium-java`):

```properties
BROWSER_USER=CHROME
LOCALHOST_URL=http://localhost:8000   # URL base para los tests de API
FRONTEND_URL=http://localhost         # URL base para los tests de navegador
HEADLESS_BROWSER=false
```

Cualquier propiedad puede sobrescribirse con una variable de entorno del mismo nombre en tiempo de ejecución: `SUT_URL` (sustituye tanto a `LOCALHOST_URL` como a `FRONTEND_URL`), `TJOB_NAME` y `headless`.

---

## Diferencias de diseño respecto a `selenium-java`

La arquitectura (Page Object Model, clases base compartidas, utilidades de espera/click centralizadas) es una traducción deliberada 1:1 de `selenium-java`. Las únicas divergencias son las impuestas por el cambio de lenguaje/librería:

- **Localizadores**: `src/common/by.py` sustituye a `org.openqa.selenium.By` (Puppeteer solo entiende CSS y XPath de forma nativa).
- **Fábricas de página asíncronas**: los constructores de Selenium bloquean hasta que la página está lista; en Python `__init__` no puede ser una coroutine, así que cada Page Object expone un factory `await XxxPage.create(page, waiter)` en su lugar.
- **Un único event loop persistente por clase**: pyppeteer ata sus objetos `Browser`/`Page` al event loop que los creó. `BaseLoggedClass` gestiona su propio loop (creado en `setUpClass`, cerrado en `tearDownClass`) y el decorador `@async_test` ejecuta cada test asíncrono sobre ese mismo loop.
- **Payloads como `dict`**: donde Java construye un `JsonObject` con Gson y lo serializa a `String`, aquí los payload builders devuelven `dict` de Python y `requests`/`page.evaluate` se encargan de la codificación JSON.

---

## Alineación con el template `../example`

El empaquetado y la configuración de pytest siguen el mismo patrón que [`../example`](../example) (plantilla de proyecto Python del grupo GIIS):

- **Poetry + PEP 621**: `pyproject.toml` usa `poetry-core` como build backend, con los metadatos del proyecto bajo `[project]` (no `[tool.poetry.dependencies]`) y `[tool.poetry] packages = [...]` solo para declarar qué directorio es instalable.
- **Configuración de pytest en `pyproject.toml`**: `[tool.pytest.ini_options]` centraliza `addopts` (incluida cobertura `--cov`) y el logging de pytest (`log_cli_*` / `log_file_*`), en vez de un `pytest.ini` separado.
- **`conftest.py` con hooks `pytest_runtest_setup` / `pytest_runtest_teardown`**: registran el inicio/fin de cada test vía logging, igual que en la plantilla — complementando (no sustituyendo) el logging propio de `BaseApiClass`/`BaseLoggedClass`.
- **`tests/context.py`**: mismo bootstrap de `sys.path` que la plantilla, para paridad estructural.
- **`.flake8`**: mismo fichero de configuración de lint (con `max-line-length` ampliado, ya que este proyecto usa líneas más largas para los mensajes de aserción descriptivos).
