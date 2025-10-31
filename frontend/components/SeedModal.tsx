// src/components/SeedModal.tsx
'use client';
import React from 'react';

export default function SeedModal({ mnemonic, onClose }: { mnemonic: string; onClose: () => void }) {
  const words = mnemonic.split(' ');
  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black/40">
      <div className="bg-white p-6 rounded max-w-xl w-full">
        <h3 className="text-lg font-semibold">Secret Recovery Phrase</h3>
        <p className="text-sm text-red-600">Write this down and store it safely. Never share it with anyone.</p>
        <div className="grid grid-cols-3 gap-2 mt-4">
          {words.map((w, i) => (
            <div key={i} className="p-2 border rounded">
              <span className="font-mono text-sm">{i + 1}.</span> <span>{w}</span>
            </div>
          ))}
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 border rounded">Close</button>
        </div>
      </div>
    </div>
  );
}
