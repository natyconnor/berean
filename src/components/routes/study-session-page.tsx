import { StudySessionView } from "@/components/study/study-session-view";
import { Route } from "@/routes/study/$sessionId";

export function StudySessionPage() {
  const { sessionId } = Route.useParams();
  return <StudySessionView sessionId={sessionId} />;
}
