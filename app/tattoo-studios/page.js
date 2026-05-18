import IndustryPageTemplate from '@/components/IndustryPageTemplate'
import { tattooStudiosCopy } from '@/copy/industries'

export const metadata = {
  title: tattooStudiosCopy.meta.title,
  description: tattooStudiosCopy.meta.description,
  alternates: { canonical: '/tattoo-studios' }
}

export default function TattooStudiosPage() {
  return <IndustryPageTemplate {...tattooStudiosCopy} />
}
