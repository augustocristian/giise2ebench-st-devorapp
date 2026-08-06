using DevorApp.E2ETests.Common;
using DevorApp.E2ETests.Pages;
using NUnit.Framework;
using static Microsoft.Playwright.Assertions;

namespace DevorApp.E2ETests.Tests.E2E;

/// <summary>
/// Port of epigijon.devorapp.e2e.functional.tests.e2e.TestRegisterView.
///
/// Browser tests for the DevorApp registration flow.
///
/// Base-Choice coverage:
///   BASE — successful registration with valid 9-char password (S7 happy path).
///   S2–S10 — step-1 field validations (email, username, nombre,
///     apellidos, password).
///   S11–S16 — step-2 validations (location required, backend password
///     policy: no-letter, no-number) plus successful registration with a
///     16-character password.
/// </summary>
[TestFixture]
public class TestRegisterView : BaseLoggedClass
{
    private const string BasePassword = "Segura123";
    private const string BaseNombre = "Ana";
    private const string BaseApellidos = "García";

    [OneTimeSetUp]
    public async Task PrepareDuplicateUser()
    {
        var ts = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();
        await SetupTestUserAsync($"dupuser{ts % 100000}", $"dup.email.{ts}@devorapp.test", BasePassword);
    }

    [OneTimeTearDown]
    public async Task CleanupTestUser() => await TeardownTestUserAsync();

    private static async Task FillStep1Async(RegisterPage reg, string email, string username,
        string password, string nombre, string apellidos)
    {
        await reg.EnterEmailAsync(email);
        await reg.EnterUsernameAsync(username);
        await reg.EnterPasswordAsync(password);
        await reg.EnterNombreAsync(nombre);
        await reg.EnterApellidosAsync(apellidos);
    }

    private async Task<string> GetErrorMessageWithWaitAsync(RegisterPage reg)
    {
        await Expect(Page.Locator(".message.error")).Not.ToBeEmptyAsync();
        return await reg.GetErrorMessageAsync();
    }

    // ── 1. Registro Exitoso - Caso BASE (BASE) ────────────────────────────────

    [Test]
    [Description("debe registrarse correctamente con datos válidos y redirigir a verifica correo (BASE)")]
    public async Task TestRegistroExitosoBase()
    {
        await Page.GotoAsync($"{SutUrl}/register");
        var reg = await RegisterPage.CreateAsync(Page);

        var ts = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();
        var email = $"regbase{ts}@devorapp.test";
        const string password = BasePassword;
        RegisterEmailForCleanup(email, password);

        await FillStep1Async(reg, email, $"regbase{ts % 100000}", password, BaseNombre, BaseApellidos);
        // inject BEFORE step 2 mounts so the component finds window.google immediately
        await InjectAutocompleteMockAsync();
        await reg.ClickContinueAsync();
        await reg.WaitForStep2Async();

        Assert.That(await reg.IsOnStep2Async(), Is.True, "Must advance to step 2");

        await reg.EnterUbicacionAsync("Madrid, España");
        await TriggerAutocompletePlaceChangedAsync();
        await reg.ClickSubmitAsync();

        await Expect(Page.Locator("xpath=//*[contains(text(),'Verifica tu correo')]")).ToBeVisibleAsync();
        Assert.That(await reg.IsVerifyEmailVisibleAsync(), Is.True, "Verification screen must be shown");
    }

    // ── 2. Validaciones en Paso 1 (S2–S10) ────────────────────────────────────
    //    Condensa: correo vacío (S4), correo inválido (S2), correo en uso (S3),
    //              username vacío (S5), username en uso (S6),
    //              nombre vacío (S7), apellidos vacíos (S8),
    //              contraseña vacía (S9), contraseña corta (S10).

    [Test]
    [Description("debe validar todos los campos obligatorios en el paso 1 (S2–S10)")]
    public async Task TestValidacionesPaso1()
    {
        var ts = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();
        var validEmail = $"valid{ts}@devorapp.test";
        var validUsername = $"valid{ts % 100000}";

        // S4: Correo vacío
        await Page.GotoAsync($"{SutUrl}/register");
        var reg = await RegisterPage.CreateAsync(Page);
        await FillStep1Async(reg, "", validUsername, BasePassword, BaseNombre, BaseApellidos);
        await reg.ClickContinueAsync();
        Assert.That(await reg.IsOnStep1Async(), Is.True, "S4: must stay on step 1");
        var errS4 = await GetErrorMessageWithWaitAsync(reg);
        Assert.That(errS4.Contains("email") || errS4.Contains("obligatorio"), Is.True, "S4: email error");

        // S2: Correo inválido
        await Page.GotoAsync($"{SutUrl}/register");
        reg = await RegisterPage.CreateAsync(Page);
        await FillStep1Async(reg, "correosinformato", validUsername, BasePassword, BaseNombre, BaseApellidos);
        await reg.ClickContinueAsync();
        Assert.That(await reg.IsOnStep1Async(), Is.True, "S2: must stay on step 1");
        var errS2 = await GetErrorMessageWithWaitAsync(reg);
        Assert.That(errS2.Contains("email") || errS2.Contains("válido"), Is.True, "S2: invalid email error");

        // S3: Correo en uso
        await Page.GotoAsync($"{SutUrl}/register");
        reg = await RegisterPage.CreateAsync(Page);
        await FillStep1Async(reg, TestEmail!, validUsername, BasePassword, BaseNombre, BaseApellidos);
        await reg.ClickContinueAsync();
        await Expect(Page.Locator("#email-error")).Not.ToBeEmptyAsync();
        Assert.That(await reg.GetEmailErrorAsync(), Does.Contain("registrado"), "S3: email in use error");

        // S5: Nombre de usuario vacío
        await Page.GotoAsync($"{SutUrl}/register");
        reg = await RegisterPage.CreateAsync(Page);
        await FillStep1Async(reg, validEmail, "", BasePassword, BaseNombre, BaseApellidos);
        await reg.ClickContinueAsync();
        Assert.That(await reg.IsOnStep1Async(), Is.True, "S5: must stay on step 1");
        var errS5 = await GetErrorMessageWithWaitAsync(reg);
        Assert.That(errS5.Contains("usuario") || errS5.Contains("obligatorio"), Is.True, "S5: username error");

        // S6: Nombre de usuario en uso
        await Page.GotoAsync($"{SutUrl}/register");
        reg = await RegisterPage.CreateAsync(Page);
        await FillStep1Async(reg, validEmail, TestUsername!, BasePassword, BaseNombre, BaseApellidos);
        await reg.ClickContinueAsync();
        await Expect(Page.Locator("#username-error")).Not.ToBeEmptyAsync();
        Assert.That(await reg.GetUsernameErrorAsync(), Does.Contain("uso"), "S6: username in use error");

        // S7: Nombre vacío
        await Page.GotoAsync($"{SutUrl}/register");
        reg = await RegisterPage.CreateAsync(Page);
        await FillStep1Async(reg, validEmail, validUsername, BasePassword, "", BaseApellidos);
        await reg.ClickContinueAsync();
        Assert.That(await reg.IsOnStep1Async(), Is.True, "S7: must stay on step 1");
        var errS7 = await GetErrorMessageWithWaitAsync(reg);
        Assert.That(errS7, Does.Contain("nombre"), "S7: nombre error");

        // S8: Apellidos vacíos
        await Page.GotoAsync($"{SutUrl}/register");
        reg = await RegisterPage.CreateAsync(Page);
        await FillStep1Async(reg, validEmail, validUsername, BasePassword, BaseNombre, "");
        await reg.ClickContinueAsync();
        Assert.That(await reg.IsOnStep1Async(), Is.True, "S8: must stay on step 1");
        // The UI may say "apellidos", "obligatorio", "requerido", etc. — just check any error is shown
        var errS8 = await GetErrorMessageWithWaitAsync(reg);
        Assert.That(errS8, Is.Not.Empty, "S8: apellidos error must be shown");

        // S9: Contraseña vacía
        await Page.GotoAsync($"{SutUrl}/register");
        reg = await RegisterPage.CreateAsync(Page);
        await FillStep1Async(reg, validEmail, validUsername, "", BaseNombre, BaseApellidos);
        await reg.ClickContinueAsync();
        Assert.That(await reg.IsOnStep1Async(), Is.True, "S9: must stay on step 1");
        var errS9 = await GetErrorMessageWithWaitAsync(reg);
        Assert.That(errS9.Contains("contraseña") || errS9.Contains("obligatoria"), Is.True, "S9: password empty error");

        // S10: Contraseña corta (6 chars)
        await Page.GotoAsync($"{SutUrl}/register");
        reg = await RegisterPage.CreateAsync(Page);
        await FillStep1Async(reg, validEmail, validUsername, "Seg123", BaseNombre, BaseApellidos);
        await reg.ClickContinueAsync();
        Assert.That(await reg.IsOnStep1Async(), Is.True, "S10: must stay on step 1");
        var errS10 = await GetErrorMessageWithWaitAsync(reg);
        Assert.That(errS10.Contains('8') || errS10.Contains("caracteres"), Is.True, "S10: short password error");
    }

    // ── 3. Validaciones de Paso 2 y Registro con Contraseña Larga (S11–S16) ──
    //    Condensa: ubicación vacía (S16), ubicación manual (S15),
    //              contraseña sin letras backend (S13), sin números backend (S12),
    //              registro exitoso con contraseña larga (S11).

    [Test]
    [Description("debe validar ubicación, política de contraseña backend (S12, S13, S15, S16) y registro exitoso con contraseña larga (S11)")]
    public async Task TestValidacionesPaso2YPasswordLarga()
    {
        var ts = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();

        // S16: Ubicación vacía
        await Page.GotoAsync($"{SutUrl}/register");
        var reg = await RegisterPage.CreateAsync(Page);
        await FillStep1Async(reg, $"regloc1{ts}@devorapp.test", $"reglocone{ts % 10000}", "12345678",
            BaseNombre, BaseApellidos);
        await reg.ClickContinueAsync();
        await reg.WaitForStep2Async();
        await reg.ClickSubmitAsync();
        Assert.That(await reg.IsOnStep2Async(), Is.True, "S16: must stay on step 2");
        var errS16 = await GetErrorMessageWithWaitAsync(reg);
        Assert.That(errS16.Contains("ubicación") || errS16.Contains("lista"), Is.True, "S16: location empty error");

        // S15: Ubicación manual no seleccionada
        await Page.GotoAsync($"{SutUrl}/register");
        reg = await RegisterPage.CreateAsync(Page);
        await FillStep1Async(reg, $"regloc2{ts}@devorapp.test", $"regloctwo{ts % 10000}", "12345678",
            BaseNombre, BaseApellidos);
        await reg.ClickContinueAsync();
        await reg.WaitForStep2Async();
        await reg.EnterUbicacionAsync("Ubicación No Válida");
        await reg.ClickSubmitAsync();
        Assert.That(await reg.IsOnStep2Async(), Is.True, "S15: must stay on step 2");
        var errS15 = await GetErrorMessageWithWaitAsync(reg);
        Assert.That(errS15.Contains("ubicación") || errS15.Contains("lista"), Is.True, "S15: manual location error");

        // S13: Contraseña sin letras (error del backend)
        await Page.GotoAsync($"{SutUrl}/register");
        reg = await RegisterPage.CreateAsync(Page);
        await FillStep1Async(reg, $"regloc3{ts}@devorapp.test", $"reglocthree{ts % 10000}", "12345678",
            BaseNombre, BaseApellidos);
        // inject BEFORE step 2 mounts so the component finds window.google immediately
        await InjectAutocompleteMockAsync();
        await reg.ClickContinueAsync();
        await reg.WaitForStep2Async();
        await reg.EnterUbicacionAsync("Gijón, España");
        await TriggerAutocompletePlaceChangedAsync();
        await reg.ClickSubmitAsync();
        var errS13 = (await GetErrorMessageWithWaitAsync(reg)).ToLowerInvariant();
        Assert.That(errS13.Contains("letra") || errS13.Contains("contraseña") || errS13.Contains("password"), Is.True,
            "S13: no-letter password backend error");

        // S12: Contraseña sin números (error del backend)
        await Page.GotoAsync($"{SutUrl}/register");
        reg = await RegisterPage.CreateAsync(Page);
        await FillStep1Async(reg, $"regloc4{ts}@devorapp.test", $"reglocfour{ts % 10000}", "PasswordNoNum",
            BaseNombre, BaseApellidos);
        await InjectAutocompleteMockAsync(); // inject BEFORE step 2 mounts
        await reg.ClickContinueAsync();
        await reg.WaitForStep2Async();
        await reg.EnterUbicacionAsync("Gijón, España");
        await TriggerAutocompletePlaceChangedAsync();
        await reg.ClickSubmitAsync();
        var errS12 = (await GetErrorMessageWithWaitAsync(reg)).ToLowerInvariant();
        Assert.That(
            errS12.Contains("número") || errS12.Contains("number") || errS12.Contains("contraseña") || errS12.Contains("password"),
            Is.True, "S12: no-number password backend error");

        // S11: Registro exitoso con contraseña larga (16 chars)
        await Page.GotoAsync($"{SutUrl}/register");
        reg = await RegisterPage.CreateAsync(Page);
        var ts2 = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();
        var emailS11 = $"reglong{ts2}@devorapp.test";
        const string passwordS11 = "Segura1234567890";
        RegisterEmailForCleanup(emailS11, passwordS11);

        await FillStep1Async(reg, emailS11, $"reglong{ts2 % 100000}", passwordS11, BaseNombre, BaseApellidos);
        // inject BEFORE step 2 mounts so the component finds window.google immediately
        await InjectAutocompleteMockAsync();
        await reg.ClickContinueAsync();
        await reg.WaitForStep2Async();

        Assert.That(await reg.IsOnStep2Async(), Is.True, "S11: must advance to step 2");

        await reg.EnterUbicacionAsync("Madrid, España");
        await TriggerAutocompletePlaceChangedAsync();
        await reg.ClickSubmitAsync();

        await Expect(Page.Locator("xpath=//*[contains(text(),'Verifica tu correo')]")).ToBeVisibleAsync();
        Assert.That(await reg.IsVerifyEmailVisibleAsync(), Is.True, "S11: verification screen must be shown");
    }
}
