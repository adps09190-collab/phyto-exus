"use client";

import { useState } from "react";
import { AnimatePresence } from "framer-motion";
import { CinematicFooter } from "@/components/ui/motion-footer";
import { VirtualDemo } from "@/components/ui/virtual-demo";
import { HardwareDemo } from "@/components/ui/hardware-demo";

export default function Demo() {
  const [virtualOpen, setVirtualOpen] = useState(false);
  const [hardwareOpen, setHardwareOpen] = useState(false);

  return (
    <div className="relative w-full bg-background min-h-screen font-sans selection:bg-white/20 overflow-x-hidden">

      {/*
        MAIN CONTENT AREA
        We use a high z-index and minimum height to allow the user
        to scroll down and reveal the footer securely underneath.
      */}
      <main className="relative z-10 w-full min-h-[120vh] bg-background flex flex-col items-center justify-center text-white border-b border-white/10 shadow-m rounded-b-3xl">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_center,rgba(255,255,255,0.03)_0%,transparent_60%)] pointer-events-none" />

        <h1 className="text-4xl md:text-6xl font-light tracking-[0.2em] text-neutral-400 mb-8 uppercase text-center px-4">
          PHYTONEXUS
        </h1>

        <div className="w-[1px] h-32 bg-gradient-to-b from-neutral-400 to-transparent" />
      </main>

      {/* The Cinematic Footer is injected here */}
      <CinematicFooter
        onVirtualDemo={() => setVirtualOpen(true)}
        onHardwareDemo={() => setHardwareOpen(true)}
      />

      {/* Virtual Demonstration dashboard (PDF §4.1) — mounted only while open */}
      <AnimatePresence>
        {virtualOpen && <VirtualDemo open onClose={() => setVirtualOpen(false)} />}
      </AnimatePresence>

      {/* Hardware Demonstration (PDF §4.3) — mounted only while open */}
      <AnimatePresence>
        {hardwareOpen && <HardwareDemo open onClose={() => setHardwareOpen(false)} />}
      </AnimatePresence>

    </div>
  );
}
