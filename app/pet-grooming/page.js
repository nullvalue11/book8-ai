import IndustryPageTemplate from '@/components/IndustryPageTemplate'
import { petGroomingCopy } from '@/copy/industries'

export const metadata = {
  title: petGroomingCopy.meta.title,
  description: petGroomingCopy.meta.description,
  alternates: { canonical: '/pet-grooming' }
}

export default function PetGroomingPage() {
  return <IndustryPageTemplate {...petGroomingCopy} />
}
