import { useState } from 'react'
import type { FormEvent } from 'react'
import type { AddUrlResult } from '../hooks/useSavedUrls'

type Props = {
  onAdd: (raw: string) => AddUrlResult
}

export function UrlForm({ onAdd }: Props) {
  const [value, setValue] = useState('')
  const [error, setError] = useState<string | null>(null)

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const result = onAdd(value)
    if (result.ok) {
      setValue('')
      setError(null)
    } else {
      setError(result.error)
    }
  }

  return (
    <form className="url-form" onSubmit={handleSubmit} noValidate>
      <div className="url-form__row">
        <input
          className="url-form__input"
          type="text"
          placeholder="example.com"
          aria-label="Website URL"
          aria-invalid={error !== null}
          value={value}
          onChange={(event) => {
            setValue(event.target.value)
            setError(null)
          }}
        />
        <button
          className="button button--save"
          type="submit"
          disabled={value.trim() === ''}
        >
          Save
        </button>
      </div>
      {error && (
        <p className="url-form__error" role="alert">
          {error}
        </p>
      )}
    </form>
  )
}
