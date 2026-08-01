import { IntentionInput } from '../components/IntentionInput'
import { UrlList } from '../components/UrlList'
import type { SavedUrl } from '../types'

type Props = {
  intention: string
  onIntentionChange: (value: string) => void
  urls: SavedUrl[]
  onGoToUrls: () => void
}

export function IntentionsPage({
  intention,
  onIntentionChange,
  urls,
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

      <section className="page__section">
        <h2 className="page__section-title">
          Saved{urls.length > 0 && ` (${urls.length})`}
        </h2>
        {/* Read-only here — adding and deleting live on the URL page. */}
        <UrlList
          urls={urls}
          emptyText="No URLs saved yet — add some from Page intentions."
        />
      </section>
    </>
  )
}
