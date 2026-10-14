import { useTranslation } from 'react-i18next'

export function ComingSoon({ name }: { name: string }) {
  const { t } = useTranslation()
  return (
    <div className="p-8">
      <h1 className="text-3xl font-extrabold">{name}</h1>
      <p className="mt-2 text-muted" dir="auto">{t('soon.body', { name })}</p>
    </div>
  )
}
