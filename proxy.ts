import { updateSession } from "@/lib/supabase/proxy";
import { type NextRequest } from "next/server";

export async function proxy(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  matcher: [
    /*
     * Run on everything except public, non-personal assets:
     * - _next/static, _next/image (build output, image optimizer)
     * - favicon, app icons, web app manifest, service worker, offline page
     * - image files
     * The manifest and service worker must stay public: browsers fetch the manifest without
     * cookies, so an auth redirect would break installation.
     */
    "/((?!_next/static|_next/image|favicon\\.ico|icon\\.svg|apple-icon\\.png|manifest\\.webmanifest|sw\\.js|offline\\.html|icons/|robots\\.txt|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
