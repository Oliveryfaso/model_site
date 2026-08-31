import type { JSX } from "react"
import { Link } from "react-router-dom"
import type { Exhibit } from "../content/types"

export function FeaturedExhibit({ exhibit }: { exhibit: Exhibit }): JSX.Element {
  return (
    <article className="featured-exhibit">
      <Link
        className="featured-exhibit__link"
        to={`/exhibits/${exhibit.slug}/`}
        aria-label={`进入${exhibit.title}展厅`}
        viewTransition
      >
        <div className="featured-exhibit__cover">
          <img
            src={exhibit.cover}
            alt={exhibit.title}
            width={1600}
            height={1200}
            fetchPriority="high"
            decoding="async"
            style={{ viewTransitionName: `exhibit-cover-${exhibit.slug}` }}
          />
        </div>
        <div className="featured-exhibit__details">
          <p className="featured-exhibit__number">藏品 {exhibit.collectionNumber}</p>
          <h1>{exhibit.title}</h1>
          <p className="featured-exhibit__summary">{exhibit.summary}</p>
          <ul className="exhibit-tags" aria-label="藏品标签">
            {exhibit.tags.map((tag) => (
              <li key={tag}>{tag}</li>
            ))}
          </ul>
          <span className="featured-exhibit__action" aria-hidden="true">
            进入展厅 <span>→</span>
          </span>
        </div>
      </Link>
    </article>
  )
}
