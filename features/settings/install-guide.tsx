"use client";

import { CheckCircle2, Monitor, Smartphone } from "lucide-react";
import { useEffect, useState, useSyncExternalStore } from "react";
import { Button } from "@/components/ui/button";

/** Chromium's install prompt event (not in the standard DOM typings). */
type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

function subscribeDisplayMode(listener: () => void) {
  const media = window.matchMedia("(display-mode: standalone)");
  media.addEventListener("change", listener);
  return () => media.removeEventListener("change", listener);
}

function isStandalone(): boolean {
  const iosStandalone = (navigator as Navigator & { standalone?: boolean }).standalone === true;
  return window.matchMedia("(display-mode: standalone)").matches || iosStandalone;
}

export function InstallGuide() {
  const installed = useSyncExternalStore(subscribeDisplayMode, isStandalone, () => false);
  const [promptEvent, setPromptEvent] = useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    const onPrompt = (event: Event) => {
      event.preventDefault();
      setPromptEvent(event as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);

  return (
    <div className="grid gap-4 text-sm">
      {installed ? (
        <p className="inline-flex items-center gap-2 text-income">
          <CheckCircle2 className="size-4" aria-hidden="true" />
          You are using the installed LifeOS app.
        </p>
      ) : promptEvent ? (
        <Button
          variant="primary"
          className="justify-self-start"
          onClick={async () => {
            await promptEvent.prompt();
            await promptEvent.userChoice;
            setPromptEvent(null);
          }}
        >
          Install LifeOS on this device
        </Button>
      ) : null}

      <section aria-labelledby="install-windows" className="grid gap-1.5">
        <h3 id="install-windows" className="flex items-center gap-2 font-medium text-fg">
          <Monitor className="size-4 text-fg-muted" aria-hidden="true" />
          Windows (Edge or Chrome)
        </h3>
        <ol className="list-decimal space-y-1 pl-5 text-fg-muted">
          <li>Open LifeOS at its HTTPS address and sign in.</li>
          <li>
            Click the <strong className="text-fg">Install app</strong> icon in the address bar, or open the browser menu →{" "}
            <strong className="text-fg">Apps → Install this site as an app</strong>.
          </li>
          <li>LifeOS opens in its own window and appears in the Start menu; you can pin it to the taskbar.</li>
        </ol>
      </section>

      <section aria-labelledby="install-iphone" className="grid gap-1.5">
        <h3 id="install-iphone" className="flex items-center gap-2 font-medium text-fg">
          <Smartphone className="size-4 text-fg-muted" aria-hidden="true" />
          iPhone (Safari)
        </h3>
        <ol className="list-decimal space-y-1 pl-5 text-fg-muted">
          <li>Open LifeOS in Safari.</li>
          <li>
            Tap <strong className="text-fg">Share</strong> → <strong className="text-fg">Add to Home Screen</strong>, then{" "}
            <strong className="text-fg">Add</strong>.
          </li>
          <li>
            Open LifeOS from the Home Screen and <strong className="text-fg">sign in once more</strong>: the installed app keeps
            its own session, separate from Safari.
          </li>
        </ol>
      </section>

      <section aria-labelledby="install-limits" className="grid gap-1.5 rounded-lg bg-muted p-3">
        <h3 id="install-limits" className="font-medium text-fg">
          What the installed app does — and doesn&apos;t
        </h3>
        <ul className="list-disc space-y-1 pl-5 text-xs text-fg-muted">
          <li>It is the same web app in its own window, not a native app from an app store.</li>
          <li>It needs an internet connection. Your data is not stored offline, and changes cannot be saved while offline.</li>
          <li>Without a connection you see an offline notice; reconnect and the app refreshes your data.</li>
          <li>There are no push notifications or background sync.</li>
        </ul>
      </section>
    </div>
  );
}
