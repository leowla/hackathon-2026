import { useEffect, useRef, useState } from 'react'
import { useSavedUrls } from './hooks/useSavedUrls'
import { IntentionsPage } from './pages/IntentionsPage'
import { UrlsPage } from './pages/UrlsPage'
import SpeechRecognition, { useSpeechRecognition } from 'react-speech-recognition';
import { useSocket } from './hooks/useSocket';

type Page = 'intentions' | 'urls'



export default function App() {
  const { urls, addUrl, removeUrl } = useSavedUrls()
  const { question, isSpeaking, sendAnswer, buttonPressCount } = useSocket()
  const [intention, setIntention] = useState('')
  const [page, setPage] = useState<Page>('intentions')

  const {
    transcript,
    listening,
    resetTranscript,
    browserSupportsSpeechRecognition
  } = useSpeechRecognition();

  const transcriptRef = useRef(transcript)
  transcriptRef.current = transcript

  useEffect(() => {
    if (question && !isSpeaking) {
      resetTranscript();
      SpeechRecognition.startListening({ continuous: true })
    }
  }, [question, isSpeaking])

  useEffect(() => {
    if (buttonPressCount === 0) return
    SpeechRecognition.stopListening()
    sendAnswer(transcriptRef.current)
  }, [buttonPressCount])

  if (!browserSupportsSpeechRecognition) {
    return <span>Your browser doesn't support speech recognition.</span>;
  }

  async function handleUserChoicesSubmit() {
  try {
    const response = await fetch("http://localhost:3321/api/user-choices", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      // Send the payload matching the { intention, urls } expected by req.body
      body: JSON.stringify({
        intention: intention,
        urls: urls,
      }),
    });

    if (!response.ok) {
      // Capture the error message sent by the server (e.g. "No intention or urls found in request")
      const errorMessage = await response.text();
      throw new Error(`Server returned ${response.status}: ${errorMessage}`);
    }

    const successMessage = await response.text();
    console.log("Success:", successMessage); // Should log: "User choices saved successfully!"
    
    return true; 
  } catch (error) {
    console.error("Error submitting user choices:", error);
    return false;
  }
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
        <>
        <UrlsPage
          urls={urls}
          onAdd={addUrl}
          onRemove={removeUrl}
          onBack={() => setPage('intentions')}
        />
        <button onClick={handleUserChoicesSubmit}>Submit</button>
        </>
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
