import React from 'react';
import { motion } from 'framer-motion';

const PodcastBanner = () => {
  // Updated podcast URL as per user request
  const podcastUrl = "https://creators.spotify.com/pod/profile/presahpodcast";

  const handleClick = () => {
    window.open(podcastUrl, '_blank', 'noopener,noreferrer');
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.4 }}
      onClick={handleClick}
      className="mt-8 cursor-pointer group"
      role="link"
      aria-label="Vypočujte si podcast PRESAH"
      tabIndex={0}
      onKeyPress={(e) => { if (e.key === 'Enter') handleClick(); }}
    >
      <div className="relative overflow-hidden rounded-2xl shadow-lg transition-transform duration-300 ease-in-out group-hover:scale-[1.02]">
        <img
          // Updated image source to reflect the latest design with three hosts
          src="https://horizons-cdn.hostinger.com/c7c4800e-7b32-471c-852f-a05cb57f1e91/5269b142eed60f52e29b31b4ea597239.png"
          // Updated alt text based on the new image content and podcast theme
          alt="Banner podcastu PRESAH: Vypočujte si náš podcast PRESAH, kde spoločne s našimi hosťami rozprávame o témach, ktorými v Libelliuse žijeme - leadership, manažment, obchod, predaj či AI. Obrázok zobrazuje troch hostiteľov a logo Libellius."
          className="w-full h-auto object-cover"
        />
        <div className="absolute inset-0 bg-black bg-opacity-10 group-hover:bg-opacity-0 transition-colors duration-300" />
      </div>
    </motion.div>
  );
};

export default PodcastBanner;