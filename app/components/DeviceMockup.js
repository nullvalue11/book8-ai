"use client";

import React from "react";
import Image from "next/image";

export default function DeviceMockup() {
  // Screen content that will be displayed on both laptop and iPhone
  const ScreenContent = ({ isPhone = false }) => (
    <div className={`w-full h-full flex flex-col ${isPhone ? 'p-2' : 'p-4 md:p-6'} overflow-hidden`}
      style={{
        background: 'linear-gradient(135deg, #0f0f23 0%, #1a1a2e 50%, #16213e 100%)',
      }}
    >
      {/* Header */}
      <div className={`flex items-center justify-between ${isPhone ? 'mb-2' : 'mb-4'}`}>
        <div className="flex items-center gap-1.5">
          <div className={`${isPhone ? 'w-4 h-4' : 'w-6 h-6'} rounded-lg bg-[#7C4DFF] flex items-center justify-center`}>
            <span className={`text-white ${isPhone ? 'text-[5px]' : 'text-[8px]'} font-bold`}>B8</span>
          </div>
          <span className={`font-semibold text-white ${isPhone ? 'text-[7px]' : 'text-[11px]'}`}>book8-ai</span>
        </div>
        <div className={`flex gap-1 ${isPhone ? 'gap-0.5' : 'gap-1.5'}`}>
          <div className={`${isPhone ? 'px-1.5 py-0.5 text-[5px]' : 'px-2 py-1 text-[8px]'} rounded-md bg-white/10 text-white/70`}>Pricing</div>
          <div className={`${isPhone ? 'px-1.5 py-0.5 text-[5px]' : 'px-2 py-1 text-[8px]'} rounded-md bg-[#7C4DFF] text-white`}>Get Started</div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col items-center justify-center text-center">
        {/* Badge */}
        <div className={`inline-flex items-center rounded-full border border-[#7C4DFF]/40 bg-[#7C4DFF]/15 ${isPhone ? 'px-2 py-0.5 mb-2' : 'px-3 py-1 mb-4'}`}>
          <span className={`${isPhone ? 'w-1 h-1 mr-1' : 'w-1.5 h-1.5 mr-1.5'} rounded-full bg-[#7C4DFF] animate-pulse`}></span>
          <span className={`${isPhone ? 'text-[6px]' : 'text-[9px]'} text-[#7C4DFF] font-medium`}>AI-Powered Scheduling</span>
        </div>

        {/* Headline */}
        <h1 className={`font-bold text-white leading-tight ${isPhone ? 'text-[12px] mb-1.5' : 'text-[20px] md:text-[24px] mb-3'}`}>
          Intelligent Booking
          <span className="block text-[#7C4DFF]">& Automation</span>
        </h1>

        {/* Subheadline */}
        <p className={`text-gray-400 leading-relaxed ${isPhone ? 'text-[6px] mb-3 px-1' : 'text-[10px] md:text-[12px] mb-5 max-w-[80%]'}`}>
          Connect calendars, enable voice/AI bookings, and leverage real-time web search—all in one platform.
        </p>

        {/* CTA Buttons */}
        <div className={`flex ${isPhone ? 'flex-col gap-1.5 w-full px-2' : 'flex-row gap-2'}`}>
          <div className={`${isPhone ? 'py-1.5 text-[7px]' : 'px-4 py-2 text-[10px]'} rounded-lg bg-[#7C4DFF] text-white font-medium text-center shadow-lg shadow-[#7C4DFF]/30`}>
            Start Free Trial
          </div>
          <div className={`${isPhone ? 'py-1 text-[7px]' : 'px-4 py-2 text-[10px]'} rounded-lg border border-gray-600 text-gray-300 font-medium text-center flex items-center justify-center gap-1`}>
            <span>▶</span> Watch Demo
          </div>
        </div>

        {/* Trust Indicators */}
        <div className={`flex items-center justify-center ${isPhone ? 'gap-2 mt-2' : 'gap-4 mt-4'}`}>
          {['No credit card', '14-day trial', 'Cancel anytime'].map((text, i) => (
            <div key={i} className={`flex items-center gap-0.5 ${isPhone ? 'text-[4px]' : 'text-[8px]'} text-gray-400`}>
              <span className="text-green-400">✓</span>
              <span>{text}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Feature Icons Row */}
      <div className={`flex justify-center ${isPhone ? 'gap-3 mt-2' : 'gap-6 mt-4'}`}>
        {[
          { icon: '📅', label: 'Calendar' },
          { icon: '🎙️', label: 'Voice AI' },
          { icon: '🔍', label: 'Search' },
          { icon: '📱', label: 'Mobile' },
        ].map((item, i) => (
          <div key={i} className="flex flex-col items-center">
            <div className={`${isPhone ? 'w-5 h-5 text-[8px]' : 'w-8 h-8 text-[14px]'} rounded-lg bg-white/5 border border-white/10 flex items-center justify-center`}>
              {item.icon}
            </div>
            <span className={`${isPhone ? 'text-[4px]' : 'text-[7px]'} text-gray-500 mt-0.5`}>{item.label}</span>
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <div className="relative w-full max-w-5xl mx-auto">
      {/* Background decorative elements */}
      <div className="absolute -top-10 -left-10 w-40 h-40 rounded-full bg-[#7C4DFF]/10 blur-3xl"></div>
      <div className="absolute -bottom-10 -right-10 w-60 h-60 rounded-full bg-[#7C4DFF]/5 blur-3xl"></div>
      
      {/* Mockup container */}
      <div className="relative">
        {/* Base mockup image */}
        <img
          src="https://customer-assets.emergentagent.com/job_ops-api/artifacts/f3ldfcl8_iphone%20%2B%20laptop%20mockup_demo.jpg"
          alt="book8-ai on laptop and mobile"
          className="w-full h-auto"
        />
        
        {/* Laptop screen overlay */}
        <div 
          className="absolute overflow-hidden"
          style={{
            top: '22%',
            left: '7%',
            width: '66%',
            height: '55%',
            borderRadius: '0.5%',
          }}
        >
          <ScreenContent isPhone={false} />
        </div>
        
        {/* iPhone screen overlay */}
        <div 
          className="absolute overflow-hidden"
          style={{
            top: '40%',
            left: '76.5%',
            width: '17%',
            height: '45%',
            borderRadius: '4%',
          }}
        >
          <ScreenContent isPhone={true} />
        </div>
      </div>
      
      {/* "Try our Beta" annotation */}
      <div className="absolute -bottom-4 right-4 md:right-20 flex flex-col items-center">
        <span className="text-[#7C4DFF] font-handwriting text-lg md:text-xl italic transform rotate-[-8deg] whitespace-nowrap">
          Try our Beta!
        </span>
        <svg className="w-6 h-6 text-[#7C4DFF] transform rotate-[15deg] -mt-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M12 5v14M5 12l7 7 7-7" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </div>
    </div>
  );
}
