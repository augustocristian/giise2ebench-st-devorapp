# DevorApp

[![CI/CD Pipeline](https://github.com/UO294431/EPI-DevorApp/actions/workflows/ci.yml/badge.svg)](https://github.com/UO294431/EPI-DevorApp/actions)
[![Quality Gate Status](https://sonarcloud.io/api/project_badges/measure?project=UO294431_EPI-DevorApp&metric=alert_status)](https://sonarcloud.io/summary/new_code?id=UO294431_EPI-DevorApp)

**DevorApp** is a personalized restaurant discovery and recommendation ecosystem. The system suggests places to eat based on the user's location, culinary preferences, time of day and consumption habits, combining a modern mobile/web interface with a powerful AI-based recommendation engine.

This project was developed as a **Bachelor's Thesis (TFG)** at the **University of Oviedo**.

---

## Main Features

- **Smart Recommendation**: A neural-network engine (Keras) that predicts and ranks restaurants according to individual tastes and temporal/geographic context.
- **Geolocated Search**: Automatic location and advanced filters by cuisine type, distance, price and rating.
- **Full Restaurant Details**: Detailed information with photos, reviews from other users, Google Maps links, website and direct calls.
- **Favorites Lists**: Management of custom collections of preferred restaurants.
- **Saved for Later**: A dedicated section to keep track of places you plan to visit.
- **Visit History**: An ordered record of visited places with quick access to rate them.
- **Ratings and Reviews**: A review system with stars and detailed reviews, including likes from other users.
- **Cross-platform**: Available as a SPA web application and as a native Android mobile application (through Capacitor).

---

## Project Documentation (`docs`)

The [`docs`](docs) folder contains the project's theoretical and design resources:
- **Thesis report**: The complete project document is at [`docs/2026-TFG-TorreAlejandro.pdf`](docs/2026-TFG-TorreAlejandro.pdf), which details the user requirements, design analysis, AI engine modeling and testing process.
- **User Requirements**: Formally documented within the thesis report and the Sphinx structure of the folder.

The technical documentation auto-generated with **Sphinx** (sources in [`docs`](docs)) is published on GitHub Pages:

- **📚 Technical documentation (API Reference)**: [https://torrealejandro.github.io/EPI-DevorApp/](https://torrealejandro.github.io/EPI-DevorApp/)

---

## Application Interfaces

Below is a gallery of the DevorApp interfaces:

| Login Screen | Registration Flow (Step 1) | Registration Flow (Step 2) |
| :---: | :---: | :---: |
| ![Login](images/InicioSesion.jpeg) <br> **Login** | ![Registration Step 1](images/Registro1.jpeg) <br> **Registration - Credentials** | ![Registration Step 2](images/Registro2.jpeg) <br> **Registration - Preferences** |

| Main Screen | Side Menu | Configure Recommendations |
| :---: | :---: | :---: |
| ![Main Screen](images/PantallaPrincipal.jpeg) <br> **Home / Discovery** | ![Side Menu](images/MenuLateral.jpeg) <br> **Side Navigation** | ![Search Restaurants](images/BuscarRestaurantes.jpeg) <br> **Search Filters** |

| Search Results | Detail Page | User Reviews |
| :---: | :---: | :---: |
| ![Search Results](images/ResultadosBusqueda.jpeg) <br> **Recommended Restaurants** | ![Restaurant Detail](images/DetallesRestaurante.jpeg) <br> **Restaurant Page** | ![User Reviews](images/ReseñasUsuarios.jpeg) <br> **Reviews Section** |

| Rate a Place | List Management | Favorites Lists |
| :---: | :---: | :---: |
| ![Rate](images/Editar-PonerValoracion.jpeg) <br> **Create/Edit Rating** | ![Favorites Lists](images/ListasFavoritos.jpeg) <br> **My Favorites Lists** | ![Favorites](images/Favoritos.jpeg) <br> **Saved Restaurants** |

| Pending Visits | Visit History | User Profile |
| :---: | :---: | :---: |
| ![Save for Later](images/GuardarMasTarde.jpeg) <br> **Saved for Later** | ![History](images/Historial.jpeg) <br> **Visit History** | ![Profile](images/PerfilUsuario.jpeg) <br> **Profile and Account** |

---

## Project Architecture

For the development of this project, a distributed client-server architecture based on three main layers was chosen. This separation of responsibilities isolates the business logic from the user interface and data access, making future updates or integrations easier without affecting the integrity of the system as a whole.

The system is divided into three independent components, each with its own internal architecture:

```
epi-devorapp/
├── frontend/      # React 19 + TypeScript + Vite + Capacitor 7 SPA
├── backend/       # FastAPI REST API + PostgreSQL + Firebase Admin SDK
└── keras-api/     # AI Recommendation Service (Keras)
```

All subsystems operate in a decoupled manner and communicate with each other bidirectionally through a REST API. The frontend consumes the backend services through HTTP requests, exchanging information in a structured way, and the backend sends requests to the recommendation model and receives the requested data back.

![General Architecture](images/ArquitecturaGeneral.svg)

---

### Backend Internal Architecture

The system backend was designed following a layered architecture. As in the general project architecture, the main goal is the separation of responsibilities, as well as ensuring the maintainability and scalability of the backend.

- **Presentation layer**: handles client requests. It contains the logic needed to receive incoming requests and return the appropriate responses.
- **Service layer**: contains the system's business logic. It processes the requests received from the presentation layer and applies the business rules and domain validations. It also coordinates the recommendation flow by transforming the data from the database to send it to the recommendation model and handling the response received.
- **Data model layer**: defines the information structures and entities that govern the system.
- **Infrastructure layer**: handles communication with external agents and data storage. Thanks to this layer, the rest of the application does not depend on the database technology.
- **Core layer**: contains the cross-cutting functionality that supports the whole architecture. It centralizes the global configuration and the system's protection mechanisms.

![Backend Internal Architecture](images/DiagramaArquiBack.png)

---

### Frontend Internal Architecture

The system frontend was developed following the Model-View-Controller pattern. This structure separates the application's responsibilities into distinct components, making the code easier to organize and maintain and its elements easier to reuse.

- **Model**: represents the structure of the data used in the application. Models define the data structure the application handles, ensuring consistency in how information received from the backend is processed.
- **View**: composes the screens the user sees. It does not handle the full logic, but delegates it to the lower layer.
- **Controller**: acts as an intermediary between the models and the views. It makes API requests, processes the responses and updates the corresponding components of the application.

In addition, the application has a main entry point where the general structure of the interface is initialized.

![Frontend Internal Architecture](images/DiagramaArquiFront.png)

---

### AI Microservice Internal Architecture

Given the computational cost and the specific dependencies required by the recommendation engine, an independent microservice was implemented following a Lightweight Inference Service pattern.

- **Input interface**: exposes a single entry point that receives the feature vectors and validates the sender's identity.
- **Model manager**: implements a Singleton pattern to ensure the neural model is loaded into memory only once when the service starts, optimizing response times.
- **Preprocessing layer**: performs the final transformations on the incoming data to ensure the inputs match exactly the architecture of the trained neural network.

![AI Microservice Internal Architecture](images/ArquitecturaMicroservicio.svg)

---

## Dependencies and Requirements

### Prerequisites:
- **Node.js**: Version 22.x or later
- **Python**: Version 3.12.x or later
- **Poetry**: Python dependency manager (installable with `pipx install poetry`)
- **Docker & Docker Compose**: For simplified deployment
- **Java JDK 17 & Android SDK**: (Only if you want to build the APK locally)

---

## Deployment Modes: `dev` and `prod`

> Full guide to deployment, variables and running the tests in the [root README](../README.md). The images are built once and are the same in dev and prod; only the environment they are started with changes (the frontend reads `VITE_GOOGLE_CLIENT_ID`, `VITE_GOOGLE_API_KEY` and `VITE_API_URL` when the container starts).

The system is deployed in two ways with the same services (PostgreSQL, Backend, Frontend and Keras API). The only thing that changes is **which external services** the backend talks to:

| | **dev** | **prod** |
|---|---|---|
| Authentication and profiles (Firebase Auth + Firestore) | `firebase-emulator` (local container) | Real Firebase project |
| Restaurants and geocoding (Google Places + Geocoding) | `gplaces-mock` (local container, fixed dataset) | Real Google API |
| Required credentials | **None** | `firebase-service-account.json`, `FIREBASE_API_KEY`, `GOOGLE_API_KEY`... |
| `.env` files | Not needed | Needed (see below) |
| Compose | `docker-compose.yml` + `docker-compose.dev.override.yml` | `docker-compose.yml` |
| Data | Ephemeral: lost when the emulator is stopped | Persistent (real Firebase) |
| Cost / quota | None | Google and Firebase quota and billing |

### Dev Mode (emulator + mock, no credentials)

```bash
# From the sut/ folder
docker compose -f docker-compose.yml -f docker-compose.dev.override.yml up -d --build

# Stop and delete the data (database and emulator)
docker compose -f docker-compose.yml -f docker-compose.dev.override.yml down -v
```

[`docker-compose.dev.override.yml`](docker-compose.dev.override.yml) adds two services and reconfigures the backend to use them:

- **[`firebase-emulator`](firebase-emulator)**: *Firebase Local Emulator Suite* (Authentication on port `9099` and Firestore on `8080`, only inside the Docker network). The backend uses it through `FIREBASE_AUTH_EMULATOR_HOST`, `FIRESTORE_EMULATOR_HOST` and `FIREBASE_AUTH_BASE_URL`. With these variables the Firebase Admin SDK starts **without a service account key**.
- **[`gplaces-mock`](gplaces-mock)**: a stand-in for Google Places (New) and Geocoding on port `8002`, with 13 fixed fictitious places in Gijón, Oviedo and Avilés and an `/__admin` control surface (see its [README](gplaces-mock/README.md)). The backend uses it through `GOOGLE_PLACES_BASE_URL` and `GOOGLE_GEOCODE_URL`.

In addition, in dev the backend starts with `SKIP_EMAIL_VERIFICATION=true` (there is no inbox to read the verification email from) and `COOKIE_SECURE=false` (the session cookie is not `Secure`, so that non-browser HTTP clients can use it over `http://`). The file itself supplies dummy values for the remaining variables, so **you do not need to create `backend/.env`, `keras-api/.env` or `backend/firebase-service-account.json`**.

To develop with live reload, add the *hot reload* layer (it still uses the emulator and the mock):

```bash
docker compose -f docker-compose.yml -f docker-compose.dev.override.yml -f docker-compose.hotreload.yml up --build
```

> **Dev limitations**: Google Sign-In does not work with the emulator, and the browser's location autocomplete uses the Google Maps JavaScript SDK (configured with `VITE_GOOGLE_API_KEY` in the frontend), which is not replaced. This is the mode used by the CI pipeline and the E2E tests.
>
> Requires Docker Compose **2.24 or later** (`docker-compose.dev.override.yml` uses the `!reset` tag to clear the `env_file` entries and the credentials mount from the base compose file).

### Prod Mode (real Firebase and Google Places)

```bash
# From the sut/ folder, after creating the configuration files
docker compose up -d --build
```

Without `docker-compose.dev.override.yml` the backend talks to the real services, so they must be configured:

1. **Firebase** (Authentication + Firestore): create a project, enable *Email/Password* in Authentication and create a Firestore database. Download the service account key to `backend/firebase-service-account.json` and copy `FIREBASE_PROJECT_ID` and the *Web API Key* (`FIREBASE_API_KEY`) into `backend/.env`.
2. **Google Places and Geocoding**: enable *Places API (New)* and *Geocoding API* in Google Cloud and set the key in `GOOGLE_API_KEY` (`backend/.env` and `keras-api/.env`) and in `VITE_GOOGLE_API_KEY` (`frontend/.env`).
3. **Google Sign-In** (optional): see [1.1](#11-google-sign-in-configuration-sign-in-with-google).
4. Define your own secure `SECRET_KEY` for the JWTs.

Each variable is detailed in the next section. If you do not define `GOOGLE_PLACES_BASE_URL`, `GOOGLE_GEOCODE_URL`, `FIREBASE_AUTH_BASE_URL` or the `*_EMULATOR_HOST` variables, the backend uses the official Google and Firebase endpoints.

---

## Local Deployment

### 1. Environment Variables (`.env`)
> **Prod mode** only. In dev mode they are not needed (see [Deployment Modes](#deployment-modes-dev-and-prod)).

You must create a `.env` file in each of the directories (`frontend/`, `backend/` and `keras-api/`) based on the project's actual configuration variables:

#### Frontend (`frontend/.env`):
```ini
VITE_GOOGLE_API_KEY=your_google_places_api_key
VITE_API_URL=/api
VITE_GOOGLE_CLIENT_ID=your_google_oauth_client_id
# If you run natively without Docker, point to your local backend:
# VITE_API_URL=http://localhost:8000
```

#### Backend (`backend/.env`):
```ini
# Firebase
FIREBASE_PROJECT_ID=your_firebase_project_id
FIREBASE_API_KEY=your_firebase_api_key
FIREBASE_SERVICE_ACCOUNT_PATH=firebase-service-account.json

# Google Maps / Places
GOOGLE_API_KEY=your_google_places_api_key

# JWT authentication (generate a secure one in production)
SECRET_KEY=your_secret_key_for_jwt

# PostgreSQL database (use db:5432 in Docker, localhost:5432 native)
DATABASE_URL=postgresql://postgres:password@db:5432/tfg_db

# Integration with the AI recommendation engine
KERAS_API_URL=http://keras-api:8001/predict
KERAS_API_KEY=recommender_access_key

# Google OAuth
GOOGLE_CLIENT_ID=your_google_oauth_client_id
```

#### Recommendation Engine (`keras-api/.env`):
```ini
API_KEY_RECOMMENDER=recommender_access_key
MODEL_PATH=./models/modelo_prod.h5
PORT=8001

# Data for the model Training Pipeline
DATABASE_URL=postgresql://postgres:password@localhost:5432/tfg_db
GOOGLE_API_KEY=your_google_places_api_key
```

> [!IMPORTANT]
> **Firebase credentials**: To start the backend you must place your Firebase project's credentials JSON file at `backend/firebase-service-account.json`. 
> If you use **Docker** and start the containers *before* creating this file, Docker will automatically create an empty directory with that name on your host machine. If you get the error `IsADirectoryError: firebase-service-account.json`, stop the container (`docker compose down`), delete the wrong directory (`Remove-Item -Recurse -Force backend/firebase-service-account.json` or `rm -rf`) and put the real JSON file in place before rebuilding.

### 1.1 Google Sign-In Configuration (Sign in with Google)

For Google sign-in to work in both the web environment and the mobile application (APK), you need to configure a project in **Google Cloud Console**:

1. **Create OAuth 2.0 Credentials**:
   - Go to [Google Cloud Console](https://console.cloud.google.com/).
   - Create or select your Google Cloud project.
   - Go to **APIs & Services > OAuth consent screen** and configure it.
   - Go to **Credentials > Create credentials > OAuth client ID**.
2. **Web Client**:
   - Create a client ID of type **Web application**.
   - Add the authorized JavaScript origins (e.g. `http://localhost` and `http://localhost:5173` for development).
   - Save the generated *client ID*. This value must be set in the `VITE_GOOGLE_CLIENT_ID` (frontend) and `GOOGLE_CLIENT_ID` (backend) variables.
3. **Android Client (Important for the APK)**:
   - For it to work from the mobile device, create another client ID of type **Android** in the same console.
   - Specify the package name: `com.devorapp.epi`.
   - Add the SHA-1 certificate fingerprint of your signing key:
     * *Local development (Debug key)*: Get the SHA-1 by running `./gradlew signingReport` in the `frontend/android` folder and copying the SHA-1 of the `debug` key.
     * *Production (Release key)*: Get the SHA-1 by running `keytool -list -v -keystore your_key.jks` on the production keystore file (the one you will Base64-encode for the pipeline).
   - **Note**: Google automatically links mobile authentication to the Android client ID using this SHA-1 and the package name, so no changes are needed in the app code, but it must be registered in the Google Cloud console or sign-in will fail on mobile.


### 2. Docker Deployment (Recommended)

Build and start the whole ecosystem (PostgreSQL, Backend, Frontend and Keras API):
```bash
# Prod mode (real Firebase and Google; requires the .env files and credentials)
docker compose up --build

# Dev mode (Firebase emulator + Google Places mock; no credentials)
docker compose -f docker-compose.yml -f docker-compose.dev.override.yml up --build

# Dev mode with live reload of backend and frontend (mounted volumes)
docker compose -f docker-compose.yml -f docker-compose.dev.override.yml -f docker-compose.hotreload.yml up --build
```

- **Frontend**: Available at [http://localhost](http://localhost) (or [http://localhost:5173](http://localhost:5173) in development)
- **Backend API**: Available at [http://localhost:8000](http://localhost:8000) (with Swagger at [http://localhost:8000/docs](http://localhost:8000/docs) and ReDoc at [http://localhost:8000/redoc](http://localhost:8000/redoc))
- **Recommendation Engine (Keras API)**: Available at [http://localhost:8001](http://localhost:8001) (with Swagger at [http://localhost:8001/docs](http://localhost:8001/docs))
- **Database (PostgreSQL)**: Reachable locally at `localhost:5432` (user `postgres`, password `password`)

### 3. Native Deployment (Individual Services)

#### Backend:
```bash
cd backend
poetry install --with dev
poetry run alembic upgrade head
poetry run uvicorn app.main:app --reload --port 8000
```

#### Frontend:
```bash
cd frontend
npm install
npm run dev
```

#### Keras API:
```bash
cd keras-api
poetry install --with dev
poetry run uvicorn main:app --reload --port 8001
```

### 4. Deployment Automation Scripts (`deploy.ps1` / `deploy.sh`)

The project includes two scripts ([deploy.ps1](../deploy.ps1) for Windows PowerShell and [deploy.sh](../deploy.sh) for Linux/macOS environments) that simplify and automate the common tasks of installation, running linters, tests, building and starting services.

These scripts live at the repository root (one level above `sut/`) and mirror the stages of the continuous integration (CI) pipeline locally, operating on the projects inside `sut/`.

#### Windows Parameters (`deploy.ps1`):
```powershell
# Always run from the repository root
cd ..

# Bring up the full stack in Docker after passing the tests (default mode)
.\deploy.ps1

# Bring up only the backend and the database
.\deploy.ps1 -Component backend

# Bring up only the frontend
.\deploy.ps1 -Component frontend

# Bring up in dev mode: Firebase emulator + Google Places mock + hot reload
.\deploy.ps1 -Dev

# Run the stack in native mode instead of Docker
.\deploy.ps1 -Mode native

# Skip the test suite (pytest and vitest) during initialization
.\deploy.ps1 -SkipTests

# Also build the Android Debug APK when finished
.\deploy.ps1 -Apk

# Stop all containers and associated networks
.\deploy.ps1 -Stop
```

#### Linux / macOS Parameters (`deploy.sh`):
```bash
# Always run from the repository root
cd ..
chmod +x deploy.sh

./deploy.sh                          # Whole stack, Docker
./deploy.sh --component backend      # Backend + DB only
./deploy.sh --component frontend     # Frontend only
./deploy.sh --dev                    # Docker in dev mode: emulator + mock + hot-reload
./deploy.sh --mode native            # Local native processes
./deploy.sh --skip-tests             # Skip running the tests
./deploy.sh --apk                    # Build the Android debug APK
./deploy.sh --stop                   # Stop containers
```

#### Requirements by mode:
| Tool / Requirement | Docker | Native Mode | `--apk` or `-Apk` flags |
| --- | --- | --- | --- |
| **Docker Desktop / Engine** | Required | — | — |
| **Node.js 22 + npm** | Optional (lint) | Required | Required |
| **Python 3.12 + Poetry** | Optional (tests) | Required | — |
| **Java JDK 17 + ANDROID_HOME** | — | — | Required |

---

## Running the Tests

The project has unit and integration test suites in all of its components.

### Backend Tests:
```bash
cd backend
poetry run pytest tests/ -v
```

### Frontend Tests (Vitest):
```bash
cd frontend
npm run test
```

### Frontend E2E Tests (Playwright, network-mocked):
```bash
cd frontend
PLAYWRIGHT_PORT=<free port> npx playwright test
```

### Keras API Engine Tests:
```bash
cd keras-api
poetry run pytest test_main.py -v
```

### System Tests (E2E and API)
The end-to-end (E2E) and API system tests live in the [`selenium-java`](../selenium-java) (Java + Selenium) and [`cypress-js`](../cypress-js) (JavaScript + Cypress) folders at the repository root. They validate the behavior of the interface and the API by interacting directly with the system deployed in dev mode. See the [root README](../README.md#running-the-tests) for how to run them.

---

## Continuous Integration and Deployment (CI/CD) Pipeline

The repository uses **GitHub Actions** to automate the quality and build flow defined in [`.github/workflows/ci.yml`](../.github/workflows/ci.yml).

### GitHub Actions Flow:
```mermaid
graph TD
    A[Push / Pull Request] --> B[backend-ci / keras-api-ci / gplaces-mock-ci: Pytest & Coverage]
    A --> C[frontend-ci: ESLint & Vitest Coverage]
    B --> D[sonar-analysis: SonarCloud Scan]
    C --> D
    D --> H[build-android-apk: Build, Sign & Release APK]
    D --> E[build-images: Build Docker images once]
    E --> G[e2e-selenium-java / e2e-cypress-javascript / e2e-playwright-typescript: System tests, in parallel]
    G --> F[publish-images: Publish to GHCR]
```

1. **`backend-ci`, `keras-api-ci`, `gplaces-mock-ci`**: Install dependencies with Poetry, run the tests with pytest and generate coverage reports.
2. **`frontend-ci`**: Installs dependencies with npm, validates syntax with ESLint, runs the unit tests with Vitest and generates coverage reports.
3. **`sonar-analysis`**: Downloads the coverage results from the previous jobs and runs the SonarCloud static scan.
4. **`build-images`**: Builds the Docker images once and shares them with the later jobs as an artifact.
5. **`e2e-selenium-java`, `e2e-cypress-javascript`**: Each one starts its own instance of the stack in dev mode from those images and runs the system tests (E2E and API) in parallel. **`e2e-playwright-typescript`** runs the network-mocked Playwright specs in `frontend/e2e` on Chromium and Firefox against the Vite dev server, so it needs no SUT instance.
6. **`publish-images`**: Only on `main` and version tags (`v*`), and only if all the E2E suites pass, it publishes the same images that were tested to the GitHub container registry (GHCR), tagging them with the commit's short SHA, `latest` and the version.
7. **`build-android-apk`**: Runs after the frontend tests pass. It builds the Android application with Gradle. If the signing secrets are configured, it signs the APK and, for a version tag (`v*`), publishes it automatically to GitHub Releases.



### SonarCloud Flow
Static code quality analysis is delegated to **SonarCloud**.
- In each CI cycle, the frontend and backend tests generate coverage reports (`lcov` and `cobertura XML` respectively).
- SonarCloud processes the metrics for code duplication, test coverage, vulnerabilities and "code smells", blocking the merge if the configured Quality Gate is not met.

---

## Download and Installation of the Mobile Application (APK)

The mobile application is packaged automatically in each continuous integration (CI/CD) cycle of GitHub Actions.

### How to install the APK:
1. **Download the APK**:
   - **For official Releases**: Go to the **Releases** section in the repository and download the `app-release.apk` file.
   - **For development and testing**: Go to the **Actions** tab, select the latest pipeline run of the `main` or `desarrollo` branch, and download the **`devorapp-release-apk`** artifact (which contains a signed auto-debug version ready to install directly on any phone).
2. **Transfer and install**: Transfer the `.apk` file to your Android device (or download it directly from your phone's browser) and open it. Enable the *"Allow installation of apps from unknown sources"* option if the device asks for it to complete the installation.

### How to connect the APK to your Local Backend (Ngrok / Wi-Fi)
Since the mobile application runs natively on your phone, by default it cannot reach `localhost`. To connect it to the backend running on your development computer:
1. **Expose the local Backend (Recommended)**:
   - Start your local backend.
   - Run a free tool such as **Ngrok** to open a secure tunnel to the backend port (e.g. `ngrok http 8000`). This gives you a temporary public URL (e.g. `https://xxxx.ngrok-free.app`).
2. **Configure the app on the phone**:
   - Open the **DevorApp** application on your phone.
   - On the **Login** screen, tap the **gear icon** (Server Settings) in the top-right corner of the navigation bar.
    - Type or paste the URL of your local API:
      * **If you use Ngrok**: e.g. `https://xxxx.ngrok-free.app/api`
      * **If you use local Wi-Fi**: e.g. `http://<YOUR_PC_IP>:8000/api` (you must replace `<YOUR_PC_IP>` with your computer's actual local IP address, for example `192.168.1.50`. You can find your IP by running `ipconfig` in the Windows terminal or `ip a` / `ifconfig` on macOS or Linux).
    - Click **Save and Connect**. The app will restart by itself and will be connected in real time to your local backend.
   - You can tap **Reset to default** whenever you want to restore the original address.

---

## Secrets Configured in the Repository

For the pipeline to work correctly, the following secrets must be configured in the GitHub repository settings (**Settings → Secrets and variables → Actions**):

- `SONAR_TOKEN`: SonarCloud authentication token.
- `FIREBASE_SERVICE_ACCOUNT`: Base64 private key of the Firebase service account (used for initialization in staging containers).
- `KEYSTORE_FILE`: Base64-encoded `.jks` signing file (required if the APK is built in the pipeline).
- `KEYSTORE_STORE_PASSWORD` / `KEYSTORE_KEY_PASSWORD`: Keystore passwords used to sign the APK.
- `KEYSTORE_KEY_ALIAS`: Alias of the signing key (`devorapp`).

---

## How to Contribute

Contributions are welcome! If you want to contribute improvements or fix bugs:

1. **Fork** the project.
2. Create a branch for your feature: `git checkout -b feature/new-feature`.
3. Make the necessary changes and make sure **all tests pass**.
4. Commit your changes: `git commit -m 'Add new feature'`.
5. Push the branch: `git push origin feature/new-feature`.
6. Open a **Pull Request** explaining your changes in detail.

---

## How to Cite this Project

If you use this software or refer to the research and development of DevorApp, please cite it using the information in the [`CITATION.cff`](CITATION.cff) file or use the *"Cite this repository"* button available at the top of GitHub.

### Suggested citation format:

```bibtex
@thesis{Torre2026DevorApp,
  author       = {Torre Llorente, Alejandro},
  title        = {DevorApp: recomendando restaurantes según tu ubicación, gustos y momento},
  school       = {Universidad de Oviedo},
  year         = 2026,
  type         = {Bachelor's Thesis (Trabajo Fin de Grado)}
}
```
