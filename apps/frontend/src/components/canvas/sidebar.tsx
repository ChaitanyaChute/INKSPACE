"use client";

import { useState } from "react";
import axios from "axios";
import { API_URL } from "@/config";
import {
  Menu,
  Download,
  RotateCcw,
  Palette,
  X,
} from "lucide-react";

interface SidebarProps {
  backgroundColor: string;
  setBackgroundColor: (color: string) => void;
  onReset: () => void;
  onExport: () => void;
  roomId: string;
  socket: WebSocket | null;
  isAdmin: boolean;
}

const backgroundColors = [
  { color: "#ffffff", label: "White" },
  { color: "#f8fafc", label: "Slate" },
  { color: "#f0fdf4", label: "Mint" },
  { color: "#eff6ff", label: "Ice Blue" },
  { color: "#faf5ff", label: "Lavender" },
  { color: "#fefce8", label: "Cream" },
  { color: "#1a1a2e", label: "Dark Blue" },
  { color: "#121212", label: "Dark" },
];

export default function Sidebar({ backgroundColor, setBackgroundColor, onReset, onExport, roomId, socket, isAdmin }: SidebarProps) {
  const [isOpen, setIsOpen] = useState(false);

  const handleColorChange = async (color: string) => {
    // Only admin can change background color
    if (!isAdmin) return;

    // Update local state immediately
    setBackgroundColor(color);

    try {
      const token = localStorage.getItem("token");
      // Save to database
      await axios.put(
        `${API_URL}/api/v1/room/${roomId}/background`,
        { backgroundColor: color },
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      // Broadcast to other users via WebSocket
      if (socket && socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({
          type: "background_change",
          roomId: roomId,
          backgroundColor: color
        }));
      }
    } catch (error) {
      console.error("Error updating background color:", error);
    }
  };

  return (
    <>
      {/* Menu Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="absolute top-4 left-4 z-20 p-2 bg-white/90 backdrop-blur-sm rounded-xl shadow-md border border-gray-200/80 hover:bg-white hover:shadow-lg transition-all"
        title="Menu"
      >
        <Menu className="w-[18px] h-[18px] text-gray-600" />
      </button>

      {/* Sidebar Menu */}
      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-30 bg-black/10"
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute top-4 left-4 z-40 w-60 bg-white/95 backdrop-blur-md rounded-2xl shadow-2xl shadow-black/10 border border-gray-200/80 overflow-hidden animate-fade-in">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
              <span className="text-sm font-semibold text-gray-800">Menu</span>
              <button onClick={() => setIsOpen(false)} className="p-0.5 text-gray-400 hover:text-gray-600 transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Actions */}
            <div className="p-1.5">
              <MenuItem icon={Download} label="Export image" onClick={onExport} />
              <MenuItem icon={RotateCcw} label="Reset canvas" onClick={onReset} />
            </div>

            <div className="h-px bg-gray-100 mx-3" />

            {/* Canvas Background */}
            <div className="p-4">
              <div className="flex items-center gap-1.5 mb-3">
                <Palette className="w-3.5 h-3.5 text-gray-400" />
                <span className="text-xs font-medium text-gray-500">Canvas Background</span>
                {!isAdmin && (
                  <span className="ml-auto text-[10px] text-gray-400">(Admin only)</span>
                )}
              </div>
              <div className="grid grid-cols-4 gap-2">
                {backgroundColors.map(({ color, label }) => (
                  <button
                    key={color}
                    onClick={() => handleColorChange(color)}
                    disabled={!isAdmin}
                    className={`w-full aspect-square rounded-lg border-2 transition-all ${
                      isAdmin ? "hover:scale-105 cursor-pointer" : "cursor-not-allowed opacity-60"
                    } ${
                      backgroundColor === color
                        ? "border-indigo-500 ring-2 ring-indigo-500/20 scale-105"
                        : "border-gray-200 hover:border-gray-300"
                    }`}
                    style={{ backgroundColor: color }}
                    title={isAdmin ? label : `${label} (Admin only)`}
                  />
                ))}
              </div>
            </div>
          </div>
        </>
      )}
    </>
  );
}

function MenuItem({
  icon: Icon,
  label,
  shortcut,
  onClick,
}: {
  icon: any;
  label: string;
  shortcut?: string;
  onClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center justify-between px-3 py-2 hover:bg-gray-100 rounded-lg transition-colors text-left"
    >
      <div className="flex items-center gap-2.5">
        <Icon className="w-4 h-4 text-gray-500" />
        <span className="text-[13px] text-gray-700">{label}</span>
      </div>
      {shortcut && <span className="text-[10px] text-gray-400 font-mono">{shortcut}</span>}
    </button>
  );
}
