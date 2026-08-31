import { render, screen } from "@testing-library/react"
import { MemoryRouter, Route, Routes } from "react-router-dom"
import { describe, expect, it } from "vitest"
import { ShareCardPage } from "./ShareCardPage"

function renderCard(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/__share-card/:slug/" element={<ShareCardPage />} />
      </Routes>
    </MemoryRouter>,
  )
}

describe("ShareCardPage", () => {
  it("renders a fixed-size editorial card without a Canvas viewer", () => {
    const { container } = renderCard("/__share-card/green-core/")

    const card = container.querySelector("[data-share-card]")
    expect(card).toBeInTheDocument()
    expect(card).toHaveStyle({
      width: "1200px",
      height: "630px",
      padding: "0px",
      margin: "0px",
      maxWidth: "none",
      flex: "none",
    })
    expect(screen.getByText("藏品 001")).toBeInTheDocument()
    expect(screen.getByRole("heading", { name: "翠核标本" })).toBeInTheDocument()
    expect(
      screen.getByText("一枚被当作未知生命核心保存的绿色标本。"),
    ).toBeInTheDocument()
    expect(screen.getByText("电子手办收藏站")).toBeInTheDocument()
    expect(screen.getByRole("img", { name: "翠核标本馆藏封面" })).toHaveAttribute(
      "src",
      "/covers/avocado.jpg",
    )
    expect(container.querySelector("canvas")).not.toBeInTheDocument()
  })

  it("renders a readable capture failure for an unknown slug", () => {
    const { container } = renderCard("/__share-card/missing/")

    expect(container.querySelector("[data-share-card]")).toBeInTheDocument()
    expect(
      screen.getByRole("heading", { name: "无法生成分享卡片" }),
    ).toBeInTheDocument()
    expect(screen.getByText(/missing/)).toBeInTheDocument()
  })
})
