using System;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Server.Kestrel.Core;

var builder = WebApplication.CreateBuilder(args);

// Add services to the container.
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

builder.WebHost.ConfigureKestrel(serverOptions =>
{
    serverOptions.Limits.KeepAliveTimeout = TimeSpan.FromSeconds(120);
    serverOptions.Limits.RequestHeadersTimeout = TimeSpan.FromSeconds(30);
});

var app = builder.Build();

// Configure the HTTP request pipeline.
if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

// Comment out HTTPS redirection for WebSocket to work on HTTP
// app.UseHttpsRedirection();

// ... (keep the existing weatherforecast endpoint)

// Start the WebSocket server
var cts = new CancellationTokenSource();
WebSocketServer webSocketServer = null;

app.Lifetime.ApplicationStarted.Register(() =>
{
    var serverUrl = app.Urls.FirstOrDefault(u => u.StartsWith("http:")) ?? "http://localhost:5000/";
    var uri = new Uri(serverUrl);
    string wsUrl = $"http://{uri.Host}:{uri.Port}/ws/";

    Console.WriteLine($"Starting WebSocket server at {wsUrl}");

    webSocketServer = new WebSocketServer(wsUrl);

    Task.Run(
        async () =>
        {
            try
            {
                await webSocketServer.StartAsync();
                Console.WriteLine("WebSocket server started successfully");
            }
            catch (Exception ex)
            {
                Console.WriteLine($"WebSocket server error: {ex.Message}");
            }
        },
        cts.Token
    );
});

app.Lifetime.ApplicationStopping.Register(() =>
{
    cts.Cancel();
    webSocketServer?.Stop();
});

// Add WebSocket middleware
app.UseWebSockets();

// Handle WebSocket requests
app.Map(
    "/ws",
    async context =>
    {
        if (context.WebSockets.IsWebSocketRequest)
        {
            using var webSocket = await context.WebSockets.AcceptWebSocketAsync();
            var socketFinishedTcs = new TaskCompletionSource<object>();

            webSocketServer.HandleWebSocketConnection(
                context.Request.Query["room"].ToString() ?? "default",
                webSocket,
                socketFinishedTcs
            );

            await socketFinishedTcs.Task;
        }
        else
        {
            context.Response.StatusCode = StatusCodes.Status400BadRequest;
        }
    }
);

app.Run();

// ... (keep the WeatherForecast record)
