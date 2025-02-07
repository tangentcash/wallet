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
  static alerts: { id: number, status: AlertStatus, type: AlertType, message: string, timeout: any }[] = [];
  static counter: number = 0;
  static notify: (() => void) | null = null;

  private static toCountedMessage(message: string, count: number): string {
    const uncountedMessage = this.toUncountedMessage(message);
    return uncountedMessage[0] + ' (' + count + ')';
  }
  private static toUncountedMessage(message: string): [string, number] {
    try {
      if (message[message.length - 1] != ')')
        throw false;

      let index = message.length - 1;
      while (index >= 0 && message[index] != '(')
        --index;
      
      if (index <= 0 || message[index - 1] != ' ')
        throw false;

      const value = parseInt(message.substring(index + 1, message.length - 1));
      if (isNaN(value))
        throw false;

      return [message.substring(0, index - 1), value];
    } catch {
      return [message, 0];
    }
  }
  private static destructor(id: number): () => void {
    return () => {
      for (let i = 0; i < this.alerts.length; i++) {
        if (this.alerts[i].id == id) {
          this.alerts[i].status = AlertStatus.Closing;
          break;
        }
      }

      if (this.notify)
        this.notify();
    };
  }
  static open(type: AlertType, message: string): number {
    if (this.alerts.length > 0) {
      const top = this.alerts.find((item) => item.type == type && this.toUncountedMessage(item.message)[0] == message);
      if (top != null) {
        const prevMessage = this.toUncountedMessage(top.message);
        clearTimeout(top.timeout);

        top.message = this.toCountedMessage(prevMessage[0], prevMessage[1] + 1);
        top.timeout = setTimeout(this.destructor(top.id), ALERT_TIME);
        if (top.status != AlertStatus.Opening)
          top.status = AlertStatus.Active;
        if (this.notify)
          this.notify();
        return top.id;
      }
    }

    const id = ++this.counter;
    this.alerts.push({
      id: id,
      status: AlertStatus.Opening,
      type: type,
      message: message,
      timeout: setTimeout(this.destructor(id), ALERT_TIME)
    });
    if (this.notify)
      this.notify();

    switch (type) {
      case AlertType.Error:
        console.error('[ui]', message);
        return id;
      case AlertType.Warning:
        console.warn('[ui]', message);
        return id;
      case AlertType.Info:
        console.log('[ui]', message);
        return id;
      default:
        return id;
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