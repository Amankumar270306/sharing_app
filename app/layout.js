import "./globals.css";
import Head from "next/head";

export const metadata = {
    title: "QuickShare",
    description: "Local File Sharing",
    manifest: "/manifest.json",
};

export default function RootLayout({ children }) {
    return (
        <html lang="en">
            <head>
                <meta name="theme-color" content="#0f172a" />
            </head>
            <body className="antialiased">
                {children}
                <ScriptRegisterSW />
            </body>
        </html>
    );
}

function ScriptRegisterSW() {
    return (
        <script
            dangerouslySetInnerHTML={{
                __html: `
          if ('serviceWorker' in navigator) {
            window.addEventListener('load', function() {
              navigator.serviceWorker.register('/sw.js').then(
                function(registration) {
                  console.log('ServiceWorker registration successful with scope: ', registration.scope);
                },
                function(err) {
                  console.log('ServiceWorker registration failed: ', err);
                }
              );
            });
          }
        `,
            }}
        />
    );
}
