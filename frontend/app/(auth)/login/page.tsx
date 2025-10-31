'use client';

import { useRouter } from 'next/navigation';
import Image from 'next/image';
import Button from '@/components/Button';
import {useWalletAuth} from '@/hooks/useWalletAuth';

export default function SignInPage() {
  const router = useRouter();

  const { signInWithSavedWallet, loading } = useWalletAuth();

  const handleNavigate = (route: string) => {
    router.push(route);
  };

  return (
    <div className="flex min-h-screen items-center justify-center font-sans">
      <main className="flex min-h-screen w-full max-w-lg flex-col py-5 px-8 text-center">
        {/* Logo (always at top) */}
        <div className="flex justify-center items-center mb-8">
          <Image src="/senti.svg" alt="Senti Wallet Logo" width={150} height={85} />
        </div>

        {/* Centered content */}
        <div className="flex flex-1 flex-col w-full items-center justify-center">
          <div className="flex flex-col items-center justify-center text-center max-w-sm">
            <Image
              src="/envelope.svg"
              alt="envelope icon"
              width={140}
              height={140}
              className="mb-4"
            />
            <h2 className="text-3xl w-full mb-2 font-bold ">Log in with email</h2>
            <p className="text-[#A4A4A4] text-sm">
              Log in with your email to set it up as a backup. You will be immediately
              told to sign in again if you ever lose your wallet.
            </p>
          </div>
          {/* Buttons */}
        <div className="mt-8 flex flex-col gap-4 justify-center items-center w-full">
          <Button
            onClick={() => {}}
            color="blue"
            text="Log in with Google"
            otherstyles="min-w-[300px] w-full lg:min-w-sm cursor-pointer"
          />
          <Button
            onClick={() => {}}
            color="dark"
            text="Log in with Apple ID (coming soon)"
            otherstyles="min-w-[300px] w-full lg:min-w-sm disabled cursor-not-allowed"
          />
          <button
              onClick={signInWithSavedWallet}
              className="text-sm text-gray-500 hover:underline"
              disabled={loading}
            >
              {loading ? 'Signing in...' : 'Log in wallet instead'}
            </button>
        </div>
        </div>

        
      </main>
    </div>
  );
}
