'use client';

import Link from 'next/link';
import dynamic from 'next/dynamic';

const NavBar = dynamic(() => import('./NavBar'), {
  ssr: false,
  loading: () => (
    <header
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 100,
        background: 'var(--mantine-color-body)',
        borderBottom: '1px solid var(--mantine-color-gray-2)',
      }}
    >
      <div
        style={{
          maxWidth: '1200px',
          margin: '0 auto',
          padding: '0 16px',
        }}
      >
        <div
          style={{
            height: 72,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <Link
            href="/"
            style={{
              textDecoration: 'none',
              color: 'var(--mantine-color-blue-7)',
              fontWeight: 700,
              fontSize: '1.125rem',
            }}
          >
            OVCF Detector
          </Link>

          <div
            aria-hidden="true"
            style={{
              width: 148,
              height: 40,
            }}
          />
        </div>
      </div>
    </header>
  ),
});

export default function ClientNavBar() {
  return <NavBar />;
}
