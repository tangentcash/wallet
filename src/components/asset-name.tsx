import { mdiCheckDecagram } from "@mdi/js";
import { Flex, Text, Tooltip } from "@radix-ui/themes";
import { AssetId } from "tangentsdk/algorithm";
import { UiUtil } from "tangentsdk/ui";
import { Assetlist } from "tangentsdk/assetlist";
import { Whitelist } from "tangentsdk/whitelist";
import { CSSProperties } from "react";
import Icon from "@mdi/react";

export function AssetName(props: { asset?: AssetId, text?: string, size?: string, badgeSize?: number, badgeOffset?: number, symbol?: boolean, badge?: boolean, tokenOnly?: boolean, style?: CSSProperties }) {
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
    <Tooltip content={ Assetlist.toName(props.asset, true) + ' blockchain' }>
      <Flex align="center" gap="1" style={props.style}>
        {
          fake &&
          <Text as="div" size={size} weight="light">
            { (!props.tokenOnly && props.asset.token ? props.asset.chain + ' ' : '') + UiUtil.toAssetSymbol(props.asset) }
            { props.asset.checksum ? ` (${ props.asset.checksum.substring(0, 4) })` : '' }{ props.text ? ' ' + props.text : '' }
          </Text>
        }
        {
          !fake &&
          <Text as="div" size={size} weight="light">
            { props.symbol ? UiUtil.toAssetSymbol(props.asset) + (!props.tokenOnly && props.asset.token ? ` (${ props.asset.chain })` : '') : Assetlist.toName(props.asset, false, props.tokenOnly) }{ props.text ? ' ' + props.text : '' }
            { contractAddress && (props.badge !== false) && <Icon path={mdiCheckDecagram} color="var(--sky-9)" size={props.badgeSize || 0.7} style={{ transform: `translateY(${props.badgeOffset || 2}px)`, paddingLeft: '2px' }}></Icon> }
          </Text>
        }
      </Flex>
    </Tooltip>
  )
}