// Server wrapper page to avoid prerender issues and keep SSG/ISR controls
export const dynamic = 'force-dynamic'
export const revalidate = 0

import HomeClient from './HomeClient'

export default function Page() {
  return <HomeClient />
}
