'use client'

import { Eye, EyeOff } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { blurMoney } from '@/lib/formatCurrency'
import { useBlur } from './BlurContext'

/**
 * @param {{
 *   title: string,
 *   primary: string,
 *   subtitle?: string|null,
 *   footNote?: string|null,
 *   isMoney?: boolean,
 *   currency?: string,
 *   amountForBlur?: number|null,
 *   className?: string
 * }} props
 */
export default function StatCard({
  title,
  primary,
  subtitle,
  footNote,
  isMoney = false,
  currency = 'CAD',
  amountForBlur,
  className = ''
}) {
  const { blurred } = useBlur()

  const displayPrimary =
    isMoney && blurred && amountForBlur != null && Number.isFinite(amountForBlur)
      ? blurMoney(amountForBlur, currency)
      : primary

  const displaySubtitle =
    subtitle && isMoney && blurred && amountForBlur != null
      ? subtitle.replace(/[\d.,]+/g, (m) => '•'.repeat(m.length))
      : subtitle

  return (
    <Card className={`relative ${className}`}>
      <CardHeader className="pb-2 pt-4 px-4">
        <div className="flex items-start justify-between gap-2">
          <span className="text-sm font-medium text-muted-foreground">{title}</span>
        </div>
      </CardHeader>
      <CardContent className="px-4 pb-4">
        <p className={`text-2xl md:text-3xl font-semibold tracking-tight ${blurred && isMoney ? 'select-none' : ''}`}>
          {displayPrimary}
        </p>
        {displaySubtitle ? (
          <p className="text-sm text-muted-foreground mt-1">{displaySubtitle}</p>
        ) : null}
        {footNote ? <p className="text-xs text-muted-foreground mt-2">{footNote}</p> : null}
      </CardContent>
    </Card>
  )
}

export function InsightsHeaderActions() {
  const { blurred, toggle } = useBlur()
  return (
    <div className="flex items-center gap-1" title="Toggle hiding dollar amounts (shortcut: b)">
      <Button type="button" variant="ghost" size="icon" onClick={toggle} aria-pressed={blurred}>
        {blurred ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
        <span className="sr-only">{blurred ? 'Show amounts' : 'Hide amounts'}</span>
      </Button>
    </div>
  )
}
