interface ImageIndicatorsProps {
  totalImages: number;
  currentIndex: number;
  onIndexChange: (index: number) => void;
}

export function ImageIndicators({
  totalImages,
  currentIndex,
  onIndexChange,
}: ImageIndicatorsProps) {
  return (
    <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex gap-2">
      {Array.from({ length: totalImages }, (_, index) => (
        <button
          key={index}
          onClick={() => onIndexChange(index)}
          className={`w-2 h-2 rounded-full transition-all duration-200 hover:scale-125 transform-gpu ${
            index === currentIndex
              ? "bg-gallery-text scale-125"
              : "bg-gallery-text/40 hover:bg-gallery-text/60"
          }`}
          style={{ willChange: "transform" }}
        />
      ))}
    </div>
  );
}
