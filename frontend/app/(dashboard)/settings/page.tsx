// src/app/(dashboard)/settings/page.tsx
"use client";
import React, { useState } from "react";
import { useRouter } from "next/navigation";

interface SettingsCategory {
  id: string;
  name: string;
  icon: React.ReactNode;
}

interface SecurityOption {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  type: "navigation" | "toggle";
  enabled?: boolean;
}

export default function SettingsPage() {
  const [activeCategory, setActiveCategory] = useState("preferences");
  const router = useRouter();

  // State for toggle settings
  const [pushNotifications, setPushNotifications] = useState(true);
  const [biometricLogin, setBiometricLogin] = useState(true);

  // Handle navigation to sub-pages
  const handleNavigation = (path: string) => {
    router.push(path);
  };

  // Handle toggle changes
  const handleToggle = (setting: string) => {
    switch (setting) {
      case "notifications":
        setPushNotifications(!pushNotifications);
        break;
      case "biometric":
        setBiometricLogin(!biometricLogin);
        break;
      default:
        break;
    }
  };

  const categories: SettingsCategory[] = [
    {
      id: "security",
      name: "Security",
      icon: (
        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
          <path
            fillRule="evenodd"
            d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z"
            clipRule="evenodd"
          />
        </svg>
      ),
    },
    {
      id: "preferences",
      name: "Preferences",
      icon: (
        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
          <path
            fillRule="evenodd"
            d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z"
            clipRule="evenodd"
          />
        </svg>
      ),
    },
    {
      id: "support",
      name: "Support",
      icon: (
        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
          <path
            fillRule="evenodd"
            d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-2 0c0 .993-.241 1.929-.668 2.754l-1.524-1.525a3.997 3.997 0 00.078-2.183l1.562-1.562C15.759 8.241 16.993 8 18 8zm-5.165 3.913l1.58 1.58A5.98 5.98 0 0110 18a5.976 5.976 0 01-2.516-.552l1.562-1.562a4.006 4.006 0 001.789.027zm-4.677-2.796a4.002 4.002 0 01-.041-2.183l1.562-1.562C8.241 5.241 9.007 5 10 5s1.759.241 2.516.668l-1.562 1.562a4.002 4.002 0 00-1.789.027zm-1.58 1.58A5.98 5.98 0 012 10c0-.993.241-1.929.668-2.754l1.525 1.525a3.997 3.997 0 00-.078 2.183l-1.562 1.562zM5.165 6.087l-1.58-1.58A5.98 5.98 0 012 10a5.976 5.976 0 012.516.552l-1.562 1.562a4.006 4.006 0 01-1.789-.027z"
            clipRule="evenodd"
          />
        </svg>
      ),
    },
  ];

  const securityOptions: SecurityOption[] = [
    {
      id: "backup",
      title: "Backup Wallet",
      description: "Secure your recovery phrase",
      icon: (
        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
          <path
            fillRule="evenodd"
            d="M18 8a6 6 0 01-7.743 5.743L10 14l-1 1-1 1H6v2H2v-4l4.257-4.257A6 6 0 1118 8zm-6-4a1 1 0 100 2 2 2 0 012 2 1 1 0 102 0 4 4 0 00-4-4z"
            clipRule="evenodd"
          />
        </svg>
      ),
      type: "navigation",
    },
    {
      id: "pin",
      title: "Change PIN",
      description: "Update your security PIN",
      icon: (
        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
          <path
            fillRule="evenodd"
            d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z"
            clipRule="evenodd"
          />
        </svg>
      ),
      type: "navigation",
    },
    {
      id: "biometric",
      title: "Biometric Login",
      description: "Use fingerprint or face ID",
      icon: (
        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
          <path
            fillRule="evenodd"
            d="M10 1a4 4 0 00-4 4v1H5a1 1 0 00-1 1v3a1 1 0 001 1h1v2a4 4 0 008 0v-2h1a1 1 0 001-1V6a1 1 0 00-1-1h-1V5a4 4 0 00-4-4zM8 5a2 2 0 114 0v1H8V5zm4 6a2 2 0 11-4 0v2a2 2 0 114 0v-2z"
            clipRule="evenodd"
          />
        </svg>
      ),
      type: "toggle",
      enabled: biometricLogin,
    },
  ];

  const preferencesOptions = [
    {
      id: "notifications",
      title: "Push Notifications",
      description: "Transaction and AI tips",
      type: "toggle" as const,
      enabled: pushNotifications,
    },
    {
      id: "currency",
      title: "Default Currency",
      description: "Nigerian Naira (N)",
      type: "navigation" as const,
    },
    {
      id: "language",
      title: "Language",
      description: "English",
      type: "navigation" as const,
    },
  ];

  const supportOptions = [
    {
      id: "help",
      title: "Help Center",
      description: "Get help and support",
      type: "navigation" as const,
    },
    {
      id: "contact",
      title: "Contact Support",
      description: "Reach out to our team",
      type: "navigation" as const,
    },
    {
      id: "rate",
      title: "Rate App",
      description: "Share your feedback",
      type: "navigation" as const,
    },
  ];

  const renderSecurityContent = () => (
    <div className="flex flex-col gap-4">
      {securityOptions.map((option) => (
        <div
          key={option.id}
          className="bg-[#292929] rounded-2xl p-4 hover:bg-[#222222] transition-colors cursor-pointer"
          onClick={() => {
            if (option.type === "navigation") {
              handleNavigation(`/settings/${option.id}`);
            } else {
              handleToggle(option.id);
            }
          }}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-[#333333] rounded-full flex items-center justify-center">
                {option.icon}
              </div>
              <div>
                <h3 className="text-[#D5D5D5] font-semibold">{option.title}</h3>
                <p className="text-[#A4A4A4] text-sm">{option.description}</p>
              </div>
            </div>
            <div className="flex items-center">
              {option.type === "navigation" ? (
                <svg
                  className="w-5 h-5 text-[#A4A4A4]"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z"
                    clipRule="evenodd"
                  />
                </svg>
              ) : (
                <div className="relative">
                  <input
                    type="checkbox"
                    checked={option.enabled}
                    onChange={() => handleToggle(option.id)}
                    className="sr-only"
                  />
                  <div
                    className={`w-11 h-6 rounded-full transition-colors ${
                      option.enabled ? "bg-[#005CE6]" : "bg-[#333333]"
                    }`}
                  >
                    <div
                      className={`w-5 h-5 bg-white rounded-full shadow transform transition-transform ${
                        option.enabled ? "translate-x-5" : "translate-x-0.5"
                      } mt-0.5`}
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );

  const renderPreferencesContent = () => (
    <div className="space-y-4">
      {preferencesOptions.map((option) => (
        <div
          key={option.id}
          className="bg-[#292929] rounded-2xl p-4 hover:bg-[#222222] transition-colors cursor-pointer"
          onClick={() => {
            if (option.type === "navigation") {
              handleNavigation(`/settings/${option.id}`);
            } else {
              handleToggle(option.id);
            }
          }}
        >
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-white font-semibold">{option.title}</h3>
              <p className="text-[#A4A4A4] text-sm">{option.description}</p>
            </div>
            <div className="flex items-center">
              {option.type === "navigation" ? (
                <svg
                  className="w-5 h-5 text-[#A4A4A4]"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z"
                    clipRule="evenodd"
                  />
                </svg>
              ) : (
                <div className="relative">
                  <input
                    type="checkbox"
                    checked={option.enabled}
                    onChange={() => handleToggle(option.id)}
                    className="sr-only"
                  />
                  <div
                    className={`w-11 h-6 rounded-full transition-colors ${
                      option.enabled ? "bg-[#005CE6]" : "bg-[#333333]"
                    }`}
                  >
                    <div
                      className={`w-5 h-5 bg-white rounded-full shadow transform transition-transform ${
                        option.enabled ? "translate-x-5" : "translate-x-0.5"
                      } mt-0.5`}
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );

  const renderSupportContent = () => (
    <div className="space-y-4">
      {supportOptions.map((option) => (
        <div
          key={option.id}
          className="bg-[#292929] rounded-2xl p-4 hover:bg-[#222222] transition-colors cursor-pointer"
          onClick={() => handleNavigation(`/settings/${option.id}`)}
        >
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-white font-semibold">{option.title}</h3>
              <p className="text-[#A4A4A4] text-sm">{option.description}</p>
            </div>
            <div className="flex items-center">
              <svg
                className="w-5 h-5 text-[#A4A4A4]"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path
                  fillRule="evenodd"
                  d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z"
                  clipRule="evenodd"
                />
              </svg>
            </div>
          </div>
        </div>
      ))}
    </div>
  );

  return (
    <div className="flex flex-col lg:flex-row h-full">
      {/* Settings Categories Sidebar */}
      <div className="w-full lg:w-64 bg-[#292929] border-r border-[#333333] p-4 lg:p-6">
        <div className="space-y-2">
          {categories.map((category) => (
            <button
              key={category.id}
              onClick={() => setActiveCategory(category.id)}
              className={`w-full flex items-center space-x-3 px-4 py-3 rounded-2xl transition-all duration-200 ${
                activeCategory === category.id
                  ? "bg-[#222222] text-[#D5D5D5]"
                  : "text-[#A4A4A4] hover:text-white hover:bg-[#222222]"
              }`}
            >
              <div
                className={`w-5 h-5 ${
                  activeCategory === category.id
                    ? "text-[#D5D5D5]"
                    : "text-[#A4A4A4]"
                }`}
              >
                {category.icon}
              </div>
              <span className="font-medium">{category.name}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 p-4 lg:p-8">
        <div className="max-w-2xl">
          <h1 className="text-2xl lg:text-3xl font-bold text-white mb-6 lg:mb-8">
            Settings
          </h1>

          {activeCategory === "security" && renderSecurityContent()}

          {activeCategory === "preferences" && renderPreferencesContent()}

          {activeCategory === "support" && renderSupportContent()}
        </div>
      </div>
    </div>
  );
}
