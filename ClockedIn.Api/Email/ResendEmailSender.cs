using System.Net.Http.Headers;
using System.Net.Http.Json;
using ClockedIn.Api.Configuration;
using ClockedIn.Api.Data;
using ClockedIn.Api.Entities;
using ClockedIn.Api.Http;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;

namespace ClockedIn.Api.Email;

public interface IEmailSender
{
    /// <summary>
    /// Renders the organization's template for <paramref name="kind"/> (or the default when there is no
    /// organization or row) and sends it. A disabled optional template sends nothing.
    /// </summary>
    Task Send(
        string to,
        Guid? organizationId,
        EmailTemplateFor kind,
        IReadOnlyDictionary<string, string?> context,
        CancellationToken cancellationToken);
}

public sealed class ResendEmailSender(HttpClient http, IOptions<EmailOptions> options, ClockedInDbContext db) : IEmailSender
{
    public async Task Send(
        string to,
        Guid? organizationId,
        EmailTemplateFor kind,
        IReadOnlyDictionary<string, string?> context,
        CancellationToken cancellationToken)
    {
        var content = EmailTemplateDefaults.For(kind).Content;
        if (organizationId is Guid orgId)
        {
            var row = await db.EmailTemplates.AsNoTracking()
                .FirstOrDefaultAsync(item => item.OrganizationId == orgId && item.For == kind, cancellationToken);
            if (row is not null)
            {
                if (!row.IsEnabled && EmailRenderer.Optional.Contains(kind))
                {
                    return;
                }

                content = new EmailContent(row.Subject, row.Heading, row.Preview, row.Template);
            }
        }

        var settings = options.Value;
        if (string.IsNullOrWhiteSpace(settings.ApiKey) || string.IsNullOrWhiteSpace(settings.From))
        {
            throw new ApiException(502, "email_failed", "Email is not configured.");
        }

        var message = EmailRenderer.Render(content, context);
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
