"use client";

import { useEffect, useRef, useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { ToastNotification } from "@/components/ui/toast-notification";
import { useRouter } from "next/navigation";
import Toolbar from "@/components/canvas/toolbar";
import Sidebar from "@/components/canvas/sidebar";
import ZoomControls from "@/components/canvas/zoom-controls";
import AdminMenu from "@/components/canvas/admin-menu";
import JoinNotificationPopup from "@/components/canvas/join-notification-popup";
import initDraw from "@/draw/index";
import { Tool } from "@/types/types";
import { Share2, Bell, Copy, Check, LogOut } from "lucide-react";
import axios from "axios";
import { API_URL, APP_URL } from "@/config";

interface JoinNotification {
  requestId: number;
  roomId: string;
  roomSlug: string;
  requester: {
    id: string;
    username: string;
    email: string;
  };
}

export default function RoomCanvas({ roomId }: { roomId: string }) {
  const [selectedTool, setSelectedTool] = useState<Tool>(Tool.SELECTION);
  const [selectedColor, setSelectedColor] = useState("#000000");
  const [backgroundColor, setBackgroundColor] = useState("#ffffff");
  const [zoom, setZoom] = useState(1);
  const [isAdmin, setIsAdmin] = useState(false);
  const [showAdminMenu, setShowAdminMenu] = useState(false);
  const [pendingRequestCount, setPendingRequestCount] = useState(0);
  const [socket, setSocket] = useState<WebSocket | null>(null);
  const { toast, showToast } = useToast();
  const [roomSlug, setRoomSlug] = useState<string>("");
  const [numericRoomId, setNumericRoomId] = useState<number | null>(null);
  const [joinNotification, setJoinNotification] = useState<JoinNotification | null>(null);
  const [adminMenuRefreshKey, setAdminMenuRefreshKey] = useState(0);
  const [wsStatus, setWsStatus] = useState<"connected" | "reconnecting">("connected");
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawRef = useRef<Awaited<ReturnType<typeof initDraw>> | null>(null);
  const router = useRouter();

  // Initialize draw engine once (not on resize)
  // Initialize draw engine once per room
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || numericRoomId === null) return;

    console.log("%c[Room Canvas] 🔄 Initializing draw for room", "color: #ff9900; font-weight: bold", "roomId:", numericRoomId);

    let isCancelled = false;

    const initCanvas = async () => {
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width;
      canvas.height = rect.height;

      console.log("[Room Canvas] Initializing draw with numeric room ID:", numericRoomId);
      const drawInstance = await initDraw(canvas, selectedTool, numericRoomId, selectedColor, setWsStatus);
      console.log("%c[Room Canvas] initDraw completed", "color: #00ff00", "isCancelled:", isCancelled);

      if (!isCancelled && drawInstance) {
        drawRef.current = drawInstance;
        if (drawInstance.getSocket) {
          setSocket(drawInstance.getSocket());
        }
      } else {
        console.log("%c[Room Canvas] ⚠️  Calling destroy because", "color: #ff6600", "isCancelled:", isCancelled, "hasInstance:", !!drawInstance);
        drawInstance?.destroy?.();
      }
    };

    initCanvas();

    return () => {
      console.log("%c[Room Canvas] 🧹 CLEANUP running", "color: #ff0000; font-weight: bold", "roomId:", numericRoomId);
      isCancelled = true;
      drawRef.current?.destroy?.();
      drawRef.current = null;
    };
  }, [numericRoomId]); // Only re-initialize when room changes

  // Update tool without destroying connection
  useEffect(() => {
    if (drawRef.current?.setTool) {
      console.log("[Room Canvas] Updating tool to:", selectedTool);
      drawRef.current.setTool(selectedTool);
    }
  }, [selectedTool]);

  // Handle canvas resize without destroying the draw engine
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let resizeTimeout: NodeJS.Timeout;
    const handleResize = () => {
      clearTimeout(resizeTimeout);
      resizeTimeout = setTimeout(() => {
        const rect = canvas.getBoundingClientRect();
        canvas.width = rect.width;
        canvas.height = rect.height;
        // Redraw existing shapes after resize
        if (drawRef.current?.redraw) {
          drawRef.current.redraw();
        }
      }, 100);
    };

    window.addEventListener("resize", handleResize);
    return () => {
      clearTimeout(resizeTimeout);
      window.removeEventListener("resize", handleResize);
    };
  }, []);

  // Update drawing color when selectedColor changes
  useEffect(() => {
    if (drawRef.current?.setColor) {
      drawRef.current.setColor(selectedColor);
    }
  }, [selectedColor]);

  // Check if current user is admin
  useEffect(() => {
    const checkAdmin = async () => {
      const token = localStorage.getItem("token");
      if (!token) return;

      try {
        console.log("[Room Canvas] Checking admin status for room:", roomId);
        const res = await axios.get(
          `${API_URL}/room/${roomId}`,
          {
            headers: {
              Authorization: `Bearer ${token}`
            }
          }
        );

        if (res.data.room) {
          // Decode token to get current userId
          const payload = JSON.parse(atob(token.split('.')[1]));
          const isUserAdmin = res.data.room.adminId === payload.userId;
          console.log("[Room Canvas] Room data fetched:", {
            numericId: res.data.room.id,
            slug: res.data.room.slug,
            roomAdminId: res.data.room.adminId,
            currentUserId: payload.userId,
            isAdmin: isUserAdmin
          });
          setNumericRoomId(res.data.room.id);
          setIsAdmin(isUserAdmin);
          setRoomSlug(res.data.room.slug);
          // Set background color from room data
          if (res.data.room.backgroundColor) {
            setBackgroundColor(res.data.room.backgroundColor);
          }
        }
      } catch (error) {
        console.error("[Room Canvas] Error checking admin status:", error);
      }
    };

    checkAdmin();
  }, [roomId]);

  // Listen for join request notifications and background changes
  useEffect(() => {
    if (!socket) {
      console.log("[Room Canvas] Socket not available yet");
      return;
    }

    console.log("[Room Canvas] Setting up message handler. isAdmin:", isAdmin, "roomSlug:", roomSlug);

    const handleMessage = (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data);
        console.log("[Room Canvas] WebSocket message received:", data);
        console.log("[Room Canvas] Current isAdmin:", isAdmin);
        
        if (data.type === "join_request") {
          console.log("[Room Canvas] Join request received. isAdmin check:", isAdmin);
          if (isAdmin) {
            console.log("[Room Canvas] Admin confirmed, showing notification");
            console.log("[Room Canvas] Notification data - roomId:", data.roomId, "requestId:", data.requestId);
            setPendingRequestCount(prev => prev + 1);
            // Show real-time popup notification
            setJoinNotification({
              requestId: data.requestId,
              roomId: data.roomId,
              roomSlug: data.roomId, // Use the requested room ID, not admin's current room
              requester: data.requester
            });
            console.log("[Room Canvas] Notification popup displayed for room:", data.roomId);
          } else {
            console.log("[Room Canvas] Not admin, ignoring join request");
          }
        }
        
        if (data.type === "background_changed") {
          setBackgroundColor(data.backgroundColor);
          showToast("Background color updated");
        }
      } catch (error) {
        console.error("[Room Canvas] Error parsing WebSocket message:", error);
      }
    };

    socket.addEventListener("message", handleMessage);
    console.log("[Room Canvas] Message handler registered");

    return () => {
      socket.removeEventListener("message", handleMessage);
      console.log("[Room Canvas] Message handler removed");
    };
  }, [socket, isAdmin, roomSlug, showToast]);

  // Listen for being removed from room
  useEffect(() => {
    if (!socket) return;

    const handleMessage = (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data);
        
        console.log("[Room Canvas] Checking removal - data.type:", data.type, "data.roomId:", data.roomId, "current numericRoomId:", numericRoomId);
        
        if (data.type === "removed_from_room" && String(data.roomId) === String(numericRoomId)) {
          console.log("[Room Canvas] User removed from room, redirecting to dashboard");
          showToast("You have been removed from this room.");
          setTimeout(() => router.push("/dashboard"), 1500);
        }

        if (data.type === "room_deleted" && String(data.roomId) === String(numericRoomId)) {
          console.log("[Room Canvas] Room has been deleted, redirecting to dashboard");
          showToast("This room has been deleted.");
          setTimeout(() => router.push("/dashboard"), 1500);
        }
      } catch (error) {
        console.error("Error parsing WebSocket message:", error);
      }
    };

    socket.addEventListener("message", handleMessage);

    return () => {
      socket.removeEventListener("message", handleMessage);
    };
  }, [socket, numericRoomId, router, showToast]);

  // Update tool when selectedTool changes
  useEffect(() => {
    if (drawRef.current?.setTool) {
      drawRef.current.setTool(selectedTool);
    }
  }, [selectedTool]);

  const handleApproveRequest = async (requestId: number, userId: string, notificationRoomId: string) => {
    const token = localStorage.getItem("token");
    if (!token) return;

    try {
      console.log("[Room Canvas] Approving request for room:", notificationRoomId);
      const res = await axios.post(
        `${API_URL}/api/v1/room/request/${requestId}/approve`,
        {},
        {
          headers: {
            Authorization: `Bearer ${token}`
          }
        }
      );

      if (res.data.success) {
        // Send WebSocket notification using the notification's room ID
        if (socket && socket.readyState === WebSocket.OPEN) {
          socket.send(JSON.stringify({
            type: "approve_request",
            requestId: requestId,
            requestUserId: userId,
            roomId: notificationRoomId
          }));
          console.log("[Room Canvas] Approval notification sent via WebSocket");

          // Broadcast member addition to all room members
          socket.send(JSON.stringify({
            type: "user_added",
            roomId: notificationRoomId,
            userId: userId,
            username: res.data.username
          }));
          console.log("[Room Canvas] Member addition broadcast sent via WebSocket");
        }
        
        setPendingRequestCount(prev => Math.max(0, prev - 1));
        setAdminMenuRefreshKey(k => k + 1);
        showToast(`Request approved`);
      }
    } catch (error) {
      console.error("Error approving request:", error);
      showToast("Failed to approve request", "error");
    }
  };

  const handleRejectRequest = async (requestId: number, userId: string, notificationRoomId: string) => {
    const token = localStorage.getItem("token");
    if (!token) return;

    try {
      console.log("[Room Canvas] Rejecting request for room:", notificationRoomId);
      const res = await axios.post(
        `${API_URL}/api/v1/room/request/${requestId}/reject`,
        {},
        {
          headers: {
            Authorization: `Bearer ${token}`
          }
        }
      );

      if (res.data.success) {
        // Send WebSocket notification
        if (socket && socket.readyState === WebSocket.OPEN) {
          socket.send(JSON.stringify({
            type: "reject_request",
            requestId: requestId,
            requestUserId: userId,
            roomId: notificationRoomId
          }));
          console.log("[Room Canvas] Rejection notification sent via WebSocket");
        }
        
        setPendingRequestCount(prev => Math.max(0, prev - 1));
        setAdminMenuRefreshKey(k => k + 1);
        showToast(`Request rejected`);
      }
    } catch (error) {
      console.error("Error rejecting request:", error);
      showToast("Failed to reject request", "error");
    }
  };

  const handleReset = () => {
    if (drawRef.current?.clearCanvas) {
      drawRef.current.clearCanvas();
    }
  };

  const handleExport = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    try {
      // Create a temporary canvas with background
      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = canvas.width;
      tempCanvas.height = canvas.height;
      const tempCtx = tempCanvas.getContext('2d');
      
      if (tempCtx) {
        // Fill with background color
        tempCtx.fillStyle = backgroundColor;
        tempCtx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);
        
        // Draw the canvas content on top
        tempCtx.drawImage(canvas, 0, 0);
        
        // Export as PNG
        tempCanvas.toBlob((blob) => {
          if (blob) {
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.download = `inkspace-${roomId}-${Date.now()}.png`;
            link.href = url;
            link.click();
            URL.revokeObjectURL(url);
            showToast('Image exported successfully!');
          }
        });
      }
    } catch (error) {
      console.error('Error exporting image:', error);
      showToast('Failed to export image', "error");
    }
  };

  const handleUndo = () => {
    if (drawRef.current?.undo) {
      drawRef.current.undo();
    }
  };


  const handleZoomIn = () => {
    setZoom((prev) => Math.min(prev + 0.1, 3));
  };

  const handleZoomOut = () => {
    setZoom((prev) => Math.max(prev - 0.1, 0.1));
  };

  const handleResetZoom = () => {
    setZoom(1);
  };

  const handleShare = () => {
    const shareUrl = `${APP_URL}/canvas/${roomSlug || roomId}`;
    navigator.clipboard.writeText(shareUrl).catch(() => {
      // Fallback for non-secure contexts
      const el = document.createElement("textarea");
      el.value = shareUrl;
      document.body.appendChild(el);
      el.select();
      document.execCommand("copy");
      document.body.removeChild(el);
    });
    showToast("Room link copied to clipboard!");
  };

  const handleBack = () => {
    router.push("/dashboard");
  };

  return (
    <div className="relative w-screen h-screen overflow-hidden" style={{ backgroundColor }}>
      {/* WebSocket reconnect banner */}
      {wsStatus === "reconnecting" && (
        <div className="absolute top-0 inset-x-0 z-50 flex items-center justify-center gap-2 bg-amber-500 text-white text-xs font-medium py-1.5 px-4">
          <span className="w-3 h-3 border-2 border-white/50 border-t-white rounded-full animate-spin flex-shrink-0" />
          Connection lost — reconnecting...
        </div>
      )}
      {/* Sidebar Menu */}
      <Sidebar
        backgroundColor={backgroundColor}
        setBackgroundColor={setBackgroundColor}
        onReset={handleReset}
        onExport={handleExport}
        roomId={roomId}
        socket={socket}
        isAdmin={isAdmin}
      />

      {/* Top Toolbar */}
      <Toolbar 
        selectedTool={selectedTool} 
        setSelectedTool={setSelectedTool}
        selectedColor={selectedColor}
        setSelectedColor={setSelectedColor}
        onUndo={handleUndo}
      />

      {/* Top-right action buttons */}
      <div className="absolute top-4 right-4 z-10 flex items-center gap-2">
        {isAdmin && (
          <button
            onClick={() => {
              setShowAdminMenu(true);
              setPendingRequestCount(0);
            }}
            className="relative flex items-center gap-2 px-3.5 py-2 bg-white/90 backdrop-blur-sm text-gray-700 rounded-xl shadow-md border border-gray-200/80 hover:bg-white hover:shadow-lg transition-all text-sm font-medium"
          >
            <Bell className="w-4 h-4" />
            <span className="hidden sm:inline">Manage</span>
            {pendingRequestCount > 0 && (
              <span className="absolute -top-1.5 -right-1.5 bg-red-500 text-white text-[10px] font-bold rounded-full w-5 h-5 flex items-center justify-center ring-2 ring-white">
                {pendingRequestCount}
              </span>
            )}
          </button>
        )}
        <button
          onClick={handleShare}
          className="flex items-center gap-2 px-3.5 py-2 bg-indigo-600 text-white rounded-xl shadow-md hover:bg-indigo-700 hover:shadow-lg transition-all text-sm font-medium"
        >
          <Share2 className="w-3.5 h-3.5" />
          Share
        </button>
      </div>

      {/* Admin Menu Modal */}
      {numericRoomId && (
        <AdminMenu
          roomId={String(numericRoomId)}
          isOpen={showAdminMenu}
          onClose={() => setShowAdminMenu(false)}
          socket={socket}
          refreshKey={adminMenuRefreshKey}
        />
      )}

      {/* Zoom Controls */}
      <ZoomControls
        zoom={zoom}
        onZoomIn={handleZoomIn}
        onZoomOut={handleZoomOut}
        onResetZoom={handleResetZoom}
      />

      {/* Canvas */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full"
        style={{ 
          transform: `scale(${zoom})`, 
          transformOrigin: "center",
        }}
      />

      {/* Room Info Badge */}
      <div className="absolute bottom-4 right-4 z-10 flex items-center gap-2 bg-white/90 backdrop-blur-sm px-3 py-1.5 rounded-lg shadow-md border border-gray-200/80">
        <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
        <span className="text-xs text-gray-500 font-medium">Room</span>
        <span className="text-xs text-gray-800 font-mono font-bold">{roomId}</span>
      </div>

      {/* Toast Notification */}
      {toast && <ToastNotification message={toast.message} type={toast.type} />}

      {/* Join Request Notification Popup */}
      {joinNotification && (
        <JoinNotificationPopup
          notification={joinNotification}
          onApprove={handleApproveRequest}
          onReject={handleRejectRequest}
          onClose={() => setJoinNotification(null)}
        />
      )}
    </div>
  );
}

