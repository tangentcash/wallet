import { Avatar } from "@radix-ui/themes";
import { AssetId } from "tangentsdk/algorithm";
import { UiUtil } from "tangentsdk/ui";
import { Whitelist } from "tangentsdk/whitelist";
import { CSSProperties } from "react";

export function AssetImage(props: { asset?: AssetId, size?: string, iconSize?: string, style?: CSSProperties }) {
  const size = (props.size || '3') as any;
  const style = props.style ? (props.iconSize ? { ...props.style, width: props.iconSize, height: props.iconSize } : props.style) : (props.iconSize ? { width: props.iconSize, height: props.iconSize } : undefined);
  if (!props.asset) {
    return (
      <Avatar size={size} radius="full" className="asset-avatar" fallback="N/A" style={style} />
    )
  }

  const fake = Whitelist.fake(props.asset);
  return (
    <Avatar size={size} radius="full" className="asset-avatar" fallback={UiUtil.toAssetFallback(props.asset)} src={fake ? undefined : UiUtil.toAssetImage(props.asset)} style={style} />
  )
}