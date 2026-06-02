import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage'
import { useAuthStore } from '../stores/auth'
import { storage } from '../firebase'

const BASE_URL = import.meta.env.VITE_API_BASE_URL

export async function apiFetch<T = unknown>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const auth = useAuthStore()
  const token = await auth.getIdToken()

  const headers = new Headers(options.headers)
  headers.set('Accept', 'application/json')

  const isFormData = options.body instanceof FormData
  if (!headers.has('Content-Type') && options.body && !isFormData) {
    headers.set('Content-Type', 'application/json')
  }
  if (token) headers.set('Authorization', `Bearer ${token}`)

  const res = await fetch(`${BASE_URL}${path}`, { ...options, headers })

  if (!res.ok) {
    const body = await res.text()
    let message = `Request failed (${res.status})`
    try {
      const parsed = JSON.parse(body)
      message = parsed.message || parsed.error || message
    } catch { /* keep default */ }
    throw new Error(message)
  }
  return res.json() as Promise<T>
}

/**
 * Upload a file directly to Firebase Storage and return its public download URL.
 * Permissions are enforced by Storage rules (see storage.rules at the repo root).
 */
export async function uploadImage(file: File, folder = 'catalogue'): Promise<string> {
  const ext = (file.name.split('.').pop() || 'jpg').toLowerCase()
  const name = `${crypto.randomUUID()}.${ext}`
  const ref = storageRef(storage, `${folder}/${name}`)
  await uploadBytes(ref, file, { contentType: file.type })
  return await getDownloadURL(ref)
}
