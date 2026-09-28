import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { API_BASE_URL } from "../lib/api-base";

export interface SiteBranding {
  site_name?: string;
  site_description?: string;
  site_logo_url?: string;
  site_favicon_url?: string;
  meta_title?: string;
  meta_keywords?: string;
  footer_text?: string;
  telegram_bot_username?: string;
}

export function useBranding() {
  const query = useQuery<SiteBranding>({
    queryKey: ["site-branding"],
    queryFn: async () => {
      const r = await fetch(`${API_BASE_URL}/api/site/branding`, {
        credentials: "include",
      });
      if (!r.ok) return {};
      return r.json();
    },
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });

  return {
    branding: query.data ?? {},
    isLoading: query.isLoading,
  };
}

function setOrCreateLink(rel: string, href: string, type?: string) {
  let link = document.querySelector<HTMLLinkElement>(`link[rel="${rel}"]`);
  if (!link) {
    link = document.createElement("link");
    link.rel = rel;
    document.head.appendChild(link);
  }
  link.href = href;
  if (type) link.type = type;
}

function detectMime(dataUrl: string): string | undefined {
  if (!dataUrl.startsWith("data:")) return undefined;
  const m = dataUrl.match(/^data:([^;,]+)/);
  return m?.[1];
}

export function ApplyBranding() {
  const { branding } = useBranding();

  useEffect(() => {
    const title = (branding.meta_title || branding.site_name || "").trim();
    if (title) document.title = title;

    const desc = (branding.site_description || "").trim();
    if (desc) {
      let m = document.querySelector<HTMLMetaElement>('meta[name="description"]');
      if (!m) {
        m = document.createElement("meta");
        m.name = "description";
        document.head.appendChild(m);
      }
      m.content = desc;
    }

    const fav = (branding.site_favicon_url || "").trim();
    if (fav) {
      const mime = detectMime(fav) || "image/png";
      setOrCreateLink("icon", fav, mime);
      setOrCreateLink("apple-touch-icon", fav, mime);
    }
  }, [branding.meta_title, branding.site_name, branding.site_description, branding.site_favicon_url]);

  return null;
}
