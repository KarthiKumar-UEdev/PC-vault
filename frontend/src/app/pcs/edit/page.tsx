'use client';

import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import { PCForm } from '@/components/pc-form';
import { ErrorState, PageLoader } from '@/components/ui/skeleton';

function EditPCContent() {
  const params = useSearchParams();
  const id = params.get('id');
  if (!id) return <ErrorState message="No PC id supplied." />;
  return <PCForm pcId={id} />;
}

export default function EditPCPage() {
  return (
    <Suspense fallback={<PageLoader label="Loading machine" />}>
      <EditPCContent />
    </Suspense>
  );
}
