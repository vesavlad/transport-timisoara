import { onBeforeUnmount, onMounted, ref } from 'vue'

export function useMediaQuery(query: string) {
  const matches = ref(false)
  let media: MediaQueryList | null = null

  const update = () => {
    if (!media)
      return
    matches.value = media.matches
  }

  onMounted(() => {
    media = window.matchMedia(query)
    update()
    media.addEventListener('change', update)
  })

  onBeforeUnmount(() => {
    media?.removeEventListener('change', update)
    media = null
  })

  return matches
}
