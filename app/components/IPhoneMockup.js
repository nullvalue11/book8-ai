"use client";

import React from "react";

export default function IPhoneMockup({ showHeroContent = false }) {
  return (
    <div className="relative w-full max-w-[380px] mx-auto">
      {/* Decorative floating elements */}
      <div className="absolute -top-8 -left-8 w-24 h-24 rounded-full bg-brand-500/10 blur-2xl animate-pulse" />
      <div className="absolute -bottom-12 -right-12 w-32 h-32 rounded-full bg-accent/10 blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
      
      {/* Main container with hand and phone */}
      <div className="relative">
        {/* SVG Hand holding phone */}
        <svg 
          viewBox="0 0 400 580" 
          className="w-full h-auto drop-shadow-2xl"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
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
              <feDropShadow dx="0" dy="8" stdDeviation="12" floodColor="#000" floodOpacity="0.2"/>
            </filter>
          </defs>
          
          {/* Phone frame - behind hand */}
          <g>
            <rect x="105" y="30" width="190" height="410" rx="36" fill="#1a1a1a" stroke="#333" strokeWidth="2"/>
            <rect x="113" y="38" width="174" height="394" rx="30" fill="#0a0a0a"/>
          </g>
          
          {/* Hand */}
          <g filter="url(#handShadow)">
            {/* Thumb */}
            <path 
              d="M90 340 Q75 375 82 420 Q88 465 100 490 Q115 510 135 505 Q145 495 140 465 Q135 425 122 380 Q112 350 98 335 Z" 
              fill="url(#skinGradient)"
            />
            <path d="M97 355 Q88 390 92 430" stroke="url(#shadowGradient)" strokeWidth="2" fill="none" opacity="0.25"/>
            
            {/* Palm */}
            <path 
              d="M125 285 
                 Q102 310 95 360 
                 Q90 410 98 465 
                 Q108 520 140 565 
                 Q195 600 265 585 
                 Q315 570 335 520 
                 Q350 470 345 410 
                 Q340 350 325 305 
                 Q305 265 260 255 
                 Q200 245 155 260 
                 Q135 270 125 285 Z" 
              fill="url(#skinGradient)"
            />
            
            {/* Fingers curled around top */}
            <path d="M300 275 Q315 235 308 195 Q300 160 285 158 Q268 165 268 200 Q270 245 280 280" fill="url(#skinGradient)"/>
            <path d="M272 268 Q285 225 277 180 Q268 140 252 140 Q235 148 238 185 Q242 235 255 272" fill="url(#skinGradient)"/>
            <path d="M248 265 Q258 220 248 175 Q238 135 222 138 Q208 148 215 190 Q222 240 232 268" fill="url(#skinGradient)"/>
            <path d="M225 275 Q232 235 222 195 Q212 160 198 165 Q185 178 195 220 Q205 260 212 280" fill="url(#skinGradient)"/>
            
            {/* Finger shadow lines */}
            <path d="M293 200 Q290 230 292 265" stroke="url(#shadowGradient)" strokeWidth="1.5" fill="none" opacity="0.2"/>
            <path d="M265 175 Q262 210 265 260" stroke="url(#shadowGradient)" strokeWidth="1.5" fill="none" opacity="0.2"/>
            <path d="M238 170 Q235 210 240 258" stroke="url(#shadowGradient)" strokeWidth="1.5" fill="none" opacity="0.2"/>
            <path d="M210 185 Q208 220 215 268" stroke="url(#shadowGradient)" strokeWidth="1.5" fill="none" opacity="0.2"/>
            
            {/* Knuckle highlights */}
            <ellipse cx="288" cy="275" rx="10" ry="6" fill="white" opacity="0.08"/>
            <ellipse cx="260" cy="270" rx="10" ry="6" fill="white" opacity="0.08"/>
            <ellipse cx="235" cy="268" rx="10" ry="6" fill="white" opacity="0.08"/>
            <ellipse cx="212" cy="278" rx="10" ry="6" fill="white" opacity="0.08"/>
          </g>
          
          {/* Phone frame overlay - in front of hand */}
          <g>
            {/* Dynamic Island */}
            <rect x="165" y="48" width="70" height="24" rx="12" fill="#000"/>
            <circle cx="215" cy="60" r="5" fill="#1a1a1a"/>
            
            {/* Side buttons */}
            <rect x="99" y="120" width="4" height="35" rx="2" fill="#2a2a2a"/>
            <rect x="99" y="170" width="4" height="60" rx="2" fill="#2a2a2a"/>
            <rect x="297" y="150" width="4" height="50" rx="2" fill="#2a2a2a"/>
          </g>
        </svg>
        
        {/* Screen content - positioned over the SVG */}
        <div 
          className="absolute rounded-[26px] overflow-hidden"
          style={{
            top: '7.5%',
            left: '29.5%',
            width: '41%',
            height: '66%',
            background: 'linear-gradient(to bottom, hsl(222, 47%, 8%), hsl(222, 47%, 6%))',
          }}
        >
          {/* Screen inner content */}
          <div className="w-full h-full p-2.5 pt-8 overflow-hidden">
            {showHeroContent ? (
              /* Mobile hero content inside phone */
              <div className="h-full flex flex-col justify-center text-center px-1">
                <div className="mb-2">
                  <span className="inline-flex items-center rounded-full border border-brand-500/30 bg-brand-500/10 px-1.5 py-0.5 text-[7px] text-brand-500 font-medium">
                    AI-Powered
                  </span>
                </div>
                <h3 className="text-[10px] font-bold text-foreground leading-tight mb-1">
                  Intelligent Booking
                  <span className="block bg-brand-gradient bg-clip-text text-transparent">& Automation</span>
                </h3>
                <p className="text-[6px] text-muted-foreground leading-snug mb-2.5 px-0.5">
                  Connect calendars, enable voice/AI bookings, and leverage real-time web search.
                </p>
                <div className="flex flex-col gap-1 px-1">
                  <div className="h-5 rounded-md bg-brand-500 text-white text-[6px] font-medium flex items-center justify-center shadow-lg">
                    Start Free Trial
                  </div>
                  <div className="h-4 rounded-md border border-border text-[6px] text-muted-foreground flex items-center justify-center">
                    Watch Demo →
                  </div>
                </div>
              </div>
            ) : (
              /* App dashboard preview */
              <div className="h-full flex flex-col text-left">
                {/* Mini header */}
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-1">
                    <div className="w-4 h-4 rounded-md bg-brand-500 flex items-center justify-center">
                      <span className="text-white text-[5px] font-bold">B8</span>
                    </div>
                    <span className="text-[7px] font-semibold text-foreground">Book8 AI</span>
                  </div>
                  <div className="w-4 h-4 rounded-full bg-muted" />
                </div>
                
                {/* Dashboard content */}
                <div className="space-y-1.5 flex-1 overflow-hidden">
                  {/* Stats row */}
                  <div className="grid grid-cols-2 gap-1">
                    <div className="bg-card rounded-md p-1.5 border border-border/50">
                      <div className="text-[5px] text-muted-foreground">Today</div>
                      <div className="text-[8px] font-semibold text-foreground">5 Bookings</div>
                    </div>
                    <div className="bg-card rounded-md p-1.5 border border-border/50">
                      <div className="text-[5px] text-muted-foreground">This Week</div>
                      <div className="text-[8px] font-semibold text-foreground">23 Calls</div>
                    </div>
                  </div>
                  
                  {/* Upcoming booking */}
                  <div className="bg-card rounded-md p-1.5 border border-border/50">
                    <div className="text-[5px] text-muted-foreground mb-0.5">Next Meeting</div>
                    <div className="flex items-center gap-1.5">
                      <div className="w-5 h-5 rounded-full bg-brand-500/20 flex items-center justify-center flex-shrink-0">
                        <span className="text-[6px] text-brand-500 font-medium">JD</span>
                      </div>
                      <div className="min-w-0">
                        <div className="text-[7px] font-medium text-foreground truncate">John Doe</div>
                        <div className="text-[5px] text-muted-foreground truncate">2:00 PM - Strategy</div>
                      </div>
                    </div>
                  </div>
                  
                  {/* AI Assistant */}
                  <div className="bg-gradient-to-r from-brand-500/10 to-accent/10 rounded-md p-1.5 border border-brand-500/20">
                    <div className="flex items-center gap-1 mb-0.5">
                      <div className="w-3 h-3 rounded-full bg-brand-500 flex items-center justify-center">
                        <span className="text-[4px] text-white font-bold">AI</span>
                      </div>
                      <span className="text-[6px] font-medium text-foreground">Voice Agent</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <div className="flex-1 h-1 bg-brand-500/20 rounded-full overflow-hidden">
                        <div className="h-full w-3/5 bg-brand-500 rounded-full animate-pulse" />
                      </div>
                      <span className="text-[4px] text-brand-500">Active</span>
                    </div>
                  </div>
                  
                  {/* Calendar sync */}
                  <div className="bg-card rounded-md p-1.5 border border-border/50">
                    <div className="flex items-center gap-1">
                      <div className="w-3 h-3 rounded bg-green-500/20 flex items-center justify-center">
                        <span className="text-[5px] text-green-500">✓</span>
                      </div>
                      <span className="text-[6px] text-foreground">Google Calendar</span>
                    </div>
                  </div>
                </div>
                
                {/* Bottom nav */}
                <div className="flex justify-around pt-1.5 border-t border-border/30 mt-1">
                  {['🏠', '📅', '🤖', '⚙️'].map((icon, i) => (
                    <div key={i} className={`w-5 h-5 rounded-md flex items-center justify-center text-[8px] ${i === 0 ? 'bg-brand-500/20' : ''}`}>
                      {icon}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
      
      {/* "Try our Beta" annotation */}
      <div className="absolute -bottom-4 right-2 md:right-8 flex flex-col items-center">
        <span className="text-brand-500 font-handwriting text-base md:text-lg italic transform rotate-[-8deg] whitespace-nowrap">
          Try our Beta!
        </span>
        <svg className="w-6 h-6 text-brand-500 transform rotate-[15deg] -mt-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M12 5v14M5 12l7 7 7-7" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </div>
    </div>
  );
}
