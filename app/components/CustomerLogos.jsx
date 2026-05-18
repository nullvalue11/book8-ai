import Image from 'next/image'
import Link from 'next/link'

const customers = [
  {
    name: 'Diamond Car Wash',
    logo: '/customers/diamond-car-wash.png',
    href: '/b/diamond-car-wash-rideau',
    locations: 'Rideau + Findlay Creek, Ottawa'
  }
]

/**
 * @param {{ heading?: string, className?: string }} props
 */
export default function CustomerLogos({
  heading = 'Used by businesses like:',
  className = ''
}) {
  if (customers.length === 0) return null

  return (
    <section
      className={`py-10 px-4 border-b border-slate-200 dark:border-[rgba(139,92,246,0.08)] ${className}`}
      aria-label={heading}
    >
      <div className="mx-auto max-w-6xl">
        <p className="text-center text-sm text-slate-500 dark:text-[#68668A] mb-6 uppercase tracking-wider">
          {heading}
        </p>
        <div className="flex flex-wrap items-center justify-center gap-8 md:gap-12">
          {customers.map((c) => (
            <Link
              key={c.name}
              href={c.href}
              className="group flex flex-col items-center gap-2 opacity-80 hover:opacity-100 transition-opacity focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8B5CF6] focus-visible:ring-offset-2 rounded-lg"
            >
              <Image
                src={c.logo}
                alt={`${c.name} logo`}
                width={120}
                height={60}
                className="h-10 w-auto max-w-[140px] sm:h-12 sm:max-w-[160px] object-contain grayscale group-hover:grayscale-0 transition-[filter] duration-300"
              />
              <span className="text-sm font-medium text-slate-700 dark:text-[#EEEDF5] group-hover:text-slate-900 dark:group-hover:text-white">
                {c.name}
              </span>
              {c.locations ? (
                <span className="text-xs text-slate-500 dark:text-[#68668A] group-hover:text-slate-600 dark:group-hover:text-[#9593A8]">
                  {c.locations}
                </span>
              ) : null}
            </Link>
          ))}
        </div>
      </div>
    </section>
  )
}
