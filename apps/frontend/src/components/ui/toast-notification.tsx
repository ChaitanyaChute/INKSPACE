"use client";

import { Check, AlertCircle, Info } from "lucide-react";

type ToastType = "success" | "error" | "info";

const icons: Record<ToastType, React.ReactNode> = {
  success: <Check className="w-4 h-4 text-emerald-400 shrink-0" />,
  error: <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />,
  info: <Info className="w-4 h-4 text-blue-400 shrink-0" />,
};

export function ToastNotification({
  message,
  type = "success",
}: {
  message: string;
  type?: ToastType;
}) {
  return (
    <div className="fixed top-5 left-1/2 -translate-x-1/2 z-[9999] flex items-center gap-2 bg-gray-900 text-white px-4 py-2.5 rounded-xl shadow-2xl text-sm font-medium animate-fade-in pointer-events-none">
      {icons[type]}
      {message}
    </div>
  );
}
