'use client'

import { useEffect, useState } from 'react'

const DEFAULT_HEIGHT = 280

/**
 * Flip dropdown above the trigger when there is not enough viewport space below.
 * @param {React.RefObject<HTMLElement | null>} triggerRef
 * @param {number} dropdownHeightPx
 * @param {boolean} active
 */
export function useDropdownPlacement(triggerRef, dropdownHeightPx = DEFAULT_HEIGHT, active = true) {
  const [placement, setPlacement] = useState(/** @type {'bottom' | 'top'} */ ('bottom'))

  useEffect(() => {
    if (!active) {
      setPlacement('bottom')
      return
    }

    const checkPlacement = () => {
      const el = triggerRef.current
      if (!el) return
      const rect = el.getBoundingClientRect()
      const spaceBelow = window.innerHeight - rect.bottom
      const spaceAbove = rect.top

      if (spaceBelow < dropdownHeightPx && spaceAbove > dropdownHeightPx) {
        setPlacement('top')
      } else {
        setPlacement('bottom')
      }
    }

    checkPlacement()
    window.addEventListener('resize', checkPlacement)
    window.addEventListener('scroll', checkPlacement, true)

    return () => {
      window.removeEventListener('resize', checkPlacement)
      window.removeEventListener('scroll', checkPlacement, true)
    }
  }, [triggerRef, dropdownHeightPx, active])

  return placement
}
