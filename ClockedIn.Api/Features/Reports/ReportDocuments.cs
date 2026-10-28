using System.Globalization;
using System.Text.Json;
using System.Text.RegularExpressions;
using ClockedIn.Api.Http;

namespace ClockedIn.Api.Features.Reports;

public readonly record struct StoredReportFilters(
    string? DepartmentId,
    string? TaskCategoryId,
    string? ProjectId,
    string? UserId,
    string? From,
    string? To);

public static partial class ReportDocuments
{
    public const int ColumnCount = 12;
    public const int MaxRow = 48;
    public const int MaxCards = 40;

    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web);
    private static readonly string[] ValueColors = ["primary", "highlight", "accent", "success"];
    private static readonly string[] ValueFormats = ["number", "hours", "currency"];
    private static readonly string[] ChartFormats = ["number", "hours", "currency"];
    private static readonly string[] ListColumns = ["name", "type", "hours", "share", "people", "inKind"];
    private static readonly string[] ListSortKeys = ["name", "hours", "share", "people", "inKind"];
    private static readonly string[] ListSortDirs = ["asc", "desc"];
    private static readonly string[] EntriesScopes = ["mine", "organization"];
    private static readonly string[] ChartTypes = ["donut", "pie", "bar", "column"];
    private static readonly string[] Palettes = ["single", "categorical", "sequential", "diverging"];
    private static readonly string[] ValueKeys = ["hours", "inKind"];
    private static readonly string[] FilterKeys = ["departmentId", "taskCategoryId", "projectId", "userId", "from", "to"];

    public static string Layout(JsonElement value)
    {
        var source = Object(value, "layout");
        if (Take(source, "version") is not int version || version != 1)
        {
            throw ApiException.Validation("version must be 1.");
        }

        if (Take(source, "cards") is not JsonElement cards || cards.ValueKind != JsonValueKind.Array)
        {
            throw ApiException.Validation("cards must be an array.");
        }

        Leftover(source, "layout");
        if (cards.GetArrayLength() > MaxCards)
        {
            throw ApiException.Validation("A report can have at most 40 cards.");
        }

        var normalized = new List<object>();
        var boxes = new List<(string Id, int Column, int Row, int Columns, int Rows)>();
        var index = 0;
        foreach (var item in cards.EnumerateArray())
        {
            normalized.Add(Card(item, index, boxes));
            index += 1;
        }

        var document = new Dictionary<string, object> { ["version"] = 1, ["cards"] = normalized };
        return JsonSerializer.Serialize(document, Json);
    }

    public static string Filters(JsonElement value)
    {
        if (value.ValueKind is JsonValueKind.Undefined or JsonValueKind.Null)
        {
            return "{}";
        }

        var source = Object(value, "filters");
        string? departmentId = OptionalId(source, "departmentId");
        string? taskCategoryId = OptionalId(source, "taskCategoryId");
        string? projectId = OptionalId(source, "projectId");
        string? userId = OptionalId(source, "userId");
        string? from = OptionalDate(source, "from");
        string? to = OptionalDate(source, "to");
        Leftover(source, "filters");
        if (from is not null && to is not null && string.CompareOrdinal(from, to) > 0)
        {
            throw ApiException.Validation("from must be on or before to.");
        }

        var filters = new Dictionary<string, string>();
        Add(filters, "departmentId", departmentId);
        Add(filters, "taskCategoryId", taskCategoryId);
        Add(filters, "projectId", projectId);
        Add(filters, "userId", userId);
        Add(filters, "from", from);
        Add(filters, "to", to);
        return JsonSerializer.Serialize(filters, Json);
    }

    public static string Name(string? value)
    {
        var name = value?.Trim() ?? "";
        if (name.Length == 0)
        {
            throw ApiException.Validation("name is required.");
        }

        if (name.Length > 80)
        {
            throw ApiException.Validation("name must be 80 characters or less.");
        }

        return name;
    }

    public static StoredReportFilters ReadFilters(string json)
    {
        using var document = JsonDocument.Parse(json);
        var root = document.RootElement;
        return new StoredReportFilters(
            OptionalText(root, "departmentId"),
            OptionalText(root, "taskCategoryId"),
            OptionalText(root, "projectId"),
            OptionalText(root, "userId"),
            OptionalText(root, "from"),
            OptionalText(root, "to"));
    }

    public static JsonElement Element(string json) => JsonDocument.Parse(json).RootElement.Clone();

    private static object Card(JsonElement value, int index, List<(string Id, int Column, int Row, int Columns, int Rows)> boxes)
    {
        var source = Object(value, $"cards[{index}]");
        var kind = Choice(Take(source, "kind"), "kind", ["value", "chart", "list", "entries"]);
        var id = Id(Take(source, "id"), "id");
        var title = Text(Take(source, "title"), "title", 120, true);
        var description = source.ContainsKey("description") ? Text(Take(source, "description"), "description", 300, false) : "";
        var column = Integer(Take(source, "column"), "column");
        var row = Integer(Take(source, "row"), "row");
        var columns = Integer(Take(source, "columns"), "columns");
        var rows = Integer(Take(source, "rows"), "rows");
        var accessor = Text(Take(source, "accessor"), "accessor", 200, true);
        if (column < 1 || column > ColumnCount)
        {
            throw ApiException.Validation("column must be from 1 to 12.");
        }

        if (columns < 1 || column + columns - 1 > ColumnCount)
        {
            throw ApiException.Validation("columns must leave the card inside column 12.");
        }

        if (row < 1 || row > MaxRow)
        {
            throw ApiException.Validation("row must be from 1 to 48.");
        }

        if (rows < 1 || row + rows - 1 > MaxRow)
        {
            throw ApiException.Validation("rows must leave the card inside row 48.");
        }

        if (!AccessorPattern().IsMatch(accessor))
        {
            throw ApiException.Validation("accessor must be a path such as user.hours.");
        }

        if (boxes.Any(other => other.Id == id))
        {
            throw ApiException.Validation("cards must have unique ids.");
        }

        if (boxes.Any(other => Overlaps(other, column, row, columns, rows)))
        {
            throw ApiException.Validation("Cards cannot overlap.");
        }

        boxes.Add((id, column, row, columns, rows));
        if (kind == "value")
        {
            var color = Choice(Take(source, "color"), "color", ValueColors);
            var format = Choice(Take(source, "format"), "format", ValueFormats);
            var pattern = Pattern(source, format);
            var icon = Icon(source);
            Leftover(source, "cards");
            return CardDictionary(id, kind, title, description, column, row, columns, rows, accessor, new Dictionary<string, object?>
            {
                ["color"] = color,
                ["format"] = format,
                ["pattern"] = pattern,
                ["icon"] = icon,
            });
        }

        if (kind == "list")
        {
            var format = Choice(Take(source, "format"), "format", ValueFormats);
            var pattern = Pattern(source, format);
            var visible = VisibleColumns(Take(source, "visibleColumns"));
            var extra = new Dictionary<string, object?>
            {
                ["format"] = format,
                ["pattern"] = pattern,
                ["visibleColumns"] = visible,
            };
            var sortKey = OptionalChoice(source, "sortKey", ListSortKeys);
            var sortDir = OptionalChoice(source, "sortDir", ListSortDirs);
            var limit = OptionalBoundedInteger(source, "limit", 1, 50);
            if (sortKey is not null) extra["sortKey"] = sortKey;
            if (sortDir is not null) extra["sortDir"] = sortDir;
            if (limit is int listLimit) extra["limit"] = listLimit;
            Leftover(source, "cards");
            return CardDictionary(id, kind, title, description, column, row, columns, rows, accessor, extra);
        }

        if (kind == "entries")
        {
            var scope = source.ContainsKey("scope") ? Choice(Take(source, "scope"), "scope", EntriesScopes) : "mine";
            var limit = OptionalBoundedInteger(source, "limit", 1, 20) ?? 6;
            Leftover(source, "cards");
            return CardDictionary(id, kind, title, description, column, row, columns, rows, $"entries.{scope}", new Dictionary<string, object?>
            {
                ["scope"] = scope,
                ["limit"] = limit,
            });
        }

        var chartType = Choice(Take(source, "chartType"), "chartType", ChartTypes);
        var palette = Choice(Take(source, "palette"), "palette", Palettes);
        var valueKey = Choice(Take(source, "valueKey"), "valueKey", ValueKeys);
        var chartFormat = Choice(Take(source, "format"), "format", ChartFormats);
        var chartPattern = Pattern(source, chartFormat);
        Leftover(source, "cards");
        return CardDictionary(id, kind, title, description, column, row, columns, rows, accessor, new Dictionary<string, object?>
        {
            ["chartType"] = chartType,
            ["palette"] = palette,
            ["valueKey"] = valueKey,
            ["format"] = chartFormat,
            ["pattern"] = chartPattern,
        });
    }

    private static Dictionary<string, object?> CardDictionary(
        string id,
        string kind,
        string title,
        string description,
        int column,
        int row,
        int columns,
        int rows,
        string accessor,
        Dictionary<string, object?> extra)
    {
        var card = new Dictionary<string, object?>
        {
            ["id"] = id,
            ["kind"] = kind,
            ["title"] = title,
            ["description"] = description,
            ["column"] = column,
            ["row"] = row,
            ["columns"] = columns,
            ["rows"] = rows,
            ["accessor"] = accessor,
        };
        foreach (var pair in extra)
        {
            card[pair.Key] = pair.Value;
        }

        return card;
    }

    private static string Pattern(Dictionary<string, object?> source, string format)
    {
        if (!source.ContainsKey("pattern"))
        {
            return format == "currency" ? "$0,0.00" : "0,0.[00]";
        }

        return Text(Take(source, "pattern"), "pattern", 40, true);
    }

    private static string? Icon(Dictionary<string, object?> source)
    {
        if (!source.ContainsKey("icon"))
        {
            return null;
        }

        var value = Take(source, "icon");
        if (value is null)
        {
            return null;
        }

        var icon = Text(value, "icon", 64, true);
        if (!IconPattern().IsMatch(icon))
        {
            throw ApiException.Validation("icon must be a Lucide icon name.");
        }

        return icon;
    }

    private static List<string> VisibleColumns(object? value)
    {
        if (value is not JsonElement element || element.ValueKind != JsonValueKind.Array)
        {
            throw ApiException.Validation("visibleColumns must be an array.");
        }

        var seen = new HashSet<string>();
        foreach (var item in element.EnumerateArray())
        {
            var text = item.ValueKind == JsonValueKind.String ? item.GetString() : null;
            if (text is null || !ListColumns.Contains(text))
            {
                throw ApiException.Validation("visibleColumns must be name, type, hours, share, people, or inKind.");
            }

            if (!seen.Add(text))
            {
                throw ApiException.Validation("visibleColumns must be unique.");
            }
        }

        return ListColumns.Where(seen.Contains).ToList();
    }

    private static bool Overlaps((string Id, int Column, int Row, int Columns, int Rows) other, int column, int row, int columns, int rows) =>
        column < other.Column + other.Columns
        && column + columns > other.Column
        && row < other.Row + other.Rows
        && row + rows > other.Row;

    private static Dictionary<string, object?> Object(JsonElement value, string label)
    {
        if (value.ValueKind != JsonValueKind.Object)
        {
            throw ApiException.Validation($"{label} must be an object.");
        }

        var source = new Dictionary<string, object?>();
        foreach (var property in value.EnumerateObject())
        {
            source[property.Name] = Box(property.Value);
        }

        if (label == "filters")
        {
            foreach (var key in source.Keys)
            {
                if (!FilterKeys.Contains(key))
                {
                    throw ApiException.Validation("filters contains an unknown field.");
                }
            }
        }

        return source;
    }

    private static object WholeNumber(JsonElement value)
    {
        if (value.TryGetInt32(out var number))
        {
            return number;
        }

        var decimalNumber = value.GetDecimal();
        if (decimalNumber == decimal.Truncate(decimalNumber) && decimalNumber is >= int.MinValue and <= int.MaxValue)
        {
            return (int)decimalNumber;
        }

        return decimalNumber;
    }

    private static object? Box(JsonElement value) => value.ValueKind switch
    {
        JsonValueKind.String => value.GetString(),
        JsonValueKind.Number => WholeNumber(value),
        JsonValueKind.True => true,
        JsonValueKind.False => false,
        JsonValueKind.Null => null,
        _ => value.Clone(),
    };

    private static object? Take(Dictionary<string, object?> source, string key)
    {
        source.Remove(key, out var value);
        return value;
    }

    private static void Leftover(Dictionary<string, object?> source, string label)
    {
        if (source.Count > 0)
        {
            throw ApiException.Validation($"{label} contains an unknown field.");
        }
    }

    private static string Text(object? value, string key, int max, bool required)
    {
        if (value is not string text)
        {
            throw ApiException.Validation(required ? $"{key} is required." : $"{key} must be a string.");
        }

        var trimmed = text.Trim();
        if (required && trimmed.Length == 0)
        {
            throw ApiException.Validation($"{key} is required.");
        }

        if (trimmed.Length > max)
        {
            throw ApiException.Validation($"{key} must be {max} characters or less.");
        }

        return trimmed;
    }

    private static int Integer(object? value, string key)
    {
        if (value is not int number)
        {
            throw ApiException.Validation($"{key} must be an integer.");
        }

        return number;
    }

    private static string Choice(object? value, string key, IReadOnlyList<string> allowed)
    {
        if (value is not string text || !allowed.Contains(text))
        {
            throw ApiException.Validation($"{key} must be {string.Join(", ", allowed)}.");
        }

        return text;
    }

    private static string? OptionalChoice(Dictionary<string, object?> source, string key, IReadOnlyList<string> allowed)
    {
        if (!source.ContainsKey(key))
        {
            return null;
        }

        var value = Take(source, key);
        if (value is null)
        {
            return null;
        }

        return Choice(value, key, allowed);
    }

    private static int? OptionalBoundedInteger(Dictionary<string, object?> source, string key, int min, int max)
    {
        if (!source.ContainsKey(key))
        {
            return null;
        }

        var value = Take(source, key);
        if (value is null)
        {
            return null;
        }

        var number = Integer(value, key);
        if (number < min || number > max)
        {
            throw ApiException.Validation($"{key} must be from {min} to {max}.");
        }

        return number;
    }

    private static string Id(object? value, string key)
    {
        if (value is not string text || !Guid.TryParse(text, out var id) || text.Contains(' ') || !text.Contains('-'))
        {
            throw ApiException.Validation($"{key} must be an id.");
        }

        return id.ToString("D");
    }

    private static string? OptionalId(Dictionary<string, object?> source, string key)
    {
        if (!source.ContainsKey(key))
        {
            return null;
        }

        var value = Take(source, key);
        return value is null ? null : Id(value, key);
    }

    private static string? OptionalDate(Dictionary<string, object?> source, string key)
    {
        if (!source.ContainsKey(key))
        {
            return null;
        }

        var value = Take(source, key);
        if (value is null)
        {
            return null;
        }

        if (value is not string text
            || !DateOnly.TryParseExact(text, "yyyy-MM-dd", CultureInfo.InvariantCulture, DateTimeStyles.None, out var date)
            || date.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture) != text)
        {
            throw ApiException.Validation($"{key} must be a date.");
        }

        return text;
    }

    private static string? OptionalText(JsonElement root, string key) =>
        root.ValueKind == JsonValueKind.Object && root.TryGetProperty(key, out var value) && value.ValueKind == JsonValueKind.String
            ? value.GetString()
            : null;

    private static void Add(Dictionary<string, string> filters, string key, string? value)
    {
        if (value is not null)
        {
            filters[key] = value;
        }
    }

    [GeneratedRegex(@"^[A-Za-z_][A-Za-z0-9_]*(?:\.[A-Za-z_][A-Za-z0-9_]*|\[\d+\]|\[""[^""]+""\]|\['[^']+'\])*$")]
    private static partial Regex AccessorPattern();

    [GeneratedRegex(@"^[a-z0-9]+(?:-[a-z0-9]+)*$")]
    private static partial Regex IconPattern();
}
