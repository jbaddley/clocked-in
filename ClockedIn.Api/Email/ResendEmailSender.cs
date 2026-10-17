using System.Net.Http.Headers;
using System.Net.Http.Json;
using ClockedIn.Api.Configuration;
using ClockedIn.Api.Http;
using Microsoft.Extensions.Options;

namespace ClockedIn.Api.Email;

public interface IEmailSender
{
    Task Send(string to, string template, IReadOnlyDictionary<string, string> variables, CancellationToken cancellationToken);
}

public sealed class ResendEmailSender(HttpClient http, IOptions<EmailOptions> options) : IEmailSender
{
    public async Task Send(string to, string template, IReadOnlyDictionary<string, string> variables, CancellationToken cancellationToken)
    {
        var settings = options.Value;
        if (string.IsNullOrWhiteSpace(settings.ApiKey) || string.IsNullOrWhiteSpace(settings.From))
        {
            throw new ApiException(502, "email_failed", "Email is not configured.");
        }

        var message = EmailTemplates.Fill(template, variables);
        using var request = new HttpRequestMessage(HttpMethod.Post, settings.Url)
        {
            Content = JsonContent.Create(new
            {
                from = settings.From,
                to = new[] { to },
                subject = message.Subject,
                html = message.Html,
                text = message.Text,
            }),
        };
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", settings.ApiKey);
        HttpResponseMessage response;
        try
        {
            response = await http.SendAsync(request, cancellationToken);
        }
        catch (HttpRequestException)
        {
            throw new ApiException(502, "email_failed", "The email could not be sent.");
        }

        using (response)
        {
            if (!response.IsSuccessStatusCode)
            {
                throw new ApiException(502, "email_failed", "The email could not be sent.");
            }
        }
    }
}
