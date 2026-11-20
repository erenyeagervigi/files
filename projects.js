/* Edit this file to replace demo footage with your own work.
   Direct files: videoSrc (MP4/WebM). YouTube/Vimeo: embedUrl.
   Google Drive: drivePreview must be a /file/d/FILE_ID/preview URL, never a /view link.
   Cards are always the same 16:9 frame so the grid lines up. Portrait / square clips are
   shown whole inside it (not cropped); 16:9 clips fill it.
   Aspect ratio: add aspect: "16/9", "1/1", "9/16" or "4/5" to a project to match its video shape.
   If you leave it out, direct MP4/WebM videos are measured automatically once they load
   (set it for YouTube/Vimeo/Drive embeds, which cannot be measured).
   Each project can also define captions: { src, srclang, label } for an optional .vtt track. */

window.PORTFOLIO_CONFIG = {
  email: "for.signuporlogin@gmail.com",
  socials: [
    { label: "YouTube", url: "https://www.youtube.com/@Xer3_n", icon: "youtube" },
  ],
  showreel: {
    id: "showreel",
    title: "The Showreel",
    description: "showreel",
    poster: "https://images.unsplash.com/photo-1478720568477-152d9b164e26?auto=format&fit=crop&w=2000&q=85",
    videoSrc: "https://res.cloudinary.com/aizznmz3/video/upload/v1794244624/iphone.mp4",
    duration: "00:10",
    sample: true
  }
};

window.PORTFOLIO_PROJECTS = [
  {
    id: "trend-style",
    title: "Trend Style Content",
    description: "Short-form edits built around trends, engaging pacing and social-first storytelling.",
    category: "Trend Shorts & Reels",
    duration: "00:10",
    poster: "https://images.unsplash.com/photo-1492619375914-88005aa9e8fb?auto=format&fit=crop&w=1100&q=85",
    videoSrc: "https://res.cloudinary.com/aizznmz3/video/upload/v1793804033/whos_that_girl_2.mp4",
    sample: true
  },
  {
    id: "cinematic-content",
    title: "Cinematic Content",
    description: "Atmosphere, emotion and visual storytelling shaped by music, color and timed cuts.",
    category: "Cinematic",
    duration: "00:10",
    poster: "https://images.unsplash.com/photo-1478720568477-152d9b164e26?auto=format&fit=crop&w=1100&q=85",
    videoSrc: "https://res.cloudinary.com/aizznmz3/video/upload/v1793801859/switzerland.mp4",
    sample: true
  },
  {
    id: "event-social",
    title: "Event & Social",
    description: "A house-warming recap built around atmosphere, real moments and music sync.",
    category: "Event & Social",
    duration: "00:10",
    poster: "https://images.unsplash.com/photo-1511795409834-ef04bbd61622?auto=format&fit=crop&w=1100&q=85",
    videoSrc: "https://res.cloudinary.com/aizznmz3/video/upload/v1794330722/cinematic.mp4",
    sample: true
  },
  {
    id: "motion-graphics",
    title: "Motion Graphics",
    description: "Typography, animation, VFX and transitions for clean, intentional design.",
    category: "Motion Graphics",
    duration: "00:10",
    poster: "https://images.unsplash.com/photo-1550745165-9bc0b252726f?auto=format&fit=crop&w=1100&q=85",
    videoSrc: "https://res.cloudinary.com/aizznmz3/video/upload/v1795184095/motion_graphics_cc.mp4",
    sample: true
  },
  {
    id: "meta-ads",
    title: "Meta Ads / Commercials",
    description: "Product-focused ads with strong hooks, fast pacing and concise storytelling.",
    category: "Meta Ads / Commercials",
    duration: "00:30",
    poster: "https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=1100&q=85",
    videoSrc: "https://res.cloudinary.com/aizznmz3/video/upload/v1795184050/edit_3_revised.mp4",
    sample: true
  }
];
