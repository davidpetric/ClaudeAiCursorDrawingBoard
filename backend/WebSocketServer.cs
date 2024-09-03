using System;
using System.Collections.Concurrent;
using System.Net.WebSockets;
using System.Text;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;

public class WebSocketServer
{
    private readonly string _url;
    private readonly ConcurrentDictionary<string, ConcurrentDictionary<Guid, WebSocket>> _rooms;
    private readonly CancellationTokenSource _cancellationTokenSource;

    public WebSocketServer(string url)
    {
        _url = url;
        _rooms = new ConcurrentDictionary<string, ConcurrentDictionary<Guid, WebSocket>>();
        _cancellationTokenSource = new CancellationTokenSource();
    }

    public async Task StartAsync()
    {
        Console.WriteLine($"WebSocket server started at {_url}");
        // The actual WebSocket handling is now done in the middleware
    }

    public async Task HandleWebSocketConnection(
        string room,
        WebSocket webSocket,
        TaskCompletionSource<object> socketFinishedTcs
    )
    {
        Guid clientId = Guid.NewGuid();
        Console.WriteLine($"New WebSocket connection: Room {room}, Client {clientId}");

        _rooms
            .GetOrAdd(room, _ => new ConcurrentDictionary<Guid, WebSocket>())
            .TryAdd(clientId, webSocket);

        try
        {
            await ProcessWebSocketConnection(room, clientId, webSocket);
        }
        catch (Exception ex)
        {
            Console.WriteLine($"Error handling WebSocket connection: {ex.Message}");
            Console.WriteLine($"StackTrace: {ex.StackTrace}");
        }
        finally
        {
            await CleanupConnection(room, clientId, webSocket);
            socketFinishedTcs.SetResult(null);
        }
    }

    private async Task ProcessWebSocketConnection(string room, Guid clientId, WebSocket webSocket)
    {
        byte[] buffer = new byte[1024 * 4];

        try
        {
            while (
                webSocket.State == WebSocketState.Open
                && !_cancellationTokenSource.IsCancellationRequested
            )
            {
                WebSocketReceiveResult result = await webSocket.ReceiveAsync(
                    new ArraySegment<byte>(buffer),
                    _cancellationTokenSource.Token
                );

                if (result.MessageType == WebSocketMessageType.Text)
                {
                    string message = Encoding.UTF8.GetString(buffer, 0, result.Count);
                    Console.WriteLine($"Received from client {clientId} in room {room}: {message}");

                    await ProcessDrawingInput(room, clientId, message);
                }
                else if (result.MessageType == WebSocketMessageType.Close)
                {
                    Console.WriteLine(
                        $"Client {clientId} in room {room} requested close. CloseStatus: {result.CloseStatus}, CloseStatusDescription: {result.CloseStatusDescription}"
                    );
                    break;
                }
            }
        }
        catch (WebSocketException ex)
        {
            Console.WriteLine($"WebSocket error for client {clientId}: {ex.Message}");
            Console.WriteLine($"StackTrace: {ex.StackTrace}");
        }
        catch (OperationCanceledException)
        {
            Console.WriteLine("WebSocket operation cancelled");
        }
        catch (Exception ex)
        {
            Console.WriteLine($"Unexpected error for client {clientId}: {ex.Message}");
            Console.WriteLine($"StackTrace: {ex.StackTrace}");
        }
    }

    private async Task CleanupConnection(string room, Guid clientId, WebSocket webSocket)
    {
        if (_rooms.TryGetValue(room, out var clients))
        {
            clients.TryRemove(clientId, out _);
            if (clients.IsEmpty)
            {
                _rooms.TryRemove(room, out _);
            }
        }

        if (webSocket.State == WebSocketState.Open)
        {
            try
            {
                await webSocket.CloseAsync(
                    WebSocketCloseStatus.NormalClosure,
                    "Connection closed",
                    CancellationToken.None
                );
            }
            catch (WebSocketException ex)
            {
                Console.WriteLine($"Error closing WebSocket for client {clientId}: {ex.Message}");
            }
        }
    }

    private async Task ProcessDrawingInput(string room, Guid senderId, string message)
    {
        try
        {
            Console.WriteLine($"Received drawing input: {message}");
            var drawingInput = JsonSerializer.Deserialize<DrawingInput>(message);
            if (drawingInput != null)
            {
                if (drawingInput.Clear)
                {
                    await BroadcastToRoom(room, message, senderId);
                }
                else
                {
                    await BroadcastToRoom(room, message, senderId);
                }
            }
        }
        catch (JsonException ex)
        {
            Console.WriteLine($"Invalid drawing input received: {message}. Error: {ex.Message}");
        }
        catch (Exception ex)
        {
            Console.WriteLine($"Error processing drawing input: {ex.Message}");
        }
    }

    private async Task BroadcastToRoom(string room, string message, Guid? excludeClientId = null)
    {
        if (_rooms.TryGetValue(room, out var clients))
        {
            byte[] buffer = Encoding.UTF8.GetBytes(message);
            var tasks = clients
                .Where(client => client.Key != excludeClientId)
                .Select(async client =>
                {
                    try
                    {
                        if (client.Value.State == WebSocketState.Open)
                        {
                            await client.Value.SendAsync(
                                new ArraySegment<byte>(buffer),
                                WebSocketMessageType.Text,
                                true,
                                _cancellationTokenSource.Token
                            );
                        }
                    }
                    catch (WebSocketException ex)
                    {
                        Console.WriteLine($"Error sending to client {client.Key}: {ex.Message}");
                    }
                });

            await Task.WhenAll(tasks);
        }
    }

    public void Stop()
    {
        _cancellationTokenSource.Cancel();
        Console.WriteLine("WebSocket server stopped");
    }
}

public class DrawingInput
{
    public double? X { get; set; }
    public double? Y { get; set; }
    public bool IsDrawing { get; set; }
    public bool Clear { get; set; }
}
