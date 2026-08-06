import { useNavigate } from 'react-router-dom';
import { Compass } from 'lucide-react';
import { EmptyState } from '@/components/common/EmptyState';

export default function NotFound() {
  const navigate = useNavigate();
  return (
    <EmptyState
      icon={Compass}
      headline="Page not found"
      description="That route doesn’t exist in the admin panel. It may have moved, or the link may be out of date."
      action={{ label: 'Go to dashboard', onClick: () => navigate('/') }}
    />
  );
}
