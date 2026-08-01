import { useState } from 'react'
import { useSavedUrls } from './hooks/useSavedUrls'
import { IntentionsPage } from './pages/IntentionsPage'
import { UrlsPage } from './pages/UrlsPage'
import SpeechRecognition, { useSpeechRecognition } from 'react-speech-recognition';

type Page = 'intentions' | 'urls'

export default function App() {
  const { urls, addUrl, removeUrl } = useSavedUrls()
  const [intention, setIntention] = useState('')
  const [page, setPage] = useState<Page>('intentions')

  const {
    transcript,
    listening,
    resetTranscript,
    browserSupportsSpeechRecognition
  } = useSpeechRecognition();

  if (!browserSupportsSpeechRecognition) {
    return <span>Your browser doesn't support speech recognition.</span>;
  }

  

  return (
    <main className="app">
      {page === 'intentions' ? (
        <IntentionsPage
          intention={intention}
          onIntentionChange={setIntention}
          urls={urls}
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

      <div style={{ padding: '20px', fontFamily: 'sans-serif' }}>
      <h2>Voice Recognition App</h2>
      <p>Microphone is: <strong>{listening ? 'ON 🎙️' : 'OFF 🔇'}</strong></p>
      
      <div style={{ gap: '10px', display: 'flex', marginBottom: '20px' }}>
        {/* startListening is asynchronous and prompts the user for mic permissions */}
        <button onClick={() => SpeechRecognition.startListening({ continuous: true })}>Start</button>
        <button onClick={SpeechRecognition.stopListening}>Stop</button>
        <button onClick={resetTranscript}>Reset</button>
      </div>
      
      <div style={{ border: '1px solid #ccc', padding: '10px', minHeight: '100px' }}>
        {transcript || 'Start speaking to see text here...'}
      </div>
    </div>


    </main>
  )
}
