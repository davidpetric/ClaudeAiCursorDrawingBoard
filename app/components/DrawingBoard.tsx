import React, { useRef, useEffect, useState, useCallback } from "react";
import { useWebSocket } from "../hooks/useWebSocket";

interface DrawingBoardProps {
  width: number;
  height: number;
  roomId: string;
}

interface DrawingPoint {
  x: number;
  y: number;
  isDrawing: boolean;
}

const DrawingBoard: React.FC<DrawingBoardProps> = ({
  width,
  height,
  roomId,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const { sendMessage, lastMessage, isConnected } = useWebSocket(roomId);
  const [drawingHistory, setDrawingHistory] = useState<DrawingPoint[]>([]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.lineJoin = "round";
        ctx.lineCap = "round";
        ctx.lineWidth = 2;
        ctx.strokeStyle = "black";
      }
    }
    loadDrawingFromLocalStorage();
  }, []);

  useEffect(() => {
    if (lastMessage) {
      console.log("Received message in DrawingBoard:", lastMessage);
      const { x, y, isDrawing } = lastMessage;
      drawOnCanvas(x, y, isDrawing);
      addToDrawingHistory(x, y, isDrawing);
    }
  }, [lastMessage]);

  const loadDrawingFromLocalStorage = useCallback(() => {
    const savedDrawing = localStorage.getItem(`drawing_${roomId}`);
    if (savedDrawing) {
      const parsedDrawing: DrawingPoint[] = JSON.parse(savedDrawing);
      setDrawingHistory(parsedDrawing);
      redrawCanvas(parsedDrawing);
    }
  }, [roomId]);

  const saveDrawingToLocalStorage = useCallback(() => {
    localStorage.setItem(`drawing_${roomId}`, JSON.stringify(drawingHistory));
  }, [drawingHistory, roomId]);

  const addToDrawingHistory = (
    x: number | null,
    y: number | null,
    isDrawing: boolean
  ) => {
    if (x !== null && y !== null) {
      setDrawingHistory((prev) => [...prev, { x, y, isDrawing }]);
    }
  };

  const redrawCanvas = (history: DrawingPoint[]) => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (ctx && canvas) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      history.forEach((point) =>
        drawOnCanvas(point.x, point.y, point.isDrawing)
      );
    }
  };

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement>) => {
    setIsDrawing(true);
    draw(e);
  };

  const stopDrawing = () => {
    setIsDrawing(false);
    sendMessage({ x: null, y: null, isDrawing: false });
    saveDrawingToLocalStorage();
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (canvas) {
      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      drawOnCanvas(x, y, isDrawing);
      addToDrawingHistory(x, y, isDrawing);
      if (isConnected) {
        sendMessage({ x, y, isDrawing });
      }
    }
  };

  const drawOnCanvas = (
    x: number | null,
    y: number | null,
    drawing: boolean
  ) => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (ctx && canvas) {
      if (drawing && x !== null && y !== null) {
        ctx.lineTo(x, y);
        ctx.stroke();
      } else {
        ctx.beginPath();
        if (x !== null && y !== null) {
          ctx.moveTo(x, y);
        }
      }
    }
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (ctx && canvas) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      setDrawingHistory([]);
      saveDrawingToLocalStorage();
      if (isConnected) {
        sendMessage({ clear: true });
      }
    }
  };

  return (
    <div>
      <div style={{ marginBottom: "10px" }}>
        WebSocket Status: {isConnected ? "Connected" : "Disconnected"}
      </div>
      <canvas
        ref={canvasRef}
        width={width}
        height={height}
        onMouseDown={startDrawing}
        onMouseUp={stopDrawing}
        onMouseOut={stopDrawing}
        onMouseMove={draw}
        style={{ border: "1px solid black" }}
      />
      <button onClick={clearCanvas}>Clear Canvas</button>
    </div>
  );
};

export default DrawingBoard;
