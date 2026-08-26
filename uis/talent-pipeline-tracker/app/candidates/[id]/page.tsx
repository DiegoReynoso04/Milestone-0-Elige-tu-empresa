'use client';

import { use } from 'react';
import { CandidateDetail } from '@/components/candidates/candidate-detail';

export default function CandidateDetailPage(props: PageProps<'/candidates/[id]'>) {
  const { id } = use(props.params);

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-4 py-8">
      <CandidateDetail id={id} />
    </main>
  );
}
