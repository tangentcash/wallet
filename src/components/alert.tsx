import { Box, Callout } from "@radix-ui/themes";
import { mdiAlertCircleOutline, mdiInformationOutline } from '@mdi/js';
import { useState } from "react";
import Icon from '@mdi/react';

const ALERT_TIME = 8000;

export enum AlertType {
  Info = 'info',
  Warning = 'warning',
  Error = 'error'
}

export enum AlertStatus {
  Opening = 'opening',
  Active = 'active',
  Closing = 'closing'
}

export class AlertBox {
  static alerts: { id: number, status: AlertStatus, type: AlertType, message: string }[] = [];
  static counter: number = 0;
  static notify: (() => void) | null = null;

  static open(type: AlertType, message: string) {
    const id = ++this.counter;
    this.alerts.push({ id: id, status: AlertStatus.Opening, type: type, message: message });
    setTimeout(() => {
      for (let i = 0; i < this.alerts.length; i++) {
        if (this.alerts[i].id == id) {
          this.alerts[i].status = AlertStatus.Closing;
          break;
        }
      }

      if (this.notify)
        this.notify();
    }, ALERT_TIME);
    if (this.notify)
      this.notify();

    switch (type) {
      case AlertType.Error:
        console.error('[ui]', message);
        break;
      case AlertType.Warning:
        console.warn('[ui]', message);
        break;
      case AlertType.Info:
        console.log('[ui]', message);
        break;
      default:
        break;
    }
  }
  static close(id: number) {
    this.alerts = this.alerts.filter((v) => v.id != id);
    if (this.notify)
      this.notify();
  }
  static update(id: number) {
    const alert = this.alerts.find((v) => v.id == id);
    if (!alert)
      return;

    switch (alert.status) {
      case AlertStatus.Opening:
        alert.status = AlertStatus.Active;
        if (this.notify)
          this.notify();
        break;
      case AlertStatus.Closing:
        this.close(id);
        break;
      default:
        break;
    }
  }
}

export function Alert() {
  const [notify, setNotify] = useState(0);
  AlertBox.notify = () => setNotify(notify + 1);
  
  return (
    <Box position="fixed" bottom="12px" right="8px" style={{ zIndex: 10000 }} id={ 'alert-' + notify }>
      {
        AlertBox.alerts.map((alert) =>
          <Callout.Root size="1" variant="surface" mt="2" style={{ backdropFilter: 'blur(4px)' }} color={ alert.type == AlertType.Info ? 'green' : (alert.type == AlertType.Warning ? 'orange' : 'red') } className={ alert.status == AlertStatus.Opening ? 'fade-in-transition' : (alert.status == AlertStatus.Closing ? 'fade-out-transition' : undefined) } key={alert.id} onAnimationEnd={() => AlertBox.update(alert.id)}>
            <Callout.Icon>
              <Icon path={alert.type == AlertType.Info ? mdiInformationOutline : mdiAlertCircleOutline } size={1} />
            </Callout.Icon>
            <Callout.Text>{ alert.message }</Callout.Text>
          </Callout.Root>
        )
      }
    </Box>
  );
}