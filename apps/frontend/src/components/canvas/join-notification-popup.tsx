"use client";

import { Check, X } from "lucide-react";
import { useState } from "react";

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

interface JoinNotificationPopupProps {
  notification: JoinNotification;
  onApprove: (requestId: number, userId: string, roomId: string) => void;
  onReject: (requestId: number, userId: string, roomId: string) => void;
  onClose: () => void;
}

export default function JoinNotificationPopup({
  notification,
  onApprove,
  onReject,
  onClose,
}: JoinNotificationPopupProps) {
  const [processing, setProcessing] = useState(false);

  const handleApprove = async () => {
    setProcessing(true);
    await onApprove(notification.requestId, notification.requester.id, notification.roomId);
    setProcessing(false);
    onClose();
  };

  const handleReject = async () => {
    setProcessing(true);
    await onReject(notification.requestId, notification.requester.id, notification.roomId);
    setProcessing(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-end sm:items-start justify-center sm:pt-16">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Notification Card */}
      <div className="relative bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl w-full sm:max-w-sm mx-0 sm:mx-4 overflow-hidden animate-slide-up sm:animate-slide-down">
        {/* Mobile handle */}
        <div className="flex justify-center pt-3 pb-1 sm:hidden">
          <div className="w-10 h-1 bg-gray-200 rounded-full" />
        </div>

        {/* Header */}
        <div className="flex items-center gap-3 px-5 pt-4 pb-3 sm:pt-5">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-violet-500 flex items-center justify-center text-white font-bold text-base flex-shrink-0">
            {notification.requester.username.charAt(0).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-gray-900 truncate">{notification.requester.username}</p>
            <p className="text-xs text-gray-400 truncate">{notification.requester.email}</p>
          </div>
          <button onClick={onClose} className="p-1.5 text-gray-400 hover:text-gray-500 hover:bg-gray-100 rounded-lg transition-all flex-shrink-0">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="px-5 pb-5">
          <p className="text-sm text-gray-600 mb-4">
            <span className="font-semibold text-gray-900">{notification.requester.username}</span> wants to join{" "}
            <span className="font-semibold text-indigo-600">{notification.roomSlug}</span>
          </p>

          {/* Action Buttons */}
          <div className="flex gap-2.5">
            <button
              onClick={handleReject}
              disabled={processing}
              className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2.5 bg-gray-100 hover:bg-gray-200 active:scale-95 text-gray-700 rounded-xl transition-all text-sm font-semibold disabled:opacity-50"
            >
              {processing ? (
                <span className="w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
              ) : (
                <X className="w-4 h-4" />
              )}
              Reject
            </button>
            <button
              onClick={handleApprove}
              disabled={processing}
              className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2.5 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 active:scale-95 text-white rounded-xl transition-all text-sm font-semibold disabled:opacity-50 shadow-md shadow-indigo-500/20"
            >
              {processing ? (
                <span className="w-4 h-4 border-2 border-white/50 border-t-white rounded-full animate-spin" />
              ) : (
                <Check className="w-4 h-4" />
              )}
              Accept
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
