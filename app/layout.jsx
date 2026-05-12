import "./globals.css";

export const metadata = {
  title: "Workplay — set up your wiki in 5 minutes",
  description:
    "Upload your résumé, get back a Wikipedia-styled personal site + a profile card. Open source, your repo, your domain. No SaaS lock-in.",
  openGraph: {
    title: "Workplay — set up your wiki in 5 minutes",
    description:
      "Upload your résumé, get back a Wikipedia-styled personal site + a profile card.",
    type: "website",
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <meta name="color-scheme" content="light only" />
      </head>
      <body>{children}</body>
    </html>
  );
}
