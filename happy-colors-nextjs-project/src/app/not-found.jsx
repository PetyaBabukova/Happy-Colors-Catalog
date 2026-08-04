import PublicStatusPage from '@/components/ui/PublicStatusPage';

export default function NotFound() {
  return (
    <PublicStatusPage
      statusCode="404"
      titleKey="errors.notFoundTitle"
      descriptionKey="errors.notFoundDescription"
    />
  );
}
