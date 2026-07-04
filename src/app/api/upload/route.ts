import { auth } from "@clerk/nextjs/server"
import { NextResponse } from "next/server"

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

    // Upload to catbox.moe for serverless (Vercel) compatibility
    const uploadData = new FormData()
    uploadData.append("reqtype", "fileupload")
    uploadData.append("fileToUpload", file)

    const response = await fetch("https://catbox.moe/user/api.php", {
      method: "POST",
      body: uploadData,
    })

    if (!response.ok) {
      throw new Error(`Catbox upload failed with status ${response.status}`)
    }

    const fileUrl = await response.text()
    
    if (!fileUrl.startsWith("http")) {
      throw new Error(`Catbox returned invalid URL: ${fileUrl}`)
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
