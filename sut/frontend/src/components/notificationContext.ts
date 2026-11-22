import { createContext } from 'react';

export type NotificationType = 'success' | 'error' | 'info' | 'warning';

export interface Notification {
  id: number;
  message: string;
  type: NotificationType;
  removing?: boolean;
}

export interface ConfirmState {
  open: boolean;
  message: string;
  title: string;
  resolve?: (value: boolean) => void;
  isDanger?: boolean;
}

export interface NotificationContextType {
  showNotification: (message: string, type?: NotificationType) => void;
  showConfirm: (message: string, title?: string, isDanger?: boolean) => Promise<boolean>;
}

export const NotificationContext = createContext<NotificationContextType | undefined>(undefined);
