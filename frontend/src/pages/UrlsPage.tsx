import { useState } from 'react'
import { DurationDialog } from '../components/DurationDialog'
import { UrlForm } from '../components/UrlForm'
import { UrlList } from '../components/UrlList'
import type { AddUrlResult } from '../hooks/useSavedUrls'
import type { SavedUrl } from '../types'

type Props = {
  urls: SavedUrl[]
  onAdd: (raw: string) => AddUrlResult
  onRemove: (id: string) => void
  onBack: () => void
}

export function UrlsPage({ urls, onAdd, onRemove, onBack }: Props) {
  const [durationFor, setDurationFor] = useState<SavedUrl | null>(null)

  return (
    <>
      <button className="link-button" type="button" onClick={onBack}>
        Back
      </button>

      <header className="page__header">
        <h1 className="page__title">Page Intention</h1>
        <p className="page__intro">Save the sites your intention applies to.</p>
      </header>

      <UrlForm onAdd={onAdd} />

      <section className="page__section">
        <h2 className="page__section-title">
          Saved{urls.length > 0 && ` (${urls.length})`}
        </h2>
        <UrlList
          urls={urls}
          onRemove={onRemove}
          onOpenDuration={setDurationFor}
        />
      </section>

      <DurationDialog
        item={durationFor}
        onClose={() => setDurationFor(null)}
      />
    </>
  )
}
