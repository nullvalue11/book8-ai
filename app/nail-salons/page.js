import IndustryPageTemplate from '@/components/IndustryPageTemplate'
import { nailSalonsCopy } from '@/copy/industries'

export const metadata = {
  title: nailSalonsCopy.meta.title,
  description: nailSalonsCopy.meta.description,
  alternates: { canonical: '/nail-salons' }
}

export default function NailSalonsPage() {
  return <IndustryPageTemplate {...nailSalonsCopy} />
}
