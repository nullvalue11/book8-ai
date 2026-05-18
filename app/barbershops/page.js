import IndustryPageTemplate from '@/components/IndustryPageTemplate'
import { barbershopsCopy } from '@/copy/industries'

export const metadata = {
  title: barbershopsCopy.meta.title,
  description: barbershopsCopy.meta.description,
  alternates: { canonical: '/barbershops' }
}

export default function BarbershopsPage() {
  return <IndustryPageTemplate {...barbershopsCopy} />
}
