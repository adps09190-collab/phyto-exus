import Demo from "@/components/demo"
import { ThresholdsProvider } from "@/lib/thresholds"

function App() {
  return (
    <ThresholdsProvider>
      <Demo />
    </ThresholdsProvider>
  )
}

export default App
