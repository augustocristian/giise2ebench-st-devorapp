# Suite de Pruebas para DevorApp

Suite de pruebas de extremo a extremo (E2E) y de API para **DevorApp** (una aplicación de descubrimiento y recomendación de restaurantes).

---

## Dependencias necesarias

Para compilar, desplegar y ejecutar esta suite de pruebas localmente, asegúrate de tener instalados los siguientes componentes en el sistema:

### 1. Requisitos del Sistema
| Herramienta | Propósito | Instalación rápida |
| :--- | :--- | :--- |
| **Java JDK 8+** (Recomendado JDK 17) | Ejecutar las pruebas Java (JUnit/Selenium) | `winget install Eclipse.Temurin.17.JDK` (Win) / `brew install openjdk@17` (Mac) |
| **Apache Maven 3.x** | Gestor de compilación y pruebas | `winget install Apache.Maven` (Win) / `brew install maven` (Mac) |
| **Docker Desktop / Engine** (Compose v2) | Ejecutar los servicios del SUT | `winget install Docker.DockerDesktop` (Win) / `brew install --cask docker` (Mac) |
| **Git** | Clonar el SUT en la primera ejecución | `winget install Git.Git` (Win) / `brew install git` (Mac) |

*En Linux (Ubuntu/Debian) puedes instalar todo con:* `sudo apt install openjdk-17-jdk maven git docker.io docker-compose-v2`.

### 2. Credenciales de Firebase
Para la autenticación de usuarios en las pruebas:
* Consigue el archivo de credenciales de la cuenta de servicio de Firebase: **`firebase-service-account.json`**.
* Colócalo en la raíz de este proyecto (`./firebase-service-account.json`).
* El script de despliegue lo copiará automáticamente al contenedor del backend de la aplicación durante la compilación.

### 3. Librerías de Java
Todas las dependencias de código (JUnit 5, Selenium, Selema, HttpClient, Gson, etc.) están definidas en el archivo [pom.xml](pom.xml). **Maven las descargará e instalará automáticamente** al ejecutar las pruebas por primera vez (`mvn test`).

---

## Despliegue del Sistema bajo Prueba (SUT)

El proyecto incluye scripts automatizados que se encargan de clonar la última versión de **DevorApp**, aplicar los parches necesarios para entornos de pruebas locales (como saltar la verificación de correo electrónico en Firebase), construir las imágenes de Docker y esperar a que el backend esté listo.

El SUT consta de tres servicios principales:
* **Backend**: FastAPI (Python 3.12) ejecutándose en el puerto `8000`.
* **Frontend**: React 19 + TypeScript servido por Nginx en el puerto `80` (por defecto).
* **Database**: PostgreSQL 16 (puerto interno `5432`).

### Comandos de Despliegue

Utiliza el script correspondiente a tu sistema operativo desde la raíz del proyecto:

#### **Windows (PowerShell)**
```powershell
# Levantar en el puerto por defecto (80 para el frontend)
.\deploy-local.ps1

# Levantar especificando un puerto alternativo para el frontend
.\deploy-local.ps1 -Port 8080

# Detener los contenedores y limpiar los volúmenes de datos
.\deploy-local.ps1 -Down
```

#### **Linux / macOS (Bash)**
```bash
# Otorgar permisos de ejecución (solo la primera vez)
chmod +x deploy-local.sh

# Levantar en el puerto por defecto (80)
./deploy-local.sh

# Levantar en un puerto específico
./deploy-local.sh --port 8080

# Detener los contenedores y limpiar volúmenes
./deploy-local.sh --down
```

> **Verificación**: El SUT estará listo para las pruebas una vez que veas el siguiente mensaje en la consola:
> `[+] DevorApp backend is ready at http://localhost:8000/health`

---

## Ejecución de las Pruebas

Las pruebas están estructuradas bajo el paquete `epigijon.devorapp.e2e.functional` y se dividen en dos categorías principales:
1. **Pruebas de API (`tests.api`)**: Comprueban los endpoints REST del backend a nivel HTTP.
2. **Pruebas E2E de interfaz (`tests.e2e`)**: Automatizan la experiencia de usuario en un navegador web real usando **Selenium** y el patrón **Page Object Model (POM)**.

Puedes ejecutar el conjunto de pruebas con los siguientes comandos de Maven:

### Todos los Tests
```bash
# Ejecuta la suite de pruebas completa en modo visual
mvn test

# Ejecuta las pruebas de navegador en modo oculto/sin cabecera (Headless)
mvn test -Dheadless=true
```

### Subconjuntos de Pruebas
```bash
# Ejecutar solo las pruebas de la API
mvn test -Dtest="TestApi*"

# Ejecutar solo las pruebas de interfaz E2E (Selenium)
mvn test -Dtest="Test*View,TestSideMenu"

# Ejecutar una sola clase de pruebas
mvn test -Dtest=TestLogin

# Ejecutar un único método de prueba dentro de una clase
mvn test -Dtest="TestApiAuth#testHealthEndpoint"
```

### Reportes de Resultados
Los informes generados por Maven Surefire se almacenan en:
* **Ejecución local**: `target/local/surefire-reports/`
* **Ejecución en CI**: `target/${TJOB_NAME}/surefire-reports/`

---

## Configuración Opcional

En el primer despliegue se creará automáticamente el archivo `.retorch/envfiles/local.env`. Puedes añadir las siguientes variables de entorno para habilitar funcionalidades específicas durante las pruebas:

```env
FIREBASE_API_KEY=<tu_api_key_de_firebase>     # Requerido para flujos de autenticación completos
GOOGLE_API_KEY=<tu_api_key_de_google_places>  # Requerido para la búsqueda y enriquecimiento de restaurantes
SECRET_KEY=<tu_clave_secreta_jwt>             # Sobrescribe la clave secreta de desarrollo por defecto
```

Si deseas cambiar las URLs de acceso a las que apunta la suite de pruebas, edita el archivo `src/test/resources/test.properties`:
```properties
BROWSER_USER=CHROME
LOCALHOST_URL=http://localhost:8000   # URL base para los tests de API
FRONTEND_URL=http://localhost         # URL base para los tests de navegador
```

---

## Integración Continua (CI - Jenkins)

El repositorio incluye un archivo `Jenkinsfile` que define la pipeline de construcción y prueba en servidores de Integración Continua. Para ejecutar las pruebas apuntando a contenedores en una red virtual dockerizada, ejecuta:

```bash
mvn test -DSUT_URL=http://backend:8000 -DTJOB_NAME=tjob1
```

Esto aislará el espacio de trabajo bajo el subdirectorio de destino `target/tjob1/` evitando conflictos en ejecuciones simultáneas.
