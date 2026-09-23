import { mdiClose } from "@mdi/js";
import { Box, Button, Flex, Select } from "@radix-ui/themes";
import { UiUtil } from "tangentsdk/ui";
import type { AssetId } from "tangentsdk/algorithm";
import { useMemo, useState } from "react";
import { AlertBox, AlertType } from "./alert";
import { AssetImage } from "./asset-image";
import Icon from "@mdi/react";
import QRCode from "react-qr-code";

function toAddressType(type: string): string {
  switch (type) {
    case 'routing':
      return 'Your routing address';
    case 'bridge':
      return 'Vault funding address';
    case 'witness':
      return 'Archive address';
    default:
      return 'Your Tangent address';
  }
}
function toAddressVariant(network: string | null, address: string): string {
  switch (network) {
    case 'SOL':
    case 'XLM':
    case 'XMR':
      return 'P2PK';
    case 'ADA':
    case 'ARB':
    case 'AVAX':
    case 'BASE':
    case 'BLAST':
    case 'BNB':
    case 'CELO':
    case 'ETC':
    case 'ETH':
    case 'GNO':
    case 'MATIC':
    case 'OP':
    case 'LINEA':
    case 'TRX':
    case 'ZK':
    case 'XRP':
    case 'BCH':
    case 'BSV':
    case 'DASH':
    case 'DOGE':
    case 'XEC':
      return 'P2PKH';
    case 'BTC': {
      if (address.indexOf('1q') != -1) {
        return 'P2WPKH';
      } if (address.indexOf('1p') != -1) {
        return 'P2TR';
      } else if (address.startsWith('1')) {
        return 'P2PKH';
      } else if (address.startsWith('3')) {
        return 'P2SH';
      } else {
        return 'P2PK';
      }
    }
    case 'BTG': {
      if (address.indexOf('1q') != -1) {
        return 'P2WPKH';
      } else if (address.startsWith('G')) {
        return 'P2PKH';
      } else if (address.startsWith('A')) {
        return 'P2SH';
      } else {
        return 'P2PK';
      }
    }
    case 'DGB': {
      if (address.indexOf('1q') != -1) {
        return 'P2WPKH';
      } if (address.indexOf('1p') != -1) {
        return 'P2TR';
      } else if (address.startsWith('D')) {
        return 'P2PKH';
      } else if (address.startsWith('S')) {
        return 'P2SH';
      } else {
        return 'P2PK';
      }
    }
    case 'LTC': {
      if (address.indexOf('1q') != -1) {
        return 'P2WPKH';
      } if (address.indexOf('1p') != -1) {
        return 'P2TR';
      } else if (address.startsWith('3') || address.startsWith('L')) {
        return 'P2PKH';
      } else if (address.startsWith('M')) {
        return 'P2SH';
      } else {
        return 'P2PK';
      }
    }
    case 'ZEC':
      return address.startsWith('t1') ? 'P2PKH' : 'P2UPKH';
    case 'TAN':
      return 'P2PKH';
    default:
      return 'P2A';
  }
}
export function toTextAddress(pair: any, policy?: string): string {
  const address = pair.address;
  const tag = pair.tag || (policy == 'memo' ? '0' : null);
  return tag ? address + '#' + tag : address;
}

export function AddressView(props: { address: { asset: AssetId, purpose?: string, addresses: { address: string, tag?: string | null }[] }, policy?: string, onExit?: () => any, initialVariant?: number, onVariantChange?: (index: number) => void }) {
  const [variant, setVariant] = useState<number>(props.initialVariant ?? 0);
  const target = useMemo((): { address: string, tag?: string | null } => {
    return variant >= 0 && variant < props.address.addresses.length ? props.address.addresses[variant] : props.address.addresses[0];
  }, [props.address, variant]);
  const variants = useMemo(() => {
    const duplicates: Record<string, number> = { };
    const results = props.address.addresses.map((x: any) => toAddressVariant(props.address.asset.chain, x.address));
    for (let i = 0; i < results.length; i++) {
      const type = results[i];
      if (duplicates[type]) {
        for (let j = 0; j < i; j++) {
          if (results[j] == type) {
            results[j] = type + 'v' + duplicates[type].toString();
            break;
          }
        }
        ++duplicates[type];
        results[i] = type + 'v' + duplicates[type].toString();
      } else {
        duplicates[type] = 1;
      }
    }
    return results;
  }, [props.address]);
  return (
    <Box className="address-view">
      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 16 }}>
        <Select.Root size="3" value={variant.toString()} onValueChange={(value) => { const index = parseInt(value); setVariant(index); if (props.onVariantChange) props.onVariantChange(index); }}>
          <Select.Trigger className="token-select" radius="full">
            <AssetImage asset={props.address.asset} size="1" iconSize="24px"></AssetImage>
            { UiUtil.toAddress(toTextAddress(target, props.policy), 6) }
          </Select.Trigger>
          <Select.Content>
            <Select.Group>
              <Select.Label>Select address</Select.Label>
              {
                props.address.addresses.map((address, index) =>
                  <Select.Item value={index.toString()} key={address.address + '_address_' + index.toString()}>
                    { UiUtil.toAddress(toTextAddress(address, props.policy), 6) } ({ variants[index] }{ address.tag ? ', Memo/DT' : '' })
                  </Select.Item>
                )
              }
            </Select.Group>
          </Select.Content>
        </Select.Root>
      </div>
      <div className="qr-real" title="Click to copy">
        {
          target.address &&
          <QRCode bgColor="transparent" fgColor="#0B0D0C" value={ toTextAddress(target, props.policy) } style={{ height: "auto", maxWidth: "100%", width: "100%" }} onClick={() => {
            navigator.clipboard.writeText(toTextAddress(target, props.policy));
            AlertBox.open(AlertType.Info, variants[variant] + ' address copied!')
          }} />
        }
      </div>
      <div className="av-k">{ toAddressType(props.address.purpose || '') }{ target.tag ? '' : '' }</div>
      <div className="av-addr">{ UiUtil.toAddress(toTextAddress(target, props.policy), 6) }</div>
      {
        target.tag &&
        <div className="av-memo">
          <div className="av-k">Memo · tag</div>
          <div className="av-memo-v">{ target.tag }</div>
        </div>
      }
      <Flex gap="2" justify="center" mt="4">
        <Button className="btn-soft" onClick={() => {
          navigator.clipboard.writeText(toTextAddress(target, props.policy));
          AlertBox.open(AlertType.Info, variants[variant] + ' address copied!');
        }}>Copy address</Button>
        {
          target.tag &&
          <Button className="btn-soft" onClick={() => {
            navigator.clipboard.writeText(String(target.tag));
            AlertBox.open(AlertType.Info, 'Memo copied!');
          }}>Copy memo</Button>
        }
        {
          props.onExit &&
          <button className="icon-btn" onClick={() => {
            setVariant(-1);
            if (props.onExit)
              props.onExit();
          }}>
            <Icon path={mdiClose} size={1}></Icon>
          </button>
        }
      </Flex>
    </Box>
  )
}