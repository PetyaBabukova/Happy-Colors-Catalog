export default function AiVisualLabel({ locale = 'bg' }) {
  return (
    <span
      className="aiVisualLabel"
      lang={locale === 'en' ? 'en' : 'bg'}
      aria-hidden="true"
    >
      {locale === 'en' ? 'AI visual' : 'AI визуализация'}
    </span>
  );
}
