import IndustryPageTemplate from '@/components/IndustryPageTemplate'
import { autoRepairCopy } from '@/copy/industries'

export const metadata = {
  title: autoRepairCopy.meta.title,
  description: autoRepairCopy.meta.description,
  alternates: { canonical: '/auto-repair' }
}

export default function AutoRepairPage() {
  return <IndustryPageTemplate {...autoRepairCopy} />
}
