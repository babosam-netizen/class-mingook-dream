import RoomBar from '../components/shared/RoomBar'
import MyJourneyTimeline from '../components/phase4/MyJourneyTimeline'
import { PHASE_META } from '../styles/tokens'

export default function JourneyViewPage() {
  const meta = PHASE_META[4]
  return (
    <div className={`min-h-screen ${meta.pageBg}`}>
      <RoomBar />
      <main className="max-w-6xl mx-auto p-4 lg:p-6">
        <MyJourneyTimeline />
      </main>
    </div>
  )
}
