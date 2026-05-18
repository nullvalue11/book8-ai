import IndustryPageTemplate from '@/components/IndustryPageTemplate'
import { salonsCopy } from '@/copy/industries'

export const metadata = {
  title: salonsCopy.meta.title,
  description: salonsCopy.meta.description,
  alternates: { canonical: '/salons' }
}

export default function SalonsPage() {
  return <IndustryPageTemplate {...salonsCopy} />
}
