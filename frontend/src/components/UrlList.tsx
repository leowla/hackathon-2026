import type { KeyboardEvent, MouseEvent } from 'react'
import { shortUrl, siteLabel } from '../lib/url'
import type { SavedUrl } from '../types'

type Props = {
  urls: SavedUrl[]
  /** Omit to render the list read-only, without Delete buttons. */
  onRemove?: (id: string) => void
  /** Omit to make the row body inert instead of opening the duration prompt. */
  onOpenDuration?: (item: SavedUrl) => void
  emptyText?: string
}

export function UrlList({
  urls,
  onRemove,
  onOpenDuration,
  emptyText = 'No URLs saved yet.',
}: Props) {
  if (urls.length === 0) {
    return (
      <div className="url-list__empty">
        <img
          className="url-list__empty-mascot"
          src="/rabbit-face.png"
          alt=""
          aria-hidden="true"
        />
        <p>{emptyText}</p>
      </div>
    )
  }

  function handleRowClick(event: MouseEvent<HTMLLIElement>, item: SavedUrl) {
    // The link and the Delete button own their own clicks; everything else
    // in the row belongs to the duration prompt.
    if ((event.target as HTMLElement).closest('a, button')) return
    onOpenDuration?.(item)
  }

  function handleRowKeyDown(
    event: KeyboardEvent<HTMLLIElement>,
    item: SavedUrl,
  ) {
    if (event.target !== event.currentTarget) return
    if (event.key !== 'Enter' && event.key !== ' ') return
    event.preventDefault()
    onOpenDuration?.(item)
  }

  return (
    <ul className="url-list">
      {urls.map((item) => (
        <li
          className={
            onOpenDuration ? 'url-list__item url-list__item--clickable' : 'url-list__item'
          }
          key={item.id}
          tabIndex={onOpenDuration ? 0 : undefined}
          aria-label={
            onOpenDuration
              ? `Set how long to stay on ${item.url}`
              : undefined
          }
          onClick={
            onOpenDuration ? (event) => handleRowClick(event, item) : undefined
          }
          onKeyDown={
            onOpenDuration ? (event) => handleRowKeyDown(event, item) : undefined
          }
        >
          {/* Both lines open the site. The space around them does not. */}
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
