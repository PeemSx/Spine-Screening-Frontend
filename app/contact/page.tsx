'use client';
 
import { Container, Stack, Title, Text } from '@mantine/core';
import { TeamSection } from '@/components/contact/TeamSection';

const developers = [
  {
    name: 'Thitsanapat S.',
    role: 'Project Manager',
    imageSrc: '/images/contact/students/dev_1.jpg',
  },
  {
    name: 'Santipab T.',
    role: 'Model Engineer',
    imageSrc: '/images/contact/students/dev_2.jpg',
  },
  {
    name: 'Suphanat K.',
    role: 'Software Engineer',
    imageSrc: '/images/contact/students/dev_3.jpg',
  },
];

const advisers = [
  {
    name: 'Chayanin Angthong, Ph.D., M.D.',
    role: 'Advisor',
    imageSrc: '/images/contact/prof/aj_1.jpg',
  },
  {
    name: 'Paisal Puengpipattrakul, M.D.',
    role: 'Advisor',
    imageSrc: '/images/contact/prof/aj_2.jpg',
  },
  {
    name: 'Sora Tonsuthanluck, M.D.',
    role: 'Advisor',
    imageSrc: '/images/contact/prof/aj_3.jpg',
  },
];

export default function Page() {
  return (
    <Container size="lg" py={{ base: 60, md: 100 }}>
      <Stack gap="xl">
        <Stack gap="sm" align="center">
          <Title order={1} size="h2" ta="center">
            Contact & Team
          </Title>
          <Text ta="center" maw={620} c="gray.6">
            Reach out to the people behind the Spine Opportunistic Screening project. Connect with the
            development team or contact our medical advisors for collaboration
            and research opportunities.
          </Text>
        </Stack>

        <TeamSection
          title="Development Team"
          description="Engineering students developing the spine screening-support platform."
          members={developers}
        />

        <TeamSection
          title="Advisory Board"
          description="Medical experts guiding the research, validation, and clinical insight."
          members={advisers}
        />
      </Stack>
    </Container>
  );
}
