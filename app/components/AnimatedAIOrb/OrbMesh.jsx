'use client'

import { useRef, useMemo, useEffect } from 'react'
import { useFrame } from '@react-three/fiber'
import { Color, Vector3 } from 'three'
import vertexShader from './shaders/vertex.glsl'
import fragmentShader from './shaders/fragment.glsl'

const PALETTES = {
  cyan: {
    colorPrimary: new Color('#0EE6CC'),
    colorMid: new Color('#3AB4FF'),
    colorDeep: new Color('#1E4A8C')
  },
  bronze: {
    colorPrimary: new Color('#E8C094'),
    colorMid: new Color('#C8A57F'),
    colorDeep: new Color('#7A5232')
  }
}

/**
 * @param {{ palette?: 'cyan' | 'bronze', animate?: boolean }} props
 */
export default function OrbMesh({ palette = 'cyan', animate = true }) {
  const meshRef = useRef(null)
  const materialRef = useRef(null)
  const cameraPos = useMemo(() => new Vector3(), [])

  const uniforms = useMemo(() => {
    const colors = PALETTES[palette] || PALETTES.cyan
    return {
      uTime: { value: 0 },
      uColorPrimary: { value: colors.colorPrimary.clone() },
      uColorMid: { value: colors.colorMid.clone() },
      uColorDeep: { value: colors.colorDeep.clone() },
      uNoiseScale: { value: 1.5 },
      uDisplacement: { value: 0.15 },
      uPulse: { value: 1.0 },
      uCameraPosition: { value: cameraPos }
    }
  }, [palette, cameraPos])

  useEffect(() => {
    if (!materialRef.current) return
    const c = PALETTES[palette] || PALETTES.cyan
    materialRef.current.uniforms.uColorPrimary.value.copy(c.colorPrimary)
    materialRef.current.uniforms.uColorMid.value.copy(c.colorMid)
    materialRef.current.uniforms.uColorDeep.value.copy(c.colorDeep)
  }, [palette])

  useFrame((state, delta) => {
    if (!materialRef.current) return
    state.camera.getWorldPosition(cameraPos)
    materialRef.current.uniforms.uCameraPosition.value.copy(cameraPos)

    if (!animate) return

    materialRef.current.uniforms.uTime.value += delta
    const breathing = Math.sin(state.clock.elapsedTime * 0.5) * 0.05 + 1.0
    materialRef.current.uniforms.uPulse.value = breathing

    if (meshRef.current) {
      meshRef.current.rotation.y += delta * 0.1
    }
  })

  return (
    <mesh ref={meshRef}>
      <sphereGeometry args={[1, 128, 128]} />
      <shaderMaterial
        ref={materialRef}
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
        uniforms={uniforms}
        transparent
      />
    </mesh>
  )
}
