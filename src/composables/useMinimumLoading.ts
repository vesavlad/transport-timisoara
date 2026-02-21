import type { Ref } from 'vue'
import { onScopeDispose, ref, watch } from 'vue'

export function useMinimumLoading(isLoading: Ref<boolean>, minimumMs = 300) {
  const showLoading = ref(false)

  let startedAt = 0
  let hideTimer: ReturnType<typeof setTimeout> | null = null

  function clearHideTimer() {
    if (!hideTimer)
      return
    clearTimeout(hideTimer)
    hideTimer = null
  }

  watch(
    isLoading,
    (loading) => {
      if (loading) {
        clearHideTimer()
        startedAt = Date.now()
        showLoading.value = true
        return
      }

      if (!showLoading.value)
        return

      const elapsed = Date.now() - startedAt
      const remaining = Math.max(minimumMs - elapsed, 0)

      if (remaining <= 0) {
        showLoading.value = false
        return
      }

      clearHideTimer()
      hideTimer = setTimeout(() => {
        showLoading.value = false
        hideTimer = null
      }, remaining)
    },
    { immediate: true },
  )

  onScopeDispose(() => {
    clearHideTimer()
  })

  return showLoading
}
