"use client";
import React from "react";
import {
  HomeIcon,
  SendIcon,
  SwapIcon,
  SaveIcon,
  ReceiveIcon,
  SettingsIcon,
} from "@/components/icons/svgs";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

interface NavItem {
  name: string;
  href: string;
  icon: React.ReactNode;
}

export default function BottomNav() {
  const pathname = usePathname();
  const router = useRouter();

  const navigationItems: NavItem[] = [
    {
      name: "Portfolio",
      href: "/dashboard",
      icon: <HomeIcon />,
    },
    {
      name: "Send",
      href: "/send",
      icon: <SendIcon />,
    },
    {
      name: "Swap",
      href: "/swap",
      icon: <SwapIcon />,
    },
    {
      name: "Vaults",
      href: "/vaults",
      icon: <SaveIcon />,
    },
    {
      name: "Discover",
      href: "/discover",
      icon: <ReceiveIcon />,
    },
    // {
    //   name: "Settings",
    //   href: "/settings",
    //   icon: <SettingsIcon />,
    // },
  ];

  // items we want to disable with "Coming soon" badge
  const comingSoon = new Set(["Swap", "Discover"]);

  // isMobileView styling: fixed bottom bar, hidden on md and up (mirror your original intent)
  return (
    <nav
      className="fixed bottom-0 left-1/2 -translate-x-1/2 z-40 w-[min(980px,96%)] w-full md:hidden bg-[#0D0D0D] shadow-lg border border-[#2a2a2a] px-3 py-2"
      aria-label="Bottom navigation"
    >
      <ul className="flex items-center justify-between gap-2">
        {navigationItems.map((item) => {
          // active detection (same logic as sidebar)
          const isActive = pathname === item.href;

          // Special behavior for Send item (pushes dashboard?send=true)
          if (item.name === "Send") {
            const sendActive = pathname === "/dashboardsend=true"

            return (
              <li key={item.name} className="flex-1">
                <button
                  onClick={() => router.push("/dashboard?send=true")}
                  className={`w-full flex flex-col items-center gap-1 py-2 rounded-lg transition-all duration-200 ${
                    sendActive
                      ? "text-[#27AAE1]"
                      : "text-[#A4A4A4] hover:text-white hover:bg-[#333333]"
                  }`}
                >
                  {React.cloneElement(item.icon as React.ReactElement<any>, {
                    isActive: sendActive,
                  })}
                  <span className="text-[11px]">{item.name}</span>
                </button>
              </li>
            );
          }

          // Coming soon (disabled) items
          if (comingSoon.has(item.name)) {
            return (
              <li key={item.name} className="flex-1">
                <button
                  disabled
                  aria-disabled="true"
                  className="w-full flex flex-col items-center gap-1 py-2 rounded-lg opacity-60 cursor-not-allowed text-[#A4A4A4] bg-transparent"
                >
                  {React.cloneElement(item.icon as React.ReactElement<any>, {
                    isActive: false,
                  })}
                  <div className="flex items-center gap-1">
                    <span className="text-[11px]">{item.name}</span>
                    {/* <span className="text-[9px] px-2 py-[2px] rounded-full bg-[#5f5e5e] text-[#f9f5f5]">
                      Coming soon
                    </span> */}
                  </div>
                </button>
              </li>
            );
          }

          // Default items: Link behaviour like sidebar
          return (
            <li key={item.name} className="flex-1">
              <Link
                href={item.href}
                className={`w-full flex flex-col items-center gap-1 py-2 rounded-lg transition-all duration-200 ${
                  isActive
                    ? " text-[#27AAE1]"
                    : "text-[#A4A4A4] hover:text-white hover:bg-[#333333]"
                }`}
              >
                {React.cloneElement(item.icon as React.ReactElement<any>, {
                  isActive,
                })}
                <span className="text-[11px]">{item.name}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
