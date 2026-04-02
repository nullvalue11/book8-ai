"use client";

import React from "react";

export default function IPhoneMockup() {
  return (
    <div className="relative w-full max-w-[600px] lg:max-w-[700px] mx-auto overflow-hidden">
      {/* Hand holding iPhone image - cropped to show ONLY phone and hand */}
      <div className="relative" style={{ marginBottom: '-15%' }}>
        <img
          src="https://customer-assets.emergentagent.com/job_ops-api/artifacts/kexqk3mb_image.png"
          alt="Book8-AI mobile app"
          className="w-full h-auto"
          style={{
            clipPath: 'inset(8% 0 50% 0)',
            transform: 'scale(1.3)',
            transformOrigin: 'center 25%',
          }}
        />
      </div>
    </div>
  );
}
