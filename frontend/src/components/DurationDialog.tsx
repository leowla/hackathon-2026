import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { siteLabel } from '../lib/url'
import type { SavedUrl } from '../types'

type Props = {
  /** The item being asked about, or null when the dialog is closed. */
  item: SavedUrl | null
  onClose: () => void
}

export function DurationDialog({ item, onClose }: Props) {
  const ref = useRef<HTMLDialogElement>(null)
  const [minutes, setMinutes] = useState('15')

  // <dialog> is opened imperatively — showModal() is what gives us the
  // backdrop, focus trapping, and Esc-to-close for free.
  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return

    if (item && !dialog.open) {
      setMinutes('15')
      dialog.showModal()
    } else if (!item && dialog.open) {
      dialog.close()
    }
  }, [item])

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    // Nothing consumes the duration yet — just acknowledge and close.
    onClose()
  }

  return (
    <dialog className="dialog" ref={ref} onClose={onClose}>
      {item && (
        <form className="dialog__form" onSubmit={handleSubmit}>
          <h2 className="dialog__title">
            How long on {siteLabel(item.url)}?
          </h2>

          <label className="dialog__label" htmlFor="minutes">
            Minutes
          </label>
          <input
            className="dialog__input"
            id="minutes"
            type="number"
            min="1"
            max="240"
            value={minutes}
            onChange={(event) => setMinutes(event.target.value)}
            autoFocus
          />

          <div className="dialog__actions">
            <button className="link-button" type="button" onClick={onClose}>
              Cancel
            </button>
            <button className="button" type="submit">
              Save
            </button>
          </div>
        </form>
      )}
    </dialog>
  )
}
