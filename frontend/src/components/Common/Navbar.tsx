import { Flex, Image, useBreakpointValue } from "@chakra-ui/react"
import { Link } from "@tanstack/react-router"

import Logo from "/assets/images/fastapi-logo.svg"
import UserMenu from "./UserMenu"
import useAuth from "@/hooks/useAuth"
import { LinkButton } from "@/components/ui/link-button"

function Navbar() {
  const display = useBreakpointValue({ base: "none", md: "flex" })
  const { user } = useAuth()

  return (
    <Flex
      display={display}
      justify="space-between"
      position="sticky"
      color="white"
      align="center"
      bg="bg.muted"
      w="100%"
      top={0}
      p={4}
    >
      <Link to="/">
        <Image src={Logo} alt="Logo" maxW="3xs" p={2} />
      </Link>
      <Flex gap={2} alignItems="center">
        {user ? (
          <UserMenu />
        ) : (
          <LinkButton href="/signup" colorScheme="blue" variant="solid" size="lg">
            Sign Up
          </LinkButton>
        )}
      </Flex>
    </Flex>
  )
}

export default Navbar
