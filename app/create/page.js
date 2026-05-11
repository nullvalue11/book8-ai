import { Suspense } from 'react'
import { headers } from 'next/headers'
import { Loader2 } from 'lucide-react'
import CreateWizardClient from './CreateWizardClient'

function CreateFallback() {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-[#0A0A0F]">
      <Loader2 className="h-8 w-8 animate-spin text-[#8B5CF6]" aria-hidden />
    </div>
  )
}

export default async function CreatePage() {
  const acceptLanguage = (await headers()).get('accept-language')
  return (
    <Suspense fallback={<CreateFallback />}>
      <CreateWizardClient acceptLanguageHint={acceptLanguage} />
    </Suspense>
  )
}
