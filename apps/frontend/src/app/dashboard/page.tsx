"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import axios from "axios";
import { API_URL, WS_URL } from "@/config";
import { Plus, ArrowRight, LogOut, Pen, Loader2, Hash, Clock, Users, Bell, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { ToastNotification } from "@/components/ui/toast-notification";

interface Room {
  id: number;
  slug: string;
  backgroundColor: string;
  createdAt: string;
  joinedAt: string;
  isAdmin: boolean;
  adminName: string;
  memberCount: number;
}

interface JoinRequest {
  roomId: string;
  requestId: number;
  requester: {
    id: string;
    username: string;
    email: string;
  };
}

export default function Dashboard() {
  const [roomName, setRoomName] = useState("");
  const [joinRoomId, setJoinRoomId] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [roomHistory, setRoomHistory] = useState<Room[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [socket, setSocket] = useState<WebSocket | null>(null);
  const [pendingRequestCount, setPendingRequestCount] = useState(0);
  const [notifications, setNotifications] = useState<JoinRequest[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [deletingRoomId, setDeletingRoomId] = useState<number | null>(null);
  const [confirmDeleteRoomId, setConfirmDeleteRoomId] = useState<number | null>(null);
  const { toast, showToast } = useToast();
  const router = useRouter();

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      router.push("/signin");
    } else {
      setIsAuthenticated(true);
    }
  }, [router]);

  // Fetch room history
  useEffect(() => {
    if (!isAuthenticated) return;

    const fetchRoomHistory = async () => {
      try {
        const token = localStorage.getItem("token");
        const response = await axios.get(`${API_URL}/api/v1/user/rooms`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (response.data.success) {
          setRoomHistory(response.data.rooms);
        }
      } catch (error) {
        console.error("Error fetching room history:", error);
      } finally {
        setLoadingHistory(false);
      }
    };

    fetchRoomHistory();
  }, [isAuthenticated]);

  // Fetch pending requests count
  useEffect(() => {
    if (!isAuthenticated) return;

    const fetchPendingCount = async () => {
      try {
        const token = localStorage.getItem("token");
        const response = await axios.get(`${API_URL}/api/v1/user/pending-requests-count`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (response.data.success) {
          setPendingRequestCount(response.data.totalPending);
        }
      } catch (error) {
        console.error("Error fetching pending count:", error);
      }
    };

    fetchPendingCount();
  }, [isAuthenticated]);

  // WebSocket connection for real-time notifications
  useEffect(() => {
    if (!isAuthenticated) return;

    const token = localStorage.getItem("token");
    if (!token) return;

    console.log("[Dashboard] Initializing WebSocket connection...");
    const ws = new WebSocket(`${WS_URL}?token=${token}`);

    ws.onopen = () => {
      console.log("[Dashboard] WebSocket connected");
      // Notify server that user is on dashboard
      ws.send(JSON.stringify({ type: "dashboard_connect" }));
      console.log("[Dashboard] Sent dashboard_connect message");
      setSocket(ws);
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        console.log("[Dashboard] WebSocket message received:", data);
        
        if (data.type === "join_request") {
          console.log("[Dashboard] Join request notification received:", data);
          // New join request received
          setPendingRequestCount(prev => prev + 1);
          
          // Add notification immediately
          setNotifications(prev => {
            // Check if notification already exists
            const exists = prev.some(n => n.requestId === data.requestId);
            if (exists) return prev;
            return [...prev, {
              roomId: data.roomId,
              requestId: data.requestId,
              requester: data.requester
            }];
          });
          
          console.log("[Dashboard] Notification added, showing panel");
          // Auto-show notifications panel
          setShowNotifications(true);
        }

        if (data.type === "room_deleted") {
          console.log("[Dashboard] Room deleted notification received:", data.roomId);
          // Remove room from history
          setRoomHistory(prev => prev.filter(room => room.id !== Number(data.roomId)));
        }
      } catch (error) {
        console.error("[Dashboard] Error parsing WebSocket message:", error);
      }
    };

    ws.onclose = () => {
      console.log("[Dashboard] WebSocket disconnected");
    };
    
    ws.onerror = (error) => {
      console.error("[Dashboard] WebSocket error:", error);
    };

    return () => {
      if (ws.readyState === WebSocket.OPEN) {
        console.log("[Dashboard] Disconnecting WebSocket...");
        ws.send(JSON.stringify({ type: "dashboard_disconnect" }));
        ws.close();
      }
    };
  }, [isAuthenticated]);

  // Polling fallback for pending join requests (in case WebSocket fails or admin was offline)
  useEffect(() => {
    if (!isAuthenticated) return;

    const fetchPendingRequests = async () => {
      try {
        const token = localStorage.getItem("token");
        const response = await axios.get(`${API_URL}/api/v1/user/pending-requests`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (response.data.success) {
          const requests = response.data.requests;
          console.log(`[Dashboard Polling] Fetched ${requests.length} pending requests`);
          
          // Update notifications state
          setNotifications(requests.map((req: any) => ({
            roomId: req.roomId,
            requestId: req.requestId,
            requester: req.requester
          })));
          
          // Update count
          setPendingRequestCount(requests.length);
        }
      } catch (error) {
        console.error("[Dashboard Polling] Error fetching pending requests:", error);
      }
    };

    // Fetch immediately on mount
    fetchPendingRequests();

    // Poll every 10 seconds
    const pollInterval = setInterval(fetchPendingRequests, 10000);

    return () => {
      clearInterval(pollInterval);
    };
  }, [isAuthenticated]);

  const handleCreateRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    
    if (!roomName.trim()) {
      setError("Room name is required");
      return;
    }

    setLoading(true);

    try {
      const token = localStorage.getItem("token");
      const response = await axios.post(
        `${API_URL}/room`,
        { name: roomName },
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      router.push(`/canvas/${response.data.roomId}`);
    } catch (error: any) {
      if (error.response?.data?.message) {
        setError(error.response.data.message);
      } else {
        setError("Failed to create room. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleJoinRoom = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!joinRoomId.trim()) {
      setError("Room ID is required");
      return;
    }

    router.push(`/canvas/${joinRoomId}`);
  };

  const handleLogout = () => {
    localStorage.removeItem("token");
    router.push("/");
  };

  const handleDeleteRoom = async (e: React.MouseEvent, roomId: number, roomSlug: string) => {
    e.stopPropagation();
    setConfirmDeleteRoomId(null);

    try {
      const token = localStorage.getItem("token");
      setDeletingRoomId(roomId);

      const response = await axios.delete(
        `${API_URL}/api/v1/room/${roomId}/delete`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (response.data.success) {
        if (socket && socket.readyState === WebSocket.OPEN) {
          socket.send(JSON.stringify({
            type: "room_deleted",
            roomId: roomId,
            memberIds: response.data.memberIds
          }));
          console.log("[Dashboard] Room deletion broadcast sent via WebSocket");
        }

        setRoomHistory(prev => prev.filter(room => room.id !== roomId));
        setError("");
        showToast(`Room "${roomSlug}" deleted`);
      }
    } catch (error: any) {
      console.error("Error deleting room:", error);
      setError(error.response?.data?.message || "Failed to delete room");
      showToast("Failed to delete room", "error");
    } finally {
      setDeletingRoomId(null);
    }
  };

  if (!isAuthenticated) {
    return null;
  }

  return (
    <div className="min-h-screen w-screen bg-[#0a0a0f] flex flex-col relative overflow-hidden">
      {/* Background effects */}
      <div className="absolute top-[-20%] left-[20%] w-[500px] h-[500px] rounded-full bg-indigo-600/6 blur-[120px]" />
      <div className="absolute bottom-[-10%] right-[10%] w-[400px] h-[400px] rounded-full bg-violet-600/5 blur-[120px]" />

      {/* Header */}
      <header className="relative z-10 flex items-center justify-between px-6 py-4 border-b border-white/[0.06]">
        <Link href="/" className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-indigo-600 flex items-center justify-center">
            <Pen className="w-3.5 h-3.5 text-white" />
          </div>
          <span className="text-lg font-bold text-white">Inkspace</span>
        </Link>
        <div className="flex items-center gap-2">
          {pendingRequestCount > 0 && (
            <button
              onClick={() => {
                console.log("[Dashboard] Notification bell clicked");
                console.log("[Dashboard] Current notifications:", notifications);
                setShowNotifications(!showNotifications);
              }}
              className="relative flex items-center gap-2 px-3 py-1.5 text-sm text-gray-400 hover:text-white bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.06] rounded-lg transition-all cursor-pointer"
            >
              <Bell className="w-3.5 h-3.5" />
              <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
                {pendingRequestCount}
              </span>
            </button>
          )}
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 px-3 py-1.5 text-sm text-gray-400 hover:text-white bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.06] rounded-lg transition-all"
          >
            <LogOut className="w-3.5 h-3.5" />
            Sign out
          </button>
        </div>
      </header>

      {/* Notifications Panel */}
      {showNotifications && (
        <div className="absolute top-16 right-6 z-20 w-80 bg-white/[0.08] backdrop-blur-xl border border-white/[0.12] rounded-2xl p-4 shadow-2xl">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-white">Join Requests</h3>
            <button
              onClick={() => setShowNotifications(false)}
              className="text-gray-400 hover:text-white text-xs"
            >
              Close
            </button>
          </div>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {notifications.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-4">No new join requests</p>
            ) : (
              notifications.map((notif, idx) => (
                <div
                  key={idx}
                  className="p-3 bg-white/[0.04] rounded-lg border border-white/[0.08]"
                >
                  <p className="text-sm text-white font-medium">{notif.requester.username}</p>
                  <p className="text-xs text-gray-400 mb-2">wants to join room {notif.roomId}</p>
                  <button
                    onClick={() => router.push(`/canvas/${notif.roomId}`)}
                    className="text-xs text-indigo-400 hover:text-indigo-300 underline"
                  >
                    Go to room →
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Main Content */}
      <main className="relative z-10 flex-1 flex flex-col items-center justify-start px-4 py-12 overflow-y-auto">
        <div className="max-w-4xl w-full animate-slide-up">
          <h1 className="text-3xl font-bold text-white mb-1 text-center">
            Your Workspace
          </h1>
          <p className="text-gray-500 text-center mb-8">
            Create a new canvas or join an existing room
          </p>

          {error && (
            <div className="mb-6 p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-300 text-sm flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-red-400 shrink-0" />
              {error}
            </div>
          )}

          <div className="grid gap-4 mb-8">
            {/* Create Room */}
            <div className="bg-white/[0.03] border border-white/[0.08] rounded-2xl p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-9 h-9 rounded-lg bg-indigo-500/10 flex items-center justify-center">
                  <Plus className="w-4 h-4 text-indigo-400" />
                </div>
                <div>
                  <h2 className="text-base font-semibold text-white">Create Room</h2>
                  <p className="text-xs text-gray-500">Start a new collaborative canvas</p>
                </div>
              </div>
              
              <form onSubmit={handleCreateRoom} className="flex gap-2">
                <input
                  type="text"
                  placeholder="Enter room name"
                  value={roomName}
                  onChange={(e) => setRoomName(e.target.value)}
                  className="flex-1 px-3.5 py-2.5 bg-white/[0.04] border border-white/[0.08] text-white rounded-xl text-sm placeholder:text-gray-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50 transition-all disabled:opacity-50"
                  disabled={loading}
                />
                <button
                  type="submit"
                  disabled={loading}
                  className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 rounded-xl text-white text-sm font-medium transition-all shadow-lg shadow-indigo-600/20 shrink-0"
                >
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                  Create
                </button>
              </form>
            </div>

            {/* Join Room */}
            <div className="bg-white/[0.03] border border-white/[0.08] rounded-2xl p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-9 h-9 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                  <Hash className="w-4 h-4 text-emerald-400" />
                </div>
                <div>
                  <h2 className="text-base font-semibold text-white">Join Room</h2>
                  <p className="text-xs text-gray-500">Enter room name or numeric ID (e.g., "myroom" or "6")</p>
                </div>
              </div>
              
              <form onSubmit={handleJoinRoom} className="flex gap-2">
                <input
                  type="text"
                  placeholder="Enter room name or ID"
                  value={joinRoomId}
                  onChange={(e) => setJoinRoomId(e.target.value)}
                  className="flex-1 px-3.5 py-2.5 bg-white/[0.04] border border-white/[0.08] text-white rounded-xl text-sm placeholder:text-gray-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50 transition-all"
                />
                <button
                  type="submit"
                  className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 rounded-xl text-white text-sm font-medium transition-all shadow-lg shadow-emerald-600/20 shrink-0"
                >
                  <ArrowRight className="w-4 h-4" />
                  Join
                </button>
              </form>
            </div>
          </div>

          {/* Room History */}
          <div className="mb-6">
            <div className="flex items-center gap-2 mb-4">
              <Clock className="w-5 h-5 text-gray-400" />
              <h2 className="text-xl font-bold text-white">Your Canvas History</h2>
            </div>
            
            {loadingHistory ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 text-indigo-400 animate-spin" />
              </div>
            ) : roomHistory.length === 0 ? (
              <div className="bg-white/[0.02] border border-white/[0.05] rounded-xl p-8 text-center">
                <p className="text-gray-500 text-sm">No canvas history yet. Create or join a room to get started!</p>
              </div>
            ) : (
              <div className="grid gap-3">
                {roomHistory.map((room) => (
                  <div
                    key={room.id}
                    className="w-full bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.08] hover:border-white/[0.12] rounded-xl p-4 transition-all group"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <button
                        onClick={() => router.push(`/canvas/${room.id}`)}
                        className="flex-1 text-left"
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="text-white font-semibold">{room.slug}</h3>
                          {room.isAdmin && (
                            <span className="px-2 py-0.5 bg-indigo-500/20 text-indigo-300 text-[10px] font-medium rounded">
                              ADMIN
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-4 text-xs text-gray-500">
                          <span className="flex items-center gap-1">
                            <Users className="w-3 h-3" />
                            {room.memberCount} {room.memberCount === 1 ? 'member' : 'members'}
                          </span>
                          <span>By {room.adminName}</span>
                          <span>Joined {new Date(room.joinedAt).toLocaleDateString()}</span>
                        </div>
                      </button>
                      
                      <div className="flex items-center gap-2 shrink-0">
                        <div 
                          className="w-8 h-8 rounded-lg border-2 border-white/[0.15]"
                          style={{ backgroundColor: room.backgroundColor }}
                        />
                        {room.isAdmin && (
                          confirmDeleteRoomId === room.id ? (
                            <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                              <span className="text-xs text-gray-400">Delete?</span>
                              <button onClick={(e) => handleDeleteRoom(e, room.id, room.slug)} disabled={deletingRoomId === room.id} className="px-2 py-1 text-[10px] font-semibold text-white bg-red-600 hover:bg-red-700 rounded-md transition-all disabled:opacity-50">Yes</button>
                              <button onClick={(e) => { e.stopPropagation(); setConfirmDeleteRoomId(null); }} className="px-2 py-1 text-[10px] font-medium text-gray-400 hover:bg-white/10 rounded-md transition-all">No</button>
                            </div>
                          ) : (
                            <button
                              onClick={(e) => { e.stopPropagation(); setConfirmDeleteRoomId(room.id); }}
                              disabled={deletingRoomId === room.id}
                              className="p-2 text-gray-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-all disabled:opacity-50"
                              title="Delete room"
                            >
                              {deletingRoomId === room.id ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : (
                                <Trash2 className="w-4 h-4" />
                              )}
                            </button>
                          )
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Tip */}
          <div className="p-4 bg-white/[0.02] border border-white/[0.05] rounded-xl">
            <p className="text-xs text-gray-500 leading-relaxed">
              <span className="text-gray-400 font-medium">Tip:</span> Create a room and share its ID with your team to start collaborating in real-time. All drawing changes sync instantly.
            </p>
          </div>
        </div>
      </main>
      {toast && <ToastNotification message={toast.message} type={toast.type} />}
    </div>
  );
}
