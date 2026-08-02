const TTS_URL = "http://localhost:3321/api/tts"

export async function txtToSpeech(text: string): Promise<ArrayBuffer> {
  const response = await fetch(TTS_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ text }),
  })

  if (!response.ok) {
    const errText = await response.text()
    throw new Error(`TTS request failed: ${response.status} ${errText}`)
  }

  return response.arrayBuffer()
}

export async function playAudio(buffer: ArrayBuffer): Promise<void> {
  const blob = new Blob([buffer], { type: "audio/mpeg" })
  const url = URL.createObjectURL(blob)
  const audio = new Audio(url)

  return new Promise((resolve, reject) => {
    audio.onended = () => {
      URL.revokeObjectURL(url)
      resolve()
    }
    audio.onerror = (err) => {
      URL.revokeObjectURL(url)
      reject(err)
    }
    audio.play().catch(reject)
  })
}

export async function speak(text: string, onFinished?: () => void): Promise<void> {
  const buffer = await txtToSpeech(text)
  await playAudio(buffer)
  onFinished?.()
}
