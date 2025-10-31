// src/components/ConfirmSeedForm.tsx
'use client';
import React, { useState, useMemo } from 'react';

function pickIndices(wordCount: number, n = 2) {
  const idx: number[] = [];
  while (idx.length < n) {
    const r = Math.floor(Math.random() * wordCount);
    if (!idx.includes(r)) idx.push(r);
  }
  return idx;
}

export default function ConfirmSeedForm({ mnemonic, onConfirm }: { mnemonic: string; onConfirm: (password: string) => Promise<void> }) {
  const words = mnemonic.split(' ');
  const indices = useMemo(() => pickIndices(words.length, 2), [mnemonic]);
  const [vals, setVals] = useState<string[]>(Array(indices.length).fill(''));
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    for (let i = 0; i < indices.length; i++) {
      if (vals[i].trim() !== words[indices[i]]) {
        setError('One or more words are incorrect. Please try again.');
        return;
      }
    }
    if (password.length < 8) {
      setError('Please provide a passphrase of at least 8 characters to encrypt your seed.');
      return;
    }
    setError(null);
    await onConfirm(password);
  }

  return (
    <form onSubmit={submit} className="mt-4 space-y-3">
      <p>Please confirm your backup by entering the following words:</p>
      {indices.map((idx, i) => (
        <div key={i}>
          <label>Word #{idx + 1}</label>
          <input value={vals[i]} onChange={(e) => { const copy = vals.slice(); copy[i] = e.target.value; setVals(copy); }} />
        </div>
      ))}
      <div>
        <label>Passphrase to encrypt seed (remember this)</label>
        <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
      </div>
      {error && <div className="text-red-600">{error}</div>}
      <button type="submit" className="btn">Confirm & Encrypt Backup</button>
    </form>
  );
}
