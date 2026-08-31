import type { CSSProperties } from "react"
import { exhibits } from "../content/exhibits"
import { getFeaturedExhibit } from "../content/catalog"
import { AtmosphereBackground } from "../exhibit/AtmosphereBackground"
import { EmptyCollectionPage } from "../pages/EmptyCollectionPage"
import { ExhibitCard } from "./ExhibitCard"
import { FeaturedExhibit } from "./FeaturedExhibit"
import { Link } from "react-router-dom"
import "../styles/home.css"

export function CollectionPage() {
  const firstExhibit = exhibits[0]

  if (!firstExhibit) {
    return <EmptyCollectionPage />
  }

  const featuredExhibit = getFeaturedExhibit(exhibits) ?? firstExhibit
  const collectionWall = exhibits.filter((exhibit) => exhibit.slug !== featuredExhibit.slug)
  const [base, primary, accent] = featuredExhibit.presentation.palette

  return (
    <div
      className="collection-page"
      style={
        {
          "--collection-atmosphere-base": base,
          "--collection-atmosphere-primary": primary,
          "--collection-atmosphere-accent": accent,
        } as CSSProperties
      }
    >
      <div className="collection-page__atmosphere" aria-hidden="true">
        <AtmosphereBackground
          palette={featuredExhibit.presentation.palette}
          motion="edge-bloom"
          variant="collection"
        />
      </div>

      <header className="collection-page__intro">
        <p className="eyebrow">馆藏目录 · 共 {exhibits.length} 件</p>
        <p>打开收藏柜，从一件被保存下来的形体开始观看。</p>
      </header>

      <FeaturedExhibit exhibit={featuredExhibit} />

      {collectionWall.length > 0 ? (
        <section className="collection-wall" aria-labelledby="collection-wall-title">
          <div className="collection-wall__heading">
            <p className="eyebrow">其余藏品</p>
            <h2 id="collection-wall-title">馆藏墙</h2>
          </div>
          <div className="collection-wall__grid">
            {collectionWall.map((exhibit) => (
              <ExhibitCard key={exhibit.slug} exhibit={exhibit} />
            ))}
          </div>
        </section>
      ) : null}

      <aside className="collection-note" aria-labelledby="collection-note-title">
        <div>
          <p className="eyebrow">关于收藏</p>
          <h2 id="collection-note-title">形体被留存，观看仍在继续。</h2>
        </div>
        <p>
          这是一座收纳数字形体的小型私人展柜。每一件藏品都有自己的陈列方式、光线和观看距离。
        </p>
        <Link className="collection-note__link" to="/about/">
          阅读收藏说明 <span aria-hidden="true">→</span>
        </Link>
      </aside>
    </div>
  )
}
