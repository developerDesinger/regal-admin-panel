import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Compass } from 'lucide-react';
import { EmptyState } from '@/components/common/EmptyState';

export default function NotFound() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  return (
    <EmptyState
      icon={Compass}
      headline={t('notFound.title')}
      description={t('notFound.body')}
      action={{ label: t('notFound.back'), onClick: () => navigate('/') }}
    />
  );
}
