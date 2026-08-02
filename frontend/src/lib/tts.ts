const FISH_API_KEY = import.meta.env.VITE_FISH_API_KEY

export async function txtToSpeech(text: string): Promise<ArrayBuffer> {
  const response = await fetch("https://api.fish.audio/v1/tts", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${FISH_API_KEY}`,
      "Content-Type": "application/json",
      model: "s2.1-pro-free",
    },
    body: JSON.stringify({
      text,
      reference_id: "536d3a5e000945adb7038665781a4aca",
      format: "mp3",
    }),
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
