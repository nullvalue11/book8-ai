"use client";

import React from "react";

export default function IPhoneMockup() {
  return (
    <div className="relative w-full max-w-[500px] lg:max-w-[600px] mx-auto">
      {/* Hand holding iPhone image - cropped to show only phone and hand */}
      <div 
        className="relative overflow-hidden"
        style={{
          /* Crop out the header and footer from the image */
          marginTop: '-8%',
          marginBottom: '-35%',
        }}
      >
        <img
          src="https://customer-assets.emergentagent.com/job_ops-api/artifacts/kexqk3mb_image.png"
          alt="Book8-AI mobile app"
          className="w-full h-auto scale-110"
          style={{
            clipPath: 'inset(8% 0 35% 0)',
          }}
        />
      </div>
    </div>
  );
}
