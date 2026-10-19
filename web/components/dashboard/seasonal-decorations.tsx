import { useId, type CSSProperties } from "react";
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
  const crop = artCrops[theme][variant];
  const standaloneTurkey = theme === "thanksgiving" && variant === 0;
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      data-art-variant={variant}
      className="seasonal-art"
      viewBox={standaloneTurkey ? "0 0 1024 1024" : crop.viewBox}
    >
      <defs>
        <clipPath id={clipId} clipPathUnits="userSpaceOnUse">
          <polygon points={crop.points} />
        </clipPath>
      </defs>
      <image
        href={
          standaloneTurkey
            ? "/seasonal/thanksgiving-turkey.png"
            : `/seasonal/${theme}-atlas.png`
        }
        width={standaloneTurkey ? 1024 : 1254}
        height={standaloneTurkey ? 1024 : 1254}
        clipPath={standaloneTurkey ? undefined : `url(#${clipId})`}
      />
    </svg>
  );
};

const Particle = ({ theme }: { theme: SeasonalTheme }) => (
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
    ) : (
      <g stroke="currentColor" strokeWidth="2" strokeLinecap="round">
        <path d="M20 4v32M6 12l28 16M6 28l28-16m-18-5 4 5 4-5m-8 26 4-5 4 5M7 17l6-1-1-6m16 20-1-6 6-1M7 23l6 1-1 6m16-20-1 6 6 1" />
      </g>
    )}
  </svg>
);

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
          <Particle theme={theme} />
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
      {theme === "halloween" ? (
        <svg viewBox="0 0 160 160" className="seasonal-web">
          <g
            fill="none"
            stroke="var(--decoration-cream)"
            strokeWidth="1"
            opacity=".4"
          >
            <path d="M0 0v155M0 0l60 145M0 0l110 110M0 0l145 60M0 0h155M0 30q6-8 12-1 1-10 9-8 0-8 8-9-7-6 1-12M0 65q11-15 25-5 0-17 21-14-3-21 14-21-10-14 5-25M0 105q20-23 40-8 1-26 34-23-3-33 23-34-15-20 8-40M0 150q26-29 57-11 3-36 49-33-3-46 33-49-18-31 11-57" />
          </g>
        </svg>
      ) : null}
    </div>
  );
};
