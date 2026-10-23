import { palette } from "@/core/palette";

const note = { fill: palette.ink, fontWeight: 500, fontSize: 22 } as const;

export function Notes() {
  return (
    <g transform="translate(1866 0)" textAnchor="end">
      <text x={0} y={52} {...note}>{"ARTIFACT Journal"}</text>
      <text x={0} y={78} {...note}>{"Shanghai / November 2026"}</text>
    </g>
  );
}
