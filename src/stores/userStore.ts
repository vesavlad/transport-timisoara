import { acceptHMRUpdate, defineStore } from 'pinia'

type NearMeTab = 'routes' | 'stops'

export const useUserStore = defineStore('user', () => {
  /**
   * Current name of the user.
   */
  const savedName = ref('')
  const previousNames = ref(new Set<string>())

  const usedNames = computed(() => Array.from(previousNames.value))
  const otherNames = computed(() => usedNames.value.filter(name => name !== savedName.value))
  const nearMeTab = useLocalStorage<NearMeTab>('ttm:user:nearMeTab', 'routes')

  /**
   * Changes the current name of the user and saves the one that was used
   * before.
   *
   * @param name - new name to set
   */
  function setNewName(name: string) {
    if (savedName.value)
      previousNames.value.add(savedName.value)

    savedName.value = name
  }

  function setNearMeTab(tab: NearMeTab) {
    nearMeTab.value = tab
  }

  return {
    setNewName,
    setNearMeTab,
    otherNames,
    nearMeTab,
    savedName,
  }
})

if (import.meta.hot)
  import.meta.hot.accept(acceptHMRUpdate(useUserStore as any, import.meta.hot))
