"use client";

import { Tool } from "@/types/types";
import { useState } from "react";
import {
  Square,
  Circle,
  Pencil,
  Eraser,
  MousePointer2,
  Hand,
  Diamond,
  ArrowRight,
  Minus,
  Type,
  Undo,
  Palette,
  Hexagon,
  Star,
  Triangle,
  Shapes,
  ChevronDown,
} from "lucide-react";

interface ToolbarProps {
  selectedTool: Tool;
  setSelectedTool: (tool: Tool) => void;
  selectedColor?: string;
  setSelectedColor?: (color: string) => void;
  onUndo?: () => void;
}

const toolConfig = [
  { tool: Tool.SELECTION, icon: MousePointer2, label: "Selection" },
  { tool: Tool.HAND, icon: Hand, label: "Hand" },
  { tool: Tool.RECT, icon: Square, label: "Rectangle" },
  { tool: Tool.DIAMOND, icon: Diamond, label: "Diamond" },
  { tool: Tool.CIRCLE, icon: Circle, label: "Circle" },
  { tool: Tool.ARROW, icon: ArrowRight, label: "Arrow" },
  { tool: Tool.LINE, icon: Minus, label: "Line" },
  { tool: Tool.PENCIL, icon: Pencil, label: "Draw" },
  { tool: Tool.TEXT, icon: Type, label: "Text" },
  { tool: Tool.ERASER, icon: Eraser, label: "Eraser" },
  { tool: Tool.UNDO, icon: Undo, label: "Undo" },
];

const moreShapes = [
  { tool: Tool.TRIANGLE, icon: Triangle, label: "Triangle" },
  { tool: Tool.STAR, icon: Star, label: "Star" },
  { tool: Tool.HEXAGON, icon: Hexagon, label: "Hexagon" },
  { tool: Tool.PENTAGON, icon: Shapes, label: "Pentagon" },
];

const colorOptions = [
  { color: "#000000", label: "Black" },
  { color: "#FFFFFF", label: "White" },
  { color: "#EF4444", label: "Red" },
  { color: "#3B82F6", label: "Blue" },
  { color: "#10B981", label: "Green" },
  { color: "#F59E0B", label: "Orange" },
  { color: "#8B5CF6", label: "Purple" },
  { color: "#EC4899", label: "Pink" },
  { color: "#6B7280", label: "Gray" },
];

export default function Toolbar({ selectedTool, setSelectedTool, selectedColor = "#000000", setSelectedColor, onUndo }: ToolbarProps) {
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [showShapesDropdown, setShowShapesDropdown] = useState(false);

  const handleToolClick = (tool: Tool) => {
    if (tool === Tool.UNDO) {
      onUndo?.();
    } else {
      setSelectedTool(tool);
    }
  };

  return (
    <div className="absolute top-4 left-1/2 transform -translate-x-1/2 z-10 flex items-center gap-2">
      <div className="flex items-center gap-0.5 bg-white/95 backdrop-blur-md p-1.5 rounded-xl shadow-lg shadow-black/5 border border-gray-200/80">
        {toolConfig.slice(0, 5).map(({ tool, icon: Icon, label }, index) => {
          const isActive = selectedTool === tool && tool !== Tool.UNDO;
          return (
            <div key={tool} className="flex items-center">
              {index === 2 && <div className="w-px h-6 bg-gray-200 mx-1" />}
              <button
                type="button"
                onClick={() => handleToolClick(tool)}
                className={`relative p-2 rounded-lg transition-all group ${
                  isActive
                    ? "bg-indigo-100 text-indigo-600"
                    : "text-gray-600 hover:bg-gray-100 hover:text-gray-800"
                }`}
              >
                <Icon className="w-[18px] h-[18px]" />
                {isActive && (
                  <div className="absolute -bottom-0.5 left-1/2 transform -translate-x-1/2 w-5 h-0.5 bg-indigo-500 rounded-full" />
                )}
                <div className="absolute -bottom-9 left-1/2 -translate-x-1/2 px-2 py-1 bg-gray-900 text-white text-[10px] font-medium rounded-md opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap">
                  {label}
                </div>
              </button>
            </div>
          );
        })}
        
        {/* More Shapes Dropdown */}
        <div className="relative flex items-center">
          <button
            type="button"
            onClick={() => setShowShapesDropdown(!showShapesDropdown)}
            className={`relative p-2 rounded-lg transition-all group ${
              [Tool.TRIANGLE, Tool.STAR, Tool.HEXAGON, Tool.PENTAGON].includes(selectedTool)
                ? "bg-indigo-100 text-indigo-600"
                : "text-gray-600 hover:bg-gray-100 hover:text-gray-800"
            }`}
          >
            <div className="flex items-center gap-0.5">
              <Shapes className="w-[18px] h-[18px]" />
              <ChevronDown className="w-3 h-3" />
            </div>
            {[Tool.TRIANGLE, Tool.STAR, Tool.HEXAGON, Tool.PENTAGON].includes(selectedTool) && (
              <div className="absolute -bottom-0.5 left-1/2 transform -translate-x-1/2 w-5 h-0.5 bg-indigo-500 rounded-full" />
            )}
            <div className="absolute -bottom-9 left-1/2 -translate-x-1/2 px-2 py-1 bg-gray-900 text-white text-[10px] font-medium rounded-md opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap">
              More Shapes
            </div>
          </button>
          
          {showShapesDropdown && (
            <>
              <div
                className="fixed inset-0 z-10"
                onClick={() => setShowShapesDropdown(false)}
              />
              <div className="absolute top-full mt-2 left-0 z-20 bg-white rounded-xl shadow-xl border border-gray-200 p-2 animate-fade-in min-w-[140px]">
                {moreShapes.map(({ tool, icon: Icon, label }) => (
                  <button
                    key={tool}
                    onClick={() => {
                      setSelectedTool(tool);
                      setShowShapesDropdown(false);
                    }}
                    className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-all text-left ${
                      selectedTool === tool
                        ? "bg-indigo-100 text-indigo-600"
                        : "text-gray-600 hover:bg-gray-100 hover:text-gray-800"
                    }`}
                  >
                    <Icon className="w-[18px] h-[18px]" />
                    <span className="text-sm font-medium">{label}</span>
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
        
        {toolConfig.slice(5).map(({ tool, icon: Icon, label }, originalIndex) => {
          const index = originalIndex + 5;
          const isActive = selectedTool === tool && tool !== Tool.UNDO;
          const isAction = tool === Tool.UNDO;
          return (
            <div key={tool} className="flex items-center">
              {index === 9 && <div className="w-px h-6 bg-gray-200 mx-1" />}
              <button
                type="button"
                onClick={() => handleToolClick(tool)}
                className={`relative p-2 rounded-lg transition-all group ${
                  isActive
                    ? "bg-indigo-100 text-indigo-600"
                    : isAction
                    ? "text-gray-400 hover:text-gray-600 hover:bg-gray-100"
                    : "text-gray-600 hover:bg-gray-100 hover:text-gray-800"
                }`}
              >
                <Icon className="w-[18px] h-[18px]" />
                {isActive && (
                  <div className="absolute -bottom-0.5 left-1/2 transform -translate-x-1/2 w-5 h-0.5 bg-indigo-500 rounded-full" />
                )}
                <div className="absolute -bottom-9 left-1/2 -translate-x-1/2 px-2 py-1 bg-gray-900 text-white text-[10px] font-medium rounded-md opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap">
                  {label}
                </div>
              </button>
            </div>
          );
        })}
      </div>

      {/* Color Picker */}
      {setSelectedColor && (
        <div className="relative">
          <button
            type="button"
            onClick={() => setShowColorPicker(!showColorPicker)}
            className="flex items-center gap-2 px-3 py-2 bg-white/95 backdrop-blur-md rounded-xl shadow-lg shadow-black/5 border border-gray-200/80 hover:bg-white transition-all"
            title="Change color"
          >
            <div 
              className="w-5 h-5 rounded border-2 border-gray-300"
              style={{ backgroundColor: selectedColor }}
            />
            <Palette className="w-4 h-4 text-gray-600" />
          </button>

          {showColorPicker && (
            <>
              <div
                className="fixed inset-0 z-10"
                onClick={() => setShowColorPicker(false)}
              />
              <div className="absolute top-full mt-2 left-0 z-20 bg-white rounded-xl shadow-xl border border-gray-200 p-3 animate-fade-in">
                <div className="grid grid-cols-4 gap-2">
                  {colorOptions.map(({ color, label }) => (
                    <button
                      key={color}
                      onClick={() => {
                        setSelectedColor(color);
                        setShowColorPicker(false);
                      }}
                      className={`w-10 h-10 rounded-lg border-2 transition-all hover:scale-110 ${
                        selectedColor === color
                          ? "border-indigo-500 ring-2 ring-indigo-500/30 scale-110"
                          : "border-gray-200 hover:border-gray-300"
                      }`}
                      style={{ backgroundColor: color }}
                      title={label}
                    />
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
