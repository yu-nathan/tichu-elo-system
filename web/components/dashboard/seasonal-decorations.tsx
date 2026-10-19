import { useId, type CSSProperties } from "react";
import { useDecodedImage } from "@/hooks/use-decoded-image";
import artCrops from "@/lib/seasonal-art-crops.json";
import type { SeasonalTheme } from "@/lib/seasonal-theme";

// Follow the transparent gutters rather than assuming perfectly equal cells.
// SVG clipping isolates the existing artwork without modifying the source PNGs.
export const SeasonalArt = ({
  theme,
  variant,
}: {
  theme: Exclude<SeasonalTheme, "default">;
  variant: 0 | 1 | 2 | 3;
}) => {
  const clipId = useId();
  // Lead with Spring's butterfly and July's fireworks, swapping their intro art.
  const artworkVariant =
    (theme === "spring" || theme === "july-fourth") && variant < 2
      ? variant === 0
        ? 1
        : 0
      : variant;
  const crop = artCrops[theme][artworkVariant];
  const standaloneSource =
    theme === "thanksgiving" && artworkVariant === 0
      ? "/seasonal/thanksgiving-turkey.png"
      : theme === "july-fourth" && artworkVariant === 1
        ? "/seasonal/july-fourth-fireworks.png"
        : null;
  const source = standaloneSource ?? `/seasonal/${theme}-atlas.png`;
  const ready = useDecodedImage(source);
  return (
    <svg
      key={source}
      aria-hidden="true"
      focusable="false"
      data-art-variant={artworkVariant}
      data-art-ready={ready}
      style={{ opacity: ready ? 1 : 0 }}
      className="seasonal-art"
      viewBox={standaloneSource ? "0 0 1024 1024" : crop.viewBox}
    >
      <defs>
        <clipPath id={clipId} clipPathUnits="userSpaceOnUse">
          <polygon points={crop.points} />
        </clipPath>
      </defs>
      <image
        href={source}
        width={standaloneSource ? 1024 : 1254}
        height={standaloneSource ? 1024 : 1254}
        clipPath={standaloneSource ? undefined : `url(#${clipId})`}
      />
    </svg>
  );
};

const SPRING_LEAVES = [
  {
    outline: "M20 3C7 10 3 21 10 29Q16 35 20 32Q24 35 30 29C37 21 33 10 20 3Z",
    veins: "M20 7v31m0-13-8-7m8 1 8-7m-8 19-7-5m7-1 7-5",
  },
  {
    outline:
      "m20 2 4 9 4-4 1 8 8-1-5 8 4 2-11 8-5-2-5 2L4 24l4-2-5-8 8 1 1-8 4 4Z",
    veins: "M20 7v31m0-13L9 19m11 6 11-6m-11 2-5-8m5 8 5-8",
  },
  {
    outline: "M27 2C8 8 4 22 12 32 24 30 32 18 27 2Z",
    veins: "M26 6Q21 23 8 38m11-14-6-8m10 1 5-4m-14 17-4-6m9 1 7-3",
  },
  {
    outline:
      "m20 3 4 6-1 3 6 1-1 5 6 3-3 4 2 4-9 5-4-2-4 2-9-5 2-4-3-4 6-3-1-5 6-1-1-3Z",
    veins: "M20 7v31m0-11-9-4m9 4 9-4m-9-5-6-3m6 3 6-3",
  },
];

const Particle = ({
  theme,
  index,
}: {
  theme: SeasonalTheme;
  index: number;
}) => (
  <svg viewBox="0 0 40 40" aria-hidden="true" focusable="false">
    {theme === "halloween" ? (
      <path
        d="M20 18 16 12l-1 6Q7 8 1 10q3 5 1 12 6-4 10 4 5-3 8 4 3-7 8-4 4-8 10-4-2-7 1-12-6-2-14 8l-1-6Z"
        fill="currentColor"
      />
    ) : theme === "thanksgiving" ? (
      <g fill="currentColor" stroke="var(--decoration-ink)" strokeWidth="1">
        <path d="m20 2 5 9 8-4-2 11 7 2-11 9-5-2-2 11-2-11-5 2L2 20l7-2L7 7l8 4Z" />
        <path d="M20 10v20m0-9 7-5m-7 9-8-7" fill="none" opacity=".4" />
      </g>
    ) : theme === "new-year" ? (
      <path
        d="m20 3 4 11 12 1-9 8 3 12-10-6-10 6 3-12-9-8 12-1Z"
        fill="currentColor"
      />
    ) : theme === "july-fourth" ? (
      index % 2 === 0 ? (
        <path
          d="m20 3 4 11 12 1-9 8 3 12-10-6-10 6 3-12-9-8 12-1Z"
          fill="currentColor"
        />
      ) : (
        <g stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <path d="M20 3v9m0 16v9M3 20h9m16 0h9M8 8l7 7m10 10 7 7M8 32l7-7m10-10 7-7" />
          <circle cx="20" cy="20" r="2" fill="currentColor" stroke="none" />
        </g>
      )
    ) : theme === "summer" ? (
      index % 2 === 0 ? (
        <g stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <circle cx="20" cy="20" r="8" fill="currentColor" stroke="none" />
          <path d="M20 2v5m0 26v5M2 20h5m26 0h5M7 7l4 4m18 18 4 4M7 33l4-4m18-18 4-4" />
        </g>
      ) : (
        <g
          stroke="var(--decoration-ink)"
          strokeWidth="1.1"
          strokeLinecap="round"
        >
          <path
            d="M15 34 3 17Q0 10 7 9q0-7 7-5 6-7 12 0 7-2 7 5 7 1 4 8L25 34Z"
            fill="currentColor"
          />
          <path
            d="m20 33-6-26m6 26 6-26m-6 26L7 13m13 20 13-20M14 35h12"
            fill="none"
          />
        </g>
      )
    ) : theme === "valentines" ? (
      <path
        d="M20 34 6 20C-4 8 12-1 20 11 28-1 44 8 34 20Z"
        fill="currentColor"
      />
    ) : theme === "spring" ? (
      <g
        stroke="var(--decoration-ink)"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path
          d={SPRING_LEAVES[index % SPRING_LEAVES.length].outline}
          fill="currentColor"
          strokeWidth=".8"
        />
        <path
          d={SPRING_LEAVES[index % SPRING_LEAVES.length].veins}
          fill="none"
          strokeWidth="1.2"
        />
      </g>
    ) : theme === "easter" ? (
      <g fill="currentColor">
        <ellipse cx="20" cy="10" rx="6" ry="9" />
        <ellipse cx="20" cy="10" rx="6" ry="9" transform="rotate(72 20 20)" />
        <ellipse cx="20" cy="10" rx="6" ry="9" transform="rotate(144 20 20)" />
        <ellipse cx="20" cy="10" rx="6" ry="9" transform="rotate(216 20 20)" />
        <ellipse cx="20" cy="10" rx="6" ry="9" transform="rotate(288 20 20)" />
        <circle cx="20" cy="20" r="5" fill="var(--decoration-light)" />
      </g>
    ) : (
      <g stroke="currentColor" strokeWidth="2" strokeLinecap="round">
        <path d="M20 4v32M6 12l28 16M6 28l28-16m-18-5 4 5 4-5m-8 26 4-5 4 5M7 17l6-1-1-6m16 20-1-6 6-1M7 23l6 1-1 6m16-20-1 6 6 1" />
      </g>
    )}
  </svg>
);

const HalloweenWeb = () => {
  const source = "/seasonal/halloween-spider.png";
  const ready = useDecodedImage(source);
  return (
    <svg
      viewBox="0 0 160 160"
      className="seasonal-web"
      aria-hidden="true"
      focusable="false"
    >
      <g
        fill="none"
        stroke="var(--decoration-cream)"
        strokeWidth="1"
        opacity=".4"
      >
        <path d="M0 0v155M0 0l60 145M0 0l110 110M0 0l145 60M0 0h155M0 30q6-8 12-1 1-10 9-8 0-8 8-9-7-6 1-12M0 65q11-15 25-5 0-17 21-14-3-21 14-21-10-14 5-25M0 105q20-23 40-8 1-26 34-23-3-33 23-34-15-20 8-40M0 150q26-29 57-11 3-36 49-33-3-46 33-49-18-31 11-57" />
      </g>
      <g
        className="seasonal-spider"
        data-art-ready={ready}
        style={{ opacity: ready ? 1 : 0 }}
      >
        <image href={source} x="-20" y="-20" width="40" height="40" />
      </g>
    </svg>
  );
};

export const SeasonalDecorations = ({
  theme,
  paused,
  showIntro = true,
}: {
  theme: SeasonalTheme;
  paused: boolean;
  showIntro?: boolean;
}) => {
  if (theme === "default") return null;
  return (
    <div
      className={`seasonal-scene seasonal-scene--${theme}`}
      data-paused={paused}
      aria-hidden="true"
    >
      <div className="seasonal-halo" />
      {Array.from({ length: theme === "christmas" ? 18 : 10 }, (_, index) => (
        <div
          key={index}
          className="seasonal-particle"
          style={
            {
              "--particle-x": `${(index * 37 + 7) % 100}%`,
              "--particle-y": `${(index * 23 + 5) % 100}%`,
              "--particle-size": `calc(var(--spacing) * ${theme === "christmas" ? 2 + (index % 3) : 5 + (index % 3) * 2})`,
              "--particle-duration": `${20 + (index % 5) * 5}s`,
              "--particle-delay": `${-index * 4.3}s`,
              "--particle-sway": `${index % 2 ? 5 : -5}vw`,
            } as CSSProperties
          }
        >
          <Particle theme={theme} index={index} />
        </div>
      ))}
      {showIntro ? (
        <div className="seasonal-corner seasonal-corner--intro">
          <SeasonalArt theme={theme} variant={0} />
        </div>
      ) : null}
      <div className="seasonal-corner seasonal-corner--left">
        <SeasonalArt theme={theme} variant={2} />
      </div>
      <div className="seasonal-corner seasonal-corner--right">
        <SeasonalArt theme={theme} variant={1} />
      </div>
      <div className="seasonal-corner seasonal-corner--accent">
        <SeasonalArt theme={theme} variant={3} />
      </div>
      {theme === "christmas" ? (
        <div className="seasonal-lights">
          {Array.from({ length: 16 }, (_, index) => (
            <i key={index} style={{ animationDelay: `${-index * 0.7}s` }} />
          ))}
        </div>
      ) : null}
      {theme === "halloween" ? <HalloweenWeb /> : null}
    </div>
  );
};
