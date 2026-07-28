import styles from "./ClinicalNotice.module.css";

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
    <div className={styles.noticeStack}>
      <section className={styles.notice} role="note">
        <span aria-hidden="true" className={styles.icon}>
          i
        </span>
        <div className={styles.content}>
          <div className={styles.title}>
            {clinicalReviewRequired
              ? "Clinical review required"
              : "Research screening support"}
          </div>
          <div className={styles.message}>{disclaimer}</div>
        </div>
      </section>

      {warnings.length > 0 ? (
        <section
          className={`${styles.notice} ${styles.warning}`}
          role="status"
        >
          <span aria-hidden="true" className={styles.icon}>
            !
          </span>
          <div className={styles.content}>
            <div className={styles.title}>
              Image quality and measurement warnings
            </div>
            <ul className={styles.warningList}>
              {warnings.map((warning) => (
                <li key={warning}>{warning}</li>
              ))}
            </ul>
          </div>
        </section>
      ) : null}
    </div>
  );
}
