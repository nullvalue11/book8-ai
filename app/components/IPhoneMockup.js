"use client";

import React from "react";
import Image from "next/image";
import Link from "next/link";

export default function IPhoneMockup({ showHeroContent = false }) {
  return (
    <div className="relative">
      {/* Hand holding iPhone container */}
      <div className="relative w-full max-w-[400px] mx-auto">
        {/* The hand image with iPhone */}
        <div className="relative">
          {/* iPhone frame overlay - creates the phone shape */}
          <div className="absolute top-[8%] left-[26%] w-[48%] h-[84%] rounded-[2rem] overflow-hidden bg-background shadow-2xl">
            {/* iPhone notch */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[35%] h-[3%] bg-black rounded-b-xl z-20" />
            
            {/* Screen content */}
            <div className="w-full h-full bg-gradient-to-b from-background to-muted/30 p-3 pt-6 overflow-hidden">
              {showHeroContent ? (
                /* Mobile hero content inside phone */
                <div className="h-full flex flex-col justify-center text-center px-2">
                  <div className="mb-2">
                    <span className="inline-flex items-center rounded-full border border-brand-500/30 bg-brand-500/10 px-2 py-0.5 text-[8px] text-brand-500 font-medium">
                      AI-Powered
                    </span>
                  </div>
                  <h3 className="text-[11px] font-semibold text-foreground leading-tight mb-1">
                    Intelligent Booking
                    <span className="block bg-brand-gradient bg-clip-text text-transparent">& Automation</span>
                  </h3>
                  <p className="text-[7px] text-muted-foreground leading-snug mb-3 px-1">
                    Connect calendars, enable voice/AI bookings, and leverage real-time web search.
                  </p>
                  <div className="flex flex-col gap-1.5 px-2">
                    <div className="h-6 rounded-md bg-brand-500 text-white text-[7px] font-medium flex items-center justify-center shadow-lg">
                      Start Free Trial
                    </div>
                    <div className="h-5 rounded-md border border-border text-[7px] text-muted-foreground flex items-center justify-center">
                      Watch Demo →
                    </div>
                  </div>
                </div>
              ) : (
                /* App dashboard preview */
                <div className="h-full flex flex-col">
                  {/* Mini header */}
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-1.5">
                      <div className="w-5 h-5 rounded-lg bg-brand-500 flex items-center justify-center">
                        <span className="text-white text-[6px] font-bold">B8</span>
                      </div>
                      <span className="text-[8px] font-semibold text-foreground">Book8 AI</span>
                    </div>
                    <div className="w-5 h-5 rounded-full bg-muted flex items-center justify-center">
                      <div className="w-3 h-3 rounded-full bg-brand-500/30" />
                    </div>
                  </div>
                  
                  {/* Dashboard cards */}
                  <div className="space-y-2 flex-1">
                    {/* Stats row */}
                    <div className="grid grid-cols-2 gap-1.5">
                      <div className="bg-card rounded-lg p-2 border border-border/50">
                        <div className="text-[6px] text-muted-foreground mb-0.5">Today</div>
                        <div className="text-[10px] font-semibold text-foreground">5 Bookings</div>
                      </div>
                      <div className="bg-card rounded-lg p-2 border border-border/50">
                        <div className="text-[6px] text-muted-foreground mb-0.5">This Week</div>
                        <div className="text-[10px] font-semibold text-foreground">23 Calls</div>
                      </div>
                    </div>
                    
                    {/* Upcoming booking */}
                    <div className="bg-card rounded-lg p-2 border border-border/50">
                      <div className="text-[6px] text-muted-foreground mb-1">Next Meeting</div>
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-brand-500/20 flex items-center justify-center">
                          <span className="text-[7px] text-brand-500 font-medium">JD</span>
                        </div>
                        <div className="flex-1">
                          <div className="text-[8px] font-medium text-foreground">John Doe</div>
                          <div className="text-[6px] text-muted-foreground">2:00 PM - Strategy Call</div>
                        </div>
                      </div>
                    </div>
                    
                    {/* AI Assistant preview */}
                    <div className="bg-gradient-to-r from-brand-500/10 to-accent/10 rounded-lg p-2 border border-brand-500/20">
                      <div className="flex items-center gap-1.5 mb-1">
                        <div className="w-4 h-4 rounded-full bg-brand-500 flex items-center justify-center">
                          <span className="text-[5px] text-white">AI</span>
                        </div>
                        <span className="text-[7px] font-medium text-foreground">Voice Agent Active</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <div className="flex-1 h-1 bg-brand-500/20 rounded-full overflow-hidden">
                          <div className="h-full w-2/3 bg-brand-500 rounded-full animate-pulse" />
                        </div>
                        <span className="text-[5px] text-brand-500">Listening...</span>
                      </div>
                    </div>
                    
                    {/* Calendar mini */}
                    <div className="bg-card rounded-lg p-2 border border-border/50">
                      <div className="text-[6px] text-muted-foreground mb-1">Calendar Sync</div>
                      <div className="flex items-center gap-1">
                        <div className="w-3 h-3 rounded bg-green-500/20 flex items-center justify-center">
                          <span className="text-[5px] text-green-500">✓</span>
                        </div>
                        <span className="text-[6px] text-foreground">Google Connected</span>
                      </div>
                    </div>
                  </div>
                  
                  {/* Bottom nav */}
                  <div className="flex justify-around mt-2 pt-2 border-t border-border/30">
                    {['Home', 'Book', 'AI', 'More'].map((item, i) => (
                      <div key={item} className="flex flex-col items-center">
                        <div className={`w-4 h-4 rounded-md ${i === 0 ? 'bg-brand-500' : 'bg-muted'} mb-0.5`} />
                        <span className={`text-[5px] ${i === 0 ? 'text-brand-500' : 'text-muted-foreground'}`}>{item}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
          
          {/* Hand SVG illustration */}
          <svg 
            viewBox="0 0 400 600" 
            className="w-full h-auto drop-shadow-2xl"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            {/* Hand shape */}
            <defs>
              <linearGradient id="skinGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#E8B89D" />
                <stop offset="50%" stopColor="#D4A088" />
                <stop offset="100%" stopColor="#C49178" />
              </linearGradient>
              <linearGradient id="shadowGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#B8846C" />
                <stop offset="100%" stopColor="#A07560" />
              </linearGradient>
              <filter id="handShadow" x="-20%" y="-20%" width="140%" height="140%">
                <feDropShadow dx="0" dy="10" stdDeviation="15" floodColor="#000" floodOpacity="0.15"/>
              </filter>
            </defs>
            
            {/* Main hand */}
            <g filter="url(#handShadow)">
              {/* Thumb */}
              <path 
                d="M95 350 Q80 380 85 420 Q90 460 100 480 Q110 500 130 500 Q140 490 138 470 Q135 440 125 400 Q118 370 105 350 Z" 
                fill="url(#skinGradient)"
              />
              <path 
                d="M100 360 Q92 385 95 415 Q98 445 105 465" 
                stroke="url(#shadowGradient)" 
                strokeWidth="2" 
                fill="none"
                opacity="0.3"
              />
              
              {/* Palm and fingers holding phone */}
              <path 
                d="M130 300 
                   Q110 320 100 360 
                   Q95 400 100 450 
                   Q105 500 130 550 
                   Q180 600 250 590 
                   Q300 580 320 540 
                   Q340 500 340 450 
                   Q340 400 330 350 
                   Q320 310 290 290 
                   Q250 270 200 275 
                   Q160 280 130 300 Z" 
                fill="url(#skinGradient)"
              />
              
              {/* Finger details */}
              <path 
                d="M290 295 Q300 260 295 230 Q290 200 280 195 Q265 195 260 225 Q255 260 265 290" 
                fill="url(#skinGradient)"
              />
              <path 
                d="M265 285 Q275 245 270 210 Q265 175 255 170 Q240 172 238 200 Q235 240 245 280" 
                fill="url(#skinGradient)"
              />
              <path 
                d="M240 280 Q248 240 243 200 Q238 165 228 162 Q215 165 215 195 Q215 240 222 278" 
                fill="url(#skinGradient)"
              />
              <path 
                d="M215 285 Q220 250 215 215 Q210 185 200 185 Q188 190 190 220 Q195 260 200 285" 
                fill="url(#skinGradient)"
              />
              
              {/* Finger shadow lines */}
              <path d="M285 230 Q282 250 283 280" stroke="url(#shadowGradient)" strokeWidth="1.5" fill="none" opacity="0.2"/>
              <path d="M260 205 Q258 230 260 270" stroke="url(#shadowGradient)" strokeWidth="1.5" fill="none" opacity="0.2"/>
              <path d="M235 195 Q233 230 235 270" stroke="url(#shadowGradient)" strokeWidth="1.5" fill="none" opacity="0.2"/>
              <path d="M205 210 Q205 240 205 275" stroke="url(#shadowGradient)" strokeWidth="1.5" fill="none" opacity="0.2"/>
              
              {/* Knuckle highlights */}
              <ellipse cx="280" cy="290" rx="8" ry="5" fill="white" opacity="0.1"/>
              <ellipse cx="255" cy="285" rx="8" ry="5" fill="white" opacity="0.1"/>
              <ellipse cx="230" cy="282" rx="8" ry="5" fill="white" opacity="0.1"/>
              <ellipse cx="205" cy="288" rx="8" ry="5" fill="white" opacity="0.1"/>
            </g>
            
            {/* Phone frame */}
            <rect 
              x="105" 
              y="48" 
              width="190" 
              height="400" 
              rx="32" 
              fill="#1a1a1a"
              stroke="#2a2a2a"
              strokeWidth="3"
            />
            {/* Phone inner bezel */}
            <rect 
              x="112" 
              y="55" 
              width="176" 
              height="386" 
              rx="28" 
              fill="#111"
            />
            {/* Screen area (transparent to show content behind) */}
            <rect 
              x="116" 
              y="62" 
              width="168" 
              height="372" 
              rx="24" 
              fill="transparent"
            />
            {/* Dynamic island / notch */}
            <rect 
              x="165" 
              y="68" 
              width="70" 
              height="22" 
              rx="11" 
              fill="#000"
            />
            {/* Camera dot */}
            <circle cx="215" cy="79" r="4" fill="#1a1a1a" />
            {/* Side buttons */}
            <rect x="100" y="140" width="3" height="35" rx="1" fill="#2a2a2a" />
            <rect x="100" y="190" width="3" height="55" rx="1" fill="#2a2a2a" />
            <rect x="297" y="170" width="3" height="50" rx="1" fill="#2a2a2a" />
          </svg>
        </div>
      </div>
      
      {/* Decorative floating elements */}
      <div className="absolute -top-4 -left-4 w-20 h-20 rounded-full bg-brand-500/10 blur-2xl animate-pulse" />
      <div className="absolute -bottom-8 -right-8 w-32 h-32 rounded-full bg-accent/10 blur-3xl animate-pulse delay-1000" />
      
      {/* "Try our Beta" annotation - similar to booked.ai */}
      <div className="absolute -bottom-2 right-0 md:right-4 flex flex-col items-center">
        <span className="text-brand-500 font-handwriting text-lg md:text-xl italic transform rotate-[-8deg]">
          Try our Beta!
        </span>
        <svg className="w-8 h-8 text-brand-500 transform rotate-[20deg] -mt-1" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M12 5v14M5 12l7 7 7-7" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </div>
    </div>
  );
}
