export interface GeneratedImage {
  id: string;
  originalBlur: string; // The initially generated blurred image data URL
  finalImage: string;   // The data URL of the image with text overlay
  text: string;
  highlightedWord: string;
  fontSize: number;
  cropPositionX: number;
  title: string;
}
