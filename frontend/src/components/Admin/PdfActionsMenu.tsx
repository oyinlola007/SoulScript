import React, { useState } from "react"
import { 
  IconButton, 
  Button,
  Input,
  Progress,
  VStack,
  Text,
} from "@chakra-ui/react"
import { BsThreeDotsVertical } from "react-icons/bs"
import { MenuContent, MenuRoot, MenuTrigger } from "../ui/menu"
import {
  DialogActionTrigger,
  DialogBody,
  DialogCloseTrigger,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogRoot,
  DialogTitle,
} from "@/components/ui/dialog"
import useCustomToast from "@/hooks/useCustomToast"

interface PdfDocument {
  id: string
  title: string
  description: string
  filename: string
  file_size: number
  page_count: number
  is_processed: boolean
  processing_status: string
  error_message: string | null
  owner_id: string
  created_at: string
  updated_at: string
}

interface PdfActionsMenuProps {
  pdf?: PdfDocument | null
  onDelete?: () => void
  disabled?: boolean
}

const PdfActionsMenu = ({ pdf, onDelete, disabled }: PdfActionsMenuProps) => {
  // Defensive check for pdf prop - ensure it's a valid object with required properties
  if (!pdf || typeof pdf !== 'object' || !pdf.id || typeof pdf.title !== 'string') {
    return null
  }

  const [isOpen, setIsOpen] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [deleteProgress, setDeleteProgress] = useState(0)
  const [confirmTitle, setConfirmTitle] = useState("")
  const [deleteStep, setDeleteStep] = useState("")
  const { showErrorToast, showSuccessToast } = useCustomToast()

  const handleViewPdf = async () => {
    const token = localStorage.getItem("access_token")
    if (!token) {
      showErrorToast("Please log in to view PDFs")
      return
    }
    
    try {
      const response = await fetch(`http://api.localhost/api/v1/pdfs/${pdf.id}/download`, {
        headers: {
          "Authorization": `Bearer ${token}`,
        },
      })
      
      if (!response.ok) {
        throw new Error(`Failed to fetch PDF: ${response.status}`)
      }
      
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      window.open(url, '_blank')
    } catch (error) {
      console.error('Error fetching PDF:', error)
      showErrorToast('Failed to open PDF')
    }
  }

  const handleDeleteClick = () => {
    setIsOpen(true)
  }

  const handleDeleteConfirm = async () => {
    if (confirmTitle !== pdf.title) {
      showErrorToast("Title doesn't match. Please enter the exact title to confirm deletion.")
      return
    }

    setIsDeleting(true)
    setDeleteProgress(0)
    setDeleteStep("Starting deletion...")

    try {
      const token = localStorage.getItem("access_token")
      if (!token) {
        throw new Error("No access token found")
      }

      setDeleteProgress(20)
      setDeleteStep("Deleting PDF file and database record...")

      const response = await fetch(`http://api.localhost/api/v1/pdfs/${pdf.id}`, {
        method: "DELETE",
        headers: {
          "Authorization": `Bearer ${token}`,
        },
      })

      if (!response.ok) {
        throw new Error(`Failed to delete PDF: ${response.status}`)
      }

      setDeleteProgress(100)
      setDeleteStep("Deletion completed successfully!")

      showSuccessToast("PDF deleted successfully")
      
      // Close dialog first, then call onDelete
      setIsOpen(false)
      
      // Call onDelete after a small delay to ensure dialog is closed
      setTimeout(() => {
        if (onDelete) {
          onDelete()
        }
      }, 100)
      
    } catch (error) {
      console.error('Error deleting PDF:', error)
      showErrorToast(`Failed to delete PDF: ${error instanceof Error ? error.message : 'Unknown error'}`)
    } finally {
      setIsDeleting(false)
      setDeleteProgress(0)
      setDeleteStep("")
      setConfirmTitle("")
    }
  }

  return (
    <>
      <MenuRoot>
        <MenuTrigger asChild>
          <IconButton variant="ghost" color="inherit" disabled={disabled}>
            <BsThreeDotsVertical />
          </IconButton>
        </MenuTrigger>
        <MenuContent>
          <Button
            variant="ghost"
            w="full"
            justifyContent="start"
            onClick={handleViewPdf}
          >
            View PDF
          </Button>
          <Button
            variant="ghost"
            w="full"
            justifyContent="start"
            colorScheme="red"
            onClick={handleDeleteClick}
          >
            Delete PDF
          </Button>
        </MenuContent>
      </MenuRoot>

      <DialogRoot
        size={{ base: "xs", md: "md" }}
        placement="center"
        role="alertdialog"
        open={isOpen}
        onOpenChange={({ open }) => setIsOpen(open)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete PDF</DialogTitle>
          </DialogHeader>
          <DialogBody>
            {isDeleting ? (
              <VStack spacing={4}>
                <Text>Deleting PDF: {pdf.title}</Text>
                <Progress value={deleteProgress} w="full" colorScheme="blue" />
                <Text fontSize="sm" color="gray.600">{deleteStep}</Text>
              </VStack>
            ) : (
              <VStack spacing={4} align="stretch">
                <Text>
                  Are you sure you want to delete <strong>{pdf.title}</strong>?
                </Text>
                <Text fontSize="sm" color="gray.600">
                  This action will:
                </Text>
                <Text fontSize="sm" color="gray.600" ml={4}>
                  • Remove the PDF from the database
                </Text>
                <Text fontSize="sm" color="gray.600" ml={4}>
                  • Delete the physical file
                </Text>
                <Text fontSize="sm" color="gray.600" ml={4}>
                  • Remove all embeddings from ChromaDB
                </Text>
                <Text fontSize="sm" color="red.500" fontWeight="bold">
                  This action cannot be undone.
                </Text>
                <Text fontSize="sm">
                  To confirm deletion, please enter the exact title: <strong>{pdf.title}</strong>
                </Text>
                <Input
                  placeholder="Enter PDF title to confirm"
                  value={confirmTitle}
                  onChange={(e) => setConfirmTitle(e.target.value)}
                  isDisabled={isDeleting}
                />
              </VStack>
            )}
          </DialogBody>

          <DialogFooter gap={2}>
            <DialogActionTrigger asChild>
              <Button
                variant="subtle"
                colorScheme="gray"
                disabled={isDeleting}
              >
                Cancel
              </Button>
            </DialogActionTrigger>
            <Button
              variant="solid"
              colorScheme="red"
              onClick={handleDeleteConfirm}
              loading={isDeleting}
              disabled={isDeleting || confirmTitle !== pdf.title}
            >
              {isDeleting ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
          <DialogCloseTrigger />
        </DialogContent>
      </DialogRoot>
    </>
  )
}

export default PdfActionsMenu

 