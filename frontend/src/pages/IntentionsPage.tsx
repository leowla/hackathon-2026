import { IntentionInput } from '../components/IntentionInput'

type Props = {
  intention: string
  onIntentionChange: (value: string) => void
  onGoToUrls: () => void
}

export function IntentionsPage({
  intention,
  onIntentionChange,
  onGoToUrls,
}: Props) {
  return (
    <>
      <header className="page__header">
        <h1 className="page__title">This App</h1>
        <p className="page__intro">Say what you're trying to do.</p>
      </header>

      <IntentionInput value={intention} onChange={onIntentionChange} />

      <button className="button page__cta" type="button" onClick={onGoToUrls}>
        Page intentions
      </button>
    </>
  )
}
