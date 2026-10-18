namespace ClockedIn.Api.Entities;

public static class GlobalThemes
{
    public static Theme[] All() =>
    [
        Create(
            Theme.ClockedInId,
            "Clocked In",
            "#001836", "#FFFFFF", "#D4AC59", "#FF5E9F", "#4EBFAE", "#FFFFFF", "#001836", "#001836",
            "SourceSans3", "NunitoSans",
            ["#001836", "#D4AC59", "#2A6F97", "#4EBFAE", "#C17B4A", "#6B7C93"],
            ["#F4F0E6", "#E8D7A8", "#D4AC59", "#8A6E2F", "#3D3014"],
            ["#8B3A2A", "#C17B4A", "#E8C9A8", "#F7F4EE", "#A8C4D4", "#2A6F97", "#001836"]),
        Create(
            Theme.HarborId,
            "Harbor",
            "#1B3A4B", "#F4FAFB", "#2A9D8F", "#E9C46A", "#2A9D8F", "#F7FBFC", "#1B3A4B", "#1B3A4B",
            "Geist", "NunitoSans",
            ["#1B3A4B", "#2A9D8F", "#E9C46A", "#3D5A80", "#8A9BA8", "#C17B4A"],
            ["#E6F4F2", "#A8D9D3", "#2A9D8F", "#1B6B61", "#0E3A35"],
            ["#C17B4A", "#E0B089", "#F3E0C8", "#F7FBFC", "#A8D4E0", "#3D5A80", "#1B3A4B"]),
        Create(
            Theme.AtelierId,
            "Atelier",
            "#3D2B1F", "#FFF8F0", "#C4784A", "#7A8F6A", "#6B8F71", "#FFF8F0", "#3D2B1F", "#3D2B1F",
            "SourceSans3", "NunitoSans",
            ["#3D2B1F", "#C4784A", "#7A8F6A", "#8B6B4A", "#D4A574", "#5C6B7A"],
            ["#FFF1E4", "#E8C4A0", "#C4784A", "#8A4E2A", "#3D2B1F"],
            ["#7A3B2E", "#C4784A", "#E8C4A0", "#FFF8F0", "#C5D1B8", "#7A8F6A", "#3D4A32"]),
        Create(
            Theme.EvergreenId,
            "Evergreen",
            "#1A2F23", "#F3F7F2", "#5B8A6A", "#D4A017", "#3D7A54", "#F6F8F4", "#1A2F23", "#1A2F23",
            "Geist", "SourceSans3",
            ["#1A2F23", "#5B8A6A", "#D4A017", "#3D5C6A", "#8A9B7A", "#C4784A"],
            ["#E8F0EA", "#A8C4B0", "#5B8A6A", "#2F5A3E", "#1A2F23"],
            ["#8B3A2A", "#C4784A", "#E8C9A8", "#F6F8F4", "#A8C4B0", "#3D7A54", "#1A2F23"]),
        Create(
            Theme.OrchidId,
            "Orchid",
            "#2C2156", "#F8F5FF", "#8B6FBF", "#E8A838", "#5A9E8F", "#FBFAFE", "#2C2156", "#2C2156",
            "NunitoSans", "Geist",
            ["#2C2156", "#8B6FBF", "#E8A838", "#5A9E8F", "#C46B8A", "#4A6B8A"],
            ["#F0EAF8", "#C4B0E0", "#8B6FBF", "#5A3F8A", "#2C2156"],
            ["#C46B8A", "#E0A8B8", "#F3D8E0", "#FBFAFE", "#C4B0E0", "#8B6FBF", "#2C2156"]),
        Create(
            Theme.OkabeItoId,
            "Okabe-Ito",
            "#000000", "#FFFFFF", "#0072B2", "#E69F00", "#009E73", "#FFFFFF", "#000000", "#000000",
            "SourceSans3", "NunitoSans",
            ["#E69F00", "#56B4E9", "#009E73", "#F0E442", "#0072B2", "#D55E00", "#CC79A7", "#000000"],
            ["#E6F2F8", "#9ED0E8", "#56B4E9", "#0072B2", "#003D5C"],
            ["#D55E00", "#E69F00", "#F0E442", "#FFFFFF", "#56B4E9", "#0072B2", "#000000"]),
        Create(
            Theme.TolBrightId,
            "Tol Bright",
            "#332288", "#FFFFFF", "#117733", "#DDCC77", "#44AA99", "#FFFFFF", "#332288", "#332288",
            "Geist", "NunitoSans",
            ["#4477AA", "#EE6677", "#228833", "#CCBB44", "#66CCEE", "#AA3377", "#BBBBBB"],
            ["#E8F0F6", "#A8C4DC", "#4477AA", "#2A4F7A", "#1A3048"],
            ["#EE6677", "#F4A8B0", "#FAD8DC", "#FFFFFF", "#A8D4E8", "#4477AA", "#332288"]),
    ];

    private static Theme Create(
        Guid id,
        string name,
        string primary,
        string primaryForeground,
        string highlight,
        string accent,
        string success,
        string surface,
        string surfaceForeground,
        string foreground,
        string headingFont,
        string bodyFont,
        string[] categorical,
        string[] sequential,
        string[] diverging) =>
        new()
        {
            Id = id,
            Name = name,
            OrganizationId = null,
            Primary = primary,
            PrimaryForeground = primaryForeground,
            Highlight = highlight,
            Accent = accent,
            Success = success,
            Surface = surface,
            SurfaceForeground = surfaceForeground,
            Foreground = foreground,
            ChartColor = primary,
            HeadingFont = headingFont,
            BodyFont = bodyFont,
            CategoricalPalette = Palette(categorical),
            SequentialPalette = Palette(sequential),
            DivergingPalette = Palette(diverging),
        };

    public static string Palette(IEnumerable<string> colors) =>
        "[" + string.Join(",", colors.Select(color => $"\"{color.ToUpperInvariant()}\"")) + "]";
}
