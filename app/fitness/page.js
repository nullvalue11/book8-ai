import IndustryPageTemplate from '@/components/IndustryPageTemplate'
import { fitnessCopy } from '@/copy/industries'

export const metadata = {
  title: fitnessCopy.meta.title,
  description: fitnessCopy.meta.description,
  alternates: { canonical: '/fitness' }
}

export default function FitnessPage() {
  return <IndustryPageTemplate {...fitnessCopy} />
}
