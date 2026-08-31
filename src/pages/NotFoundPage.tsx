import { Link } from "react-router-dom"

export function NotFoundPage() {
  return (
    <section className="page-panel not-found" aria-labelledby="not-found-title">
      <p className="eyebrow">检索结果</p>
      <h1 id="not-found-title">没有找到这件藏品</h1>
      <p>这件作品可能尚未归档，或它原来的位置已经换到了另一格。</p>
      <Link className="text-link" to="/">
        回到馆藏
      </Link>
    </section>
  )
}
