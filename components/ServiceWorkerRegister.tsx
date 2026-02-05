'use client';

import { useEffect } from "react";
import { siteConfig } from "@/lib/siteConfig";

const normalizePath = (value: string) => {
  if (!value) return "";
  const trimmed = value.trim();
  if (!trimmed || trimmed === "/") return "";
  return trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
};

export function ServiceWorkerRegister() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator)) return;
    const basePath = normalizePath(siteConfig.basePath || "");
    const scope = basePath ? `${basePath}/` : "/";
    const swUrl = `${basePath}/sw.js`;
    navigator.serviceWorker.register(swUrl, { scope }).catch(() => {
      // ignore registration errors
    });
  }, []);

  return null;
}
