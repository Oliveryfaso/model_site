import type { RouteObject } from "react-router-dom"
import { ExhibitPage } from "../exhibit/ExhibitPage"
import { CollectionPage } from "../home/CollectionPage"
import { AboutPage } from "../pages/AboutPage"
import { NotFoundPage } from "../pages/NotFoundPage"
import { AppShell } from "./AppShell"

const developmentShareCardRoutes: RouteObject[] = import.meta.env.DEV
  ? [
      {
        path: "/__share-card/:slug/",
        lazy: async () => {
          const { ShareCardPage } = await import("../sharing/ShareCardPage")
          return { Component: ShareCardPage }
        },
      },
    ]
  : []

export function createAppRoutes(isDev: boolean): RouteObject[] {
  return [
    ...(isDev ? developmentShareCardRoutes : []),
    {
      element: <AppShell />,
      children: [
        { path: "/", element: <CollectionPage /> },
        { path: "/about/", element: <AboutPage /> },
        { path: "/exhibits/:slug/", element: <ExhibitPage /> },
        { path: "*", element: <NotFoundPage /> },
      ],
    },
  ]
}

export const appRoutes = createAppRoutes(import.meta.env.DEV)
