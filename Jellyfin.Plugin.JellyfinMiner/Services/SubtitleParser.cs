using System.Globalization;
using System.Net;
using System.Text.RegularExpressions;
using Jellyfin.Plugin.JellyfinMiner.Models;

namespace Jellyfin.Plugin.JellyfinMiner.Services;

public static partial class SubtitleParser
{
    [GeneratedRegex("<[^>]+>", RegexOptions.Compiled)]
    private static partial Regex HtmlTagRegex();

    public static IReadOnlyList<SubtitleCue> Parse(string content)
    {
        var normalized = NormalizeNewLines(content);
        var blocks = Regex.Split(normalized, "\\n[ \\t]*\\n");
        var cues = new List<SubtitleCue>();

        foreach (var block in blocks)
        {
            var lines = block.Split('\n', StringSplitOptions.None);
            var timeLineIndex = Array.FindIndex(lines, line => line.Contains("-->", StringComparison.Ordinal));
            if (timeLineIndex < 0 || !TryParseRange(lines[timeLineIndex], out var startMs, out var endMs))
            {
                continue;
            }

            var text = NormalizeText(lines.Skip(timeLineIndex + 1));
            if (text.Length > 0)
            {
                cues.Add(new SubtitleCue(cues.Count, startMs, endMs, text));
            }
        }

        return cues;
    }

    public static string NormalizeText(IEnumerable<string> lines)
    {
        var joined = string.Join("\n", lines).Trim();
        var decoded = WebUtility.HtmlDecode(HtmlTagRegex().Replace(joined, string.Empty));
        return string.Join("\n", decoded.Split('\n').Select(x => x.Trim()).Where(x => x.Length > 0));
    }

    private static bool TryParseRange(string line, out long startMs, out long endMs)
    {
        startMs = 0;
        endMs = 0;
        var parts = line.Split("-->", StringSplitOptions.TrimEntries);
        if (parts.Length != 2
            || !TryParseTimestamp(parts[0], out startMs)
            || !TryParseTimestamp(parts[1].Split(' ', StringSplitOptions.RemoveEmptyEntries)[0], out endMs))
        {
            return false;
        }

        return endMs >= startMs;
    }

    private static bool TryParseTimestamp(string raw, out long milliseconds)
    {
        milliseconds = 0;
        var token = raw.Trim().Replace(',', '.');
        var pieces = token.Split('.', 2);
        var clock = pieces[0].Split(':');
        if (clock.Length is < 2 or > 3)
        {
            return false;
        }

        var values = new int[clock.Length];
        for (var i = 0; i < clock.Length; i++)
        {
            if (!int.TryParse(clock[i], CultureInfo.InvariantCulture, out values[i]))
            {
                return false;
            }
        }

        var hours = clock.Length == 3 ? values[0] : 0;
        var minutes = values[^2];
        var seconds = values[^1];
        var fraction = pieces.Length == 2 ? pieces[1] : "0";
        if (!int.TryParse((fraction + "000")[..3], CultureInfo.InvariantCulture, out var millis))
        {
            return false;
        }

        milliseconds = (((hours * 60L) + minutes) * 60L + seconds) * 1000L + millis;
        return true;
    }

    private static string NormalizeNewLines(string value)
        => value.TrimStart('\uFEFF').Replace("\r\n", "\n", StringComparison.Ordinal).Replace('\r', '\n');
}
