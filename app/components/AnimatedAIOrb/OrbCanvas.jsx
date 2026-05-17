'use client'

import { Suspense } from 'react'
import { Canvas } from '@react-three/fiber'
import OrbMesh from './OrbMesh'

/**
 * WebGL canvas — loaded dynamically (no SSR).
 * @param {{ palette?: 'cyan' | 'bronze', animate?: boolean }} props
 */
export default function OrbCanvas({ palette = 'cyan', animate = true }) {
  return (
    <Canvas
      frameloop="always"
      camera={{ position: [0, 0, 2.5], fov: 50 }}
      dpr={[1, 1.5]}
      gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
      style={{ background: 'transparent' }}
    >
      <Suspense fallback={null}>
        <OrbMesh palette={palette} animate={animate} />
        <ambientLight intensity={0.3} />
        <pointLight position={[2, 2, 2]} intensity={0.5} />
      </Suspense>
    </Canvas>
  )
}
