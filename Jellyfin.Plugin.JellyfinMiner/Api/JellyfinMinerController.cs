using System.Net.Mime;
using System.Security.Claims;
using Jellyfin.Plugin.JellyfinMiner.Models;
using Jellyfin.Plugin.JellyfinMiner.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;

namespace Jellyfin.Plugin.JellyfinMiner.Api;

[ApiController]
[Authorize]
[Route("Plugins/JellyfinMiner/api/v1")]
[Produces(MediaTypeNames.Application.Json)]
public sealed class JellyfinMinerController(
    SessionMonitorService sessions,
    SubtitleService subtitles,
    MediaExtractionService media) : ControllerBase
{
    [HttpGet("sessions")]
    public ActionResult<IReadOnlyList<SessionSummary>> GetSessions()
    {
        if (!TryGetUserId(out var userId)) return Unauthorized();
        return Ok(sessions.GetForUser(userId).Select(ToSummary));
    }

    [HttpGet("sessions/{sessionId}/manifest")]
    public ActionResult<SessionManifest> GetManifest(string sessionId)
    {
        if (!TryGetSession(sessionId, out var session, out var failure)) return failure!;
        return Ok(new SessionManifest(
            session!.SessionId, session.ItemId, session.ItemName, session.MediaSourceId, session.RuntimeMs,
            session.PositionMs, session.IsPaused, session.ActiveSubtitleStreamIndex, session.ActiveAudioStreamIndex,
            session.SubtitleTracks.Select(ToTrack).ToList(), session.LastReportedAtUtc, session.StateVersion));
    }

    [HttpGet("sessions/{sessionId}/state")]
    public ActionResult<PlaybackStateResponse> GetState(string sessionId)
    {
        if (!TryGetSession(sessionId, out var session, out var failure)) return failure!;
        return Ok(new PlaybackStateResponse(
            session!.SessionId, session.ItemId, session.MediaSourceId, session.PositionMs, session.IsPaused,
            session.ActiveSubtitleStreamIndex, session.ActiveAudioStreamIndex, DateTimeOffset.UtcNow, session.LastReportedAtUtc, session.StateVersion));
    }

    [HttpGet("sessions/{sessionId}/subtitles/{streamIndex:int}")]
    public async Task<ActionResult<SubtitleCueResponse>> GetSubtitles(string sessionId, int streamIndex, CancellationToken cancellationToken)
    {
        if (!TryGetSession(sessionId, out var session, out var failure)) return failure!;
        if (session!.SubtitleTracks.All(x => x.Index != streamIndex)) return NotFound();
        try
        {
            var result = await subtitles.GetAsync(session, streamIndex, cancellationToken).ConfigureAwait(false);
            Response.Headers.ETag = result.ETag;
            Response.Headers.CacheControl = "private, max-age=300";
            if (Request.Headers.IfNoneMatch.Any(x => string.Equals(x, result.ETag, StringComparison.Ordinal)))
            {
                return StatusCode(StatusCodes.Status304NotModified);
            }

            return Ok(new SubtitleCueResponse(1, session.ItemId, session.MediaSourceId, streamIndex, result.Cues));
        }
        catch (SubtitleUnavailableException ex)
        {
            return UnprocessableEntity(new ApiError("subtitle_unavailable", ex.Message));
        }
        catch (Exception) when (!cancellationToken.IsCancellationRequested)
        {
            return UnprocessableEntity(new ApiError("subtitle_unavailable", "The subtitle track could not be loaded."));
        }
    }

    [HttpPost("sessions/{sessionId}/media/image")]
    public async Task<ActionResult<MediaResponse>> CreateImage(
        string sessionId,
        [FromBody] ImageMediaRequest request,
        CancellationToken cancellationToken)
    {
        if (!TryGetSession(sessionId, out var session, out var failure)) return failure!;
        try
        {
            return Ok(await media.CreateImageAsync(session!, request, cancellationToken).ConfigureAwait(false));
        }
        catch (MediaExtractionException ex)
        {
            return UnprocessableEntity(new ApiError(ex.Code, ex.Message));
        }
        catch (Exception) when (!cancellationToken.IsCancellationRequested)
        {
            return UnprocessableEntity(new ApiError("media_generation_failed", "The requested image could not be generated."));
        }
    }

    [HttpPost("sessions/{sessionId}/media/audio")]
    public async Task<ActionResult<MediaResponse>> CreateAudio(
        string sessionId,
        [FromBody] AudioMediaRequest request,
        CancellationToken cancellationToken)
    {
        if (!TryGetSession(sessionId, out var session, out var failure)) return failure!;
        try
        {
            return Ok(await media.CreateAudioAsync(session!, request, cancellationToken).ConfigureAwait(false));
        }
        catch (MediaExtractionException ex)
        {
            return UnprocessableEntity(new ApiError(ex.Code, ex.Message));
        }
        catch (Exception) when (!cancellationToken.IsCancellationRequested)
        {
            return UnprocessableEntity(new ApiError("media_generation_failed", "The requested audio could not be generated."));
        }
    }

    private bool TryGetSession(string sessionId, out SessionSnapshot? session, out ActionResult? failure)
    {
        session = null;
        failure = null;
        if (!TryGetUserId(out var userId))
        {
            failure = Unauthorized();
            return false;
        }

        if (!sessions.TryGetForUser(userId, sessionId, out session))
        {
            failure = NotFound();
            return false;
        }

        return true;
    }

    private bool TryGetUserId(out Guid userId)
    {
        foreach (var type in new[] { "Jellyfin-UserId", ClaimTypes.NameIdentifier, "user_id" })
        {
            if (Guid.TryParse(User.FindFirstValue(type), out userId) && userId != Guid.Empty) return true;
        }
        userId = Guid.Empty;
        return false;
    }

    private static SessionSummary ToSummary(SessionSnapshot x)
        => new(x.SessionId, x.ItemId, x.ItemName, x.Client, x.DeviceName, x.PositionMs, x.IsPaused, x.ActiveSubtitleStreamIndex, x.ActiveAudioStreamIndex, x.LastReportedAtUtc, x.StateVersion);

    private static SubtitleTrack ToTrack(SubtitleTrackSource x)
        => new(x.Index, x.Language, x.DisplayTitle, x.Codec, x.IsExternal, x.IsDefault, x.IsForced);
}
