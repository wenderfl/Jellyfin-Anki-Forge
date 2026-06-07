using Jellyfin.Plugin.JellyfinMiner.Models;
using MediaBrowser.Controller.Library;
using MediaBrowser.Controller.Session;
using MediaBrowser.Model.Dto;
using MediaBrowser.Model.Entities;
using Microsoft.Extensions.Logging;

namespace Jellyfin.Plugin.JellyfinMiner.Services;

public sealed class SessionMonitorService
{
    private static readonly HashSet<string> TextCodecs = new(StringComparer.OrdinalIgnoreCase)
    {
        "ass", "ssa", "srt", "subrip", "vtt", "webvtt", "mov_text", "text", "ttml"
    };

    private readonly ISessionManager _sessionManager;
    private readonly SubtitleService _subtitles;
    private readonly ILogger<SessionMonitorService> _logger;
    private readonly object _gate = new();
    private readonly Dictionary<string, SessionSnapshot> _sessions = new(StringComparer.OrdinalIgnoreCase);
    private bool _started;

    public SessionMonitorService(ISessionManager sessionManager, SubtitleService subtitles, ILogger<SessionMonitorService> logger)
    {
        _sessionManager = sessionManager;
        _subtitles = subtitles;
        _logger = logger;
    }

    public void Start()
    {
        lock (_gate)
        {
            if (_started) return;
            _sessionManager.PlaybackStart += OnPlaybackStart;
            _sessionManager.PlaybackProgress += OnPlaybackProgress;
            _sessionManager.PlaybackStopped += OnPlaybackStopped;
            foreach (var session in _sessionManager.Sessions)
            {
                Upsert(session, null);
            }
            _started = true;
        }
    }

    public void Stop()
    {
        lock (_gate)
        {
            if (!_started) return;
            _sessionManager.PlaybackStart -= OnPlaybackStart;
            _sessionManager.PlaybackProgress -= OnPlaybackProgress;
            _sessionManager.PlaybackStopped -= OnPlaybackStopped;
            _started = false;
        }
    }

    public IReadOnlyList<SessionSnapshot> GetForUser(Guid userId)
    {
        lock (_gate)
        {
            return _sessions.Values.Where(x => x.UserId == userId).OrderByDescending(x => x.LastReportedAtUtc).ToList();
        }
    }

    public bool TryGetForUser(Guid userId, string sessionId, out SessionSnapshot? snapshot)
    {
        lock (_gate)
        {
            if (_sessions.TryGetValue(sessionId, out var found) && found.UserId == userId)
            {
                snapshot = found;
                return true;
            }
        }

        snapshot = null;
        return false;
    }

    private void OnPlaybackStart(object? sender, PlaybackProgressEventArgs e) => SafeUpsert(e);
    private void OnPlaybackProgress(object? sender, PlaybackProgressEventArgs e) => SafeUpsert(e);

    private void SafeUpsert(PlaybackProgressEventArgs e)
    {
        try { Upsert(e.Session, e); }
        catch (Exception ex) { _logger.LogWarning(ex, "Unable to update Jellyfin Miner session."); }
    }

    private void OnPlaybackStopped(object? sender, PlaybackStopEventArgs e)
    {
        var id = e.Session?.Id ?? e.PlaySessionId;
        if (string.IsNullOrWhiteSpace(id)) return;

        SessionSnapshot? removed = null;
        lock (_gate)
        {
            _sessions.Remove(id, out removed);
        }

        if (removed is not null)
        {
            _subtitles.Invalidate(removed.ItemId, removed.MediaSourceId);
        }
    }

    private void Upsert(SessionInfo? session, PlaybackProgressEventArgs? progress)
    {
        if (session?.NowPlayingItem is null || session.UserId == Guid.Empty || string.IsNullOrWhiteSpace(session.Id))
        {
            return;
        }

        var mediaSourceId = session.PlayState?.MediaSourceId ?? progress?.MediaSourceId ?? string.Empty;
        var mediaSource = FindMediaSource(progress?.MediaInfo?.MediaSources, mediaSourceId)
            ?? FindMediaSource(session.NowPlayingItem.MediaSources, mediaSourceId);
        var path = mediaSource?.Path ?? progress?.MediaInfo?.Path ?? session.NowPlayingItem.Path;
        var streams = mediaSource?.MediaStreams ?? session.NowPlayingItem.MediaStreams;
        if (string.IsNullOrWhiteSpace(path) || !File.Exists(path) || streams?.All(x => x.Type != MediaStreamType.Video) != false)
        {
            return;
        }

        lock (_gate)
        {
            _sessions.TryGetValue(session.Id, out var previous);
            var itemChanged = previous is not null
                && (previous.ItemId != session.NowPlayingItem.Id || previous.MediaSourceId != mediaSourceId);
            if (itemChanged)
            {
                _subtitles.Invalidate(previous!.ItemId, previous.MediaSourceId);
            }

            var tracks = BuildTracks(streams);
            if (tracks.Count == 0 && previous is not null && !itemChanged)
            {
                tracks = previous.SubtitleTracks;
            }

            var ticks = progress?.PlaybackPositionTicks ?? session.PlayState?.PositionTicks ?? 0;
            _sessions[session.Id] = new SessionSnapshot
            {
                SessionId = session.Id,
                UserId = session.UserId,
                ItemId = session.NowPlayingItem.Id,
                ItemName = session.NowPlayingItem.Name ?? string.Empty,
                Client = session.Client ?? string.Empty,
                DeviceName = session.DeviceName ?? string.Empty,
                MediaSourceId = mediaSourceId,
                VideoPath = File.Exists(path) ? path : previous?.VideoPath ?? path,
                RuntimeMs = TicksToNullableMs(session.NowPlayingItem.RunTimeTicks),
                PositionMs = ticks / TimeSpan.TicksPerMillisecond,
                IsPaused = session.PlayState?.IsPaused ?? false,
                ActiveSubtitleStreamIndex = NormalizeIndex(session.PlayState?.SubtitleStreamIndex),
                ActiveAudioStreamIndex = NormalizeIndex(session.PlayState?.AudioStreamIndex),
                SubtitleTracks = tracks,
                LastReportedAtUtc = DateTimeOffset.UtcNow,
                StateVersion = (previous?.StateVersion ?? 0) + 1
            };
        }
    }

    private static MediaSourceInfo? FindMediaSource(IReadOnlyList<MediaSourceInfo>? sources, string id)
        => sources?.FirstOrDefault(x => string.Equals(x.Id, id, StringComparison.OrdinalIgnoreCase)) ?? sources?.FirstOrDefault();

    private static IReadOnlyList<SubtitleTrackSource> BuildTracks(IReadOnlyList<MediaStream>? streams)
        => streams?
            .Where(x => x.Type == MediaStreamType.Subtitle && x.Index >= 0 && IsText(x))
            .OrderBy(x => x.Index)
            .Select(x => new SubtitleTrackSource(x.Index, x.Language, x.DisplayTitle ?? x.Title, x.Codec, x.IsExternal, x.IsDefault, x.IsForced, x.Path))
            .ToList() ?? [];

    private static bool IsText(MediaStream stream)
        => !string.IsNullOrWhiteSpace(stream.Codec) && TextCodecs.Contains(stream.Codec);

    private static int? NormalizeIndex(int? index) => index is >= 0 ? index : null;
    private static long? TicksToNullableMs(long? ticks) => ticks.HasValue ? ticks.Value / TimeSpan.TicksPerMillisecond : null;
}
