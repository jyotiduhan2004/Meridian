import type { Metadata } from "next";
import { Poppins, IBM_Plex_Mono } from "next/font/google";
import Script from "next/script";
import "./globals.css";
import PendoInitializer from "./PendoInitializer";

// Poppins carries the friendly, rounded headings/body; IBM Plex Mono stays for
// data, callsigns, and HUD readouts so the technical signal survives the polish.
const poppins = Poppins({
  variable: "--font-poppins",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});

const plexMono = IBM_Plex_Mono({
  variable: "--font-plex-mono",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
const NOVUS_KEY = process.env.NEXT_PUBLIC_NOVUS_KEY; // client analytics id, set in env (not hardcoded)

const TITLE = "Meridian — your product team, on demand";
const DESCRIPTION =
  "Paste your product and a team of specialist agents analyzes it across UX, code, security, market, and operations — then an investor makes you defend it.";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  applicationName: "Meridian",
  title: TITLE,
  description: DESCRIPTION,
  keywords: ["product review", "AI agents", "code review", "security audit", "UX audit", "launch readiness", "market research"],
  authors: [{ name: "Meridian" }],
  openGraph: {
    type: "website",
    siteName: "Meridian",
    url: siteUrl,
    title: TITLE,
    description: DESCRIPTION,
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESCRIPTION,
  },
};

// SoftwareApplication structured data so search/discoverability tools see rich info.
const jsonLd = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "Meridian",
  applicationCategory: "DeveloperApplication",
  operatingSystem: "Web",
  description: DESCRIPTION,
  url: siteUrl,
  offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${poppins.variable} ${plexMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {/* Apply the saved theme before paint to avoid a flash (dark is default). */}
        <Script id="theme-init" strategy="beforeInteractive">
          {`(function(){try{if(localStorage.getItem('meridian-theme')==='light'){document.documentElement.setAttribute('data-theme','light');}}catch(e){}})();`}
        </Script>
        {NOVUS_KEY && (
          <Script id="pendo-agent" strategy="afterInteractive">
            {`(function(apiKey){
    (function(p,e,n,d,o){var v,w,x,y,z;o=p[d]=p[d]||{};o._q=o._q||[];
    v=['initialize','identify','updateOptions','pageLoad','track','trackAgent'];for(w=0,x=v.length;w<x;++w)(function(m){
    o[m]=o[m]||function(){o._q[m===v[0]?'unshift':'push']([m].concat([].slice.call(arguments,0)));};})(v[w]);
    y=e.createElement(n);y.async=!0;y.src='https://cdn.pendo.io/agent/static/'+apiKey+'/pendo.js';
    z=e.getElementsByTagName(n)[0];z.parentNode.insertBefore(y,z);})(window,document,'script','pendo');
})('${NOVUS_KEY}');`}
          </Script>
        )}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }}
        />
        {NOVUS_KEY && <PendoInitializer />}
        {children}
      </body>
    </html>
  );
}
