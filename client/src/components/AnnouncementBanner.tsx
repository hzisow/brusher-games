import { useQuery } from "@tanstack/react-query";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Megaphone } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface Announcement {
  id: string;
  title: string;
  message: string;
  createdAt: string;
}

export default function AnnouncementBanner() {
  const { data: announcements = [] } = useQuery<Announcement[]>({
    queryKey: ["announcements"],
    queryFn: async () => {
      const res = await fetch("/api/announcements");
      if (!res.ok) throw new Error("Failed to fetch announcements");
      return res.json();
    },
    refetchInterval: 30000,
  });

  if (announcements.length === 0) return null;

  const latestAnnouncement = announcements[0];

  return (
    <Alert className="border-primary/20 bg-primary/5 mb-6">
      <Megaphone className="h-5 w-5 text-primary" />
      <AlertTitle className="ml-2 font-bold text-primary flex items-center gap-2">
        {latestAnnouncement.title}
        <span className="text-xs font-normal text-muted-foreground">
          {formatDistanceToNow(new Date(latestAnnouncement.createdAt), { addSuffix: true })}
        </span>
      </AlertTitle>
      <AlertDescription className="ml-2 text-foreground mt-1">
        {latestAnnouncement.message}
      </AlertDescription>
    </Alert>
  );
}
