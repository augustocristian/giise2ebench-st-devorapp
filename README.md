# giise2ebench-st-devorapp

<p align="center"><img src="img/hero-devorapp.svg" alt="DevorApp home screen (Inicio / Descubrimiento) on a desktop browser and a phone, showing a welcome message, a Buscar restaurantes button and a list of popular nearby restaurants" width="900"/></p>

## Estructura

| Carpeta | Contenido |
|---|---|
| [`sut/`](sut) | La aplicación DevorApp (frontend, backend, keras-api) y los servicios que la sustituyen en desarrollo: `gplaces-mock` y `firebase-emulator` |
| [`selenium-java/`](selenium-java) | Suite E2E y de API con Java + JUnit 5 + Selenium |
| [`cypress-js/`](cypress-js) | La misma suite con JavaScript + Cypress |

Las dos suites cubren los mismos escenarios y se ejecutan contra el sistema desplegado en modo **dev**.

---

## Despliegue

**Las imágenes Docker se construyen una sola vez y son las mismas en dev y en prod.** Lo que cambia entre un entorno y otro son únicamente las variables de entorno (y los ficheros que se montan) con los que se arranca cada contenedor:

| | **dev** | **prod** |
|---|---|---|
| Compose | `docker-compose.yml` + `docker-compose.dev.override.yml` | `docker-compose.yml` |
| Autenticación y perfiles | `firebase-emulator` (local) | Proyecto real de Firebase |
| Restaurantes y geocodificación | `gplaces-mock` (local, dataset ficticio fijo) | Google Places y Geocoding reales |
| Configuración | Ninguna: el propio `docker-compose.dev.override.yml` da valores ficticios | Ficheros `.env` y credencial de Firebase |
| Datos | Efímeros (se pierden con `down -v`) | Persistentes |

Todos los comandos se ejecutan desde la carpeta `sut/`. Requisitos: Docker con Compose **2.24 o superior**.

### Producción

Necesita cuentas reales de Firebase y Google Cloud.

**1. Firebase** (Authentication + Firestore): crea el proyecto, activa el proveedor *Email/Password*, crea la base de datos Firestore y descarga la clave de la cuenta de servicio como `sut/backend/firebase-service-account.json` (se monta en el contenedor, **no** se incluye en la imagen).

**2. Google Cloud**: habilita *Places API (New)* y *Geocoding API*, y crea una clave de API. Para el inicio de sesión con Google crea además un ID de cliente OAuth (ver [`sut/README.md`](sut/README.md#11-configuración-de-google-sign-in-inicio-de-sesión-con-google)).

**3. Crea los tres ficheros `.env`** (están en `.gitignore`):

`sut/backend/.env`

| Variable | Descripción |
|---|---|
| `FIREBASE_PROJECT_ID` | ID del proyecto de Firebase |
| `FIREBASE_API_KEY` | *Web API Key* del proyecto (login por contraseña) |
| `GOOGLE_API_KEY` | Clave de Google Places / Geocoding |
| `GOOGLE_CLIENT_ID` | ID de cliente OAuth (Google Sign-In) |
| `SECRET_KEY` | Secreto para firmar los JWT. Genera uno propio: `openssl rand -hex 32` |
| `KERAS_API_KEY` | Clave compartida con el microservicio de IA (igual que `API_KEY_RECOMMENDER`) |

`sut/keras-api/.env`

| Variable | Descripción |
|---|---|
| `API_KEY_RECOMMENDER` | Misma clave que `KERAS_API_KEY` del backend |
| `GOOGLE_API_KEY` | Clave de Google Places |
| `MODEL_PATH`, `PORT`, `DATABASE_URL` | Ruta del modelo (`./models/modelo_prod.h5`), puerto (`8001`) y base de datos (`postgresql://postgres:password@db:5432/tfg_db`) |

`sut/frontend/.env` (se lee **al arrancar el contenedor**, no al construir la imagen)

| Variable | Descripción |
|---|---|
| `VITE_GOOGLE_CLIENT_ID` | ID de cliente OAuth. Obligatorio: sin él la aplicación no renderiza |
| `VITE_GOOGLE_API_KEY` | Clave de Google Maps (autocompletado de ubicaciones) |
| `VITE_API_URL` | Opcional. URL del backend si no es el mismo origen (`/api`) |

**4. Arranca:**

```bash
docker compose up -d --build
docker compose down            # parar (añade -v para borrar también la base de datos)
```

El frontend queda en `http://localhost` (y `https://localhost`, con certificado autofirmado) y el backend en `http://localhost:8000`.

Notas de producción:
- La cookie de sesión es `Secure` (`COOKIE_SECURE=true` por defecto), así que la aplicación debe servirse por **HTTPS** (detrás de un proxy con certificado válido).
- La verificación de correo está activa (`SKIP_EMAIL_VERIFICATION=false`).
- En `main` y en las etiquetas `v*`, el CI publica las imágenes en `ghcr.io/<propietario>/<repositorio>/{backend,frontend,keras-api}` con las etiquetas `<sha>`, `latest` y la versión.

### Desarrollo

```bash
docker compose -f docker-compose.yml -f docker-compose.dev.override.yml up -d --build
docker compose -f docker-compose.yml -f docker-compose.dev.override.yml down -v     # parar y borrar los datos
```

No hace falta ninguna cuenta, clave ni fichero `.env`. Qué implica:

- **Servicios locales en lugar de los reales:** `firebase-emulator` (Authentication y Firestore) y [`gplaces-mock`](sut/gplaces-mock/README.md) (Google Places y Geocoding con 13 lugares ficticios (12 restaurantes y una farmacia) en Gijón, Oviedo y Avilés). Los datos son artificiales y estables, y se pueden reiniciar con `curl -X POST http://localhost:8002/__admin/reset`.
- **Ajustes de entorno:** el backend arranca con `SKIP_EMAIL_VERIFICATION=true` (no hay bandeja de entrada) y `COOKIE_SECURE=false` (se usa HTTP); el frontend recibe un ID de cliente y una clave de Google ficticios.
- **Limitaciones:** el inicio de sesión con Google no funciona, y el SDK de Google Maps del navegador no está sustituido (las pruebas lo simulan).
- **Puertos:** frontend `80`, backend `8000`, keras-api `8001`, `gplaces-mock` `8002`, PostgreSQL `5432`.
- **Recarga en caliente** (opcional, mantiene el emulador y el mock): añade `-f docker-compose.hotreload.yml`. Los scripts `deploy.ps1 -Dev` y `deploy.sh --dev` hacen esto mismo.

---

## Ejecución de las pruebas

Las pruebas del sistema se ejecutan contra el stack **dev** en marcha (arrancado como se explica arriba). Cada prueba crea sus propios usuarios, así que ambas suites pueden ejecutarse a la vez contra la misma instancia.

### Selenium + Java

Requisitos: JDK 17 y Maven; Chrome para las pruebas de navegador.

```bash
cd selenium-java
mvn test -Dheadless=true                                     # todo: 42 pruebas de API + 22 de navegador
mvn test -Dtest='TestApi*'                                   # solo API
mvn test -Dheadless=true -Dtest='TestLogin,TestRatingView'   # clases concretas
mvn test -DSUT_URL=http://otro-host:8000                     # otro backend
```

Los informes quedan en `selenium-java/target/**/surefire-reports/`.

### Cypress + JavaScript

Requisitos: Node.js 22.

```bash
cd cypress-js
npm ci
npm test               # espera a que el SUT responda y ejecuta todo: 22 pruebas de navegador + 42 de API
npm run test:api       # solo API
npm run test:e2e       # solo navegador
npm run cypress:open   # modo interactivo
CYPRESS_BASE_URL=http://otro-host CYPRESS_apiUrl=http://otro-host:8000 npm test   # otro SUT
```

Capturas y vídeos quedan en `cypress-js/cypress/screenshots` y `videos`. Si Cypress falla al arrancar con `bad option` desde un terminal de VS Code, ejecuta antes `unset ELECTRON_RUN_AS_NODE` (PowerShell: `Remove-Item Env:ELECTRON_RUN_AS_NODE`).

### Pruebas de cada componente

| Componente | Comando |
|---|---|
| Backend | `cd sut/backend && poetry install --with dev && poetry run pytest` |
| Keras API | `cd sut/keras-api && poetry install --with dev && poetry run pytest` |
| Frontend | `cd sut/frontend && npm ci && npm test` |
| `gplaces-mock` | `cd sut/gplaces-mock && poetry install && poetry run pytest` |

### Integración continua

El pipeline ([`.github/workflows/ci.yml`](.github/workflows/ci.yml)) se ejecuta en **todas las ramas** y en los pull requests hacia `main`:

1. Pruebas unitarias de backend, keras-api, `gplaces-mock` y frontend.
2. Análisis estático (SonarQube).
3. **Construcción de las imágenes, una sola vez** (se comparten como artefacto).
4. Pruebas de sistema, **en paralelo**: Selenium y Cypress, cada una en su propio runner con **su propia instancia** del stack dev levantada con esas imágenes (sin reconstruir).
5. Solo en `main` y etiquetas, y **únicamente si pasan todas las suites**, se publican en GHCR las mismas imágenes que se probaron.

---

---

<p align="center">
  <a href="https://giis.uniovi.es/"><img src="img/giis-footer.svg" alt="GIIS - Software Engineering Research Group, University of Oviedo" height="28"/></a>
</p>
