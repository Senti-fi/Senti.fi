// src/hooks/useNotifications.ts
import { useState, useCallback } from "react";

export interface Notification {
  id: string;
  type: "deposit" | "withdrawal" | "savings" | "ai_tip";
  title: string;
  message: string;
  timestamp: string;
  status?: "new" | "read";
  amount?: string;
  currency?: string;
}

export function useNotifications() {
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([
    {
      id: "1",
      type: "deposit",
      title: "Deposit Confirmed",
      message:
        "Your deposit of N 50,000 has been processed. 30.67 USDT added to your wallet.",
      timestamp: "2 hours ago",
      status: "new",
    },
    {
      id: "2",
      type: "ai_tip",
      title: "AI Savings Tip",
      message:
        "You have been consistent with your savings! Consider increasing your monthly target by 10%",
      timestamp: "2 hours ago",
    },
    {
      id: "3",
      type: "withdrawal",
      title: "Withdrawal Processed",
      message: "N 32,600 has been sent to your GTBank account ending in 4567.",
      timestamp: "2 hours ago",
    },
    {
      id: "4",
      type: "savings",
      title: "Savings Interest Earned",
      message:
        "You earned N 2,400 in interest this month from your savings plan.",
      timestamp: "2 hours ago",
    },
  ]);

  const open = useCallback(() => setIsOpen(true), []);
  const close = useCallback(() => setIsOpen(false), []);
  const toggle = useCallback(() => setIsOpen((prev) => !prev), []);

  const markAsRead = useCallback((notificationId: string) => {
    setNotifications((prev) =>
      prev.map((notification) =>
        notification.id === notificationId
          ? { ...notification, status: "read" }
          : notification
      )
    );
  }, []);

  const markAllAsRead = useCallback(() => {
    setNotifications((prev) =>
      prev.map((notification) => ({ ...notification, status: "read" }))
    );
  }, []);

  const addNotification = useCallback(
    (notification: Omit<Notification, "id">) => {
      const newNotification: Notification = {
        ...notification,
        id: Date.now().toString(),
      };
      setNotifications((prev) => [newNotification, ...prev]);
    },
    []
  );

  const removeNotification = useCallback((notificationId: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== notificationId));
  }, []);

  const unreadCount = notifications.filter((n) => n.status === "new").length;

  return {
    isOpen,
    notifications,
    unreadCount,
    open,
    close,
    toggle,
    markAsRead,
    markAllAsRead,
    addNotification,
    removeNotification,
  };
}
