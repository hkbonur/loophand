import React from "react";
import { HeadContent, Scripts, createRootRoute } from "@tanstack/react-router";
import { ConvexAuthProvider } from "../convex-client";
import { Toaster } from "../ui/toaster";
import { ServiceWorker } from "../pwa/ServiceWorker";
import { AccountMenu } from "../components/AccountMenu";

import appCss from "../styles.css?url";

const THEME_INIT_SCRIPT = `(function(){try{var stored=window.localStorage.getItem('theme');var mode=(stored==='light'||stored==='dark'||stored==='auto')?stored:'auto';var prefersDark=window.matchMedia('(prefers-color-scheme: dark)').matches;var resolved=mode==='auto'?(prefersDark?'dark':'light'):mode;var root=document.documentElement;root.classList.remove('light','dark');root.classList.add(resolved);if(mode==='auto'){root.removeAttribute('data-theme')}else{root.setAttribute('data-theme',mode)}root.style.colorScheme=resolved;}catch(e){}})();`;

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { name: "theme-color", content: "#111111" },
      { title: "loophand" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "manifest", href: "/manifest.webmanifest" },
    ],
  }),
  shellComponent: RootDocument,
});

function RootDocument(props: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
        <HeadContent />
      </head>
      <body className="min-h-screen bg-background font-sans antialiased [overflow-wrap:anywhere] selection:bg-foreground/15">
        <ConvexAuthProvider>
          <div className="fixed right-4 top-4 z-40">
            <AccountMenu />
          </div>
          {props.children}
          <Toaster />
          <ServiceWorker />
        </ConvexAuthProvider>
        <Scripts />
      </body>
    </html>
  );
}
