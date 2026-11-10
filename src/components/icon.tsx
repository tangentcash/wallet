import { type ComponentProps } from 'react';
import MdiIcon from '@mdi/react';

type IconProps = ComponentProps<typeof MdiIcon>;

export default function Icon({ style, ...rest }: IconProps) {
  return <MdiIcon {...rest} style={style != null ? { ...style } : undefined}></MdiIcon>;
}
