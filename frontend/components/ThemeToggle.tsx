'use client';
import { useEffect, useState } from 'react';
import { useColorScheme } from '@mantine/hooks';
import { ActionIcon } from '@mantine/core';
import { IconSun, IconMoon } from '@tabler/icons-react';
import { useMantineColorScheme } from '@mantine/core';

export function ThemeToggle() {
  const [mounted, setMounted] = useState(false);
  const { colorScheme, setColorScheme } = useMantineColorScheme();

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return <ActionIcon size="lg" variant="subtle" disabled />;

  return (
    <ActionIcon
      onClick={() => setColorScheme(colorScheme === 'dark' ? 'light' : 'dark')}
      variant="subtle"
      size="lg"
    >
      {colorScheme === 'dark' ? <IconSun size={18} /> : <IconMoon size={18} />}
    </ActionIcon>
  );
}