"use client"

import { useEffect, useState } from "react";
import axios from "axios";
import { API_URL } from "@/config";

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

interface JoinRequestsPanelProps {
  roomId: number;
  socket: WebSocket | null;
  onRequestsUpdate?: () => void;
}

export function JoinRequestsPanel({ roomId, socket, onRequestsUpdate }: JoinRequestsPanelProps) {
  const [requests, setRequests] = useState<JoinRequest[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchRequests = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem("token");
      const response = await axios.get(
        `${API_URL}/api/v1/room/${roomId}/requests`,
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );
      
      if (response.data.success) {
        setRequests(response.data.requests);
      }
    } catch (error) {
      console.error("Error fetching join requests:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRequests();
  }, [roomId]);

  useEffect(() => {
    if (!socket) return;

    const handleMessage = (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data);
        
        if (data.type === "join_request") {
          // New join request received
          console.log("[Join Request] New request from:", data.requester.username);
          fetchRequests();
        }
      } catch (error) {
        console.error("Error parsing WebSocket message:", error);
      }
    };

    socket.addEventListener('message', handleMessage);
    return () => socket.removeEventListener('message', handleMessage);
  }, [socket]);

  const handleApprove = async (requestId: number, userId: string) => {
    try {
      const token = localStorage.getItem("token");
      const response = await axios.post(
        `${API_URL}/api/v1/room/request/${requestId}/approve`,
        {},
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );

      if (response.data.success) {
        // Notify via WebSocket
        if (socket && socket.readyState === WebSocket.OPEN) {
          socket.send(JSON.stringify({
            type: "approve_request",
            requestId: requestId,
            requestUserId: userId,
            roomId: roomId
          }));
        }
        
        // Remove from list
        setRequests(prev => prev.filter(r => r.id !== requestId));
        
        // Notify parent to refresh members
        onRequestsUpdate?.();
      }
    } catch (error) {
      console.error("Error approving request:", error);
    }
  };

  const handleReject = async (requestId: number, userId: string) => {
    try {
      const token = localStorage.getItem("token");
      const response = await axios.post(
        `${API_URL}/api/v1/room/request/${requestId}/reject`,
        {},
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );

      if (response.data.success) {
        // Notify via WebSocket
        if (socket && socket.readyState === WebSocket.OPEN) {
          socket.send(JSON.stringify({
            type: "reject_request",
            requestId: requestId,
            requestUserId: userId,
            roomId: roomId
          }));
        }
        
        // Remove from list
        setRequests(prev => prev.filter(r => r.id !== requestId));
      }
    } catch (error) {
      console.error("Error rejecting request:", error);
    }
  };

  if (loading) {
    return (
      <div className="p-4 bg-white/90 backdrop-blur-sm border-b border-gray-100">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 border-2 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
          <p className="text-sm text-gray-500">Loading requests...</p>
        </div>
      </div>
    );
  }

  if (requests.length === 0) {
    return null;
  }

  return (
    <div className="bg-amber-50/80 backdrop-blur-sm border-b border-amber-200/60 p-4">
      <h3 className="text-xs font-semibold text-amber-800 mb-3 uppercase tracking-wider">
        Pending Requests ({requests.length})
      </h3>
      <div className="space-y-2">
        {requests.map((request) => (
          <div
            key={request.id}
            className="flex items-center justify-between bg-white/80 p-3 rounded-xl border border-amber-100 hover:border-amber-200 transition-colors"
          >
            <div className="flex items-center gap-2.5 flex-1">
              <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center text-amber-700 font-semibold text-xs flex-shrink-0">
                {request.user.username.charAt(0).toUpperCase()}
              </div>
              <div>
                <p className="text-sm font-medium text-gray-900">
                  {request.user.username}
                </p>
                <p className="text-[11px] text-gray-400">{request.user.email}</p>
              </div>
            </div>
            <div className="flex gap-1.5 ml-3">
              <button
                onClick={() => handleApprove(request.id, request.userId)}
                className="px-2.5 py-1 text-xs font-medium text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-colors"
              >
                Approve
              </button>
              <button
                onClick={() => handleReject(request.id, request.userId)}
                className="px-2.5 py-1 text-xs font-medium text-gray-600 bg-gray-200 hover:bg-red-100 hover:text-red-700 rounded-lg transition-colors"
              >
                Reject
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
