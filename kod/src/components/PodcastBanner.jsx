import React from 'react';
import GlassPanel from '@/components/GlassPanel';

const PodcastBanner = () => {
  const spotifyProfileUrl =
    'https://creators.spotify.com/pod/profile/presahpodcast';
  const appleUrl =
    'https://podcasts.apple.com/sk/podcast/presah/id1669721867?l=sk';

  return (
    <GlassPanel className="w-full p-5 md:p-6 flex flex-col gap-4 items-start">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-white/70">
          Podcast Presah
        </p>
        <h3 className="mt-1 text-lg font-semibold text-white">
          Počúvaj priamo v aplikácii
        </h3>
        <p className="mt-1 text-sm text-white/80 max-w-xl">
          Vyber si platformu, ktorú používaš najradšej. Epizódu si vieš
          pustiť priamo v tejto appke, bez preklikávania.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <a
          href={spotifyProfileUrl}
          target="_blank"
          rel="noreferrer"
          className="px-3 py-1.5 rounded-full bg-white/15 hover:bg-white/25 text-xs font-medium text-white border border-white/25"
        >
          Spotify
        </a>
        <a
          href={appleUrl}
          target="_blank"
          rel="noreferrer"
          className="px-3 py-1.5 rounded-full bg-white/10 hover:bg-white/20 text-xs font-medium text-white border border-white/20"
        >
          Apple Podcasts
        </a>
      </div>

      <div className="w-full">
        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-white/70 mb-2">
          Počúvaj na Spotify
        </p>
        <div className="w-full overflow-hidden rounded-2xl border border-white/15 bg-black/20">
          <iframe
            src="https://creators.spotify.com/pod/profile/presahpodcast/embed/episodes/Bez-ud--ktor-ij-firemn-hodnoty--sa-kultra-ned-ovplyvni-ani-vytvori---Tatiana-Ondrejkov-Pelikan-sk-leadership-e3atod6"
            height="152"
            width="100%"
            frameBorder="0"
            scrolling="no"
            title="PRESAH podcast"
            className="w-full h-[152px] md:h-[180px]"
          />
        </div>
      </div>
    </GlassPanel>
  );
};

export default PodcastBanner;
