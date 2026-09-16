import { mdiClose } from "@mdi/js";
import { AspectRatio, Box, Flex, IconButton, Select, Text } from "@radix-ui/themes";
import { UiUtil } from "tangentsdk/ui";
import { useMemo, useState } from "react";
import { AlertBox, AlertType } from "./alert";
import { AssetImage } from "./asset-image";
import Icon from "@mdi/react";
import QRCode from "react-qr-code";
import './address.css';

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
function toAddressVariant(network: string, address: string): string {
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

export function AddressView(props: { address: any, policy?: string, onExit?: () => any }) {
  const [variant, setVariant] = useState<number>(0);
  const target = useMemo((): { address: string, tag: string | null } => {
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
    <Box>
      <Flex align="center" justify="center" mb="3">
        <Text size="3" weight="bold" style={{ textTransform: 'uppercase' }}>
          { toAddressType(props.address.purpose) }
        </Text>
      </Flex>
      <Flex justify="center" width="100%">
        <Box width="80%" maxWidth="280px" px="3" py="3" className="qr-code-active shadow-rainbow-animation">
          <AspectRatio ratio={1}>
            {
              target.address &&
              <QRCode bgColor="transparent" value={ toTextAddress(target, props.policy) } style={{ height: "auto", maxWidth: "100%", width: "100%" }} onClick={() => {
                navigator.clipboard.writeText(toTextAddress(target, props.policy));
                AlertBox.open(AlertType.Info, variants[variant] + ' address copied!')
              }} />
            }
          </AspectRatio>
        </Box>
      </Flex>
      <Flex align="center" justify="center" mt="3" gap="2">
        <AssetImage asset={props.address.asset} size="2"></AssetImage>
        <Select.Root size="3" value={variant.toString()} onValueChange={(value) => setVariant(parseInt(value))}>
          <Select.Trigger color={props.address.purpose != 'witness' ? (props.address.purpose != 'bridge' ? undefined : 'blue') : 'red'} variant="soft">
            { UiUtil.toAddress(toTextAddress(target, props.policy), 6) }
          </Select.Trigger>
          <Select.Content>
            <Select.Group>
              <Select.Label>Select address</Select.Label>
              {
                props.address.addresses.map((address: any, index: number) =>
                  <Select.Item value={index.toString()} key={address.address + '_address_' + index.toString()}>
                    <Flex align="center" gap="1">
                      <Text>{ UiUtil.toAddress(toTextAddress(address, props.policy), 6) } ({ variants[index] }{ address.tag ? ', Memo/DT' : '' })</Text>
                    </Flex>
                  </Select.Item>
                )
              }
            </Select.Group>
          </Select.Content>
        </Select.Root>
        {
          props.onExit &&
          <IconButton variant="soft" size="3" color="red" onClick={() => {
            setVariant(-1);
            if (props.onExit)
              props.onExit();
          }}>
            <Icon path={mdiClose} size={1}></Icon>
          </IconButton>
        }
      </Flex>
    </Box>
  )
}