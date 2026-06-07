using MediaBrowser.Common.Configuration;
using MediaBrowser.Common.Plugins;
using MediaBrowser.Controller;
using MediaBrowser.Controller.Plugins;
using MediaBrowser.Model.Plugins;
using MediaBrowser.Model.Serialization;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;

namespace Jellyfin.Plugin.JellyfinMiner;

public sealed class Plugin : BasePlugin<BasePluginConfiguration>
{
    public Plugin(IApplicationPaths applicationPaths, IXmlSerializer xmlSerializer)
        : base(applicationPaths, xmlSerializer)
    {
    }

    public override string Name => "Jellyfin Miner";

    public override string Description => "Mining tool for Jellyfin";

    public override Guid Id => Guid.Parse("8e947a62-b5e1-4d6a-a70c-486996db901f");
}

public sealed class PluginServiceRegistrator : IPluginServiceRegistrator
{
    public void RegisterServices(IServiceCollection services, IServerApplicationHost applicationHost)
    {
        services.AddSingleton<Services.SubtitleService>();
        services.AddSingleton<Services.MediaExtractionService>();
        services.AddSingleton<Services.SessionMonitorService>();
        services.AddHostedService<SessionMonitorHostedService>();
    }
}

internal sealed class SessionMonitorHostedService(Services.SessionMonitorService monitor) : IHostedService
{
    public Task StartAsync(CancellationToken cancellationToken)
    {
        monitor.Start();
        return Task.CompletedTask;
    }

    public Task StopAsync(CancellationToken cancellationToken)
    {
        monitor.Stop();
        return Task.CompletedTask;
    }
}
