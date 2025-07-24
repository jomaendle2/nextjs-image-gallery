import { useState, useEffect } from "react";
import { extractDominantColorDebounced } from "@/utils/colorExtractor";

export function useImageColor(
  imageRef: React.RefObject<HTMLImageElement | null>,
  imageId: string,
  currentIndex: number,
) {
  const [dominantColor, setDominantColor] = useState("hsl(220, 20%, 15%)");

  const updateDominantColor = async () => {
    if (imageRef.current && imageRef.current.complete) {
      try {
        const color = await extractDominantColorDebounced(
          imageRef.current,
          imageId,
        );
        setDominantColor(color);
      } catch (error) {
        console.error("Error extracting color:", error);
      }
    }
  };

  useEffect(() => {
    updateDominantColor();
  }, [currentIndex, imageId, updateDominantColor]);

  return { dominantColor, updateDominantColor };
}
