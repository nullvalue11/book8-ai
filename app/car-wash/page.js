import IndustryPageTemplate from '@/components/IndustryPageTemplate'
import { carWashCopy } from '@/copy/industries'

export const metadata = {
  title: carWashCopy.meta.title,
  description: carWashCopy.meta.description,
  alternates: { canonical: '/car-wash' }
}

export default function CarWashPage() {
  return <IndustryPageTemplate {...carWashCopy} />
}
