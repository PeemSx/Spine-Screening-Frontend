"use client";

import { useState } from "react";
import { Button, Loader, Menu, Text } from "@mantine/core";
import { IconChevronDown } from "@tabler/icons-react";
import type { ExampleOption, ExampleSelection } from "@/types/examples";

type ExampleSelectorProps = {
  examples: ExampleOption[];
  onSelect: (selection: ExampleSelection) => void;
  buttonLabel?: string;
  description?: string;
};

export function ExampleSelector({
  examples,
  onSelect,
  buttonLabel = "Load example",
  description,
}: ExampleSelectorProps) {
  const [loading, setLoading] = useState(false);

  const handleSelect = async (example: ExampleOption) => {
    setLoading(true);
    try {
      const response = await fetch(example.src);
      if (!response.ok) {
        throw new Error(`Failed to fetch ${example.src}`);
      }
      const blob = await response.blob();
      const mimeType = blob.type || "image/jpeg";
      const fileName = example.fileName ?? example.src.split("/").pop() ?? "example.jpg";
      const file = new File([blob], fileName, { type: mimeType });
      onSelect({ example, file });
    } catch (error) {
      console.error("Unable to load example image", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Menu withinPortal shadow="md">
      <Menu.Target>
        <Button
          variant="light"
          rightSection={loading ? <Loader size="xs" color="currentColor" /> : <IconChevronDown size={16} />}
          disabled={loading || examples.length === 0}
        >
          {buttonLabel}
        </Button>
      </Menu.Target>
      <Menu.Dropdown>
        {description && (
          <Menu.Label>
            <Text size="xs" c="dimmed">
              {description}
            </Text>
          </Menu.Label>
        )}
        {examples.map((example) => (
          <Menu.Item key={example.src} onClick={() => handleSelect(example)}>
            {example.label}
          </Menu.Item>
        ))}
      </Menu.Dropdown>
    </Menu>
  );
}
