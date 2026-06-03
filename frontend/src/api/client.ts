import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage'
import { useAuthStore } from '../stores/auth'
import { useToast } from '../composables/useToast'
import { storage } from '../firebase'

const BASE_URL = import.meta.env.VITE_API_BASE_URL

export interface ApiFetchOpts extends RequestInit {
  // Set to true if the caller will handle the error itself (no auto-toast).
  silent?: boolean
}

export async function apiFetch<T = unknown>(
  path: string,
  options: ApiFetchOpts = {},
): Promise<T> {
  const { silent, ...fetchOptions } = options
  const auth = useAuthStore()
  const toast = useToast()
  const token = await auth.getIdToken()

  const headers = new Headers(fetchOptions.headers)
  headers.set('Accept', 'application/json')

  const isFormData = fetchOptions.body instanceof FormData
  if (!headers.has('Content-Type') && fetchOptions.body && !isFormData) {
    headers.set('Content-Type', 'application/json')
  }
  if (token) headers.set('Authorization', `Bearer ${token}`)

  let res: Response
  try {
    res = await fetch(`${BASE_URL}${path}`, { ...fetchOptions, headers })
  } catch (e: any) {
    const message = 'Network error — please check your connection.'
    if (!silent) toast.error(message)
    throw new Error(message)
  }

  if (!res.ok) {
    const body = await res.text()
    let message = `Request failed (${res.status})`
    try {
      const parsed = JSON.parse(body)
      message = parsed.message || parsed.error || message
    } catch { /* keep default */ }

    if (!silent) {
      if (res.status === 429) {
        toast.error('Too many requests. Please slow down and try again.')
      } else if (res.status === 401) {
        toast.error('Your session expired. Please sign in again.')
      } else if (res.status === 403) {
        toast.error('You do not have permission to do that.')
      } else {
        toast.error(message)
      }
    }
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
