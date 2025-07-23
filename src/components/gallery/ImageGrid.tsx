import { useState } from "react";
import { ArrowLeft, Image as ImageIcon } from "lucide-react";
import { GlassButton } from "@/components/ui/glass-button";
import { galleryImages } from "@/data/galleryData";

interface ImageGridProps {
  onImageSelect: (index: number) => void;
  onViewModeChange: () => void;
}

export function ImageGrid({ onImageSelect, onViewModeChange }: ImageGridProps) {
  const [loadedImages, setLoadedImages] = useState<Set<string>>(new Set());

  const handleImageLoad = (imageId: string) => {
    setLoadedImages((prev) => new Set(prev).add(imageId));
  };

  const handleImageClick = (index: number) => {
    onImageSelect(index);
    onViewModeChange();
  };

  return (
    <div className="min-h-screen bg-gallery-bg">
      {/* Header */}
      <div
        className="sticky top-0 z-20 bg-gallery-bg/90 border-b border-glass-border"
        style={{ contain: "layout style paint" }}
      >
        <div className="container mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <GlassButton
              variant="icon"
              onClick={onViewModeChange}
              className="hover:scale-105 transition-transform duration-200"
            >
              <ArrowLeft size={20} />
            </GlassButton>
            <div className="flex items-center gap-3">
              <ImageIcon className="text-gallery-text" size={24} />
              <h1 className="text-xl font-bold text-gallery-text">
                Nature Gallery
              </h1>
            </div>
          </div>
          <div className="text-gallery-muted text-sm">
            {galleryImages.length} images
          </div>
        </div>
      </div>

      {/* Grid */}
      <div className="container mx-auto px-6 py-8">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {galleryImages.map((image, index) => (
            <div
              key={image.id}
              className="group cursor-pointer animate-fade-in"
              style={{
                animationDelay: `${index * 0.05}s`,
                contain: "layout style paint",
                willChange: "transform",
              }}
              onClick={() => handleImageClick(index)}
            >
              <div className="relative rounded-2xl overflow-hidden bg-glass-bg/50 border border-glass-border hover:border-gallery-text/30 transition-all duration-200 hover:scale-[1.02] hover:shadow-lg transform-gpu">
                {/* Image skeleton */}
                {!loadedImages.has(image.id) && (
                  <div className="absolute inset-0 bg-gradient-to-br from-gallery-text/10 to-gallery-text/5 animate-pulse" />
                )}

                {/* Image */}
                <div className="aspect-[4/3] overflow-hidden">
                  <img
                    src={image.src}
                    alt={image.title}
                    className={`w-full h-full object-cover transition-transform duration-300 group-hover:scale-105 transform-gpu ${
                      loadedImages.has(image.id) ? "opacity-100" : "opacity-0"
                    }`}
                    onLoad={() => handleImageLoad(image.id)}
                    loading="lazy"
                  />
                </div>

                {/* Overlay */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-200" />

                {/* Content */}
                <div className="absolute bottom-0 left-0 right-0 p-4 transform translate-y-1 group-hover:translate-y-0 transition-transform duration-200">
                  <h3 className="text-white font-semibold text-lg mb-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200 delay-50">
                    {image.title}
                  </h3>
                  <p className="text-white/80 text-sm opacity-0 group-hover:opacity-100 transition-opacity duration-200 delay-75">
                    {image.description}
                  </p>
                </div>

                {/* Image number */}
                <div className="absolute top-3 left-3 bg-black/40 rounded-full px-2 py-1 text-white text-xs font-medium">
                  {index + 1}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="text-center mt-12 text-gallery-muted">
          <p className="text-sm">Click any image to view in carousel mode</p>
        </div>
      </div>
    </div>
  );
}
