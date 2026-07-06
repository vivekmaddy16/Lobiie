import { auth } from "@clerk/nextjs/server"
import { NextResponse } from "next/server"

async function uploadToUguu(file: File): Promise<string> {
  const uploadData = new FormData()
  uploadData.append("files[]", file)

  const response = await fetch("https://uguu.se/upload", {
    method: "POST",
    body: uploadData,
  })

  if (!response.ok) {
    throw new Error(`Uguu upload failed with status ${response.status}`)
  }

  const json = await response.json()

  if (!json.success || !json.files?.[0]?.url) {
    throw new Error("Uguu returned invalid response")
  }

  return json.files[0].url
}

async function uploadToTmpfiles(file: File): Promise<string> {
  const uploadData = new FormData()
  uploadData.append("file", file)

  const response = await fetch("https://tmpfiles.org/api/v1/upload", {
    method: "POST",
    body: uploadData,
  })

  if (!response.ok) {
    throw new Error(`Tmpfiles upload failed with status ${response.status}`)
  }

  const json = await response.json()

  if (json.status !== "success" || !json.data?.url) {
    throw new Error("Tmpfiles returned invalid response")
  }

  // Convert to direct download URL
  return json.data.url.replace("tmpfiles.org/", "tmpfiles.org/dl/")
}

export async function POST(request: Request) {
  const session = await auth()

  if (!session.userId) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 })
  }

  try {
    const data = await request.formData()
    const file: File | null = data.get("file") as unknown as File

    if (!file) {
      return NextResponse.json({ error: "No file uploaded." }, { status: 400 })
    }

    // Try uguu.se first, fall back to tmpfiles.org
    let fileUrl: string
    try {
      fileUrl = await uploadToUguu(file)
    } catch {
      fileUrl = await uploadToTmpfiles(file)
    }

    return NextResponse.json({
      fileUrl,
      fileType: file.type,
      fileName: file.name,
    })
  } catch (error: any) {
    console.error("Upload error:", error)
    return NextResponse.json(
      { error: "Failed to upload file.", details: error?.message || String(error) },
      { status: 500 }
    )
  }
}

