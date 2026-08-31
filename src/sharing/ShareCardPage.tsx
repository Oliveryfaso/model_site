import { useParams } from "react-router-dom"
import { siteConfig } from "../app/siteConfig"
import { getExhibitBySlug } from "../content/catalog"
import "../styles/share-card.css"

const cardSize = {
  width: "1200px",
  height: "630px",
  maxWidth: "none",
  margin: "0px",
  padding: "0px",
  flex: "none",
} as const

export function ShareCardPage() {
  const { slug } = useParams()
  const exhibit = slug ? getExhibitBySlug(slug) : undefined

  if (!exhibit) {
    return (
      <main className="share-card share-card--error" data-share-card style={cardSize}>
        <section className="share-card__error-copy">
          <p className="share-card__accession">分享卡片捕获失败</p>
          <h1>无法生成分享卡片</h1>
          <p>未找到路径标识为「{slug ?? "（空）"}」的藏品。</p>
          <p className="share-card__site-title">{siteConfig.siteTitle}</p>
        </section>
      </main>
    )
  }

  return (
    <main className="share-card" data-share-card style={cardSize}>
      <figure className="share-card__image-frame">
        <img src={exhibit.cover} alt={`${exhibit.title}馆藏封面`} />
      </figure>

      <section className="share-card__copy" aria-labelledby="share-card-title">
        <div>
          <p className="share-card__accession">藏品 {exhibit.collectionNumber}</p>
          <h1 id="share-card-title">{exhibit.share?.title ?? exhibit.title}</h1>
          <p className="share-card__summary">
            {exhibit.share?.description ?? exhibit.summary}
          </p>
        </div>
        <div className="share-card__footer">
          <span aria-hidden="true" />
          <p className="share-card__site-title">{siteConfig.siteTitle}</p>
        </div>
      </section>
    </main>
  )
}
