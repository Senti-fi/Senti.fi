'use client';

import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { Swiper, SwiperSlide } from 'swiper/react';
import { Pagination, Autoplay } from 'swiper/modules';
import 'swiper/css';
import 'swiper/css/pagination';
import './globals.css'; // ✅ we'll add custom CSS here
import Button from '@/components/Button';

export default function Home() {
  const router = useRouter();

  const slides = [
    {
      title: 'Save Money Securely',
      description:
        'Store your money as stablecoins and access it anytime, anywhere without worrying about inflation.',
      image: '/onboard-img.svg',
      alt: 'Wallet',
    },
    {
      title: 'Easy Withdrawals',
      description:
        'Convert your crypto to local currency and withdraw directly to your bank account in minutes.',
      image: '/onboard-img.svg',
      alt: 'Secure Backup',
    },
    {
      title: 'Smart AI Suggestions',
      description:
        'Get personalized financial tips to help you save more and make the most of your money.',
      image: '/onboard-img.svg',
      alt: 'Analytics',
    },
  ];


  const handleNavigate = (route: string) => {
    router.push(route);
  };

  return (
    <div className="flex min-h-screen items-center justify-center font-sans">
      <main className="flex min-h-screen w-full max-w-lg flex-col justify-between py-5 px-8 text-center">
        {/* Logo */}
        <div className="flex justify-center items-center">
          <Image src="/senti.svg" alt="Senti Wallet Logo" width={150} height={85} />
        </div>

        {/* Carousel */}
        <div className=' flex flex-col flex-1 w-full justify-center items-center'>
          <Swiper
            modules={[Pagination, Autoplay]}
            spaceBetween={30}
            slidesPerView={1}
            pagination={{
                clickable: true,
                el: '.custom-pagination',
              }}
            autoplay={{ delay: 4000 }}
            loop
            className='w-full'
          >
            {slides.map((slide, index) => (
              <SwiperSlide key={index}>
                <div className="flex flex-col items-center justify-center  text-center">
                  <Image
                    src={slide.image}
                    alt={slide.alt}
                    width={350}
                    height={350}
                    className="mb-6"
                  />
                  <h2 className="text-3xl w-full mb-2 font-bold ">{slide.title}</h2>
                  <p className="text-[#A4A4A4] text-sm max-w-sm">{slide.description}</p>
                </div>
              </SwiperSlide>
            ))}

          </Swiper>
          
          <div className="custom-pagination gap-1 my-4 flex justify-center" />
          
          {/* Button */}
          <div className="mt-2 flex flex-col gap-4 justify-center items-center w-full">
            <Button onClick={() => handleNavigate('/login')} color='blue' text='Sign in to Senti' otherstyles='min-w-[300px] w-full lg:min-w-sm'/>
            <Button onClick={() => handleNavigate('/signup')} color='dark' text='Create Wallet'  otherstyles='min-w-[300px] w-full lg:min-w-sm'/>
          </div>
        </div>

      </main>
    </div>
  );
}
