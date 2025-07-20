import { Box, Container, Text } from "@chakra-ui/react"
import { createFileRoute } from "@tanstack/react-router"

import useAuth, { isLoggedIn } from "@/hooks/useAuth"
import AnonymousChatInterface from "@/components/Chat/AnonymousChatInterface"

export const Route = createFileRoute("/_layout/")({
  component: DashboardOrLanding,
})

function DashboardOrLanding() {
  const { user: currentUser } = useAuth()

  // Guard: if the user is logged in but the user data hasn't loaded yet, render nothing (or a loader)
  if (isLoggedIn() && typeof currentUser === "undefined") {
    return null
  }

  // Not logged in – show anonymous landing/chat
  if (!currentUser) {
    return <AnonymousChatInterface />
  }

  // Logged in and user data available – show dashboard greeting
  return (
    <>
      <Container maxW="full">
        <Box pt={12} m={4}>
          <Text fontSize="2xl" truncate maxW="sm">
            Hi, {currentUser?.full_name || currentUser?.email} 👋🏼
          </Text>
          <Text>Welcome back, nice to see you again!</Text>
        </Box>
      </Container>
    </>
  )
}
