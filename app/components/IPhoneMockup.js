"use client";

import React from "react";

export default function IPhoneMockup() {
  return (
    <div className="relative w-full max-w-[550px] lg:max-w-[650px] mx-auto">
      {/* Hand holding iPhone image - cropped to show ONLY phone and hand */}
      <div 
        className="relative overflow-hidden"
      >
        <img
          src="https://customer-assets.emergentagent.com/job_ops-api/artifacts/kexqk3mb_image.png"
          alt="Book8-AI mobile app"
          className="w-full h-auto"
          style={{
            clipPath: 'inset(10% 0 42% 0)',
            transform: 'scale(1.2)',
            transformOrigin: 'center top',
          }}
        />
      </div>
    </div>
  );
}
