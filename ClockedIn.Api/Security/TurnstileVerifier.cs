using System.Text.Json.Serialization;
using ClockedIn.Api.Http;

namespace ClockedIn.Api.Security;

public sealed class TurnstileVerifier(HttpClient http, IConfiguration configuration)
{
    public async Task Verify(string? token, CancellationToken cancellationToken)
    {
        var secret = configuration["TURNSTILE_SECRET_KEY"]?.Trim();
        if (string.IsNullOrWhiteSpace(secret))
        {
            var env = Environment.GetEnvironmentVariable("APP_ENV");
            if (env is "production" or "staging")
            {
                throw new ApiException(503, "captcha_unavailable", "Captcha is not configured.");
            }

            return;
        }

        if (string.IsNullOrWhiteSpace(token))
        {
            throw ApiException.Validation("Captcha verification failed.");
        }

        using var content = new FormUrlEncodedContent(new Dictionary<string, string>
        {
            ["secret"] = secret,
            ["response"] = token,
        });
        HttpResponseMessage response;
        try
        {
            response = await http.PostAsync("https://challenges.cloudflare.com/turnstile/v0/siteverify", content, cancellationToken);
        }
        catch (HttpRequestException)
        {
            throw ApiException.Validation("Captcha verification failed.");
        }

        using (response)
        {
            var payload = await response.Content.ReadFromJsonAsync<TurnstileResult>(cancellationToken);
            if (payload?.Success != true)
            {
                throw ApiException.Validation("Captcha verification failed.");
            }
        }
    }

    sealed class TurnstileResult
    {
        [JsonPropertyName("success")]
        public bool Success { get; set; }
    }
}
