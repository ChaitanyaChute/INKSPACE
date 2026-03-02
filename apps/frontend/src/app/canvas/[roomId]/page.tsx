"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import RoomCanvas from "@/components/canvas/room-canvas";
import axios from "axios";
import { API_URL, WS_URL } from "@/config";
import { useToast } from "@/hooks/use-toast";
import { ToastNotification } from "@/components/ui/toast-notification";

export default function CanvasPage({ params }: { params: any }) {
  const [roomId, setRoomId] = useState<string>("");
  const [hasAccess, setHasAccess] = useState<boolean | null>(null);
  const [isJoining, setIsJoining] = useState(false);
  const [requestStatus, setRequestStatus] = useState<string | null>(null);
  const { toast, showToast } = useToast();
  const router = useRouter();

  useEffect(() => {
    const fetchParams = async () => {
      const resolvedParams = await params;
      setRoomId(resolvedParams.roomId ?? "");
    };
    fetchParams();
  }, [params]);

  useEffect(() => {
    const checkAccess = async () => {
      if (!roomId) return;
      
      const token = localStorage.getItem("token");
      if (!token) {
        router.push("/signin");
        return;
      }

      try {
        const res = await axios.get(
          `${API_URL}/api/v1/room/${roomId}/access`,
          {
            headers: {
              Authorization: `Bearer ${token}`
            }
          }
        );

        setHasAccess(res.data.hasAccess);
        
        // If no access, check if there's a pending request
        if (!res.data.hasAccess) {
          try {
            const statusRes = await axios.get(
              `${API_URL}/api/v1/room/${roomId}/request-status`,
              {
                headers: {
                  Authorization: `Bearer ${token}`
                }
              }
            );
            
            if (statusRes.data.hasRequest) {
              setRequestStatus(statusRes.data.status);
            }
          } catch (statusError: any) {
            // If room not found during status check, it's already handled above
            console.log("Could not check request status:", statusError.response?.status);
          }
        }
      } catch (error: any) {
        console.error("Error checking room access:", error);
        if (error.response?.status === 404) {
          // Room doesn't exist
          setRequestStatus("not_found");
          setHasAccess(false);
        } else {
          setHasAccess(false);
        }
      }
    };

   checkAccess();
  }, [roomId, router]);

  // Cleanup polling interval on unmount or when access is granted
  useEffect(() => {
    return () => {
      if ((window as any).__joinRequestPollInterval) {
        clearInterval((window as any).__joinRequestPollInterval);
        console.log("[Join Request] Polling interval cleared on cleanup");
      }
    };
  }, []);

  const handleJoinRoom = async () => {
    setIsJoining(true);
    const token = localStorage.getItem("token");

    try {
      const res = await axios.post(
        `${API_URL}/api/v1/room/${roomId}/join`,
        {},
        {
          headers: {
            Authorization: `Bearer ${token}`
          }
        }
      );

      if (res.data.success) {
        if (res.data.status === "approved") {
          // Direct access granted (admin or already member)
          setHasAccess(true);
        } else if (res.data.status === "pending") {
          // Request created, waiting for approval
          console.log("[Join Request] Creating WebSocket connection...");
          console.log("[Join Request] Request data:", res.data);
          
          // Set status to pending immediately
          setRequestStatus("pending");
          
          // Connect WebSocket for real-time updates
          const ws = new WebSocket(`${WS_URL}?token=${token}`);
          let hasReceivedResponse = false;
          
          console.log("[Join Request] WebSocket readyState:", ws.readyState, "(CONNECTING=0, OPEN=1)");
          
          ws.onopen = () => {
            console.log("[Join Request] ✓ WebSocket connected successfully");
            console.log("[Join Request] WebSocket readyState:", ws.readyState);
            
            // Notify admin via WebSocket using the requester info from backend
            const notificationPayload = {
              type: "notify_admin",
              roomId: roomId,
              requestId: res.data.requestId,
              adminId: res.data.adminId,
              requesterInfo: res.data.requesterInfo
            };
            
            console.log("[Join Request] Sending notification to admin:", notificationPayload);
            ws.send(JSON.stringify(notificationPayload));
            console.log("[Join Request] ✓ Notification sent successfully");
            
            console.log("[Join Request] Now listening for admin response...");
          };
          
          // Listen for approval/rejection - set this OUTSIDE onopen so it's always active
          ws.onmessage = (event) => {
            try {
              const data = JSON.parse(event.data);
              console.log("[Join Request] <<<< WebSocket message received:", data);
              console.log("[Join Request] Message type:", data.type);
              console.log("[Join Request] Current hasAccess:", hasAccess, "hasReceivedResponse:", hasReceivedResponse);
              
              if (data.type === "request_approved") {
                if (hasReceivedResponse) {
                  console.log("[Join Request] Already processed, ignoring duplicate");
                  return;
                }
                hasReceivedResponse = true;
                console.log("[Join Request] ✓✓✓ Request APPROVED! Granting access...");
                console.log("[Join Request] Approved for room:", data.roomId);
                setHasAccess(true);
                setRequestStatus(null);
                console.log("[Join Request] Closing WebSocket...");
                ws.close();
              } else if (data.type === "request_rejected") {
                if (hasReceivedResponse) {
                  console.log("[Join Request] Already processed, ignoring duplicate");
                  return;
                }
                hasReceivedResponse = true;
                console.log("[Join Request] ✗✗✗ Request REJECTED");
                console.log("[Join Request] Rejected for room:", data.roomId);
                setRequestStatus("rejected");
                ws.close();
              } else {
                console.log("[Join Request] Other message type:", data.type, "- keeping connection open");
              }
            } catch (error) {
              console.error("[Join Request] Error parsing WebSocket message:", error);
            }
          };

          ws.onerror = (error) => {
            console.error("[Join Request] ✗ WebSocket error:", error);
            console.log("[Join Request] WebSocket readyState after error:", ws.readyState);
          };
          
          ws.onclose = (event) => {
            console.log("[Join Request] WebSocket connection closed");
            console.log("[Join Request] Close code:", event.code, "reason:", event.reason);
            console.log("[Join Request] hasReceivedResponse:", hasReceivedResponse);
          };

          // Start polling for status changes (fallback if WebSocket fails or disconnects)
          const pollInterval = setInterval(async () => {
            try {
              console.log("[Join Request Polling] Checking request status...");
              const statusRes = await axios.get(
                `${API_URL}/api/v1/room/${roomId}/request-status`,
                {
                  headers: {
                    Authorization: `Bearer ${token}`
                  }
                }
              );

              if (statusRes.data.success) {
                const status = statusRes.data.status;
                console.log("[Join Request Polling] Current status:", status);

                if (status === "approved") {
                  console.log("[Join Request Polling] ✓✓✓ Request APPROVED via polling!");
                  clearInterval(pollInterval);
                  if (ws.readyState === WebSocket.OPEN) ws.close();
                  setHasAccess(true);
                  setRequestStatus(null);
                } else if (status === "rejected") {
                  console.log("[Join Request Polling] ✗✗✗ Request REJECTED via polling");
                  clearInterval(pollInterval);
                  if (ws.readyState === WebSocket.OPEN) ws.close();
                  setRequestStatus("rejected");
                }
              }
            } catch (error) {
              console.error("[Join Request Polling] Error checking status:", error);
            }
          }, 3000); // Poll every 3 seconds

          // Store interval ID so we can clear it on unmount
          (window as any).__joinRequestPollInterval = pollInterval;
        } else {
          // Status is already approved/member
          setHasAccess(true);
        }
      }
    } catch (error: any) {
      console.error("Error joining room:", error);
      if (error.response?.status === 404) {
        showToast("Room not found. This room does not exist.", "error");
        setTimeout(() => router.push("/dashboard"), 1500);
      } else {
        showToast("Failed to join room. Please try again.", "error");
      }
    } finally {
      setIsJoining(false);
    }
  };

  if (!roomId || hasAccess === null) {
    return (
      <div className="flex items-center justify-center h-screen bg-[#0a0a0f]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-10 w-10 border-2 border-indigo-900 border-t-indigo-500 mx-auto"></div>
          <p className="mt-4 text-sm text-gray-500">Checking access...</p>
        </div>
      </div>
    );
  }

  if (hasAccess === false) {
    return (
      <div className="flex items-center justify-center h-screen bg-[#0a0a0f] relative overflow-hidden">
        {toast && <ToastNotification message={toast.message} type={toast.type} />}
        {/* Background orbs */}
        <div className="absolute top-1/4 left-1/3 w-72 h-72 bg-indigo-500/10 rounded-full blur-3xl" />
        <div className="absolute bottom-1/3 right-1/4 w-56 h-56 bg-violet-500/10 rounded-full blur-3xl" />

        <div className="bg-white/[0.03] border border-white/10 backdrop-blur-xl p-8 rounded-2xl shadow-2xl max-w-md w-full mx-4 animate-slide-up">
          <div className="text-center">
            {requestStatus === "pending" ? (
              <>
                <div className="w-14 h-14 bg-amber-500/10 border border-amber-500/20 rounded-2xl flex items-center justify-center mx-auto mb-5">
                  <svg className="w-7 h-7 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <h2 className="text-xl font-bold text-white mb-2">Request Pending</h2>
                <p className="text-sm text-gray-400 mb-6 leading-relaxed">
                  Your request to join this room is pending admin approval. You'll be notified once it's approved.
                </p>
                <button
                  onClick={() => router.push("/dashboard")}
                  className="w-full px-4 py-2.5 bg-white/5 border border-white/10 text-gray-300 rounded-xl hover:bg-white/10 transition-all text-sm font-medium"
                >
                  Back to Dashboard
                </button>
              </>
            ) : requestStatus === "rejected" ? (
              <>
                <div className="w-14 h-14 bg-red-500/10 border border-red-500/20 rounded-2xl flex items-center justify-center mx-auto mb-5">
                  <svg className="w-7 h-7 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </div>
                <h2 className="text-xl font-bold text-white mb-2">Request Rejected</h2>
                <p className="text-sm text-gray-400 mb-6 leading-relaxed">
                  Your request to join this room was rejected by the admin. You can request again.
                </p>
                <div className="flex gap-3">
                  <button
                    onClick={() => router.push("/dashboard")}
                    className="flex-1 px-4 py-2.5 bg-white/5 border border-white/10 text-gray-300 rounded-xl hover:bg-white/10 transition-all text-sm font-medium"
                  >
                    Go Back
                  </button>
                  <button
                    onClick={handleJoinRoom}
                    disabled={isJoining}
                    className="flex-1 px-4 py-2.5 bg-indigo-600 text-white rounded-xl hover:bg-indigo-500 transition-all text-sm font-medium disabled:opacity-50 shadow-lg shadow-indigo-500/20"
                  >
                    {isJoining ? "Sending..." : "Request Again"}
                  </button>
                </div>
              </>
            ) : requestStatus === "not_found" ? (
              <>
                <div className="w-14 h-14 bg-gray-500/10 border border-gray-500/20 rounded-2xl flex items-center justify-center mx-auto mb-5">
                  <svg className="w-7 h-7 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <h2 className="text-xl font-bold text-white mb-2">Room Not Found</h2>
                <p className="text-sm text-gray-400 mb-6 leading-relaxed">
                  The room you're trying to access doesn't exist. It may have been deleted or the link is incorrect.
                </p>
                <button
                  onClick={() => router.push("/dashboard")}
                  className="w-full px-4 py-2.5 bg-indigo-600 text-white rounded-xl hover:bg-indigo-500 transition-all text-sm font-medium shadow-lg shadow-indigo-500/20"
                >
                  Go to Dashboard
                </button>
              </>
            ) : (
              <>
                <div className="w-14 h-14 bg-indigo-500/10 border border-indigo-500/20 rounded-2xl flex items-center justify-center mx-auto mb-5">
                  <svg className="w-7 h-7 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                </div>
                <h2 className="text-xl font-bold text-white mb-2">Access Required</h2>
                <p className="text-sm text-gray-400 mb-6 leading-relaxed">
                  You don't have access to this room. Request to join and the admin will be notified.
                </p>
                <div className="flex gap-3">
                  <button
                    onClick={() => router.push("/dashboard")}
                    className="flex-1 px-4 py-2.5 bg-white/5 border border-white/10 text-gray-300 rounded-xl hover:bg-white/10 transition-all text-sm font-medium"
                  >
                    Go Back
                  </button>
                  <button
                    onClick={handleJoinRoom}
                    disabled={isJoining}
                    className="flex-1 px-4 py-2.5 bg-indigo-600 text-white rounded-xl hover:bg-indigo-500 transition-all text-sm font-medium disabled:opacity-50 shadow-lg shadow-indigo-500/20"
                  >
                    {isJoining ? "Sending..." : "Request to Join"}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    );
  }

  return <RoomCanvas roomId={roomId} />;
}
