namespace DevorApp.E2ETests.Common;

/// <summary>
/// Loads the test configuration from resources/test.properties (flat KEY=VALUE lines, same keys as
/// the selenium-java suite). The SUT_URL environment variable overrides the base URLs.
/// </summary>
public static class DevorAppConfig
{
    private static readonly Lazy<IReadOnlyDictionary<string, string>> PropertiesLazy = new(LoadProperties);

    public static IReadOnlyDictionary<string, string> Properties => PropertiesLazy.Value;

    private static IReadOnlyDictionary<string, string> LoadProperties()
    {
        var path = Path.Combine(AppContext.BaseDirectory, "resources", "test.properties");
        var result = new Dictionary<string, string>();
        foreach (var rawLine in File.ReadAllLines(path))
        {
            var line = rawLine.Trim();
            if (line.Length == 0 || line.StartsWith('#') || !line.Contains('='))
                continue;
            var separatorIndex = line.IndexOf('=');
            var key = line[..separatorIndex].Trim();
            var value = line[(separatorIndex + 1)..].Trim();
            result[key] = value;
        }
        return result;
    }

    /// <summary>Base URL for API requests: SUT_URL env var, else the LOCALHOST_URL property.</summary>
    public static string GetApiBaseUrl() =>
        Environment.GetEnvironmentVariable("SUT_URL")
        ?? Properties.GetValueOrDefault("LOCALHOST_URL", "http://localhost:8000");

    /// <summary>Base URL for the browser: SUT_URL env var, else the FRONTEND_URL property.</summary>
    public static string GetFrontendBaseUrl() =>
        Environment.GetEnvironmentVariable("SUT_URL")
        ?? Properties.GetValueOrDefault("FRONTEND_URL", "http://localhost");
}
