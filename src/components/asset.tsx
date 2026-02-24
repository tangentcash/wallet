import { mdiCheckDecagram } from "@mdi/js";
import { Avatar, Flex, Text, Tooltip } from "@radix-ui/themes";
import { AssetId, Readability, Whitelist } from "tangentsdk";
import { CSSProperties } from "react";
import Icon from "@mdi/react";

export function AssetName(props: { asset?: AssetId, size?: string, badgeSize?: number, badgeOffset?: number, symbol?: boolean, style?: CSSProperties }) {
  const size = (props.size || '3') as any;
  if (!props.asset) {
    return (
      <Flex align="center" gap="1">
        <Text as="div" size={size} weight="light" style={{ color: 'var(--gray-11)' }}>N/A</Text>
      </Flex>
    )
  }

  const contractAddress = Whitelist.contractAddressOf(props.asset);
  const fake = Whitelist.fake(props.asset, contractAddress);
  return (
    <Tooltip content={ Readability.toAssetName(props.asset, true) + ' blockchain' }>
      <Flex align="center" gap="1" style={props.style}>
        {
          fake &&
          <>
            <Text as="div" size={size} weight="light">{ (props.asset.token ? props.asset.chain + ' ' : '') + Readability.toAssetSymbol(props.asset) }</Text>
            { props.asset.checksum && <Text as="div" size={size} weight="light" ml="1" style={{ color: "var(--gray-11)" }}>({ props.asset.checksum.substring(0, 4) })</Text> }
          </>
        }
        { !fake && <Text as="div" size={size} weight="light">{ props.symbol ? Readability.toAssetSymbol(props.asset) + (props.asset.token ? ` (${ props.asset.chain })` : '') : Readability.toAssetName(props.asset) }</Text> }
        { contractAddress && <Icon path={mdiCheckDecagram} color="var(--sky-9)" size={props.badgeSize || 0.7} style={{ transform: typeof props.badgeOffset == 'number' ? `translateY(${props.badgeOffset}px)` : 'translateY(-2px)' }}></Icon> }
      </Flex>
    </Tooltip>
  )
}

export function AssetImage(props: { asset?: AssetId, size?: string, iconSize?: string, style?: CSSProperties }) {
  const size = (props.size || '3') as any;
  const style = props.style ? (props.iconSize ? { ...props.style, width: props.iconSize, height: props.iconSize } : props.style) : (props.iconSize ? { width: props.iconSize, height: props.iconSize } : undefined);
  if (!props.asset) {
    return (
      <Avatar size={size} radius="full" fallback="N/A" style={style} />
    )
  }

  const fake = Whitelist.fake(props.asset);
  return (
    <Avatar size={size} radius="full" fallback={Readability.toAssetFallback(props.asset)} src={fake ? undefined : Readability.toAssetImage(props.asset)} style={style} />
  )
}