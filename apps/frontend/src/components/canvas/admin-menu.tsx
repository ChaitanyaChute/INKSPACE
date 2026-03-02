"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import axios from "axios";
import { API_URL } from "@/config";
import { useToast } from "@/hooks/use-toast";
import { ToastNotification } from "@/components/ui/toast-notification";

interface JoinRequest {
  id: number;
  roomId: number;
  userId: string;
  status: string;
  createdAt: string;
  user: {
    id: string;
    username: string;
    email: string;
  };
}

interface Member {
  id: number;
  userId: string;
  username: string;
  email: string;
  joinedAt: string;
  isAdmin: boolean;
}

interface AdminMenuProps {
  roomId: string;
  isOpen: boolean;
  onClose: () => void;
  socket: WebSocket | null;
  refreshKey?: number;
}

export default function AdminMenu({ roomId, isOpen, onClose, socket, refreshKey }: AdminMenuProps) {
  const router = useRouter();
  const { toast, showToast } = useToast();
  const [activeTab, setActiveTab] = useState<"requests" | "members">("requests");
  const [joinRequests, setJoinRequests] = useState<JoinRequest[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(false);
  const [pendingRequestCount, setPendingRequestCount] = useState(0);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [confirmRemoveUserId, setConfirmRemoveUserId] = useState<string | null>(null);

  const fetchJoinRequests = async () => {
    const token = localStorage.getItem("token");
    if (!token) return;

    try {
      const res = await axios.get(
        `${API_URL}/api/v1/room/${roomId}/requests`,
        {
          headers: {
            Authorization: `Bearer ${token}`
          }
        }
      );

      if (res.data.success) {
        setJoinRequests(res.data.requests);
        setPendingRequestCount(res.data.requests.length);
      }
    } catch (error) {
      console.error("Error fetching join requests:", error);
    }
  };

  const fetchMembers = async () => {
    const token = localStorage.getItem("token");
    if (!token) return;

    try {
      const res = await axios.get(
        `${API_URL}/api/v1/room/${roomId}/members`,
        {
          headers: {
            Authorization: `Bearer ${token}`
          }
        }
      );

      if (res.data.success) {
        setMembers(res.data.members);
      }
    } catch (error) {
      console.error("Error fetching members:", error);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchJoinRequests();
      fetchMembers();
    }
  }, [isOpen, roomId, refreshKey]);

  useEffect(() => {
    if (!socket) return;

    const handleMessage = (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data);
        
        if (data.type === "join_request") {
          // New join request received
          fetchJoinRequests();
        } else if (data.type === "member_added" || data.type === "member_removed") {
          // Member list updated
          fetchMembers();
        }
      } catch (error) {
        console.error("Error parsing WebSocket message:", error);
      }
    };

    socket.addEventListener("message", handleMessage);

    return () => {
      socket.removeEventListener("message", handleMessage);
    };
  }, [socket]);

  const handleApprove = async (requestId: number, userId: string) => {
    const token = localStorage.getItem("token");
    if (!token) return;

    setLoading(true);
    try {
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
        // Optimistically remove from list immediately
        setJoinRequests(prev => prev.filter(r => r.id !== requestId));
        setPendingRequestCount(prev => Math.max(0, prev - 1));

        // Send WebSocket notification
        if (socket && socket.readyState === WebSocket.OPEN) {
          socket.send(JSON.stringify({
            type: "approve_request",
            requestId: requestId,
            requestUserId: userId,
            roomId: Number(roomId)
          }));
          socket.send(JSON.stringify({
            type: "user_added",
            roomId: Number(roomId),
            userId: userId,
            username: res.data.username
          }));
        }

        fetchMembers();
      }
    } catch (error) {
      console.error("Error approving request:", error);
      showToast("Failed to approve request", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleReject = async (requestId: number, userId: string) => {
    const token = localStorage.getItem("token");
    if (!token) return;

    setLoading(true);
    try {
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
        // Optimistically remove from list immediately
        setJoinRequests(prev => prev.filter(r => r.id !== requestId));
        setPendingRequestCount(prev => Math.max(0, prev - 1));

        // Send WebSocket notification
        if (socket && socket.readyState === WebSocket.OPEN) {
          socket.send(JSON.stringify({
            type: "reject_request",
            requestId: requestId,
            requestUserId: userId,
            roomId: Number(roomId)
          }));
        }
      }
    } catch (error) {
      console.error("Error rejecting request:", error);
      showToast("Failed to reject request", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveMember = async (userId: string) => {
    const token = localStorage.getItem("token");
    if (!token) return;

    setConfirmRemoveUserId(null);
    setLoading(true);
    try {
      const res = await axios.delete(
        `${API_URL}/api/v1/room/${roomId}/member/${userId}/remove`,
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
            type: "user_removed",
            roomId: Number(roomId),
            userId: userId
          }));
        }
        
        fetchMembers();
      }
    } catch (error) {
      console.error("Error removing member:", error);
      showToast("Failed to remove member", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteRoom = async () => {
    const token = localStorage.getItem("token");
    if (!token) return;

    setLoading(true);
    try {
      const res = await axios.delete(
        `${API_URL}/api/v1/room/${roomId}/delete`,
        {
          headers: {
            Authorization: `Bearer ${token}`
          }
        }
      );

      if (res.data.success) {
        // Send WebSocket notification to all members
        if (socket && socket.readyState === WebSocket.OPEN) {
          socket.send(JSON.stringify({
            type: "room_deleted",
            roomId: Number(roomId),
            memberIds: res.data.memberIds
          }));
          console.log("[Admin Menu] Room deletion broadcast sent via WebSocket");
        }

        // Redirect to dashboard
        showToast("Room deleted successfully");
        onClose();
        setTimeout(() => router.push("/dashboard"), 500);
      }
    } catch (error) {
      console.error("Error deleting room:", error);
      showToast("Failed to delete room", "error");
    } finally {
      setLoading(false);
      setShowDeleteConfirm(false);
    }
  };

  if (!isOpen) return null;

  return (
    <>
      {toast && <ToastNotification message={toast.message} type={toast.type} />}
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 animate-fade-in p-0 sm:p-4">
      <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl shadow-black/20 w-full sm:max-w-lg md:max-w-2xl max-h-[92vh] sm:max-h-[85vh] flex flex-col border border-gray-200/50 animate-slide-up">
        {/* Handle bar for mobile */}
        <div className="flex justify-center pt-3 pb-1 sm:hidden">
          <div className="w-10 h-1 bg-gray-200 rounded-full" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-3 sm:py-4 border-b border-gray-100">
          <h2 className="text-base sm:text-lg font-bold text-gray-900">Room Management</h2>
          <button
            onClick={onClose}
            className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-all"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-100 px-2">
          <button
            onClick={() => setActiveTab("requests")}
            className={`flex-1 px-3 sm:px-4 py-2.5 sm:py-3 text-xs sm:text-sm font-medium transition-colors relative ${
              activeTab === "requests"
                ? "text-indigo-600 border-b-2 border-indigo-500"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            Requests
            {pendingRequestCount > 0 && (
              <span className="ml-1.5 inline-flex items-center justify-center w-4 h-4 sm:w-5 sm:h-5 text-[9px] sm:text-[10px] font-bold text-white bg-red-500 rounded-full">
                {pendingRequestCount}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab("members")}
            className={`flex-1 px-3 sm:px-4 py-2.5 sm:py-3 text-xs sm:text-sm font-medium transition-colors ${
              activeTab === "members"
                ? "text-indigo-600 border-b-2 border-indigo-500"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            Members ({members.length})
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-5">
          {activeTab === "requests" ? (
            <div className="space-y-3">
              {joinRequests.length === 0 ? (
                <div className="text-center py-12">
                  <div className="w-12 h-12 mx-auto mb-3 bg-gray-100 rounded-full flex items-center justify-center">
                    <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                    </svg>
                  </div>
                  <p className="text-sm font-medium text-gray-500">No pending requests</p>
                </div>
              ) : (
                joinRequests.map((request) => (
                  <div key={request.id} className="bg-gray-50 rounded-xl p-3 sm:p-4 border border-gray-100 hover:border-indigo-100 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-gradient-to-br from-indigo-400 to-violet-500 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                        {request.user.username.charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="text-sm font-semibold text-gray-900 truncate">{request.user.username}</h3>
                        <p className="text-xs text-gray-400 truncate">{request.user.email}</p>
                      </div>
                      <div className="flex gap-1.5 flex-shrink-0">
                        <button
                          onClick={() => handleApprove(request.id, request.userId)}
                          disabled={loading}
                          className="px-2.5 sm:px-3 py-1.5 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 active:scale-95 transition-all disabled:opacity-50 text-xs font-semibold"
                        >
                          ✓ Accept
                        </button>
                        <button
                          onClick={() => handleReject(request.id, request.userId)}
                          disabled={loading}
                          className="px-2.5 sm:px-3 py-1.5 bg-gray-100 text-gray-600 rounded-lg hover:bg-red-50 hover:text-red-600 active:scale-95 transition-all disabled:opacity-50 text-xs font-semibold border border-gray-200"
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          ) : (
            <div className="space-y-2">
              {members.length === 0 ? (
                <div className="text-center py-12">
                  <p className="text-sm font-medium text-gray-500">No members</p>
                </div>
              ) : (
                members.map((member) => (
                  <div key={member.id} className="flex items-center gap-3 p-3 rounded-xl hover:bg-gray-50 transition-colors">
                    <div className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm flex-shrink-0 ${
                      member.isAdmin
                        ? "bg-gradient-to-br from-indigo-400 to-violet-500 text-white"
                        : "bg-gray-100 text-gray-600"
                    }`}>
                      {member.username.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <h3 className="text-sm font-medium text-gray-900 truncate">{member.username}</h3>
                        {member.isAdmin && (
                          <span className="px-1.5 py-0.5 bg-indigo-100 text-indigo-700 text-[10px] font-semibold rounded-md flex-shrink-0">
                            Admin
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-400 truncate">{member.email}</p>
                    </div>
                    {!member.isAdmin && (
                      confirmRemoveUserId === member.userId ? (
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs text-gray-500">Sure?</span>
                          <button onClick={() => handleRemoveMember(member.userId)} disabled={loading} className="px-2.5 py-1 text-xs font-semibold text-white bg-red-600 hover:bg-red-700 rounded-lg transition-all disabled:opacity-50">Yes</button>
                          <button onClick={() => setConfirmRemoveUserId(null)} disabled={loading} className="px-2.5 py-1 text-xs font-medium text-gray-500 hover:bg-gray-200 rounded-lg transition-all disabled:opacity-50">No</button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setConfirmRemoveUserId(member.userId)}
                          disabled={loading}
                          className="flex-shrink-0 px-2.5 py-1.5 text-xs font-medium text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all active:scale-95 disabled:opacity-50"
                        >
                          Remove
                        </button>
                      )
                    )}
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        {/* Danger Zone */}
        <div className="border-t border-gray-200 bg-gray-50/80 px-4 sm:px-6 py-3 sm:py-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-gray-900 mb-0.5">Danger Zone</h3>
              <p className="text-xs text-gray-500">Permanently delete this room and all its data</p>
            </div>
            {!showDeleteConfirm ? (
              <button
                onClick={() => setShowDeleteConfirm(true)}
                disabled={loading}
                className="px-4 py-2 text-sm font-medium text-red-600 hover:text-white hover:bg-red-600 border border-red-300 hover:border-red-600 rounded-lg transition-all disabled:opacity-50"
              >
                Delete Room
              </button>
            ) : (
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-600 mr-1">Are you sure?</span>
                <button
                  onClick={handleDeleteRoom}
                  disabled={loading}
                  className="px-3 py-1.5 text-xs font-semibold text-white bg-red-600 hover:bg-red-700 rounded-lg transition-all disabled:opacity-50"
                >
                  {loading ? "Deleting..." : "Confirm"}
                </button>
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  disabled={loading}
                  className="px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-200 rounded-lg transition-all disabled:opacity-50"
                >
                  Cancel
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
      </div>
    </>
  );
}
