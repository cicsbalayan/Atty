"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Building2, CalendarDays, Home } from "lucide-react"
import { cn } from "@/lib/utils"

const links = [
  { href: "/", label: "Dashboard", icon: Home },
  { href: "/events", label: "Events", icon: CalendarDays },
  { href: "/organizations", label: "Organizations", icon: Building2 },
]

export function SideNav() {
  const pathname = usePathname()
  return (
    <nav aria-label="Primary" className="flex flex-col gap-2">
      {links.map(({ href, label, icon: Icon }) => {
        const active =
          href === "/" ? pathname === "/" : pathname.startsWith(href)
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "clay-btn flex items-center gap-2 px-4 py-2.5 text-sm font-medium",
              active ? "clay-pressed bg-card" : "bg-card/60 hover:bg-card"
            )}
          >
            <Icon className="size-4" aria-hidden />
            {label}
          </Link>
        )
      })}
    </nav>
  )
}
