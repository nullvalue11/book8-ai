import IndustryPageTemplate from '@/components/IndustryPageTemplate'
import { spasCopy } from '@/copy/industries'

export const metadata = {
  title: spasCopy.meta.title,
  description: spasCopy.meta.description,
  alternates: { canonical: '/spas' }
}

export default function SpasPage() {
  return <IndustryPageTemplate {...spasCopy} />
}
