"use client"
import Link from "next/link"
import { type ForesightRegisterOptions } from "js.foresight"
import useForesight from "../../hooks/useForesight"
import { useRouter } from "next/navigation"
import { ComponentPropsWithoutRef } from "react"

interface ForesightLinkProps
  extends Omit<ComponentPropsWithoutRef<typeof Link>, "prefetch">, Omit<ForesightRegisterOptions, "element" | "callback"> {
  children: React.ReactNode,
  beforePrefetch?: (event: { cancel: () => void }) => void,
  className?: string
}

export function ForesightPrefetchLink({ children, className, beforePrefetch, ...props }: ForesightLinkProps) {
  const router = useRouter() // import from "next/navigation" not "next/router"
  const { elementRef } = useForesight<HTMLAnchorElement>({
    callback: () => {
      let cancelled = false;
      const event = {
        cancel: () => {
          cancelled = true;
        }
      }
      if (beforePrefetch) {
        beforePrefetch(event);
      }
      if (cancelled) return;
      router.prefetch(props.href.toString())
    },
    hitSlop: props.hitSlop,
    name: props.name,
    meta: props.meta,
    reactivateAfter: props.reactivateAfter,
  })

  return (
    <Link {...props} ref={elementRef} className={className} prefetch={false}>
      {children}
    </Link>
  )
}
