import { Share2 } from "lucide-react";
import { GlassButton } from "@/components/ui/glass-button";
import { toast } from "sonner";

interface ImageInfoProps {
  title: string;
  description: string;
}

export function ImageInfo({ title, description }: ImageInfoProps) {
  const handleShare = async () => {
    try {
      if (navigator.share) {
        await navigator.share({
          title,
          text: description,
          url: window.location.href,
        });
      } else {
        await navigator.clipboard.writeText(window.location.href);
        toast.success("Link copied to clipboard!");
      }
    } catch (error) {
      console.error("Error sharing:", error);
      toast.error("Failed to share image");
    }
  };

  return (
    <div className="mt-8 text-center space-y-4">
      <div className="space-y-2">
        <h2 className="text-2xl md:text-3xl font-bold text-gallery-text">
          {title}
        </h2>
        <p className="text-gallery-muted text-lg max-w-2xl mx-auto">
          {description}
        </p>
      </div>

      <div className="flex items-center justify-center gap-4 pt-4">
        <GlassButton
          onClick={handleShare}
          className="hover:scale-105 transition-transform duration-200"
        >
          <Share2 size={18} className="mr-2" />
          Share
        </GlassButton>
      </div>
    </div>
  );
}
