import { useMutation, useQueryClient } from "@tanstack/react-query"
import { type SubmitHandler, useForm } from "react-hook-form"

import type { ApiError } from "@/client/core/ApiError"
import useCustomToast from "@/hooks/useCustomToast"
import { handleError } from "@/utils"
import {
  Button,
  DialogActionTrigger,
  DialogTitle,
  Input,
  Text,
  VStack,
} from "@chakra-ui/react"
import { useState } from "react"
import { FaUpload } from "react-icons/fa"
import {
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogRoot,
  DialogTrigger,
} from "../ui/dialog"
import { Field } from "../ui/field"

interface PdfUploadForm {
  title: string
  description: string
  file: File | null
}

const AddPdfUpload = () => {
  const [isOpen, setIsOpen] = useState(false)
  const { showSuccessToast, showErrorToast } = useCustomToast()
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isValid, isSubmitting },
    setValue,
    watch,
  } = useForm<PdfUploadForm>({
    mode: "onBlur",
    criteriaMode: "all",
    defaultValues: {
      title: "",
      description: "",
      file: null,
    },
  })

  const selectedFile = watch("file")

  const queryClient = useQueryClient()

  const mutation = useMutation({
    mutationFn: async (data: PdfUploadForm) => {
      if (!data.file) {
        throw new Error("No file selected")
      }

      const formData = new FormData()
      formData.append("title", data.title)
      if (data.description) {
        formData.append("description", data.description)
      }
      formData.append("file", data.file)

      // Get the auth token
      const token = localStorage.getItem("access_token")
      if (!token) {
        throw new Error("No authentication token found")
      }

      // Make direct HTTP request for file upload
      const response = await fetch("http://api.localhost/api/v1/pdfs/", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.detail || "Upload failed")
      }

      return await response.json()
    },
    onSuccess: () => {
      showSuccessToast("PDF uploaded successfully.")
      reset()
      setIsOpen(false)
      // Invalidate PDFs query to refresh the list
      queryClient.invalidateQueries({ queryKey: ["pdfs"] })
    },
    onError: (err: ApiError) => {
      handleError(err)
    },
  })

  const onSubmit: SubmitHandler<PdfUploadForm> = (data) => {
    mutation.mutate(data)
  }

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] || null
    
    if (file) {
      // Check file size limit (10MB)
      const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB in bytes
      
      if (file.size > MAX_FILE_SIZE) {
        setValue("file", null)
        // Clear the file input
        event.target.value = ""
        // Show error toast
        showErrorToast(`File size (${(file.size / (1024*1024)).toFixed(2)} MB) exceeds the maximum allowed size of 10 MB.`)
        return
      }
    }
    
    setValue("file", file)
  }

  return (
    <DialogRoot
      size={{ base: "xs", md: "md" }}
      placement="center"
      open={isOpen}
      onOpenChange={({ open }) => setIsOpen(open)}
    >
      <DialogTrigger asChild>
        <Button value="add-pdf" my={4}>
          <FaUpload fontSize="16px" />
          Upload PDF
        </Button>
      </DialogTrigger>
      <DialogContent>
        <form onSubmit={handleSubmit(onSubmit)}>
          <DialogHeader>
            <DialogTitle>Upload PDF Document</DialogTitle>
          </DialogHeader>
          <DialogBody>
            <Text mb={4}>
              Upload a PDF document to be used by the spiritual chatbot. The document will be processed and made available for group users.
            </Text>
            <VStack gap={4}>
              <Field
                required
                invalid={!!errors.title}
                errorText={errors.title?.message}
                label="Document Title"
              >
                <Input
                  id="title"
                  {...register("title", {
                    required: "Document title is required",
                    minLength: {
                      value: 3,
                      message: "Title must be at least 3 characters",
                    },
                  })}
                  placeholder="e.g., Bible - New Testament"
                  type="text"
                />
              </Field>

              <Field
                invalid={!!errors.description}
                errorText={errors.description?.message}
                label="Description"
              >
                <Input
                  id="description"
                  {...register("description", {
                    minLength: {
                      value: 10,
                      message: "Description must be at least 10 characters",
                    },
                  })}
                  placeholder="Brief description of the document content"
                  type="text"
                />
              </Field>

              <Field
                required
                invalid={!!errors.file}
                errorText={errors.file?.message}
                label="PDF File"
              >
                <Input
                  id="file"
                  type="file"
                  accept=".pdf"
                  onChange={handleFileChange}
                />
                <Text fontSize="sm" color="gray.500" mt={1}>
                  Maximum file size: 10 MB
                </Text>
                {selectedFile && (
                  <Text fontSize="sm" color="gray.600" mt={1}>
                    Selected: {selectedFile.name} ({(selectedFile.size / 1024 / 1024).toFixed(2)} MB)
                  </Text>
                )}
              </Field>
            </VStack>
          </DialogBody>

          <DialogFooter gap={2}>
            <DialogActionTrigger asChild>
              <Button
                variant="subtle"
                colorPalette="gray"
                disabled={isSubmitting}
              >
                Cancel
              </Button>
            </DialogActionTrigger>
            <Button
              variant="solid"
              type="submit"
              disabled={!isValid}
              loading={isSubmitting}
            >
              Upload
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </DialogRoot>
  )
}

export default AddPdfUpload 