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
        <div className="brand">
          <img
            className="brand__mascot"
            src="/rabbit-face.png"
            alt=""
            aria-hidden="true"
          />
          <h1 className="page__title">HabitRabbit</h1>
        </div>
        <p className="page__intro">
          Build gentle habits with your little bunny companion.
        </p>
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
