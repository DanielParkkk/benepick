import Script from 'next/script';

export const metadata = {
  title: '베네픽 — 대시보드',
  description: '복지 수급 확률 분석 플랫폼',
};

export default function RootLayout({ children }) {
  return (
    <html lang="ko" suppressHydrationWarning>
      <head>
        <meta charSet="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          href="https://fonts.googleapis.com/css2?family=Pretendard:wght@400;500;600;700;800&family=Plus+Jakarta+Sans:wght@600;700;800&display=swap"
          rel="stylesheet"
        />
        <link rel="stylesheet" href="/style.css" />
        <link rel="stylesheet" href="/mobile-additions.css" />
      </head>
      <body suppressHydrationWarning>
        <div suppressHydrationWarning>
          {children}
        </div>
        <Script src="/main.js" strategy="afterInteractive" />
        <Script src="/i18n.js" strategy="afterInteractive" />
      </body>
    </html>
  );
}
