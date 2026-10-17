import { palette } from "@/core/palette";

const note = { fill: palette.ink, fontWeight: 500, fontSize: 22 } as const;

/** Small annotations framing the editorial rectangle. `bottom` is the lower edge in world units. */
export function Notes({ bottom }: { bottom: number }) {
  return (
    <>
      <g transform="translate(1866 0)" textAnchor="end">
        <text x={0} y={52} {...note}>{"ARTIFACT Journal"}</text>
        <text x={0} y={78} {...note}>{"Shanghai / November 2026"}</text>
      </g>
      <g transform={`translate(1866 ${bottom - 540})`} textAnchor="end">
        <text x={0} y={485} {...note}>{"Migration, Fluidity, Resilience"}</text>
        <text x={0} y={511} {...note}>{"Issue 02 · Fall–Winter 2025"}</text>
      </g>
    </>
  );
}
