import { Flex } from "@chakra-ui/react"
import { Outlet, createFileRoute, redirect } from "@tanstack/react-router"

import Navbar from "@/components/Common/Navbar"
import Sidebar from "@/components/Common/Sidebar"
import { isLoggedIn } from "@/hooks/useAuth"

export const Route = createFileRoute("/_layout")({
  component: Layout,
  beforeLoad: async ({ location }) => {
    // Allow unauthenticated access to the root / route only
    if (!isLoggedIn() && location.pathname !== "/") {
      throw redirect({
        to: "/",
      })
    }
  },
})

function Layout() {
  const authenticated = isLoggedIn();
  if (!authenticated) {
    // Anonymous: render only the outlet (AnonymousChatInterface at /)
    return <Outlet />;
  }
  // Authenticated: render full app layout
  return (
    <Flex direction="column" h="100vh">
      <Navbar />
      <Flex flex="1" overflow="hidden">
        <Sidebar />
        <Flex flex="1" direction="column" p={4} overflowY="auto">
          <Outlet />
        </Flex>
      </Flex>
    </Flex>
  )
}

export default Layout
