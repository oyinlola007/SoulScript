import { Table, Text } from "@chakra-ui/react"

const PendingPdfs = () => {
  return (
    <Table.Root size={{ base: "sm", md: "md" }}>
      <Table.Header>
        <Table.Row>
          <Table.ColumnHeader w="sm">Title</Table.ColumnHeader>
          <Table.ColumnHeader w="sm">Description</Table.ColumnHeader>
          <Table.ColumnHeader w="sm">File Size</Table.ColumnHeader>
          <Table.ColumnHeader w="sm">Status</Table.ColumnHeader>
          <Table.ColumnHeader w="sm">Uploaded</Table.ColumnHeader>
          <Table.ColumnHeader w="sm">Actions</Table.ColumnHeader>
        </Table.Row>
      </Table.Header>
      <Table.Body>
        <Table.Row>
          <Table.Cell colSpan={6}>
            <Text textAlign="center" color="gray.500" py={4}>
              No PDFs uploaded yet
            </Text>
          </Table.Cell>
        </Table.Row>
      </Table.Body>
    </Table.Root>
  )
}

export default PendingPdfs 