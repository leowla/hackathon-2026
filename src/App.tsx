import { useState } from 'react'
import { IntentionInput } from './components/IntentionInput'
import { UrlForm } from './components/UrlForm'
import { UrlList } from './components/UrlList'
import { useSavedUrls } from './hooks/useSavedUrls'

export default function App() {
  const { urls, addUrl, removeUrl } = useSavedUrls()
  const [intention, setIntention] = useState('')

  return (
    <main className="app">
      <header className="app__header">
        <h1 className="app__title">URL Saver</h1>
        <p className="app__subtitle">
          Say what you're trying to do, then save the sites it applies to.
        </p>
      </header>

      <IntentionInput value={intention} onChange={setIntention} />

      <UrlForm onAdd={addUrl} />

      <section className="app__section">
        <h2 className="app__section-title">
          Saved{urls.length > 0 && ` (${urls.length})`}
        </h2>
        <UrlList urls={urls} onRemove={removeUrl} />
      </section>
    </main>
  )
}
