"use client";

import React from "react";

export default function IPhoneMockup() {
  return (
    <div className="relative w-full max-w-[420px] mx-auto">
      {/* Decorative floating elements */}
      <div className="absolute -top-8 -left-8 w-24 h-24 rounded-full bg-brand-500/10 blur-2xl animate-pulse" />
      <div className="absolute -bottom-12 -right-12 w-32 h-32 rounded-full bg-accent/10 blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
      
      {/* Hand holding iPhone image */}
      <div className="relative">
        <img
          src="https://customer-assets.emergentagent.com/job_ops-api/artifacts/kexqk3mb_image.png"
          alt="Book8-AI mobile app"
          className="w-full h-auto drop-shadow-2xl"
        />
      </div>
      
      {/* "Try our Beta" annotation */}
      <div className="absolute -bottom-2 right-4 md:right-8 flex flex-col items-center">
        <span className="text-[#7C4DFF] font-handwriting text-base md:text-lg italic transform rotate-[-8deg] whitespace-nowrap">
          Try our Beta!
        </span>
        <svg className="w-6 h-6 text-[#7C4DFF] transform rotate-[15deg] -mt-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M12 5v14M5 12l7 7 7-7" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </div>
    </div>
  );
}
