import React, { useState } from 'react';

const PodcastBanner = () => {
  const [activePlayer, setActivePlayer] = useState('spotify');

  const spotifyEmbed =
    'https://open.spotify.com/embed/episode/3lKLVznESL0H0nU7Dq3uPl?utm_source=generator&theme=0';

  const appleEmbed =
    'https://embed.podcasts.apple.com/us/podcast/presah/id1669721867?itscg=30200&itsct=podcast_box_player&ls=1&theme=auto';

  return (
    <section className="mt-10">
      <div className="rounded-3xl bg-white/80 backdrop-blur border border-slate-200/70 shadow-lg px-6 py-5 md:px-8 md:py-6">
        {/* Nadpisy – tmavý text */}
        <div className="mb-4">
          <p className="text-xs font-semibold tracking-[0.18em] text-slate-500 uppercase">
            Podcast PRESAH
          </p>
          <h3 className="mt-1 text-lg md:text-xl font-semibold text-slate-900">
            Počúvaj priamo v aplikácii
          </h3>
          <p className="mt-1 text-sm text-slate-700">
            Vyber si platformu, ktorú používaš najradšej. Epizódu si vieš
            pustiť priamo v tejto appke, bez preklikávania.
          </p>
        </div>

        {/* Prepínanie prehrávača */}
        <div className="mb-4 flex gap-3 border-b border-slate-200 pb-2">
          <button
            type="button"
            onClick={() => setActivePlayer('spotify')}
            className={`text-sm font-medium transition-colors ${
              activePlayer === 'spotify'
                ? 'text-[#B81547] border-b-2 border-[#B81547] pb-1'
                : 'text-slate-500 hover:text-slate-700 pb-1'
            }`}
          >
            Spotify
          </button>
          <button
            type="button"
            onClick={() => setActivePlayer('apple')}
            className={`text-sm font-medium transition-colors ${
              activePlayer === 'apple'
                ? 'text-[#B81547] border-b-2 border-[#B81547] pb-1'
                : 'text-slate-500 hover:text-slate-700 pb-1'
            }`}
          >
            Apple Podcasts
          </button>
        </div>

        {/* Player */}
        <div className="w-full overflow-hidden rounded-2xl border border-slate-200 bg-white">
          {activePlayer === 'spotify' ? (
            <iframe
              src={spotifyEmbed}
              width="100%"
              height="232"
              allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
              loading="lazy"
              title="Podcast PRESAH – Spotify"
            />
          ) : (
            <iframe
              height="450"
              width="100%"
              title="Podcast PRESAH – Apple Podcasts"
              src={appleEmbed}
              style={{
                border: 0,
                borderRadius: '16px',
                width: '100%',
                height: '450px',
                maxWidth: '660px',
              }}
              sandbox="allow-forms allow-popups allow-same-origin allow-scripts allow-top-navigation-by-user-activation"
              allow="autoplay *; encrypted-media *; clipboard-write"
            />
          )}
        </div>
      </div>
    </section>
  );
};

export default PodcastBanner;
