'use client';

import { CandidateList } from '@/components/candidates/candidate-list';

export default function HomePage() {
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-4 py-8">
      <CandidateList />
    </main>
  );
}
