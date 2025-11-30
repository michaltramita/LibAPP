import React from 'react';
import { motion } from 'framer-motion';

const PodcastBanner = () => {
  // URL na profil podcastu (ak chce niekto otvoriť celý zoznam epizód)
  const podcastUrl = 'https://creators.spotify.com/pod/profile/presahpodcast';

  // URL na konkrétnu embed epizódu (z tvojho iframe)
  const embedUrl =
    'https://creators.spotify.com/pod/profile/presahpodcast/embed/episodes/Bez-ud--ktor-ij-firemn-hodnoty--sa-kultra-ned-ovplyvni-ani-vytvori---Tatiana-Ondrejkov-Pelikan-sk-leadership-e3atod6';

  const handleClick = () => {
    window.open(podcastUrl, '_blank', 'noopener,noreferrer');
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.4 }}
      className="mt-8"
    >
      {/* Klikateľný banner – otvorí profil podcastu v novej karte */}
      <div
        onClick={handleClick}
        role="link"
        tabIndex={0}
        aria-label="Vypočujte si podcast PRESAH na Spotify"
        onKeyPress={(e) => {
          if (e.key === 'Enter') handleClick();
        }}
        className="cursor-pointer group"
      >
        <div className="relative overflow-hidden rounded-2xl shadow-lg transition-transform duration-300 ease-in-out group-hover:scale-[1.02]">
          <img
            src="https://horizons-cdn.hostinger.com/c7c4800e-7b32-471c-852f-a05cb57f1e91/5269b142eed60f52e29b31b4ea597239.png"
            alt="Banner podcastu PRESAH: Vypočujte si náš podcast PRESAH, kde s hosťami rozprávame o leadershipu, manažmente, obchode a AI."
            className="w-full h-auto object-cover"
          />
          <div className="absolute inset-0 bg-black bg-opacity-10 group-hover:bg-opacity-0 transition-colors duration-300" />
        </div>
      </div>

      {/* Vložený Spotify prehrávač priamo v aplikácii */}
      <div className="mt-4 w-full max-w-xl">
        <iframe
          src={embedUrl}
          width="100%"
          height="102"
          frameBorder="0"
          scrolling="no"
          allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
          loading="lazy"
          title="Prehrávač podcastu PRESAH – vybraná epizóda"
        ></iframe>
      </div>
    </motion.div>
  );
};

export default PodcastBanner;
