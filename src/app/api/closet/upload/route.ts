import { NextRequest, NextResponse } from "next/server";
import { put } from "@vercel/blob";
import { getRepository } from "@/lib/db/repository";
import type { ClosetItemAttributes } from "@/lib/types/closet";

const repository = getRepository();

const IMAGE_ANALYSIS_MODEL_URL =
  process.env.IMAGE_ANALYSIS_MODEL_URL || "http://localhost:8001";
const CLIP_MODEL_URL =
  process.env.CLIP_MODEL_URL || "http://localhost:8002";

/**
 * POST /api/closet/upload
 * 이미지 업로드 및 아이템 등록
 *
 * 흐름:
 * 1. Vercel Blob에 이미지 업로드
 * 2. ML 분석 서버 호출 (fallback: 기본 attributes)
 * 3. PostgreSQL에 아이템 저장
 * 4. CLIP 벡터 인코딩 (non-blocking, best-effort)
 */
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("image") as File;

    if (!file) {
      return NextResponse.json(
        { error: "이미지 파일이 필요합니다." },
        { status: 400 }
      );
    }

    // 1. Vercel Blob에 이미지 업로드
    const imageUrl = await uploadImageToBlob(file);

    // 2. ML 분석 서버 호출 (fallback 포함)
    const attributes = await analyzeImage(file);

    // 이름 생성
    const name =
      attributes.sub_type && attributes.color
        ? `${attributes.color} ${attributes.sub_type}`
        : attributes.sub_type || attributes.category;

    // 태그 추출
    const tags: string[] = [];
    if (attributes.material) tags.push(...attributes.material.map((m) => m.value));
    if (attributes.print) tags.push(...attributes.print.map((p) => p.value));
    if (attributes.detail) tags.push(...attributes.detail.map((d) => d.value));

    // 3. PostgreSQL에 아이템 저장
    const newItem = await repository.create({
      imageUrl,
      attributes,
      name,
      tags: tags.length > 0 ? tags : undefined,
    });

    // 4. CLIP 벡터 인코딩 (non-blocking, best-effort)
    encodeAndStoreVector(newItem.id, file).catch((err) => {
      console.warn("CLIP 벡터 인코딩 실패 (무시됨):", err);
    });

    return NextResponse.json(
      {
        item: newItem,
        message: "옷장 아이템이 등록되었습니다.",
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Closet upload error:", error);
    return NextResponse.json(
      { error: "옷장 아이템 업로드에 실패했습니다." },
      { status: 500 }
    );
  }
}

/**
 * Vercel Blob에 이미지 업로드
 */
async function uploadImageToBlob(file: File): Promise<string> {
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    // Blob 토큰 없으면 placeholder URL 반환
    console.warn("BLOB_READ_WRITE_TOKEN이 없습니다. placeholder URL을 사용합니다.");
    return `https://picsum.photos/seed/${Date.now()}/400/500`;
  }

  const blob = await put(`closet/${Date.now()}-${file.name}`, file, {
    access: "public",
  });
  return blob.url;
}

/**
 * ML 분석 서버 호출 (fallback: 기본 attributes)
 */
async function analyzeImage(file: File): Promise<ClosetItemAttributes> {
  try {
    const formData = new FormData();
    formData.append("image", file);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    const response = await fetch(`${IMAGE_ANALYSIS_MODEL_URL}/analyze`, {
      method: "POST",
      body: formData,
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!response.ok) {
      throw new Error(`분석 서버 응답 오류: ${response.status}`);
    }

    return response.json();
  } catch (error) {
    console.warn("ML 분석 서버 호출 실패, fallback 사용:", error);
    return {
      category: "top",
      detection_confidence: 0.5,
      sub_type: "기타",
      color: "기타",
    };
  }
}

/**
 * CLIP 벡터 인코딩 후 DB에 저장 (non-blocking)
 */
async function encodeAndStoreVector(
  itemId: string,
  file: File
): Promise<void> {
  const formData = new FormData();
  formData.append("image", file);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);

  const response = await fetch(`${CLIP_MODEL_URL}/encode-image`, {
    method: "POST",
    body: formData,
    signal: controller.signal,
  });

  clearTimeout(timeout);

  if (!response.ok) {
    throw new Error(`CLIP 인코딩 오류: ${response.status}`);
  }

  const data = await response.json();
  await repository.updateVector(itemId, data.vector);
}
