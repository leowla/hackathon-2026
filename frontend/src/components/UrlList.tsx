import { shortUrl, siteLabel } from '../lib/url'
import type { SavedUrl } from '../types'

type Props = {
  urls: SavedUrl[]
  /** Omit to render the list read-only, without Delete buttons. */
  onRemove?: (id: string) => void
  emptyText?: string
}

export function UrlList({
  urls,
  onRemove,
  emptyText = 'No URLs saved yet.',
}: Props) {
  if (urls.length === 0) {
    return <p className="url-list__empty">{emptyText}</p>
  }

  return (
    <ul className="url-list">
      {urls.map((item) => (
        <li className="url-list__item" key={item.id}>
          <a
            className="url-list__link"
            href={item.url}
            title={item.url}
            target="_blank"
            rel="noopener noreferrer"
          >
            <span className="url-list__label">{siteLabel(item.url)}</span>
            <span className="url-list__url">{shortUrl(item.url)}</span>
          </a>
          {onRemove && (
            <button
              className="url-list__remove"
              type="button"
              onClick={() => onRemove(item.id)}
              aria-label={`Delete ${item.url}`}
            >
              Delete
            </button>
          )}
        </li>
      ))}
    </ul>
  )
}
