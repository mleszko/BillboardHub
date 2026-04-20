import { Outlet, createRootRoute, HeadContent, Scripts } from "@tanstack/react-router";
import { Toaster } from "@/components/ui/sonner";
import { AuthProvider } from "@/contexts/AuthContext";
import appCss from "../styles.css?url";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold">Strona nie istnieje</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Sprawdź adres lub wróć do panelu głównego.
        </p>
        <a
          href="/"
          className="mt-6 inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
        >
          Wróć na stronę główną
        </a>
      </div>
    </div>
  );
}

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "BillboardHub — platforma operacyjna dla deweloperów budynków" },
      {
        name: "description",
        content:
          "Platforma do zarządzania umowami, lokalizacjami i przychodami dla deweloperów budynków.",
      },
      { name: "author", content: "BillboardHub" },
      {
        property: "og:title",
        content: "BillboardHub — centrum operacyjne dla deweloperów budynków",
      },
      {
        property: "og:description",
        content: "Centralny rejestr umów, alerty wygaśnięć i AI-doradca dla deweloperów budynków.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      {
        name: "twitter:title",
        content: "BillboardHub — centrum operacyjne dla deweloperów budynków",
      },
      {
        name: "description",
        content:
          "BillboardHub usprawnia zarządzanie umowami, lokalizacjami i przychodami dla deweloperów budynków.",
      },
      {
        property: "og:description",
        content:
          "BillboardHub usprawnia zarządzanie umowami, lokalizacjami i przychodami dla deweloperów budynków.",
      },
      {
        name: "twitter:description",
        content:
          "BillboardHub usprawnia zarządzanie umowami, lokalizacjami i przychodami dla deweloperów budynków.",
      },
      {
        property: "og:image",
        content:
          "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/17e5b9f3-d656-4389-82d1-d0dc7ab65708/id-preview-2db9c207--504f1868-fe64-49e3-b6aa-51984724422b.lovable.app-1776708536960.png",
      },
      {
        name: "twitter:image",
        content:
          "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/17e5b9f3-d656-4389-82d1-d0dc7ab65708/id-preview-2db9c207--504f1868-fe64-49e3-b6aa-51984724422b.lovable.app-1776708536960.png",
      },
    ],
    links: [
      { rel: "icon", type: "image/png", href: "/favicon.png" },
      { rel: "apple-touch-icon", href: "/favicon.png" },
      { rel: "stylesheet", href: appCss },
      {
        rel: "preconnect",
        href: "https://fonts.googleapis.com",
      },
      {
        rel: "preconnect",
        href: "https://fonts.gstatic.com",
        crossOrigin: "anonymous",
      },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap",
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  return (
    <AuthProvider>
      <Outlet />
      <Toaster position="top-right" richColors />
    </AuthProvider>
  );
}
