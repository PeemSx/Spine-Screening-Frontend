import { ColorSchemeScript, MantineProvider, mantineHtmlProps } from '@mantine/core';
import '@mantine/core/styles.css';

import NavBar from '@/components/layout/NavBar';

export const metadata = {
  title: 'AI-Assisted Detection of OVCF',
  description: 'A web application for AI-assisted detection of osteoporotic vertebral compression fractures (OVCF).',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" {...mantineHtmlProps}>
      <head>
        <ColorSchemeScript />
      </head>
      <body>
        <MantineProvider>
          <NavBar />
          {children}
        </MantineProvider>
      </body>
    </html>
  );
}
