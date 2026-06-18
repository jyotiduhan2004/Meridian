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

export const metadata: Metadata = {
  title: "Meridian — your product team, on demand",
  description:
    "Paste your product and a team of specialist agents analyzes it across UX, code, security, market, and operations — then an investor makes you defend it.",
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
        <Script id="pendo-agent" strategy="afterInteractive">
          {`(function(apiKey){
    (function(p,e,n,d,o){var v,w,x,y,z;o=p[d]=p[d]||{};o._q=o._q||[];
    v=['initialize','identify','updateOptions','pageLoad','track','trackAgent'];for(w=0,x=v.length;w<x;++w)(function(m){
    o[m]=o[m]||function(){o._q[m===v[0]?'unshift':'push']([m].concat([].slice.call(arguments,0)));};})(v[w]);
    y=e.createElement(n);y.async=!0;y.src='https://cdn.pendo.io/agent/static/'+apiKey+'/pendo.js';
    z=e.getElementsByTagName(n)[0];z.parentNode.insertBefore(y,z);})(window,document,'script','pendo');
})('e3dd0a28-5627-4665-b27c-325fa506754d');`}
        </Script>
        <PendoInitializer />
        {children}
      </body>
    </html>
  );
}
