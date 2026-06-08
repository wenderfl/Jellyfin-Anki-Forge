using System.Collections.Concurrent;
using System.Diagnostics;
using System.Text.RegularExpressions;
using MediaBrowser.Controller.MediaEncoding;
using Microsoft.Extensions.Logging;

namespace Jellyfin.Plugin.JellyfinMiner.Services;

internal static partial class FfmpegHelper
{
    private const int MaxLoggedStderrLength = 2000;
    private static readonly ConcurrentDictionary<string, FfmpegEncoderDetectionResult> EncoderCache = new(StringComparer.Ordinal);

    public static async Task<FfmpegRunResult> RunAsync(
        IMediaEncoder mediaEncoder,
        ILogger logger,
        string operation,
        string[] args,
        CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(mediaEncoder.EncoderPath))
        {
            logger.LogWarning("FFmpeg {Operation} failed: encoder path is unavailable.", operation);
            return new FfmpegRunResult(false, FfmpegFailureKind.EncoderUnavailable, string.Empty);
        }

        var info = new ProcessStartInfo(mediaEncoder.EncoderPath)
        {
            RedirectStandardError = true,
            UseShellExecute = false,
            CreateNoWindow = true
        };
        foreach (var arg in args)
        {
            info.ArgumentList.Add(arg);
        }

        using var process = TryStart(info, logger, operation);
        if (process is null)
        {
            return new FfmpegRunResult(false, FfmpegFailureKind.EncoderUnavailable, string.Empty);
        }

        var errorTask = process.StandardError.ReadToEndAsync(cancellationToken);
        await process.WaitForExitAsync(cancellationToken).ConfigureAwait(false);
        var error = await errorTask.ConfigureAwait(false);
        if (process.ExitCode != 0)
        {
            logger.LogWarning(
                "FFmpeg {Operation} failed with exit code {ExitCode}: {Stderr}",
                operation,
                process.ExitCode,
                NormalizeStderrForLog(error));
        }

        return new FfmpegRunResult(
            process.ExitCode == 0,
            process.ExitCode == 0 ? FfmpegFailureKind.None : FfmpegFailureKind.ProcessFailed,
            error.Trim());
    }

    public static async Task<FfmpegEncoderResult> FindFirstEncoderAsync(
        IMediaEncoder mediaEncoder,
        ILogger logger,
        IReadOnlyList<string> candidates,
        CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(mediaEncoder.EncoderPath))
        {
            logger.LogWarning("FFmpeg encoder detection failed: encoder path is unavailable.");
            return new FfmpegEncoderResult(FfmpegFailureKind.EncoderUnavailable, null);
        }

        if (!EncoderCache.TryGetValue(mediaEncoder.EncoderPath, out var detection))
        {
            detection = await ReadEncodersAsync(mediaEncoder, logger, cancellationToken).ConfigureAwait(false);
            EncoderCache[mediaEncoder.EncoderPath] = detection;
        }

        return detection.FailureKind == FfmpegFailureKind.None
            ? new FfmpegEncoderResult(FfmpegFailureKind.None, candidates.FirstOrDefault(detection.Encoders.Contains))
            : new FfmpegEncoderResult(detection.FailureKind, null);
    }

    internal static IReadOnlySet<string> ParseEncoderNames(string output)
    {
        var encoders = new HashSet<string>(StringComparer.Ordinal);
        foreach (var line in output.Split('\n'))
        {
            var match = EncoderLineRegex().Match(line);
            if (match.Success)
            {
                encoders.Add(match.Groups["name"].Value);
            }
        }

        return encoders;
    }

    private static async Task<FfmpegEncoderDetectionResult> ReadEncodersAsync(
        IMediaEncoder mediaEncoder,
        ILogger logger,
        CancellationToken cancellationToken)
    {
        var info = new ProcessStartInfo(mediaEncoder.EncoderPath)
        {
            RedirectStandardOutput = true,
            RedirectStandardError = true,
            UseShellExecute = false,
            CreateNoWindow = true
        };
        info.ArgumentList.Add("-hide_banner");
        info.ArgumentList.Add("-encoders");

        using var process = TryStart(info, logger, "encoder detection");
        if (process is null)
        {
            return new FfmpegEncoderDetectionResult(FfmpegFailureKind.EncoderUnavailable, new HashSet<string>(StringComparer.Ordinal));
        }

        var outputTask = process.StandardOutput.ReadToEndAsync(cancellationToken);
        var errorTask = process.StandardError.ReadToEndAsync(cancellationToken);
        await process.WaitForExitAsync(cancellationToken).ConfigureAwait(false);
        var output = await outputTask.ConfigureAwait(false);
        var error = await errorTask.ConfigureAwait(false);

        if (process.ExitCode != 0)
        {
            logger.LogWarning("FFmpeg encoder detection failed: {Stderr}", NormalizeStderrForLog(error));
            return new FfmpegEncoderDetectionResult(FfmpegFailureKind.ProcessFailed, new HashSet<string>(StringComparer.Ordinal));
        }

        return new FfmpegEncoderDetectionResult(FfmpegFailureKind.None, ParseEncoderNames(output));
    }

    [GeneratedRegex(@"^\s*[A-Z.]{6}\s+(?<name>\S+)\s", RegexOptions.Compiled)]
    private static partial Regex EncoderLineRegex();

    private static Process? TryStart(ProcessStartInfo info, ILogger logger, string operation)
    {
        try
        {
            return Process.Start(info);
        }
        catch (Exception ex) when (ex is InvalidOperationException or System.ComponentModel.Win32Exception)
        {
            logger.LogWarning(ex, "FFmpeg {Operation} failed: encoder process could not be started.", operation);
            return null;
        }
    }

    private static string NormalizeStderrForLog(string stderr)
    {
        if (string.IsNullOrWhiteSpace(stderr))
        {
            return "(empty stderr)";
        }

        var normalized = WhitespaceRegex().Replace(stderr.Trim(), " ");
        return normalized.Length <= MaxLoggedStderrLength
            ? normalized
            : $"{normalized[..MaxLoggedStderrLength]}...";
    }

    [GeneratedRegex("\\s+", RegexOptions.Compiled)]
    private static partial Regex WhitespaceRegex();
}

internal sealed record FfmpegEncoderResult(FfmpegFailureKind FailureKind, string? Encoder);

internal sealed record FfmpegEncoderDetectionResult(FfmpegFailureKind FailureKind, IReadOnlySet<string> Encoders);

internal enum FfmpegFailureKind
{
    None,
    EncoderUnavailable,
    ProcessFailed
}

internal sealed record FfmpegRunResult(bool Succeeded, FfmpegFailureKind FailureKind, string Stderr);
