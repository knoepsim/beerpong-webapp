"use client";

import { useState } from "react";
import { BeerpongTable } from "@/components/BeerpongTable";
import { Slider } from "@/components/ui/slider";

export default function Home() {
  const [leftCups, setLeftCups] = useState(10);
  const [rightCups, setRightCups] = useState(10);

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-8 gap-12">
      <div className="text-center space-y-2">
        <h1 className="text-4xl font-bold tracking-tight">Beerpong Table</h1>
        <p className="text-muted-foreground">Adjust the sliders to change the number of cups.</p>
      </div>

      <BeerpongTable leftCups={leftCups} rightCups={rightCups} />

      <div className="flex flex-col md:flex-row gap-12 w-full max-w-2xl bg-card p-8 rounded-xl border shadow-sm">
        <div className="flex-1 space-y-4">
          <div className="flex justify-between items-center">
            <label htmlFor="red-cups" className="text-sm font-medium">Red Team Cups</label>
            <span className="text-sm font-bold bg-red-100 text-red-600 px-2 py-1 rounded-md dark:bg-red-900/30 dark:text-red-400">
              {leftCups}
            </span>
          </div>
          <Slider 
            id="red-cups"
            value={[leftCups]} 
            onValueChange={(val) => setLeftCups(val[0])} 
            max={10} 
            step={1} 
          />
        </div>

        <div className="flex-1 space-y-4">
          <div className="flex justify-between items-center">
            <label htmlFor="blue-cups" className="text-sm font-medium">Blue Team Cups</label>
            <span className="text-sm font-bold bg-blue-100 text-blue-600 px-2 py-1 rounded-md dark:bg-blue-900/30 dark:text-blue-400">
              {rightCups}
            </span>
          </div>
          <Slider 
            id="blue-cups"
            value={[rightCups]} 
            onValueChange={(val) => setRightCups(val[0])} 
            max={10} 
            step={1} 
          />
        </div>
      </div>
    </div>
  );
}
