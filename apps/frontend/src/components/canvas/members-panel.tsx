"use client"

import { useEffect, useState } from "react";
import axios from "axios";
import { API_URL } from "@/config";
import { useToast } from "@/hooks/use-toast";
import { ToastNotification } from "@/components/ui/toast-notification";

interface Member {
  id: number;
  userId: string;
  username: string;
  email: string;
  joinedAt: string;
  isAdmin: boolean;
}

interface MembersPanelProps {
  roomId: number;
  socket: WebSocket | null;
  isAdmin: boolean;
  currentUserId: string;
  refreshTrigger?: number;
}

export function MembersPanel({ roomId, socket, isAdmin, currentUserId, refreshTrigger }: MembersPanelProps) {
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(false);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [searchEmail, setSearchEmail] = useState("");
  const [searchLoading, setSearchLoading] = useState(false);
  const [confirmRemoveUserId, setConfirmRemoveUserId] = useState<string | null>(null);
  const { toast, showToast } = useToast();

  const fetchMembers = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem("token");
      const response = await axios.get(
        `${API_URL}/api/v1/room/${roomId}/members`,
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );
      
      if (response.data.success) {
        setMembers(response.data.members);
      }
    } catch (error) {
      console.error("Error fetching members:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMembers();
  }, [roomId, refreshTrigger]);

  useEffect(() => {
    if (!socket) return;

    const handleMessage = (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data);
        
        if (data.type === "member_added" || data.type === "member_removed") {
          console.log("[Members] Member list changed, refreshing...");
          fetchMembers();
        }
      } catch (error) {
        console.error("Error parsing WebSocket message:", error);
      }
    };

    socket.addEventListener('message', handleMessage);
    return () => socket.removeEventListener('message', handleMessage);
  }, [socket]);

  const handleAddMember = async () => {
    if (!searchEmail.trim()) return;

    try {
      setSearchLoading(true);
      const token = localStorage.getItem("token");
      
      // First find user by email
      const searchResponse = await axios.get(
        `${API_URL}/api/v1/user/search?email=${encodeURIComponent(searchEmail)}`,
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );

      if (!searchResponse.data.user) {
        showToast("User not found", "error");
        return;
      }

      const targetUserId = searchResponse.data.user.id;

      // Add member
      const response = await axios.post(
        `${API_URL}/api/v1/room/${roomId}/member/${targetUserId}/add`,
        {},
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );

      if (response.data.success) {
        // Notify via WebSocket
        if (socket && socket.readyState === WebSocket.OPEN) {
          socket.send(JSON.stringify({
            type: "user_added",
            roomId: roomId,
            userId: targetUserId,
            username: searchResponse.data.user.username
          }));
        }
        
        fetchMembers();
        setSearchEmail("");
        setShowAddDialog(false);
      }
    } catch (error: any) {
      console.error("Error adding member:", error);
      showToast(error.response?.data?.message || "Failed to add member", "error");
    } finally {
      setSearchLoading(false);
    }
  };

  const handleRemoveMember = async (userId: string, username: string) => {
    setConfirmRemoveUserId(null);
    try {
      const token = localStorage.getItem("token");
      const response = await axios.delete(
        `${API_URL}/api/v1/room/${roomId}/member/${userId}/remove`,
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );

      if (response.data.success) {
        // Notify via WebSocket
        if (socket && socket.readyState === WebSocket.OPEN) {
          socket.send(JSON.stringify({
            type: "user_removed",
            roomId: Number(roomId),
            userId: userId
          }));
          console.log("[Members Panel] Member removal broadcast sent via WebSocket");
        }
        
        fetchMembers();
      }
    } catch (error: any) {
      console.error("Error removing member:", error);
      showToast(error.response?.data?.message || "Failed to remove member", "error");
    }
  };

  return (
    <>
    <div className="bg-white/95 backdrop-blur-md border-l border-gray-200/60 w-64 flex flex-col shadow-xl">
      <div className="p-4 border-b border-gray-100">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-semibold text-gray-800">
            Members <span className="text-gray-400 font-normal">({members.length})</span>
          </h3>
          {isAdmin && (
            <button
              onClick={() => setShowAddDialog(!showAddDialog)}
              className="px-2.5 py-1 text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors shadow-sm"
            >
              + Add
            </button>
          )}
        </div>

        {showAddDialog && isAdmin && (
          <div className="mt-2 p-3 bg-gray-50 rounded-xl border border-gray-100">
            <input
              type="email"
              value={searchEmail}
              onChange={(e) => setSearchEmail(e.target.value)}
              placeholder="Enter user email"
              className="w-full px-3 py-1.5 text-sm border border-gray-200 rounded-lg mb-2 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400 transition-all"
              onKeyDown={(e) => e.key === 'Enter' && handleAddMember()}
            />
            <div className="flex gap-1.5">
              <button
                onClick={handleAddMember}
                disabled={searchLoading}
                className="flex-1 px-3 py-1.5 text-xs font-medium text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-colors disabled:opacity-50"
              >
                {searchLoading ? "Adding..." : "Add"}
              </button>
              <button
                onClick={() => {
                  setShowAddDialog(false);
                  setSearchEmail("");
                }}
                className="px-3 py-1.5 text-xs font-medium text-gray-600 bg-gray-200 hover:bg-gray-300 rounded-lg transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-2">
        {loading ? (
          <div className="flex justify-center py-8">
            <div className="w-5 h-5 border-2 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
          </div>
        ) : (
          <div className="space-y-0.5">
            {members.map((member) => (
              <div
                key={member.id}
                className="p-2.5 rounded-xl hover:bg-gray-50 transition-colors group"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-2.5 flex-1 min-w-0">
                    <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-600 font-semibold text-xs flex-shrink-0">
                      {member.username.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1 flex-wrap">
                        <p className="text-sm font-medium text-gray-900 truncate">
                          {member.username}
                        </p>
                        {member.isAdmin && (
                          <span className="px-1.5 py-0.5 text-[10px] font-semibold text-indigo-700 bg-indigo-100 rounded-md">
                            Admin
                          </span>
                        )}
                        {member.userId === currentUserId && (
                          <span className="px-1.5 py-0.5 text-[10px] font-medium text-gray-500 bg-gray-100 rounded-md">
                            You
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-gray-400 truncate">
                        {member.email}
                      </p>
                    </div>
                  </div>
                  {isAdmin && !member.isAdmin && member.userId !== currentUserId && (
                    confirmRemoveUserId === member.userId ? (
                      <div className="flex items-center gap-1 ml-1">
                        <button onClick={() => handleRemoveMember(member.userId, member.username)} className="px-2 py-1 text-[10px] font-semibold text-white bg-red-600 hover:bg-red-700 rounded-md transition-all">Yes</button>
                        <button onClick={() => setConfirmRemoveUserId(null)} className="px-2 py-1 text-[10px] font-medium text-gray-500 hover:bg-gray-200 rounded-md transition-all">No</button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setConfirmRemoveUserId(member.userId)}
                        className="ml-1 p-1 text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all rounded-lg hover:bg-red-50"
                        title="Remove member"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    )
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      {toast && <ToastNotification message={toast.message} type={toast.type} />}
    </div>
    </>
  );
}
