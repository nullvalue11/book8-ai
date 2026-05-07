import { Suspense } from 'react'
import { Loader2 } from 'lucide-react'
import CreateWizardClient from './CreateWizardClient'

function CreateFallback() {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-[#0A0A0F]">
      <Loader2 className="h-8 w-8 animate-spin text-[#8B5CF6]" aria-hidden />
    </div>
  )
}

export default function CreatePage() {
  return (
    <Suspense fallback={<CreateFallback />}>
      <CreateWizardClient />
    </Suspense>
  )
}
