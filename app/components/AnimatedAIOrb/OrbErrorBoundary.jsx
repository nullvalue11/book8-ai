'use client'

import React from 'react'
import OrbStaticFallback from './OrbStaticFallback'

export default class OrbErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  componentDidCatch(err) {
    console.warn('[AnimatedAIOrb] render failed, using static fallback', err)
  }

  render() {
    if (this.state.hasError) {
      return <OrbStaticFallback palette={this.props.palette || 'cyan'} />
    }
    return this.props.children
  }
}
