namespace Jellyfin.Plugin.JellyfinMiner.Models;

public sealed record SubtitleCue(int Index, long StartMs, long EndMs, string Text);

public sealed record SubtitleTrack(
    int Index,
    string? Language,
    string? DisplayTitle,
    string? Codec,
    bool IsExternal,
    bool IsDefault,
    bool IsForced);

public sealed record SessionSummary(
    string SessionId,
    Guid ItemId,
    string ItemName,
    string Client,
    string DeviceName,
    long PositionMs,
    bool IsPaused,
    int? ActiveSubtitleStreamIndex,
    int? ActiveAudioStreamIndex,
    DateTimeOffset LastReportedAtUtc,
    long StateVersion);

public sealed record SessionManifest(
    string SessionId,
    Guid ItemId,
    string ItemName,
    string MediaSourceId,
    long? RuntimeMs,
    long PositionMs,
    bool IsPaused,
    int? ActiveSubtitleStreamIndex,
    int? ActiveAudioStreamIndex,
    IReadOnlyList<SubtitleTrack> SubtitleTracks,
    DateTimeOffset LastReportedAtUtc,
    long StateVersion);

public sealed record PlaybackStateResponse(
    string SessionId,
    Guid ItemId,
    string MediaSourceId,
    long PositionMs,
    bool IsPaused,
    int? ActiveSubtitleStreamIndex,
    int? ActiveAudioStreamIndex,
    DateTimeOffset ServerTimeUtc,
    DateTimeOffset LastReportedAtUtc,
    long StateVersion);

public sealed record SubtitleCueResponse(
    int SchemaVersion,
    Guid ItemId,
    string MediaSourceId,
    int StreamIndex,
    IReadOnlyList<SubtitleCue> Cues);

public sealed record ImageMediaRequest(
    int StreamIndex,
    int CueIndex,
    int? EndCueIndex,
    string? Format,
    int? Quality,
    bool? Animated,
    string? Size);

public sealed record AudioMediaRequest(
    int StreamIndex,
    int StartCueIndex,
    int? EndCueIndex,
    double? OffsetStartSeconds,
    double? OffsetEndSeconds,
    string? Format,
    int? Quality,
    string? AudioFilterPreset);

public sealed record MediaResponse(
    int SchemaVersion,
    string MediaType,
    string MimeType,
    string Extension,
    string FileNameHint,
    string DataBase64);

public sealed record ApiError(string Code, string Message);

public sealed class SessionSnapshot
{
    public required string SessionId { get; init; }
    public required Guid UserId { get; init; }
    public required Guid ItemId { get; init; }
    public required string ItemName { get; init; }
    public required string Client { get; init; }
    public required string DeviceName { get; init; }
    public required string MediaSourceId { get; init; }
    public required string VideoPath { get; init; }
    public long? RuntimeMs { get; init; }
    public long PositionMs { get; init; }
    public bool IsPaused { get; init; }
    public int? ActiveSubtitleStreamIndex { get; init; }
    public int? ActiveAudioStreamIndex { get; init; }
    public required IReadOnlyList<SubtitleTrackSource> SubtitleTracks { get; init; }
    public DateTimeOffset LastReportedAtUtc { get; init; }
    public long StateVersion { get; init; }
}

public sealed record SubtitleTrackSource(
    int Index,
    string? Language,
    string? DisplayTitle,
    string? Codec,
    bool IsExternal,
    bool IsDefault,
    bool IsForced,
    string? Path);

public sealed class SubtitleUnavailableException(string message) : Exception(message);
