"use client";

import { Alert, List, Stack } from "@mantine/core";
import { IconAlertTriangle, IconInfoCircle } from "@tabler/icons-react";

export const DEFAULT_SCREENING_DISCLAIMER =
  "Research screening-support measurements only. These outputs are not a diagnosis and require clinical interpretation.";

interface ClinicalNoticeProps {
  disclaimer?: string;
  warnings?: readonly string[];
  clinicalReviewRequired?: boolean;
}

export function ClinicalNotice({
  disclaimer = DEFAULT_SCREENING_DISCLAIMER,
  warnings = [],
  clinicalReviewRequired = true,
}: ClinicalNoticeProps) {
  return (
    <Stack gap="sm" mb="xl">
      <Alert
        color="blue"
        icon={<IconInfoCircle size={20} />}
        radius="md"
        role="note"
        title={clinicalReviewRequired ? "Clinical review required" : "Research screening support"}
        variant="light"
      >
        {disclaimer}
      </Alert>

      {warnings.length > 0 ? (
        <Alert
          color="yellow"
          icon={<IconAlertTriangle size={20} />}
          radius="md"
          role="status"
          title="Image quality and measurement warnings"
          variant="light"
        >
          <List size="sm" spacing={4}>
            {warnings.map((warning) => (
              <List.Item key={warning}>{warning}</List.Item>
            ))}
          </List>
        </Alert>
      ) : null}
    </Stack>
  );
}
