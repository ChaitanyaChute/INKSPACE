import { Tool } from "@/types/types";
import { getShapesFromDb } from "./get-shapes";
import { WS_URL } from "@/config";

interface Rect {
  type: "rect";
  x: number;
  y: number;
  width: number;
  height: number;
  color?: string;
}

interface Diamond {
  type: "diamond";
  x: number;
  y: number;
  width: number;
  height: number;
  color?: string;
}

interface Triangle {
  type: "triangle";
  x: number;
  y: number;
  width: number;
  height: number;
  color?: string;
}

interface Star {
  type: "star";
  centerX: number;
  centerY: number;
  outerRadius: number;
  color?: string;
}

interface Hexagon {
  type: "hexagon";
  centerX: number;
  centerY: number;
  radius: number;
  color?: string;
}

interface Pentagon {
  type: "pentagon";
  centerX: number;
  centerY: number;
  radius: number;
  color?: string;
}

interface Circle {
  type: "circle";
  centerX: number;
  centerY: number;
  radius: number;
  color?: string;
}

interface Line {
  type: "line";
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  color?: string;
}

interface Arrow {
  type: "arrow";
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  color?: string;
}

interface Pencil {
  type: "pencil";
  points: { x: number; y: number }[];
  color?: string;
}

interface Text {
  type: "text";
  x: number;
  y: number;
  text: string;
  color?: string;
}

export type Shape = (Rect | Diamond | Triangle | Star | Hexagon | Pentagon | Circle | Line | Arrow | Pencil | Text) & { id: string };

// Generate unique ID for shapes
const generateShapeId = () => {
  return `shape_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};

export default async function initDraw(
  canvas: HTMLCanvasElement,
  selectedTool: Tool,
  roomId: number,
  selectedColor: string = "#000000",
  onConnectionChange?: (status: "connected" | "reconnecting") => void
) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  let currentColor = selectedColor;

  let currentTool = selectedTool;
  let offsetX = 0;
  let offsetY = 0;
  let canvasOffsetX = 0;  // For panning with hand tool
  let canvasOffsetY = 0;  // For panning with hand tool

  const token = localStorage.getItem("token") || "";
  let isDestroyed = false;
  let reconnectTimeout: ReturnType<typeof setTimeout> | null = null;

  // handleSocketMessage is defined here so connectSocket can reference it.
  // It uses `shapes` and `redrawCanvas` via closure — those are initialised
  // before the first message can ever arrive (WebSocket only sends after join_room).
  const handleSocketMessage = (event: MessageEvent) => {
    try {
      const data = JSON.parse(event.data);
      
      console.log("%c[Draw WebSocket] <<<< Message received", "color: #00ff00; font-weight: bold", data);
      
      if (data.type === "draw") {
        let newShape: Shape = data.shapeData;
        console.log("%c[Draw WebSocket] ⭐ Received draw command from user:", "color: #ff6600; font-weight: bold", data.userId);
        console.log("  Shape type:", newShape?.type);
        console.log("  Shape data:", newShape);
        if (newShape && newShape.type) {
          // Ensure shape has an ID (for backwards compatibility)
          if (!newShape.id) {
            newShape = { ...newShape, id: generateShapeId() };
          }
          const beforeCount = shapes.length;
          shapes.push(newShape);
          console.log("%c[Draw WebSocket] ✅ Shape added to local array", "color: #00ff00", "Count:", beforeCount, "->", shapes.length);
          redrawCanvas();
          console.log("%c[Draw WebSocket] ✅ Canvas redrawn with new shape", "color: #00ff00");
        } else {
          console.warn("%c[Draw WebSocket] ❌ Invalid shape received:", "color: #ff0000", newShape);
        }
      } else if (data.type === "room_joined") {
        console.log("%c[Draw WebSocket] ✅ Successfully joined room:", "color: #00ff00", data.roomId);
      } else if (data.type === "delete_shapes") {
        console.log("%c[Draw WebSocket] 🗑️ Received delete_shapes command", "color: #ff6600; font-weight: bold", "Shape IDs:", data.shapeIds);
        // Delete shapes by IDs
        const idsToDelete = data.shapeIds || [];
        shapes = shapes.filter(shape => !idsToDelete.includes(shape.id));
        console.log("%c[Draw WebSocket] ✅ Shapes deleted, count:", "color: #00ff00", shapes.length);
        redrawCanvas();
      } else if (data.type === "clear_canvas") {
        console.log("%c[Draw WebSocket] 🗑️ Received clear_canvas command", "color: #ff6600; font-weight: bold");
        shapes = [];
        console.log("%c[Draw WebSocket] ✅ Canvas cleared", "color: #00ff00");
        redrawCanvas();
      } else if (data.type === "update_shape") {
        console.log("%c[Draw WebSocket] 🔄 Received update_shape command", "color: #ff6600; font-weight: bold", "Shape ID:", data.shapeId);
        const shapeId = data.shapeId;
        const updatedShape = data.shapeData;
        if (shapeId && updatedShape && updatedShape.type) {
          const shapeIndex = shapes.findIndex(s => s.id === shapeId);
          if (shapeIndex !== -1) {
            shapes[shapeIndex] = updatedShape;
            console.log("%c[Draw WebSocket] ✅ Shape updated:", "color: #00ff00", shapeId);
            redrawCanvas();
          } else {
            console.warn("%c[Draw WebSocket] ❌ Shape not found:", "color: #ff0000", shapeId);
          }
        }
      } else if (data.type === "delete_shape") {
        console.log("%c[Draw WebSocket] 🗑️ Received delete_shape command", "color: #ff6600; font-weight: bold", "Shape ID:", data.shapeId);
        const shapeId = data.shapeId;
        if (shapeId) {
          const shapeIndex = shapes.findIndex(s => s.id === shapeId);
          if (shapeIndex !== -1) {
            shapes.splice(shapeIndex, 1);
            console.log("%c[Draw WebSocket] ✅ Shape deleted:", "color: #00ff00", shapeId);
            redrawCanvas();
          }
        }
      } else if (data.type === "sync_shapes") {
        console.log("%c[Draw WebSocket] 🔄 Received sync_shapes (undo from peer)", "color: #ff6600; font-weight: bold", "Count:", data.shapes?.length);
        if (Array.isArray(data.shapes)) {
          shapes = data.shapes.filter((s: Shape) => s && s.type);
          redrawCanvas();
        }
      } else {
        console.log("[Draw WebSocket] Passing through message type:", data.type);
      }
    } catch (error) {
      console.error("%c[Draw WebSocket] ❌ Error parsing message:", "color: #ff0000", error, event.data);
    }
  };

  let socket: WebSocket;

  const connectSocket = () => {
    console.log(`%c[WebSocket] 🔌 CREATING new WebSocket connection`, "color: #ff9900; font-weight: bold");
    console.log(`[WebSocket] Initializing connection to ${WS_URL}`);
    console.log("[WebSocket] Token present:", !!token);

    socket = new WebSocket(`${WS_URL}?token=${token}`);

    socket.onopen = () => {
      if (reconnectTimeout) { clearTimeout(reconnectTimeout); reconnectTimeout = null; }
      console.log("%c[WebSocket] ✅ CONNECTED successfully", "color: #00ff00; font-size: 14px; font-weight: bold");
      onConnectionChange?.("connected");
      const joinMessage = { type: "join_room", roomId };
      console.log("%c[WebSocket] 📤 Sending join_room", "color: #0088ff; font-weight: bold", "roomId:", roomId);
      socket.send(JSON.stringify(joinMessage));
    };

    socket.addEventListener("message", handleSocketMessage);

    socket.onclose = (event) => {
      console.log("[WebSocket] DISCONNECTED. Code:", event.code, "Reason:", event.reason);
      if (!isDestroyed) {
        console.log("%c[WebSocket] 🔄 Connection lost — reconnecting in 3s...", "color: #ff9900; font-weight: bold");
        onConnectionChange?.("reconnecting");
        reconnectTimeout = setTimeout(connectSocket, 3000);
      }
    };

    socket.onerror = () => {
      // Errors are always followed by onclose which handles reconnect
    };
  };

  connectSocket();

  // NOW load shapes from database (async operation)
  let shapes: Shape[] = (await getShapesFromDb(roomId) as Shape[]).filter(s => s && s.type);
  // Ensure all shapes have IDs (migration for legacy shapes)
  shapes = shapes.map(shape => {
    if (!shape.id) {
      return { ...shape, id: generateShapeId() };
    }
    return shape;
  });
  console.log("[Canvas] Loaded existing shapes from database:", shapes.length);
  let history: Shape[][] = [JSON.parse(JSON.stringify(shapes))]; // Deep copy for history
  let historyIndex = 0;
  let isDrawing = false;
  let start = { x: 0, y: 0 };
  let selectedShapeId: string | null = null;
  let panStart = { x: 0, y: 0 };
  let eraserSelection: { start: { x: number; y: number }; end: { x: number; y: number } } | null = null;
  let textInput: { x: number; y: number; text: string; active: boolean; editingShapeId?: string } | null = null;
  let currentPencilPoints: { x: number; y: number }[] = [];
  let resizeHandle: string | null = null; // "tl", "tr", "bl", "br", "t", "r", "b", "l"
  let shapeBeforeResize: Shape | null = null;

  // Update cursor based on tool
  const updateCursor = () => {
    switch (currentTool) {
      case Tool.SELECTION:
        canvas.style.cursor = "default";
        break;
      case Tool.HAND:
        canvas.style.cursor = isDrawing ? "grabbing" : "grab";
        break;
      case Tool.ERASER:
        canvas.style.cursor = "crosshair";
        break;
      case Tool.TEXT:
        canvas.style.cursor = "text";
        break;
      default:
        canvas.style.cursor = "crosshair";
    }
  };

  updateCursor();

  // Helper function to confirm text input
  const confirmTextInput = () => {
    if (textInput && textInput.active && textInput.text.trim()) {
      if (textInput.editingShapeId) {
        // Editing existing text - update it
        const shapeIndex = shapes.findIndex(s => s.id === textInput.editingShapeId);
        if (shapeIndex !== -1) {
          const updatedShape = { ...shapes[shapeIndex], text: textInput.text } as Shape;
          shapes[shapeIndex] = updatedShape;
          saveToHistory();
          // Broadcast update
          if (socket.readyState === WebSocket.OPEN) {
            socket.send(JSON.stringify({
              type: "update_shape",
              roomId: roomId,
              shapeId: updatedShape.id,
              shapeData: updatedShape
            }));
          }
        }
      } else {
        // Creating new text
        const newShape: Shape = {
          type: "text",
          x: textInput.x,
          y: textInput.y,
          text: textInput.text,
          color: currentColor,
          id: generateShapeId()
        };
        shapes.push(newShape);
        saveToHistory();
        const drawMessage = {
          type: "draw",
          shapeType: "TEXT",
          roomId: roomId,
          shapeData: newShape
        };
        console.log("%c[WebSocket] 📤 SENDING text shape (auto-confirmed)", "color: #0088ff; font-weight: bold", drawMessage);
        if (socket.readyState === WebSocket.OPEN) {
          socket.send(JSON.stringify(drawMessage));
          console.log("%c[WebSocket] ✅ Text message sent successfully", "color: #00ff00");
        } else {
          console.error("%c[WebSocket] ❌ Cannot send text - connection not open!", "color: #ff0000", "State:", socket.readyState);
        }
      }
    }
    textInput = null;
    redrawCanvas();
  };

  // Get bounding box for any shape
  const getShapeBounds = (shape: Shape): { x: number; y: number; width: number; height: number } | null => {
    if (!shape || !shape.type) return null;
    
    switch (shape.type) {
      case "rect":
      case "diamond":
      case "triangle":
        return {
          x: Math.min(shape.x, shape.x + shape.width),
          y: Math.min(shape.y, shape.y + shape.height),
          width: Math.abs(shape.width),
          height: Math.abs(shape.height)
        };
      case "circle":
      case "star":
      case "hexagon":
      case "pentagon":
        const radius = shape.type === "star" ? shape.outerRadius : shape.radius;
        return {
          x: shape.centerX - radius,
          y: shape.centerY - radius,
          width: radius * 2,
          height: radius * 2
        };
      case "line":
      case "arrow":
        return {
          x: Math.min(shape.startX, shape.endX),
          y: Math.min(shape.startY, shape.endY),
          width: Math.abs(shape.endX - shape.startX),
          height: Math.abs(shape.endY - shape.startY)
        };
      case "text":
        ctx.font = "16px sans-serif"; // Set font before measuring
        const textWidth = ctx.measureText(shape.text || "").width;
        return {
          x: shape.x,
          y: shape.y - 16,
          width: textWidth,
          height: 16
        };
      case "pencil":
        if (!shape.points || shape.points.length === 0) return null;
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        shape.points.forEach(p => {
          minX = Math.min(minX, p.x);
          minY = Math.min(minY, p.y);
          maxX = Math.max(maxX, p.x);
          maxY = Math.max(maxY, p.y);
        });
        return {
          x: minX,
          y: minY,
          width: maxX - minX,
          height: maxY - minY
        };
      default:
        return null;
    }
  };

  // Draw resize handles around selected shape
  const drawResizeHandles = (bounds: { x: number; y: number; width: number; height: number }) => {
    const handleSize = 12; // Increased from 8px for easier clicking
    const handles = [
      { x: bounds.x, y: bounds.y, id: "tl" },
      { x: bounds.x + bounds.width / 2, y: bounds.y, id: "t" },
      { x: bounds.x + bounds.width, y: bounds.y, id: "tr" },
      { x: bounds.x + bounds.width, y: bounds.y + bounds.height / 2, id: "r" },
      { x: bounds.x + bounds.width, y: bounds.y + bounds.height, id: "br" },
      { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height, id: "b" },
      { x: bounds.x, y: bounds.y + bounds.height, id: "bl" },
      { x: bounds.x, y: bounds.y + bounds.height / 2, id: "l" },
    ];
    
    ctx.save();
    handles.forEach(handle => {
      // Draw shadow for better visibility
      ctx.shadowColor = "rgba(0, 0, 0, 0.3)";
      ctx.shadowBlur = 3;
      ctx.shadowOffsetX = 1;
      ctx.shadowOffsetY = 1;
      
      ctx.fillStyle = "#ffffff";
      ctx.strokeStyle = "#4F46E5";
      ctx.lineWidth = 2.5; // Slightly bolder border
      ctx.fillRect(handle.x - handleSize / 2, handle.y - handleSize / 2, handleSize, handleSize);
      ctx.strokeRect(handle.x - handleSize / 2, handle.y - handleSize / 2, handleSize, handleSize);
    });
    ctx.restore();
  };

  // Detect which resize handle is at the given point
  const getResizeHandleAtPoint = (x: number, y: number, bounds: { x: number; y: number; width: number; height: number }): string | null => {
    const handleSize = 12; // Match the visual size
    const tolerance = 10; // Increased from 4px for easier clicking (total hit area: 22px x 22px)
    
    // x and y are already adjusted from getMousePos
    const adjustedX = x;
    const adjustedY = y;
    
    const handles = [
      { x: bounds.x, y: bounds.y, id: "tl" },
      { x: bounds.x + bounds.width / 2, y: bounds.y, id: "t" },
      { x: bounds.x + bounds.width, y: bounds.y, id: "tr" },
      { x: bounds.x + bounds.width, y: bounds.y + bounds.height / 2, id: "r" },
      { x: bounds.x + bounds.width, y: bounds.y + bounds.height, id: "br" },
      { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height, id: "b" },
      { x: bounds.x, y: bounds.y + bounds.height, id: "bl" },
      { x: bounds.x, y: bounds.y + bounds.height / 2, id: "l" },
    ];
    
    for (const handle of handles) {
      if (Math.abs(adjustedX - handle.x) <= handleSize / 2 + tolerance && 
          Math.abs(adjustedY - handle.y) <= handleSize / 2 + tolerance) {
        return handle.id;
      }
    }
    
    return null;
  };

  const getMousePos = (e: MouseEvent) => {
    const rect = canvas.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left) - canvasOffsetX,
      y: (e.clientY - rect.top) - canvasOffsetY,
    };
  };

  const saveToHistory = () => {
    // Remove any future history if we're not at the end
    history = history.slice(0, historyIndex + 1);
    // Add current state
    history.push(JSON.parse(JSON.stringify(shapes)));
    historyIndex = history.length - 1;
    // Limit history to 50 states
    if (history.length > 50) {
      history.shift();
      historyIndex--;
    }
  };

  const undo = () => {
    if (historyIndex > 0) {
      historyIndex--;
      shapes = JSON.parse(JSON.stringify(history[historyIndex]));
      redrawCanvas();
      
      // Broadcast undo to other users and sync with database
      console.log("%c[WebSocket] 📤 SENDING undo/sync_shapes", "color: #0088ff; font-weight: bold");
      if (socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({
          type: "sync_shapes",
          roomId: roomId,
          shapes: shapes
        }));
        console.log("%c[WebSocket] ✅ Undo sync sent successfully", "color: #00ff00");
      }
    }
  };


  const drawShape = (shape: Shape) => {
    if (!shape || !shape.type) return;
    
    ctx.beginPath();
    ctx.lineWidth = 2;
    ctx.strokeStyle = shape.color || "#000000";
    ctx.fillStyle = "transparent";

    switch (shape.type) {
      case "rect":
        ctx.strokeRect(shape.x, shape.y, shape.width, shape.height);
        break;
      case "diamond":
        const centerX = shape.x + shape.width / 2;
        const centerY = shape.y + shape.height / 2;
        ctx.moveTo(centerX, shape.y);
        ctx.lineTo(shape.x + shape.width, centerY);
        ctx.lineTo(centerX, shape.y + shape.height);
        ctx.lineTo(shape.x, centerY);
        ctx.closePath();
        ctx.stroke();
        break;
      case "triangle":
        const triCenterX = shape.x + shape.width / 2;
        ctx.moveTo(triCenterX, shape.y);
        ctx.lineTo(shape.x + shape.width, shape.y + shape.height);
        ctx.lineTo(shape.x, shape.y + shape.height);
        ctx.closePath();
        ctx.stroke();
        break;
      case "star":
        const spikes = 5;
        const innerRadius = shape.outerRadius * 0.4;
        const step = Math.PI / spikes;
        ctx.moveTo(shape.centerX, shape.centerY - shape.outerRadius);
        for (let i = 0; i < spikes * 2; i++) {
          const radius = i % 2 === 0 ? shape.outerRadius : innerRadius;
          const angle = i * step - Math.PI / 2;
          ctx.lineTo(
            shape.centerX + Math.cos(angle) * radius,
            shape.centerY + Math.sin(angle) * radius
          );
        }
        ctx.closePath();
        ctx.stroke();
        break;
      case "hexagon":
        const hexSides = 6;
        ctx.moveTo(shape.centerX + shape.radius, shape.centerY);
        for (let i = 1; i <= hexSides; i++) {
          const angle = (Math.PI / 3) * i;
          ctx.lineTo(
            shape.centerX + shape.radius * Math.cos(angle),
            shape.centerY + shape.radius * Math.sin(angle)
          );
        }
        ctx.closePath();
        ctx.stroke();
        break;
      case "pentagon":
        const pentSides = 5;
        const pentAngle = (Math.PI * 2) / pentSides;
        ctx.moveTo(
          shape.centerX + shape.radius * Math.cos(-Math.PI / 2),
          shape.centerY + shape.radius * Math.sin(-Math.PI / 2)
        );
        for (let i = 1; i <= pentSides; i++) {
          const angle = (pentAngle * i) - Math.PI / 2;
          ctx.lineTo(
            shape.centerX + shape.radius * Math.cos(angle),
            shape.centerY + shape.radius * Math.sin(angle)
          );
        }
        ctx.closePath();
        ctx.stroke();
        break;
      case "circle":
        ctx.arc(shape.centerX, shape.centerY, shape.radius, 0, Math.PI * 2);
        ctx.stroke();
        break;
      case "line":
        ctx.moveTo(shape.startX, shape.startY);
        ctx.lineTo(shape.endX, shape.endY);
        ctx.stroke();
        break;
      case "arrow":
        // Draw line
        ctx.moveTo(shape.startX, shape.startY);
        ctx.lineTo(shape.endX, shape.endY);
        ctx.stroke();
        // Draw arrowhead
        const angle = Math.atan2(shape.endY - shape.startY, shape.endX - shape.startX);
        const arrowLength = 15;
        ctx.moveTo(shape.endX, shape.endY);
        ctx.lineTo(
          shape.endX - arrowLength * Math.cos(angle - Math.PI / 6),
          shape.endY - arrowLength * Math.sin(angle - Math.PI / 6)
        );
        ctx.moveTo(shape.endX, shape.endY);
        ctx.lineTo(
          shape.endX - arrowLength * Math.cos(angle + Math.PI / 6),
          shape.endY - arrowLength * Math.sin(angle + Math.PI / 6)
        );
        ctx.stroke();
        break;
      case "pencil":
        if (shape.points && Array.isArray(shape.points) && shape.points.length > 1) {
          ctx.moveTo(shape.points[0].x, shape.points[0].y);
          for (let i = 1; i < shape.points.length; i++) {
            if (shape.points[i]) {
              ctx.lineTo(shape.points[i].x, shape.points[i].y);
            }
          }
          ctx.stroke();
        }
        break;
      case "text":
        ctx.font = "16px sans-serif";
        ctx.fillStyle = shape.color || "#000000";
        if (shape.text) {
          ctx.fillText(shape.text, shape.x, shape.y);
        }
        break;
    }

    ctx.closePath();
  };

  const redrawCanvas = () => {
    ctx.save();
    ctx.clearRect(-canvasOffsetX, -canvasOffsetY, canvas.width + Math.abs(canvasOffsetX) * 2, canvas.height + Math.abs(canvasOffsetY) * 2);
    
    // Apply canvas transform for panning
    ctx.translate(canvasOffsetX, canvasOffsetY);
    
    shapes.forEach(drawShape);
    
    // Draw selection box and resize handles for selected shape
    if (selectedShapeId) {
      const selectedShape = shapes.find(s => s.id === selectedShapeId);
      if (selectedShape) {
        const bounds = getShapeBounds(selectedShape);
        if (bounds) {
          // Draw selection box outline
          ctx.save();
          ctx.strokeStyle = "#4F46E5";
          ctx.lineWidth = 2;
          ctx.setLineDash([5, 5]);
          ctx.strokeRect(bounds.x, bounds.y, bounds.width, bounds.height);
          ctx.setLineDash([]);
          ctx.restore();
          
          // Draw resize handles
          drawResizeHandles(bounds);
        }
      }
    }
    
    // Draw text input cursor if active
    if (textInput && textInput.active) {
      ctx.font = "16px sans-serif";
      ctx.fillStyle = currentColor;
      ctx.fillText(textInput.text, textInput.x, textInput.y);
      
      // Draw blinking cursor
      if (cursorVisible) {
        const textWidth = ctx.measureText(textInput.text).width;
        const cursorX = textInput.x + textWidth;
        ctx.strokeStyle = currentColor;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(cursorX, textInput.y - 12);
        ctx.lineTo(cursorX, textInput.y + 4);
        ctx.stroke();
        ctx.closePath();
      }
    }
    
    // Draw eraser selection rectangle
    if (eraserSelection && currentTool === Tool.ERASER) {
      ctx.strokeStyle = "rgba(255, 0, 0, 0.5)";
      ctx.fillStyle = "rgba(255, 0, 0, 0.1)";
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 5]);
      const width = eraserSelection.end.x - eraserSelection.start.x;
      const height = eraserSelection.end.y - eraserSelection.start.y;
      ctx.fillRect(eraserSelection.start.x, eraserSelection.start.y, width, height);
      ctx.strokeRect(eraserSelection.start.x, eraserSelection.start.y, width, height);
      ctx.setLineDash([]);
    }
    
    ctx.restore();
  };

  // Find shape at point (for selection/eraser) - improved for small shapes
  const findShapeAtPoint = (x: number, y: number): string | null => {
    // x and y are already adjusted from getMousePos
    const adjustedX = x;
    const adjustedY = y;
    
    const minClickTolerance = 8; // Minimum tolerance for small shapes
    
    for (let i = shapes.length - 1; i >= 0; i--) {
      const shape = shapes[i];
      if (!shape || !shape.type) continue;
      
      if (shape.type === "rect" || shape.type === "diamond" || shape.type === "triangle") {
        // Calculate tolerance based on shape size (minimum 8px for small shapes)
        const shapeSizeAvg = (Math.abs(shape.width) + Math.abs(shape.height)) / 2;
        const tolerance = Math.max(minClickTolerance, shapeSizeAvg * 0.1);
        
        // Check if click is within shape bounds + tolerance
        const minX = Math.min(shape.x, shape.x + shape.width) - tolerance;
        const maxX = Math.max(shape.x, shape.x + shape.width) + tolerance;
        const minY = Math.min(shape.y, shape.y + shape.height) - tolerance;
        const maxY = Math.max(shape.y, shape.y + shape.height) + tolerance;
        
        if (adjustedX >= minX && adjustedX <= maxX && adjustedY >= minY && adjustedY <= maxY) {
          return i;
        }
      } else if (shape.type === "circle" || shape.type === "star" || shape.type === "hexagon" || shape.type === "pentagon") {
        let centerX, centerY, radius;
        if (shape.type === "circle") {
          centerX = shape.centerX;
          centerY = shape.centerY;
          radius = shape.radius;
        } else if (shape.type === "star") {
          centerX = shape.centerX;
          centerY = shape.centerY;
          radius = shape.outerRadius;
        } else {
          centerX = shape.centerX;
          centerY = shape.centerY;
          radius = shape.radius;
        }
        const dist = Math.sqrt((adjustedX - centerX) ** 2 + (adjustedY - centerY) ** 2);
        const tolerance = Math.max(minClickTolerance, radius * 0.1);
        if (dist <= radius + tolerance) return shape.id;
      } else if (shape.type === "line" || shape.type === "arrow") {
        // Improved proximity check for lines
        const tolerance = Math.max(8, 5);
        const dx = shape.endX - shape.startX;
        const dy = shape.endY - shape.startY;
        const length = Math.sqrt(dx * dx + dy * dy);
        if (length === 0) {
          // Point line, check distance
          const dist = Math.sqrt((adjustedX - shape.startX) ** 2 + (adjustedY - shape.startY) ** 2);
          if (dist <= tolerance) return shape.id;
          continue;
        }
        const dot = ((adjustedX - shape.startX) * dx + (adjustedY - shape.startY) * dy) / (length * length);
        if (dot >= 0 && dot <= 1) {
          const projX = shape.startX + dot * dx;
          const projY = shape.startY + dot * dy;
          const dist = Math.sqrt((adjustedX - projX) ** 2 + (adjustedY - projY) ** 2);
          if (dist <= tolerance) return shape.id;
        } else {
          // Check distance to endpoints
          const distStart = Math.sqrt((adjustedX - shape.startX) ** 2 + (adjustedY - shape.startY) ** 2);
          const distEnd = Math.sqrt((adjustedX - shape.endX) ** 2 + (adjustedY - shape.endY) ** 2);
          if (distStart <= tolerance || distEnd <= tolerance) return shape.id;
        }
      } else if (shape.type === "text") {
        // Simple bounding box for text (approximate)
        ctx.font = "16px sans-serif"; // Set font before measuring
        const textWidth = ctx.measureText(shape.text || "").width;
        const textHeight = 16; // Font size
        const tolerance = minClickTolerance;
        if (adjustedX >= shape.x - tolerance && adjustedX <= shape.x + textWidth + tolerance && 
            adjustedY >= shape.y - textHeight - tolerance && adjustedY <= shape.y + tolerance) {
          return shape.id;
        }
      } else if (shape.type === "pencil") {
        // Check proximity to pencil points
        const tolerance = 12;
        if (shape.points && Array.isArray(shape.points)) {
          for (const point of shape.points) {
            const dist = Math.sqrt((adjustedX - point.x) ** 2 + (adjustedY - point.y) ** 2);
            if (dist <= tolerance) return shape.id;
          }
        }
      }
    }
    return null;
  };

  const handleMouseDown = (e: MouseEvent) => {
    start = getMousePos(e);
    
    console.log("[Mouse] MouseDown - Tool:", currentTool, "Position:", start);

    // Auto-confirm text input if clicking elsewhere
    if (textInput && textInput.active && currentTool !== Tool.TEXT) {
      confirmTextInput();
    }

    isDrawing = true;

    if (currentTool === Tool.SELECTION) {
      // First check if clicking on a resize handle
      if (selectedShapeId) {
        const selectedShape = shapes.find(s => s.id === selectedShapeId);
        if (selectedShape) {
          const bounds = getShapeBounds(selectedShape);
          if (bounds) {
            const handle = getResizeHandleAtPoint(start.x, start.y, bounds);
            if (handle) {
              resizeHandle = handle;
              shapeBeforeResize = JSON.parse(JSON.stringify(selectedShape)); // Deep copy
              return;
            }
          }
        }
      }
      
      // If not on resize handle, check if selecting a new shape
      const clickedShapeId = findShapeAtPoint(start.x, start.y);
      selectedShapeId = clickedShapeId;
      resizeHandle = null;
      if (selectedShapeId) {
        const shape = shapes.find(s => s.id === selectedShapeId);
        if (shape && (shape.type === "rect" || shape.type === "diamond" || shape.type === "triangle")) {
          panStart = { x: start.x - shape.x, y: start.y - shape.y };
        } else if (shape && (shape.type === "circle" || shape.type === "star" || shape.type === "hexagon" || shape.type === "pentagon")) {
          panStart = { x: start.x - shape.centerX, y: start.y - shape.centerY };
        } else if (shape && (shape.type === "text")) {
          panStart = { x: start.x - shape.x, y: start.y - shape.y };
        } else if (shape && (shape.type === "line" || shape.type === "arrow")) {
          // For lines, store the start point for calculating delta
          panStart = { x: start.x, y: start.y };
        } else if (shape && shape.type === "pencil") {
          // For pencil, store the start point for calculating delta
          panStart = { x: start.x, y: start.y };
        }
        redrawCanvas(); // Draw selection handles
      } else {
        redrawCanvas(); // Clear selection handles
      }
    } else if (currentTool === Tool.HAND) {
      panStart = { x: e.clientX, y: e.clientY };  // Store raw mouse coords for panning
      updateCursor();
    } else if (currentTool === Tool.ERASER) {
      // Start area selection for eraser
      eraserSelection = { start: start, end: start };
    } else if (currentTool === Tool.TEXT) {
      // Check if clicking on existing text to edit it
      const clickedShapeId = findShapeAtPoint(start.x, start.y);
      if (clickedShapeId) {
        const clickedShape = shapes.find(s => s.id === clickedShapeId);
        if (clickedShape && clickedShape.type === "text") {
          // Load existing text for editing
          textInput = { x: clickedShape.x, y: clickedShape.y, text: clickedShape.text, active: true, editingShapeId: clickedShape.id };
          isDrawing = false;
          redrawCanvas();
          return;
        }
      }
      // If not clicking on text, create new text input at click position
      textInput = { x: start.x, y: start.y, text: "", active: true };
      isDrawing = false; // Don't track as drawing
      redrawCanvas();
      return;
    } else if (currentTool === Tool.PENCIL) {
      currentPencilPoints = [start];
    }
  };

  const handleMouseMove = (e: MouseEvent) => {
    const { x, y } = getMousePos(e);

    if (!isDrawing) {
      // Update cursor on hover for selection tool
      if (currentTool === Tool.SELECTION) {
        if (selectedShapeId) {
          const selectedShape = shapes.find(s => s.id === selectedShapeId);
          if (selectedShape) {
            const bounds = getShapeBounds(selectedShape);
            if (bounds) {
              const handle = getResizeHandleAtPoint(x, y, bounds);
              if (handle) {
                // Set cursor based on handle position
                const cursors: { [key: string]: string } = {
                  tl: "nwse-resize", tr: "nesw-resize", bl: "nesw-resize", br: "nwse-resize",
                  t: "ns-resize", b: "ns-resize", l: "ew-resize", r: "ew-resize"
                };
                canvas.style.cursor = cursors[handle] || "default";
                return;
              }
            }
          }
        }
        const hoverId = findShapeAtPoint(x, y);
        canvas.style.cursor = hoverId ? "move" : "default";
      }
      return;
    }

    // Handle resizing
    if (currentTool === Tool.SELECTION && resizeHandle && selectedShapeId) {
      const shape = shapes.find(s => s.id === selectedShapeId);
      if (!shape || !shape.type) {
        resizeHandle = null;
        return;
      }
      
      // x and y are already adjusted from getMousePos
      const adjustedX = x;
      const adjustedY = y;
      
      // Resize based on shape type
      if (shape.type === "rect" || shape.type === "diamond" || shape.type === "triangle") {
        const origShape = shape as Rect | Diamond | Triangle;
        if (!shapeBeforeResize) return;
        const origBefore = shapeBeforeResize as Rect | Diamond | Triangle;
        
        switch (resizeHandle) {
          case "tl":
            origShape.x = adjustedX;
            origShape.y = adjustedY;
            origShape.width = origBefore.x + origBefore.width - adjustedX;
            origShape.height = origBefore.y + origBefore.height - adjustedY;
            break;
          case "tr":
            origShape.y = adjustedY;
            origShape.width = adjustedX - origBefore.x;
            origShape.height = origBefore.y + origBefore.height - adjustedY;
            break;
          case "bl":
            origShape.x = adjustedX;
            origShape.width = origBefore.x + origBefore.width - adjustedX;
            origShape.height = adjustedY - origBefore.y;
            break;
          case "br":
            origShape.width = adjustedX - origBefore.x;
            origShape.height = adjustedY - origBefore.y;
            break;
          case "t":
            origShape.y = adjustedY;
            origShape.height = origBefore.y + origBefore.height - adjustedY;
            break;
          case "b":
            origShape.height = adjustedY - origBefore.y;
            break;
          case "l":
            origShape.x = adjustedX;
            origShape.width = origBefore.x + origBefore.width - adjustedX;
            break;
          case "r":
            origShape.width = adjustedX - origBefore.x;
            break;
        }
      } else if (shape.type === "circle" || shape.type === "star" || shape.type === "hexagon" || shape.type === "pentagon") {
        if (!shapeBeforeResize) return;
        const origShape = shape as Circle | Star | Hexagon | Pentagon;
        
        let origCenterX, origCenterY, origRadius;
        if (shape.type === "circle") {
          origCenterX = (shape as Circle).centerX;
          origCenterY = (shape as Circle).centerY;
          origRadius = (shape as Circle).radius;
        } else if (shape.type === "star") {
          origCenterX = (shape as Star).centerX;
          origCenterY = (shape as Star).centerY;
          origRadius = (shape as Star).outerRadius;
        } else {
          origCenterX = (shape as Hexagon | Pentagon).centerX;
          origCenterY = (shape as Hexagon | Pentagon).centerY;
          origRadius = (shape as Hexagon | Pentagon).radius;
        }
        
        const dx = adjustedX - origCenterX;
        const dy = adjustedY - origCenterY;
        const newRadius = Math.sqrt(dx * dx + dy * dy);
        
        if (shape.type === "circle") {
          (shape as Circle).radius = Math.max(5, newRadius);
        } else if (shape.type === "star") {
          (shape as Star).outerRadius = Math.max(5, newRadius);
        } else {
          (shape as Hexagon | Pentagon).radius = Math.max(5, newRadius);
        }
      } else if (shape.type === "line" || shape.type === "arrow") {
        const origShape = shape as Line | Arrow;
        if (!shapeBeforeResize) return;
        const origBefore = shapeBeforeResize as Line | Arrow;
        
        if (resizeHandle === "tl" || resizeHandle === "l" || resizeHandle === "bl") {
          origShape.startX = adjustedX;
          origShape.startY = adjustedY;
        } else {
          origShape.endX = adjustedX;
          origShape.endY = adjustedY;
        }
      }
      
      redrawCanvas();
      return;
    }

    if (currentTool === Tool.SELECTION && selectedShapeId) {
      // Move selected shape
      const shape = shapes.find(s => s.id === selectedShapeId);
      if (!shape || !shape.type) {
        selectedShapeId = null;
        isDrawing = false;
        return;
      }
      
      if (shape.type === "rect" || shape.type === "diamond" || shape.type === "triangle") {
        shape.x = x - panStart.x;
        shape.y = y - panStart.y;
      } else if (shape.type === "circle" || shape.type === "star" || shape.type === "hexagon" || shape.type === "pentagon") {
        shape.centerX = x - panStart.x;
        shape.centerY = y - panStart.y;
      } else if (shape.type === "line" || shape.type === "arrow") {
        const dx = x - panStart.x;
        const dy = y - panStart.y;
        shape.startX += dx;
        shape.startY += dy;
        shape.endX += dx;
        shape.endY += dy;
        panStart = { x, y };
      } else if (shape.type === "text") {
        shape.x = x - panStart.x;
        shape.y = y - panStart.y;
      } else if (shape.type === "pencil" && shape.points && Array.isArray(shape.points)) {
        const dx = x - panStart.x;
        const dy = y - panStart.y;
        shape.points = shape.points.map(point => ({
          x: point.x + dx,
          y: point.y + dy
        }));
        panStart = { x, y };
      }
      redrawCanvas();
      return;
    }

    if (currentTool === Tool.HAND) {
      // Pan the canvas
      const rawX = e.clientX;
      const rawY = e.clientY;
      const dx = rawX - panStart.x;
      const dy = rawY - panStart.y;
      
      canvasOffsetX += dx;
      canvasOffsetY += dy;
      panStart = { x: rawX, y: rawY };
      
      redrawCanvas();
      return;
    }

    if (currentTool === Tool.ERASER) {
      // Update eraser selection area
      if (eraserSelection) {
        eraserSelection.end = { x, y };
        redrawCanvas();
      }
      return;
    }

    const width = x - start.x;
    const height = y - start.y;

    redrawCanvas();

    ctx.beginPath();
    // Convert hex color to rgba with opacity for preview
    const hexToRgba = (hex: string, alpha: number) => {
      const r = parseInt(hex.slice(1, 3), 16);
      const g = parseInt(hex.slice(3, 5), 16);
      const b = parseInt(hex.slice(5, 7), 16);
      return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    };
    ctx.strokeStyle = hexToRgba(currentColor, 0.5);
    ctx.lineWidth = 1;
    ctx.setLineDash([5, 5]);

    switch (currentTool) {
      case Tool.RECT:
        ctx.strokeRect(start.x, start.y, width, height);
        break;
      case Tool.DIAMOND:
        const centerX = start.x + width / 2;
        const centerY = start.y + height / 2;
        ctx.moveTo(centerX, start.y);
        ctx.lineTo(start.x + width, centerY);
        ctx.lineTo(centerX, start.y + height);
        ctx.lineTo(start.x, centerY);
        ctx.closePath();
        ctx.stroke();
        break;
      case Tool.CIRCLE:
        const radius = Math.sqrt(width * width + height * height);
        ctx.arc(start.x, start.y, radius, 0, Math.PI * 2);
        ctx.stroke();
        break;
      case Tool.LINE:
      case Tool.ARROW:
        ctx.moveTo(start.x, start.y);
        ctx.lineTo(x, y);
        ctx.stroke();
        break;
      case Tool.PENCIL:
        currentPencilPoints.push({ x, y });
        if (currentPencilPoints.length > 1) {
          ctx.strokeStyle = currentColor;
          ctx.lineWidth = 2;
          ctx.setLineDash([]);
          ctx.moveTo(currentPencilPoints[currentPencilPoints.length - 2].x, currentPencilPoints[currentPencilPoints.length - 2].y);
          ctx.lineTo(x, y);
          ctx.stroke();
        }
        break;
    }

    ctx.setLineDash([]);
    ctx.closePath();
  };

  const handleMouseUp = (e: MouseEvent) => {
    console.log("[Mouse] MouseUp - isDrawing:", isDrawing, "currentTool:", currentTool);
    
    if (!isDrawing) return;

    // Handle resize completion
    if (currentTool === Tool.SELECTION && resizeHandle && selectedShapeId) {
      const shape = shapes.find(s => s.id === selectedShapeId);
      if (shape) {
        // Save to history
        saveToHistory();
        
        // Broadcast shape update via WebSocket
        console.log("%c[WebSocket] 📤 SENDING shape update (resize)", "color: #0088ff; font-weight: bold", shape);
        if (socket.readyState === WebSocket.OPEN) {
          socket.send(JSON.stringify({
            type: "update_shape",
            roomId: roomId,
            shapeId: shape.id,
            shapeData: shape
          }));
          console.log("%c[WebSocket] ✅ Resize update sent successfully", "color: #00ff00");
        }
      }
      resizeHandle = null;
      shapeBeforeResize = null;
      isDrawing = false;
      redrawCanvas();
      return;
    }

    if (currentTool === Tool.SELECTION) {
      if (selectedShapeId) {
        const shape = shapes.find(s => s.id === selectedShapeId);
        // Only send update if the shape actually moved or was resized
        if (shape && panStart && isDrawing) {
          // Save to history after moving a shape
          saveToHistory();
          
          // Broadcast shape update via WebSocket
          console.log("%c[WebSocket] 📤 SENDING shape update (move)", "color: #0088ff; font-weight: bold", shape);
          if (socket.readyState === WebSocket.OPEN) {
            socket.send(JSON.stringify({
              type: "update_shape",
              roomId: roomId,
              shapeId: shape.id,
              shapeData: shape
            }));
            console.log("%c[WebSocket] ✅ Move update sent successfully", "color: #00ff00");
          }
        }
      }
      isDrawing = false;
      panStart = null; // Clear panStart to allow new selection
      redrawCanvas(); // Redraw with current selection
      console.log("[Mouse] Selection tool - mouseup complete");
      return;
    }

    if (currentTool === Tool.HAND) {
      isDrawing = false;
      updateCursor();
      console.log("[Mouse] Hand tool - exiting");
      return;
    }

    if (currentTool === Tool.ERASER) {
      isDrawing = false;
      
      // Delete all shapes within the selection area
      if (eraserSelection) {
        const minX = Math.min(eraserSelection.start.x, eraserSelection.end.x);
        const maxX = Math.max(eraserSelection.start.x, eraserSelection.end.x);
        const minY = Math.min(eraserSelection.start.y, eraserSelection.end.y);
        const maxY = Math.max(eraserSelection.start.y, eraserSelection.end.y);
        
        const shapesBeforeDelete = shapes.length;
        const idsToDelete: string[] = [];
        
        shapes.forEach((shape) => {
          if (!shape || !shape.type) return;
          
          let shouldDelete = false;
          // Check if shape intersects with selection rectangle
          if (shape.type === "rect" || shape.type === "diamond" || shape.type === "triangle") {
            shouldDelete = shape.x < maxX && shape.x + shape.width > minX &&
                          shape.y < maxY && shape.y + shape.height > minY;
          } else if (shape.type === "circle" || shape.type === "hexagon" || shape.type === "pentagon") {
            shouldDelete = shape.centerX - shape.radius < maxX && shape.centerX + shape.radius > minX &&
                          shape.centerY - shape.radius < maxY && shape.centerY + shape.radius > minY;
          } else if (shape.type === "star") {
            shouldDelete = shape.centerX - shape.outerRadius < maxX && shape.centerX + shape.outerRadius > minX &&
                          shape.centerY - shape.outerRadius < maxY && shape.centerY + shape.outerRadius > minY;
          } else if (shape.type === "line" || shape.type === "arrow") {
            const lineMinX = Math.min(shape.startX, shape.endX);
            const lineMaxX = Math.max(shape.startX, shape.endX);
            const lineMinY = Math.min(shape.startY, shape.endY);
            const lineMaxY = Math.max(shape.startY, shape.endY);
            shouldDelete = lineMinX < maxX && lineMaxX > minX &&
                          lineMinY < maxY && lineMaxY > minY;
          } else if (shape.type === "text") {
            shouldDelete = shape.x >= minX && shape.x <= maxX &&
                          shape.y >= minY && shape.y <= maxY;
          } else if (shape.type === "pencil" && shape.points && shape.points.length > 0) {
            shouldDelete = shape.points.some(p =>
              p.x >= minX && p.x <= maxX && p.y >= minY && p.y <= maxY
            );
          }
          
          if (shouldDelete) {
            idsToDelete.push(shape.id);
          }
        });
        
        if (idsToDelete.length > 0) {
          // Delete shapes by ID
          shapes = shapes.filter(shape => !idsToDelete.includes(shape.id));
          
          saveToHistory();
          redrawCanvas();
          
          // Send delete message via WebSocket
          console.log("%c[WebSocket] 📤 SENDING delete_shapes message", "color: #0088ff; font-weight: bold", "IDs:", idsToDelete);
          if (socket.readyState === WebSocket.OPEN) {
            socket.send(JSON.stringify({
              type: "delete_shapes",
              roomId: roomId,
              shapeIds: idsToDelete
            }));
            console.log("%c[WebSocket] ✅ Delete message sent", "color: #00ff00");
          }
        }
        
        eraserSelection = null;
      }
      return;
    }

    isDrawing = false;

    const { x, y } = getMousePos(e);
    const width = x - start.x;
    const height = y - start.y;

    console.log("[Mouse] Creating shape - Tool:", currentTool, "Start:", start, "End:", {x, y});

    let newShape: Shape | null = null;
    let shapeType = "";

    switch (currentTool) {
      case Tool.RECT:
        newShape = {
          type: "rect",
          x: start.x,
          y: start.y,
          width,
          height,
          color: currentColor,
          id: generateShapeId()
        };
        shapeType = "RECT";
        break;
      case Tool.DIAMOND:
        newShape = {
          type: "diamond",
          x: start.x,
          y: start.y,
          width,
          height,
          color: currentColor,
          id: generateShapeId()
        };
        shapeType = "DIAMOND";
        break;
      case Tool.TRIANGLE:
        newShape = {
          type: "triangle",
          x: start.x,
          y: start.y,
          width,
          height,
          color: currentColor,
          id: generateShapeId()
        };
        shapeType = "TRIANGLE";
        break;
      case Tool.STAR:
        const starRadius = Math.sqrt(width * width + height * height);
        newShape = {
          type: "star",
          centerX: start.x,
          centerY: start.y,
          outerRadius: starRadius,
          color: currentColor,
          id: generateShapeId()
        };
        shapeType = "STAR";
        break;
      case Tool.HEXAGON:
        const hexRadius = Math.sqrt(width * width + height * height);
        newShape = {
          type: "hexagon",
          centerX: start.x,
          centerY: start.y,
          radius: hexRadius,
          color: currentColor,
          id: generateShapeId()
        };
        shapeType = "HEXAGON";
        break;
      case Tool.PENTAGON:
        const pentRadius = Math.sqrt(width * width + height * height);
        newShape = {
          type: "pentagon",
          centerX: start.x,
          centerY: start.y,
          radius: pentRadius,
          color: currentColor,
          id: generateShapeId()
        };
        shapeType = "PENTAGON";
        break;
      case Tool.CIRCLE:
        const radius = Math.sqrt(width * width + height * height);
        newShape = {
          type: "circle",
          centerX: start.x,
          centerY: start.y,
          radius,
          color: currentColor,
          id: generateShapeId()
        };
        shapeType = "CIRCLE";
        break;
      case Tool.LINE:
        newShape = {
          type: "line",
          startX: start.x,
          startY: start.y,
          endX: x,
          endY: y,
          color: currentColor,
          id: generateShapeId()
        };
        shapeType = "LINE";
        break;
      case Tool.ARROW:
        newShape = {
          type: "arrow",
          startX: start.x,
          startY: start.y,
          endX: x,
          endY: y,
          color: currentColor,
          id: generateShapeId()
        };
        shapeType = "ARROW";
        break;
      case Tool.PENCIL:
        if (currentPencilPoints.length > 1) {
          newShape = {
            type: "pencil",
            points: [...currentPencilPoints],
            color: currentColor,
            id: generateShapeId()
          };
          shapeType = "PENCIL";
        }
        currentPencilPoints = [];
        break;
    }

    console.log("[Mouse] After switch - newShape:", newShape, "shapeType:", shapeType);

    if (newShape) {
      shapes.push(newShape);
      saveToHistory();
      const drawMessage = {
        type: "draw",
        shapeType: shapeType,
        roomId: roomId,
        shapeData: newShape
      };
      console.log("%c[WebSocket] 📤 SENDING draw message", "color: #0088ff; font-weight: bold");
      console.log("  - roomId:", roomId, "Type:", typeof roomId);
      console.log("  - shapeType:", drawMessage.shapeType);
      console.log("  - shape type:", newShape.type);
      console.log("  - shape data:", newShape);
      console.log("  - socket state:", socket.readyState, "(0=CONNECTING, 1=OPEN, 2=CLOSING, 3=CLOSED)");
      if (socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify(drawMessage));
        console.log("%c[WebSocket] ✅ Message sent successfully to server", "color: #00ff00; font-weight: bold");
      } else {
        console.error("%c[WebSocket] ❌ Cannot send - connection not open!", "color: #ff0000; font-weight: bold", "State:", socket.readyState);
      }
      redrawCanvas();
    }
  };

  canvas.addEventListener("mousedown", handleMouseDown);
  canvas.addEventListener("mousemove", handleMouseMove);
  canvas.addEventListener("mouseup", handleMouseUp);

  // Keyboard event handler for text input and undo/redo
  const handleKeyDown = (e: KeyboardEvent) => {
    // Text input handling - process first to prevent shortcuts while typing
    if (textInput && textInput.active) {
      // Allow Ctrl+Z and Ctrl+Y for text editing, but prevent tool shortcuts
      if (e.key === "Enter") {
        e.preventDefault();
        // Confirm text input
        confirmTextInput();
      } else if (e.key === "Escape") {
        e.preventDefault();
        // Cancel text input
        textInput = null;
        redrawCanvas();
      } else if (e.key === "Backspace") {
        e.preventDefault();
        // Delete character
        textInput.text = textInput.text.slice(0, -1);
        redrawCanvas();
      } else if (e.key.length === 1 && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        // Add character (only if not a control key)
        textInput.text += e.key;
        redrawCanvas();
      }
      return; // Don't process other shortcuts while typing
    }
    
    // Undo/Redo shortcuts (only when not typing)
    if (e.ctrlKey && e.key === "z" && !e.shiftKey) {
      e.preventDefault();
      undo();
      return;
    }
  };

  window.addEventListener("keydown", handleKeyDown);

  // Cursor blink animation for text input
  let cursorVisible = true;
  const cursorBlinkInterval = setInterval(() => {
    if (textInput && textInput.active) {
      cursorVisible = !cursorVisible;
      redrawCanvas();
    }
  }, 500);

  // Initial draw of existing shapes
  redrawCanvas();

  return {
    destroy: () => {
      console.log("%c[WebSocket] 🔌 DESTROYING connection and cleaning up", "color: #ff0000; font-weight: bold");
      isDestroyed = true;
      if (reconnectTimeout) { clearTimeout(reconnectTimeout); reconnectTimeout = null; }
      console.log("[WebSocket] Socket state before close:", socket.readyState);
      canvas.removeEventListener("mousedown", handleMouseDown);
      canvas.removeEventListener("mousemove", handleMouseMove);
      canvas.removeEventListener("mouseup", handleMouseUp);
      window.removeEventListener("keydown", handleKeyDown);
      clearInterval(cursorBlinkInterval);
      if (socket.readyState === WebSocket.OPEN) {
        console.log("[WebSocket] Sending leave_room before closing");
        socket.send(JSON.stringify({
          type: "leave_room",
          roomId: roomId
        }));
      }
      socket.close();
      console.log("[WebSocket] Socket closed");
    },
    clearCanvas: () => {
      shapes = [];
      saveToHistory();
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      // Send clear canvas message via WebSocket
      console.log("%c[WebSocket] 📤 SENDING clear_canvas message", "color: #0088ff; font-weight: bold");
      if (socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({
          type: "clear_canvas",
          roomId: roomId
        }));
        console.log("%c[WebSocket] ✅ Clear canvas message sent", "color: #00ff00");
      }
    },
    getExistingShapes: () => [...shapes],
    setTool: (tool: Tool) => {
      // Auto-confirm text input when switching tools
      if (textInput && textInput.active) {
        confirmTextInput();
      }
      currentTool = tool;
      selectedShapeId = null;
      eraserSelection = null; // Cancel eraser selection when switching tools
      updateCursor();
    },
    setColor: (color: string) => {
      currentColor = color;
    },
    getSocket: () => socket,
    redraw: () => redrawCanvas(),
    undo,
  };
}
