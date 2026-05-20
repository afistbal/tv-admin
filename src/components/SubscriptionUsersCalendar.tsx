import { useEffect, useMemo, useRef } from "react";
import { UserOutlined } from "@ant-design/icons";
import FullCalendar from "@fullcalendar/react";
import type { DatesSetArg, EventClickArg } from "@fullcalendar/core";
import dayGridPlugin from "@fullcalendar/daygrid";
import interactionPlugin from "@fullcalendar/interaction";
import zhCn from "@fullcalendar/core/locales/zh-cn";
import type { Dayjs } from "dayjs";
import dayjs from "dayjs";
import type { AdminUserSubscriptionRow } from "@/types/adminUserSubscription";
import type { SubscriptionCalendarEventProps } from "@/lib/subscriptionCalendarEvents";
import { rowsToCalendarEvents } from "@/lib/subscriptionCalendarEvents";
import styles from "./SubscriptionUsersCalendar.module.css";

type Props = {
  rows: AdminUserSubscriptionRow[];
  month: Dayjs;
  onMonthChange: (m: Dayjs) => void;
  onSelectRow?: (row: AdminUserSubscriptionRow) => void;
};

export function SubscriptionUsersCalendar({ rows, month, onMonthChange, onSelectRow }: Props) {
  const calendarRef = useRef<FullCalendar>(null);
  const events = useMemo(() => rowsToCalendarEvents(rows), [rows]);
  const syncingRef = useRef(false);

  useEffect(() => {
    const api = calendarRef.current?.getApi();
    if (!api) {
      return;
    }
    const target = month.startOf("month");
    if (dayjs(api.getDate()).isSame(target, "month")) {
      return;
    }
    syncingRef.current = true;
    api.gotoDate(target.toDate());
    queueMicrotask(() => {
      syncingRef.current = false;
    });
  }, [month]);

  const onDatesSet = (arg: DatesSetArg) => {
    if (syncingRef.current) {
      return;
    }
    const next = dayjs(arg.view.currentStart).startOf("month");
    if (!next.isSame(month, "month")) {
      onMonthChange(next);
    }
  };

  const onEventClick = (arg: EventClickArg) => {
    const props = arg.event.extendedProps as SubscriptionCalendarEventProps;
    if (props?.row) {
      onSelectRow?.(props.row);
    }
  };

  return (
    <div className={styles.wrap}>
      <FullCalendar
        ref={calendarRef}
        plugins={[dayGridPlugin, interactionPlugin]}
        initialView="dayGridMonth"
        initialDate={month.toDate()}
        locale={zhCn}
        firstDay={0}
        height="auto"
        fixedWeekCount={false}
        dayMaxEvents={false}
        headerToolbar={{
          left: "title",
          center: "",
          right: "prev,next today",
        }}
        buttonText={{
          today: "今天",
        }}
        events={events}
        datesSet={onDatesSet}
        eventClick={onEventClick}
        eventContent={(arg) => {
          const props = arg.event.extendedProps as SubscriptionCalendarEventProps;
          const title = arg.event.title || String(props?.row?.user_id ?? "—");
          return (
            <button
              type="button"
              className={styles.eventCard}
              title={`用户 ${title} · ${props?.kindLabel ?? ""} · ${props?.productLabel ?? ""}`}
            >
              <span className={styles.eventIcon} style={{ background: props?.dotColor ?? "#f7d070" }}>
                <UserOutlined />
              </span>
              <span className={styles.eventTitle}>{title}</span>
            </button>
          );
        }}
      />
    </div>
  );
}
