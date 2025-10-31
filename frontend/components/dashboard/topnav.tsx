// src/components/dashboard/topnav.tsx
"use client";
import React from "react";
import { useAuth } from "@/context/AuthContext";
import { useWalletContext } from "@/context/WalletContext";
import { useNotifications } from "@/hooks/useNotifications";
import NotificationsPanel from "@/components/ui/NotificationsPanel";
import { ScanIcon, SearchIcon } from "../icons/svgs";
import { shortenAddress } from "@/lib/helpers";

export default function TopNav() {
  const { user } = useAuth();
  const { pubKey } = useWalletContext();
  const notifications = useNotifications();

  return (
    <>
      <header className="bg-[#191919] px-4 md:px-6 py-3 md:py-4 flex items-center justify-between">
        <div className="flex items-center space-x-2 md:space-x-3">
          <div className="w-6 h-6 md:w-8 md:h-8 bg-[#333333] rounded-full flex items-center justify-center">
            {/* <span className="text-sm font-medium">0x</span> */}
            <img src="/images/user.png" alt="Senti Logo" draggable={false} />
          </div>
          <span className="font-medium">{shortenAddress(pubKey as string)}</span>
          <svg
            width="10"
            height="6"
            viewBox="0 0 10 6"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M9.49738 0.747032L5.12238 5.12203C5.08174 5.16271 5.03349 5.19498 4.98038 5.21699C4.92727 5.23901 4.87034 5.25034 4.81284 5.25034C4.75535 5.25034 4.69842 5.23901 4.64531 5.21699C4.5922 5.19498 4.54394 5.16271 4.50331 5.12203L0.128313 0.747032C0.0670583 0.685845 0.025335 0.607859 0.00842549 0.522947C-0.00848406 0.438035 0.000180466 0.350014 0.0333222 0.270029C0.0664639 0.190044 0.122593 0.121691 0.194602 0.0736225C0.266612 0.025554 0.351265 -6.79995e-05 0.437844 1.35538e-07H9.18784C9.27442 -6.79995e-05 9.35908 0.025554 9.43109 0.0736225C9.5031 0.121691 9.55922 0.190044 9.59237 0.270029C9.62551 0.350014 9.63417 0.438035 9.61726 0.522947C9.60035 0.607859 9.55863 0.685845 9.49738 0.747032Z"
              fill="white"
            />
          </svg>
        </div>

        <div className="flex items-center space-x-2 md:space-x-4">
          <button className="p-1.5 md:p-2 text-[#A4A4A4] hover:text-white transition-colors">
            <SearchIcon />
          </button>
          <button className="p-1.5 md:p-2 text-[#A4A4A4] hover:text-white transition-colors">
            <ScanIcon />
          </button>

          {/* Notifications Button */}
          <button
            onClick={notifications.toggle}
            className="relative p-1.5 md:p-2 text-[#A4A4A4] hover:text-white transition-colors"
          >
            <svg
              className="w-4 h-4 md:w-5 md:h-5"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path d="M10 2a6 6 0 00-6 6v3.586l-.707.707A1 1 0 004 14h12a1 1 0 00.707-1.707L16 11.586V8a6 6 0 00-6-6zM10 18a3 3 0 01-3-3h6a3 3 0 01-3 3z" />
            </svg>
            {/* Notification Badge */}
            {notifications.unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 md:w-5 md:h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">
                {notifications.unreadCount}
              </span>
            )}
          </button>
        </div>
      </header>

      {/* Notifications Panel */}
      <NotificationsPanel
        isOpen={notifications.isOpen}
        onClose={notifications.close}
        notifications={notifications.notifications}
      />
    </>
  );
}
