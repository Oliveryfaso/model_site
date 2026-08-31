import { Link } from "react-router-dom"

export function EmptyCollectionPage() {
  return (
    <section className="page-panel empty-collection" aria-labelledby="empty-collection-title">
      <p className="eyebrow">收藏柜</p>
      <h1 id="empty-collection-title">馆藏正在整理中</h1>
      <p>第一件藏品很快会安放在这里。现在不妨先看看这个收藏站的来历。</p>
      <Link className="text-link" to="/">
        返回馆藏
      </Link>
    </section>
  )
}
