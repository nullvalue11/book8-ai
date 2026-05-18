import IndustryPageTemplate from '@/components/IndustryPageTemplate'
import { cleaningServicesCopy } from '@/copy/industries'

export const metadata = {
  title: cleaningServicesCopy.meta.title,
  description: cleaningServicesCopy.meta.description,
  alternates: { canonical: '/cleaning-services' }
}

export default function CleaningServicesPage() {
  return <IndustryPageTemplate {...cleaningServicesCopy} />
}
