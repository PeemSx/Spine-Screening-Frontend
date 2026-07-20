'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useDisclosure } from '@mantine/hooks';
import {
  Anchor,
  Box,
  Burger,
  Button,
  Container,
  Divider,
  Drawer,
  Group,
  Stack,
  Text,
} from '@mantine/core';
import { ThemeToggle } from './ThemeToggle';
import classes from './NavBar.module.css';

type NavLink = {
  label: string;
  href: string;
  isPrimary?: boolean;
};

const navLinks: NavLink[] = [
  { label: 'Screening', href: '/screening', isPrimary: true },
  { label: 'Contact', href: '/contact' },
];

export default function NavBar() {
  const pathname = usePathname();
  const [mobileOpened, { toggle: toggleMobile, close: closeMobile }] =
    useDisclosure(false);

  const isActive = (href: string) =>
    href === '/' ? pathname === '/' : pathname.startsWith(href);

  const desktopLinks = navLinks.map((link) => {
    const active = isActive(link.href);
    const isPrimary = link.isPrimary;

    if (isPrimary) {
      return (
        <Button
          key={link.label}
          component={Link}
          href={link.href}
          variant={active ? 'filled' : 'light'}
          color="blue"
          fw={600}
        >
          {link.label}
        </Button>
      );
    }

    return (
      <Anchor
        key={link.label}
        component={Link}
        href={link.href}
        underline="never"
        fw={500}
        c={active ? 'blue.7' : 'gray.6'}
        size="sm"
      >
        {link.label}
      </Anchor>
    );
  });

  const mobileLinks = navLinks.map((link) => {
    const active = isActive(link.href);
    const isPrimary = link.isPrimary;

    if (isPrimary) {
      return (
        <Button
          key={link.label}
          component={Link}
          href={link.href}
          variant={active ? 'filled' : 'light'}
          color="blue"
          fw={600}
          fullWidth
          onClick={closeMobile}
        >
          {link.label}
        </Button>
      );
    }

    return (
      <Anchor
        key={link.label}
        component={Link}
        href={link.href}
        underline="never"
        fw={500}
        c={active ? 'blue.7' : 'gray.6'}
        size="md"
        onClick={closeMobile}
      >
        {link.label}
      </Anchor>
    );
  });

  return (
    <Box
      component="header"
      pos="sticky"
      top={0}
      bg="var(--mantine-color-body)"
      style={{
        borderBottom: '1px solid var(--mantine-color-gray-2)',
        zIndex: 100,
      }}
    >
      <Container size="xl">
        <Group justify="space-between" align="center" h={72}>
          {/* Logo */}
          <Anchor component={Link} href="/" underline="never">
            <Text fw={700} size="lg" c="blue.7">
              Spine Opportunistic Screening
            </Text>
          </Anchor>

          {/* Desktop Navigation */}
          <Group gap="xl" grow={false} className={classes.desktopNav}>
            <Group gap="md">{desktopLinks.slice(0, 1)}</Group>
            <Divider orientation="vertical" />
            <Group gap="md">{desktopLinks.slice(1)}</Group>
            <ThemeToggle />
          </Group>

          {/* Mobile Burger */}
          <Burger
            opened={mobileOpened}
            onClick={toggleMobile}
            aria-label="Toggle navigation menu"
            className={classes.mobileBurger}
          />
        </Group>
      </Container>

      {/* Mobile Drawer */}
      <Drawer
        opened={mobileOpened}
        onClose={closeMobile}
        p="md"
        size="100%"
        title="Menu"
      >
        <Stack gap="md">
          <Text fw={600} size="xs" c="gray.6" tt="uppercase">
            Demo
          </Text>
          <Group gap="sm" grow>
            {mobileLinks.slice(0, 1)}
          </Group>

          <Divider my="sm" />

          <Text fw={600} size="xs" c="gray.6" tt="uppercase">
            More
          </Text>
          <Stack gap="sm">{mobileLinks.slice(1)}</Stack>
        </Stack>
      </Drawer>
    </Box>
  );
}
