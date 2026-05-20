import styles from "./NotionTag.module.css";
import type { NotionTagTone } from "@/lib/subscriptionUserDisplay";

export function NotionTag({ tone, wrap }: { tone: NotionTagTone; wrap?: boolean }) {
  return (
    <span
      className={`${styles.tag} ${wrap ? styles.tagWrap : ""}`}
      style={{ background: tone.bg, color: tone.dot }}
    >
      <span className={styles.dot} style={{ background: tone.dot }} />
      {tone.label}
    </span>
  );
}
