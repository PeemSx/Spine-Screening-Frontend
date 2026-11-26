"use client";

import { useEffect, useState } from "react";

import styles from "./ClinicalNotice.module.css";

export const DEFAULT_SCREENING_DISCLAIMER =
  "Research screening-support measurements only. These outputs are not a diagnosis and require clinical interpretation.";

export const WARNING_NOTICE_SESSION_KEY =
  "spine-screening:measurement-warnings-dismissed";

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
  const reviewKey = `${clinicalReviewRequired}:${disclaimer}`;

  return (
    <div className={styles.noticeStack}>
      <ReviewNotice
        key={reviewKey}
        clinicalReviewRequired={clinicalReviewRequired}
        disclaimer={disclaimer}
      />

      {warnings.length > 0 ? (
        <WarningNotice warnings={warnings} />
      ) : null}
    </div>
  );
}

function ReviewNotice({
  clinicalReviewRequired,
  disclaimer,
}: Required<Pick<ClinicalNoticeProps, "clinicalReviewRequired" | "disclaimer">>) {
  const [expanded, setExpanded] = useState(true);
  const title = clinicalReviewRequired
    ? "Clinical review required"
    : "Research screening support";

  if (!expanded) {
    return (
      <section className={`${styles.notice} ${styles.compactNotice}`} role="note">
        <span aria-hidden="true" className={styles.icon}>
          i
        </span>
        <div className={styles.content}>
          <div className={styles.title}>{title}</div>
        </div>
        <button
          aria-label="Show clinical review notice"
          className={styles.actionButton}
          onClick={() => setExpanded(true)}
          type="button"
        >
          Show
        </button>
      </section>
    );
  }

  return (
    <section className={styles.notice} role="note">
      <span aria-hidden="true" className={styles.icon}>
        i
      </span>
      <div className={styles.content}>
        <div className={styles.title}>{title}</div>
        <div className={styles.message}>{disclaimer}</div>
      </div>
      <DismissButton
        label="Dismiss clinical review notice"
        onClick={() => setExpanded(false)}
      />
    </section>
  );
}

function WarningNotice({ warnings }: Pick<ClinicalNoticeProps, "warnings">) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      setVisible(
        sessionStorage.getItem(WARNING_NOTICE_SESSION_KEY) !== "true",
      );
    } catch {
      setVisible(true);
    }
  }, []);

  const dismiss = () => {
    setVisible(false);
    try {
      sessionStorage.setItem(WARNING_NOTICE_SESSION_KEY, "true");
    } catch {
      // The in-memory state still dismisses the notice when storage is unavailable.
    }
  };

  if (!visible) return null;

  return (
    <section className={`${styles.notice} ${styles.warning}`} role="status">
      <span aria-hidden="true" className={styles.icon}>
        !
      </span>
      <div className={styles.content}>
        <div className={styles.title}>Image quality and measurement warnings</div>
        <ul className={styles.warningList}>
          {warnings?.map((warning) => <li key={warning}>{warning}</li>)}
        </ul>
      </div>
      <DismissButton
        label="Dismiss image quality and measurement warnings"
        onClick={dismiss}
      />
    </section>
  );
}

function DismissButton({
  label,
  onClick,
}: {
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      aria-label={label}
      className={styles.dismissButton}
      onClick={onClick}
      type="button"
    >
      <span aria-hidden="true">×</span>
    </button>
  );
}
