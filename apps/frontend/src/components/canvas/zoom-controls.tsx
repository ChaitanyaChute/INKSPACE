"use client";

import { Minus, Plus, RotateCcw } from "lucide-react";

interface ZoomControlsProps {
  zoom: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onResetZoom: () => void;
}

export default function ZoomControls({ zoom, onZoomIn, onZoomOut, onResetZoom }: ZoomControlsProps) {
  return (
    <div className="absolute bottom-4 left-4 z-10 flex items-center gap-1 bg-white/90 backdrop-blur-sm p-1.5 rounded-xl shadow-md border border-gray-200/80">
      <button
        onClick={onZoomOut}
        className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
        title="Zoom out (Ctrl+-)"
      >
        <Minus className="w-4 h-4 text-gray-600" />
      </button>

      <button
        onClick={onResetZoom}
        className="px-2 py-1 hover:bg-gray-100 rounded-lg transition-colors min-w-[52px] text-center"
        title="Reset zoom"
      >
        <span className="text-xs text-gray-600 font-semibold tabular-nums">{Math.round(zoom * 100)}%</span>
      </button>

      <button
        onClick={onZoomIn}
        className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
        title="Zoom in (Ctrl++)"
      >
        <Plus className="w-4 h-4 text-gray-600" />
      </button>

      <div className="w-px h-5 bg-gray-200 mx-0.5" />

      <button
        onClick={onResetZoom}
        className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
        title="Reset view (Ctrl+0)"
      >
        <RotateCcw className="w-3.5 h-3.5 text-gray-500" />
      </button>
    </div>
  );
}
