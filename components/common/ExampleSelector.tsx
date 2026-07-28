"use client";

import { useEffect, useRef, useState } from "react";
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
  const controllerRef = useRef<AbortController | null>(null);
  const requestSequenceRef = useRef(0);

  const handleSelect = async (example: ExampleOption) => {
    controllerRef.current?.abort();
    const requestSequence = requestSequenceRef.current + 1;
    requestSequenceRef.current = requestSequence;
    const controller = new AbortController();
    controllerRef.current = controller;
    setLoading(true);
    try {
      const response = await fetch(example.src, { signal: controller.signal });
      if (!response.ok) {
        throw new Error(`Failed to fetch ${example.src}`);
      }
      const blob = await response.blob();
      if (requestSequenceRef.current !== requestSequence) return;
      const mimeType = blob.type || "image/jpeg";
      const fileName = example.fileName ?? example.src.split("/").pop() ?? "example.jpg";
      // Bundled examples do not have a filesystem modification time. Keep it
      // stable so selecting the same example twice is caught by batch
      // fingerprint deduplication.
      const file = new File([blob], fileName, {
        lastModified: 0,
        type: mimeType,
      });
      onSelect({ example, file });
    } catch (error) {
      if (controller.signal.aborted) return;
      console.error("Unable to load example image", error);
    } finally {
      if (requestSequenceRef.current === requestSequence) {
        controllerRef.current = null;
        setLoading(false);
      }
    }
  };

  useEffect(
    () => () => {
      requestSequenceRef.current += 1;
      controllerRef.current?.abort();
      controllerRef.current = null;
    },
    [],
  );

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
