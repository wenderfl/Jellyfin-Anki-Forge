using System.Net.Mime;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Jellyfin.Plugin.JellyfinMiner.Api;

[AllowAnonymous]
[Route("Plugins/JellyfinMiner")]
public sealed class JellyfinMinerAppController : ControllerBase
{
    private static readonly IReadOnlyDictionary<string, string> ContentTypes = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase)
    {
        [".css"] = "text/css",
        [".gif"] = "image/gif",
        [".html"] = MediaTypeNames.Text.Html,
        [".ico"] = "image/x-icon",
        [".js"] = "text/javascript",
        [".json"] = MediaTypeNames.Application.Json,
        [".map"] = "application/json",
        [".png"] = "image/png",
        [".svg"] = "image/svg+xml",
        [".webmanifest"] = "application/manifest+json",
        [".webp"] = "image/webp",
        [".woff"] = "font/woff",
        [".woff2"] = "font/woff2"
    };

    [HttpGet("{**path}")]
    public IActionResult GetAppAsset(string? path = null)
    {
        if (string.IsNullOrWhiteSpace(path)
            && Request.Path.Value?.EndsWith("/", StringComparison.Ordinal) == false)
        {
            return Redirect($"{Request.PathBase}{Request.Path}/");
        }

        if (path?.StartsWith("api/", StringComparison.OrdinalIgnoreCase) == true)
        {
            return NotFound();
        }

        var pluginDirectory = Path.GetDirectoryName(typeof(Plugin).Assembly.Location) ?? AppContext.BaseDirectory;
        var root = Path.Combine(pluginDirectory, "wwwroot");
        var requested = string.IsNullOrWhiteSpace(path) ? "index.html" : path;
        var file = ResolveStaticFile(root, requested);
        if (file is null)
        {
            if (Path.HasExtension(requested))
            {
                return NotFound();
            }

            file = ResolveStaticFile(root, "index.html");
        }

        if (file is null)
        {
            return NotFound();
        }

        var contentType = GetContentType(file);
        return PhysicalFile(file, contentType);
    }

    internal static string GetContentType(string path)
        => ContentTypes.GetValueOrDefault(Path.GetExtension(path), MediaTypeNames.Application.Octet);

    internal static string? ResolveStaticFile(string root, string relativePath)
    {
        var normalizedRoot = Path.GetFullPath(root);
        var normalizedRelativePath = relativePath
            .Replace('/', Path.DirectorySeparatorChar)
            .Replace('\\', Path.DirectorySeparatorChar);
        var candidate = Path.GetFullPath(Path.Combine(normalizedRoot, normalizedRelativePath));
        var relativeToRoot = Path.GetRelativePath(normalizedRoot, candidate);
        if (Path.IsPathRooted(relativeToRoot)
            || relativeToRoot == ".."
            || relativeToRoot.StartsWith($"..{Path.DirectorySeparatorChar}", StringComparison.Ordinal)
            || !System.IO.File.Exists(candidate))
        {
            return null;
        }

        return candidate;
    }
}
