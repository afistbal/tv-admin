import {
  resolvePaymentMethodDisplay,
  resolveSubscriptionPaymentMethodDisplay,
} from "@/lib/orderPaymentDetailDisplay";
import styles from "./OrderPaymentMethodDisplay.module.css";

type Props = {
  /** 代收列表：Airwallex `result` JSON */
  result?: unknown;
  /** 订阅列表等：整行，优先 `result` 再 `payment_method` */
  record?: Record<string, unknown>;
};

export function OrderPaymentMethodDisplay({ result, record }: Props) {
  const display = record
    ? resolveSubscriptionPaymentMethodDisplay(record)
    : resolvePaymentMethodDisplay(result);
  if (!display) {
    return null;
  }

  return (
    <div className={styles.root}>
      {display.icons.length > 0 ? (
        <span className={styles.icons}>
          {display.icons.map((src) => (
            <img key={src} className={styles.icon} src={src} alt="" loading="lazy" />
          ))}
        </span>
      ) : null}
      <span className={styles.label}>{display.label}</span>
    </div>
  );
}
