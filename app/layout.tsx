import { ColorSchemeScript, MantineProvider, mantineHtmlProps } from '@mantine/core';
import '@mantine/core/styles.css';
import '@mantine/dropzone/styles.css';
import ClientNavBar from '@/components/layout/ClientNavBar';
import { ScreeningSessionProvider } from '@/features/screening/session/ScreeningSessionProvider';

export const metadata = {
  title: 'Spine Opportunistic Screening',
  description:
    'A research web application for spine screening-support measurements from radiographs. Outputs are not a diagnosis and require clinical interpretation.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" {...mantineHtmlProps}>
      <head>
        <meta name="darkreader-lock" />
        <ColorSchemeScript />
      </head>
      <body>
        <MantineProvider withGlobalClasses={false}>
          <ScreeningSessionProvider>
            <ClientNavBar />
            {children}
          </ScreeningSessionProvider>
        </MantineProvider>
      </body>
    </html>
  );
}
