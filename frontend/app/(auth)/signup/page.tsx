// app/singup/page.tsx
'use client';

import { useRouter } from 'next/navigation';
import Image from 'next/image';
import Button from '@/components/Button';
import { getGoogleIdToken, getAppleIdToken } from '@/lib/oauthHelpers';

export default function SignInPage() {
  const router = useRouter();

  const handleNavigate = (route: string) => {
    router.push(route);
  };

  const handleGoogle = async () => {
    console.log('origin:', window.location.origin);
console.log('clientId (env):', process.env?.NEXT_PUBLIC_GOOGLE_CLIENT_ID ?? 'NOT SET');


    try {
      const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID!;
      const idToken = await getGoogleIdToken(clientId);
      // store temporarily for the wallet step
      localStorage.setItem('temp_provider', 'google');
      localStorage.setItem('temp_provider_token', idToken);
      // navigate to wallet creation
      router.push('/wallet');
    } catch (err) {
      console.error('Google sign-in failed', err);
      // display UI error as you wish
    }
  };

  const handleApple = async () => {
    try {
      const clientId = process.env.NEXT_PUBLIC_APPLE_CLIENT_ID!;
      const idToken = await getAppleIdToken(clientId);
      localStorage.setItem('temp_provider', 'apple');
      localStorage.setItem('temp_provider_token', idToken);
      router.push('/wallet');
    } catch (err) {
      console.error('Apple sign-in failed', err);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center font-sans">
      <main className="flex min-h-screen w-full max-w-lg flex-col py-5 px-8 text-center">
        <div className="flex justify-center items-center mb-8">
          <Image src="/senti.svg" alt="Senti Wallet Logo" width={150} height={85} />
        </div>

        <div className="flex flex-1 flex-col w-full items-center justify-center">
          <div className="flex flex-col items-center justify-center text-center max-w-sm">
            <Image src="/envelope.svg" alt="envelope icon" width={140} height={140} className="mb-4" />
            <h2 className="text-3xl w-full mb-2 font-bold">Sign up with email</h2>
            <p className="text-[#A4A4A4] text-sm">
              Sign in with your email to set it up as a backup. You will be immediately
              told to sign in again if you ever lose your wallet.
            </p>
          </div>

          <div className="mt-8 flex flex-col gap-4 justify-center items-center w-full">
            <Button
              onClick={handleGoogle}
              color="blue"
              text="Sign up with Google"
              otherstyles="min-w-[300px] w-full lg:min-w-sm cursor-pointer"
            />
            <Button
              onClick={handleApple}
              color="dark"
              text="Sign up with Apple ID (Coming soon)"
              otherstyles="min-w-[300px] w-full lg:min-w-sm disabled cursor-not-allowed" 
            />
            <button
              onClick={() => handleNavigate('/wallet')}
              className="text-sm text-gray-500 hover:underline"
            >
              Sign up another way
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
