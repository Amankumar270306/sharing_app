import "./globals.css";

export const metadata = {
    title: 'AmanDrop',
    description: 'Local file sharing app',
}

export default function RootLayout({
    children,
}: {
    children: React.ReactNode
}) {
    return (
        <html lang="en">
            <body>{children}</body>
        </html>
    )
}
