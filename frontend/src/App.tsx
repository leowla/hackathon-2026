import { useEffect, useRef, useState } from 'react'
import { useSavedUrls } from './hooks/useSavedUrls'
import { IntentionsPage } from './pages/IntentionsPage'
import { UrlsPage } from './pages/UrlsPage'
import SpeechRecognition, { useSpeechRecognition } from 'react-speech-recognition';
import { useSocket } from './hooks/useSocket';

type Page = 'intentions' | 'urls'



export default function App() {
  const { urls, addUrl, removeUrl } = useSavedUrls()
  const { question, isSpeaking, sendAnswer, stopListeningSignal } = useSocket()
  const [intention, setIntention] = useState('')
  const [page, setPage] = useState<Page>('intentions')
  const [awaitingAnswer, setAwaitingAnswer] = useState(false)

  const {
    transcript,
    listening,
    resetTranscript,
    browserSupportsSpeechRecognition
  } = useSpeechRecognition();

  const transcriptRef = useRef(transcript)
  transcriptRef.current = transcript

  // First Arduino button press shows the question. Start listening only after
  // text-to-speech finishes so the app doesn't transcribe its own question.
  useEffect(() => {
    if (question && !isSpeaking) {
      resetTranscript();
      SpeechRecognition.startListening({ continuous: true })
      setAwaitingAnswer(true)
    }
  }, [question, isSpeaking])

  // Second Arduino button press: stops listening and submits the answer.
  useEffect(() => {
    if (stopListeningSignal === 0) return
    if (!awaitingAnswer) return

    SpeechRecognition.stopListening()
    sendAnswer(transcriptRef.current)
    setAwaitingAnswer(false)
  }, [stopListeningSignal, awaitingAnswer])

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
          <button
            className="button button--submit app__submit"
            type="button"
            onClick={handleUserChoicesSubmit}
          >
            Submit
          </button>
        </>
      )}

      <div className="voice-panel">
        <h2>Voice Recognition App</h2>
        {question && (
          <p className="voice-panel__question">
            {question}
          </p>
        )}
        <p>Microphone is: <strong>{listening ? 'ON 🎙️' : 'OFF 🔇'}</strong></p>

        <div className="voice-panel__actions">
          {/* startListening is asynchronous and prompts the user for mic permissions */}
          <button
            className="button button--start"
            type="button"
            onClick={() => SpeechRecognition.startListening({ continuous: true })}
          >
            Start
          </button>
          <button
            className="button button--stop"
            type="button"
            onClick={SpeechRecognition.stopListening}
          >
            Stop
          </button>
          <button
            className="button button--reset"
            type="button"
            onClick={resetTranscript}
          >
            Reset
          </button>
        </div>

        <div className="voice-panel__transcript">
          {transcript || 'Start speaking to see text here...'}
        </div>
      </div>

      <img
        className="moving-bunny"
        src="/moving-bunny-pixel.gif"
        alt=""
        aria-hidden="true"
      />

    </main>
  )
}
