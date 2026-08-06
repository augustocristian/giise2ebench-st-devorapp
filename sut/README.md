# DevorApp

[![CI/CD Pipeline](https://github.com/UO294431/EPI-DevorApp/actions/workflows/ci.yml/badge.svg)](https://github.com/UO294431/EPI-DevorApp/actions)
[![Quality Gate Status](https://sonarcloud.io/api/project_badges/measure?project=UO294431_EPI-DevorApp&metric=alert_status)](https://sonarcloud.io/summary/new_code?id=UO294431_EPI-DevorApp)

**DevorApp** es un ecosistema personalizado de descubrimiento y recomendación de restaurantes. El sistema sugiere locales gastronómicos basándose en la ubicación del usuario, sus preferencias culinarias, momento del día y hábitos de consumo, combinando una interfaz móvil/web moderna con un potente motor de recomendación basado en inteligencia artificial.

Este proyecto ha sido desarrollado como **Trabajo de Fin de Grado (TFG)** en la **Universidad de Oviedo**.

---

## Características principales (Main Features)

- **Recomendación Inteligente**: Motor basado en redes neuronales (Keras) que predice y ordena los restaurantes según gustos individuales y contexto temporal/geográfico.
- **Búsqueda Geolocalizada**: Localización automática y filtros avanzados por tipo de cocina, distancia, precios y valoración.
- **Detalle de Restaurantes Completo**: Información detallada con fotos, opiniones de otros usuarios, enlaces a Google Maps, sitio web y llamadas directas.
- **Listas de Favoritos**: Gestión de colecciones personalizadas de restaurantes preferidos.
- **Guardados para más tarde**: Sección específica para registrar establecimientos pendientes de visitar.
- **Historial de Visitas**: Registro ordenado de locales visitados con acceso rápido para valorarlos.
- **Valoraciones y Reseñas**: Sistema de opiniones con estrellas y reseñas detalladas, incluyendo likes de otros usuarios.
- **Multiplataforma**: Disponible como aplicación web SPA y como aplicación móvil nativa para Android (a través de Capacitor).

---

## Documentación del Proyecto (`docs`)

En la carpeta [`docs`](docs) se encuentran los recursos teóricos y de diseño del proyecto:
- **Memoria del TFG**: El documento completo del proyecto se encuentra en [`docs/2026-TFG-TorreAlejandro.pdf`](docs/2026-TFG-TorreAlejandro.pdf), el cual detalla los requisitos del usuario, análisis de diseño, modelado del motor de IA y proceso de pruebas.
- **Requisitos de Usuario**: Documentados formalmente dentro de la memoria y la estructura Sphinx de la carpeta.

La documentación técnica auto-generada con **Sphinx** se despliega automáticamente en GitHub Pages mediante la integración continua en cada push a `main` y al generar un nuevo tag de versión:

- **📚 Documentación técnica (API Reference)**: [https://torrealejandro.github.io/EPI-DevorApp/](https://torrealejandro.github.io/EPI-DevorApp/)

---

## Interfaces de la Aplicación

A continuación se muestra una galería de las interfaces de DevorApp:

| Pantalla de Acceso | Flujo de Registro (Paso 1) | Flujo de Registro (Paso 2) |
| :---: | :---: | :---: |
| ![Inicio de Sesión](images/InicioSesion.jpeg) <br> **Inicio de Sesión** | ![Registro Paso 1](images/Registro1.jpeg) <br> **Registro - Credenciales** | ![Registro Paso 2](images/Registro2.jpeg) <br> **Registro - Preferencias** |

| Pantalla Principal | Menú Lateral | Configurar Recomendaciones |
| :---: | :---: | :---: |
| ![Pantalla Principal](images/PantallaPrincipal.jpeg) <br> **Inicio / Descubrimiento** | ![Menú Lateral](images/MenuLateral.jpeg) <br> **Navegación Lateral** | ![Buscar Restaurantes](images/BuscarRestaurantes.jpeg) <br> **Filtros de Búsqueda** |

| Resultados de Búsqueda | Ficha de Detalle | Reseñas de Usuarios |
| :---: | :---: | :---: |
| ![Resultados de Búsqueda](images/ResultadosBusqueda.jpeg) <br> **Restaurantes Recomendados** | ![Detalle Restaurante](images/DetallesRestaurante.jpeg) <br> **Ficha del Restaurante** | ![Reseñas de Usuarios](images/ReseñasUsuarios.jpeg) <br> **Sección de Opiniones** |

| Valorar Establecimiento | Gestión de Listas | Listas de Favoritos |
| :---: | :---: | :---: |
| ![Valorar](images/Editar-PonerValoracion.jpeg) <br> **Crear/Editar Valoración** | ![Listas Favoritos](images/ListasFavoritos.jpeg) <br> **Mis Listas de Favoritos** | ![Favoritos](images/Favoritos.jpeg) <br> **Restaurantes Guardados** |

| Pendientes de Visitar | Historial de Visitas | Perfil de Usuario |
| :---: | :---: | :---: |
| ![Guardar para más tarde](images/GuardarMasTarde.jpeg) <br> **Guardados para más Tarde** | ![Historial](images/Historial.jpeg) <br> **Historial de Visitas** | ![Perfil](images/PerfilUsuario.jpeg) <br> **Perfil y Cuenta** |

---

## Arquitectura del Proyecto

Para el desarrollo de este proyecto se ha decidido implementar una arquitectura distribuida cliente-servidor basada en tres capas principales. Esta separación de responsabilidades permite aislar la lógica de negocio de la interfaz de usuario y del acceso a los datos, facilitando futuras actualizaciones o integraciones sin afectar la integridad del sistema en su conjunto.

El sistema se divide en tres componentes independientes, cada uno con una arquitectura interna propia:

```
epi-devorapp/
├── frontend/      # SPA React 19 + TypeScript + Vite + Capacitor 7
├── backend/       # API REST FastAPI + PostgreSQL + Firebase Admin SDK
└── keras-api/     # Servicio de Recomendación con Inteligencia Artificial (Keras)
```

Todos los subsistemas operan de manera desacoplada y se comunican entre sí de forma bidireccional a través de una API REST. El frontend consume los servicios del backend mediante peticiones HTTP, intercambiando información de forma estructurada, y el backend envía peticiones al modelo de recomendación, recibiendo los datos solicitados de vuelta.

![Arquitectura General](images/ArquitecturaGeneral.svg)

---

### Arquitectura Interna del Backend

El backend del sistema se ha diseñado siguiendo una arquitectura de capas. Al igual que en la arquitectura general del proyecto, el objetivo principal es la separación de responsabilidades, además de garantizar la mantenibilidad y escalabilidad del backend.

- **Capa de presentación**: es la encargada de gestionar las solicitudes del cliente. En ella se encuentra la lógica necesaria para recibir las peticiones entrantes y retornar las respuestas pertinentes.
- **Capa de servicios**: contiene la lógica de negocio del sistema. Procesa las solicitudes recibidas desde la capa de presentación y aplica las reglas de negocio y validaciones del dominio. Además, coordina el flujo de recomendación transformando los datos de la base de datos para enviarlos al modelo de recomendación y gestiona la respuesta recibida.
- **Capa de modelo de datos**: define las estructuras de información y entidades que rigen el sistema.
- **Capa de infraestructura**: se encarga de la comunicación con agentes externos y almacenamiento de datos. Gracias a esta capa se permite que el resto de la aplicación no dependa de la tecnología de la base de datos.
- **Capa core**: contiene las funcionalidades transversales que dan soporte a toda la arquitectura. Centraliza la configuración global y los mecanismos de protección del sistema.

![Arquitectura Interna del Backend](images/DiagramaArquiBack.png)

---

### Arquitectura Interna del Frontend

El frontend del sistema se ha desarrollado siguiendo el patrón Modelo-Vista-Controlador. Esta estructura permite separar las responsabilidades de la aplicación en distintos componentes, facilitando la organización del código, su mantenibilidad y la reutilización de elementos.

- **Modelo**: representa la estructura de los datos utilizados en la aplicación. Los modelos permiten definir la estructura de datos que maneja la aplicación, garantizando coherencia en el tratamiento de la información recibida del backend.
- **Vista**: es la encargada de componer las pantallas que el usuario visualiza. No gestiona la lógica completa, sino que la delega a la capa inferior.
- **Controlador**: actúa como intermediario entre los modelos y las vistas. Se encarga de realizar peticiones a la API, procesar las respuestas y actualizar los componentes correspondientes de la aplicación.

Además, la aplicación cuenta con un punto de entrada principal, donde se inicializa la estructura general de la interfaz.

![Arquitectura Interna del Frontend](images/DiagramaArquiFront.png)

---

### Arquitectura Interna del Microservicio de IA

Dado el coste computacional y las dependencias específicas necesarias para el motor de recomendación, se ha implementado un microservicio independiente siguiendo un patrón de Servicio de Inferencia Ligero.

- **Interfaz de entrada**: expone un único punto de entrada que recibe los vectores de características y valida la identidad del emisor.
- **Gestor de modelo**: implementa un patrón Singleton para asegurar que el modelo neuronal se cargue en memoria una sola vez al iniciar el servicio, optimizando los tiempos de respuesta.
- **Capa de Preprocesamiento**: realiza las últimas transformaciones sobre los datos entrantes para asegurar que las entradas coincidan exactamente con la arquitectura de la red neuronal entrenada.

![Arquitectura Interna del Microservicio de IA](images/ArquitecturaMicroservicio.svg)

---

## Dependencias y Requisitos

### Requisitos previos:
- **Node.js**: Versión 22.x o superior
- **Python**: Versión 3.12.x o superior
- **Poetry**: Gestor de dependencias de Python (instalable mediante `pipx install poetry`)
- **Docker & Docker Compose**: Para el despliegue simplificado
- **Java JDK 17 & Android SDK**: (Solo si deseas compilar la APK de forma local)

---

## Despliegue Local

### 1. Variables de entorno (`.env`)
Debes crear un archivo `.env` en cada uno de los directorios (`frontend/`, `backend/` y `keras-api/`) basándote en las variables de configuración reales del proyecto:

#### Frontend (`frontend/.env`):
```ini
VITE_GOOGLE_API_KEY=tu_api_key_de_google_places
VITE_API_URL=/api
VITE_GOOGLE_CLIENT_ID=tu_cliente_id_de_google_oauth
# Si ejecutas de forma nativa sin Docker, apunta a tu backend local:
# VITE_API_URL=http://localhost:8000
```

#### Backend (`backend/.env`):
```ini
# Firebase
FIREBASE_PROJECT_ID=tu_firebase_project_id
FIREBASE_API_KEY=tu_firebase_api_key
FIREBASE_SERVICE_ACCOUNT_PATH=firebase-service-account.json

# Google Maps / Places
GOOGLE_API_KEY=tu_api_key_de_google_places

# Autenticación JWT (genera uno seguro en producción)
SECRET_KEY=tu_clave_secreta_para_jwt

# Base de datos PostgreSQL (usa db:5432 en Docker, localhost:5432 nativo)
DATABASE_URL=postgresql://postgres:password@db:5432/tfg_db

# Integración con el motor de recomendación de IA
KERAS_API_URL=http://keras-api:8001/predict
KERAS_API_KEY=clave_de_acceso_recommender

# Google OAuth
GOOGLE_CLIENT_ID=tu_cliente_id_de_google_oauth
```

#### Motor de Recomendación (`keras-api/.env`):
```ini
API_KEY_RECOMMENDER=clave_de_acceso_recommender
MODEL_PATH=./models/modelo_prod.h5
PORT=8001

# Datos para el Pipeline de Entrenamiento del modelo
DATABASE_URL=postgresql://postgres:password@localhost:5432/tfg_db
GOOGLE_API_KEY=tu_api_key_de_google_places
```

> [!IMPORTANT]
> **Credenciales de Firebase**: Para arrancar el backend es necesario colocar el archivo JSON de credenciales de tu proyecto de Firebase en `backend/firebase-service-account.json`. 
> Si usas **Docker** y levantas los contenedores *antes* de crear este archivo, Docker creará automáticamente un directorio vacío con ese nombre en tu máquina host. Si te ocurre el error `IsADirectoryError: firebase-service-account.json`, detén el contenedor (`docker compose down`), borra el directorio erróneo (`Remove-Item -Recurse -Force backend/firebase-service-account.json` o `rm -rf`) y coloca el archivo JSON real antes de volver a construir.

### 1.1 Configuración de Google Sign-In (Inicio de Sesión con Google)

Para que el inicio de sesión con Google funcione tanto en el entorno web como en la aplicación móvil (APK), es necesario configurar un proyecto en **Google Cloud Console**:

1. **Crear Credenciales de OAuth 2.0**:
   - Accede a [Google Cloud Console](https://console.cloud.google.com/).
   - Crea o selecciona tu proyecto de Google Cloud.
   - Ve a **API y Servicios > Pantalla de consentimiento de OAuth** y confígurala.
   - Ve a **Credenciales > Crear credenciales > ID de cliente de OAuth**.
2. **Cliente Web**:
   - Crea un ID de cliente de tipo **Aplicación web**.
   - Añade los orígenes autorizados de JavaScript (ej. `http://localhost` y `http://localhost:5173` para desarrollo).
   - Guarda el *ID de cliente* generado. Este valor deberá colocarse en las variables `VITE_GOOGLE_CLIENT_ID` (en el frontend) y `GOOGLE_CLIENT_ID` (en el backend).
3. **Cliente Android (Importante para la APK)**:
   - Para que funcione desde el dispositivo móvil, crea otro ID de cliente de tipo **Android** en la misma consola.
   - Especifica el nombre del paquete: `com.devorapp.epi`.
   - Añade la huella digital del certificado SHA-1 de tu firma:
     * *Desarrollo local (Debug key)*: Obtén el SHA-1 ejecutando `./gradlew signingReport` en la carpeta `frontend/android` y copiando el SHA-1 de la clave `debug`.
     * *Producción (Release key)*: Obtén el SHA-1 ejecutando `keytool -list -v -keystore tu_clave.jks` sobre el archivo keystore de producción (el que codificarás en Base64 para el pipeline).
   - **Nota**: Google vincula automáticamente la autenticación en el móvil con el ID de cliente de tipo Android usando este SHA-1 y el nombre del paquete, de modo que no requiere cambios en el código de la app, pero es obligatorio registrarlo en la consola de Google Cloud para que no falle al iniciar sesión en el móvil.


### 2. Despliegue con Docker (Recomendado)

Construir y arrancar todo el ecosistema (PostgreSQL, Backend, Frontend y Keras API):
```bash
# Modo Producción
docker compose up --build

# Modo Desarrollo (con recarga en vivo de backend y frontend mediante volúmenes montados)
docker compose -f docker-compose.yml -f docker-compose.dev.yml up --build
```

- **Frontend**: Acceso en [http://localhost](http://localhost) (o [http://localhost:5173](http://localhost:5173) en desarrollo)
- **Backend API**: Acceso en [http://localhost:8000](http://localhost:8000) (con Swagger en [http://localhost:8000/docs](http://localhost:8000/docs) y ReDoc en [http://localhost:8000/redoc](http://localhost:8000/redoc))
- **Motor de Recomendación (Keras API)**: Acceso en [http://localhost:8001](http://localhost:8001) (con Swagger en [http://localhost:8001/docs](http://localhost:8001/docs))
- **Base de Datos (PostgreSQL)**: Accesible localmente en `localhost:5432` (usuario `postgres`, contraseña `password`)

### 3. Despliegue Nativo (Servicios Individuales)

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
pip install -r requirements.txt
uvicorn main:app --reload --port 8001
```

### 4. Scripts de Automatización de Despliegue (`deploy.ps1` / `deploy.sh`)

El proyecto incluye dos scripts ([deploy.ps1](../deploy.ps1) para Windows PowerShell y [deploy.sh](../deploy.sh) para entornos Linux/macOS) que facilitan y automatizan las tareas comunes de instalación, ejecución de linters, tests, compilación e inicio de servicios.

Estos scripts viven en la raíz del repositorio (un nivel por encima de `sut/`) y reflejan exactamente las etapas del pipeline de integración continua (CI) de forma local, operando sobre los proyectos dentro de `sut/`.

#### Parámetros en Windows (`deploy.ps1`):
```powershell
# Ejecutar siempre desde la raíz del repositorio
cd ..

# Levantar el stack completo en Docker tras pasar tests (modo por defecto)
.\deploy.ps1

# Levantar únicamente el backend y la base de datos
.\deploy.ps1 -Component backend

# Levantar únicamente el frontend
.\deploy.ps1 -Component frontend

# Levantar con recarga en caliente overlay (modo desarrollo)
.\deploy.ps1 -Dev

# Ejecutar el stack en modo nativo en lugar de Docker
.\deploy.ps1 -Mode native

# Omitir la suite de tests (pytest y vitest) durante la inicialización
.\deploy.ps1 -SkipTests

# Compilar además la APK de depuración (Android Debug APK) al finalizar
.\deploy.ps1 -Apk

# Detener todos los contenedores y redes asociadas
.\deploy.ps1 -Stop
```

#### Parámetros en Linux / macOS (`deploy.sh`):
```bash
# Ejecutar siempre desde la raíz del repositorio
cd ..
chmod +x deploy.sh

./deploy.sh                          # Todo el stack, Docker
./deploy.sh --component backend      # Backend + DB únicamente
./deploy.sh --component frontend     # Frontend únicamente
./deploy.sh --dev                    # Docker con hot-reload para desarrollo
./deploy.sh --mode native            # Procesos nativos locales
./deploy.sh --skip-tests             # Omitir ejecución de tests
./deploy.sh --apk                    # Compilar la APK de depuración Android
./deploy.sh --stop                   # Detener contenedores
```

#### Requisitos según el modo utilizado:
| Herramienta / Requisito | Docker | Modo Nativo | Flags `--apk` o `-Apk` |
| --- | --- | --- | --- |
| **Docker Desktop / Engine** | Requerido | — | — |
| **Node.js 22 + npm** | Opcional (lint) | Requerido | Requerido |
| **Python 3.12 + Poetry** | Opcional (tests) | Requerido | — |
| **Java JDK 17 + ANDROID_HOME** | — | — | Requerido |

---

## Ejecución de Tests

El proyecto cuenta con suites de pruebas unitarias e integración en todos sus componentes.

### Tests del Backend:
```bash
cd backend
poetry run pytest tests/ -v
```

### Tests del Frontend (Vitest):
```bash
cd frontend
npm run test
```

### Tests del Motor Keras API:
```bash
cd keras-api
pytest test_main.py -v
```

### Pruebas de Sistema (E2E y API)
Las pruebas de sistema de extremo a extremo (E2E) y de API se gestionan de forma independiente y se encuentran en su propio repositorio: [retorch-st-devorapp](https://github.com/augustocristian/retorch-st-devorapp). Estas pruebas validan el comportamiento de la interfaz y la API interactuando directamente con el sistema desplegado en modo headless.

---

## Pipeline de Integración y Despliegue Continuo (CI/CD)

El repositorio utiliza **GitHub Actions** para automatizar el flujo de calidad y compilación mediante el flujo definido en [`.github/workflows/ci.yml`](.github/workflows/ci.yml).

### Flujo de GitHub Actions:
```mermaid
graph TD
    A[Push / Pull Request] --> B[backend-ci: Pytest & Coverage]
    A --> C[frontend-ci: ESLint & Vitest Coverage]
    B --> D[sonar-analysis: SonarCloud Scan]
    C --> D
    C --> H[build-android-apk: Build, Sign & Release APK]
    D --> E[build-docker-images: Publish to GHCR]
    D --> F[deploy-docs: Sphinx a GitHub Pages]
    E --> G[system-tests: Run E2E & API Tests]
```

1. **`backend-ci`**: Instala dependencias con Poetry, ejecuta los tests con pytest y genera informes de cobertura (`coverage.xml`).
2. **`frontend-ci`**: Instala dependencias con npm, valida la sintaxis con ESLint, ejecuta los tests unitarios con Vitest y genera informes de cobertura.
3. **`sonar-analysis`**: Descarga los resultados de cobertura de los jobs anteriores y ejecuta el escaneo estático de SonarCloud.
4. **`build-docker-images`**: Empaqueta los tres componentes en imágenes Docker y las publica automáticamente en el registro de contenedores de GitHub (GHCR), etiquetándolas con el short SHA del commit y la marca `latest`.
5. **`deploy-docs`**: Se activa en la rama `main` y en tags de versión. Construye la documentación HTML de Sphinx y la publica automáticamente en GitHub Pages.
6. **`system-tests`**: Levanta de forma temporal todo el stack en contenedores Docker, clona el repositorio externo [retorch-st-devorapp](https://github.com/augustocristian/retorch-st-devorapp) y ejecuta las pruebas de sistema E2E y de API (Maven) en modo headless.
7. **`build-android-apk`**: Se ejecuta después de pasar con éxito las pruebas del frontend. Compila la aplicación Android con Gradle. Si están configurados los secretos de firma, firma la APK y, en caso de tratarse de un tag de versión (`v*`), la publica automáticamente en GitHub Releases.



### Flujo de SonarCloud
El análisis de calidad estática de código está delegado en **SonarCloud**.
- En cada ciclo de CI, los tests de frontend y backend generan informes de cobertura (`lcov` y `cobertura XML` respectivamente).
- SonarCloud procesa las métricas de duplicación de código, cobertura de tests, vulnerabilidades y "code smells", bloqueando el merge si no se cumple el Quality Gate establecido.

---

## Descarga e Instalación de la Aplicación Móvil (APK)

La aplicación móvil se empaqueta automáticamente en cada ciclo de integración continua (CI/CD) de GitHub Actions.

### Cómo instalar la APK:
1. **Descargar la APK**:
   - **Para Releases oficiales**: Accede a la sección **Releases** en el repositorio y descarga el archivo `app-release.apk`.
   - **Para desarrollo y pruebas**: Accede a la pestaña **Actions**, selecciona la última ejecución del pipeline de la rama `main` o `desarrollo`, y descarga el artefacto **`devorapp-release-apk`** (que contiene una versión autodebug firmada lista para instalar directamente en cualquier teléfono).
2. **Transferir e instalar**: Transfiere el archivo `.apk` a tu dispositivo Android (o descárgalo directamente desde el navegador de tu móvil) y ábrelo. Habilita la opción de *"Permitir la instalación de aplicaciones de origen desconocido"* si el dispositivo lo solicita para completar la instalación.

### Cómo conectar la APK a tu Backend Local (Ngrok / Wi-Fi)
Dado que la aplicación móvil corre de forma nativa en tu teléfono, por defecto no puede acceder a `localhost`. Para conectarla al backend que se está ejecutando en tu ordenador de desarrollo:
1. **Exponer el Backend local (Recomendado)**:
   - Levanta tu backend local.
   - Ejecuta una herramienta gratuita como **Ngrok** para abrir un túnel seguro al puerto del backend (ej: `ngrok http 8000`). Esto te proporcionará una URL pública temporal (ej: `https://xxxx.ngrok-free.app`).
2. **Configurar la app en el móvil**:
   - Abre la aplicación **DevorApp** en tu teléfono.
   - En la pantalla de **Inicio de Sesión**, pulsa sobre el **icono de engranaje** (Ajustes de Servidor) situado en la esquina superior derecha de la barra de navegación.
    - Escribe o pega la dirección URL de tu API local:
      * **Si usas Ngrok**: ej. `https://xxxx.ngrok-free.app/api`
      * **Si usas Wi-Fi local**: ej. `http://<IP_DE_TU_PC>:8000/api` (debes reemplazar `<IP_DE_TU_PC>` por la dirección IP local real de tu ordenador, por ejemplo `192.168.1.50`. Puedes averiguar tu IP ejecutando `ipconfig` en la terminal de Windows o `ip a` / `ifconfig` en macOS o Linux).
    - Haz clic en **Guardar y Conectar**. La app se reiniciará sola y ya estará conectada en tiempo real a tu backend local.
   - Puedes pulsar en **Restablecer por defecto** cuando desees restaurar la dirección original.

---

## Secretos Configurados en el Repositorio

Para que el pipeline funcione correctamente, se deben configurar los siguientes secretos en el apartado de configuración del repositorio de GitHub (**Settings → Secrets and variables → Actions**):

- `SONAR_TOKEN`: Token de autenticación de SonarCloud.
- `FIREBASE_SERVICE_ACCOUNT`: Clave privada en base64 de la cuenta de servicio de Firebase (usada para la inicialización en contenedores de staging).
- `KEYSTORE_FILE`: Archivo de firmas `.jks` codificado en base64 (requerido si se compila la APK en el pipeline).
- `KEYSTORE_STORE_PASSWORD` / `KEYSTORE_KEY_PASSWORD`: Contraseñas del almacén de claves para firmar la APK.
- `KEYSTORE_KEY_ALIAS`: Alias de la clave de firma (`devorapp`).

---

## Cómo Contribuir al Proyecto

¡Las contribuciones son bienvenidas! Si deseas aportar mejoras o corregir fallos:

1. Haz un **Fork** del proyecto.
2. Crea una rama para tu característica: `git checkout -b feature/nueva-caracteristica`.
3. Realiza los cambios necesarios y asegúrate de que **todos los tests pasen correctamente**.
4. Haz commit de tus cambios: `git commit -m 'Añade nueva característica'`.
5. Sube la rama: `git push origin feature/nueva-caracteristica`.
6. Abre un **Pull Request** explicando detalladamente tus cambios.

---

## Cómo Citar este Proyecto

Si utilizas este software o haces referencia a la investigación y desarrollo de DevorApp, por favor, cítalo usando la información descrita en el archivo [`CITATION.cff`](CITATION.cff) o haz uso del botón *"Cite this repository"* disponible en la parte superior de GitHub.

### Formato de cita sugerido:

```bibtex
@thesis{Torre2026DevorApp,
  author       = {Torre Llorente, Alejandro},
  title        = {DevorApp: recomendando restaurantes según tu ubicación, gustos y momento},
  school       = {Universidad de Oviedo},
  year         = 2026,
  type         = {Bachelor's Thesis (Trabajo Fin de Grado)}
}
```
