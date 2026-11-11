import { QueryClientProvider } from '@tanstack/react-query'
import { BoardPage } from '../features/boards/BoardPage'
import { queryClient } from './queryClient'

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BoardPage />
    </QueryClientProvider>
  )
}
