import type { ReactNode } from "react"
import type { ExhibitLayoutId } from "../content/types"

export function ExhibitLayout({
  captureOnly = false,
  layout,
  viewer,
  information,
  toolbar,
}: {
  captureOnly?: boolean
  layout: ExhibitLayoutId
  viewer: ReactNode
  information: ReactNode
  toolbar: ReactNode
}) {
  if (captureOnly) {
    return (
      <div className="exhibit-layout exhibit-layout--capture" data-cover-capture data-layout={layout}>
        <div className="exhibit-layout__viewer">{viewer}</div>
      </div>
    )
  }

  return (
    <div className="exhibit-layout" data-layout={layout}>
      <div className="exhibit-layout__viewer">{viewer}</div>
      <div className="exhibit-layout__information">{information}</div>
      <div className="exhibit-layout__toolbar">{toolbar}</div>
    </div>
  )
}
