import React from 'react';

const PodcastPlayer = () => {
  return (
    <div className="w-full max-w-xl mx-auto rounded-2xl bg-white shadow-sm border border-slate-200 p-4">
      <h2 className="text-lg font-semibold text-slate-900 mb-2">
        Najnovšia epizóda podcastu PRESAH
      </h2>
      <p className="text-sm text-slate-600 mb-4">
        Vypočujte si priamo v aplikácii, bez preklikávania na Spotify.
      </p>

      <div className="w-full">
        <iframe
          src="https://creators.spotify.com/pod/profile/presahpodcast/embed/episodes/Bez-ud--ktor-ij-firemn-hodnoty--sa-kultra-ned-ovplyvni-ani-vytvori---Tatiana-Ondrejkov-Pelikan-sk-leadership-e3atod6"
          width="100%"
          height="102"
          frameBorder="0"
          scrolling="no"
          allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
          loading="lazy"
        ></iframe>
      </div>
    </div>
  );
};

export default PodcastPlayer;
