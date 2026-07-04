import { auth } from "@clerk/nextjs/server"
import { NextResponse } from "next/server"
import { writeFile, mkdir } from "fs/promises"
import { join } from "path"

export async function POST(request: Request) {
  console.log("=== API UPLOAD REQUEST RECEIVED ===")
  const session = await auth()
  console.log("Session userId:", session.userId)

  if (!session.userId) {
    console.log("API UPLOAD: Unauthorized (no session.userId)")
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 })
  }

  try {
    console.log("Parsing form data...")
    const data = await request.formData()
    console.log("Form data keys:", Array.from(data.keys()))
    const file: File | null = data.get("file") as unknown as File

    if (!file) {
      console.log("API UPLOAD: No file uploaded in form data")
      return NextResponse.json({ error: "No file uploaded." }, { status: 400 })
    }

    console.log("File name:", file.name, "File size:", file.size, "File type:", file.type)

    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)

    // Save the file to public/uploads
    const uploadDir = join(process.cwd(), "public", "uploads")
    await mkdir(uploadDir, { recursive: true })

    // Generate unique name to avoid collision
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`
    const safeName = file.name.replace(/[^a-zA-Z0-9.\-_]/g, "_")
    const filename = `${uniqueSuffix}-${safeName}`
    const filePath = join(uploadDir, filename)
    
    console.log("Writing file to:", filePath)
    await writeFile(filePath, buffer)
    console.log("File written successfully!")

    const fileUrl = `/uploads/${filename}`
    return NextResponse.json({
      fileUrl,
      fileType: file.type,
      fileName: file.name,
    })
  } catch (error: any) {
    console.error("API UPLOAD ERROR:", error)
    return NextResponse.json(
      { error: "Failed to upload file.", details: error?.message || String(error) },
      { status: 500 }
    )
  }
}
