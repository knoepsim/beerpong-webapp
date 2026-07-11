"use client";

import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

const SoloCup = ({ color = "red", className }: { color?: "red" | "blue", className?: string }) => {
  const baseColor = color === "red" ? "#e93338" : "#1d47c1";

  return (
    <svg viewBox="0 0 100 120" className={className} preserveAspectRatio="xMidYMid meet" style={{ overflow: 'visible' }}>
      <defs>
        <linearGradient id={`cupGradient-${color}`} x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="rgba(0,0,0,0.15)" />
          <stop offset="20%" stopColor="rgba(255,255,255,0.1)" />
          <stop offset="40%" stopColor="rgba(0,0,0,0)" />
          <stop offset="85%" stopColor="rgba(0,0,0,0.1)" />
          <stop offset="100%" stopColor="rgba(0,0,0,0.35)" />
        </linearGradient>
        <clipPath id={`inner-cup-clip-${color}`}>
          <ellipse cx="50" cy="20" rx="36" ry="10" />
        </clipPath>
      </defs>

      {/* Cup Body */}
      <path
        d="M 12,20 
           L 26,110 
           A 24 8 0 0 0 74,110 
           L 88,20 
           Z"
        fill={baseColor}
      />

      {/* Body Gradient Overlay */}
      <path
        d="M 12,20 
           L 26,110 
           A 24 8 0 0 0 74,110 
           L 88,20 
           Z"
        fill={`url(#cupGradient-${color})`}
      />

      {/* Ridges (Horizontal rings) */}
      <path d="M 14,35 A 36 10.5 0 0 0 86,35" fill="none" stroke="rgba(0,0,0,0.15)" strokeWidth="1.5" />
      <path d="M 14,36 A 36 10.5 0 0 0 86,36" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="1" />

      <path d="M 15.5,45 A 34.5 10 0 0 0 84.5,45" fill="none" stroke="rgba(0,0,0,0.15)" strokeWidth="1.5" />
      <path d="M 15.5,46 A 34.5 10 0 0 0 84.5,46" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="1" />

      <path d="M 18,65 A 32 9.5 0 0 0 82,65" fill="none" stroke="rgba(0,0,0,0.15)" strokeWidth="1.5" />
      <path d="M 18,66 A 32 9.5 0 0 0 82,66" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="1" />

      <path d="M 23,100 A 27 8 0 0 0 77,100" fill="none" stroke="rgba(0,0,0,0.15)" strokeWidth="1.5" />
      <path d="M 23,101 A 27 8 0 0 0 77,101" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="1" />

      {/* Top Rim */}
      <ellipse cx="50" cy="20" rx="42" ry="13" fill="#ffffff" />
      <ellipse cx="50" cy="20" rx="42" ry="13" fill="none" stroke="#d1d5db" strokeWidth="1" />

      {/* Inner Cup (Empty inside wall) */}
      <ellipse cx="50" cy="20" rx="36" ry="10" fill="#cbd5e1" />
      <ellipse cx="50" cy="20" rx="36" ry="10" fill="none" stroke="rgba(0,0,0,0.3)" strokeWidth="1.5" />

      {/* Liquid (beer) - Lowered and clipped by the rim opening */}
      <g clipPath={`url(#inner-cup-clip-${color})`}>
        {/* Deep amber base */}
        <ellipse cx="50" cy="33" rx="33" ry="9" fill="#d97706" />
        {/* Lighter amber center */}
        <ellipse cx="50" cy="33" rx="31" ry="8" fill="#f59e0b" />

        {/* Foam ring at the edge */}
        <ellipse cx="50" cy="33" rx="32.5" ry="8.5" fill="none" stroke="#fef3c7" strokeWidth="2.5" opacity="0.9" />

        {/* Foam clusters floating on top */}
        <ellipse cx="30" cy="28" rx="5" ry="2" fill="#fef3c7" opacity="0.9" />
        <ellipse cx="65" cy="30" rx="6" ry="2.5" fill="#fef3c7" opacity="0.9" />
        <ellipse cx="48" cy="26" rx="7" ry="2.5" fill="#fef3c7" opacity="0.9" />

        {/* Small foam bubbles */}
        <circle cx="36" cy="29" r="1.5" fill="#ffffff" opacity="0.8" />
        <circle cx="55" cy="31" r="1.5" fill="#ffffff" opacity="0.8" />
        <circle cx="72" cy="31" r="1" fill="#ffffff" opacity="0.8" />
        <circle cx="42" cy="27" r="1" fill="#ffffff" opacity="0.8" />
      </g>
    </svg>
  );
};

interface BeerpongTableProps {
  leftCups: number;
  rightCups: number;
  className?: string;
}

export function BeerpongTable({ leftCups, rightCups, className }: BeerpongTableProps) {
  const leftCupPositions = [
    // Base column (4 cups)
    { x: 6.7, y: 21.5 },
    { x: 6.7, y: 40.5 },
    { x: 6.7, y: 59.5 },
    { x: 6.7, y: 78.5 },
    // 3 cups
    { x: 11.7, y: 31 },
    { x: 11.7, y: 50 },
    { x: 11.7, y: 69 },
    // 2 cups
    { x: 16.7, y: 40.5 },
    { x: 16.7, y: 59.5 },
    // 1 cup (tip, removed first if < 10)
    { x: 21.7, y: 50 },
  ];

  const rightCupPositions = [
    // Base column (4 cups)
    { x: 93.3, y: 21.5 },
    { x: 93.3, y: 40.5 },
    { x: 93.3, y: 59.5 },
    { x: 93.3, y: 78.5 },
    // 3 cups
    { x: 88.3, y: 31 },
    { x: 88.3, y: 50 },
    { x: 88.3, y: 69 },
    // 2 cups
    { x: 83.3, y: 40.5 },
    { x: 83.3, y: 59.5 },
    // 1 cup (tip, removed first if < 10)
    { x: 78.3, y: 50 },
  ];

  // Get active cups and sort them by Y to ensure correct 3D depth rendering
  const activeCups = [
    ...leftCupPositions.slice(0, Math.min(10, Math.max(0, leftCups))).map((p, i) => ({ ...p, side: "left", logicalIndex: i })),
    ...rightCupPositions.slice(0, Math.min(10, Math.max(0, rightCups))).map((p, i) => ({ ...p, side: "right", logicalIndex: i }))
  ].sort((a, b) => a.y - b.y);

  return (
    <div
      className={cn("w-full max-w-5xl mx-auto p-4 md:p-12", className)}
      style={{ perspective: "1000px" }}
    >
      <div
        className="relative w-full aspect-[33/10] bg-zinc-900 border-[12px] border-zinc-800 rounded-xl shadow-2xl"
        style={{
          transform: "rotateX(60deg)",
          transformStyle: "preserve-3d",
          boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.5)"
        }}
      >
        {/* Center line */}
        <div className="absolute top-0 bottom-0 left-1/2 w-1 bg-zinc-700 -translate-x-1/2" />

        {/* Render all active cups */}
        <AnimatePresence>
          {activeCups.map((cup) => (
            <motion.div
              key={`${cup.side}-${cup.logicalIndex}`}
              className="absolute"
              style={{
                left: `${cup.x}%`,
                top: `${cup.y}%`,
                width: '5.7%',
                height: '24%',
                transformStyle: "preserve-3d"
              }}
              initial={{ x: "-50%", y: "-100%", scale: 0 }}
              animate={{ x: "-50%", y: "-50%", scale: 1 }}
              exit={{ 
                x: "-50%", 
                y: "-50%", 
                scale: 0, 
                transition: { type: "tween", ease: "circIn", duration: 0.2, delay: (9 - cup.logicalIndex) * 0.06 } 
              }}
              transition={{ 
                type: "tween", 
                ease: "circOut",
                duration: 0.35,
                delay: cup.logicalIndex * 0.05 
              }}
            >
              {/* Flat shadow on the table */}
              <div 
                className="absolute bg-black/60 rounded-full blur-[3px]"
                style={{
                  left: '50%',
                  top: '50%',
                  width: '100%',
                  height: '79.16%',
                  transform: "translate(-50%, -50%) translateZ(1px)",
                }}
              />

              {/* Upright 3D Cup */}
              <div 
                className="absolute"
                style={{
                  left: '50%',
                  top: '50%',
                  width: '100%', 
                  height: '100%', 
                  // Rotate against the table tilt so the cup stands upright
                  transform: "translate(-50%, -92%) rotateX(-60deg) translateZ(1px)",
                  transformOrigin: "bottom center",
                }}
              >
                <SoloCup color={cup.side === "left" ? "red" : "blue"} className="w-full h-full" />
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}
