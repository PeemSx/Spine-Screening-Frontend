'use client';

import {
  Card,
  Stack,
  Title,
  Text,
  SimpleGrid,
  Avatar,
  Box,
} from '@mantine/core';
import {
  IconSparkles,
  IconBriefcase,
  IconCpu,
  IconCode,
  IconStethoscope,
} from '@tabler/icons-react';

type TeamMember = {
  name: string;
  role?: string;
  imageSrc?: string;
};

type TeamSectionProps = {
  title: string;
  description?: string;
  members: TeamMember[];
};

const cardBackground =
  'linear-gradient(160deg, rgba(10, 24, 63, 0.98) 0%, rgba(7, 30, 66, 0.9) 50%, rgba(4, 18, 42, 0.95) 100%)';

const getRoleIcon = (role?: string) => {
  if (!role) return IconSparkles;
  const normalized = role.toLowerCase();
  if (normalized.includes('advisor') || normalized.includes('doctor')) {
    return IconStethoscope;
  }
  if (normalized.includes('manager') || normalized.includes('lead')) {
    return IconBriefcase;
  }
  if (normalized.includes('model')) {
    return IconCpu;
  }
  if (normalized.includes('engineer') || normalized.includes('developer')) {
    return IconCode;
  }
  return IconSparkles;
};

export function TeamSection({ title, description, members }: TeamSectionProps) {
  return (
    <Stack gap="xl">
      <Stack gap="xs" align="center">
        <Title order={2} size="h3" ta="center" c="blue.8">
          {title}
        </Title>
        {description ? (
          <Text ta="center" c="gray.6" maw={520}>
            {description}
          </Text>
        ) : null}
      </Stack>

      <SimpleGrid
        cols={{ base: 1, sm: 2, md: Math.min(3, members.length) }}
        spacing={{ base: 'lg', md: 'xl' }}
      >
        {members.map((member) => (
          <Card
            key={member.name}
            withBorder
            radius="lg"
            p="xl"
            styles={{
              root: {
                position: 'relative',
                display: 'flex',
                overflow: 'hidden',
                minHeight: 340,
                background: cardBackground,
                border: '1px solid rgba(90, 160, 255, 0.28)',
                boxShadow: '0 28px 48px rgba(3, 18, 48, 0.45)',
                backdropFilter: 'blur(14px)',
                transition:
                  'transform 200ms ease, box-shadow 200ms ease, border-color 200ms ease',
                '&:hover': {
                  transform: 'translateY(-8px)',
                  boxShadow: '0 36px 64px rgba(5, 28, 68, 0.5)',
                  borderColor: 'rgba(140, 200, 255, 0.6)',
                },
              },
            }}
          >
            <Box
              style={{
                position: 'absolute',
                inset: 0,
                background:
                  'radial-gradient(120% 120% at 50% 0%, rgba(49, 130, 206, 0.28), transparent 70%)',
                pointerEvents: 'none',
              }}
            />
            <Box
              style={{
                position: 'absolute',
                top: -60,
                right: -60,
                width: 180,
                height: 180,
                background:
                  'radial-gradient(circle, rgba(56, 189, 248, 0.45), transparent 65%)',
                filter: 'blur(2px)',
                pointerEvents: 'none',
              }}
            />
            <Box
              style={{
                position: 'absolute',
                bottom: -70,
                left: -80,
                width: 220,
                height: 220,
                background:
                  'radial-gradient(circle, rgba(99, 102, 241, 0.32), transparent 70%)',
                filter: 'blur(6px)',
                pointerEvents: 'none',
              }}
            />
            <Stack
              align="center"
              justify="space-between"
              gap="lg"
              style={{ flex: 1, position: 'relative', zIndex: 1 }}
            >
              <Avatar
                src={member.imageSrc}
                alt={member.name}
                radius={28}
                color="blue"
                style={{
                  width: 168,
                  height: 218,
                  boxShadow: '0 18px 32px rgba(0, 82, 163, 0.28)',
                  border: '4px solid rgba(255, 255, 255, 0.85)',
                  backgroundColor: 'rgba(255, 255, 255, 0.75)',
                }}
                styles={{
                  image: { objectFit: 'cover' },
                }}
              >
                {member.name
                  .split(' ')
                  .map((part) => part[0])
                  .join('')
                  .slice(0, 2)
                  .toUpperCase()}
              </Avatar>

              <Stack gap="sm" align="center">
                <Title order={3} size="h4" c="blue.1">
                  {member.name}
                </Title>
                {member.role ? (
                  (() => {
                    const RoleIcon = getRoleIcon(member.role);
                    return (
                  <Box
                    px="sm"
                    py={6}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 8,
                      borderRadius: 999,
                      border: '1px solid rgba(120, 190, 255, 0.45)',
                      background:
                        'linear-gradient(135deg, rgba(56, 189, 248, 0.25), rgba(14, 165, 233, 0.18))',
                      boxShadow: '0 14px 28px rgba(34, 140, 255, 0.28)',
                    }}
                  >
                    <RoleIcon size={16} stroke={1.6} color="#38bdf8" />
                    <Text size="sm" fw={600} c="blue.1">
                      {member.role}
                    </Text>
                  </Box>
                    );
                  })()
                ) : null}
              </Stack>
            </Stack>
          </Card>
        ))}
      </SimpleGrid>
    </Stack>
  );
}
