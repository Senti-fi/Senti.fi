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

export default function Sidebar() {
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
      name: "Vault",
      href: "/vaults",
      icon: <SaveIcon />,
    },
    {
      name: "Discover",
      href: "/discover",
      icon: <ReceiveIcon />,
    },
    {
      name: "Settings",
      href: "/settings",
      icon: <SettingsIcon />,
    },
  ];

   // items we want to disable with "Coming soon" badge
  const comingSoon = new Set(["Swap", "Discover"]);


  return (
    <div className="w-full lg:w-64 bg-[#222222] rounded-tr-[16px] rounded-br-[16px] flex flex-col h-full">
      {/* Logo */}
      <div className="py-4 md:py-[24px] flex items-center justify-center">
        <img
          src="/images/logo.png"
          alt="Senti Logo"
          className="w-[100px] md:w-[140px] object-contain"
        />
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-2 md:p-4">
        <ul className="space-y-2">
          {navigationItems.map((item) => {
            const isActive = pathname === item.href;
            // For the Send item we want special behavior:
            if (item.name === "Send") {
              return (
                <li key={item.name}>
                  <button
                    onClick={() => router.push("/dashboard?send=true")}
                    className={`w-full text-left flex items-center space-x-2 md:space-x-3 px-3 md:px-4 py-2 md:py-3 rounded-2xl transition-all duration-200 ${
                      pathname === "/dashboard?send=true" // keep highlight when on dashboard
                        ? "bg-[#333333] text-[#27AAE1]"
                        : "text-[#A4A4A4] hover:text-white hover:bg-[#333333]"
                    }`}
                  >
                    {React.cloneElement(item.icon as React.ReactElement<any>, {
                      isActive: pathname === "/dashboard?send=true",
                    })}
                    <span className="font-medium text-sm md:text-base">{item.name}</span>
                  </button>
                </li>
              );
            }

            // Coming soon (disabled) items
            if (comingSoon.has(item.name)) {
              return (
                <li key={item.name}>
                  <button
                    disabled
                    aria-disabled="true"
                    className="w-full text-left flex items-center justify-between space-x-2 md:space-x-3 px-3 md:px-4 py-2 md:py-3 rounded-2xl transition-all duration-200 opacity-60 cursor-not-allowed text-[#A4A4A4] bg-transparent"
                  >
                    <div className="flex items-center space-x-2">
                      {React.cloneElement(item.icon as React.ReactElement<any>, {
                        isActive: false,
                      })}
                      <span className="font-medium text-sm md:text-base">{item.name}</span>
                    </div>

                    <span className="text-[8px] px-2 py-0.5 rounded-full bg-[#5f5e5e] text-[#f9f5f5]">
                      Coming soon
                    </span>
                  </button>
                </li>
              );
            }

            // default behavior for other nav items:
            return (
              <li key={item.name}>
                <Link
                  href={item.href}
                  className={`flex items-center space-x-2 md:space-x-3 px-3 md:px-4 py-2 md:py-3 rounded-2xl transition-all duration-200 ${
                    isActive
                      ? "bg-[#333333] text-[#27AAE1]"
                      : "text-[#A4A4A4] hover:text-white hover:bg-[#333333]"
                  }`}
                >
                  {React.cloneElement(item.icon as React.ReactElement<any>, {
                    isActive
                  })}
                  <span className="font-medium text-sm md:text-base">
                    {item.name}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}
