import type { SVGProps } from "react";
import {
  centralIcons,
  centralIconsMetadata,
  type CentralIconFill,
  type CentralIconImportName,
  type CentralIconJoin,
  type CentralIconName,
  type CentralIconRadius,
  type CentralIconStroke,
} from "./icon-data";

type CentralIconBaseProps = {
  size?: string | number;
  ariaHidden?: boolean;
} & SVGProps<SVGSVGElement>;

type Props = Omit<CentralIconBaseProps, "fill" | "radius" | "stroke"> & {
  name: CentralIconName;
  join?: CentralIconJoin;
  fill?: CentralIconFill;
  radius?: CentralIconRadius;
  stroke?: CentralIconStroke;
};

export function CentralIcon({
  name,
  join = "square",
  fill = "outlined",
  radius = "0",
  stroke = "1.5",
  size = 24,
  ariaHidden = true,
  color,
  children,
  style,
  ...props
}: Props) {
  const iconKey =
    `${join}-${fill}-radius-${radius}-stroke-${stroke}/${name}` as CentralIconImportName;
  const iconHtml = centralIcons[iconKey];
  const iconTitle = centralIconsMetadata[name].title;

  return (
    <svg
      {...props}
      aria-hidden={ariaHidden}
      role={ariaHidden ? undefined : "img"}
      width={typeof size === "number" ? `${size}px` : size}
      height={typeof size === "number" ? `${size}px` : size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      style={{ color, ...style }}
    >
      {iconTitle && !ariaHidden ? <title>{iconTitle}</title> : null}
      {children}
      <g dangerouslySetInnerHTML={{ __html: iconHtml }} />
    </svg>
  );
}
