"use client"

import * as React from "react"

export function useOnline(): boolean {
  const [online, setOnline] = React.useState(
    typeof navigator === "undefined" ? true : navigator.onLine
  )
  React.useEffect(() => {
    const goOnline = () => setOnline(true)
    const goOffline = () => setOnline(false)
    window.addEventListener("online", goOnline)
    window.addEventListener("offline", goOffline)
    return () => {
      window.removeEventListener("online", goOnline)
      window.removeEventListener("offline", goOffline)
    }
  }, [])
  return online
}
