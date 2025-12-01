import React, { useState } from 'react';
import { motion } from 'framer-motion';
import GlassPanel from '@/components/GlassPanel';
import { Button } from '@/components/ui/button';

const SPOTIFY_EMBED_URL =
  'https://creators.spotify.com/pod/profile/presahpodcast/embed/episodes/Bez-ud--ktor-ij-firemn-hodnoty--sa-kultra-ned-ovplyvni-ani-vytvori---Tatiana-Ondrejkov-Pelikan-sk-leadership-e3atod6';

const APPLE_EMBED_URL =
  'https://embed.podcasts.apple.com/us/podcast/presah/id1669721867?itscg=30200&itsct=podcast_box_player&ls=1&mttnsubad=1669721867&theme=auto';

const PodcastBanner = () => {
  const [activePlayer, setActivePlayer] = useState('spotify'); // 'spotify' | 'apple'

  return (
    <motion.section
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.35 }}
      className="mt-10"
    >
      <GlassPanel className="p-6 md:p-7 lg:p-8">
        <div className="flex flex-col gap-4">
          {/* Textová hlavička */}
          <div>
            <p className="text-[11px] tracking-[0.22em] uppercase text-slate-100/80 mb-1">
              Podcast PRESAH
            </p>
            <h3 className="text-lg md:text-xl font-semibold text-slate-50 mb-2">
              Počúvaj priamo v aplikácii
            </h3>
            <p className="text-sm text-slate-100/80 max-w-2xl">
              Vyber si platformu, ktorú používaš najradšej. Epizódu si vieš
              pustiť priamo v tejto appke, bez preklikávania.
            </p>
          </div>

          {/* Prepínač prehrávača */}
          <div className="flex flex-wrap items-center gap-2 mt-1">
            <Button
              type="button"
              onClick={() => setActivePlayer('spotify')}
              variant="outline"
              size="sm"
              className={
                activePlayer === 'spotify'
                  ? 'h-8 rounded-full bg-white text-[#B81457] border-white'
                  : 'h-8 rounded-full bg-white/10 text-slate-50 border-white/30 hover:bg-white/20'
              }
            >
              Spotify
            </Button>

            <Button
              type="button"
              onClick={() => setActivePlayer('apple')}
              variant="outline"
              size="sm"
              className={
                activePlayer === 'apple'
                  ? 'h-8 rounded-full bg-white text-[#B81457] border-white'
                  : 'h-8 rounded-full bg-white/10 text-slate-50 border-white/30 hover:bg-white/20'
              }
            >
              Apple Podcasts
            </Button>
          </div>

          {/* Iba jedno „okno“ – embed prehrávač */}
          <div className="mt-4 rounded-2xl overflow-hidden bg-black/5">
            {activePlayer === 'spotify' ? (
              <iframe
                title="PRESAH – Spotify prehrávač"
                src={SPOTIFY_EMBED_URL}
                width="100%"
                height="152"
                frameBorder="0"
                scrolling="no"
                allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
              />
            ) : (
              <iframe
                title="PRESAH – Apple Podcasts"
                src={APPLE_EMBED_URL}
                width="100%"
                height="430"
                style={{ border: 0 }}
                sandbox="allow-forms allow-popups allow-same-origin allow-scripts allow-top-navigation-by-user-activation"
                allow="autoplay *; encrypted-media *; clipboard-write"
              />
            )}
          </div>
        </div>
      </GlassPanel>
    </motion.section>
  );
};

export default PodcastBanner;
