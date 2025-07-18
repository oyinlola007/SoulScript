import React from "react";
import { Flex, Box, Image, useBreakpointValue } from "@chakra-ui/react";
import { LinkButton } from "@/components/ui/link-button";
import AnonymousChatWindow from "./AnonymousChatWindow";

const LOGO_SRC = "/assets/images/fastapi-logo.svg";

const AnonymousChatInterface: React.FC = () => {
  const isMobile = useBreakpointValue({ base: true, md: false });

  return (
    <Flex direction="column" h="100vh" bg="gray.50">
      <Flex
        justify="space-between"
        align="center"
        bg="bg.muted"
        w="100%"
        top={0}
        p={4}
        position="sticky"
        zIndex={10}
      >
        <Image src={LOGO_SRC} alt="Logo" maxW="3xs" p={2} />
        <LinkButton href="/signup" colorScheme="blue" variant="solid" size={isMobile ? "md" : "lg"}>
          Sign Up
        </LinkButton>
      </Flex>
      <Box flex="1" minH={0}>
        <AnonymousChatWindow />
      </Box>
    </Flex>
  );
};

export default AnonymousChatInterface; 