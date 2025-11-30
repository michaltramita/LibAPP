import React from 'react';
import { motion } from 'framer-motion';

const PodcastBanner = () => {
  // Spotify embed konkrétnej epizódy
  const spotifyEmbedUrl =
    'https://creators.spotify.com/pod/profile/presahpodcast/embed/episodes/Bez-ud--ktor-ij-firemn-hodnoty--sa-kultra-ned-ovplyvni-ani-vytvori---Tatiana-Ondrejkov-Pelikan-sk-leadership-e3atod6';

  // Apple Podcasts embed – z tvojho kódu
  const appleEmbedUrl =
    'https://embed.podcasts.apple.com/us/podcast/presah/id1669721867?itscg=30200&itsct=podcast_box_player&ls=1&mttnsubad=1669721867&theme=auto';

  return (
    <motion.section
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.4 }}
      className="mt-8 w-full max-w-5xl mx-auto"
    >
      <div className="rounded-2xl bg-white border border-slate-200 shadow-sm p-6 space-y-6">
        <header className="space-y-1">
          <p className="text-xs font-semibold uppercase tracking-wide text-[#B81547]">
            Podcast PRESAH
          </p>
          <h2 className="text-xl font-bold text-slate-900">
            Počúvaj priamo v aplikácii
          </h2>
          <p className="text-sm text-slate-600">
            Vyber si platformu, ktorú používaš najradšej. Epizódu si vieš pustiť
            priamo v tejto appke, bez preklikávania.
          </p>
        </header>

        {/* Prehrávače – pod sebou, na mobile aj desktope prehľadné */}
        <div className="space-y-6">
          {/* Spotify */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2">
              Spotify
            </p>
            <iframe
              src={spotifyEmbedUrl}
              width="100%"
              height="102"
              frameBorder="0"
              scrolling="no"
              allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
              loading="lazy"
              title="Prehrávač podcastu PRESAH – Spotify"
            ></iframe>
          </div>

          {/* Apple Podcasts */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2">
              Apple Podcasts
            </p>
            <div className="w-full flex justify-center">
              <iframe
                src={appleEmbedUrl}
                title="Prehrávač podcastu PRESAH – Apple Podcasts"
                id="embedPlayer"
                style={{
                  border: 0,
                  borderRadius: '12px',
                  width: '100%',
                  height: '450px',
                  maxWidth: '660px',
                }}
                sandbox="allow-forms allow-popups allow-same-origin allow-scripts allow-top-navigation-by-user-activation"
                allow="autoplay *; encrypted-media *; clipboard-write"
                loading="lazy"
              ></iframe>
            </div>
          </div>
        </div>
      </div>
    </motion.section>
  );
};

export default PodcastBanner;
