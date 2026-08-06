# Suite de Pruebas para DevorApp (Playwright + C#)

Suite de pruebas de extremo a extremo (E2E) y de API para **DevorApp** (una aplicación de descubrimiento y recomendación de restaurantes), implementada con **[Playwright for .NET](https://playwright.dev/dotnet/)** y **NUnit**.

Es el equivalente funcional de [`selenium-java`](../selenium-java), replicando exactamente los mismos casos de prueba (Base-Choice) sobre la misma arquitectura Page Object Model, pero con Playwright/C# en lugar de Selenium/Java.

---

## Dependencias necesarias

### 1. Requisitos del sistema

| Herramienta | Propósito | Instalación rápida |
| :--- | :--- | :--- |
| **.NET SDK 8.0+** | Compilar y ejecutar la suite (NUnit + Playwright) | `winget install Microsoft.DotNet.SDK.8` (Win) / `brew install dotnet` (Mac) |
| **Docker Desktop / Engine** (Compose v2) | Ejecutar los servicios del SUT | `winget install Docker.DockerDesktop` (Win) / `brew install --cask docker` (Mac) |
| **Git** | Clonar el SUT en la primera ejecución | `winget install Git.Git` (Win) / `brew install git` (Mac) |

*En Linux (Ubuntu/Debian):* `sudo apt install dotnet-sdk-8.0 git docker.io docker-compose-v2`.

### 2. Credenciales de Firebase

Igual que en la suite Selenium: coloca `firebase-service-account.json` en la raíz del proyecto (`./firebase-service-account.json`) para la autenticación de usuarios en las pruebas. El script de despliegue del SUT lo copia automáticamente al contenedor del backend.

### 3. Paquetes NuGet y navegadores de Playwright

Todas las dependencias ([`Microsoft.Playwright`](https://www.nuget.org/packages/Microsoft.Playwright), `Microsoft.Playwright.NUnit`, `NUnit`, `NUnit3TestAdapter`, `Microsoft.NET.Test.Sdk`) están fijadas en [`DevorApp.E2ETests.csproj`](DevorApp.E2ETests.csproj) (equivalente al `<dependencies>` de `pom.xml`).

```powershell
# Restaura los paquetes NuGet
dotnet restore

# Compila el proyecto (también descarga los navegadores de Playwright vía el target MSBuild de Playwright)
dotnet build

# Instala los navegadores de Playwright (Chromium/Firefox/WebKit) — solo hace falta una vez
pwsh bin/Debug/net8.0/playwright.ps1 install
# En Linux/macOS sin pwsh instalado: dotnet tool install --global Microsoft.Playwright.CLI
#                                     playwright install
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
playwright-csharp/
├── playwright-csharp.sln
├── DevorApp.E2ETests.csproj      # dependencias NuGet (equivalente a pom.xml)
├── resources/
│   └── test.properties           # URLs del SUT (idéntico al de selenium-java y puppeteer-python)
├── Common/
│   ├── BaseApiClass.cs           # HttpClient + payload builders + auth lifecycle
│   ├── BaseLoggedClass.cs        # extiende Microsoft.Playwright.NUnit.PageTest
│   ├── DevorAppConfig.cs         # carga de test.properties + variables de entorno
│   └── ElementNotFoundException.cs
├── Pages/                        # Page Objects (uno por vista, igual que selenium-java/.../pages)
└── Tests/
    ├── Api/                      # pruebas REST puras (sin navegador)
    └── E2E/                      # pruebas de navegador (Page Objects)
```

---

## Ejecución de las Pruebas

Las pruebas están estructuradas en dos categorías, igual que en la suite Selenium:

1. **Pruebas de API (`Tests/Api`)**: comprueban los endpoints REST del backend a nivel HTTP.
2. **Pruebas E2E de interfaz (`Tests/E2E`)**: automatizan la experiencia de usuario en Chromium (vía Playwright) usando el patrón **Page Object Model (POM)**.

### Todos los tests

```bash
# Ejecuta la suite de pruebas completa (headless por defecto, como en CI)
dotnet test

# Ejecuta las pruebas de navegador en modo visible ("headed")
HEADED=1 dotnet test          # Bash
$env:HEADED=1; dotnet test    # PowerShell
```

### Subconjuntos de pruebas

```bash
# Ejecutar solo las pruebas de la API
dotnet test --filter "FullyQualifiedName~Tests.Api"

# Ejecutar solo las pruebas de interfaz E2E
dotnet test --filter "FullyQualifiedName~Tests.E2E"

# Ejecutar una sola clase de pruebas
dotnet test --filter "FullyQualifiedName~TestLogin"

# Ejecutar un único método de prueba dentro de una clase
dotnet test --filter "FullyQualifiedName~TestApiRegister.TestS7_LoginCorrecto"
```

### Reportes de resultados

```bash
dotnet test --logger "trx;LogFileName=results.trx" --results-directory target/local
```

En CI, aísla cada TJob bajo su propio subdirectorio (igual que `target/${TJOB_NAME}` en Maven):

```bash
TJOB_NAME=tjob1 SUT_URL=http://backend:8000 dotnet test --logger "trx;LogFileName=results.trx" --results-directory target/tjob1
```

---

## Configuración Opcional

Edita [`resources/test.properties`](resources/test.properties) para cambiar las URLs a las que apunta la suite (idéntico formato al de `selenium-java` y `puppeteer-python`):

```properties
BROWSER_USER=CHROME
LOCALHOST_URL=http://localhost:8000   # URL base para los tests de API
FRONTEND_URL=http://localhost         # URL base para los tests de navegador
HEADLESS_BROWSER=false
```

`SUT_URL` (variable de entorno) sustituye tanto a `LOCALHOST_URL` como a `FRONTEND_URL` en tiempo de ejecución. El modo headless/headed del navegador se controla con la variable de entorno estándar de Playwright, `HEADED` (ver arriba), no con `HEADLESS_BROWSER` — esa clave se mantiene en `test.properties` solo por paridad documental con las otras dos suites.

---

## Diferencias de diseño respecto a `selenium-java`

La arquitectura (Page Object Model, clases base compartidas, casos de prueba) es una traducción deliberada 1:1 de `selenium-java`. Las divergencias son las que Playwright/NUnit permiten o exigen:

- **Sin Waiter/Click propios**: el `ILocator` de Playwright ya espera automáticamente (visible, estable, recibiendo eventos) antes de actuar y reintenta ante fallos transitorios, así que este port no tiene equivalente a las utilidades `Waiter`/`Click` de Java — las páginas llaman a los métodos del locator directamente.
- **Sin `clearSession()` manual**: `Microsoft.Playwright.NUnit.PageTest` entrega a cada `[Test]` una página nueva en su propio `BrowserContext` totalmente aislado (cookies/localStorage/IndexedDB en blanco), reutilizando un único proceso de Chromium para toda la ejecución. La suite Java necesita `clearSession()` porque Selenium no ofrece un equivalente ligero a "nuevo contexto de incógnito por test".
- **Sin diccionario indexado por clase para el usuario de prueba**: a diferencia de JUnit5 (una instancia nueva de la clase de test por cada `[Test]` por defecto), NUnit crea **una única instancia** de cada fixture y la reutiliza en todos sus `[Test]`. Los campos de instancia fijados en `[OneTimeSetUp]` (`TestEmail`, `TestUsername`, `TestPassword`) ya son visibles en todos los tests de esa clase sin necesitar campos estáticos ni el truco de introspección de pila que usa `BaseLoggedClass.java`.
- **Localizadores exactos, comportamiento afinado**: los selectores CSS/XPath se trasladan literalmente desde Java (`Page.Locator("xpath=...")` para XPath) para minimizar el riesgo de desviación de comportamiento. Donde Java sólo podía comprobar *presencia en el DOM* (`BasePage.isVisible`, una limitación de su propia API), aquí se usa la comprobación de *visibilidad real* de Playwright (`ILocator.IsVisibleAsync()`), una mejora consciente y no un cambio accidental.
- **Payloads como `JsonObject` (`System.Text.Json.Nodes`)**: igual que Gson en Java, pero con la API nativa de .NET — sin dependencias adicionales para construir JSON dinámicamente.

---

## Limitaciones conocidas de esta entrega

Este proyecto se generó en un entorno **sin SDK de .NET instalado**, por lo que no fue posible ejecutar `dotnet build` / `dotnet test` para verificar la compilación antes de la entrega (a diferencia de `puppeteer-python`, donde sí se pudo instalar el entorno y ejecutar un smoke test real). El código se escribió con especial cuidado en la sintaxis y las firmas de la API de Playwright/NUnit, pero **se recomienda ejecutar `dotnet build` como primer paso** al usar esta suite por primera vez, y reportar cualquier error de compilación para corregirlo.
