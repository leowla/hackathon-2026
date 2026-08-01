import { UrlForm } from './components/UrlForm'
import { UrlList } from './components/UrlList'
import { useSavedUrls } from './hooks/useSavedUrls'

export default function App() {
  const { urls, addUrl, removeUrl } = useSavedUrls()

  return (
    <main className="app">
      <header className="app__header">
        <h1 className="app__title">URL Saver</h1>
        <p className="app__subtitle">
          Paste a website address to save it to your list.
        </p>
      </header>

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
