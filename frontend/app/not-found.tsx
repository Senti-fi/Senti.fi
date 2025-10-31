// src/app/not-found.tsx
"use client";
import React from "react";
import Link from "next/link";
import Image from "next/image";
import Button from "@/components/Button";

export default function NotFound() {
  return (
    <div className="min-h-screen bg-[#171717] text-white flex items-center justify-center">
      <div className="max-w-md mx-auto text-center px-6">
        {/* Logo */}
        <div className="mb-8">
          <Image
            src="/images/logo.png"
            alt="Senti Logo"
            width={120}
            height={68}
            className="mx-auto"
          />
        </div>

        {/* 404 Content */}
        <div className="mb-8">
          <h1 className="text-6xl font-bold text-[#005CE6] mb-4">404</h1>
          <h2 className="text-2xl font-semibold text-white mb-3">
            Page Not Found
          </h2>
          <p className="text-[#A4A4A4] text-sm leading-relaxed">
            The page you're looking for doesn't exist or has been moved. Let's
            get you back on track.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="space-y-4">
          <Link href="/dashboard" className="block">
            <Button
              text="Go to Dashboard"
              color="blue"
              onClick={() => {}}
              otherstyles="w-full"
            />
          </Link>
          <Link href="/" className="block">
            <Button
              text="Back to Home"
              color="dark"
              onClick={() => {}}
              otherstyles="w-full"
            />
          </Link>
        </div>

        {/* Help Text */}
        <div className="mt-8 pt-6 border-t border-[#333333]">
          <p className="text-[#A4A4A4] text-xs">
            Need help? Contact our support team
          </p>
        </div>
      </div>
    </div>
  );
}
