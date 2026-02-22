import type { UserModule } from '~/types'
import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query'

export const install: UserModule = ({ isClient, app }) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 10_000,
        gcTime: 5 * 60_000,
        retry: 1,
        refetchOnWindowFocus: false,
      },
    },
  })

  if (isClient)
    app.use(VueQueryPlugin, { queryClient })
}
