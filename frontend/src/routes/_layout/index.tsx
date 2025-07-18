import { Box, Container, Text } from "@chakra-ui/react"
import { createFileRoute } from "@tanstack/react-router"

import useAuth from "@/hooks/useAuth"
import AnonymousChatInterface from "@/components/Chat/AnonymousChatInterface"

export const Route = createFileRoute("/_layout/")({
  component: DashboardOrLanding,
})

function DashboardOrLanding() {
  const { user: currentUser } = useAuth()

  if (!currentUser) {
    return <AnonymousChatInterface />
  }

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
