import { useMemo } from 'react';
import { buildBezierPath, mapPoints } from '../utils/pathBuilder.js';

const VIEW_W = 1400;
const VIEW_H = 1350;
const PADDING = { top: 200, right: 56, bottom: 120, left: 80 };

const COLORS = {
  bg: '#f9f9f9',
  title: '#066b4f',
  subtitle: '#095e47',
  number: '#017d5b',
  grid: '#cfe6dd',
  currentLine: '#066b4f',
  axisLabel: '#095e47',
  endpointFill: '#f9f9f9',
};

const NUMBER_FONT = "'Bebas Neue', 'STV', sans-serif";
const TEXT_FONT = "'STV', 'Cairo', 'Tajawal', sans-serif";

export default function RankChart({ data, frame, svgRef }) {
  const matchweeks = data.matchweeks;
  const teams = data.teams;
  const maxRank = teams.length;

  const chartRect = {
    x: PADDING.left,
    y: PADDING.top,
    width: VIEW_W - PADDING.left - PADDING.right,
    height: VIEW_H - PADDING.top - PADDING.bottom,
    maxRank,
  };

  const currentMW = matchweeks[frame] ?? matchweeks[0];
  const visibleCount = frame + 1;

  const teamGeoms = useMemo(() => {
    return teams.map((team) => {
      const fullPts = mapPoints(matchweeks, team.rankHistory, chartRect);
      const visiblePts = fullPts.slice(0, visibleCount);
      const d = buildBezierPath(visiblePts);
      const last = visiblePts[visiblePts.length - 1] ?? fullPts[0];
      return { team, fullPts, visiblePts, d, last };
    });
    // chartRect is recomputed each render from constants — safe to omit
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teams, matchweeks, visibleCount]);

  const sortedByRank = useMemo(() => {
    return [...teamGeoms].sort(
      (a, b) =>
        a.team.rankHistory[frame] - b.team.rankHistory[frame]
    );
  }, [teamGeoms, frame]);

  const stepX = chartRect.width / Math.max(1, matchweeks.length - 1);
  const stepY = chartRect.height / Math.max(1, maxRank - 1);

  return (
    <svg
      ref={svgRef}
      viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
      preserveAspectRatio="xMidYMid meet"
      className="w-full h-full"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        {teams.map((t, i) => (
          <clipPath id={`logo-clip-${i}`} key={`clip-${i}`}>
            <circle cx="0" cy="0" r="22" />
          </clipPath>
        ))}
      </defs>

      <rect x="0" y="0" width={VIEW_W} height={VIEW_H} fill={COLORS.bg} />

      <text
        x={VIEW_W / 2}
        y={90}
        textAnchor="middle"
        fill={COLORS.title}
        fontSize="56"
        fontWeight="700"
        direction="rtl"
        fontFamily={TEXT_FONT}
      >
        الدوري السوري الممتاز
      </text>
      <text
        x={VIEW_W / 2}
        y={140}
        textAnchor="middle"
        fill={COLORS.subtitle}
        fontSize="28"
        direction="rtl"
        fontFamily={TEXT_FONT}
      >
        {`الجولة `}
        <tspan fontFamily={NUMBER_FONT} fill={COLORS.number} fontSize="32">
          {currentMW}
        </tspan>
      </text>

      {Array.from({ length: maxRank }, (_, i) => {
        const y = chartRect.y + i * stepY;
        return (
          <g key={`row-${i}`}>
            <line
              x1={chartRect.x}
              x2={chartRect.x + chartRect.width}
              y1={y}
              y2={y}
              stroke={COLORS.grid}
              strokeWidth="1"
            />
            <text
              x={chartRect.x - 18}
              y={y + 8}
              textAnchor="end"
              fill={COLORS.number}
              fontSize="26"
              fontFamily={NUMBER_FONT}
            >
              {i + 1}
            </text>
          </g>
        );
      })}

      {matchweeks.map((mw, i) => {
        const x = chartRect.x + i * stepX;
        const isCurrent = i === frame;
        return (
          <g key={`mw-${mw}`}>
            <line
              x1={x}
              x2={x}
              y1={chartRect.y}
              y2={chartRect.y + chartRect.height}
              stroke={isCurrent ? COLORS.currentLine : COLORS.grid}
              strokeDasharray={isCurrent ? '0' : '4 6'}
              strokeWidth={isCurrent ? 2 : 1}
              opacity={isCurrent ? 0.7 : 1}
            />
            <text
              x={x}
              y={chartRect.y + chartRect.height + 40}
              textAnchor="middle"
              fill={isCurrent ? COLORS.title : COLORS.axisLabel}
              fontSize="24"
              fontWeight={isCurrent ? 700 : 400}
              fontFamily={NUMBER_FONT}
            >
              {mw}
            </text>
          </g>
        );
      })}

      {teamGeoms.map(({ team, d }, i) => (
        <path
          key={`path-${i}`}
          d={d}
          fill="none"
          stroke={team.color}
          strokeWidth="4"
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity="0.95"
        />
      ))}

      {sortedByRank.map(({ team, last }, idx) => {
        if (!last) return null;
        const logoX = last.x;
        const logoY = last.y;
        return (
          <g key={`endpoint-${team.abbr}`} transform={`translate(${logoX}, ${logoY})`}>
            <circle r="24" fill={COLORS.endpointFill} stroke={team.color} strokeWidth="3" />
            <g clipPath={`url(#logo-clip-${teams.indexOf(team)})`}>
              {team.logo ? (
                <image
                  href={team.logo}
                  x="-22"
                  y="-22"
                  width="44"
                  height="44"
                  preserveAspectRatio="xMidYMid slice"
                />
              ) : (
                <text
                  textAnchor="middle"
                  y="6"
                  fill={COLORS.title}
                  fontSize="14"
                  fontWeight="700"
                  fontFamily={TEXT_FONT}
                >
                  {team.abbr}
                </text>
              )}
            </g>
          </g>
        );
      })}

    </svg>
  );
}
