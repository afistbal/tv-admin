import { resolvePaymentMethodDisplay } from "@/lib/orderPaymentDetailDisplay";
import styles from "./OrderPaymentMethodDisplay.module.css";

type Props = {
  result: unknown;
};

export function OrderPaymentMethodDisplay({ result }: Props) {
  const display = resolvePaymentMethodDisplay(result);
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
