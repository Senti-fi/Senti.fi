// src/components/AuthGuardClient.tsx
'use client';
import React, { useEffect } from 'react';
import { useAuth } from "@/context/AuthContext";
import { useRouter } from 'next/navigation';

export default function AuthGuardClient({ children }: { children: React.ReactNode }) {
   const { loading, isAuthenticated } = useAuth();
    const router = useRouter();

    useEffect(() => {
      if (!loading) {
        if (!isAuthenticated()) {
          router.replace('/login'); // or push
        }
      }
    }, [loading, isAuthenticated, router]);

    // if (loading) return <div>Loading...</div>;

    // if (!isAuthenticated()) return null; // render nothing while redirecting

    return <>{children}</>;
}
