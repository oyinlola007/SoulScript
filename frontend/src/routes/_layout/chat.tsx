import { createFileRoute } from "@tanstack/react-router"
import { useState } from "react"
import { Box, Flex, IconButton, useBreakpointValue } from "@chakra-ui/react"
import { FaChevronLeft, FaChevronRight } from "react-icons/fa"
import ChatInterface from "@/components/Chat/ChatInterface"

export const Route = createFileRoute("/_layout/chat")({
  component: ChatPage,
})

function ChatPage() {
  const [showSessions, setShowSessions] = useState(false)
  const isMobile = useBreakpointValue({ base: true, md: false })

  return (
    <Box h="100vh" position="relative" overflow="hidden">
      {/* Mobile Chat Sessions Toggle - Only visible on mobile, positioned at the top right */}
      {isMobile && !showSessions && (
        <IconButton
          aria-label="Open chat sessions"
          onClick={() => setShowSessions(true)}
          position="fixed"
          top={4}
          right={4}
          zIndex={1000}
          variant="ghost"
          color="inherit"
          size="md"
          bg="rgba(255, 255, 255, 0.9)"
          boxShadow="lg"
          borderRadius="full"
          _hover={{ bg: "rgba(255, 255, 255, 1)" }}
        >
          <FaChevronLeft />
        </IconButton>
      )}

      {/* Chat Interface with mobile sessions panel */}
      <Box 
        pt={isMobile ? "60px" : "0"} // Reduced top padding for mobile to reduce spacing
        h={isMobile ? "calc(100vh - 40px)" : "100%"}
        pb={0} // Remove bottom padding
        overflow="hidden"
      >
        <ChatInterface 
          showSessions={showSessions}
          setShowSessions={setShowSessions}
          isMobile={isMobile}
        />
      </Box>
    </Box>
  )
}

export default ChatPage 