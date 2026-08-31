import { createBrowserRouter, RouterProvider } from "react-router-dom"
import { appRoutes } from "./routes"
import "../styles/tokens.css"
import "../styles/global.css"

const router = createBrowserRouter(appRoutes)

export function App() {
  return <RouterProvider router={router} />
}
