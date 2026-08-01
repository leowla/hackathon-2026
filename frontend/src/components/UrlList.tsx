import type { SavedUrl } from '../types'

type Props = {
  urls: SavedUrl[]
  onRemove: (id: string) => void
}

export function UrlList({ urls, onRemove }: Props) {
  if (urls.length === 0) {
    return <p className="url-list__empty">No URLs saved yet.</p>
  }

  return (
    <ul className="url-list">
      {urls.map((item) => (
        <li className="url-list__item" key={item.id}>
          <a
            className="url-list__link"
            href={item.url}
            target="_blank"
            rel="noopener noreferrer"
          >
            {item.url}
          </a>
          <button
            className="url-list__remove"
            type="button"
            onClick={() => onRemove(item.id)}
            aria-label={`Delete ${item.url}`}
          >
            Delete
          </button>
        </li>
      ))}
    </ul>
  )
}
