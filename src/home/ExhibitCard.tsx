import type { JSX } from "react"
import { Link } from "react-router-dom"
import type { Exhibit } from "../content/types"

export function ExhibitCard({ exhibit }: { exhibit: Exhibit }): JSX.Element {
  const hasAnimation = exhibit.animation !== undefined && exhibit.animation.mode !== "static"

  return (
    <article className="exhibit-card">
      <Link
        className="exhibit-card__link"
        to={`/exhibits/${exhibit.slug}/`}
        aria-label={`进入${exhibit.title}展厅`}
        viewTransition
      >
        <div className="exhibit-card__cover">
          <img
            src={exhibit.cover}
            alt={exhibit.title}
            width={1600}
            height={1200}
            loading="lazy"
            decoding="async"
            style={{ viewTransitionName: `exhibit-cover-${exhibit.slug}` }}
          />
          {hasAnimation ? <span className="exhibit-card__animation">可播放动画</span> : null}
        </div>
        <div className="exhibit-card__body">
          <p className="exhibit-card__number">藏品 {exhibit.collectionNumber}</p>
          <h3>{exhibit.title}</h3>
          <p className="exhibit-card__summary">{exhibit.summary}</p>
          <ul className="exhibit-tags" aria-label="藏品标签">
            {exhibit.tags.map((tag) => (
              <li key={tag}>{tag}</li>
            ))}
          </ul>
        </div>
      </Link>
    </article>
  )
}
