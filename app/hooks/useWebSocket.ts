import { useEffect, useRef, useState, useCallback } from "react";

export const useWebSocket = (roomId: string) => {
  const [lastMessage, setLastMessage] = useState<any>(null);
  const [isConnected, setIsConnected] = useState(false);
  const socketRef = useRef<WebSocket | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const maxRetries = 5;

  const onMessage = useCallback((event: MessageEvent) => {
    try {
      const data = JSON.parse(event.data);
      setLastMessage(data);
      console.log("Received message:", data);
    } catch (error) {
      console.error("Error parsing message:", error);
      setLastMessage(event.data); // Set the raw data if parsing fails
    }
  }, []);

  const connectWebSocket = useCallback(() => {
    const wsUrl = `ws://${window.location.hostname}:5000/ws/?room=${roomId}`;
    console.log(
      `Attempting to connect to WebSocket (Attempt ${retryCount + 1}):`,
      wsUrl
    );
    socketRef.current = new WebSocket(wsUrl);

    socketRef.current.onopen = () => {
      console.log("WebSocket connected successfully");
      setIsConnected(true);
      setRetryCount(0);
    };

    socketRef.current.onerror = (error) => {
      console.error("WebSocket connection error:", error);
      setIsConnected(false);
    };

    socketRef.current.onclose = (event) => {
      console.log(
        "WebSocket closed. Code:",
        event.code,
        "Reason:",
        event.reason
      );
      setIsConnected(false);
      if (retryCount < maxRetries) {
        console.log(
          `Retrying connection in 5 seconds... (Attempt ${retryCount + 1})`
        );
        setTimeout(() => {
          setRetryCount((prev) => prev + 1);
          connectWebSocket();
        }, 5000);
      } else {
        console.error(
          "Max retries reached. Unable to establish WebSocket connection."
        );
      }
    };

    socketRef.current.onmessage = onMessage;
  }, [roomId, onMessage, retryCount]);

  useEffect(() => {
    connectWebSocket();

    return () => {
      if (socketRef.current) {
        socketRef.current.close();
      }
    };
  }, [connectWebSocket]);

  const sendMessage = useCallback((message: any) => {
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      const jsonMessage = JSON.stringify(message);
      socketRef.current.send(jsonMessage);
      console.log("Message sent successfully:", jsonMessage);
    } else {
      console.error(
        "WebSocket is not open. ReadyState:",
        socketRef.current?.readyState
      );
    }
  }, []);

  return { sendMessage, lastMessage, isConnected };
};
