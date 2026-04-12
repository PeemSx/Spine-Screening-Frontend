import { ColorSchemeScript, MantineProvider, mantineHtmlProps } from '@mantine/core';
import '@mantine/core/styles.css';
import ClientNavBar from '@/components/layout/ClientNavBar';

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
          <ClientNavBar />
          {children}
        </MantineProvider>
      </body>
    </html>
  );
}
