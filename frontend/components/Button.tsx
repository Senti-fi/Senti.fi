'use client';
import React from 'react';

type ButtonProps = {
  text: string;
  onClick: () => void;
  color?: 'blue' | 'dark';
  disabled?: boolean;
  otherstyles?: string;
};

export default function Button({ text, onClick, color = 'blue', disabled = false, otherstyles }: ButtonProps) {
  const baseStyle =
    'px-6 py-3 rounded-2xl font-semibold transition-all duration-200 focus:outline-none disabled:opacity-60 disabled:cursor-not-allowed cusror-pointer';

  const colorStyles =
    color === 'blue'
      ? 'bg-[#005CE6] text-white'
      : 'bg-[#292929] text-white';

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`${baseStyle} ${colorStyles} ${otherstyles || ''}`}
    >
      {text}
    </button>
  );
}
