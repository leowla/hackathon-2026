import { useState } from 'react'
import { useSavedUrls } from './hooks/useSavedUrls'
import { IntentionsPage } from './pages/IntentionsPage'
import { UrlsPage } from './pages/UrlsPage'

type Page = 'intentions' | 'urls'

export default function App() {
  const { urls, addUrl, removeUrl } = useSavedUrls()
  const [intention, setIntention] = useState('')
  const [page, setPage] = useState<Page>('intentions')

  return (
    <main className="app">
      {page === 'intentions' ? (
        <IntentionsPage
          intention={intention}
          onIntentionChange={setIntention}
          onGoToUrls={() => setPage('urls')}
        />
      ) : (
        <UrlsPage
          urls={urls}
          onAdd={addUrl}
          onRemove={removeUrl}
          onBack={() => setPage('intentions')}
        />
      )}
    </main>
  )
}
