import { auth } from "@clerk/nextjs/server"
import { NextResponse } from "next/server"
import { writeFile, mkdir } from "fs/promises"
import { join } from "path"

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
    
    await writeFile(filePath, buffer)

    const fileUrl = `/uploads/${filename}`
    return NextResponse.json({
      fileUrl,
      fileType: file.type,
      fileName: file.name,
    })
  } catch (error) {
    console.error("Upload error:", error)
    return NextResponse.json(
      { error: "Failed to upload file." },
      { status: 500 }
    )
  }
}
